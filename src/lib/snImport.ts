// One-off import of rounds from the old ServiceNow golf app (JSONv2 exports of its
// five tables). Pure functions: reading the files, matching courses and tees to the
// ones already here, checking every round against ServiceNow's own totals, and
// building what to save. The /import page does the saving.

import { autoGir, scorecard, type HoleEntry } from "./golf.ts";

type Rec = Record<string, string>;

export type SnFiles = {
  courses: Rec[];
  tees: Rec[];
  holes: Rec[];
  rounds: Rec[];
  roundHoles: Rec[];
};

export const REF = (sysId: string) => `servicenow:${sysId}`;

// Which table a file came from, told by its fields rather than its name.
export function identify(records: Rec[]): keyof SnFiles | null {
  const f = records[0] ?? {};
  if ("round_date" in f) return "rounds";
  if ("round" in f && "score" in f) return "roundHoles";
  if ("stroke_index" in f) return "holes";
  if ("course_rating" in f && "course" in f) return "tees";
  if ("name" in f && "sys_id" in f) return "courses";
  return null;
}

export function parseFile(text: string): Rec[] {
  const data = JSON.parse(text);
  if (!Array.isArray(data?.records)) throw new Error("Not a ServiceNow JSON export.");
  return data.records as Rec[];
}

const key = (s: string) => s.trim().toLowerCase();
const num = (s: string | undefined) =>
  s === undefined || s === "" ? null : Number(s);

export type Existing = {
  courses: { id: string; name: string; source_ref: string | null }[];
  tees: {
    id: string;
    course_id: string;
    name: string;
    source_ref: string | null;
  }[];
  roundRefs: Set<string>;
  roundDates: Set<string>; // "date|tee_id" of rounds entered here by hand
};

export type NewTee = {
  snId: string;
  snCourseId: string;
  name: string;
  course_rating: number | null;
  slope: number | null;
  par: number[];
  yards: number[];
  stroke_index: number[];
};

export type PlannedRound = {
  snId: string;
  snCourseId: string;
  snTeeId: string;
  courseName: string;
  teeName: string;
  played_on: string;
  handicap_index: number | null;
  playing_handicap: number;
  pcc: number;
  stats: boolean;
  girKept: number;
  holes: HoleEntry[];
  check: string | null; // null when it matches ServiceNow's totals
};

export type Plan = {
  newCourses: { snId: string; name: string }[];
  matchedCourses: Map<string, string>; // ServiceNow course id -> our course id
  newTees: NewTee[];
  matchedTees: Map<string, string>; // ServiceNow tee id -> our tee id
  rounds: PlannedRound[]; // to import
  alreadyImported: number;
  possibleDuplicates: PlannedRound[]; // imported too, but same date and tees as a round entered here
  problems: string[]; // rounds that can't be imported
  statsRounds: number;
  girKept: number; // holes where ServiceNow's GIR differs from score and putts
};

export function plan(files: SnFiles, existing: Existing): Plan {
  const courseName = new Map(files.courses.map((c) => [c.sys_id, c.name.trim()]));

  // Courses: match by ServiceNow id if imported before, else by name.
  const matchedCourses = new Map<string, string>();
  const newCourses: Plan["newCourses"] = [];
  for (const c of files.courses) {
    const hit =
      existing.courses.find((x) => x.source_ref === REF(c.sys_id)) ??
      existing.courses.find((x) => key(x.name) === key(c.name));
    if (hit) matchedCourses.set(c.sys_id, hit.id);
    else newCourses.push({ snId: c.sys_id, name: c.name.trim() });
  }

  // Tees, with their holes in order.
  const holesByTee = new Map<string, Rec[]>();
  for (const h of files.holes) {
    const list = holesByTee.get(h.tee) ?? [];
    list.push(h);
    holesByTee.set(h.tee, list);
  }
  const teeHoles = new Map<string, { par: number[]; yards: number[]; si: number[] }>();
  for (const [tee, list] of holesByTee) {
    list.sort((a, b) => Number(a.hole) - Number(b.hole));
    teeHoles.set(tee, {
      par: list.map((h) => Number(h.par)),
      yards: list.map((h) => Number(h.yards) || 0),
      si: list.map((h) => Number(h.stroke_index)),
    });
  }
  const matchedTees = new Map<string, string>();
  const newTees: NewTee[] = [];
  const teeName = new Map(files.tees.map((t) => [t.sys_id, t.name.trim()]));
  for (const t of files.tees) {
    const ourCourse = matchedCourses.get(t.course);
    const hit =
      existing.tees.find((x) => x.source_ref === REF(t.sys_id)) ??
      (ourCourse
        ? existing.tees.find(
            (x) => x.course_id === ourCourse && key(x.name) === key(t.name),
          )
        : undefined);
    if (hit) {
      matchedTees.set(t.sys_id, hit.id);
      continue;
    }
    const h = teeHoles.get(t.sys_id);
    if (!h || (h.par.length !== 9 && h.par.length !== 18)) continue;
    newTees.push({
      snId: t.sys_id,
      snCourseId: t.course,
      name: t.name.trim(),
      course_rating: num(t.course_rating),
      slope: num(t.slope),
      par: h.par,
      yards: h.yards,
      stroke_index: h.si,
    });
  }

  // Rounds and their holes.
  const holesByRound = new Map<string, Rec[]>();
  for (const h of files.roundHoles) {
    const list = holesByRound.get(h.round) ?? [];
    list.push(h);
    holesByRound.set(h.round, list);
  }
  const rounds: PlannedRound[] = [];
  const possibleDuplicates: PlannedRound[] = [];
  const problems: string[] = [];
  let alreadyImported = 0;
  for (const r of files.rounds) {
    if (existing.roundRefs.has(REF(r.sys_id))) {
      alreadyImported++;
      continue;
    }
    const label = `${r.round_date} ${courseName.get(r.course) ?? "?"}`;
    const h = teeHoles.get(r.tee);
    if (!h) {
      problems.push(`${label}: its tees have no holes in the export.`);
      continue;
    }
    const stats = r.stats_tracked === "true";
    let kept = 0;
    const byHole = new Map(
      (holesByRound.get(r.sys_id) ?? []).map((x) => [Number(x.hole), x]),
    );
    // Rounds without stats tracked only have real scores: ServiceNow filled putts
    // with 0 and FIR/GIR with false, which would count as missed here.
    const holes: HoleEntry[] = h.par.map((par, i) => {
      const x = byHole.get(i + 1);
      if (!x)
        return { score: null, putts: null, fir: null, gir: null, penalties: null };
      const e: HoleEntry = {
        score: num(x.score) || null,
        putts: stats ? num(x.putts) : null,
        fir: stats && par >= 4 ? x.fir === "true" : null,
        gir: null,
        penalties: null,
      };
      if (stats) {
        const given = x.gir === "true";
        if (autoGir(par, e) !== given) {
          e.gir = given;
          kept++;
        }
      }
      return e;
    });
    const ph = Number(r.playing_handicap) || 0;
    const t = scorecard(
      { par: h.par, yards: h.yards, strokeIndex: h.si },
      holes,
      ph,
    ).total;
    const diffs: string[] = [];
    const same = (name: string, a: number | null, b: number | null, tol = 0) => {
      if (a === null || b === null ? a !== b : Math.abs(a - b) > tol)
        diffs.push(`${name} ${a ?? "–"} here, ${b ?? "–"} in ServiceNow`);
    };
    const pc = (hit: number, of: number) =>
      of ? Math.round((hit / of) * 1000) / 10 : 0;
    same("gross", t.gross, num(r.gross_score));
    same("net", t.net, num(r.net_score));
    same("points", t.points, num(r.stableford));
    if (stats) {
      same("fairways %", pc(t.firHit, t.firOf), num(r.fir_pct), 0.6);
      same("greens %", pc(t.girHit, t.girOf), num(r.gir_pct), 0.6);
      same("scrambling %", pc(t.scrambleMade, t.scrambleOf), num(r.scrambling_pct), 0.6);
    }
    const planned: PlannedRound = {
      snId: r.sys_id,
      snCourseId: r.course,
      snTeeId: r.tee,
      courseName: courseName.get(r.course) ?? "?",
      teeName: teeName.get(r.tee) ?? "?",
      played_on: r.round_date,
      handicap_index: num(r.handicap_index),
      playing_handicap: ph,
      pcc: num(r.pcc) ?? 0,
      stats,
      girKept: kept,
      holes,
      check: diffs.length ? diffs.join(", ") : null,
    };
    const ourTee = matchedTees.get(r.tee);
    if (ourTee && existing.roundDates.has(`${r.round_date}|${ourTee}`))
      possibleDuplicates.push(planned);
    rounds.push(planned);
  }
  rounds.sort((a, b) => a.played_on.localeCompare(b.played_on));
  // Counted over the rounds that will be imported, not skipped ones.
  const statsRounds = rounds.filter((x) => x.stats).length;
  const girKept = rounds.reduce((n, x) => n + x.girKept, 0);

  return {
    newCourses,
    matchedCourses,
    newTees,
    matchedTees,
    rounds,
    alreadyImported,
    possibleDuplicates,
    problems,
    statsRounds,
    girKept,
  };
}
