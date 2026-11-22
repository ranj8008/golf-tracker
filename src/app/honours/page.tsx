"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { cardClass, Dropdown, PageTitle, Problem } from "@/components/Editing";
import { loadAllRounds, problem, type Round } from "@/lib/data";
import {
  byCourse,
  byYear,
  highlights,
  scoringRecords,
  shortGameRecords,
  subEighty,
  type GroupRow,
  type Honour,
} from "@/lib/honours";
import { roundStats } from "@/lib/stats";

// The honours board: records worked out from every round, then year by year and
// course by course. Each record links to its round.

// 1st, 2nd, 3rd, 4th … 11th, 12th, 13th … 21st
const ordinal = (n: number) => {
  const tens = n % 100;
  const suffix =
    tens >= 11 && tens <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ?? "th";
  return `${n}${suffix}`;
};

const shortDate = (d: string) =>
  new Date(`${d}T12:00:00`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

function Board({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-6 overflow-hidden rounded-xl border border-line bg-card">
      <h2 className="border-b border-line bg-surface px-4 py-2 text-base font-bold">
        {title}
      </h2>
      {note && <p className="border-b border-line px-4 py-2 text-xs text-muted">{note}</p>}
      {children}
    </section>
  );
}

function RecordRow({ r }: { r: Honour }) {
  const round = r.holder.round;
  return (
    <li className="border-b border-line last:border-0">
      <Link
        href={`/rounds/${round.id}`}
        className="flex min-h-14 items-center gap-3 px-4 py-2 active:bg-surface"
      >
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-sm font-medium">{r.label}</span>
          <span className="text-xs text-muted">
            {shortDate(round.played_on)} · {round.course.name}
            {r.others > 0 && ` · +${r.others} other${r.others === 1 ? "" : "s"}`}
          </span>
        </span>
        <span className="shrink-0 text-right text-base font-bold tabular-nums">
          {r.value}
        </span>
      </Link>
    </li>
  );
}

function GroupTable({
  rows,
  first,
  onPick,
}: {
  rows: GroupRow[];
  first: string;
  onPick?: (key: string) => void;
}) {
  const cell = "px-1.5 py-2 text-right tabular-nums";
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-line text-xs text-muted">
          <th scope="col" className="px-4 py-2 text-left font-medium">
            {first}
          </th>
          <th scope="col" className={`${cell} font-medium`}>Rnds</th>
          <th scope="col" className={`${cell} font-medium`}>Best</th>
          <th scope="col" className={`${cell} font-medium`}>Pts</th>
          <th scope="col" className={`${cell} font-medium`} title="Rounds of 79 or better">
            &lt;80
          </th>
          <th scope="col" className={`${cell} font-medium`}>Avg</th>
          <th scope="col" className={`${cell} pr-4 font-medium`} title="Lowest score differential">
            Diff
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((g) => (
          <tr
            key={g.key}
            onClick={onPick ? () => onPick(g.key) : undefined}
            className={`border-b border-line last:border-0 ${onPick ? "cursor-pointer active:bg-surface" : ""}`}
          >
            <th scope="row" className="w-full px-4 py-2 text-left leading-snug font-medium">
              {g.label}
            </th>
            <td className={cell}>{g.rounds}</td>
            <td className={`${cell} font-semibold`}>
              {g.bestGross ? (
                <Link href={`/rounds/${g.bestGross.round.id}`} onClick={(e) => e.stopPropagation()}>
                  {g.bestGross.gross}
                </Link>
              ) : (
                "–"
              )}
            </td>
            <td className={cell}>
              {g.bestPoints ? (
                <Link href={`/rounds/${g.bestPoints.round.id}`} onClick={(e) => e.stopPropagation()}>
                  {g.bestPoints.points}
                </Link>
              ) : (
                "–"
              )}
            </td>
            <td className={cell}>{g.brokeEighty || "–"}</td>
            <td className={`${cell} text-muted`}>{g.avgGross === null ? "–" : g.avgGross.toFixed(1)}</td>
            <td className={`${cell} pr-4 text-muted`}>
              {g.lowestDifferential === null ? "–" : g.lowestDifferential.toFixed(1)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function HonoursPage() {
  const [rounds, setRounds] = useState<Round[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [course, setCourse] = useState("");

  useEffect(() => {
    loadAllRounds()
      .then(setRounds)
      .catch((e) => setError(problem(e)));
  }, []);

  const all = useMemo(() => (rounds ?? []).map(roundStats), [rounds]);
  const inView = useMemo(
    () => all.filter((r) => !course || r.round.course_id === course),
    [all, course],
  );
  const courses = useMemo(() => {
    const m = new Map((rounds ?? []).map((r) => [r.course_id, r.course.name]));
    return [...m].sort((a, b) => a[1].localeCompare(b[1]));
  }, [rounds]);

  const scoring = useMemo(() => scoringRecords(inView), [inView]);
  const short = useMemo(() => shortGameRecords(inView), [inView]);
  const statsRounds = inView.filter((r) => !r.scoresOnly).length;
  const special = useMemo(() => highlights(inView), [inView]);
  const years = useMemo(() => byYear(inView), [inView]);
  const sub80 = useMemo(() => subEighty(inView), [inView]);
  const courseRows = useMemo(() => byCourse(inView), [inView]);

  return (
    <main className="mx-auto max-w-2xl px-4 py-6">
      <PageTitle>Honours</PageTitle>
      <Problem>{error}</Problem>

      <div className="mb-5">
        <Dropdown
          label="Course"
          value={course}
          onChange={setCourse}
          placeholder="All courses"
          options={courses.map(([id, name]) => ({ value: id, label: name }))}
        />
      </div>

      {rounds && inView.length === 0 && (
        <p className={`${cardClass} p-4 text-sm text-muted`}>No rounds yet.</p>
      )}

      {inView.length > 0 && (
        <>
          <Board title="Scoring records" note={`From ${inView.length} round${inView.length === 1 ? "" : "s"}. Tap a record to see the round.`}>
            <ul>
              {scoring.map((r) => (
                <RecordRow key={r.label} r={r} />
              ))}
            </ul>
          </Board>

          <Board title="Eagles and holes in one">
            {special.length === 0 ? (
              <p className="px-4 py-3 text-sm text-muted">None yet.</p>
            ) : (
              <ul>
                {special.map((h) => (
                  <li key={`${h.stats.round.id}-${h.hole}`} className="border-b border-line last:border-0">
                    <Link
                      href={`/rounds/${h.stats.round.id}`}
                      className="flex min-h-14 items-center gap-3 px-4 py-2 active:bg-surface"
                    >
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="text-sm font-medium">
                          {h.kind}: {h.score} on the {ordinal(h.hole)} (par{" "}
                          {h.par})
                        </span>
                        <span className="truncate text-xs text-muted">
                          {shortDate(h.stats.round.played_on)} · {h.stats.round.course.name}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Board>

          <Board
            title="Breaking 80"
            note={
              sub80.length
                ? `${sub80.length} round${sub80.length === 1 ? "" : "s"} of 79 or better, newest first.`
                : undefined
            }
          >
            {sub80.length === 0 ? (
              <p className="px-4 py-3 text-sm text-muted">Not yet.</p>
            ) : (
              <ul>
                {sub80.map((r) => (
                  <li key={r.round.id} className="border-b border-line last:border-0">
                    <Link
                      href={`/rounds/${r.round.id}`}
                      className="flex min-h-12 items-center gap-3 px-4 py-2 active:bg-surface"
                    >
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="text-sm font-medium">{shortDate(r.round.played_on)}</span>
                        <span className="text-xs text-muted">
                          {r.round.course.name} · {r.round.tee.name}
                        </span>
                      </span>
                      <span className="shrink-0 text-base font-bold tabular-nums">
                        {r.gross}{" "}
                        <span className="text-sm font-normal text-muted">
                          ({r.gross! - r.par > 0 ? `+${r.gross! - r.par}` : r.gross! - r.par === 0 ? "E" : `−${r.par - r.gross!}`})
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Board>

          <Board
            title="Short game records"
            note={
              statsRounds
                ? `From the ${statsRounds} round${statsRounds === 1 ? "" : "s"} with putts recorded.`
                : "No rounds with putts recorded yet."
            }
          >
            {short.length > 0 && (
              <ul>
                {short.map((r) => (
                  <RecordRow key={r.label} r={r} />
                ))}
              </ul>
            )}
          </Board>

          <Board title="Year by year" note="Best gross, most points, rounds of 79 or better, average gross, lowest differential. Tap a score to see the round.">
            <GroupTable rows={years} first="Year" />
          </Board>

          {!course && (
            <Board title="Course by course" note="Tap a course to see its records.">
              <GroupTable
                rows={courseRows}
                first="Course"
                onPick={(id) => {
                  setCourse(id);
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
              />
            </Board>
          )}
        </>
      )}
    </main>
  );
}
