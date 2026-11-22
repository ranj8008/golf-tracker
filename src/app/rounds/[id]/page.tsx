"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import Scorecard from "@/components/Scorecard";
import { cardClass, PageTitle, Problem } from "@/components/Editing";
import {
  entriesFor,
  formatDate,
  loadRound,
  problem,
  teeHoles,
  type Round,
} from "@/lib/data";
import { formatToPar, pct, scorecard } from "@/lib/golf";

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
  const { id } = useParams<{ id: string }>();
  const [round, setRound] = useState<Round | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadRound(id)
      .then(setRound)
      .catch((e) => setError(problem(e)));
  }, [id]);

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

  const card = scorecard(
    teeHoles(round.tee),
    entriesFor(round),
    round.playing_handicap,
  );
  const t = card.total;
  const bunkers = round.hole_scores.filter((h) => h.bunker).length;
  const chips = round.hole_scores.reduce((s, h) => s + (h.chips ?? 0), 0);

  return (
    <main className="mx-auto max-w-2xl px-4 py-6">
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

      <div className="mb-2 grid grid-cols-4 gap-2">
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
        <Tile label="Putts" value={t.putts || "–"} />
      </div>
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

      <p className="mt-3 text-xs text-muted">
        {t.onePutts} one-putts · {t.threePutts} three-putts
        {bunkers > 0 &&
          ` · ${bunkers} greenside bunker${bunkers > 1 ? "s" : ""}`}
        {chips > 0 && ` · ${chips} chip${chips > 1 ? "s" : ""}`}
      </p>
      {round.notes && (
        <p className={`${cardClass} mt-4 p-3 text-sm whitespace-pre-wrap`}>
          {round.notes}
        </p>
      )}
    </main>
  );
}
