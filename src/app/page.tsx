"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { cardClass, PageTitle, Problem, SignOut } from "@/components/Editing";
import {
  entriesFor,
  formatDate,
  loadRounds,
  problem,
  teeHoles,
  type Round,
} from "@/lib/data";
import { formatToPar, scorecard } from "@/lib/golf";

const SHOWN = 10;

export default function Home() {
  const [rounds, setRounds] = useState<Round[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadRounds(SHOWN)
      .then(setRounds)
      .catch((e) => setError(problem(e)));
  }, []);

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
        Recent rounds
      </PageTitle>
      <Problem>{error}</Problem>

      {rounds?.length === 0 && (
        <div className={`${cardClass} p-4 text-sm text-muted`}>
          No rounds yet. Add your first one after you play.
        </div>
      )}

      {rounds && rounds.length > 0 && (
        <ol className="overflow-hidden rounded-xl border border-line bg-card text-sm tabular-nums">
          <li className="flex items-center gap-3 border-b border-line px-3 py-2 text-xs text-muted">
            <span className="flex-1">Round</span>
            <span className="w-12 text-right">Gross</span>
            <span className="w-10 text-right">Putts</span>
            <span className="w-10 text-right">Pts</span>
          </li>
          {rounds.map((r) => {
            const t = scorecard(
              teeHoles(r.tee),
              entriesFor(r),
              r.playing_handicap,
            ).total;
            return (
              <li key={r.id} className="border-b border-line last:border-0">
                <Link
                  href={`/rounds/${r.id}`}
                  className="flex min-h-14 items-center gap-3 px-3 py-2 active:bg-surface"
                >
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-medium">
                      {r.course.name}
                    </span>
                    <span className="truncate text-xs text-muted">
                      {formatDate(r.played_on, false)} · {r.tee.name} · PH{" "}
                      {r.playing_handicap}
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
                  <span className="w-10 text-right text-muted">
                    {t.putts || "–"}
                  </span>
                  <span className="w-10 text-right text-base font-semibold">
                    {t.points}
                  </span>
                </Link>
              </li>
            );
          })}
        </ol>
      )}

      <SignOut />
    </main>
  );
}
