-- KIN 0002: letter reading, playbooks and shared costs

-- Letters read by KIN. The letter itself is kept as a normal document; this
-- holds what was found in it and which suggestions became tasks.
create table letter_scans (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references care_circles on delete cascade,
  document_id uuid references documents on delete set null,
  result jsonb not null,                 -- organisation, summary, suggested tasks
  source text not null default 'ai',     -- 'ai' or 'sample'
  created_by uuid references auth.users on delete set null,
  created_at timestamptz not null default now()
);
create index on letter_scans (circle_id, created_at desc);

-- Tasks remember which playbook or letter they came from
alter table tasks add column source text;          -- e.g. 'playbook:attendance-allowance', 'letter:<id>'
alter table tasks add column link_url text;        -- official guidance for the step

-- Shared costs between family members
create table expenses (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references care_circles on delete cascade,
  description text not null check (length(description) between 1 and 200),
  category text not null default 'Other',
  amount_pence integer not null check (amount_pence > 0 and amount_pence < 100000000),
  paid_by uuid not null references profiles on delete cascade,
  split_between uuid[] not null check (cardinality(split_between) > 0),
  spent_on date not null default current_date,
  created_by uuid references auth.users on delete set null,
  created_at timestamptz not null default now()
);
create index on expenses (circle_id, spent_on desc);

create table settlements (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references care_circles on delete cascade,
  from_user uuid not null references profiles on delete cascade,
  to_user uuid not null references profiles on delete cascade,
  amount_pence integer not null check (amount_pence > 0 and amount_pence < 100000000),
  paid_on date not null default current_date,
  note text,
  created_by uuid references auth.users on delete set null,
  created_at timestamptz not null default now(),
  check (from_user <> to_user)
);

alter table letter_scans enable row level security;
alter table expenses enable row level security;
alter table settlements enable row level security;

-- Letters: administrators and family
create policy "family read letters" on letter_scans for select using (can_edit(circle_id));
create policy "family add letters" on letter_scans for insert with check (can_edit(circle_id) and created_by = auth.uid());
create policy "family change letters" on letter_scans for update using (can_edit(circle_id));
create policy "family delete letters" on letter_scans for delete using (can_edit(circle_id));

-- Money: administrators and family only. Everyone named must be an active
-- family member of the circle.
create or replace function all_family(c uuid, ids uuid[]) returns boolean
language sql stable security definer set search_path = public as $$
  select not exists (
    select 1 from unnest(ids) u
    where not exists (select 1 from memberships m where m.circle_id = c and m.user_id = u
                        and m.role in ('admin','family') and m.status = 'active')
  )
$$;

create policy "family read expenses" on expenses for select using (can_edit(circle_id));
create policy "family add expenses" on expenses for insert with check (
  can_edit(circle_id) and created_by = auth.uid() and all_family(circle_id, split_between || paid_by)
);
create policy "own or admin delete expenses" on expenses for delete using (
  can_edit(circle_id) and (created_by = auth.uid() or is_admin(circle_id))
);

create policy "family read settlements" on settlements for select using (can_edit(circle_id));
create policy "family add settlements" on settlements for insert with check (
  can_edit(circle_id) and created_by = auth.uid() and all_family(circle_id, array[from_user, to_user])
);
create policy "own or admin delete settlements" on settlements for delete using (
  can_edit(circle_id) and (created_by = auth.uid() or is_admin(circle_id))
);

grant execute on function all_family to authenticated;
