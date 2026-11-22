"use client";

import { useState } from "react";
import { inputClass, Problem, secondaryClass } from "@/components/Editing";
import { supabase } from "@/lib/supabase";
import type { LookupCourse, LookupTee } from "@/lib/lookup";

export type { LookupCourse, LookupTee };

// Search the course database (GolfCourseAPI, through our own /api/courses/search)
// and pick a course. The parent decides what to do with its tees.
export default function CourseLookup({
  initialQuery = "",
  onPick,
}: {
  initialQuery?: string;
  onPick: (c: LookupCourse) => void;
}) {
  const [q, setQ] = useState(initialQuery);
  const [results, setResults] = useState<LookupCourse[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // A button, not a form: this sits inside other forms.
  const search = async () => {
    setError(null);
    setBusy(true);
    try {
      const { data } = await supabase().auth.getSession();
      const res = await fetch(
        `/api/courses/search?q=${encodeURIComponent(q.trim())}`,
        {
          headers: { Authorization: `Bearer ${data.session?.access_token}` },
        },
      );
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Lookup failed.");
      setResults(body.courses);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input
          type="search"
          aria-label="Course name"
          placeholder="Course name, e.g. Lambourne"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (q.trim().length >= 3) search();
            }
          }}
          className={inputClass}
        />
        <button
          type="button"
          onClick={search}
          disabled={busy || q.trim().length < 3}
          className={secondaryClass}
        >
          {busy ? "Searching…" : "Search"}
        </button>
      </div>
      <Problem>{error}</Problem>
      {results?.length === 0 && (
        <p className="text-sm text-muted">No courses found by that name.</p>
      )}
      {results && results.length > 0 && (
        <ul className="overflow-hidden rounded-lg border border-line">
          {results.map((c) => (
            <li key={c.id} className="border-b border-line last:border-0">
              <button
                type="button"
                onClick={() => onPick(c)}
                className="flex min-h-12 w-full flex-col items-start px-3 py-2 text-left active:bg-surface"
              >
                <span className="font-medium">{c.name}</span>
                <span className="text-xs text-muted">
                  {[c.location, `${c.tees.length} sets of tees`]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export const teeLabel = (t: LookupTee) =>
  `${t.name} (${t.gender})${
    t.courseRating !== null
      ? ` · CR ${t.courseRating} / ${t.slope ?? "–"}`
      : ""
  }${t.par.length ? ` · par ${t.par.reduce((a, b) => a + b, 0)}` : ""}`;
