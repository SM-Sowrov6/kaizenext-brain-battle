-- ════════════════════════════════════════════════════════════════
--  Kaizenext Brain Battle — initial schema
--  Security model:
--    • Participants never touch tables directly. Every participant
--      action goes through the `quiz-api` Edge Function, which uses
--      the service-role key server-side.
--    • Admins sign in with Supabase Auth and are authorised by the
--      `admin_users` table + `is_admin()` in RLS policies.
--    • `anon` has NO table access at all → answer keys are never
--      reachable from the browser.
-- ════════════════════════════════════════════════════════════════

create extension if not exists pgcrypto;

-- ── Admins ─────────────────────────────────────────────────────
create table public.admin_users (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  email      text not null,
  created_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.admin_users where user_id = auth.uid());
$$;

-- ── Quizzes ────────────────────────────────────────────────────
create table public.quizzes (
  id                 uuid primary key default gen_random_uuid(),
  title              text not null default 'Brain Battle',
  duration_seconds   integer not null default 300 check (duration_seconds between 30 and 7200),
  question_count     integer not null default 10 check (question_count between 1 and 200),
  marks_per_question numeric(6,2) not null default 1 check (marks_per_question > 0),
  negative_marking   boolean not null default false,
  negative_mark      numeric(6,2) not null default 0.25 check (negative_mark >= 0),
  shuffle_questions  boolean not null default true,
  shuffle_options    boolean not null default true,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- ── Event settings (singleton row, id = 1) ─────────────────────
create table public.event_settings (
  id                   smallint primary key default 1 check (id = 1),
  event_name           text not null default 'DIU Job Utsob 2026',
  venue                text not null default 'Daffodil International University',
  day1_date            date not null default '2026-11-28',
  day2_date            date not null default '2026-11-29',
  active_day           smallint not null default 1 check (active_day in (1, 2)),
  quiz_enabled         boolean not null default true,
  registration_enabled boolean not null default true,
  active_quiz_id       uuid references public.quizzes (id) on delete set null,
  competition_info     text not null default '',
  rules                jsonb not null default '[]'::jsonb,
  prizes               jsonb not null default '[]'::jsonb,
  default_theme        text not null default 'midnight' check (default_theme in ('midnight', 'kaizenext', 'uttirno')),
  updated_at           timestamptz not null default now()
);

-- ── Questions & options ────────────────────────────────────────
create table public.questions (
  id          uuid primary key default gen_random_uuid(),
  quiz_id     uuid not null references public.quizzes (id) on delete cascade,
  prompt      text not null check (char_length(prompt) between 3 and 1000),
  marks       numeric(6,2) not null default 1 check (marks > 0),
  position    integer not null default 0,
  is_active   boolean not null default true,
  archived_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index questions_quiz_active_idx on public.questions (quiz_id) where is_active and archived_at is null;

create table public.question_options (
  id          uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions (id) on delete cascade,
  position    smallint not null check (position between 0 and 3),
  text        text not null check (char_length(text) between 1 and 300),
  is_correct  boolean not null default false,
  unique (question_id, position)
);
-- exactly one correct option per question (enforced at most-one here, at-least-one in admin_save_question)
create unique index question_options_one_correct_idx on public.question_options (question_id) where is_correct;

-- ── Participants ───────────────────────────────────────────────
create table public.participants (
  id               uuid primary key default gen_random_uuid(),
  full_name        text not null check (char_length(full_name) between 2 and 80),
  email            text not null check (char_length(email) between 5 and 254),
  email_normalized text not null unique,
  phone            text,
  phone_normalized text,
  university       text not null check (char_length(university) between 2 and 120),
  department       text not null check (char_length(department) between 2 and 120),
  event_day        smallint not null check (event_day in (1, 2)),
  token_hash       text not null unique,
  consent_at       timestamptz not null,
  user_agent       text,
  created_at       timestamptz not null default now()
);
create unique index participants_phone_unique_idx on public.participants (phone_normalized) where phone_normalized is not null;
create index participants_created_idx on public.participants (created_at desc);
create index participants_day_idx on public.participants (event_day);

-- ── Attempts (one per participant) ─────────────────────────────
create table public.attempts (
  id                uuid primary key default gen_random_uuid(),
  participant_id    uuid not null unique references public.participants (id) on delete cascade,
  quiz_id           uuid not null references public.quizzes (id) on delete cascade,
  event_day         smallint not null check (event_day in (1, 2)),
  status            text not null default 'in_progress' check (status in ('in_progress', 'submitted')),
  question_ids      uuid[] not null,
  option_order      jsonb not null default '{}'::jsonb,
  negative_mark     numeric(6,2) not null default 0,
  started_at        timestamptz not null default now(),
  deadline_at       timestamptz not null,
  submitted_at      timestamptz,
  submit_reason     text check (submit_reason in ('manual', 'timeout', 'expired')),
  duration_ms       integer,
  score             numeric(8,2),
  max_score         numeric(8,2),
  correct_count     integer,
  incorrect_count   integer,
  unanswered_count  integer,
  flagged           boolean not null default false,
  flag_reasons      text[] not null default '{}',
  disqualified      boolean not null default false,
  created_at        timestamptz not null default now()
);
create index attempts_leaderboard_idx on public.attempts (score desc, duration_ms asc, submitted_at asc)
  where status = 'submitted' and not disqualified;
create index attempts_day_idx on public.attempts (event_day, status);
create index attempts_inprogress_deadline_idx on public.attempts (deadline_at) where status = 'in_progress';

create table public.participant_answers (
  attempt_id  uuid not null references public.attempts (id) on delete cascade,
  question_id uuid not null references public.questions (id) on delete restrict,
  option_id   uuid not null references public.question_options (id) on delete restrict,
  is_correct  boolean,
  answered_at timestamptz not null default now(),
  primary key (attempt_id, question_id)
);

-- ── updated_at triggers ────────────────────────────────────────
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

create trigger quizzes_touch before update on public.quizzes for each row execute function public.touch_updated_at();
create trigger questions_touch before update on public.questions for each row execute function public.touch_updated_at();
create trigger settings_touch before update on public.event_settings for each row execute function public.touch_updated_at();

-- ════════════════════════════════════════════════════════════════
--  Scoring — runs only inside the database (never in the browser)
-- ════════════════════════════════════════════════════════════════
create or replace function public.finalize_attempt(p_attempt_id uuid, p_reason text default 'manual')
returns public.attempts
language plpgsql
security definer
set search_path = public
as $$
declare
  a           public.attempts;
  v_now       timestamptz := clock_timestamp();
  v_end       timestamptz;
  v_correct   integer;
  v_incorrect integer;
  v_unans     integer;
  v_earned    numeric;
  v_max       numeric;
  v_score     numeric;
  v_duration  integer;
  v_reasons   text[] := '{}';
  v_total     integer;
begin
  select * into a from public.attempts where id = p_attempt_id for update;
  if not found then
    raise exception 'ATTEMPT_NOT_FOUND';
  end if;
  if a.status = 'submitted' then
    return a; -- idempotent
  end if;

  v_end := least(v_now, a.deadline_at);
  if p_reason = 'manual' and v_now > a.deadline_at then
    p_reason := 'timeout';
  end if;

  update public.participant_answers pa
     set is_correct = o.is_correct
    from public.question_options o
   where pa.attempt_id = a.id and o.id = pa.option_id;

  select
    count(*) filter (where pa.is_correct),
    count(*) filter (where pa.option_id is not null and not pa.is_correct),
    count(*) filter (where pa.option_id is null),
    coalesce(sum(q.marks) filter (where pa.is_correct), 0),
    coalesce(sum(q.marks), 0),
    count(*)
  into v_correct, v_incorrect, v_unans, v_earned, v_max, v_total
  from unnest(a.question_ids) as qid
  join public.questions q on q.id = qid
  left join public.participant_answers pa on pa.attempt_id = a.id and pa.question_id = qid;

  v_score := v_earned - (v_incorrect * a.negative_mark);
  v_duration := greatest(0, floor(extract(epoch from (v_end - a.started_at)) * 1000))::integer;

  -- Light-touch integrity heuristics for admin review (never auto-disqualifies)
  if v_total > 0 and (v_correct + v_incorrect) > 0
     and v_duration < (v_correct + v_incorrect) * 2500
     and v_correct::numeric / v_total >= 0.7 then
    v_reasons := array_append(v_reasons, 'Very fast completion with high accuracy');
  end if;
  if v_total > 0 and v_correct = v_total and v_duration < v_total * 4000 then
    v_reasons := array_append(v_reasons, 'Perfect score in under 4s per question');
  end if;

  update public.attempts
     set status = 'submitted',
         submitted_at = v_now,
         submit_reason = p_reason,
         duration_ms = v_duration,
         score = v_score,
         max_score = v_max,
         correct_count = v_correct,
         incorrect_count = v_incorrect,
         unanswered_count = v_unans,
         flagged = cardinality(v_reasons) > 0,
         flag_reasons = v_reasons
   where id = a.id
  returning * into a;

  return a;
end;
$$;

-- Finalise attempts whose deadline (+ grace) passed without a submit
create or replace function public.finalize_expired_attempts(p_grace_seconds integer default 20)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare r record; n integer := 0;
begin
  for r in
    select id from public.attempts
     where status = 'in_progress'
       and deadline_at + make_interval(secs => p_grace_seconds) < now()
     for update skip locked
  loop
    perform public.finalize_attempt(r.id, 'expired');
    n := n + 1;
  end loop;
  return n;
end;
$$;

-- Public leaderboard projection (no emails / phones)
create or replace function public.get_leaderboard(p_day smallint default null, p_limit integer default 10)
returns table (
  rank          bigint,
  attempt_id    uuid,
  display_name  text,
  university    text,
  department    text,
  score         numeric,
  max_score     numeric,
  correct_count integer,
  duration_ms   integer,
  submitted_at  timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    row_number() over (order by a.score desc, a.duration_ms asc, a.submitted_at asc) as rank,
    a.id, p.full_name, p.university, p.department,
    a.score, a.max_score, a.correct_count, a.duration_ms, a.submitted_at
  from public.attempts a
  join public.participants p on p.id = a.participant_id
  where a.status = 'submitted'
    and not a.disqualified
    and (p_day is null or a.event_day = p_day)
  order by a.score desc, a.duration_ms asc, a.submitted_at asc
  limit least(greatest(p_limit, 1), 100);
$$;

create or replace function public.get_attempt_rank(p_attempt_id uuid, p_day smallint default null)
returns table (rank bigint, total bigint)
language sql
stable
security definer
set search_path = public
as $$
  with me as (select * from public.attempts where id = p_attempt_id),
  pool as (
    select a.* from public.attempts a
     where a.status = 'submitted' and not a.disqualified
       and (p_day is null or a.event_day = p_day)
  )
  select
    (select count(*) from pool, me
      where pool.score > me.score
         or (pool.score = me.score and pool.duration_ms < me.duration_ms)
         or (pool.score = me.score and pool.duration_ms = me.duration_ms and pool.submitted_at < me.submitted_at)
    ) + 1,
    (select count(*) from pool);
$$;

-- ════════════════════════════════════════════════════════════════
--  Admin RPCs (each checks is_admin() itself)
-- ════════════════════════════════════════════════════════════════

-- Create or update a question with its 4 options atomically
create or replace function public.admin_save_question(
  p_id uuid, p_quiz_id uuid, p_prompt text, p_marks numeric, p_is_active boolean, p_options jsonb
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid; v_correct int; i int;
begin
  if not public.is_admin() then raise exception 'NOT_AUTHORIZED'; end if;
  if jsonb_array_length(p_options) <> 4 then raise exception 'Exactly four options are required'; end if;
  select count(*) into v_correct from jsonb_array_elements(p_options) e where (e->>'isCorrect')::boolean;
  if v_correct <> 1 then raise exception 'Exactly one option must be marked correct'; end if;

  if p_id is null then
    insert into public.questions (quiz_id, prompt, marks, is_active, position)
    values (p_quiz_id, trim(p_prompt), p_marks, p_is_active,
            coalesce((select max(position) + 1 from public.questions where quiz_id = p_quiz_id), 0))
    returning id into v_id;
  else
    update public.questions
       set prompt = trim(p_prompt), marks = p_marks, is_active = p_is_active
     where id = p_id
    returning id into v_id;
    if v_id is null then raise exception 'Question not found'; end if;
  end if;

  -- Reset correctness first so the one-correct unique index never trips mid-update
  update public.question_options set is_correct = false where question_id = v_id;
  for i in 0..3 loop
    insert into public.question_options (question_id, position, text, is_correct)
    values (v_id, i, trim(p_options->i->>'text'), false)
    on conflict (question_id, position) do update set text = excluded.text;
  end loop;
  for i in 0..3 loop
    if (p_options->i->>'isCorrect')::boolean then
      update public.question_options set is_correct = true where question_id = v_id and position = i;
    end if;
  end loop;
  return v_id;
end;
$$;

-- Delete a question; archive instead if participants already answered it
create or replace function public.admin_delete_question(p_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'NOT_AUTHORIZED'; end if;
  if exists (select 1 from public.participant_answers where question_id = p_id)
     or exists (select 1 from public.attempts where p_id = any (question_ids)) then
    update public.questions set archived_at = now(), is_active = false where id = p_id;
    return 'archived';
  end if;
  delete from public.questions where id = p_id;
  return 'deleted';
end;
$$;

-- Wipe participant/attempt data (questions & settings are kept)
create or replace function public.admin_reset_data(p_confirm text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare n integer;
begin
  if not public.is_admin() then raise exception 'NOT_AUTHORIZED'; end if;
  if p_confirm <> 'RESET' then raise exception 'Confirmation text mismatch'; end if;
  select count(*) into n from public.participants;
  delete from public.participants where true; -- cascades to attempts & answers
  delete from public.questions where archived_at is not null
    and not exists (select 1 from public.participant_answers pa where pa.question_id = questions.id);
  return n;
end;
$$;

-- ════════════════════════════════════════════════════════════════
--  Row Level Security
-- ════════════════════════════════════════════════════════════════
alter table public.admin_users         enable row level security;
alter table public.quizzes             enable row level security;
alter table public.event_settings      enable row level security;
alter table public.questions           enable row level security;
alter table public.question_options    enable row level security;
alter table public.participants        enable row level security;
alter table public.attempts            enable row level security;
alter table public.participant_answers enable row level security;

-- admin_users: an authenticated user may see only their own row (used to check admin status)
create policy "admin_users self read" on public.admin_users
  for select to authenticated using (user_id = auth.uid());

-- Admin-only full access on everything else. No anon policies exist.
create policy "admin all quizzes"   on public.quizzes             for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin all settings"  on public.event_settings      for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin all questions" on public.questions           for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin all options"   on public.question_options    for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin read participants"   on public.participants  for select to authenticated using (public.is_admin());
create policy "admin delete participants" on public.participants  for delete to authenticated using (public.is_admin());
create policy "admin read attempts"       on public.attempts      for select to authenticated using (public.is_admin());
create policy "admin update attempts"     on public.attempts      for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin read answers"        on public.participant_answers for select to authenticated using (public.is_admin());

-- Lock down function execution
revoke all on function public.finalize_attempt(uuid, text)            from public, anon, authenticated;
revoke all on function public.finalize_expired_attempts(integer)      from public, anon, authenticated;
revoke all on function public.get_leaderboard(smallint, integer)      from public, anon;
revoke all on function public.get_attempt_rank(uuid, smallint)        from public, anon, authenticated;
revoke all on function public.admin_save_question(uuid, uuid, text, numeric, boolean, jsonb) from public, anon;
revoke all on function public.admin_delete_question(uuid)             from public, anon;
revoke all on function public.admin_reset_data(text)                  from public, anon;

grant execute on function public.get_leaderboard(smallint, integer) to authenticated, service_role;
grant execute on function public.finalize_attempt(uuid, text) to service_role;
grant execute on function public.finalize_expired_attempts(integer) to service_role;
grant execute on function public.get_attempt_rank(uuid, smallint) to service_role;
grant execute on function public.admin_save_question(uuid, uuid, text, numeric, boolean, jsonb) to authenticated;
grant execute on function public.admin_delete_question(uuid) to authenticated;
grant execute on function public.admin_reset_data(text) to authenticated;
grant execute on function public.is_admin() to authenticated;

-- ════════════════════════════════════════════════════════════════
--  Bootstrap: one quiz + the settings row
-- ════════════════════════════════════════════════════════════════
with q as (
  insert into public.quizzes (title) values ('Brain Battle') returning id
)
insert into public.event_settings (id, active_quiz_id, competition_info, rules, prizes)
select 1, q.id,
  'Answer quick-fire questions on technology, AI, careers and general knowledge. The highest score wins — if scores tie, the fastest finisher takes the lead.',
  jsonb_build_array(
    'One attempt per participant. Your email can only be used once.',
    'The timer starts as soon as you press Start Quiz and cannot be paused.',
    'Your quiz is submitted automatically when the timer reaches zero.',
    'Ties are broken by completion time, then by earliest submission.',
    'Use of other people, devices or AI tools during the quiz leads to disqualification.',
    'Winners must show their registered email at the Kaizenext booth to claim prizes.'
  ),
  jsonb_build_array(
    jsonb_build_object('place', 'Champion', 'title', 'Grand Prize', 'description', 'Top scorer of each day. Prize revealed at the Kaizenext booth.'),
    jsonb_build_object('place', '2nd Place', 'title', 'Runner-up Prize', 'description', 'Second highest score of each day.'),
    jsonb_build_object('place', '3rd Place', 'title', 'Third Place Prize', 'description', 'Third highest score of each day.')
  )
from q;
