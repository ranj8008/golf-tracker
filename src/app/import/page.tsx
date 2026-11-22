"use client";

import Link from "next/link";
import { useState } from "react";
import {
  cardClass,
  PageTitle,
  primaryClass,
  Problem,
} from "@/components/Editing";
import { formatDate, problem } from "@/lib/data";
import {
  identify,
  parseFile,
  plan as makePlan,
  REF,
  type Existing,
  type Plan,
  type SnFiles,
} from "@/lib/snImport";
import { supabase } from "@/lib/supabase";

// One-off import from the old ServiceNow app. Choose the five JSONv2 exports; the
// page shows what it will add and checks every round against ServiceNow's totals,
// then saves under your login. Safe to run again: anything already imported is
// skipped. The files go from this browser to the database, nowhere else.

const TABLES: { key: keyof SnFiles; label: string }[] = [
  { key: "courses", label: "Courses" },
  { key: "tees", label: "Tees" },
  { key: "holes", label: "Tee holes" },
  { key: "rounds", label: "Rounds" },
  { key: "roundHoles", label: "Round holes" },
];

async function loadExisting(): Promise<Existing> {
  const db = supabase();
  const [c, t, r] = await Promise.all([
    db.from("courses").select("id, name, source_ref"),
    db.from("tees").select("id, course_id, name, source_ref"),
    db.from("rounds").select("played_on, tee_id, source_ref"),
  ]);
  const err = c.error ?? t.error ?? r.error;
  if (err) throw err;
  const rounds = r.data as {
    played_on: string;
    tee_id: string;
    source_ref: string | null;
  }[];
  return {
    courses: c.data as Existing["courses"],
    tees: t.data as Existing["tees"],
    roundRefs: new Set(rounds.flatMap((x) => (x.source_ref ? [x.source_ref] : []))),
    roundDates: new Set(
      rounds.filter((x) => !x.source_ref).map((x) => `${x.played_on}|${x.tee_id}`),
    ),
  };
}

export default function ImportPage() {
  const [files, setFiles] = useState<Partial<SnFiles>>({});
  const [plan, setPlan] = useState<Plan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [done, setDone] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  const complete = TABLES.every((t) => files[t.key]);

  const choose = async (list: FileList | null) => {
    setError(null);
    setPlan(null);
    setDone(null);
    const next = { ...files };
    for (const f of Array.from(list ?? [])) {
      try {
        const records = parseFile(await f.text());
        const which = identify(records);
        if (!which) throw new Error("not one of the five tables");
        next[which] = records;
      } catch (e) {
        setError(`${f.name}: ${(e as Error).message}`);
      }
    }
    setFiles(next);
    if (TABLES.every((t) => next[t.key])) {
      try {
        setPlan(makePlan(next as SnFiles, await loadExisting()));
      } catch (e) {
        setError(problem(e));
      }
    }
  };

  const run = async () => {
    if (!plan) return;
    setBusy(true);
    setError(null);
    const db = supabase();
    try {
      const courseId = new Map(plan.matchedCourses);
      for (const c of plan.newCourses) {
        setProgress(`Adding course: ${c.name}`);
        const { data, error } = await db
          .from("courses")
          .insert({ name: c.name, source_ref: REF(c.snId) })
          .select("id")
          .single();
        if (error) throw error;
        courseId.set(c.snId, data.id);
      }
      const teeId = new Map(plan.matchedTees);
      for (const t of plan.newTees) {
        setProgress(`Adding tees: ${t.name}`);
        const { data, error } = await db
          .from("tees")
          .insert({
            course_id: courseId.get(t.snCourseId),
            name: t.name,
            course_rating: t.course_rating,
            slope: t.slope,
            par: t.par,
            yards: t.yards,
            stroke_index: t.stroke_index,
            source_ref: REF(t.snId),
          })
          .select("id")
          .single();
        if (error) throw error;
        teeId.set(t.snId, data.id);
      }
      let n = 0;
      for (const r of plan.rounds) {
        setProgress(`Importing rounds: ${n} of ${plan.rounds.length}`);
        const { error } = await db.rpc("save_round", {
          p_round: {
            course_id: courseId.get(r.snCourseId),
            tee_id: teeId.get(r.snTeeId),
            played_on: r.played_on,
            handicap_index: r.handicap_index,
            playing_handicap: r.playing_handicap,
            pcc: r.pcc,
            source_ref: REF(r.snId),
          },
          p_holes: r.holes.map((h, i) => ({ hole: i + 1, ...h })),
        });
        if (error) throw new Error(`${r.played_on} ${r.courseName}: ${problem(error)}`);
        n++;
      }
      setDone(n);
      setPlan(null);
      setProgress(null);
    } catch (e) {
      setError(
        `${problem(e)} Nothing after this point was saved. Choose the files again and import: what's already in is skipped.`,
      );
      setProgress(null);
    } finally {
      setBusy(false);
    }
  };

  const mismatched = plan?.rounds.filter((r) => r.check) ?? [];

  return (
    <main className="mx-auto max-w-2xl px-4 py-6">
      <PageTitle>Import from ServiceNow</PageTitle>

      <section className={`${cardClass} mb-4 space-y-3 p-4 text-sm`}>
        <p className="text-muted">
          Choose the five JSON exports from your ServiceNow golf app (you can
          pick them all at once). Nothing is saved until you press Import.
        </p>
        <input
          type="file"
          multiple
          onChange={(e) => choose(e.target.files)}
          className="block w-full text-sm file:mr-3 file:min-h-11 file:rounded-lg file:border-0 file:bg-surface file:px-4 file:font-medium"
        />
        <ul className="grid grid-cols-2 gap-1">
          {TABLES.map((t) => (
            <li key={t.key} className={files[t.key] ? "" : "text-muted"}>
              {files[t.key] ? "✓" : "○"} {t.label}
              {files[t.key] && (
                <span className="text-muted"> ({files[t.key]!.length})</span>
              )}
            </li>
          ))}
        </ul>
      </section>

      <Problem>{error}</Problem>

      {done !== null && (
        <section className={`${cardClass} p-4 text-sm`}>
          <p className="mb-3 font-semibold">
            Done: {done} round{done === 1 ? "" : "s"} imported.
          </p>
          <Link
            href="/"
            className="inline-flex min-h-11 items-center rounded-lg bg-accent px-4 font-semibold text-on-accent"
          >
            See your rounds
          </Link>
        </section>
      )}

      {complete && plan && (
        <section className={`${cardClass} space-y-3 p-4 text-sm`}>
          <h2 className="text-base font-bold">What will be imported</h2>
          <ul className="space-y-1">
            <li>
              <strong>{plan.rounds.length}</strong> rounds
              {plan.rounds.length > 0 &&
                ` (${formatDate(plan.rounds[0].played_on)} to ${formatDate(
                  plan.rounds[plan.rounds.length - 1].played_on,
                )})`}
              , {plan.statsRounds} with putts, fairways and greens
            </li>
            <li>
              <strong>{plan.newCourses.length}</strong> new courses,{" "}
              <strong>{plan.newTees.length}</strong> new sets of tees
              {plan.matchedCourses.size > 0 &&
                `; ${plan.matchedCourses.size} course${plan.matchedCourses.size === 1 ? "" : "s"} already here`}
            </li>
            {plan.alreadyImported > 0 && (
              <li className="text-muted">
                {plan.alreadyImported} rounds already imported (skipped)
              </li>
            )}
          </ul>

          {plan.newCourses.length > 0 && (
            <details>
              <summary className="min-h-11 cursor-pointer py-2 font-medium">
                New courses
              </summary>
              <ul className="list-inside list-disc text-muted">
                {plan.newCourses.map((c) => (
                  <li key={c.snId}>
                    {c.name}:{" "}
                    {plan.newTees
                      .filter((t) => t.snCourseId === c.snId)
                      .map((t) => `${t.name} (${t.course_rating ?? "–"} / ${t.slope ?? "–"})`)
                      .join(", ")}
                  </li>
                ))}
              </ul>
            </details>
          )}

          <div
            className={`rounded-lg p-3 ${mismatched.length ? "bg-down/10" : "bg-up/10"}`}
          >
            {mismatched.length === 0 ? (
              <p>
                ✓ All {plan.rounds.length} rounds match ServiceNow&apos;s gross,
                net and points
                {plan.statsRounds > 0 && ", and fairway, green and scrambling %"}.
              </p>
            ) : (
              <>
                <p className="mb-1 font-medium">
                  {mismatched.length} rounds work out differently here:
                </p>
                <ul className="list-inside list-disc">
                  {mismatched.map((r) => (
                    <li key={r.snId}>
                      {r.played_on} {r.courseName}: {r.check}
                    </li>
                  ))}
                </ul>
              </>
            )}
            {plan.girKept > 0 && (
              <p className="mt-1 text-muted">
                GIR kept as you entered it on {plan.girKept} hole
                {plan.girKept === 1 ? "" : "s"} where it differs from score and
                putts.
              </p>
            )}
          </div>

          {plan.possibleDuplicates.length > 0 && (
            <div className="rounded-lg bg-surface p-3">
              <p className="mb-1 font-medium">
                Skipped: you already entered a round on the same day on the same
                tees
              </p>
              <ul className="list-inside list-disc text-muted">
                {plan.possibleDuplicates.map((r) => (
                  <li key={r.snId}>
                    {r.played_on} {r.courseName} {r.teeName}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {plan.problems.length > 0 && (
            <div className="rounded-lg bg-down/10 p-3">
              <p className="mb-1 font-medium">Can&apos;t be imported:</p>
              <ul className="list-inside list-disc">
                {plan.problems.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </div>
          )}

          {progress && <p className="font-medium">{progress}…</p>}
          <div className="flex">
            <button
              type="button"
              onClick={run}
              disabled={busy || plan.rounds.length === 0}
              className={primaryClass}
            >
              {busy
                ? "Importing…"
                : plan.rounds.length
                  ? `Import ${plan.rounds.length} rounds`
                  : "Nothing new to import"}
            </button>
          </div>
        </section>
      )}
    </main>
  );
}
