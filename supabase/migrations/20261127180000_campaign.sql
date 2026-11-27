-- ════════════════════════════════════════════════════════════════
--  7-day campaign (Nov 28 – Dec 4, 2026, Dhaka time; results Dec 5)
--  • The quiz opens/closes automatically at campaign_start / campaign_end.
--  • Winners: highest scores win; ties are broken by lottery. Each prize
--    draw picks at random among the HIGHEST REMAINING score (tier draw).
--  • Day 1 / Day 2 are retired: event_day = 0 means "whole campaign" in the
--    draw functions. Re-runnable.
-- ════════════════════════════════════════════════════════════════

alter table public.event_settings add column if not exists campaign_start timestamptz not null default '2026-11-28 00:00:00+06';
alter table public.event_settings add column if not exists campaign_end   timestamptz not null default '2026-12-04 23:59:59+06';
alter table public.event_settings add column if not exists results_date   date        not null default '2026-12-05';
alter table public.event_settings drop constraint if exists event_settings_campaign_window_check;
alter table public.event_settings add constraint event_settings_campaign_window_check check (campaign_end > campaign_start);

update public.event_settings
   set campaign_start = '2026-11-28 00:00:00+06',
       campaign_end   = '2026-12-04 23:59:59+06',
       results_date   = '2026-12-05'
 where id = 1;

-- campaign-wide winners use event_day = 0
alter table public.draw_winners drop constraint if exists draw_winners_event_day_check;
alter table public.draw_winners add constraint draw_winners_event_day_check check (event_day in (0, 1, 2));

-- Pool = everyone tied on the highest score (p_day = 0 → whole campaign)
create or replace function public.get_draw_pool(p_day smallint)
returns table (
  attempt_id   uuid,
  display_name text,
  university   text,
  department   text,
  score        numeric,
  max_score    numeric,
  submitted_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  with eligible as (
    select a.* from public.attempts a
     where a.status = 'submitted' and not a.disqualified
       and (p_day = 0 or a.event_day = p_day)
  ),
  top as (select max(score) as s from eligible)
  select e.id, p.full_name, p.university, p.department, e.score, e.max_score, e.submitted_at
    from eligible e
    join top on e.score = top.s
    join public.participants p on p.id = e.participant_id
   order by e.submitted_at asc;
$$;

-- Tier draw: random pick among the highest score that still has non-winners
drop function if exists public.admin_draw_winner(smallint, smallint);
create function public.admin_draw_winner(p_day smallint, p_position smallint)
returns table (id uuid, prize_position smallint, attempt_id uuid, display_name text, university text, department text, drawn_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare v_attempt uuid; v_id uuid; v_top numeric;
begin
  if not public.is_admin() then raise exception 'NOT_AUTHORIZED'; end if;
  if exists (select 1 from public.draw_winners w where w.event_day = p_day and w.position = p_position and w.voided_at is null) then
    raise exception 'This prize has already been drawn. Void it first to redraw.';
  end if;

  select max(a.score) into v_top
    from public.attempts a
   where a.status = 'submitted' and not a.disqualified
     and (p_day = 0 or a.event_day = p_day)
     and not exists (select 1 from public.draw_winners w where w.attempt_id = a.id and w.voided_at is null);
  if v_top is null then raise exception 'No eligible participants left.'; end if;

  select a.id into v_attempt
    from public.attempts a
   where a.status = 'submitted' and not a.disqualified
     and (p_day = 0 or a.event_day = p_day)
     and a.score = v_top
     and not exists (select 1 from public.draw_winners w where w.attempt_id = a.id and w.voided_at is null)
   order by gen_random_uuid()   -- cryptographically random among the tied
   limit 1;

  insert into public.draw_winners (event_day, position, attempt_id, drawn_by)
  values (p_day, p_position, v_attempt, auth.uid())
  returning draw_winners.id into v_id;
  return query select * from public.get_draw_winners(p_day) g where g.id = v_id;
end;
$$;

revoke all on function public.admin_draw_winner(smallint, smallint) from public, anon;
grant execute on function public.admin_draw_winner(smallint, smallint) to authenticated;

-- Public wording for the campaign (replace only the earlier default texts)
update public.event_settings
   set rules = (
     select jsonb_agg(
       case r #>> '{}'
         when 'Everyone with the highest score of the day enters a lucky draw. Winners are picked at random at the Kaizenext booth.'
           then to_jsonb('The 3 highest scores win. If players tie on score, the winners are chosen by lucky draw. Results on 5 December.'::text)
         when 'Winners must show their registered email at the Kaizenext booth to claim prizes.'
           then to_jsonb('Winners are contacted on their registered email or phone to claim prizes.'::text)
         else r
       end order by ord)
     from jsonb_array_elements(rules) with ordinality as t(r, ord)
   )
 where id = 1 and jsonb_typeof(rules) = 'array' and jsonb_array_length(rules) > 0;

update public.event_settings
   set prizes = (
     select jsonb_agg(
       case
         when p->>'description' like 'Drawn at random from the day''s top scorers%'
           then jsonb_set(p, '{description}', to_jsonb('Highest score of the campaign. Ties are decided by lucky draw.'::text))
         when p->>'description' = 'Second name drawn from the day''s top scorers.'
           then jsonb_set(p, '{description}', to_jsonb('Second prize, from the highest remaining scores.'::text))
         when p->>'description' = 'Third name drawn from the day''s top scorers.'
           then jsonb_set(p, '{description}', to_jsonb('Third prize, from the highest remaining scores.'::text))
         else p
       end order by ord)
     from jsonb_array_elements(prizes) with ordinality as t(p, ord)
   )
 where id = 1 and jsonb_typeof(prizes) = 'array' and jsonb_array_length(prizes) > 0;
