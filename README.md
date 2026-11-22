# Golf tracker

A private golf score tracker: courses and tees, rounds entered after playing, and
each round shown as a scorecard. Next.js on Vercel, data in Supabase. Built for
phones, in the same style as Shankaholics, with blue as the main colour and light
and dark mode following the phone's setting.

## What's stored and what's worked out

Stored (`supabase/setup.sql`):

- **Courses** → **tees**: each hole's par, yards and stroke index, plus course
  rating and slope
- **Rounds**: course, tees, date, handicap index and playing handicap (typed in)
- **Hole scores**: score, putts, fairway (hit / left / right / short, on par 4s and
  5s), penalty strokes, greenside bunker, chips

Worked out (`src/lib/golf.ts`, never stored): handicap strokes per hole, net,
Stableford points, fairways hit, greens in regulation (score − putts ≤ par − 2),
scrambling (par or better after missing the green), eagles, birdies, pars, bogeys,
one-putts and three-putts. `npm test` checks these against a real Lambourne
scorecard.

## Privacy

Everything is behind email and password sign-in, and every table has row-level
security: each row belongs to the login that created it, and nobody else can read
or change it, signed in or not. Turn off new sign-ups in Supabase (step 1) so
yours is the only login.

## Setting it up (all doable from a phone)

1. **Supabase**: create a project at supabase.com. Then:
   - Authentication → Users → Add user → Create new user: your email and a
     password, with **Auto Confirm User** ticked.
   - Authentication → Sign In / Providers: turn off **Allow new users to sign up**.
2. **Database**: in this GitHub repo, Settings → Secrets and variables → Actions →
   New repository secret, named `SUPABASE_DB_URL`. Its value is Supabase's
   Connect → **Session pooler** connection string, with your database password in
   place of `[YOUR-PASSWORD]` (no brackets). Then Actions → **Set up Supabase** →
   Run workflow. It creates the tables and rules, and adds Lambourne Golf Club's
   Orange tees to your login. Run it again whenever `setup.sql` changes; it's safe
   to re-run.
3. **Course lookup** (optional, for rating and slope): get a free API key at
   golfcourseapi.com.
4. **Vercel**: import this repo, and add these environment variables before
   deploying:
   - `NEXT_PUBLIC_SUPABASE_URL`: Supabase → Project Settings → API → Project URL
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: the publishable key on the same page
   - `GOLF_COURSE_API_KEY`: the key from step 3

   If you add or change a variable later, redeploy for it to take effect.

## Running it locally

`npm install`, copy `.env.example` to `.env.local` and fill it in, then
`npm run dev`.

## Phases

1. ✅ Setup, sign-in, courses and tees, entering a round, a round's scorecard
2. My rounds: the full list, sorting, editing (editing a round is already there)
3. Stats
4. Honours board: best round, most birdies, fewest putts…
