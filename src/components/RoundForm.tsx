"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import ScoreEntryCard, { resultName } from "@/components/ScoreEntryCard";
import {
  cardClass,
  Dropdown,
  inputClass,
  labelClass,
  primaryClass,
  Problem,
} from "@/components/Editing";
import {
  loadCourses,
  loadRounds,
  problem,
  saveRound,
  teeHoles,
  today,
  type Course,
  type Round,
  type Tee,
} from "@/lib/data";
import { blankEntry, scorecard, type HoleEntry } from "@/lib/golf";

// Entering a round after playing it: the round's details, then the scorecard with
// score, putts, FIR, GIR and penalties typed into it (ScoreEntryCard).

// v2: holes are score, putts, FIR, GIR and penalties (older drafts are ignored).
const DRAFT_KEY = "golf-tracker:new-round-v2";

type Details = {
  course_id: string;
  tee_id: string;
  played_on: string;
  handicap_index: string;
  playing_handicap: string;
  notes: string;
};

type Draft = { details: Details; entries: HoleEntry[] };

function readDraft(): Draft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? (JSON.parse(raw) as Draft) : null;
  } catch {
    return null;
  }
}
function writeDraft(d: Draft | null) {
  try {
    if (d) localStorage.setItem(DRAFT_KEY, JSON.stringify(d));
    else localStorage.removeItem(DRAFT_KEY);
  } catch {
    // Private browsing or storage blocked: carry on without a draft.
  }
}

// "Blue · 6,798 yds · 73.4 / 135" in the tees dropdown.
const teeOption = (t: Tee) =>
  [
    t.name,
    `${t.yards.reduce((a, b) => a + b, 0).toLocaleString("en-GB")} yds`,
    t.course_rating !== null || t.slope !== null
      ? `${t.course_rating ?? "–"} / ${t.slope ?? "–"}`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

const sized = (entries: HoleEntry[], n: number) =>
  Array.from({ length: n }, (_, i) => entries[i] ?? blankEntry());

export default function RoundForm({ round }: { round?: Round }) {
  const router = useRouter();
  const editing = !!round;
  const [courses, setCourses] = useState<Course[] | null>(null);
  const [details, setDetails] = useState<Details>({
    course_id: round?.course_id ?? "",
    tee_id: round?.tee_id ?? "",
    played_on: round?.played_on ?? today(),
    handicap_index: round?.handicap_index?.toString() ?? "",
    playing_handicap: round?.playing_handicap.toString() ?? "",
    notes: round?.notes ?? "",
  });
  const [entries, setEntries] = useState<HoleEntry[]>(() =>
    round
      ? round.tee.par.map((_, i) => {
          const h = round.hole_scores.find((x) => x.hole === i + 1);
          return h
            ? {
                score: h.score,
                putts: h.putts,
                fir: h.fir,
                gir: h.gir,
                penalties: h.penalties,
              }
            : blankEntry();
        })
      : sized([], 18),
  );
  const [state, setState] = useState<"idle" | "busy">("idle");
  const [error, setError] = useState<string | null>(null);
  const [confirmMissing, setConfirmMissing] = useState(false);
  const loaded = useRef(false);
  const [flash, setFlash] = useState<{
    hole: number;
    toPar: number;
    name: string;
  } | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Courses, and for a new round: a saved draft, or else last round's course, tees
  // and handicaps.
  useEffect(() => {
    Promise.all([loadCourses(), editing ? null : loadRounds(1)])
      .then(([cs, last]) => {
        setCourses(cs);
        if (!editing) {
          const draft = readDraft();
          if (draft) {
            setDetails(draft.details);
            setEntries(draft.entries);
          } else {
            const prev = last?.[0];
            const course =
              cs.find((c) => c.id === prev?.course_id) ?? cs[0] ?? null;
            const tee =
              course?.tees.find((t) => t.id === prev?.tee_id) ??
              course?.tees[0];
            setDetails((d) => ({
              ...d,
              course_id: course?.id ?? "",
              tee_id: tee?.id ?? "",
              handicap_index: prev?.handicap_index?.toString() ?? "",
              playing_handicap: prev?.playing_handicap.toString() ?? "",
            }));
            if (tee) setEntries((e) => sized(e, tee.par.length));
          }
        }
        loaded.current = true;
      })
      .catch((e) => setError(problem(e)));
  }, [editing]);

  // Keep a draft of a new round on this phone until it's saved.
  useEffect(() => {
    if (!editing && loaded.current) writeDraft({ details, entries });
  }, [editing, details, entries]);

  const course = courses?.find((c) => c.id === details.course_id);
  const tee = course?.tees.find((t) => t.id === details.tee_id);
  const ph = Number.parseInt(details.playing_handicap, 10);
  const card = useMemo(
    () =>
      tee ? scorecard(teeHoles(tee), entries, Number.isNaN(ph) ? 0 : ph) : null,
    [tee, entries, ph],
  );

  const set = (k: keyof Details) => (v: string) => {
    setDetails((d) => ({ ...d, [k]: v }));
    setConfirmMissing(false);
  };
  const pickCourse = (id: string) => {
    const c = courses?.find((x) => x.id === id);
    const t = c?.tees[0];
    setDetails((d) => ({ ...d, course_id: id, tee_id: t?.id ?? "" }));
    if (t) setEntries((e) => sized(e, t.par.length));
  };
  const pickTee = (id: string) => {
    const t = course?.tees.find((x) => x.id === id);
    setDetails((d) => ({ ...d, tee_id: id }));
    if (t) setEntries((e) => sized(e, t.par.length));
  };
  const setHole = (i: number, patch: Partial<HoleEntry>) => {
    setEntries((es) => es.map((e, j) => (j === i ? { ...e, ...patch } : e)));
    setConfirmMissing(false);
    // A score typed in: say what it was, briefly, in the bar at the bottom.
    if ("score" in patch && tee) {
      clearTimeout(flashTimer.current);
      if (patch.score) {
        const par = tee.par[i];
        setFlash({
          hole: i + 1,
          toPar: patch.score - par,
          name: resultName(patch.score, par),
        });
        flashTimer.current = setTimeout(() => setFlash(null), 2500);
      } else setFlash(null);
    }
  };

  const badPutts = entries
    .map((e, i) =>
      e.score !== null && e.putts !== null && e.putts >= e.score ? i + 1 : 0,
    )
    .filter(Boolean);
  const missing = entries
    .map((e, i) => (e.score === null ? i + 1 : 0))
    .filter(Boolean);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!tee) return setError("Choose a course and tees.");
    if (Number.isNaN(ph)) return setError("Enter your playing handicap.");
    if (badPutts.length)
      return setError(
        `Putts should be fewer than the score on hole ${badPutts.join(", ")}.`,
      );
    if (missing.length === entries.length)
      return setError("Enter at least one score.");
    if (missing.length && !confirmMissing) return setConfirmMissing(true);
    setState("busy");
    try {
      const hi = details.handicap_index.trim();
      const id = await saveRound(
        {
          ...(round ? { id: round.id } : {}),
          course_id: details.course_id,
          tee_id: details.tee_id,
          played_on: details.played_on,
          handicap_index: hi === "" ? null : Number(hi),
          playing_handicap: ph,
          notes: details.notes.trim() || null,
        },
        entries.map((x, i) => ({
          ...x,
          // Fairways only count on par 4s and 5s.
          fir: tee.par[i] >= 4 ? x.fir : null,
        })),
      );
      if (!editing) writeDraft(null);
      router.push(`/rounds/${id}`);
    } catch (err) {
      setError(problem(err));
      setState("idle");
    }
  };

  const startAgain = () => {
    writeDraft(null);
    setEntries(sized([], tee?.par.length ?? 18));
    setDetails((d) => ({ ...d, played_on: today(), notes: "" }));
    setConfirmMissing(false);
  };

  if (courses === null)
    return error ? <Problem>{error}</Problem> : null;

  if (courses.length === 0)
    return (
      <div className={`${cardClass} p-4 text-sm`}>
        <p className="mb-3">Add a course with its tees first.</p>
        <Link
          href="/courses"
          className="inline-flex min-h-11 items-center rounded-lg bg-accent px-4 font-semibold text-on-accent"
        >
          Go to courses
        </Link>
      </div>
    );

  return (
    <form onSubmit={save} className="space-y-4">
      <div className={`${cardClass} grid grid-cols-2 gap-3 p-3 [&>*]:min-w-0`}>
        <div className="col-span-2">
          <Dropdown
            label="Course"
            required
            value={details.course_id}
            onChange={pickCourse}
            options={courses.map((c) => ({ value: c.id, label: c.name }))}
            placeholder="Choose a course"
          />
        </div>
        <Dropdown
          label="Tees"
          required
          value={details.tee_id}
          onChange={pickTee}
          options={(course?.tees ?? []).map((t) => ({
            value: t.id,
            label: teeOption(t),
          }))}
          placeholder="Choose tees"
        />
        <label className="block">
          <span className={labelClass}>Date</span>
          <input
            type="date"
            required
            value={details.played_on}
            max={today()}
            onChange={(e) => set("played_on")(e.target.value)}
            className={inputClass}
          />
        </label>
        <label className="block">
          <span className={labelClass}>Handicap index</span>
          <input
            type="text"
            inputMode="decimal"
            placeholder="e.g. 4.8"
            value={details.handicap_index}
            onChange={(e) =>
              set("handicap_index")(e.target.value.replace(/[^0-9.+-]/g, ""))
            }
            className={inputClass}
          />
        </label>
        <label className="block">
          <span className={labelClass}>Playing handicap</span>
          <input
            type="text"
            inputMode="numeric"
            required
            placeholder="e.g. 6"
            value={details.playing_handicap}
            onChange={(e) =>
              set("playing_handicap")(e.target.value.replace(/[^0-9-]/g, ""))
            }
            className={inputClass}
          />
        </label>
      </div>

      {tee && card && (
        <>
          <ScoreEntryCard
            rows={card.rows}
            out={card.out}
            inn={card.in}
            total={card.total}
            entries={entries}
            setHole={setHole}
            badPutts={badPutts}
          />

          <label className="block">
            <span className={labelClass}>Notes</span>
            <textarea
              rows={2}
              value={details.notes}
              onChange={(e) => set("notes")(e.target.value)}
              className={`${inputClass} py-2`}
            />
          </label>
        </>
      )}

      <div className="sticky bottom-[calc(56px+env(safe-area-inset-bottom))] -mx-4 space-y-2 border-t border-line bg-background/95 px-4 py-3 backdrop-blur md:bottom-0">
        <Problem>{error}</Problem>
        {confirmMissing && (
          <p role="alert" className="text-sm">
            No score on hole {missing.join(", ")}. Saved as picked up (no
            points). Tap Save again to save anyway.
          </p>
        )}
        <div className="flex items-center gap-3">
          {flash ? (
            <span
              key={`${flash.hole}-${flash.name}`}
              role="status"
              className={`animate-[flash_2.5s_ease-out] rounded-full px-3 py-1.5 text-sm font-bold whitespace-nowrap ${
                flash.toPar <= -2
                  ? "bg-eagle text-on-eagle"
                  : flash.toPar === -1
                    ? "bg-birdie-soft text-under"
                    : flash.toPar === 0
                      ? "bg-surface text-foreground"
                      : flash.toPar === 1
                        ? "bg-bogey-soft text-foreground"
                        : "bg-double text-on-double"
              }`}
            >
              {flash.name} on {flash.hole}
              {flash.toPar <= -1 ? "!" : ""}
            </span>
          ) : card && (
            <span className="text-sm text-muted tabular-nums">
              <strong className="text-foreground">
                {card.total.grossSoFar || "–"}
              </strong>{" "}
              gross ·{" "}
              <strong className="text-foreground">{card.total.points}</strong>{" "}
              pts
            </span>
          )}
          <button
            type="submit"
            disabled={state === "busy"}
            className={primaryClass}
          >
            {state === "busy"
              ? "Saving…"
              : editing
                ? "Save changes"
                : "Save round"}
          </button>
        </div>
        {!editing && entries.some((e) => e.score !== null) && (
          <button
            type="button"
            onClick={startAgain}
            className="min-h-11 w-full text-sm text-muted underline"
          >
            Clear the card and start again
          </button>
        )}
      </div>
    </form>
  );
}
