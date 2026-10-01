-- KIN 0004: email and text alerts
-- Each person chooses how they hear about things. Alerts are written only by the
-- server (service role) after an action has succeeded, and each person can read
-- only their own.

create table notification_prefs (
  user_id uuid primary key references profiles on delete cascade,
  -- level -> channel -> on/off. Levels: answer (needs your answer), update (news for you), urgent.
  channels jsonb not null default '{"answer":{"email":true,"sms":false},"update":{"email":true,"sms":false},"urgent":{"email":true,"sms":true}}',
  digest boolean not null default true,          -- morning email summary
  quiet_start time not null default '21:00',     -- no texts between these times, except urgent ones
  quiet_end time not null default '07:00',
  updated_at timestamptz not null default now()
);
alter table notification_prefs enable row level security;
create policy "own alert settings" on notification_prefs for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create table notifications (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid references care_circles on delete cascade,
  user_id uuid not null references profiles on delete cascade,
  level text not null check (level in ('answer','update','urgent')),
  title text not null,
  body text,
  link text,
  email_status text,   -- sent, failed, off, demo, not_setup
  sms_status text,     -- sent, failed, off, demo, not_setup, no_number, quiet
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index on notifications (user_id, created_at desc);
alter table notifications enable row level security;
create policy "read own alerts" on notifications for select using (user_id = auth.uid());
create policy "mark own alerts read" on notifications for update using (user_id = auth.uid()) with check (user_id = auth.uid());
-- People can only mark alerts as read, never rewrite them, and never create them.
revoke insert, delete, update on notifications from authenticated, anon;
grant update (read_at) on notifications to authenticated;

-- When someone leaves a circle, their alerts from it go too.
create or replace function drop_alerts_on_leave() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  delete from notifications where circle_id = old.circle_id and user_id = old.user_id;
  return old;
end $$;
create trigger memberships_drop_alerts after delete on memberships
  for each row execute function drop_alerts_on_leave();
