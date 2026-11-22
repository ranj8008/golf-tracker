"use client";

import { useEffect, useRef } from "react";
import { markClass } from "@/lib/marks";
import {
  autoGir,
  pct,
  type HoleEntry,
  type HoleResult,
  type Totals,
} from "@/lib/golf";

// The round's scorecard with the input columns typed straight into it: Score,
// Putts, FIR, GIR and Pen (penalty strokes). Net, Scrmb, Pts and the Out / In / Tot
// rows are worked out as you go. GIR fills in from score and putts; tap it to change
// it (e.g. putting from the fringe).

const box =
  "h-11 w-full rounded-md border border-line bg-background px-0 text-center text-base tabular-nums";

function NumberCell({
  value,
  onChange,
  label,
  invalid,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  label: string;
  invalid?: boolean;
}) {
  return (
    <input
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      maxLength={2}
      enterKeyHint="next"
      aria-label={label}
      aria-invalid={invalid || undefined}
      value={value ?? ""}
      onChange={(e) => {
        const digits = e.target.value.replace(/\D/g, "");
        onChange(digits === "" ? null : Number(digits));
      }}
      onFocus={(e) => e.target.select()}
      className={`${box} ${invalid ? "border-down text-down" : ""}`}
    />
  );
}

// The score box takes the scorecard mark for the result (src/lib/marks.ts), with
// a quick pop when it changes.
export function resultName(score: number, par: number) {
  const d = score - par;
  if (score === 1) return "Hole in one";
  if (d <= -3) return "Albatross";
  return (
    { [-2]: "Eagle", [-1]: "Birdie", 0: "Par", 1: "Bogey", 2: "Double bogey", 3: "Triple bogey" }[d] ??
    `+${d}`
  );
}

// Marked scores fill the box; an empty box or a par keeps the plain input look.
const resultStyle = (d: number | null) =>
  d === null || d === 0
    ? `rounded-md border-line bg-background ${d === 0 ? "font-semibold" : ""}`
    : `border-transparent ${markClass(d)}`;

function ScoreCell({
  value,
  toPar,
  onChange,
  label,
}: {
  value: number | null;
  toPar: number | null;
  onChange: (v: number | null) => void;
  label: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (toPar === null || !ref.current) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const big = toPar <= -1;
    ref.current.animate(
      [
        { transform: "scale(1)" },
        { transform: `scale(${big ? 1.25 : 1.12})` },
        { transform: "scale(1)" },
      ],
      { duration: big ? 420 : 260, easing: "cubic-bezier(.3,1.6,.5,1)" },
    );
  }, [toPar]);
  return (
    <input
      ref={ref}
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      maxLength={2}
      enterKeyHint="next"
      aria-label={label}
      value={value ?? ""}
      onChange={(e) => {
        const digits = e.target.value.replace(/\D/g, "");
        onChange(digits === "" ? null : Number(digits));
      }}
      onFocus={(e) => e.target.select()}
      className={`mx-auto block size-11 border px-0 text-center text-base tabular-nums transition-colors ${resultStyle(toPar)}`}
    />
  );
}

function Mark({ v }: { v: boolean | null }) {
  if (v === null) return <span className="text-muted">–</span>;
  return v ? (
    <span className="text-lg font-bold text-up">✓</span>
  ) : (
    <span className="text-lg font-bold text-down">✗</span>
  );
}

// A tap target that shows ✓ / ✗ / –.
function ToggleCell({
  value,
  label,
  onTap,
  set,
}: {
  value: boolean | null;
  label: string;
  onTap: () => void;
  set: boolean; // entered (rather than blank or worked out)
}) {
  return (
    <button
      type="button"
      aria-label={`${label}: ${value === null ? "not entered" : value ? "yes" : "no"}`}
      onClick={onTap}
      className={`${box} flex items-center justify-center ${set ? "" : "border-dashed"}`}
    >
      <Mark v={value} />
    </button>
  );
}

const th = "px-0.5 py-2 text-center font-medium";
const td = "px-0.5 py-1 text-center";

export default function ScoreEntryCard({
  rows,
  out,
  inn,
  total,
  entries,
  setHole,
  badPutts,
}: {
  rows: HoleResult[];
  out: Totals;
  inn: Totals;
  total: Totals;
  entries: HoleEntry[];
  setHole: (i: number, patch: Partial<HoleEntry>) => void;
  badPutts: number[];
}) {
  const nine = rows.length <= 9;

  // FIR: – → ✓ → ✗ → –
  const tapFir = (i: number) => {
    const v = entries[i].fir;
    setHole(i, { fir: v === null ? true : v ? false : null });
  };
  // GIR: flips what's shown, and flipping back to the worked-out value makes it
  // automatic again. With nothing to work it out from: – → ✓ → ✗ → –.
  const tapGir = (i: number, r: HoleResult) => {
    const auto = autoGir(r.par, entries[i]);
    const shown = entries[i].gir ?? auto;
    const next =
      auto !== null ? !shown : shown === null ? true : shown ? false : null;
    setHole(i, { gir: next === auto ? null : next });
  };

  const totalRow = (label: string, t: Totals, strong?: boolean) => (
    <tr
      className={`border-y-2 border-accent/60 text-sm font-semibold ${strong ? "bg-surface" : ""}`}
    >
      <th scope="row" className={`${td} pl-1.5 text-left text-xs`}>
        {label}
      </th>
      <td className={`${td} hidden text-xs sm:table-cell`}>
        {t.yards.toLocaleString("en-GB")}
      </td>
      <td className={td}>{t.par}</td>
      <td className={td} />
      <td className={td}>{t.grossSoFar || ""}</td>
      <td className={td}>{t.grossSoFar ? t.netSoFar : ""}</td>
      <td className={td}>{t.putts || ""}</td>
      <td className={`${td} text-[11px]`}>
        {t.firOf ? pct(t.firHit, t.firOf) : ""}
      </td>
      <td className={`${td} text-[11px]`}>
        {t.girOf ? pct(t.girHit, t.girOf) : ""}
      </td>
      <td className={td}>{t.penalties || ""}</td>
      <td className={`${td} text-[11px]`}>
        {t.scrambleOf ? pct(t.scrambleMade, t.scrambleOf) : ""}
      </td>
      <td className={td}>{t.grossSoFar ? t.points : ""}</td>
    </tr>
  );

  const holeRow = (r: HoleResult) => {
    const i = r.hole - 1;
    const e = entries[i];
    return (
      <tr key={r.hole} className="border-b border-line">
        <th scope="row" className={`${td} pl-1.5 text-left font-semibold`}>
          {r.hole}
        </th>
        <td className={`${td} hidden text-muted sm:table-cell`}>
          {r.yards || ""}
        </td>
        <td className={td}>{r.par}</td>
        <td className={`${td} text-xs text-muted`}>{r.strokeIndex}</td>
        <td className={`${td} relative`}>
          <ScoreCell
            label={`Hole ${r.hole} score`}
            value={e.score}
            toPar={r.toPar}
            onChange={(v) => setHole(i, { score: v })}
          />
          {r.shots > 0 && (
            <span
              aria-label={`Gets ${r.shots}`}
              className="pointer-events-none absolute -top-0.5 right-0 text-[10px] leading-none text-muted"
            >
              {"•".repeat(r.shots)}
            </span>
          )}
        </td>
        <td className={`${td} text-muted`}>{r.net ?? ""}</td>
        <td className={td}>
          <NumberCell
            label={`Hole ${r.hole} putts`}
            value={e.putts}
            invalid={badPutts.includes(r.hole)}
            onChange={(v) => setHole(i, { putts: v })}
          />
        </td>
        <td className={td}>
          {r.par >= 4 && (
            <ToggleCell
              label={`Hole ${r.hole} fairway`}
              value={e.fir}
              set={e.fir !== null}
              onTap={() => tapFir(i)}
            />
          )}
        </td>
        <td className={td}>
          <ToggleCell
            label={`Hole ${r.hole} green in regulation`}
            value={r.gir}
            set={e.gir !== null}
            onTap={() => tapGir(i, r)}
          />
        </td>
        <td className={td}>
          <NumberCell
            label={`Hole ${r.hole} penalty strokes`}
            value={e.penalties}
            onChange={(v) => setHole(i, { penalties: v })}
          />
        </td>
        <td className={td}>
          {r.scramble !== null && <Mark v={r.scramble} />}
        </td>
        <td className={`${td} font-semibold`}>
          {r.score === null ? "" : r.points}
        </td>
      </tr>
    );
  };

  return (
    <div className="-mx-4 overflow-hidden border-y border-line bg-card sm:mx-0 sm:rounded-xl sm:border">
      <table className="w-full table-fixed tabular-nums">
        <colgroup>
          <col className="w-[8%]" />
          <col className="hidden w-[8%] sm:table-column" />
          <col className="w-[6%]" />
          <col className="w-[6%]" />
          <col className="w-[13%]" />
          <col className="w-[6%]" />
          <col className="w-[13%]" />
          <col className="w-[11%]" />
          <col className="w-[11%]" />
          <col className="w-[11%]" />
          <col className="w-[7%]" />
          <col className="w-[8%]" />
        </colgroup>
        <thead>
          <tr className="border-b-2 border-accent/60 text-[11px] text-muted">
            <th scope="col" className={`${th} pl-1.5 text-left`}>
              Hole
            </th>
            <th scope="col" className={`${th} hidden sm:table-cell`}>
              Yds
            </th>
            <th scope="col" className={th}>
              Par
            </th>
            <th scope="col" className={th} title="Stroke index">
              SI
            </th>
            <th scope="col" className={`${th} text-foreground`}>
              Score
            </th>
            <th scope="col" className={th}>
              Net
            </th>
            <th scope="col" className={`${th} text-foreground`}>
              Putts
            </th>
            <th
              scope="col"
              className={`${th} text-foreground`}
              title="Fairway in regulation"
            >
              FIR
            </th>
            <th
              scope="col"
              className={`${th} text-foreground`}
              title="Green in regulation"
            >
              GIR
            </th>
            <th
              scope="col"
              className={`${th} text-foreground`}
              title="Penalty strokes"
            >
              Pen
            </th>
            <th
              scope="col"
              className={th}
              title="Scrambling: par or better after missing the green"
            >
              Scr
            </th>
            <th scope="col" className={th} title="Stableford points">
              Pts
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 9).map(holeRow)}
          {!nine && totalRow("Out", out)}
          {rows.slice(9).map(holeRow)}
          {!nine && totalRow("In", inn)}
          {totalRow("Tot", total, true)}
        </tbody>
      </table>
      <p className="border-t border-line px-3 py-2 text-xs text-muted">
        GIR fills in from score and putts (dashed box): tap to change it. •
        Handicap stroke.
      </p>
    </div>
  );
}
