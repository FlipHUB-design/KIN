-- Many Hands 0008: the pre-launch waiting list.
-- Sign-ups are written by the server only (service role); nobody can read or
-- change them through the public API. The owner sees them on /waitlist/admin.

create table waitlist (
  id uuid primary key default gen_random_uuid(),
  email text not null check (length(email) between 3 and 254),
  name text check (length(name) <= 80),
  kind text not null default 'other' check (kind in ('coparent','carer','both','other')),
  note text check (length(note) <= 500),
  source text check (length(source) <= 60),   -- e.g. instagram, from ?from=instagram
  created_at timestamptz not null default now()
);
create unique index waitlist_email on waitlist (lower(email));
alter table waitlist enable row level security;
-- No policies: the public and signed-in users have no access at all.
