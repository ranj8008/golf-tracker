"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import Scorecard from "@/components/Scorecard";
import { cardClass, PageTitle, Problem } from "@/components/Editing";
import {
  entriesFor,
  formatDate,
  loadAllRounds,
  loadRound,
  problem,
  teeHoles,
  type Round,
} from "@/lib/data";
import { formatToPar, pct, scorecard } from "@/lib/golf";
import {
  filterQuery,
  noFilters,
  ordered,
  readFilters,
  type RoundRow,
} from "@/lib/roundList";

// Which way the last swipe or arrow went, so the next round slides in from the
// right side. Kept outside the page because the page remounts for each round.
let slideFrom: "left" | "right" | null = null;

function Tile({
  label,
  value,
  note,
}: {
  label: string;
  value: React.ReactNode;
  note?: React.ReactNode;
}) {
  return (
    <div className={`${cardClass} flex min-w-0 flex-col px-2.5 py-2`}>
      <span className="truncate text-xs text-muted">{label}</span>
      <span className="text-xl font-bold tabular-nums">{value}</span>
      {note && <span className="truncate text-xs text-muted">{note}</span>}
    </div>
  );
}

export default function RoundPage() {
  return (
    <Suspense>
      <RoundView />
    </Suspense>
  );
}

function RoundView() {
  const { id } = useParams<{ id: string }>();
  const params = useSearchParams();
  const router = useRouter();
  const [round, setRound] = useState<Round | null | undefined>(undefined);
  const [list, setList] = useState<RoundRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [slide] = useState(() => {
    const s = slideFrom;
    slideFrom = null;
    return s;
  });
  const touch = useRef<{ x: number; y: number } | null>(null);
  const filters = readFilters(params);
  const q = filterQuery(filters);

  // The list this round belongs to (the Rounds filters it was opened from, or all
  // rounds by date), for the older / newer arrows and swiping.
  useEffect(() => {
    loadAllRounds()
      .then((all) => {
        let rows = ordered(all, filters);
        if (!rows.some((x) => x.round.id === id)) rows = ordered(all, noFilters);
        setList(rows);
        const hit = all.find((x) => x.id === id);
        if (hit) setRound(hit);
        else return loadRound(id).then(setRound);
      })
      .catch((e) => setError(problem(e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, q]);

  const at = list?.findIndex((x) => x.round.id === id) ?? -1;
  const before = at > 0 ? list![at - 1].round : null; // newer (or higher in the list)
  const after = list && at >= 0 && at < list.length - 1 ? list[at + 1].round : null;
  const byDate = filters.sort === "date";
  const go = (r: Round | null, from: "left" | "right") => {
    if (!r) return;
    slideFrom = from;
    router.replace(`/rounds/${r.id}${q}`, { scroll: false });
  };
  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    touch.current = { x: t.clientX, y: t.clientY };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const start = touch.current;
    touch.current = null;
    if (!start) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    // A clear sideways swipe only, so scrolling the card never changes round.
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 2) return;
    if (dx < 0) go(after, "right");
    else go(before, "left");
  };

  if (error)
    return (
      <main className="mx-auto max-w-2xl px-4 py-6">
        <Problem>{error}</Problem>
      </main>
    );
  if (round === undefined) return null;
  if (round === null)
    return (
      <main className="mx-auto max-w-2xl px-4 py-6">
        <p className="text-muted">That round wasn&apos;t found.</p>
      </main>
    );

  const arrow =
    "flex min-h-11 min-w-24 items-center gap-1 rounded-lg px-3 text-sm font-medium text-accent disabled:text-muted disabled:opacity-50";
  const stepper = list && at >= 0 && (
    <nav
      aria-label="Other rounds"
      className="mb-4 flex items-center justify-between rounded-xl border border-line bg-card px-1"
    >
      <button
        type="button"
        onClick={() => go(before, "left")}
        disabled={!before}
        className={arrow}
      >
        ‹ {byDate ? "Newer" : "Previous"}
      </button>
      <span className="text-xs text-muted tabular-nums">
        {at + 1} of {list.length}
      </span>
      <button
        type="button"
        onClick={() => go(after, "right")}
        disabled={!after}
        className={`${arrow} justify-end`}
      >
        {byDate ? "Older" : "Next"} ›
      </button>
    </nav>
  );

  const card = scorecard(
    teeHoles(round.tee),
    entriesFor(round),
    round.playing_handicap,
  );
  const t = card.total;
  // Rounds with no putts recorded (e.g. imported ones without stats) show scores
  // only: no putts, fairways, greens, scrambling or penalties.
  const scoresOnly = round.hole_scores.every((h) => h.putts === null);

  return (
    <main
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      className={`mx-auto max-w-2xl px-4 py-6 ${
        slide === "right"
          ? "animate-[slide-from-right_220ms_ease-out]"
          : slide === "left"
            ? "animate-[slide-from-left_220ms_ease-out]"
            : ""
      }`}
    >
      <PageTitle
        action={
          <Link
            href={`/rounds/${round.id}/edit`}
            className="flex min-h-11 shrink-0 items-center rounded-lg bg-surface px-4 text-sm font-medium whitespace-nowrap"
          >
            Edit round
          </Link>
        }
      >
        {round.course.name}
      </PageTitle>
      <p className="-mt-3 mb-4 text-sm font-medium text-accent">
        {round.tee.name} tees · {formatDate(round.played_on)}
        {round.handicap_index !== null && ` · HI ${round.handicap_index}`} · PH{" "}
        {round.playing_handicap}
      </p>
      {stepper}

      <div
        className={`mb-2 grid gap-2 ${scoresOnly ? "grid-cols-3" : "grid-cols-4"}`}
      >
        <Tile
          label="Gross"
          value={t.gross ?? "–"}
          note={t.gross !== null ? formatToPar(t.gross - t.par) : "Picked up"}
        />
        <Tile
          label="Net"
          value={t.net ?? "–"}
          note={t.net !== null ? formatToPar(t.net - t.par) : undefined}
        />
        <Tile label="Points" value={t.points} note="Stableford" />
        {!scoresOnly && <Tile label="Putts" value={t.putts || "–"} />}
      </div>
      {!scoresOnly && (
      <div className="mb-2 grid grid-cols-4 gap-2">
        <Tile
          label="Fairways"
          value={pct(t.firHit, t.firOf)}
          note={`${t.firHit} of ${t.firOf}`}
        />
        <Tile
          label="Greens"
          value={pct(t.girHit, t.girOf)}
          note={`${t.girHit} of ${t.girOf}`}
        />
        <Tile
          label="Scrambles"
          value={pct(t.scrambleMade, t.scrambleOf)}
          note={`${t.scrambleMade} of ${t.scrambleOf}`}
        />
        <Tile label="Penalties" value={t.penalties} />
      </div>
      )}
      <div className="mb-4 grid grid-cols-5 gap-2 text-center">
        {[
          ["Eagles", t.eagles],
          ["Birdies", t.birdies],
          ["Pars", t.pars],
          ["Bogeys", t.bogeys],
          ["Double +", t.doubles],
        ].map(([label, n]) => (
          <div key={label} className={`${cardClass} px-1 py-2`}>
            <div className="text-lg font-bold tabular-nums">{n}</div>
            <div className="truncate text-xs text-muted">{label}</div>
          </div>
        ))}
      </div>

      <Scorecard rows={card.rows} out={card.out} inn={card.in} total={t} />

      {!scoresOnly && (
        <p className="mt-3 text-xs text-muted">
          {t.onePutts} one-putts · {t.threePutts} three-putts
        </p>
      )}
      {round.notes && (
        <p className={`${cardClass} mt-4 p-3 text-sm whitespace-pre-wrap`}>
          {round.notes}
        </p>
      )}
    </main>
  );
}
