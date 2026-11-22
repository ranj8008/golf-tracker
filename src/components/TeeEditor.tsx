"use client";

import { useState } from "react";
import {
  dangerClass,
  inputClass,
  labelClass,
  primaryClass,
  Problem,
  secondaryClass,
  Sheet,
} from "@/components/Editing";
import { deleteTee, problem, saveTee, type Tee } from "@/lib/data";

// Add or change a set of tees: name, rating and slope, then each hole's par, yards
// and stroke index, all from the club's scorecard.

const cellBox =
  "min-h-11 w-full rounded-lg border border-line bg-background px-1 text-center text-base tabular-nums";

const parseNum = (s: string) => {
  const n = Number.parseFloat(s);
  return Number.isNaN(n) ? null : n;
};

export default function TeeEditor({
  courseId,
  courseName,
  tee,
  onClose,
  onSaved,
}: {
  courseId: string;
  courseName: string;
  tee?: Tee;
  onClose: () => void;
  onSaved: () => void;
}) {
  const holes = tee?.par.length ?? 18;
  const [name, setName] = useState(tee?.name ?? "");
  const [rating, setRating] = useState(tee?.course_rating?.toString() ?? "");
  const [slope, setSlope] = useState(tee?.slope?.toString() ?? "");
  const [par, setPar] = useState<string[]>(
    (tee?.par ?? Array(holes).fill(4)).map(String),
  );
  const [yards, setYards] = useState<string[]>(
    (tee?.yards ?? Array(holes).fill("")).map((y) => (y ? String(y) : "")),
  );
  const [si, setSi] = useState<string[]>(
    (tee?.stroke_index ?? Array.from({ length: holes }, (_, i) => i + 1)).map(
      String,
    ),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sure, setSure] = useState(false);

  const setAt =
    (list: string[], set: (v: string[]) => void, i: number) => (v: string) =>
      set(list.map((x, j) => (j === i ? v.replace(/\D/g, "") : x)));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const p = par.map(Number);
    const s = si.map(Number);
    if (p.some((x) => x < 3 || x > 6))
      return setError("Each par should be 3, 4, 5 or 6.");
    const want = Array.from({ length: s.length }, (_, i) => i + 1);
    if ([...s].sort((a, b) => a - b).join() !== want.join())
      return setError(
        `Stroke indexes should use each of 1 to ${s.length} once.`,
      );
    const cr = parseNum(rating);
    const sl = parseNum(slope);
    if (rating.trim() && (cr === null || cr < 50 || cr > 90))
      return setError("Course rating looks wrong (it's usually 60 to 80).");
    if (slope.trim() && (sl === null || sl < 55 || sl > 155))
      return setError("Slope should be between 55 and 155.");
    setBusy(true);
    try {
      await saveTee({
        ...(tee ? { id: tee.id } : {}),
        course_id: courseId,
        name: name.trim(),
        course_rating: cr,
        slope: sl === null ? null : Math.round(sl),
        par: p,
        yards: yards.map((y) => Number(y) || 0),
        stroke_index: s,
      });
      onSaved();
    } catch (err) {
      setError(problem(err));
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!tee) return;
    if (!sure) return setSure(true);
    try {
      await deleteTee(tee.id);
      onSaved();
    } catch (err) {
      setError(problem(err));
    }
  };

  const total = (list: string[]) =>
    list.reduce((a, b) => a + (Number(b) || 0), 0);

  return (
    <Sheet
      title={tee ? `${courseName}: ${tee.name} tees` : `New tees: ${courseName}`}
      onClose={onClose}
    >
      <form onSubmit={save} className="space-y-3">
        <label className="block">
          <span className={labelClass}>Name</span>
          <input
            required
            value={name}
            placeholder="e.g. Orange"
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className={labelClass}>Course rating</span>
            <input
              inputMode="decimal"
              value={rating}
              placeholder="e.g. 71.4"
              onChange={(e) => setRating(e.target.value.replace(/[^0-9.]/g, ""))}
              className={inputClass}
            />
          </label>
          <label className="block">
            <span className={labelClass}>Slope</span>
            <input
              inputMode="numeric"
              value={slope}
              placeholder="e.g. 128"
              onChange={(e) => setSlope(e.target.value.replace(/\D/g, ""))}
              className={inputClass}
            />
          </label>
        </div>

        <p className="text-sm text-muted">
          From the club&apos;s scorecard. Rating and slope are also in the My EG
          app.
        </p>

        <div className="overflow-hidden rounded-lg border border-line">
          <div className="flex gap-2 border-b border-line px-2 py-1.5 text-xs text-muted">
            <span className="w-10">Hole</span>
            <span className="flex-1 text-center">Par</span>
            <span className="flex-1 text-center">Yards</span>
            <span className="flex-1 text-center">Stroke index</span>
          </div>
          {par.map((_, i) => (
            <div key={i}>
              <div className="flex items-center gap-2 px-2 py-0.5">
                <span className="w-10 font-semibold">{i + 1}</span>
                <input
                  aria-label={`Hole ${i + 1} par`}
                  inputMode="numeric"
                  maxLength={1}
                  value={par[i]}
                  onChange={(e) => setAt(par, setPar, i)(e.target.value)}
                  className={`${cellBox} flex-1`}
                />
                <input
                  aria-label={`Hole ${i + 1} yards`}
                  inputMode="numeric"
                  maxLength={3}
                  value={yards[i]}
                  onChange={(e) => setAt(yards, setYards, i)(e.target.value)}
                  className={`${cellBox} flex-1`}
                />
                <input
                  aria-label={`Hole ${i + 1} stroke index`}
                  inputMode="numeric"
                  maxLength={2}
                  value={si[i]}
                  onChange={(e) => setAt(si, setSi, i)(e.target.value)}
                  className={`${cellBox} flex-1`}
                />
              </div>
              {i === 8 && par.length === 18 && (
                <div className="my-0.5 flex gap-2 bg-surface px-2 py-1.5 text-sm font-semibold tabular-nums">
                  <span className="w-10">Out</span>
                  <span className="flex-1 text-center">{total(par.slice(0, 9))}</span>
                  <span className="flex-1 text-center">
                    {total(yards.slice(0, 9)).toLocaleString("en-GB")}
                  </span>
                  <span className="flex-1" />
                </div>
              )}
            </div>
          ))}
          <div className="flex gap-2 border-t border-line bg-surface px-2 py-1.5 text-sm font-semibold tabular-nums">
            <span className="w-10">Total</span>
            <span className="flex-1 text-center">{total(par)}</span>
            <span className="flex-1 text-center">
              {total(yards).toLocaleString("en-GB")}
            </span>
            <span className="flex-1" />
          </div>
        </div>

        <Problem>{error}</Problem>
        <div className="flex gap-2">
          <button type="button" onClick={onClose} className={secondaryClass}>
            Cancel
          </button>
          <button type="submit" disabled={busy} className={primaryClass}>
            {busy ? "Saving…" : "Save tees"}
          </button>
        </div>
        {tee && (
          <div className="text-center">
            <button type="button" onClick={remove} className={dangerClass}>
              {sure ? "Tap again to delete these tees" : "Delete tees"}
            </button>
          </div>
        )}
      </form>
    </Sheet>
  );
}
