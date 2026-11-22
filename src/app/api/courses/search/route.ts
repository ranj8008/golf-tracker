import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import type { LookupCourse, LookupTee } from "@/lib/lookup";

// Course lookup, via GolfCourseAPI (golfcourseapi.com). Runs on the server so the
// API key (GOLF_COURSE_API_KEY) never reaches the phone, and only answers someone
// signed in to this site, so it can't be used by anyone else.
//
// Returns courses in our own shape, with each set of tees' rating, slope and holes.

type ApiHole = { par?: number; yardage?: number; handicap?: number };
type ApiTee = {
  tee_name?: string;
  course_rating?: number;
  slope_rating?: number;
  holes?: ApiHole[];
};
type ApiCourse = {
  id: number;
  club_name?: string;
  course_name?: string;
  location?: { city?: string; state?: string; country?: string };
  tees?: { male?: ApiTee[]; female?: ApiTee[] };
};

const API = "https://api.golfcourseapi.com/v1";

function toTee(t: ApiTee, gender: LookupTee["gender"]): LookupTee {
  const holes = t.holes ?? [];
  return {
    name: t.tee_name?.trim() || "Tees",
    gender,
    courseRating: t.course_rating ?? null,
    slope: t.slope_rating ?? null,
    par: holes.map((h) => h.par ?? 4),
    yards: holes.map((h) => h.yardage ?? 0),
    strokeIndex: holes.map((h, i) => h.handicap ?? i + 1),
  };
}

function toCourse(c: ApiCourse): LookupCourse {
  const club = c.club_name?.trim() ?? "";
  const course = c.course_name?.trim() ?? "";
  const name =
    club && course && !club.toLowerCase().includes(course.toLowerCase())
      ? `${club} – ${course}`
      : club || course || "Unnamed course";
  const loc = c.location;
  return {
    id: c.id,
    name,
    location:
      [loc?.city, loc?.state, loc?.country].filter(Boolean).join(", ") || null,
    tees: [
      ...(c.tees?.male ?? []).map((t) => toTee(t, "men")),
      ...(c.tees?.female ?? []).map((t) => toTee(t, "women")),
    ],
  };
}

export async function GET(req: Request) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!token || !url || !key)
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const { error: authError } = await createClient(url, key, {
    auth: { persistSession: false },
  }).auth.getUser(token);
  if (authError)
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const apiKey = process.env.GOLF_COURSE_API_KEY;
  if (!apiKey)
    return NextResponse.json(
      {
        error:
          "Course lookup isn't set up yet: add GOLF_COURSE_API_KEY in Vercel's environment variables.",
      },
      { status: 503 },
    );

  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 3)
    return NextResponse.json({ error: "Type at least 3 letters." }, { status: 400 });

  const res = await fetch(
    `${API}/search?search_query=${encodeURIComponent(q)}`,
    { headers: { Authorization: `Key ${apiKey}` }, cache: "no-store" },
  ).catch(() => null);
  if (!res || !res.ok)
    return NextResponse.json(
      {
        error:
          res?.status === 401
            ? "The course database didn't accept the API key."
            : res?.status === 429
              ? "Too many lookups today. Try again tomorrow."
              : "Couldn't reach the course database. Try again later.",
      },
      { status: 502 },
    );
  const body = (await res.json()) as { courses?: ApiCourse[] };
  return NextResponse.json({ courses: (body.courses ?? []).map(toCourse) });
}
