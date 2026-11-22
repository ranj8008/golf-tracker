"use client";

import { supabase } from "./supabase";
import type { HoleEntry, TeeHoles } from "./golf";

export type Tee = {
  id: string;
  course_id: string;
  name: string;
  course_rating: number | null;
  slope: number | null;
  par: number[];
  yards: number[];
  stroke_index: number[];
};

export type Course = {
  id: string;
  name: string;
  location: string | null;
  tees: Tee[];
};

export type HoleRow = {
  hole: number;
  score: number | null;
  putts: number | null;
  fir: boolean | null;
  gir: boolean | null; // null: worked out from score and putts
  penalties: number | null;
};

export type Round = {
  id: string;
  course_id: string;
  tee_id: string;
  played_on: string; // yyyy-mm-dd
  handicap_index: number | null;
  playing_handicap: number;
  notes: string | null;
  pcc: number;
  created_at: string;
  course: { name: string };
  tee: Tee;
  hole_scores: HoleRow[];
};

export const teeHoles = (t: Tee): TeeHoles => ({
  par: t.par,
  yards: t.yards,
  strokeIndex: t.stroke_index,
});

// Hole rows in hole order, with blanks for any hole not saved.
export function entriesFor(round: Round): HoleEntry[] {
  const byHole = new Map(round.hole_scores.map((h) => [h.hole, h]));
  return round.tee.par.map((_, i) => {
    const h = byHole.get(i + 1);
    return {
      score: h?.score ?? null,
      putts: h?.putts ?? null,
      fir: h?.fir ?? null,
      gir: h?.gir ?? null,
      penalties: h?.penalties ?? null,
    };
  });
}

// Supabase returns numeric columns as strings.
const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));
const fixTee = (t: Tee): Tee => ({
  ...t,
  course_rating: num(t.course_rating),
});
const fixRound = (r: Round): Round => ({
  ...r,
  handicap_index: num(r.handicap_index),
  tee: fixTee(r.tee),
});

export async function loadCourses(): Promise<Course[]> {
  const { data, error } = await supabase()
    .from("courses")
    .select("id, name, location, tees(*)")
    .order("name");
  if (error) throw error;
  return (data as Course[]).map((c) => ({
    ...c,
    tees: c.tees.map(fixTee).sort((a, b) => a.name.localeCompare(b.name)),
  }));
}

const roundSelect = "*, course:courses(name), tee:tees(*), hole_scores(*)";

export async function loadRound(id: string): Promise<Round | null> {
  const { data, error } = await supabase()
    .from("rounds")
    .select(roundSelect)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? fixRound(data as Round) : null;
}

export async function loadRounds(limit?: number): Promise<Round[]> {
  let q = supabase()
    .from("rounds")
    .select(roundSelect)
    .order("played_on", { ascending: false })
    .order("created_at", { ascending: false });
  if (limit) q = q.limit(limit);
  const { data, error } = await q;
  if (error) throw error;
  return (data as Round[]).map(fixRound);
}

// Every round, kept for the session so moving between rounds is instant. Cleared
// whenever a round is saved or deleted.
let allRounds: Promise<Round[]> | null = null;
export function loadAllRounds(): Promise<Round[]> {
  allRounds ??= loadRounds().catch((e) => {
    allRounds = null;
    throw e;
  });
  return allRounds;
}
export const forgetRounds = () => {
  allRounds = null;
};

export type RoundInput = {
  id?: string;
  course_id: string;
  tee_id: string;
  played_on: string;
  handicap_index: number | null;
  playing_handicap: number;
  notes: string | null;
};

// The round and its holes are saved together, all or nothing (save_round in
// supabase/setup.sql).
export async function saveRound(
  round: RoundInput,
  holes: HoleEntry[],
): Promise<string> {
  const { data, error } = await supabase().rpc("save_round", {
    p_round: round,
    p_holes: holes.map((h, i) => ({ hole: i + 1, ...h })),
  });
  forgetRounds();
  if (error) throw error;
  return data as string;
}

export async function deleteRound(id: string) {
  const { error } = await supabase().from("rounds").delete().eq("id", id);
  forgetRounds();
  if (error) throw error;
}

export type TeeInput = Omit<Tee, "id"> & { id?: string };

export async function saveTee(tee: TeeInput): Promise<Tee> {
  const { data, error } = await supabase()
    .from("tees")
    .upsert(tee)
    .select()
    .single();
  if (error) throw error;
  return fixTee(data as Tee);
}

export async function deleteTee(id: string) {
  const { error } = await supabase().from("tees").delete().eq("id", id);
  if (error) throw error;
}

export async function addCourse(name: string): Promise<string> {
  const { data, error } = await supabase()
    .from("courses")
    .insert({ name })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

export async function renameCourse(id: string, name: string) {
  const { error } = await supabase()
    .from("courses")
    .update({ name })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteCourse(id: string) {
  const { error } = await supabase().from("courses").delete().eq("id", id);
  if (error) throw error;
}

// Plain-English versions of database errors.
export function problem(e: unknown): string {
  const err = e as { code?: string; message?: string };
  if (err?.code === "23503")
    return "It has rounds saved against it, so it can't be deleted.";
  if (err?.code === "23505") return "There's already one with that name.";
  if (err?.message?.includes("Failed to fetch"))
    return "Couldn't reach the database. Check your connection and try again.";
  return err?.message ?? "Something went wrong.";
}

// "Sun 15 Nov 2026"
export function formatDate(d: string, year = true) {
  return new Date(`${d}T12:00:00`).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    ...(year ? { year: "numeric" } : {}),
  });
}

export const today = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};
