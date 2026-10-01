-- KIN 0003: children and co-parenting
-- A circle can now be about an older relative ('care') or about children
-- ('children'), including children who live across two homes.

alter table care_circles add column kind text not null default 'care' check (kind in ('care', 'children'));
alter table care_circles add column packing_list text[] not null default '{}';   -- what goes back and forth at handover
alter table care_circles add column handover_note text;                           -- e.g. "School pick-up, or 17:30 at Mum's"
alter table care_circles add column default_split jsonb;                          -- {profile_id: weight} for shared costs

create or replace function circle_kind(c uuid) returns text
language sql stable security definer set search_path = public as $$
  select kind from care_circles where id = c
$$;

-- In a children's circle, a young person with their own account is not part of
-- the "inner" adult circle: no documents, money, private tasks or adult notes.
create or replace function is_inner(c uuid) returns boolean
language sql stable as $$
  select has_role(c, array['admin','family']::circle_role[])
      or (my_role(c) = 'supported' and circle_kind(c) = 'care')
$$;

-- ---------------------------------------------------------------- children and homes
create table children (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references care_circles on delete cascade,
  first_name text not null check (length(first_name) between 1 and 60),
  last_name text,
  date_of_birth date,
  colour text not null default 'blue',
  school text, year_group text, class_name text, teacher text,
  allergies text,          -- shown to everyone in the circle, including childminders
  important_notes text,    -- shown to everyone in the circle, including childminders
  clothes_size text, shoe_size text,
  gp text, dentist text,
  passport_expiry date,
  user_id uuid references profiles on delete set null,   -- the child's own KIN account (13+), optional
  sort int not null default 0,
  created_at timestamptz not null default now()
);
create index on children (circle_id);

create table households (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references care_circles on delete cascade,
  name text not null check (length(name) between 1 and 60),   -- e.g. "Mum's" or "Dad's"
  colour text not null default 'blue',
  address text,
  sort int not null default 0,
  created_at timestamptz not null default now()
);
create index on households (circle_id);

-- The regular pattern: which home the children sleep at on each night of a
-- 7- or 14-night cycle, starting on the anchor date.
create table schedule_patterns (
  circle_id uuid primary key references care_circles on delete cascade,
  anchor date not null,
  days uuid[] not null check (cardinality(days) between 1 and 28),
  label text,
  updated_by uuid references auth.users on delete set null,
  updated_at timestamptz not null default now()
);

-- One-off changes to the pattern. A parent asks; another parent answers.
create table schedule_changes (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references care_circles on delete cascade,
  start_date date not null,
  end_date date not null,
  household_id uuid not null references households on delete cascade,
  reason text check (length(reason) <= 500),
  in_return text check (length(in_return) <= 300),
  status text not null default 'requested' check (status in ('requested','accepted','declined','cancelled')),
  requested_by uuid references profiles on delete set null,
  requested_at timestamptz not null default now(),
  responded_by uuid references profiles on delete set null,
  responded_at timestamptz,
  response_note text check (length(response_note) <= 500),
  check (end_date >= start_date and end_date - start_date <= 60)
);
create index on schedule_changes (circle_id, start_date);

create table handovers (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references care_circles on delete cascade,
  handed_at timestamptz not null default now(),
  from_household uuid references households on delete set null,
  to_household uuid references households on delete set null,
  recorded_by uuid references profiles on delete set null,
  items_packed text[] not null default '{}',
  items_missing text[] not null default '{}',
  note text check (length(note) <= 1000)
);
create index on handovers (circle_id, handed_at desc);

-- Decisions both parents have agreed, e.g. bedtimes or how costs are split.
create table agreements (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references care_circles on delete cascade,
  title text not null check (length(title) between 1 and 140),
  detail text check (length(detail) <= 2000),
  category text not null default 'Other',
  share boolean not null default false,   -- once agreed, show to grandparents, childminders and the children
  status text not null default 'proposed' check (status in ('proposed','agreed','declined','withdrawn')),
  proposed_by uuid references profiles on delete set null,
  proposed_at timestamptz not null default now(),
  decided_by uuid references profiles on delete set null,
  decided_at timestamptz,
  note text check (length(note) <= 500)
);
create index on agreements (circle_id, status);

-- "Where is it?" Passports, PE kits, chargers.
create table child_items (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references care_circles on delete cascade,
  child_id uuid references children on delete cascade,
  name text not null check (length(name) between 1 and 80),
  household_id uuid references households on delete set null,
  location_note text check (length(location_note) <= 200),
  updated_by uuid references profiles on delete set null,
  updated_at timestamptz not null default now()
);
create index on child_items (circle_id);

-- ---------------------------------------------------------------- tags on existing tables
alter table tasks add column child_ids uuid[] not null default '{}';
alter table appointments add column child_ids uuid[] not null default '{}';
alter table appointments add column end_date date;
alter table appointments add column private boolean not null default false;            -- parents only
alter table appointments add column share_with_helpers boolean not null default false; -- e.g. INSET days for the childminder

alter table expenses add column shares jsonb;    -- {profile_id: weight}; null means split equally
alter table expenses add column status text not null default 'approved' check (status in ('pending','approved','disputed'));
alter table expenses add column child_ids uuid[] not null default '{}';
alter table expenses add column receipt_document_id uuid references documents on delete set null;
alter table expenses add column responded_by uuid references profiles on delete set null;
alter table expenses add column responded_at timestamptz;
alter table expenses add column response_note text check (length(response_note) <= 500);
alter table settlements add column kind text not null default 'settle' check (kind in ('settle','maintenance'));

create or replace function my_child_ids(c uuid) returns uuid[]
language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(id), '{}') from children where circle_id = c and user_id = auth.uid()
$$;

-- ---------------------------------------------------------------- RLS
alter table children enable row level security;
alter table households enable row level security;
alter table schedule_patterns enable row level security;
alter table schedule_changes enable row level security;
alter table handovers enable row level security;
alter table agreements enable row level security;
alter table child_items enable row level security;

create policy "members read children" on children for select using (is_member(circle_id));
create policy "family write children" on children for all using (can_edit(circle_id)) with check (can_edit(circle_id));

create policy "members read households" on households for select using (is_member(circle_id));
create policy "family write households" on households for all using (can_edit(circle_id)) with check (can_edit(circle_id));

-- Everyone sees where the children are through nights(); the pattern and the
-- requests (with their reasons) are for the parents.
create policy "family read pattern" on schedule_patterns for select using (can_edit(circle_id));
create policy "family write pattern" on schedule_patterns for all using (can_edit(circle_id)) with check (can_edit(circle_id));

create policy "family read changes" on schedule_changes for select using (can_edit(circle_id));
create policy "family request changes" on schedule_changes for insert with check (
  can_edit(circle_id) and requested_by = auth.uid() and status = 'requested'
  and exists (select 1 from households h where h.id = household_id and h.circle_id = schedule_changes.circle_id)
);

create policy "read handovers" on handovers for select using (can_edit(circle_id) or recorded_by = auth.uid());
create policy "record handovers" on handovers for insert with check (is_member(circle_id) and recorded_by = auth.uid());

create policy "read agreements" on agreements for select using (
  can_edit(circle_id) or (share and status = 'agreed' and is_member(circle_id))
);
create policy "propose agreements" on agreements for insert with check (
  can_edit(circle_id) and proposed_by = auth.uid() and status = 'proposed'
);

create policy "members read items" on child_items for select using (is_member(circle_id));
create policy "family write items" on child_items for all using (can_edit(circle_id)) with check (can_edit(circle_id));

drop policy "read tasks" on tasks;
create policy "read tasks" on tasks for select using (
  is_inner(circle_id)
  or (my_role(circle_id) = 'contributor' and (assignee = auth.uid() or (assignee is null and not private)))
  or (my_role(circle_id) = 'helper' and assignee = auth.uid())
  or (my_role(circle_id) = 'supported' and circle_kind(circle_id) = 'children' and not private
      and (assignee = auth.uid() or child_ids && my_child_ids(circle_id)))
);

drop policy "read appointments" on appointments;
create policy "read appointments" on appointments for select using (
  is_inner(circle_id)
  or (not private and has_role(circle_id, array['supported','contributor']::circle_role[]))
  or (not private and share_with_helpers and my_role(circle_id) = 'helper')
);

-- ---------------------------------------------------------------- functions
-- Where the children sleep each night, for anyone in the circle.
create or replace function nights(c uuid, from_date date, to_date date)
returns table (night date, household_id uuid, changed boolean)
language sql stable security definer set search_path = public as $$
  with ch as (
    select start_date, end_date, household_id, responded_at
    from schedule_changes where circle_id = c and status = 'accepted'
  )
  select d::date,
    coalesce(
      (select ch.household_id from ch where d::date between ch.start_date and ch.end_date order by ch.responded_at desc nulls last limit 1),
      p.days[1 + ((((d::date - p.anchor) % cardinality(p.days)) + cardinality(p.days)) % cardinality(p.days))]
    ),
    exists (select 1 from ch where d::date between ch.start_date and ch.end_date)
  from generate_series(from_date, to_date, interval '1 day') d
  left join schedule_patterns p on p.circle_id = c
  where is_member(c) and to_date >= from_date and to_date - from_date <= 400
  order by 1
$$;

create or replace function respond_schedule_change(p_id uuid, p_accept boolean, p_note text) returns void
language plpgsql security definer set search_path = public as $$
declare r schedule_changes;
begin
  select * into r from schedule_changes where id = p_id for update;
  if not found or not can_edit(r.circle_id) then raise exception 'Request not found'; end if;
  if r.status <> 'requested' then raise exception 'This request has already been answered'; end if;
  if r.requested_by = auth.uid() then raise exception 'Another parent needs to answer this request'; end if;
  update schedule_changes set status = case when p_accept then 'accepted' else 'declined' end,
    responded_by = auth.uid(), responded_at = now(), response_note = left(p_note, 500) where id = p_id;
  perform log_activity(r.circle_id, case when p_accept then 'agreed a schedule change for' else 'said no to a schedule change for' end,
    to_char(r.start_date, 'FMDD Mon') || case when r.end_date <> r.start_date then ' to ' || to_char(r.end_date, 'FMDD Mon') else '' end);
  insert into audit_log (circle_id, actor, action, detail)
    values (r.circle_id, auth.uid(), 'schedule.' || case when p_accept then 'accept' else 'decline' end, jsonb_build_object('change', p_id));
end $$;

create or replace function cancel_schedule_change(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare r schedule_changes;
begin
  select * into r from schedule_changes where id = p_id for update;
  if not found or r.requested_by <> auth.uid() or r.status <> 'requested' then raise exception 'You can only withdraw your own open requests'; end if;
  update schedule_changes set status = 'cancelled', responded_at = now() where id = p_id;
  perform log_activity(r.circle_id, 'withdrew a schedule change request', null);
end $$;

create or replace function respond_agreement(p_id uuid, p_agree boolean, p_note text) returns void
language plpgsql security definer set search_path = public as $$
declare a agreements;
begin
  select * into a from agreements where id = p_id for update;
  if not found or not can_edit(a.circle_id) then raise exception 'Not found'; end if;
  if a.status <> 'proposed' then raise exception 'This has already been decided'; end if;
  if a.proposed_by = auth.uid() then raise exception 'Another parent needs to answer this'; end if;
  update agreements set status = case when p_agree then 'agreed' else 'declined' end,
    decided_by = auth.uid(), decided_at = now(), note = left(p_note, 500) where id = p_id;
  perform log_activity(a.circle_id, case when p_agree then 'agreed:' else 'didn''t agree:' end, a.title);
  insert into audit_log (circle_id, actor, action, detail) values (a.circle_id, auth.uid(), 'agreement.' || case when p_agree then 'agree' else 'decline' end, jsonb_build_object('title', a.title));
end $$;

create or replace function withdraw_agreement(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare a agreements;
begin
  select * into a from agreements where id = p_id for update;
  if not found or not can_edit(a.circle_id) then raise exception 'Not found'; end if;
  if a.proposed_by <> auth.uid() and not is_admin(a.circle_id) then raise exception 'Only the person who proposed this can withdraw it'; end if;
  if a.status not in ('proposed', 'agreed') then raise exception 'Nothing to withdraw'; end if;
  update agreements set status = 'withdrawn', decided_at = now() where id = p_id;
  perform log_activity(a.circle_id, 'withdrew', a.title);
  insert into audit_log (circle_id, actor, action, detail) values (a.circle_id, auth.uid(), 'agreement.withdraw', jsonb_build_object('title', a.title));
end $$;

create or replace function respond_expense(p_id uuid, p_approve boolean, p_note text) returns void
language plpgsql security definer set search_path = public as $$
declare e expenses;
begin
  select * into e from expenses where id = p_id for update;
  if not found or not can_edit(e.circle_id) then raise exception 'Not found'; end if;
  if e.status <> 'pending' then raise exception 'This cost has already been answered'; end if;
  if e.created_by = auth.uid() or e.paid_by = auth.uid() then raise exception 'Someone else sharing the cost needs to answer'; end if;
  if not (auth.uid() = any(e.split_between)) then raise exception 'Only people sharing this cost can answer'; end if;
  update expenses set status = case when p_approve then 'approved' else 'disputed' end,
    responded_by = auth.uid(), responded_at = now(), response_note = left(p_note, 500) where id = p_id;
  perform log_activity(e.circle_id, case when p_approve then 'approved a shared cost:' else 'queried a shared cost:' end, e.description);
  insert into audit_log (circle_id, actor, action, detail) values (e.circle_id, auth.uid(), 'expense.' || case when p_approve then 'approve' else 'query' end, jsonb_build_object('description', e.description, 'pence', e.amount_pence));
end $$;

-- Repeating tasks keep their children, source and guidance link
create or replace function complete_task(p_task uuid) returns void
language plpgsql security definer set search_path = public as $$
declare t tasks; nxt date;
begin
  select * into t from tasks where id = p_task for update;
  if not found or not (t.assignee = auth.uid() or can_edit(t.circle_id)) then raise exception 'You cannot complete this task'; end if;
  if t.status = 'done' then return; end if;
  update tasks set status = 'done', completed_at = now(), completed_by = auth.uid() where id = p_task;
  perform log_activity(t.circle_id, 'completed', t.title);
  if t.recurrence <> 'none' and t.due_date is not null then
    nxt := case t.recurrence
      when 'daily' then t.due_date + 1
      when 'weekly' then t.due_date + 7
      when 'fortnightly' then t.due_date + 14
      when 'monthly' then (t.due_date + interval '1 month')::date
      when 'annually' then (t.due_date + interval '1 year')::date
    end;
    insert into tasks (circle_id, title, description, category, assignee, due_date, due_time, recurrence, priority, status, private, created_by, child_ids, source, link_url)
    values (t.circle_id, t.title, t.description, t.category, t.assignee, nxt, t.due_time, t.recurrence, t.priority,
            case when t.assignee is null then 'open'::task_status else 'accepted'::task_status end, t.private, t.created_by, t.child_ids, t.source, t.link_url);
  end if;
end $$;

-- create_circle gains a kind
drop function create_circle(text, text, text);
create or replace function create_circle(p_person_name text, p_preferred_name text, p_relationship text, p_kind text default 'care')
returns uuid language plpgsql security definer set search_path = public as $$
declare c uuid;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  if p_kind not in ('care', 'children') then raise exception 'Unknown kind'; end if;
  insert into care_circles (person_name, preferred_name, created_by, kind)
    values (p_person_name, p_preferred_name, auth.uid(), p_kind) returning id into c;
  insert into memberships (circle_id, user_id, role, relationship) values (c, auth.uid(), 'admin', p_relationship);
  insert into person_profiles (circle_id) values (c);
  insert into visit_info (circle_id, key_contact_user) values (c, auth.uid());
  insert into emergency_info (circle_id) values (c);
  perform log_activity(c, case when p_kind = 'children' then 'set up the family' else 'created the Care Circle' end, null);
  insert into audit_log (circle_id, actor, action) values (c, auth.uid(), 'circle.create');
  return c;
end $$;

grant execute on function create_circle(text, text, text, text), nights, respond_schedule_change, cancel_schedule_change,
  respond_agreement, withdraw_agreement, respond_expense, circle_kind, my_child_ids to authenticated;

-- Invitation preview also says what kind of circle it is
drop function invitation_preview(text);
create or replace function invitation_preview(p_token text)
returns table (person text, inviter text, role circle_role, name text, valid boolean, kind text)
language sql stable security definer set search_path = public as $$
  select c.preferred_name, p.display_name, i.role, i.name,
         (i.accepted_at is null and not i.revoked and i.expires_at > now()), c.kind
  from invitations i join care_circles c on c.id = i.circle_id
  left join profiles p on p.id = i.invited_by
  where i.token = p_token
$$;
grant execute on function invitation_preview(text) to anon, authenticated;
