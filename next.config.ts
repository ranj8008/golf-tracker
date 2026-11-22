import type { NextConfig } from "next";

// Hosted on Vercel. Pages run in the browser and read Supabase directly (row-level
// security keeps the data private); the only server code is the course lookup in
// src/app/api, which keeps the GolfCourseAPI key off the phone.
const nextConfig: NextConfig = {};

export default nextConfig;
