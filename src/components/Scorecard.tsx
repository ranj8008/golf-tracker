import { pct, type HoleResult, type Totals } from "@/lib/golf";

// The round as a scorecard: one row per hole, Out / In / Total, everything after
// Score worked out from what was entered.

// Score shapes, as on a club card: rings under par, boxes over.
function ScoreMark({ r }: { r: HoleResult }) {
  if (r.score === null) return <span className="text-muted">–</span>;
  const d = r.toPar!;
  const shape =
    d <= -2
      ? "rounded-full border-2 border-under outline-2 outline-offset-1 outline-under"
      : d === -1
        ? "rounded-full border-2 border-under"
        : d === 1
          ? "border border-foreground/70"
          : d >= 2
            ? "border border-foreground/70 outline outline-offset-1 outline-foreground/70"
            : "";
  return (
    <span
      className={`inline-flex size-7 items-center justify-center font-semibold ${shape}`}
    >
      {r.score}
    </span>
  );
}

function Tick({ v }: { v: boolean | null }) {
  if (v === null) return null;
  return v ? (
    <span className="font-bold text-up" aria-label="Yes">
      ✓
    </span>
  ) : (
    <span className="font-bold text-down" aria-label="No">
      ✗
    </span>
  );
}

const cell = "px-0.5 py-1.5 text-center";

function TotalRow({
  label,
  t,
  strong,
}: {
  label: string;
  t: Totals;
  strong?: boolean;
}) {
  return (
    <tr
      className={`border-y-2 border-accent/60 font-semibold ${strong ? "bg-surface" : ""}`}
    >
      <th scope="row" className={`${cell} text-xs`}>
        {label}
      </th>
      <td className={`${cell} hidden text-xs sm:table-cell`}>
        {t.yards.toLocaleString("en-GB")}
      </td>
      <td className={cell}>{t.par}</td>
      <td className={cell} />
      <td className={cell}>{t.gross ?? "–"}</td>
      <td className={cell}>{t.net ?? "–"}</td>
      <td className={cell}>{t.putts || "–"}</td>
      <td className={`${cell} text-xs`}>{pct(t.firHit, t.firOf)}</td>
      <td className={`${cell} text-xs`}>{pct(t.girHit, t.girOf)}</td>
      <td className={`${cell} text-xs`}>
        {pct(t.scrambleMade, t.scrambleOf)}
      </td>
      <td className={cell}>{t.points}</td>
    </tr>
  );
}

export default function Scorecard({
  rows,
  out,
  inn,
  total,
}: {
  rows: HoleResult[];
  out: Totals;
  inn: Totals;
  total: Totals;
}) {
  const nine = rows.length <= 9;
  const holeRow = (r: HoleResult) => (
    <tr key={r.hole} className="border-b border-line last:border-0">
      <th scope="row" className={`${cell} font-medium`}>
        {r.hole}
      </th>
      <td className={`${cell} hidden text-muted sm:table-cell`}>
        {r.yards ?? ""}
      </td>
      <td className={cell}>{r.par}</td>
      <td className={`${cell} text-xs text-muted`}>{r.strokeIndex}</td>
      <td className={`${cell} relative`}>
        <ScoreMark r={r} />
        {r.shots !== 0 && (
          <span
            aria-label={`${r.shots > 0 ? "Gets" : "Gives"} ${Math.abs(r.shots)} shot${Math.abs(r.shots) > 1 ? "s" : ""}`}
            className="absolute top-0.5 right-0 text-[10px] leading-none text-muted"
          >
            {r.shots > 0 ? "•".repeat(r.shots) : "−"}
          </span>
        )}
      </td>
      <td className={cell}>{r.net ?? "–"}</td>
      <td className={cell}>{r.putts ?? ""}</td>
      <td className={cell}>
        <Tick v={r.fir} />
      </td>
      <td className={cell}>
        <Tick v={r.gir} />
      </td>
      <td className={cell}>
        <Tick v={r.scramble} />
      </td>
      <td className={`${cell} font-semibold`}>{r.points}</td>
    </tr>
  );
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-card">
      <table className="w-full table-fixed text-sm tabular-nums">
        <thead>
          <tr className="border-b-2 border-accent/60 text-xs text-muted">
            {[
              ["Hole", ""],
              ["Yds", "hidden sm:table-cell"],
              ["Par", ""],
              ["SI", ""],
              ["Score", "w-[15%]"],
              ["Net", ""],
              ["Putts", ""],
              ["FIR", ""],
              ["GIR", ""],
              ["Scr", ""],
              ["Pts", ""],
            ].map(([h, extra]) => (
              <th
                key={h}
                scope="col"
                title={
                  h === "FIR"
                    ? "Fairway in regulation"
                    : h === "GIR"
                      ? "Green in regulation"
                      : h === "Scr"
                        ? "Scrambling: par or better after missing the green"
                        : h === "SI"
                          ? "Stroke index"
                          : undefined
                }
                className={`px-0.5 py-2 text-center font-medium ${extra}`}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 9).map(holeRow)}
          {!nine && <TotalRow label="Out" t={out} />}
          {rows.slice(9).map(holeRow)}
          {!nine && <TotalRow label="In" t={inn} />}
          <TotalRow label="Total" t={total} strong />
        </tbody>
      </table>
      <p className="flex flex-wrap gap-x-3 gap-y-1 border-t border-line px-3 py-2 text-xs text-muted">
        <span className="flex items-center gap-1">
          <span className="inline-block size-3 rounded-full border-2 border-under" />
          Birdie
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block size-3 border border-foreground/70" />
          Bogey
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block size-3 border border-foreground/70 outline outline-offset-1 outline-foreground/70" />
          Double bogey +
        </span>
        <span>• Handicap stroke</span>
      </p>
    </div>
  );
}
