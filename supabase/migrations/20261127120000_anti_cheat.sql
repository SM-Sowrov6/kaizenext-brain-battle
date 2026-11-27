-- ════════════════════════════════════════════════════════════════
--  Anti-cheat ("proctoring") for the quiz screen
--  The browser reports violations (left the page / switched app or tab,
--  copy/paste, devtools…). Strikes are counted HERE, so a refresh can't
--  reset them. Reaching quizzes.max_violations ends the attempt and
--  disqualifies it (excluded from the lucky draw; admin can reinstate).
--  Re-runnable.
-- ════════════════════════════════════════════════════════════════

alter table public.attempts add column if not exists violation_count   integer     not null default 0;
alter table public.attempts add column if not exists violations        jsonb       not null default '[]'::jsonb;
alter table public.attempts add column if not exists last_violation_at timestamptz;

-- strikes allowed before kick-out: 2 = one warning, then out
alter table public.quizzes add column if not exists max_violations smallint not null default 2;
alter table public.quizzes drop constraint if exists quizzes_max_violations_check;
alter table public.quizzes add constraint quizzes_max_violations_check check (max_violations between 1 and 5);

alter table public.attempts drop constraint if exists attempts_submit_reason_check;
alter table public.attempts add constraint attempts_submit_reason_check
  check (submit_reason in ('manual', 'timeout', 'expired', 'violation'));

-- finalize_attempt: same scoring as before, but integrity flags are now APPENDED
-- (previously overwritten, which would have erased anti-cheat flags).
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
         flagged = a.flagged or cardinality(v_reasons) > 0,
         flag_reasons = a.flag_reasons || v_reasons
   where id = a.id
  returning * into a;

  return a;
end;
$$;

-- Record one violation "episode". p_event_id makes it idempotent: the same
-- away-episode can be reported by beacon AND by fetch without double counting.
create or replace function public.record_violation(p_attempt_id uuid, p_kind text, p_event_id text)
returns table (strikes integer, max_strikes integer, is_out boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  a      public.attempts;
  v_max  integer;
  v_kind text := left(coalesce(nullif(p_kind, ''), 'unknown'), 40);
  v_id   text := left(coalesce(nullif(p_event_id, ''), gen_random_uuid()::text), 64);
begin
  select * into a from public.attempts where id = p_attempt_id for update;
  if not found then raise exception 'ATTEMPT_NOT_FOUND'; end if;
  select q.max_violations into v_max from public.quizzes q where q.id = a.quiz_id;
  v_max := coalesce(v_max, 2);

  if a.status <> 'in_progress' then
    return query select a.violation_count, v_max, true;
    return;
  end if;

  -- already counted this episode, or a second browser signal of the same moment
  if a.violations @> jsonb_build_array(jsonb_build_object('id', v_id))
     or (a.last_violation_at is not null and clock_timestamp() - a.last_violation_at < interval '2 seconds') then
    return query select a.violation_count, v_max, false;
    return;
  end if;

  update public.attempts
     set violation_count = violation_count + 1,
         violations = violations || jsonb_build_array(jsonb_build_object('id', v_id, 'kind', v_kind, 'at', clock_timestamp())),
         last_violation_at = clock_timestamp(),
         flagged = true,
         flag_reasons = array_append(flag_reasons, 'Anti-cheat: ' || v_kind)
   where id = a.id
  returning * into a;

  if a.violation_count >= v_max then
    perform public.finalize_attempt(a.id, 'violation');
    update public.attempts
       set disqualified = true,
           flag_reasons = array_append(flag_reasons, 'Disqualified after ' || a.violation_count || ' anti-cheat violations')
     where id = a.id;
    return query select a.violation_count, v_max, true;
    return;
  end if;

  return query select a.violation_count, v_max, false;
end;
$$;

-- Used when the browser already counted the final strike but could not reach
-- the server in time (offline): end + disqualify on the next submit.
create or replace function public.force_violation_out(p_attempt_id uuid, p_kind text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare a public.attempts;
begin
  select * into a from public.attempts where id = p_attempt_id for update;
  if not found then raise exception 'ATTEMPT_NOT_FOUND'; end if;
  if a.status = 'in_progress' then
    perform public.finalize_attempt(a.id, 'violation');
  end if;
  update public.attempts
     set disqualified = true,
         flagged = true,
         flag_reasons = array_append(flag_reasons, 'Disqualified: ' || left(coalesce(p_kind, 'anti-cheat'), 40) || ' (reported on submit)')
   where id = a.id and not disqualified;
end;
$$;

revoke all on function public.record_violation(uuid, text, text) from public, anon, authenticated;
revoke all on function public.force_violation_out(uuid, text)    from public, anon, authenticated;
revoke all on function public.finalize_attempt(uuid, text)       from public, anon, authenticated;
grant execute on function public.record_violation(uuid, text, text) to service_role;
grant execute on function public.force_violation_out(uuid, text)    to service_role;
grant execute on function public.finalize_attempt(uuid, text)       to service_role;

-- Add the anti-cheat rule to the public rules (once)
update public.event_settings
   set rules = rules || to_jsonb('Stay on the quiz screen: switching apps or tabs, refreshing, or copy/paste gives a warning the first time and disqualifies you the second time.'::text)
 where id = 1
   and jsonb_typeof(rules) = 'array'
   and not rules @> to_jsonb(array['Stay on the quiz screen: switching apps or tabs, refreshing, or copy/paste gives a warning the first time and disqualifies you the second time.'::text]);
