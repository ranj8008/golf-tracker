"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { cardClass, Problem, SignOut } from "@/components/Editing";
import { formatDate, loadAllRounds, problem, type Round } from "@/lib/data";
import { formatToPar } from "@/lib/golf";
import { form, handicapMove, latestFirst, milestones } from "@/lib/home";
import { markClass } from "@/lib/marks";
import { brokeEighty, roundStats, type RoundStats } from "@/lib/stats";

// Home: a greeting, anything the latest round earned, this season, the latest
// round, handicap and form, then the last few rounds.

const RECENT = 5;

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? "Morning" : h < 18 ? "Afternoon" : "Evening";
};

function sinceText(playedOn: string) {
  const days = Math.round(
    (new Date().setHours(12, 0, 0, 0) - new Date(`${playedOn}T12:00:00`).getTime()) /
      86_400_000,
  );
  return days <= 0 ? "today" : days === 1 ? "yesterday" : `${days} days ago`;
}

function Tile({ label, value, note }: { label: string; value: React.ReactNode; note?: React.ReactNode }) {
  return (
    <div className={`${cardClass} flex min-w-0 flex-col px-2.5 py-2`}>
      <span className="truncate text-xs text-muted">{label}</span>
      <span className="text-xl font-bold tabular-nums">{value}</span>
      {note && <span className="truncate text-xs text-muted">{note}</span>}
    </div>
  );
}

function Trophy() {
  return (
    <svg aria-hidden width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
      <path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 21h8M9 17h6v4H9z" />
    </svg>
  );
}

// The round's 18 scores as small scorecard marks, front and back 9 apart.
function HoleStrip({ r }: { r: RoundStats }) {
  const mark = (h: RoundStats["rows"][number]) => (
    <span
      key={h.hole}
      title={`Hole ${h.hole}: ${h.score ?? "–"}`}
      className={`flex size-[15px] items-center justify-center text-[9px] leading-none font-semibold tabular-nums ${
        h.score === null
          ? "rounded-sm border border-line text-muted"
          : h.toPar === 0
            ? "rounded-sm bg-surface"
            : markClass(h.toPar)
      } ${h.toPar !== null && h.toPar <= -2 ? "ring-1 ring-offset-1" : ""}`}
    >
      {h.score ?? ""}
    </span>
  );
  return (
    <div className="flex items-center justify-between gap-2" aria-label="Scores by hole">
      <div className="flex gap-px">{r.rows.slice(0, 9).map(mark)}</div>
      <div className="flex gap-px">{r.rows.slice(9).map(mark)}</div>
    </div>
  );
}

function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const w = 120;
  const h = 28;
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const pts = values
    .map((v, i) => `${((i / (values.length - 1)) * (w - 4) + 2).toFixed(1)},${(2 + ((v - lo) / (hi - lo || 1)) * (h - 4)).toFixed(1)}`)
    .join(" ");
  const [lx, ly] = pts.split(" ").at(-1)!.split(",");
  // Lower scores are better, so they sit higher.
  return (
    <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-label={`Last ${values.length} gross scores`} role="img">
      <polyline points={pts} fill="none" stroke="var(--chart-muted)" strokeWidth={1.5} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      <circle cx={lx} cy={ly} r={2.5} fill="var(--accent)" />
    </svg>
  );
}

export default function Home() {
  const [rounds, setRounds] = useState<Round[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadAllRounds()
      .then(setRounds)
      .catch((e) => setError(problem(e)));
  }, []);

  const all = useMemo(() => latestFirst((rounds ?? []).map(roundStats)), [rounds]);
  const latest = all[0];
  const earned = useMemo(() => (latest ? milestones(latest, all.slice(1)).slice(0, 2) : []), [latest, all]);
  const year = String(new Date().getFullYear());
  const season = all.filter((r) => r.round.played_on.startsWith(year));
  const seasonComplete = season.filter((r) => r.gross !== null);
  const f = useMemo(() => form(all), [all]);
  const hcp = useMemo(() => handicapMove(all), [all]);

  return (
    <main className="mx-auto max-w-2xl px-4 py-6">
      <div className="mb-4 flex min-h-11 items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{greeting()}, Ranj</h1>
          {latest && (
            <p className="text-sm text-muted">
              Last played {sinceText(latest.round.played_on)} at {latest.round.course.name}
            </p>
          )}
        </div>
        <Link
          href="/rounds/new"
          className="flex min-h-11 shrink-0 items-center rounded-lg bg-accent px-4 text-sm font-semibold text-on-accent"
        >
          Add a round
        </Link>
      </div>
      <Problem>{error}</Problem>

      {rounds?.length === 0 && (
        <div className={`${cardClass} p-4 text-sm text-muted`}>
          No rounds yet. Add your first one after you play.
        </div>
      )}

      {latest && (
        <>
          {earned.length > 0 && (
            <Link
              href={`/rounds/${latest.round.id}`}
              className="mb-4 flex min-h-12 items-center gap-3 rounded-xl bg-accent-soft px-4 py-2 text-sm font-semibold text-on-accent-soft active:opacity-80"
            >
              <Trophy />
              <span>{earned.join(" · ")}</span>
            </Link>
          )}

          {season.length > 0 && (
            <section className="mb-5">
              <h2 className="mb-2 text-lg font-bold">This season ({year})</h2>
              <div className="grid grid-cols-4 gap-2">
                <Tile label="Rounds" value={season.length} />
                <Tile
                  label="Best"
                  value={seasonComplete.length ? Math.min(...seasonComplete.map((r) => r.gross!)) : "–"}
                />
                <Tile label="Broke 80" value={season.filter(brokeEighty).length} />
                <Tile
                  label="Avg pts"
                  value={(season.reduce((s, r) => s + r.points, 0) / season.length).toFixed(1)}
                />
              </div>
            </section>
          )}

          <section className="mb-5">
            <h2 className="mb-2 text-lg font-bold">Latest round</h2>
            <Link
              href={`/rounds/${latest.round.id}`}
              className={`${cardClass} block p-3 active:bg-surface`}
            >
              <div className="mb-2 flex items-baseline justify-between gap-2">
                <span className="min-w-0 truncate font-semibold">{latest.round.course.name}</span>
                <span className="shrink-0 text-xs text-muted">
                  {latest.round.tee.name} · {formatDate(latest.round.played_on)}
                </span>
              </div>
              <div className="mb-3 grid grid-cols-3 gap-2 tabular-nums">
                <div>
                  <div className="text-3xl font-bold">{latest.gross ?? "–"}</div>
                  <div className="text-xs text-muted">
                    Gross{latest.gross !== null && ` · ${formatToPar(latest.gross - latest.par)}`}
                  </div>
                </div>
                <div>
                  <div className="text-3xl font-bold">{latest.net ?? "–"}</div>
                  <div className="text-xs text-muted">
                    Net{latest.net !== null && ` · ${formatToPar(latest.net - latest.par)}`}
                  </div>
                </div>
                <div>
                  <div className="text-3xl font-bold">{latest.points}</div>
                  <div className="text-xs text-muted">Points</div>
                </div>
              </div>
              <HoleStrip r={latest} />
            </Link>
          </section>

          <div className="mb-5 grid grid-cols-2 gap-2">
            <Link href="/stats" className={`${cardClass} flex min-w-0 flex-col px-3 py-2 active:bg-surface`}>
              <span className="text-xs text-muted">Handicap</span>
              <span className="text-2xl font-bold tabular-nums">
                {hcp.now === null ? "–" : hcp.now.toFixed(1)}
              </span>
              <span
                className={`text-xs tabular-nums ${
                  hcp.change === null || hcp.change === 0 ? "text-muted" : hcp.change < 0 ? "text-up" : "text-down"
                }`}
              >
                {hcp.change === null
                  ? "Best 8 of 20"
                  : hcp.change === 0
                    ? "No change"
                    : `${hcp.change < 0 ? "▼" : "▲"} ${Math.abs(hcp.change).toFixed(1)} last round`}
              </span>
            </Link>
            <Link href="/stats" className={`${cardClass} flex min-w-0 flex-col px-3 py-2 active:bg-surface`}>
              <span className="text-xs text-muted">Form (last 5)</span>
              <span className="text-2xl font-bold tabular-nums">
                {f.last5 === null ? "–" : f.last5.toFixed(1)}
              </span>
              {f.last5 !== null && f.usual !== null && (
                <span
                  className={`truncate text-xs ${
                    Math.abs(f.last5 - f.usual) < 0.05 ? "text-muted" : f.last5 < f.usual ? "text-up" : "text-down"
                  }`}
                >
                  {Math.abs(f.last5 - f.usual) < 0.05
                    ? "Same as usual"
                    : `${Math.abs(f.last5 - f.usual).toFixed(1)} ${f.last5 < f.usual ? "better" : "worse"} than usual`}
                </span>
              )}
              <div className="mt-1">
                <Sparkline values={f.recent} />
              </div>
            </Link>
          </div>

          <section>
            <h2 className="mb-2 text-lg font-bold">Recent rounds</h2>
            <ol className="overflow-hidden rounded-xl border border-line bg-card text-sm tabular-nums">
              <li className="flex items-center gap-3 border-b border-line px-3 py-2 text-xs text-muted">
                <span className="flex-1">Round</span>
                <span className="w-12 text-right">Gross</span>
                <span className="w-10 text-right">Putts</span>
                <span className="w-10 text-right">Pts</span>
              </li>
              {all.slice(0, RECENT).map((r) => (
                <li key={r.round.id} className="border-b border-line">
                  <Link
                    href={`/rounds/${r.round.id}`}
                    className="flex min-h-14 items-center gap-3 px-3 py-2 active:bg-surface"
                  >
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate font-medium">{r.round.course.name}</span>
                      <span className="truncate text-xs text-muted">
                        {formatDate(r.round.played_on, false)} · {r.round.tee.name} · PH {r.round.playing_handicap}
                      </span>
                    </span>
                    <span className="flex w-12 flex-col text-right">
                      <span>{r.gross ?? "–"}</span>
                      {r.gross !== null && (
                        <span className="text-xs text-muted">{formatToPar(r.gross - r.par)}</span>
                      )}
                    </span>
                    <span className="w-10 text-right text-muted">
                      {r.scoresOnly ? "–" : r.rows.reduce((s, h) => s + (h.putts ?? 0), 0)}
                    </span>
                    <span className="w-10 text-right text-base font-semibold">{r.points}</span>
                  </Link>
                </li>
              ))}
              <li>
                <Link
                  href="/rounds"
                  className="flex min-h-12 items-center justify-center text-sm font-medium text-accent active:bg-surface"
                >
                  All rounds ›
                </Link>
              </li>
            </ol>
          </section>
        </>
      )}

      <SignOut />
    </main>
  );
}
