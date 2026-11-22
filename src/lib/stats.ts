// Stats across rounds: scoring averages, score mix, scoring by par, short-game
// figures (rounds with putts recorded only) and a handicap-style index.

import type { Round } from "./data.ts";
import {
  blankEntry,
  scorecard,
  shotsReceived,
  type HoleEntry,
  type HoleResult,
} from "./golf.ts";

// A round's holes in order (kept here, not taken from data.ts, so this file can be
// tested on its own).
function entriesFor(round: Round): HoleEntry[] {
  const byHole = new Map(round.hole_scores.map((h) => [h.hole, h]));
  return round.tee.par.map((_, i) => {
    const h = byHole.get(i + 1);
    return h
      ? { score: h.score, putts: h.putts, fir: h.fir, gir: h.gir, penalties: h.penalties }
      : blankEntry();
  });
}
const teeHoles = (t: Round["tee"]) => ({
  par: t.par,
  yards: t.yards,
  strokeIndex: t.stroke_index,
});

const avg = (xs: number[]) =>
  xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;

export type RoundStats = {
  round: Round;
  rows: HoleResult[];
  gross: number | null;
  net: number | null;
  points: number;
  par: number;
  scoresOnly: boolean;
  differential: number | null;
};

// Score differential, as the handicap system works it out: each hole capped at net
// double bogey (par + 2 + handicap strokes; a hole with no score counts as that
// too), then (113 / slope) × (adjusted gross − course rating − PCC), to one decimal.
// Needs an 18-hole tee with a rating and slope.
export function differential(round: Round): number | null {
  const t = round.tee;
  if (t.course_rating === null || t.slope === null || t.par.length !== 18)
    return null;
  const entries = entriesFor(round);
  const adjusted = t.par.reduce((sum, par, i) => {
    const cap = par + 2 + shotsReceived(round.playing_handicap, t.stroke_index[i]);
    const score = entries[i].score;
    return sum + (score === null ? cap : Math.min(score, cap));
  }, 0);
  const d = (113 / t.slope) * (adjusted - t.course_rating - (round.pcc ?? 0));
  return Math.round(d * 10) / 10;
}

const cache = new WeakMap<Round, RoundStats>();
export function roundStats(round: Round): RoundStats {
  let s = cache.get(round);
  if (!s) {
    const card = scorecard(teeHoles(round.tee), entriesFor(round), round.playing_handicap);
    s = {
      round,
      rows: card.rows,
      gross: card.total.gross,
      net: card.total.net,
      points: card.total.points,
      par: card.total.par,
      scoresOnly: round.hole_scores.every((h) => h.putts === null),
      differential: differential(round),
    };
    cache.set(round, s);
  }
  return s;
}

// How many of the most recent differentials count, and the adjustment, by how many
// there are (World Handicap System table, up to 20).
const counting: Record<number, [number, number]> = {
  3: [1, -2], 4: [1, -1], 5: [1, 0], 6: [2, -1], 7: [2, 0], 8: [2, 0],
  9: [3, 0], 10: [3, 0], 11: [3, 0], 12: [4, 0], 13: [4, 0], 14: [4, 0],
  15: [5, 0], 16: [5, 0], 17: [6, 0], 18: [6, 0], 19: [7, 0], 20: [8, 0],
};

export type HandicapFigure = {
  index: number | null; // null with fewer than 3 differentials
  last20: { stats: RoundStats; counts: boolean }[]; // oldest first
  used: number;
};

export function handicap(rounds: RoundStats[]): HandicapFigure {
  const recent = rounds
    .filter((r) => r.differential !== null)
    .sort((a, b) =>
      b.round.played_on.localeCompare(a.round.played_on) ||
      (b.round.created_at ?? "").localeCompare(a.round.created_at ?? ""),
    )
    .slice(0, 20);
  const rule = counting[recent.length];
  const best = new Set(
    rule
      ? [...recent]
          .sort((a, b) => a.differential! - b.differential!)
          .slice(0, rule[0])
      : [],
  );
  const index = rule
    ? Math.round(
        ((avg([...best].map((r) => r.differential!)) ?? 0) + rule[1]) * 10,
      ) / 10
    : null;
  return {
    index,
    last20: recent.reverse().map((stats) => ({ stats, counts: best.has(stats) })),
    used: best.size,
  };
}

export type Summary = {
  rounds: number;
  avgGross: number | null;
  avgToPar: number | null;
  avgNet: number | null;
  avgPoints: number | null;
  bestGross: RoundStats | null;
  bestPoints: RoundStats | null;
  mix: { eagles: number; birdies: number; pars: number; bogeys: number; doubles: number }; // per round
  byPar: { par: number; avg: number; holes: number }[];
  statsRounds: number;
  short: {
    putts: number | null; // per round
    puttsPerGir: number | null;
    onePutts: number | null; // per round
    threePutts: number | null; // per round
    fir: number | null; // %
    gir: number | null; // %
    scrambling: number | null; // %
    penalties: number | null; // per round
  };
};

export function summarise(rounds: RoundStats[]): Summary {
  const complete = rounds.filter((r) => r.gross !== null);
  const holes = rounds.flatMap((r) => r.rows).filter((h) => h.score !== null);
  const count = (f: (h: HoleResult) => boolean) =>
    rounds.length ? holes.filter(f).length / rounds.length : 0;

  const withStats = rounds.filter((r) => !r.scoresOnly);
  const sHoles = withStats.flatMap((r) => r.rows);
  const pct = (hit: number, of: number) => (of ? (hit / of) * 100 : null);
  const per = (n: number) => (withStats.length ? n / withStats.length : null);
  const girHoles = sHoles.filter((h) => h.gir === true && h.putts !== null);

  return {
    rounds: rounds.length,
    avgGross: avg(complete.map((r) => r.gross!)),
    avgToPar: avg(complete.map((r) => r.gross! - r.par)),
    avgNet: avg(complete.map((r) => r.net!)),
    avgPoints: avg(rounds.map((r) => r.points)),
    bestGross: complete.reduce<RoundStats | null>(
      (b, r) => (!b || r.gross! < b.gross! ? r : b), null),
    bestPoints: rounds.reduce<RoundStats | null>(
      (b, r) => (!b || r.points > b.points ? r : b), null),
    mix: {
      eagles: count((h) => h.toPar! <= -2),
      birdies: count((h) => h.toPar === -1),
      pars: count((h) => h.toPar === 0),
      bogeys: count((h) => h.toPar === 1),
      doubles: count((h) => h.toPar! >= 2),
    },
    byPar: [3, 4, 5].map((par) => {
      const hs = holes.filter((h) => h.par === par);
      return { par, avg: avg(hs.map((h) => h.score!)) ?? 0, holes: hs.length };
    }).filter((p) => p.holes > 0),
    statsRounds: withStats.length,
    short: {
      putts: per(sHoles.reduce((n, h) => n + (h.putts ?? 0), 0)),
      puttsPerGir: girHoles.length
        ? girHoles.reduce((n, h) => n + h.putts!, 0) / girHoles.length
        : null,
      onePutts: per(sHoles.filter((h) => h.putts === 1).length),
      threePutts: per(sHoles.filter((h) => (h.putts ?? 0) >= 3).length),
      fir: pct(sHoles.filter((h) => h.fir === true).length, sHoles.filter((h) => h.fir !== null).length),
      gir: pct(sHoles.filter((h) => h.gir === true).length, sHoles.filter((h) => h.gir !== null).length),
      scrambling: pct(
        sHoles.filter((h) => h.scramble === true).length,
        sHoles.filter((h) => h.scramble !== null).length,
      ),
      penalties: per(sHoles.reduce((n, h) => n + (h.penalties ?? 0), 0)),
    },
  };
}

// Moving average over the previous `n` values (fewer at the start).
export function movingAverage(xs: number[], n: number): number[] {
  return xs.map((_, i) => {
    const w = xs.slice(Math.max(0, i - n + 1), i + 1);
    return w.reduce((a, b) => a + b, 0) / w.length;
  });
}
