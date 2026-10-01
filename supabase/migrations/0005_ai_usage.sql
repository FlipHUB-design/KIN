-- KIN 0005: daily limits for AI features (guided setup and the help chat)
-- Only the server (service role) reads or writes this table.
create table ai_usage (
  user_id uuid not null references profiles on delete cascade,
  day date not null default current_date,
  kind text not null check (kind in ('setup','help','letter')),
  count int not null default 0,
  primary key (user_id, day, kind)
);
alter table ai_usage enable row level security;
revoke all on ai_usage from authenticated, anon;
