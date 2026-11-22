"use client";

import { useState } from "react";
import CourseLookup, {
  teeLabel,
  type LookupCourse,
  type LookupTee,
} from "@/components/CourseLookup";
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
// and stroke index. Rating and slope can be filled in from the course database.

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
  const [lookup, setLookup] = useState(false);
  const [found, setFound] = useState<LookupCourse | null>(null);
  const [copyHoles, setCopyHoles] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [sure, setSure] = useState(false);

  const applyTee = (t: LookupTee) => {
    setRating(t.courseRating?.toString() ?? "");
    setSlope(t.slope?.toString() ?? "");
    if (!name.trim()) setName(t.name);
    const canCopy = t.par.length === par.length;
    if (copyHoles && canCopy) {
      setPar(t.par.map(String));
      setYards(t.yards.map((y) => (y ? String(y) : "")));
      setSi(t.strokeIndex.map(String));
    }
    setNote(
      `Filled in from ${t.name} (${t.gender})${
        copyHoles && !canCopy ? ". Holes not copied: different number of holes" : ""
      }. Check them against your card, then save.`,
    );
    setLookup(false);
    setFound(null);
  };

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

        {!lookup ? (
          <button
            type="button"
            onClick={() => setLookup(true)}
            className={`${secondaryClass} w-full`}
          >
            Look up rating and slope
          </button>
        ) : (
          <div className="space-y-2 rounded-lg bg-surface p-3">
            {!found ? (
              <CourseLookup initialQuery={courseName} onPick={setFound} />
            ) : (
              <>
                <p className="text-sm font-medium">{found.name}: which tees?</p>
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="size-5"
                    checked={copyHoles}
                    onChange={(e) => setCopyHoles(e.target.checked)}
                  />
                  Also copy each hole&apos;s par, yards and stroke index
                </label>
                <ul className="overflow-hidden rounded-lg border border-line bg-card">
                  {found.tees.map((t, i) => (
                    <li key={i} className="border-b border-line last:border-0">
                      <button
                        type="button"
                        onClick={() => applyTee(t)}
                        className="min-h-11 w-full px-3 py-2 text-left text-sm active:bg-surface"
                      >
                        {teeLabel(t)}
                      </button>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={() => setFound(null)}
                  className="min-h-11 text-sm text-accent underline"
                >
                  Back to results
                </button>
              </>
            )}
          </div>
        )}
        {note && <p className="text-sm text-muted">{note}</p>}

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
