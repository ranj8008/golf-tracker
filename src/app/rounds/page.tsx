"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { Dropdown, PageTitle, Problem } from "@/components/Editing";
import { formatDate, loadAllRounds, problem, type Round } from "@/lib/data";
import { formatToPar } from "@/lib/golf";
import {
  filterQuery,
  ordered,
  readFilters,
  type Filters,
  type Sort,
} from "@/lib/roundList";

// Every round, filtered by year and course and sorted by date, gross or points.
// The filters live in the address, so a round's older / newer arrows follow them.

function RoundsList() {
  const router = useRouter();
  const path = usePathname();
  const params = useSearchParams();
  // Kept here and copied into the address after each change, so quick changes
  // don't undo each other while the address catches up.
  const [filters, setFilters] = useState<Filters>(() => readFilters(params));
  const [rounds, setRounds] = useState<Round[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadAllRounds()
      .then(setRounds)
      .catch((e) => setError(problem(e)));
  }, []);

  const q = filterQuery(filters);
  useEffect(() => {
    if (`?${params.toString()}` !== q && !(q === "" && params.size === 0))
      router.replace(`${path}${q}`, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);
  const set = (patch: Partial<Filters>) =>
    setFilters((f) => ({ ...f, ...patch }));

  const years = useMemo(
    () =>
      [...new Set((rounds ?? []).map((r) => r.played_on.slice(0, 4)))].sort(
        (a, b) => b.localeCompare(a),
      ),
    [rounds],
  );
  const courses = useMemo(() => {
    const m = new Map((rounds ?? []).map((r) => [r.course_id, r.course.name]));
    return [...m].sort((a, b) => a[1].localeCompare(b[1]));
  }, [rounds]);
  const rows = useMemo(
    () => (rounds ? ordered(rounds, filters) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rounds, filters.year, filters.course, filters.sort],
  );
  return (
    <main className="mx-auto max-w-2xl px-4 py-6">
      <PageTitle
        action={
          <Link
            href="/rounds/new"
            className="flex min-h-11 items-center rounded-lg bg-accent px-4 text-sm font-semibold text-on-accent"
          >
            Add a round
          </Link>
        }
      >
        Rounds
      </PageTitle>
      <Problem>{error}</Problem>

      <div className="mb-3 grid grid-cols-3 gap-2 [&>*]:min-w-0">
        <Dropdown
          label="Year"
          value={filters.year}
          onChange={(v) => set({ year: v })}
          placeholder="All"
          options={years.map((y) => ({ value: y, label: y }))}
        />
        <Dropdown
          label="Course"
          value={filters.course}
          onChange={(v) => set({ course: v })}
          placeholder="All"
          options={courses.map(([id, name]) => ({ value: id, label: name }))}
        />
        <Dropdown<Sort>
          label="Sort"
          value={filters.sort}
          onChange={(v) => set({ sort: v })}
          options={[
            { value: "date", label: "Date" },
            { value: "gross", label: "Gross" },
            { value: "points", label: "Points" },
          ]}
        />
      </div>

      {rounds && (
        <p className="mb-2 text-xs text-muted">
          {rows.length} round{rows.length === 1 ? "" : "s"}
        </p>
      )}

      {rounds && rows.length > 0 && (
        <ol className="overflow-hidden rounded-xl border border-line bg-card text-sm tabular-nums">
          <li className="flex items-center gap-3 border-b border-line px-3 py-2 text-xs text-muted">
            <span className="flex-1">Round</span>
            <span className="w-12 text-right">Gross</span>
            <span className="w-12 text-right">Putts</span>
            <span className="w-10 text-right">Pts</span>
          </li>
          {rows.map(({ round: r, totals: t, scoresOnly }) => (
            <li key={r.id} className="border-b border-line last:border-0">
              <Link
                href={`/rounds/${r.id}${q}`}
                className="flex min-h-14 items-center gap-3 px-3 py-2 active:bg-surface"
              >
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-medium">{r.course.name}</span>
                  <span className="truncate text-xs text-muted">
                    {formatDate(r.played_on)} · {r.tee.name}
                  </span>
                </span>
                <span className="flex w-12 flex-col text-right">
                  <span>{t.gross ?? "–"}</span>
                  {t.gross !== null && (
                    <span className="text-xs text-muted">
                      {formatToPar(t.gross - t.par)}
                    </span>
                  )}
                </span>
                <span className="w-12 text-right text-muted">
                  {scoresOnly ? (
                    <span className="text-[11px] leading-tight">
                      Scores only
                    </span>
                  ) : (
                    t.putts || "–"
                  )}
                </span>
                <span className="w-10 text-right text-base font-semibold">
                  {t.points}
                </span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </main>
  );
}

export default function RoundsPage() {
  return (
    <Suspense>
      <RoundsList />
    </Suspense>
  );
}
