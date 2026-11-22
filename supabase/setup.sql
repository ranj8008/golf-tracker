-- Golf tracker database setup. Run by the "Set up Supabase" GitHub Action (or paste
-- into Supabase's SQL editor). Safe to run again: it only creates what's missing and
-- resets its own rules.
--
-- Everything is private to the login that created it: every table has row-level
-- security, and each row belongs to user_id (the signed-in user, filled in
-- automatically). Nobody else, signed in or not, can read or change it.
--
-- What you enter is stored; everything else (net, Stableford points, GIR,
-- scrambling, birdies…) is worked out by the app.

-- Courses ------------------------------------------------------------------------
create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (length(trim(name)) > 0), -- "Lambourne Golf Club"
  location text,
  api_id bigint, -- GolfCourseAPI course id, when imported from there
  created_at timestamptz not null default now()
);
alter table public.courses enable row level security;
create index if not exists courses_user on public.courses (user_id);

-- Tees: one per set of tees on a course, holding each hole's par, yards and stroke
-- index (9 or 18 of each, in hole order). Rating and slope are optional.
create table if not exists public.tees (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  name text not null check (length(trim(name)) > 0), -- "Orange"
  course_rating numeric(4, 1) check (course_rating between 50 and 90),
  slope int check (slope between 55 and 155),
  par int[] not null,
  yards int[] not null,
  stroke_index int[] not null,
  created_at timestamptz not null default now(),
  check (cardinality(par) in (9, 18)),
  check (cardinality(yards) = cardinality(par)),
  check (cardinality(stroke_index) = cardinality(par)),
  check (3 <= all (par) and 6 >= all (par)),
  unique (course_id, name)
);
alter table public.tees enable row level security;

-- Rounds ----------------------------------------------------------------------------
create table if not exists public.rounds (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete restrict,
  tee_id uuid not null references public.tees (id) on delete restrict,
  played_on date not null,
  handicap_index numeric(3, 1) check (handicap_index between -10 and 54),
  playing_handicap int not null check (playing_handicap between -10 and 60),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.rounds enable row level security;
create index if not exists rounds_user_date on public.rounds (user_id, played_on desc);

-- One row per hole played. score is null when picked up (no score: 0 points).
create table if not exists public.hole_scores (
  round_id uuid not null references public.rounds (id) on delete cascade,
  hole int not null check (hole between 1 and 18),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  score int check (score between 1 and 20),
  putts int check (putts between 0 and 10),
  fairway text check (fairway in ('hit', 'left', 'right', 'short')), -- par 4s and 5s
  penalties int check (penalties between 0 and 10),
  bunker boolean not null default false, -- in a greenside bunker
  chips int check (chips between 0 and 10), -- chips and pitches around the green
  primary key (round_id, hole),
  check (putts is null or score is null or putts < score)
);
alter table public.hole_scores enable row level security;

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists touch_updated_at on public.rounds;
create trigger touch_updated_at before update on public.rounds
  for each row execute function public.touch_updated_at();

-- Rules: each login sees and changes only its own rows -----------------------------
do $$
declare t text;
begin
  foreach t in array array['courses', 'tees', 'rounds', 'hole_scores'] loop
    execute format('drop policy if exists "Own rows" on public.%I', t);
    execute format(
      'create policy "Own rows" on public.%I for all to authenticated '
      'using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;

-- A round's tees must be on its course, and child rows must belong to the same login
-- as their parent (so nobody can hang rows off someone else's course or round).
create or replace function public.check_round()
returns trigger language plpgsql as $$
begin
  if not exists (
    select 1 from public.tees
    where id = new.tee_id and course_id = new.course_id and user_id = new.user_id
  ) then
    raise exception 'Those tees aren''t on that course.';
  end if;
  return new;
end;
$$;
drop trigger if exists check_round on public.rounds;
create trigger check_round before insert or update on public.rounds
  for each row execute function public.check_round();

create or replace function public.check_tee_owner()
returns trigger language plpgsql as $$
begin
  if not exists (
    select 1 from public.courses where id = new.course_id and user_id = new.user_id
  ) then
    raise exception 'Not your course.';
  end if;
  return new;
end;
$$;
drop trigger if exists check_owner on public.tees;
create trigger check_owner before insert or update on public.tees
  for each row execute function public.check_tee_owner();

create or replace function public.check_hole_owner()
returns trigger language plpgsql as $$
begin
  if not exists (
    select 1 from public.rounds where id = new.round_id and user_id = new.user_id
  ) then
    raise exception 'Not your round.';
  end if;
  return new;
end;
$$;
drop trigger if exists check_owner on public.hole_scores;
create trigger check_owner before insert or update on public.hole_scores
  for each row execute function public.check_hole_owner();

-- Saves a round and all its holes in one go (all or nothing). Without an id it adds
-- a new round; with one it replaces that round's details and holes. Runs with the
-- caller's own rights, so the rules above still apply.
create or replace function public.save_round(p_round jsonb, p_holes jsonb)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  rid uuid := nullif(p_round ->> 'id', '')::uuid;
begin
  if rid is null then
    insert into public.rounds (course_id, tee_id, played_on, handicap_index, playing_handicap, notes)
    values (
      (p_round ->> 'course_id')::uuid,
      (p_round ->> 'tee_id')::uuid,
      (p_round ->> 'played_on')::date,
      (p_round ->> 'handicap_index')::numeric,
      (p_round ->> 'playing_handicap')::int,
      nullif(trim(p_round ->> 'notes'), '')
    )
    returning id into rid;
  else
    update public.rounds set
      course_id = (p_round ->> 'course_id')::uuid,
      tee_id = (p_round ->> 'tee_id')::uuid,
      played_on = (p_round ->> 'played_on')::date,
      handicap_index = (p_round ->> 'handicap_index')::numeric,
      playing_handicap = (p_round ->> 'playing_handicap')::int,
      notes = nullif(trim(p_round ->> 'notes'), '')
    where id = rid;
    if not found then
      raise exception 'That round wasn''t found.';
    end if;
  end if;
  delete from public.hole_scores where round_id = rid;
  insert into public.hole_scores (round_id, hole, score, putts, fairway, penalties, bunker, chips)
    select rid, h.hole, h.score, h.putts, h.fairway, h.penalties, coalesce(h.bunker, false), h.chips
    from jsonb_to_recordset(p_holes)
      as h(hole int, score int, putts int, fairway text, penalties int, bunker boolean, chips int);
  return rid;
end;
$$;
revoke all on function public.save_round(jsonb, jsonb) from public, anon;
grant execute on function public.save_round(jsonb, jsonb) to authenticated;

-- Starting course: Lambourne Golf Club, Orange tees (from the club scorecard), for
-- every login that doesn't have it yet. Create your login before running this; if
-- you ran it first, just run it again.
do $$
declare
  u record;
  c uuid;
begin
  for u in select id from auth.users loop
    select id into c from public.courses
      where user_id = u.id and name = 'Lambourne Golf Club';
    if c is null then
      insert into public.courses (user_id, name, location)
        values (u.id, 'Lambourne Golf Club', null)
        returning id into c;
    end if;
    insert into public.tees (user_id, course_id, name, par, yards, stroke_index)
      values (
        u.id, c, 'Orange',
        array[4,5,4,5,3,4,3,4,4, 4,4,5,3,5,4,4,3,4],
        array[406,489,400,507,185,440,147,448,316, 384,425,516,169,517,363,339,138,386],
        array[7,13,5,11,9,1,17,3,15, 6,2,16,10,14,12,4,18,8]
      )
      on conflict (course_id, name) do nothing;
  end loop;
end $$;

-- Make the site's API see the changes straight away.
notify pgrst, 'reload schema';
