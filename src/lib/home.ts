// What the Home page says about your latest round and the season: milestones the
// latest round earned, recent form and the handicap figure's movement.

import { brokeEighty, handicap, type RoundStats } from "./stats.ts";

const newestFirst = (a: RoundStats, b: RoundStats) =>
  b.round.played_on.localeCompare(a.round.played_on) ||
  (b.round.created_at ?? "").localeCompare(a.round.created_at ?? "");

export function latestFirst(rounds: RoundStats[]): RoundStats[] {
  return [...rounds].sort(newestFirst);
}

const ordinal = (n: number) => {
  const tens = n % 100;
  const suffix =
    tens >= 11 && tens <= 13
      ? "th"
      : ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ?? "th";
  return `${n}${suffix}`;
};

// Milestones the latest round earned, most special first. `earlier` is every round
// before it.
export function milestones(latest: RoundStats, earlier: RoundStats[]): string[] {
  const out: string[] = [];
  for (const h of latest.rows) {
    if (h.score === 1) out.push(`Hole in one on the ${ordinal(h.hole)}`);
  }
  const g = latest.gross;
  const lowest = (rs: RoundStats[]) =>
    Math.min(...rs.flatMap((r) => (r.gross === null ? [] : [r.gross])));
  if (g !== null && earlier.some((r) => r.gross !== null) && g < lowest(earlier))
    out.push("New personal best");
  for (const h of latest.rows) {
    if (h.score !== 1 && h.toPar !== null && h.toPar <= -3)
      out.push(`Albatross on the ${ordinal(h.hole)}`);
    else if (h.score !== 1 && h.toPar === -2) out.push(`Eagle on the ${ordinal(h.hole)}`);
  }
  if (g !== null) {
    const atCourse = earlier.filter(
      (r) => r.round.course_id === latest.round.course_id && r.gross !== null,
    );
    if (atCourse.length && g < lowest(atCourse) && !out.includes("New personal best"))
      out.push(`New course record at ${latest.round.course.name}`);
    const year = latest.round.played_on.slice(0, 4);
    const thisYear = earlier.filter(
      (r) => r.round.played_on.startsWith(year) && r.gross !== null,
    );
    if (
      thisYear.length &&
      g < lowest(thisYear) &&
      !out.some((m) => m.startsWith("New "))
    )
      out.push(`Best score of ${year}`);
  }
  if (brokeEighty(latest)) out.push("Broke 80!");
  return out;
}

export type Form = {
  last5: number | null; // average gross of the last 5 complete rounds
  usual: number | null; // average gross of all complete rounds
  recent: number[]; // the last 20 grosses, oldest first
};

export function form(newestFirstRounds: RoundStats[]): Form {
  const complete = newestFirstRounds.filter((r) => r.gross !== null);
  const avg = (rs: RoundStats[]) =>
    rs.length ? rs.reduce((s, r) => s + r.gross!, 0) / rs.length : null;
  return {
    last5: complete.length >= 5 ? avg(complete.slice(0, 5)) : null,
    usual: avg(complete),
    recent: complete.slice(0, 20).map((r) => r.gross!).reverse(),
  };
}

// The handicap figure now, and how it moved with the latest round.
export function handicapMove(newestFirstRounds: RoundStats[]) {
  const now = handicap(newestFirstRounds).index;
  const before = handicap(newestFirstRounds.slice(1)).index;
  return {
    now,
    change: now !== null && before !== null ? Math.round((now - before) * 10) / 10 : null,
  };
}
