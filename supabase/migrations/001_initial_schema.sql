-- Onset — initial schema
-- Run this in the Supabase SQL editor or via `supabase db push`

-- ── Tables ────────────────────────────────────────────────────

-- Profiles (one row per auth user, auto-created via trigger)
create table if not exists public.profiles (
  id         uuid references auth.users on delete cascade primary key,
  email      text,
  created_at timestamptz default now() not null
);

-- Progress (XP, streaks, lesson completion — one row per user)
create table if not exists public.progress (
  user_id              uuid references auth.users on delete cascade primary key,
  total_xp             integer    default 0   not null,
  lessons_completed    integer    default 0   not null,
  current_streak       integer    default 0   not null,
  best_streak          integer    default 0   not null,
  last_practice_date   text,
  total_practice_ms    bigint     default 0   not null,
  completed_lesson_ids jsonb      default '[]'::jsonb not null,
  category_scores      jsonb      default '{}'::jsonb not null,
  updated_at           timestamptz default now() not null
);

-- Hot cues (one row per user × track name)
create table if not exists public.hot_cues (
  id          uuid    default gen_random_uuid() primary key,
  user_id     uuid    references auth.users on delete cascade not null,
  track_name  text    not null,
  cue_points  jsonb   not null,
  updated_at  timestamptz default now() not null,
  unique(user_id, track_name)
);

-- Spaced repetition (SM-2 records, one JSON blob per user)
create table if not exists public.spaced_repetition (
  user_id    uuid  references auth.users on delete cascade primary key,
  records    jsonb default '{}'::jsonb not null,
  updated_at timestamptz default now() not null
);

-- ── Row Level Security ─────────────────────────────────────────

alter table public.profiles         enable row level security;
alter table public.progress         enable row level security;
alter table public.hot_cues         enable row level security;
alter table public.spaced_repetition enable row level security;

-- Profiles
create policy "profiles_select" on public.profiles for select using (auth.uid() = id);
create policy "profiles_insert" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles_update" on public.profiles for update using (auth.uid() = id);

-- Progress
create policy "progress_select" on public.progress for select using (auth.uid() = user_id);
create policy "progress_insert" on public.progress for insert with check (auth.uid() = user_id);
create policy "progress_update" on public.progress for update using (auth.uid() = user_id);

-- Hot cues
create policy "hot_cues_select" on public.hot_cues for select using (auth.uid() = user_id);
create policy "hot_cues_insert" on public.hot_cues for insert with check (auth.uid() = user_id);
create policy "hot_cues_update" on public.hot_cues for update using (auth.uid() = user_id);
create policy "hot_cues_delete" on public.hot_cues for delete using (auth.uid() = user_id);

-- Spaced repetition
create policy "sr_select" on public.spaced_repetition for select using (auth.uid() = user_id);
create policy "sr_insert" on public.spaced_repetition for insert with check (auth.uid() = user_id);
create policy "sr_update" on public.spaced_repetition for update using (auth.uid() = user_id);

-- ── Auto-create profile on signup ─────────────────────────────

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
