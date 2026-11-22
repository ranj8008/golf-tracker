"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { DifferentialBars, MixBar, TrendChart } from "@/components/Charts";
import SegmentedControl from "@/components/SegmentedControl";
import { cardClass, Dropdown, PageTitle, Problem } from "@/components/Editing";
import { formatDate, loadAllRounds, problem, type Round } from "@/lib/data";
import { handicap, movingAverage, roundStats, summarise, type RoundStats } from "@/lib/stats";

// Stats across your rounds: scoring, a trend chart, score mix, scoring by par, a
// handicap-style figure, and short-game stats from rounds with putts recorded.

// "25 Feb 2023": short enough for a tile.
const shortDate = (d: string) =>
  new Date(`${d}T12:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
const one = (n: number | null, digits = 1) => (n === null ? "–" : n.toFixed(digits));
const signed = (n: number) => (n > 0 ? `+${n.toFixed(1)}` : n < 0 ? `−${(-n).toFixed(1)}` : "E");

function Tile({ label, value, note, href }: { label: string; value: React.ReactNode; note?: React.ReactNode; href?: string }) {
  const body = (
    <>
      <span className="truncate text-xs text-muted">{label}</span>
      <span className="text-xl font-bold tabular-nums">{value}</span>
      {note && <span className="truncate text-xs text-muted">{note}</span>}
    </>
  );
  const cls = `${cardClass} flex min-w-0 flex-col px-2.5 py-2`;
  return href ? (
    <Link href={href} className={`${cls} active:bg-surface`}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

function Section({ title, note, children }: { title: string; note?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="mb-6">
      <h2 className="mb-1 text-lg font-bold">{title}</h2>
      {note && <p className="mb-2 text-xs text-muted">{note}</p>}
      {children}
    </section>
  );
}

export default function StatsPage() {
  const [rounds, setRounds] = useState<Round[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState(""); // "", "last20" or a year
  const [course, setCourse] = useState("");
  const [trend, setTrend] = useState<"gross" | "points">("gross");

  useEffect(() => {
    loadAllRounds()
      .then(setRounds)
      .catch((e) => setError(problem(e)));
  }, []);

  const years = useMemo(
    () => [...new Set((rounds ?? []).map((r) => r.played_on.slice(0, 4)))].sort((a, b) => b.localeCompare(a)),
    [rounds],
  );
  const courses = useMemo(() => {
    const m = new Map((rounds ?? []).map((r) => [r.course_id, r.course.name]));
    return [...m].sort((a, b) => a[1].localeCompare(b[1]));
  }, [rounds]);

  // The rounds in view, oldest first.
  const inView: RoundStats[] = useMemo(() => {
    if (!rounds) return [];
    let rs = rounds
      .filter((r) => !course || r.course_id === course)
      .filter((r) => !period || period === "last20" || r.played_on.startsWith(period))
      .sort((a, b) => a.played_on.localeCompare(b.played_on) || a.created_at.localeCompare(b.created_at));
    if (period === "last20") rs = rs.slice(-20);
    return rs.map(roundStats);
  }, [rounds, period, course]);

  const s = useMemo(() => summarise(inView), [inView]);
  const hcp = useMemo(() => handicap(inView), [inView]);
  const trendPoints = useMemo(() => {
    const rs = trend === "gross" ? inView.filter((r) => r.gross !== null) : inView;
    const values = rs.map((r) => (trend === "gross" ? r.gross! : r.points));
    const avg = movingAverage(values, 10);
    return rs.map((r, i) => ({
      value: values[i],
      average: avg[i],
      label: `${r.round.course.name} · ${r.round.tee.name}`,
      sub: formatDate(r.round.played_on),
    }));
  }, [inView, trend]);

  return (
    <main className="mx-auto max-w-2xl px-4 py-6">
      <PageTitle>Stats</PageTitle>
      <Problem>{error}</Problem>

      <div className="mb-5 grid grid-cols-2 gap-2 [&>*]:min-w-0">
        <Dropdown
          label="Rounds"
          value={period}
          onChange={setPeriod}
          options={[
            { value: "", label: "All rounds" },
            { value: "last20", label: "Last 20 rounds" },
            ...years.map((y) => ({ value: y, label: y })),
          ]}
        />
        <Dropdown
          label="Course"
          value={course}
          onChange={setCourse}
          placeholder="All"
          options={courses.map(([id, name]) => ({ value: id, label: name }))}
        />
      </div>

      {rounds && inView.length === 0 && (
        <p className={`${cardClass} p-4 text-sm text-muted`}>No rounds for these filters.</p>
      )}

      {inView.length > 0 && (
        <>
          <Section title="Scoring">
            <div className="grid grid-cols-3 gap-2">
              <Tile label="Rounds" value={s.rounds} />
              <Tile
                label="Average gross"
                value={one(s.avgGross)}
                note={s.avgToPar === null ? undefined : `${signed(s.avgToPar)} to par`}
              />
              <Tile label="Average net" value={one(s.avgNet)} />
              <Tile label="Average points" value={one(s.avgPoints)} />
              <Tile
                label="Best gross"
                value={s.bestGross?.gross ?? "–"}
                note={s.bestGross && shortDate(s.bestGross.round.played_on)}
                href={s.bestGross ? `/rounds/${s.bestGross.round.id}` : undefined}
              />
              <Tile
                label="Best points"
                value={s.bestPoints?.points ?? "–"}
                note={s.bestPoints && shortDate(s.bestPoints.round.played_on)}
                href={s.bestPoints ? `/rounds/${s.bestPoints.round.id}` : undefined}
              />
              <Tile
                label="Broke 80"
                value={s.brokeEighty}
                note={
                  s.completeRounds
                    ? `${Math.round((s.brokeEighty / s.completeRounds) * 100)}% of rounds`
                    : undefined
                }
              />
            </div>
          </Section>

          {trendPoints.length > 1 && (
            <Section title={trend === "gross" ? "Gross over time" : "Points over time"}>
              <div className="mb-3">
                <SegmentedControl
                  label="Show"
                  value={trend}
                  onChange={setTrend}
                  options={[
                    { value: "gross", label: "Gross" },
                    { value: "points", label: "Points" },
                  ]}
                />
              </div>
              <div className={`${cardClass} p-3`}>
                <TrendChart points={trendPoints} unit={trend} averageLabel="10-round average" />
              </div>
            </Section>
          )}

          <Section title="Score mix" note="Average per round">
            <div className={`${cardClass} p-3`}>
              <MixBar
                unit="per round"
                parts={[
                  { key: "e", label: "Eagles or better", value: s.mix.eagles, color: "var(--mix-eagle)" },
                  { key: "b", label: "Birdies", value: s.mix.birdies, color: "var(--birdie)" },
                  { key: "p", label: "Pars", value: s.mix.pars, color: "var(--mix-par)" },
                  { key: "o", label: "Bogeys", value: s.mix.bogeys, color: "var(--bogey)" },
                  { key: "d", label: "Double bogey +", value: s.mix.doubles, color: "var(--double)" },
                ]}
              />
            </div>
          </Section>

          <Section title="By par" note="Average score on each kind of hole">
            <div className="grid grid-cols-3 gap-2">
              {s.byPar.map((p) => (
                <Tile key={p.par} label={`Par ${p.par}s`} value={p.avg.toFixed(2)} note={`${signed(p.avg - p.par)} to par`} />
              ))}
            </div>
          </Section>

          <Section
            title="Handicap"
            note="Average of your best 8 score differentials from the last 20 rounds in view (fewer rounds use fewer, as the handicap system does). Each hole is capped at net double bogey."
          >
            <div className={`${cardClass} p-3`}>
              <div className="mb-3 flex items-baseline gap-2">
                <span className="text-3xl font-bold tabular-nums">{hcp.index === null ? "–" : hcp.index.toFixed(1)}</span>
                <span className="text-sm text-muted">
                  {hcp.index === null
                    ? "Needs at least 3 rounds with a course rating and slope"
                    : `from the best ${hcp.used} of ${hcp.last20.length}`}
                </span>
              </div>
              <DifferentialBars
                bars={hcp.last20.map((d) => ({
                  value: d.stats.differential!,
                  counts: d.counts,
                  label: `${d.stats.round.course.name} · ${d.stats.gross ?? "–"} gross`,
                  sub: formatDate(d.stats.round.played_on),
                }))}
              />
            </div>
          </Section>

          <Section
            title="Short game"
            note={
              s.statsRounds
                ? `From the ${s.statsRounds} round${s.statsRounds === 1 ? "" : "s"} in view with putts recorded.`
                : "No rounds in view have putts recorded."
            }
          >
            {s.statsRounds > 0 && (
              <div className="grid grid-cols-3 gap-2">
                <Tile label="Putts per round" value={one(s.short.putts)} />
                <Tile label="Putts per GIR" value={one(s.short.puttsPerGir, 2)} note="On greens hit" />
                <Tile label="One-putts" value={one(s.short.onePutts)} note="Per round" />
                <Tile label="Three-putts" value={one(s.short.threePutts)} note="Per round" />
                <Tile label="Fairways" value={s.short.fir === null ? "–" : `${Math.round(s.short.fir)}%`} />
                <Tile label="Greens" value={s.short.gir === null ? "–" : `${Math.round(s.short.gir)}%`} />
                <Tile label="Scrambling" value={s.short.scrambling === null ? "–" : `${Math.round(s.short.scrambling)}%`} />
                <Tile label="Penalties" value={one(s.short.penalties)} note="Per round" />
              </div>
            )}
          </Section>
        </>
      )}
    </main>
  );
}
