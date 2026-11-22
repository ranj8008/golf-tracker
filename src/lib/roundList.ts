// The Rounds list's filters and order, shared with a round's page so its older /
// newer arrows step through the same list you came from. The filters travel in
// the address (?year=2025&course=…&sort=gross).

import { entriesFor, teeHoles, type Round } from "./data";
import { scorecard, type Totals } from "./golf";

export type Sort = "date" | "gross" | "points";
export type Filters = { year: string; course: string; sort: Sort };

export const noFilters: Filters = { year: "", course: "", sort: "date" };

export function readFilters(q: URLSearchParams | null): Filters {
  const sort = q?.get("sort");
  return {
    year: q?.get("year") ?? "",
    course: q?.get("course") ?? "",
    sort: sort === "gross" || sort === "points" ? sort : "date",
  };
}

export function filterQuery(f: Filters): string {
  const q = new URLSearchParams();
  if (f.year) q.set("year", f.year);
  if (f.course) q.set("course", f.course);
  if (f.sort !== "date") q.set("sort", f.sort);
  const s = q.toString();
  return s ? `?${s}` : "";
}

export type RoundRow = { round: Round; totals: Totals; scoresOnly: boolean };

const totalsCache = new WeakMap<Round, RoundRow>();
export function row(round: Round): RoundRow {
  let r = totalsCache.get(round);
  if (!r) {
    const totals = scorecard(
      teeHoles(round.tee),
      entriesFor(round),
      round.playing_handicap,
    ).total;
    r = {
      round,
      totals,
      scoresOnly: round.hole_scores.every((h) => h.putts === null),
    };
    totalsCache.set(round, r);
  }
  return r;
}

const byDate = (a: Round, b: Round) =>
  b.played_on.localeCompare(a.played_on);

// Filtered and in order: newest first, lowest gross first, or most points first.
// Ties go to the more recent round. Rounds with a hole picked up have no gross and
// come last when sorting by gross.
export function ordered(rounds: Round[], f: Filters): RoundRow[] {
  const rows = rounds
    .filter(
      (r) =>
        (!f.year || r.played_on.startsWith(f.year)) &&
        (!f.course || r.course_id === f.course),
    )
    .map(row);
  return rows.sort((a, b) => {
    if (f.sort === "gross") {
      const ga = a.totals.gross ?? Infinity;
      const gb = b.totals.gross ?? Infinity;
      if (ga !== gb) return ga - gb;
    } else if (f.sort === "points") {
      if (a.totals.points !== b.totals.points)
        return b.totals.points - a.totals.points;
    }
    return byDate(a.round, b.round);
  });
}
