-- Svenska Lätt: each user can only view and edit their own progress.
-- Run this in Supabase Dashboard > SQL Editor > New query > Run.
-- Never put a secret/service_role key in frontend files.
create table if not exists public.learning_progress (
  user_id uuid primary key references auth.users (id) on delete cascade,
  state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.learning_progress enable row level security;
revoke all on public.learning_progress from anon;
grant usage on schema public to authenticated;
grant select, insert, update on public.learning_progress to authenticated;

drop policy if exists "Users can view own progress" on public.learning_progress;
create policy "Users can view own progress"
 on public.learning_progress for select to authenticated
 using ((select auth.uid()) = user_id);

drop policy if exists "Users can create own progress" on public.learning_progress;
create policy "Users can create own progress"
 on public.learning_progress for insert to authenticated
 with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update own progress" on public.learning_progress;
create policy "Users can update own progress"
 on public.learning_progress for update to authenticated
 using ((select auth.uid()) = user_id)
 with check ((select auth.uid()) = user_id);
