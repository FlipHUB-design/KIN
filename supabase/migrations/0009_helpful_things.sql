-- Many Hands 0009: "Helpful things" product suggestions.

-- App-wide switches the owner sets from the dashboard (server access only).
create table app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
alter table app_settings enable row level security;

-- Anyone can hide the suggestions for themselves.
alter table profiles add column hide_helpful boolean not null default false;

-- Which suggestions people open, for the owner's dashboard (no product or purchase data).
create table helpful_clicks (
  id bigint generated always as identity primary key,
  item text not null check (length(item) <= 60),
  list text check (length(list) <= 60),
  place text check (length(place) <= 30),     -- where it was shown: page, playbook, handover
  kind text check (kind in ('care','children')),
  created_at timestamptz not null default now()
);
alter table helpful_clicks enable row level security;
