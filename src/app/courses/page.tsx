"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import TeeEditor from "@/components/TeeEditor";
import {
  cardClass,
  dangerClass,
  inputClass,
  labelClass,
  PageTitle,
  primaryClass,
  Problem,
  secondaryClass,
  Sheet,
} from "@/components/Editing";
import {
  addCourse,
  deleteCourse,
  loadCourses,
  problem,
  renameCourse,
  type Course,
  type Tee,
} from "@/lib/data";

type Editing =
  | { kind: "tee"; course: Course; tee?: Tee }
  | { kind: "course"; course: Course }
  | { kind: "add" };

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

export default function CoursesPage() {
  const [courses, setCourses] = useState<Course[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Editing | null>(null);

  const reload = useCallback(() => {
    loadCourses()
      .then(setCourses)
      .catch((e) => setError(problem(e)));
  }, []);
  useEffect(reload, [reload]);

  const done = () => {
    setEditing(null);
    reload();
  };

  return (
    <main className="mx-auto max-w-2xl px-4 py-6">
      <PageTitle
        action={
          <button
            type="button"
            onClick={() => setEditing({ kind: "add" })}
            className="flex min-h-11 items-center rounded-lg bg-accent px-4 text-sm font-semibold text-on-accent"
          >
            Add a course
          </button>
        }
      >
        Courses
      </PageTitle>
      <Problem>{error}</Problem>
      {courses?.length === 0 && (
        <p className={`${cardClass} p-4 text-sm text-muted`}>
          No courses yet. Add the one you play.
        </p>
      )}

      <div className="space-y-4">
        {courses?.map((c) => (
          <section key={c.id} className={cardClass}>
            <div className="flex items-center justify-between gap-2 border-b border-line px-3 py-2">
              <div className="min-w-0">
                <h2 className="truncate font-bold">{c.name}</h2>
                {c.location && (
                  <p className="truncate text-xs text-muted">{c.location}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setEditing({ kind: "course", course: c })}
                className="min-h-11 shrink-0 px-2 text-sm font-medium text-accent"
              >
                Edit
              </button>
            </div>
            <ul>
              {c.tees.map((t) => (
                <li key={t.id} className="border-b border-line last:border-0">
                  <button
                    type="button"
                    onClick={() =>
                      setEditing({ kind: "tee", course: c, tee: t })
                    }
                    className="flex min-h-14 w-full items-center gap-3 px-3 py-2 text-left active:bg-surface"
                  >
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="font-medium">{t.name} tees</span>
                      <span className="text-xs text-muted tabular-nums">
                        Par {sum(t.par)} · {sum(t.yards).toLocaleString("en-GB")}{" "}
                        yds · {t.par.length} holes
                      </span>
                    </span>
                    <span className="shrink-0 text-right text-xs tabular-nums">
                      {t.course_rating !== null || t.slope !== null ? (
                        <>
                          <span className="block">
                            Rating {t.course_rating ?? "–"}
                          </span>
                          <span className="block text-muted">
                            Slope {t.slope ?? "–"}
                          </span>
                        </>
                      ) : (
                        <span className="rounded bg-accent-soft px-1.5 py-0.5 font-medium text-on-accent-soft">
                          Add rating and slope
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              ))}
              <li>
                <button
                  type="button"
                  onClick={() => setEditing({ kind: "tee", course: c })}
                  className="min-h-11 w-full px-3 text-left text-sm font-medium text-accent"
                >
                  + Add tees
                </button>
              </li>
            </ul>
          </section>
        ))}
      </div>

      <p className="mt-8 text-center text-xs text-muted">
        <Link href="/import" className="inline-flex min-h-11 items-center underline">
          Import rounds from ServiceNow
        </Link>
      </p>

      {editing?.kind === "tee" && (
        <TeeEditor
          courseId={editing.course.id}
          courseName={editing.course.name}
          tee={editing.tee}
          onClose={() => setEditing(null)}
          onSaved={done}
        />
      )}
      {editing?.kind === "course" && (
        <CourseSheet
          course={editing.course}
          onClose={() => setEditing(null)}
          onSaved={done}
        />
      )}
      {editing?.kind === "add" && (
        <AddCourse
          onClose={() => setEditing(null)}
          onAdded={(course) => {
            reload();
            setEditing({ kind: "tee", course });
          }}
        />
      )}
    </main>
  );
}

function CourseSheet({
  course,
  onClose,
  onSaved,
}: {
  course: Course;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(course.name);
  const [error, setError] = useState<string | null>(null);
  const [sure, setSure] = useState(false);
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await renameCourse(course.id, name.trim());
      onSaved();
    } catch (err) {
      setError(problem(err));
    }
  };
  const remove = async () => {
    if (!sure) return setSure(true);
    try {
      await deleteCourse(course.id);
      onSaved();
    } catch (err) {
      setError(problem(err));
    }
  };
  return (
    <Sheet title="Edit course" onClose={onClose}>
      <form onSubmit={save} className="space-y-3">
        <label className="block">
          <span className={labelClass}>Name</span>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
          />
        </label>
        <Problem>{error}</Problem>
        <div className="flex gap-2">
          <button type="button" onClick={onClose} className={secondaryClass}>
            Cancel
          </button>
          <button type="submit" className={primaryClass}>
            Save
          </button>
        </div>
        <div className="text-center">
          <button type="button" onClick={remove} className={dangerClass}>
            {sure
              ? "Tap again to delete the course and its tees"
              : "Delete course"}
          </button>
        </div>
      </form>
    </Sheet>
  );
}

// Add a course by name, then straight on to its first tees.
function AddCourse({
  onClose,
  onAdded,
}: {
  onClose: () => void;
  onAdded: (course: Course) => void;
}) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const id = await addCourse(name.trim());
      onAdded({ id, name: name.trim(), location: null, tees: [] });
    } catch (err) {
      setError(problem(err));
      setBusy(false);
    }
  };

  return (
    <Sheet title="Add a course" onClose={onClose}>
      <form onSubmit={add} className="space-y-3">
        <label className="block">
          <span className={labelClass}>Course name</span>
          <input
            required
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
          />
        </label>
        <p className="text-sm text-muted">
          Next you&apos;ll add its tees from the scorecard.
        </p>
        <Problem>{error}</Problem>
        <div className="flex gap-2">
          <button type="button" onClick={onClose} className={secondaryClass}>
            Cancel
          </button>
          <button type="submit" disabled={busy} className={primaryClass}>
            Next
          </button>
        </div>
      </form>
    </Sheet>
  );
}
