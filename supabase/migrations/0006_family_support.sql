-- KIN 0006: calendar sync, discussion threads, appointment packs, medications,
-- care rota, wellbeing trend, holiday planner, child screens, school email,
-- and the calm message helper.

-- ---------------------------------------------------------------- appointment pack
alter table appointments add column pack_questions text;   -- questions to ask
alter table appointments add column pack_bring text;       -- what to bring
alter table appointments add column pack_parking text;     -- parking and getting there

-- ---------------------------------------------------------------- discussion threads
-- Short threads on an appointment, schedule request, agreement or cost. 'outcome'
-- notes record what was said at an appointment. Anyone who can see the thing
-- (and isn't a helper) can read and add to its thread.
create table discussions (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references care_circles on delete cascade,
  subject_type text not null check (subject_type in ('appointment','change','agreement','expense')),
  subject_id uuid not null,
  kind text not null default 'comment' check (kind in ('comment','outcome')),
  author uuid references profiles on delete set null,
  body text not null check (length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index on discussions (subject_type, subject_id, created_at);
alter table discussions enable row level security;

create or replace function can_see_subject(c uuid, t text, s uuid) returns boolean
language sql stable as $$
  select case t
    when 'appointment' then exists (select 1 from appointments a where a.id = s and a.circle_id = c)
    when 'change' then exists (select 1 from schedule_changes x where x.id = s and x.circle_id = c)
    when 'agreement' then exists (select 1 from agreements x where x.id = s and x.circle_id = c)
    when 'expense' then exists (select 1 from expenses x where x.id = s and x.circle_id = c)
    else false end
$$;  -- security invoker: the subject's own row-level rules decide

create policy "read discussions" on discussions for select using (
  has_role(circle_id, array['admin','family','supported','contributor']::circle_role[])
  and can_see_subject(circle_id, subject_type, subject_id)
);
create policy "add to discussions" on discussions for insert with check (
  author = auth.uid()
  and has_role(circle_id, array['admin','family','supported','contributor']::circle_role[])
  and can_see_subject(circle_id, subject_type, subject_id)
);
create policy "remove own discussion" on discussions for delete using (author = auth.uid());

-- ---------------------------------------------------------------- medications
create table medications (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references care_circles on delete cascade,
  name text not null check (length(name) between 1 and 120),
  dose text,              -- as written on the label, e.g. "1 tablet"
  when_taken text,        -- e.g. "Morning and evening"
  notes text,
  pharmacy text,
  repeat_days int check (repeat_days between 1 and 365),   -- how often a repeat is ordered
  next_order date,
  last_ordered date,
  active boolean not null default true,
  updated_by uuid references profiles on delete set null,
  updated_at timestamptz not null default now()
);
create index on medications (circle_id);
alter table medications enable row level security;
create policy "inner read medications" on medications for select using (is_inner(circle_id));
create policy "editors write medications" on medications for all using (can_edit(circle_id)) with check (can_edit(circle_id));

-- ---------------------------------------------------------------- wellbeing
create table wellbeing_entries (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references care_circles on delete cascade,
  user_id uuid references profiles on delete set null,
  mood text not null check (mood in ('good','ok','not_great')),
  note text,
  created_at timestamptz not null default now()
);
create index on wellbeing_entries (circle_id, created_at desc);
alter table wellbeing_entries enable row level security;
create policy "inner read wellbeing" on wellbeing_entries for select using (is_inner(circle_id));
create policy "say how you are" on wellbeing_entries for insert with check (user_id = auth.uid() and is_member(circle_id));

-- ---------------------------------------------------------------- care rota and holidays
alter table care_circles add column visit_days int[] not null default '{}';   -- 0 = Monday … 6 = Sunday
alter table schedule_changes add column label text;                           -- e.g. "Christmas Day"

-- ---------------------------------------------------------------- child screens
-- A private link for a home tablet that shows one child their week in pictures.
create table child_screens (
  token text primary key default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  circle_id uuid not null references care_circles on delete cascade,
  child_id uuid not null references children on delete cascade,
  created_by uuid references profiles on delete set null,
  revoked boolean not null default false,
  created_at timestamptz not null default now()
);
alter table child_screens enable row level security;
create policy "parents manage screens" on child_screens for all using (can_edit(circle_id)) with check (can_edit(circle_id));

-- ---------------------------------------------------------------- school email
create table inbound_addresses (
  circle_id uuid primary key references care_circles on delete cascade,
  token text not null unique default substr(replace(gen_random_uuid()::text, '-', ''), 1, 16),
  created_at timestamptz not null default now()
);
alter table inbound_addresses enable row level security;
create policy "family read inbound" on inbound_addresses for select using (can_edit(circle_id));
create policy "family create inbound" on inbound_addresses for insert with check (can_edit(circle_id));
create policy "family reset inbound" on inbound_addresses for delete using (can_edit(circle_id));

-- ---------------------------------------------------------------- calendar sync
create table calendar_feeds (
  user_id uuid primary key references profiles on delete cascade,
  token text not null unique default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  created_at timestamptz not null default now()
);
alter table calendar_feeds enable row level security;
create policy "own feed" on calendar_feeds for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- What one person's calendar feed shows: exactly the appointments their role can
-- see, plus tasks with a date that are theirs. Uses the same rules as the app.
create or replace function calendar_feed(p_token text)
returns table (kind text, id uuid, circle_name text, title text, starts date, ends date, at_time time, location text, detail text)
language plpgsql security definer set search_path = public as $$
declare uid uuid;
begin
  select user_id into uid from calendar_feeds where token = p_token;
  if uid is null then return; end if;
  -- act as that person for the visibility helpers below
  perform set_config('request.jwt.claim.sub', uid::text, true);
  perform set_config('request.uid', uid::text, true);
  return query
    select 'appointment'::text, a.id,
           case when c.kind = 'children' then c.person_name else c.preferred_name end,
           a.title, a.date, a.end_date, a.time, a.location,
           concat_ws(' · ', nullif(a.attending, ''), case when a.needs_transport and a.driver is null then 'Needs a driver' end)
    from appointments a join care_circles c on c.id = a.circle_id
    where a.date >= current_date - 30 and a.date <= current_date + 400
      and (is_inner(a.circle_id)
        or (not a.private and has_role(a.circle_id, array['supported','contributor']::circle_role[]))
        or (not a.private and a.share_with_helpers and my_role(a.circle_id) = 'helper'))
    union all
    select 'task'::text, t.id,
           case when c.kind = 'children' then c.person_name else c.preferred_name end,
           t.title, t.due_date, null::date, t.due_time, null::text, t.description
    from tasks t join care_circles c on c.id = t.circle_id
    where t.assignee = uid and t.status = 'accepted' and t.due_date is not null
      and t.due_date >= current_date - 30 and t.appointment_id is null
      and is_member(t.circle_id);
end $$;
revoke execute on function calendar_feed(text) from public, anon, authenticated;

-- ---------------------------------------------------------------- AI limits
alter table ai_usage drop constraint if exists ai_usage_kind_check;
alter table ai_usage add constraint ai_usage_kind_check check (kind in ('setup','help','letter','tone','email'));
