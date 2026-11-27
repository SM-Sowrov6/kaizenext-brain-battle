-- ════════════════════════════════════════════════════════════════
--  Lucky draw (replaces public ranking)
--  • Everyone with the HIGHEST score of a day enters that day's draw.
--  • Winners are picked at random ON THE SERVER by an admin.
--  • A redraw never deletes history: the old winner is marked voided.
-- ════════════════════════════════════════════════════════════════

create table public.draw_winners (
  id         uuid primary key default gen_random_uuid(),
  event_day  smallint not null check (event_day in (1, 2)),
  position   smallint not null check (position between 1 and 20),
  attempt_id uuid not null references public.attempts (id) on delete cascade,
  drawn_at   timestamptz not null default now(),
  drawn_by   uuid references auth.users (id) on delete set null,
  voided_at  timestamptz,
  voided_by  uuid references auth.users (id) on delete set null
);
-- one active winner per prize position per day, and a person can win only once
create unique index draw_winners_active_position on public.draw_winners (event_day, position) where voided_at is null;
create unique index draw_winners_active_attempt  on public.draw_winners (attempt_id) where voided_at is null;

alter table public.draw_winners enable row level security;
create policy "admin read draw winners" on public.draw_winners for select to authenticated using (public.is_admin());

-- Everyone tied on the day's highest score (names only — no emails/phones)
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
     where a.status = 'submitted' and not a.disqualified and a.event_day = p_day
  ),
  top as (select max(score) as s from eligible)
  select e.id, p.full_name, p.university, p.department, e.score, e.max_score, e.submitted_at
    from eligible e
    join top on e.score = top.s
    join public.participants p on p.id = e.participant_id
   order by e.submitted_at asc;
$$;

create or replace function public.get_draw_winners(p_day smallint)
returns table (
  id           uuid,
  position     smallint,
  attempt_id   uuid,
  display_name text,
  university   text,
  department   text,
  drawn_at     timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select w.id, w.position, w.attempt_id, p.full_name, p.university, p.department, w.drawn_at
    from public.draw_winners w
    join public.attempts a on a.id = w.attempt_id
    join public.participants p on p.id = a.participant_id
   where w.event_day = p_day and w.voided_at is null
   order by w.position;
$$;

-- Pick one random winner for a prize position from the current pool
create or replace function public.admin_draw_winner(p_day smallint, p_position smallint)
returns table (id uuid, position smallint, attempt_id uuid, display_name text, university text, department text, drawn_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare v_attempt uuid; v_id uuid;
begin
  if not public.is_admin() then raise exception 'NOT_AUTHORIZED'; end if;
  if exists (select 1 from public.draw_winners w where w.event_day = p_day and w.position = p_position and w.voided_at is null) then
    raise exception 'This prize has already been drawn. Void it first to redraw.';
  end if;
  select pool.attempt_id into v_attempt
    from public.get_draw_pool(p_day) pool
   where not exists (select 1 from public.draw_winners w where w.attempt_id = pool.attempt_id and w.voided_at is null)
   order by gen_random_uuid()   -- cryptographically random order
   limit 1;
  if v_attempt is null then raise exception 'No eligible participants left in the pool.'; end if;
  insert into public.draw_winners (event_day, position, attempt_id, drawn_by)
  values (p_day, p_position, v_attempt, auth.uid())
  returning draw_winners.id into v_id;
  return query select * from public.get_draw_winners(p_day) g where g.id = v_id;
end;
$$;

create or replace function public.admin_void_winner(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'NOT_AUTHORIZED'; end if;
  update public.draw_winners set voided_at = now(), voided_by = auth.uid()
   where id = p_id and voided_at is null;
end;
$$;

revoke all on function public.get_draw_pool(smallint)                from public, anon;
revoke all on function public.get_draw_winners(smallint)             from public, anon;
revoke all on function public.admin_draw_winner(smallint, smallint)  from public, anon;
revoke all on function public.admin_void_winner(uuid)                from public, anon;
grant execute on function public.get_draw_pool(smallint)               to authenticated, service_role;
grant execute on function public.get_draw_winners(smallint)            to authenticated, service_role;
grant execute on function public.admin_draw_winner(smallint, smallint) to authenticated;
grant execute on function public.admin_void_winner(uuid)               to authenticated;

-- Update the default rule / prize wording (only where the original default text is unchanged)
update public.event_settings
   set rules = (
     select jsonb_agg(
       case r #>> '{}'
         when 'Ties are broken by completion time, then by earliest submission.'
           then to_jsonb('Everyone with the highest score of the day enters a lucky draw. Winners are picked at random at the Kaizenext booth.'::text)
         else r
       end order by ord)
     from jsonb_array_elements(rules) with ordinality as t(r, ord)
   )
 where id = 1 and jsonb_typeof(rules) = 'array' and jsonb_array_length(rules) > 0;

update public.event_settings
   set prizes = (
     select jsonb_agg(
       case
         when p->>'description' = 'Top scorer of each day. Prize revealed at the Kaizenext booth.'
           then jsonb_set(p, '{description}', to_jsonb('Drawn at random from the day''s top scorers. Prize revealed at the Kaizenext booth.'::text))
         when p->>'description' = 'Second highest score of each day.'
           then jsonb_set(p, '{description}', to_jsonb('Second name drawn from the day''s top scorers.'::text))
         when p->>'description' = 'Third highest score of each day.'
           then jsonb_set(p, '{description}', to_jsonb('Third name drawn from the day''s top scorers.'::text))
         else p
       end order by ord)
     from jsonb_array_elements(prizes) with ordinality as t(p, ord)
   )
 where id = 1 and jsonb_typeof(prizes) = 'array' and jsonb_array_length(prizes) > 0;
