-- KIN database schema
-- Every row belongs to a Care Circle. Row-level security (RLS) decides, on the
-- database server, who can see or change each row. The app never relies on
-- hiding things in the interface alone.


-- ---------------------------------------------------------------- types
create type circle_role as enum ('admin','family','contributor','helper','supported');
create type member_status as enum ('active','paused');
create type task_status as enum ('open','accepted','done','cancelled');
create type recurrence as enum ('none','daily','weekly','fortnightly','monthly','annually');
create type doc_access as enum ('admins','family');
create type contact_visibility as enum ('family','everyone');

-- ---------------------------------------------------------------- people
create table profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text not null default '',
  phone text,
  created_at timestamptz not null default now()
);

create table care_circles (
  id uuid primary key default gen_random_uuid(),
  person_name text not null,              -- e.g. "Margaret Hale"
  preferred_name text not null,           -- e.g. "Margaret" or "Mum"
  checkin_by time,                        -- expected daily check-in time, null = no expectation
  checkin_note text,
  checkin_dismissed_on date,              -- "mark as expected" for today's missing check-in
  created_by uuid references auth.users on delete set null,
  created_at timestamptz not null default now()
);

create table memberships (
  circle_id uuid not null references care_circles on delete cascade,
  user_id uuid not null references profiles on delete cascade,
  role circle_role not null,
  relationship text not null default '',
  status member_status not null default 'active',
  created_at timestamptz not null default now(),
  last_active_at timestamptz,
  primary key (circle_id, user_id)
);
create index on memberships (user_id);

-- Details only admins, family and the supported person should see
create table person_profiles (
  circle_id uuid primary key references care_circles on delete cascade,
  date_of_birth date,
  phone text,
  email text,
  preferred_contact text,
  important_notes text,
  accessibility_notes text,
  updated_at timestamptz not null default now()
);

-- What anyone visiting needs, including helpers
create table visit_info (
  circle_id uuid primary key references care_circles on delete cascade,
  address text,
  access_instructions text,
  key_contact_user uuid references auth.users on delete set null,
  updated_at timestamptz not null default now()
);

create table emergency_info (
  circle_id uuid primary key references care_circles on delete cascade,
  allergies text,
  important_info text,
  preferred_hospital text,
  power_of_attorney text,
  other_notes text,
  updated_by uuid references auth.users on delete set null,
  updated_at timestamptz not null default now()
);

create table invitations (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references care_circles on delete cascade,
  token text not null unique default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  name text not null,
  email text,
  role circle_role not null,
  relationship text not null default '',
  invited_by uuid references auth.users on delete set null,
  accepted_by uuid references auth.users on delete set null,
  accepted_at timestamptz,
  revoked boolean not null default false,
  expires_at timestamptz not null default now() + interval '14 days',
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- work
create table appointments (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references care_circles on delete cascade,
  title text not null,
  date date not null,
  time time,
  location text,
  attending text,
  needs_transport boolean not null default false,
  driver uuid references auth.users on delete set null,
  notes text,
  created_by uuid references auth.users on delete set null,
  created_at timestamptz not null default now()
);
create index on appointments (circle_id, date);

create table tasks (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references care_circles on delete cascade,
  title text not null,
  description text,
  category text not null default 'Other',
  assignee uuid references auth.users on delete set null,
  due_date date,
  due_time time,
  recurrence recurrence not null default 'none',
  priority text not null default 'normal',
  status task_status not null default 'open',
  private boolean not null default false,       -- hidden from contributors and helpers
  appointment_id uuid references appointments on delete cascade,
  completed_at timestamptz,
  completed_by uuid references auth.users on delete set null,
  created_by uuid references auth.users on delete set null,
  created_at timestamptz not null default now()
);
create index on tasks (circle_id, due_date);
create index on tasks (assignee);

create table task_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks on delete cascade,
  circle_id uuid not null references care_circles on delete cascade,
  author uuid references auth.users on delete set null,
  body text not null check (length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index on task_comments (task_id);

create table checkins (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references care_circles on delete cascade,
  user_id uuid references auth.users on delete set null,
  checked_in_at timestamptz not null default now(),
  checked_out_at timestamptz,
  mood text check (mood in ('Good','OK','Needs attention')),
  note text,
  created_at timestamptz not null default now()
);
create index on checkins (circle_id, checked_in_at desc);

create table activity (
  id bigint generated always as identity primary key,
  circle_id uuid not null references care_circles on delete cascade,
  actor uuid references auth.users on delete set null,
  verb text not null,
  subject text,
  created_at timestamptz not null default now()
);
create index on activity (circle_id, created_at desc);

create table contacts (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references care_circles on delete cascade,
  name text not null,
  organisation text,
  category text not null default 'Other',
  phone text,
  email text,
  notes text,
  visibility contact_visibility not null default 'family',
  created_at timestamptz not null default now()
);

create table home_assets (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references care_circles on delete cascade,
  name text not null,
  details text,
  last_service date,
  next_service date,
  warranty_expiry date,
  supplier text,
  notes text,
  created_at timestamptz not null default now()
);

create table documents (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references care_circles on delete cascade,
  name text not null,
  category text not null default 'Other',
  storage_path text not null unique,        -- "<circle_id>/<uuid>-<filename>"
  expiry_date date,
  access doc_access not null default 'family',
  notes text,
  uploaded_by uuid references auth.users on delete set null,
  created_at timestamptz not null default now()
);

create table audit_log (
  id bigint generated always as identity primary key,
  circle_id uuid references care_circles on delete cascade,
  actor uuid references auth.users on delete set null,
  action text not null,
  detail jsonb,
  created_at timestamptz not null default now()
);
create index on audit_log (circle_id, created_at desc);

-- ---------------------------------------------------------------- helpers
-- The caller's active role in a circle (null if not an active member).
create or replace function my_role(c uuid) returns circle_role
language sql stable security definer set search_path = public as $$
  select role from memberships
  where circle_id = c and user_id = auth.uid() and status = 'active'
$$;

create or replace function has_role(c uuid, roles circle_role[]) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(my_role(c) = any(roles), false)
$$;

-- Admins, family and the supported person see the full picture.
create or replace function is_inner(c uuid) returns boolean
language sql stable as $$ select has_role(c, array['admin','family','supported']::circle_role[]) $$;

create or replace function can_edit(c uuid) returns boolean
language sql stable as $$ select has_role(c, array['admin','family']::circle_role[]) $$;

create or replace function is_admin(c uuid) returns boolean
language sql stable as $$ select has_role(c, array['admin']::circle_role[]) $$;

create or replace function is_member(c uuid) returns boolean
language sql stable as $$ select my_role(c) is not null $$;

-- Do two users share an active circle? (for reading each other's names)
create or replace function shares_circle(other uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from memberships a join memberships b on a.circle_id = b.circle_id
    where a.user_id = auth.uid() and b.user_id = other and a.status = 'active'
  )
$$;

create or replace function log_activity(c uuid, v text, s text) returns void
language sql security definer set search_path = public as $$
  insert into activity (circle_id, actor, verb, subject) values (c, auth.uid(), v, s);
  update memberships set last_active_at = now() where circle_id = c and user_id = auth.uid();
$$;

-- ---------------------------------------------------------------- RLS
alter table profiles enable row level security;
alter table care_circles enable row level security;
alter table memberships enable row level security;
alter table person_profiles enable row level security;
alter table visit_info enable row level security;
alter table emergency_info enable row level security;
alter table invitations enable row level security;
alter table appointments enable row level security;
alter table tasks enable row level security;
alter table task_comments enable row level security;
alter table checkins enable row level security;
alter table activity enable row level security;
alter table contacts enable row level security;
alter table home_assets enable row level security;
alter table documents enable row level security;
alter table audit_log enable row level security;

-- profiles
create policy "read own or circle-mates" on profiles for select using (id = auth.uid() or shares_circle(id));
create policy "insert own" on profiles for insert with check (id = auth.uid());
create policy "update own" on profiles for update using (id = auth.uid());

-- circles
create policy "members read circle" on care_circles for select using (is_member(id));
create policy "admins update circle" on care_circles for update using (is_admin(id));
create policy "admins delete circle" on care_circles for delete using (is_admin(id));
-- (circles are created through create_circle())

-- memberships: everyone in a circle can see who is in it; only admins change it
create policy "members read memberships" on memberships for select using (is_member(circle_id) or user_id = auth.uid());
create policy "admins update memberships" on memberships for update using (is_admin(circle_id) and user_id <> auth.uid());
create policy "admins remove members" on memberships for delete using (is_admin(circle_id) and user_id <> auth.uid());
create policy "leave circle" on memberships for delete using (user_id = auth.uid() and role <> 'admin');

create policy "inner read person" on person_profiles for select using (is_inner(circle_id));
create policy "admins write person" on person_profiles for all using (is_admin(circle_id)) with check (is_admin(circle_id));

create policy "members read visit info" on visit_info for select using (is_member(circle_id));
create policy "editors write visit info" on visit_info for all using (can_edit(circle_id)) with check (can_edit(circle_id));

create policy "inner read emergency" on emergency_info for select using (is_inner(circle_id));
create policy "editors write emergency" on emergency_info for all using (can_edit(circle_id)) with check (can_edit(circle_id));

create policy "admins manage invitations" on invitations for all using (is_admin(circle_id)) with check (is_admin(circle_id) and invited_by = auth.uid());

-- appointments: helpers never see them
create policy "read appointments" on appointments for select
  using (has_role(circle_id, array['admin','family','supported','contributor']::circle_role[]));
create policy "editors write appointments" on appointments for all using (can_edit(circle_id)) with check (can_edit(circle_id));

-- tasks
create policy "read tasks" on tasks for select using (
  is_inner(circle_id)
  or (my_role(circle_id) = 'contributor' and (assignee = auth.uid() or (assignee is null and not private)))
  or (my_role(circle_id) = 'helper' and assignee = auth.uid())
);
create policy "create tasks" on tasks for insert with check (
  created_by = auth.uid() and (
    can_edit(circle_id)
    or (my_role(circle_id) = 'contributor' and not private and (assignee is null or assignee = auth.uid()))
  )
);
create policy "editors update tasks" on tasks for update using (can_edit(circle_id)) with check (can_edit(circle_id));
create policy "editors delete tasks" on tasks for delete using (can_edit(circle_id));
-- contributors and helpers change their own tasks only through claim/decline/complete functions below

create policy "read comments" on task_comments for select using (
  has_role(circle_id, array['admin','family','supported','contributor']::circle_role[])
  and exists (select 1 from tasks t where t.id = task_id)  -- respects task RLS
);
create policy "write comments" on task_comments for insert with check (
  author = auth.uid()
  and has_role(circle_id, array['admin','family','supported','contributor']::circle_role[])
  and exists (select 1 from tasks t where t.id = task_id and t.circle_id = task_comments.circle_id)
);

-- check-ins
create policy "read checkins" on checkins for select using (
  has_role(circle_id, array['admin','family','supported','contributor']::circle_role[]) or user_id = auth.uid()
);
create policy "own checkins" on checkins for insert with check (user_id = auth.uid() and is_member(circle_id));
create policy "update own checkins" on checkins for update using (user_id = auth.uid());

-- activity: the full timeline is for the inner circle; others see their own entries
create policy "read activity" on activity for select using (is_inner(circle_id) or actor = auth.uid());

create policy "read contacts" on contacts for select using (
  is_inner(circle_id)
  or (is_member(circle_id) and visibility = 'everyone')
);
create policy "editors write contacts" on contacts for all using (can_edit(circle_id)) with check (can_edit(circle_id));

create policy "inner read assets" on home_assets for select using (is_inner(circle_id));
create policy "editors write assets" on home_assets for all using (can_edit(circle_id)) with check (can_edit(circle_id));

create policy "read documents" on documents for select using (
  is_admin(circle_id) or (access = 'family' and is_inner(circle_id))
);
create policy "editors add documents" on documents for insert with check (can_edit(circle_id) and uploaded_by = auth.uid());
create policy "editors change documents" on documents for update using (can_edit(circle_id));
create policy "admins delete documents" on documents for delete using (is_admin(circle_id) or uploaded_by = auth.uid());

create policy "admins read audit" on audit_log for select using (is_admin(circle_id));
create policy "members write audit" on audit_log for insert with check (actor = auth.uid() and is_member(circle_id));

-- ---------------------------------------------------------------- functions
-- New user → profile row
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email,'@',1)));
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

create or replace function create_circle(p_person_name text, p_preferred_name text, p_relationship text)
returns uuid language plpgsql security definer set search_path = public as $$
declare c uuid;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  insert into care_circles (person_name, preferred_name, created_by)
    values (p_person_name, p_preferred_name, auth.uid()) returning id into c;
  insert into memberships (circle_id, user_id, role, relationship) values (c, auth.uid(), 'admin', p_relationship);
  insert into person_profiles (circle_id) values (c);
  insert into visit_info (circle_id, key_contact_user) values (c, auth.uid());
  insert into emergency_info (circle_id) values (c);
  perform log_activity(c, 'created the Care Circle', null);
  insert into audit_log (circle_id, actor, action) values (c, auth.uid(), 'circle.create');
  return c;
end $$;

-- Look up an invitation before signing in (returns only what the invite page needs)
create or replace function invitation_preview(p_token text)
returns table (person text, inviter text, role circle_role, name text, valid boolean)
language sql stable security definer set search_path = public as $$
  select c.preferred_name, p.display_name, i.role, i.name,
         (i.accepted_at is null and not i.revoked and i.expires_at > now())
  from invitations i join care_circles c on c.id = i.circle_id
  left join profiles p on p.id = i.invited_by
  where i.token = p_token
$$;

create or replace function accept_invitation(p_token text) returns uuid
language plpgsql security definer set search_path = public as $$
declare i invitations;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  select * into i from invitations where token = p_token for update;
  if not found or i.revoked or i.accepted_at is not null or i.expires_at < now() then
    raise exception 'This invitation is no longer valid';
  end if;
  insert into memberships (circle_id, user_id, role, relationship)
    values (i.circle_id, auth.uid(), i.role, i.relationship)
    on conflict (circle_id, user_id) do nothing;
  update invitations set accepted_by = auth.uid(), accepted_at = now() where id = i.id;
  perform log_activity(i.circle_id, 'joined the Care Circle', null);
  insert into audit_log (circle_id, actor, action, detail) values (i.circle_id, auth.uid(), 'invitation.accept', jsonb_build_object('role', i.role));
  return i.circle_id;
end $$;

create or replace function claim_task(p_task uuid) returns void
language plpgsql security definer set search_path = public as $$
declare t tasks;
begin
  select * into t from tasks where id = p_task for update;
  if not found then raise exception 'Task not found'; end if;
  if not (can_edit(t.circle_id)
          or (my_role(t.circle_id) = 'contributor' and not t.private)
          or (my_role(t.circle_id) = 'supported')) then
    raise exception 'You cannot take this task';
  end if;
  if t.assignee is not null and t.assignee <> auth.uid() then raise exception 'Someone has already taken this task'; end if;
  update tasks set assignee = auth.uid(), status = 'accepted' where id = p_task;
  if t.appointment_id is not null then
    update appointments set driver = auth.uid() where id = t.appointment_id;
    perform log_activity(t.circle_id, 'is driving for', t.title);
  else
    perform log_activity(t.circle_id, 'accepted', t.title);
  end if;
end $$;

create or replace function decline_task(p_task uuid) returns void
language plpgsql security definer set search_path = public as $$
declare t tasks;
begin
  select * into t from tasks where id = p_task for update;
  if not found or not (t.assignee = auth.uid() or can_edit(t.circle_id)) then raise exception 'You cannot hand back this task'; end if;
  update tasks set assignee = null, status = 'open' where id = p_task;
  if t.appointment_id is not null then update appointments set driver = null where id = t.appointment_id; end if;
  perform log_activity(t.circle_id, 'handed back', t.title);
end $$;

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
    insert into tasks (circle_id, title, description, category, assignee, due_date, due_time, recurrence, priority, status, private, created_by)
    values (t.circle_id, t.title, t.description, t.category, t.assignee, nxt, t.due_time, t.recurrence, t.priority,
            case when t.assignee is null then 'open'::task_status else 'accepted'::task_status end, t.private, t.created_by);
  end if;
end $$;

-- Only called by the app after inserting a check-in or task etc. (members only)
create or replace function record_activity(p_circle uuid, p_verb text, p_subject text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_member(p_circle) then raise exception 'Not a member'; end if;
  perform log_activity(p_circle, left(p_verb,120), left(p_subject,200));
end $$;

-- Family can mark today's missing check-in as expected
create or replace function dismiss_missed_checkin(p_circle uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not can_edit(p_circle) then raise exception 'Only family can do this'; end if;
  update care_circles set checkin_dismissed_on = (now() at time zone 'Europe/London')::date where id = p_circle;
  perform log_activity(p_circle, 'marked today''s missing check-in as expected', null);
end $$;

grant execute on function dismiss_missed_checkin to authenticated;
grant execute on function create_circle, invitation_preview, accept_invitation, claim_task, decline_task, complete_task, record_activity to authenticated;
grant execute on function invitation_preview to anon;
revoke execute on function log_activity from public, anon, authenticated;

-- ---------------------------------------------------------------- storage
insert into storage.buckets (id, name, public) values ('documents','documents', false)
  on conflict (id) do nothing;

create policy "read permitted documents" on storage.objects for select
  using (bucket_id = 'documents' and exists (select 1 from public.documents d where d.storage_path = storage.objects.name));
create policy "editors upload documents" on storage.objects for insert
  with check (bucket_id = 'documents' and public.can_edit(((storage.foldername(name))[1])::uuid));
create policy "editors delete documents" on storage.objects for delete
  using (bucket_id = 'documents' and public.can_edit(((storage.foldername(name))[1])::uuid));
