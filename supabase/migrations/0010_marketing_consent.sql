-- Many Hands 0010: "Keep me in the loop" marketing consent.
-- Off unless the person ticks the box; we record when they agreed.

alter table profiles add column marketing_opt_in boolean not null default false;
alter table profiles add column marketing_opt_in_at timestamptz;
alter table waitlist add column marketing_opt_in boolean not null default false;
alter table waitlist add column marketing_opt_in_at timestamptz;

-- New accounts carry the choice from the sign-up form
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare opt boolean := coalesce((new.raw_user_meta_data->>'marketing_opt_in')::boolean, false);
begin
  insert into profiles (id, display_name, marketing_opt_in, marketing_opt_in_at)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email,'@',1)),
          opt, case when opt then now() else null end);
  return new;
end $$;
