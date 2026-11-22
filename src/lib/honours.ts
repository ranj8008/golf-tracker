// Records for the Honours board, all worked out from the rounds. Ties go to the
// earliest round, with a count of the others that share it.

import type { RoundStats } from "./stats.ts";

export type Honour = {
  label: string;
  value: string;
  holder: RoundStats;
  others: number; // other rounds sharing the record
};

type Metric = (r: RoundStats) => number | null;

const byDate = (a: RoundStats, b: RoundStats) =>
  a.round.played_on.localeCompare(b.round.played_on);

function best(
  rounds: RoundStats[],
  label: string,
  metric: Metric,
  better: "low" | "high",
  show: (v: number, r: RoundStats) => string = (v) => String(v),
): Honour | null {
  const scored = rounds
    .map((r) => ({ r, v: metric(r) }))
    .filter((x): x is { r: RoundStats; v: number } => x.v !== null);
  if (!scored.length) return null;
  const target =
    better === "low"
      ? Math.min(...scored.map((x) => x.v))
      : Math.max(...scored.map((x) => x.v));
  const holders = scored
    .filter((x) => Math.abs(x.v - target) < 1e-9)
    .map((x) => x.r)
    .sort(byDate);
  return {
    label,
    value: show(target, holders[0]),
    holder: holders[0],
    others: holders.length - 1,
  };
}

const toPar = (n: number) => (n === 0 ? "E" : n > 0 ? `+${n}` : `−${-n}`);
const complete = (r: RoundStats) => r.rows.every((h) => h.score !== null);
const nineGross = (r: RoundStats, from: number) => {
  const nine = r.rows.slice(from, from + 9);
  return nine.length === 9 && nine.every((h) => h.score !== null)
    ? nine.reduce((s, h) => s + h.score!, 0)
    : null;
};
const ninePar = (r: RoundStats, from: number) =>
  r.rows.slice(from, from + 9).reduce((s, h) => s + h.par, 0);
const count = (r: RoundStats, f: (d: number) => boolean) =>
  r.rows.filter((h) => h.toPar !== null && f(h.toPar)).length;

// Holes in a row at par or better.
function longestRun(r: RoundStats): number {
  let best = 0;
  let run = 0;
  for (const h of r.rows) {
    run = h.toPar !== null && h.toPar <= 0 ? run + 1 : 0;
    best = Math.max(best, run);
  }
  return best;
}

export function scoringRecords(rounds: RoundStats[]): Honour[] {
  const full = rounds.filter((r) => r.rows.length === 18);
  return [
    best(rounds, "Best gross", (r) => r.gross, "low", (v, r) => `${v} (${toPar(v - r.par)})`),
    best(rounds, "Best net", (r) => r.net, "low", (v, r) => `${v} (${toPar(v - r.par)})`),
    best(rounds, "Most points", (r) => r.points, "high"),
    best(full, "Best front 9", (r) => nineGross(r, 0), "low", (v, r) => `${v} (${toPar(v - ninePar(r, 0))})`),
    best(full, "Best back 9", (r) => nineGross(r, 9), "low", (v, r) => `${v} (${toPar(v - ninePar(r, 9))})`),
    best(rounds, "Lowest differential", (r) => r.differential, "low", (v) => v.toFixed(1)),
    best(rounds, "Most birdies", (r) => count(r, (d) => d === -1), "high"),
    best(rounds, "Most pars", (r) => count(r, (d) => d === 0), "high"),
    best(
      rounds.filter(complete),
      "Fewest bogeys or worse",
      (r) => count(r, (d) => d >= 1),
      "low",
    ),
    best(rounds, "Longest run of par or better", longestRun, "high", (v) => `${v} holes`),
  ].filter((x): x is Honour => x !== null);
}

export function shortGameRecords(rounds: RoundStats[]): Honour[] {
  const withStats = rounds.filter(
    (r) => !r.scoresOnly && r.rows.every((h) => h.putts !== null),
  );
  const pct = (hit: number, of: number) => (of ? (hit / of) * 100 : null);
  return [
    best(withStats, "Fewest putts", (r) => r.rows.reduce((s, h) => s + h.putts!, 0), "low"),
    best(withStats, "Most one-putts", (r) => r.rows.filter((h) => h.putts === 1).length, "high"),
    best(withStats, "Most greens in regulation", (r) => r.rows.filter((h) => h.gir === true).length, "high",
      (v, r) => `${v} of ${r.rows.length}`),
    best(withStats, "Most fairways hit", (r) => r.rows.filter((h) => h.fir === true).length, "high",
      (v, r) => `${v} of ${r.rows.filter((h) => h.fir !== null).length}`),
    best(
      withStats,
      "Best scrambling",
      (r) =>
        pct(
          r.rows.filter((h) => h.scramble === true).length,
          r.rows.filter((h) => h.scramble !== null).length,
        ),
      "high",
      (v) => `${Math.round(v)}%`,
    ),
  ].filter((x): x is Honour => x !== null);
}

export type Highlight = {
  stats: RoundStats;
  hole: number;
  par: number;
  score: number;
  kind: string; // "Hole in one", "Albatross", "Eagle"
};

// Every eagle or better, and every hole in one, newest first.
export function highlights(rounds: RoundStats[]): Highlight[] {
  return rounds
    .flatMap((stats) =>
      stats.rows
        .filter((h) => h.score !== null && (h.score === 1 || h.toPar! <= -2))
        .map((h) => ({
          stats,
          hole: h.hole,
          par: h.par,
          score: h.score!,
          kind: h.score === 1 ? "Hole in one" : h.toPar! <= -3 ? "Albatross" : "Eagle",
        })),
    )
    .sort((a, b) => b.stats.round.played_on.localeCompare(a.stats.round.played_on));
}

export type GroupRow = {
  key: string; // year, or course id
  label: string;
  rounds: number;
  bestGross: RoundStats | null;
  bestPoints: RoundStats | null;
  avgGross: number | null;
  lowestDifferential: number | null;
};

function group(key: string, label: string, rs: RoundStats[]): GroupRow {
  const withGross = rs.filter((r) => r.gross !== null);
  const diffs = rs.flatMap((r) => (r.differential === null ? [] : [r.differential]));
  return {
    key,
    label,
    rounds: rs.length,
    bestGross: best(withGross, "", (r) => r.gross, "low")?.holder ?? null,
    bestPoints: best(rs, "", (r) => r.points, "high")?.holder ?? null,
    avgGross: withGross.length
      ? withGross.reduce((s, r) => s + r.gross!, 0) / withGross.length
      : null,
    lowestDifferential: diffs.length ? Math.min(...diffs) : null,
  };
}

export function byYear(rounds: RoundStats[]): GroupRow[] {
  const years = [...new Set(rounds.map((r) => r.round.played_on.slice(0, 4)))].sort(
    (a, b) => b.localeCompare(a),
  );
  return years.map((y) =>
    group(y, y, rounds.filter((r) => r.round.played_on.startsWith(y))),
  );
}

export function byCourse(rounds: RoundStats[]): GroupRow[] {
  const courses = new Map(rounds.map((r) => [r.round.course_id, r.round.course.name]));
  return [...courses]
    .map(([id, name]) => group(id, name, rounds.filter((r) => r.round.course_id === id)))
    .sort((a, b) => b.rounds - a.rounds || a.label.localeCompare(b.label));
}
