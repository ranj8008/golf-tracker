// Golf maths. Everything shown about a round (net, Stableford points, GIR,
// scrambling, birdies…) is worked out here from what's entered, never stored.

export type Fairway = "hit" | "left" | "right" | "short";

export type TeeHoles = {
  par: number[];
  yards: (number | null)[];
  strokeIndex: number[];
};

export type HoleEntry = {
  score: number | null; // null: picked up / no score
  putts: number | null;
  fairway: Fairway | null; // par 4s and 5s only
  penalties: number | null;
  bunker: boolean; // in a greenside bunker
  chips: number | null; // chips and pitches around the green
};

export type HoleResult = HoleEntry & {
  hole: number; // 1-based
  par: number;
  yards: number | null;
  strokeIndex: number;
  shots: number; // handicap strokes received (negative for a plus handicap)
  net: number | null;
  points: number;
  fir: boolean | null; // null on par 3s or when not entered
  gir: boolean | null; // null without a score and putts
  scramble: boolean | null; // only when the green was missed
  toPar: number | null;
};

// Handicap strokes on a hole: one per full round of the stroke indexes, plus one
// more on the hardest holes. A plus handicap gives strokes back from the easiest
// hole (highest stroke index) down.
export function shotsReceived(
  playingHandicap: number,
  strokeIndex: number,
  holes = 18,
): number {
  if (playingHandicap >= 0) {
    return (
      Math.floor(playingHandicap / holes) +
      (strokeIndex <= playingHandicap % holes ? 1 : 0)
    );
  }
  const plus = -playingHandicap;
  const back =
    Math.floor(plus / holes) + (strokeIndex > holes - (plus % holes) ? 1 : 0);
  return back === 0 ? 0 : -back;
}

export const stablefordPoints = (par: number, net: number | null) =>
  net === null ? 0 : Math.max(0, 2 + par - net);

// Green in regulation: on the green with two shots to spare for par.
export const isGir = (par: number, score: number, putts: number) =>
  score - putts <= par - 2;

export function holeResult(
  i: number,
  tee: TeeHoles,
  entry: HoleEntry,
  playingHandicap: number,
): HoleResult {
  const par = tee.par[i];
  const n = tee.par.length;
  const shots = shotsReceived(playingHandicap, tee.strokeIndex[i], n);
  const { score, putts, fairway } = entry;
  const net = score === null ? null : score - shots;
  const gir =
    score === null || putts === null ? null : isGir(par, score, putts);
  return {
    ...entry,
    hole: i + 1,
    par,
    yards: tee.yards[i] ?? null,
    strokeIndex: tee.strokeIndex[i],
    shots,
    net,
    points: stablefordPoints(par, net),
    fir: par < 4 || fairway === null ? null : fairway === "hit",
    gir,
    scramble: gir === false && score !== null ? score <= par : null,
    toPar: score === null ? null : score - par,
  };
}

export type Totals = {
  holes: number;
  yards: number;
  par: number;
  gross: number | null; // null if any hole has no score
  net: number | null;
  points: number;
  putts: number;
  penalties: number;
  firHit: number;
  firOf: number;
  girHit: number;
  girOf: number;
  scrambleMade: number;
  scrambleOf: number;
  eagles: number; // or better
  birdies: number;
  pars: number;
  bogeys: number;
  doubles: number; // or worse
  onePutts: number;
  threePutts: number; // or more
};

export function totals(rows: HoleResult[]): Totals {
  const sum = (f: (r: HoleResult) => number) =>
    rows.reduce((s, r) => s + f(r), 0);
  const count = (f: (r: HoleResult) => boolean) => rows.filter(f).length;
  const complete = rows.every((r) => r.score !== null);
  const gross = complete ? sum((r) => r.score!) : null;
  return {
    holes: rows.length,
    yards: sum((r) => r.yards ?? 0),
    par: sum((r) => r.par),
    gross,
    net: complete ? sum((r) => r.net!) : null,
    points: sum((r) => r.points),
    putts: sum((r) => r.putts ?? 0),
    penalties: sum((r) => r.penalties ?? 0),
    firHit: count((r) => r.fir === true),
    firOf: count((r) => r.fir !== null),
    girHit: count((r) => r.gir === true),
    girOf: count((r) => r.gir !== null),
    scrambleMade: count((r) => r.scramble === true),
    scrambleOf: count((r) => r.scramble !== null),
    eagles: count((r) => r.toPar !== null && r.toPar <= -2),
    birdies: count((r) => r.toPar === -1),
    pars: count((r) => r.toPar === 0),
    bogeys: count((r) => r.toPar === 1),
    doubles: count((r) => r.toPar !== null && r.toPar >= 2),
    onePutts: count((r) => r.putts === 1),
    threePutts: count((r) => r.putts !== null && r.putts >= 3),
  };
}

export const pct = (hit: number, of: number) =>
  of === 0 ? "–" : `${Math.round((hit / of) * 100)}%`;

export const blankEntry = (): HoleEntry => ({
  score: null,
  putts: null,
  fairway: null,
  penalties: null,
  bunker: false,
  chips: null,
});

export function scorecard(
  tee: TeeHoles,
  entries: HoleEntry[],
  playingHandicap: number,
) {
  const rows = tee.par.map((_, i) =>
    holeResult(i, tee, entries[i] ?? blankEntry(), playingHandicap),
  );
  return {
    rows,
    out: totals(rows.slice(0, 9)),
    in: totals(rows.slice(9)),
    total: totals(rows),
  };
}

// "+3", "−2", "E"
export function formatToPar(n: number) {
  return n === 0 ? "E" : n > 0 ? `+${n}` : `−${-n}`;
}
