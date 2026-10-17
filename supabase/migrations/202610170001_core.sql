-- Stage 1 only. New projects: do NOT run the legacy SUPABASE_SETUP.sql.
begin;
do $$ begin
  if to_regclass('public.learning_progress') is not null then
    raise exception 'Legacy learning_progress exists: stop and plan its data migration first';
  end if;
end $$;

create schema sl_private;
revoke all on schema sl_private from public, anon, authenticated;
grant usage on schema public to authenticated;

create table public.sl_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '' check (length(display_name) <= 70),
  avatar_path text check (length(avatar_path) <= 180),
  language text not null default 'ru' check (language in ('ru','en','sv','uk')),
  sfi_level text not null default 'A' check (sfi_level in ('A','B','C','D')),
  speech_speed text not null default 'slow' check (speech_speed in ('verySlow','slow','normal')),
  timezone text not null default 'Europe/Stockholm' check (length(timezone) <= 100),
  xp bigint not null default 0 check (xp >= 0),
  answered bigint not null default 0 check (answered >= 0),
  correct bigint not null default 0 check (correct between 0 and answered),
  legacy_activity jsonb not null default '{}' check (jsonb_typeof(legacy_activity) = 'object'),
  revision bigint not null default 0 check (revision >= 0),
  deletion_requested_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.sl_words (
  user_id uuid not null references public.sl_accounts(user_id) on delete cascade,
  word_id text not null check (length(word_id) between 1 and 100),
  is_known boolean not null default false,
  is_favorite boolean not null default false,
  learned_at timestamptz,
  due_at timestamptz,
  interval_days integer not null default 0 check (interval_days between 0 and 365000),
  ease numeric not null default 2.5 check (ease between 1.3 and 3),
  repetitions integer not null default 0 check (repetitions between 0 and 100000),
  last_reviewed_at timestamptz,
  scheduler_version text not null default 'current-v1' check (scheduler_version = 'current-v1'),
  updated_at timestamptz not null default now(),
  primary key (user_id, word_id)
);
create index sl_words_due on public.sl_words(user_id, due_at) where due_at is not null;

create table public.sl_sessions (
  user_id uuid not null references public.sl_accounts(user_id) on delete cascade,
  id uuid not null,
  mode text not null check (mode in ('mixed','translation','fillBlank','weekdays','alphabet',
    'months','dialogues','readText','verbForms','articles','listening','sentences',
    'writeWord','fixMistake','lesson','book','topic','review','video')),
  context_id text check (length(context_id) <= 150),
  content_version text not null check (length(content_version) between 1 and 100),
  questions jsonb not null check (jsonb_typeof(questions) = 'array' and jsonb_array_length(questions) between 1 and 200),
  answered integer not null default 0,
  correct integer not null default 0,
  status text not null default 'active' check (status in ('active','completed','abandoned')),
  started_at timestamptz not null,
  finished_at timestamptz,
  primary key (user_id, id),
  check (answered between 0 and jsonb_array_length(questions)),
  check (correct between 0 and answered),
  check ((status = 'active' and finished_at is null) or (status <> 'active' and finished_at is not null))
);
create index sl_sessions_recent on public.sl_sessions(user_id, started_at desc);

create table public.sl_lessons (
  user_id uuid not null references public.sl_accounts(user_id) on delete cascade,
  lesson_id text not null check (length(lesson_id) between 1 and 100),
  completed boolean not null default false,
  completed_at timestamptz,
  best_percent numeric check (best_percent between 0 and 100),
  last_session_id uuid,
  updated_at timestamptz not null default now(),
  primary key (user_id, lesson_id),
  foreign key (user_id, last_session_id) references public.sl_sessions(user_id, id)
);

create table public.sl_content (
  user_id uuid not null references public.sl_accounts(user_id) on delete cascade,
  content_type text not null check (content_type in ('book','video')),
  content_id text not null check (length(content_id) between 1 and 100),
  is_completed boolean not null default false,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, content_type, content_id)
);

create table public.sl_events (
  user_id uuid not null references public.sl_accounts(user_id) on delete cascade,
  event_id uuid not null,
  request jsonb not null check (jsonb_typeof(request) = 'object' and octet_length(request::text) <= 65536),
  event_type text not null check (event_type in ('session_start','answer','session_finish','session_abandon',
    'mark_known','mark_review','flash_grade','favorite_set','book_read','video_set','profile_update','settings_update')),
  session_id uuid,
  question_index integer check (question_index between 0 and 199),
  occurred_at timestamptz not null,
  received_at timestamptz not null default now(),
  activity_date date not null,
  timezone text not null,
  xp_delta integer not null check (xp_delta >= 0),
  activity_delta integer not null check (activity_delta between 0 and 1),
  answered_delta integer not null check (answered_delta between 0 and 1),
  correct_delta integer not null check (correct_delta between 0 and answered_delta),
  revision bigint not null,
  rules_version text not null default 'current-v1' check (rules_version = 'current-v1'),
  primary key (user_id, event_id),
  foreign key (user_id, session_id) references public.sl_sessions(user_id, id),
  check ((event_type = 'answer') = (question_index is not null)),
  check (event_type <> 'answer' or session_id is not null)
);
create unique index sl_events_one_answer on public.sl_events(user_id, session_id, question_index)
  where event_type = 'answer';
create index sl_events_activity on public.sl_events(user_id, activity_date);
create index sl_events_revision on public.sl_events(user_id, revision);

create table public.sl_imports (
  user_id uuid not null references public.sl_accounts(user_id) on delete cascade,
  import_id uuid not null,
  source_id uuid not null,
  snapshot_hash text not null,
  snapshot jsonb not null check (jsonb_typeof(snapshot) = 'object' and octet_length(snapshot::text) <= 2097152),
  mode text not null check (mode in ('empty_only','independent','archive_only')),
  applied_revision bigint not null,
  created_at timestamptz not null default now(),
  primary key (user_id, import_id),
  unique (user_id, source_id),
  unique (user_id, snapshot_hash)
);

-- Default grants vary between Supabase projects. Set them explicitly per table.
do $$ declare t text; begin
  foreach t in array array['sl_accounts','sl_words','sl_sessions','sl_lessons','sl_content','sl_events','sl_imports'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from public, anon, authenticated', t);
    execute format('grant select on public.%I to authenticated', t);
    execute format('create policy own_read on public.%I for select to authenticated using ((select auth.uid()) = user_id)', t);
  end loop;
end $$;

-- Helpers are reachable only from the reviewed SECURITY DEFINER entry points.
create function sl_private.lock_account() returns public.sl_accounts
language plpgsql security invoker set search_path = '' as $$
declare u uuid := auth.uid(); a public.sl_accounts;
begin
  if u is null then raise exception 'authentication_required' using errcode = '28000'; end if;
  insert into public.sl_accounts(user_id) values (u) on conflict do nothing;
  select * into strict a from public.sl_accounts where user_id = u for update;
  if a.deletion_requested_at is not null then raise exception 'account_deletion_pending'; end if;
  return a;
end $$;

create function sl_private.check_keys(value jsonb, allowed text[]) returns void
language plpgsql immutable security invoker set search_path = '' as $$
begin
  if jsonb_typeof(value) is distinct from 'object' or exists (
    select 1 from jsonb_object_keys(value) k where not (k = any(allowed))
  ) then raise exception 'invalid_object_keys' using errcode = '22023'; end if;
end $$;

create function sl_private.check_timezone(value text) returns void
language plpgsql stable security invoker set search_path = '' as $$
begin
  if value is null or not exists (select 1 from pg_catalog.pg_timezone_names where name = value)
    then raise exception 'invalid_timezone' using errcode = '22023'; end if;
end $$;

revoke all on all functions in schema sl_private from public, anon, authenticated;
commit;
