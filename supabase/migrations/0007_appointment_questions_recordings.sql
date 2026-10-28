-- KIN 0007: questions the family wants asked at an appointment, and recordings
-- of the appointment that KIN turns into a transcript and a short summary.

-- ---------------------------------------------------------------- questions
create table appointment_questions (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references care_circles on delete cascade,
  appointment_id uuid not null references appointments on delete cascade,
  body text not null check (length(body) between 1 and 300),
  added_by uuid references profiles on delete set null,
  created_at timestamptz not null default now(),
  asked boolean not null default false,
  answer text check (length(answer) <= 2000),
  answered_by uuid references profiles on delete set null,   -- null when the answer came from a recording
  answered_at timestamptz
);
create index on appointment_questions (appointment_id, created_at);
alter table appointment_questions enable row level security;

-- Anyone who can see the appointment (except helpers) can read, add and tick off questions
create policy "read questions" on appointment_questions for select using (
  has_role(circle_id, array['admin','family','supported','contributor']::circle_role[])
  and can_see_subject(circle_id, 'appointment', appointment_id)
);
create policy "add questions" on appointment_questions for insert with check (
  added_by = auth.uid()
  and has_role(circle_id, array['admin','family','supported','contributor']::circle_role[])
  and can_see_subject(circle_id, 'appointment', appointment_id)
);
create policy "tick off questions" on appointment_questions for update using (
  has_role(circle_id, array['admin','family','supported','contributor']::circle_role[])
  and can_see_subject(circle_id, 'appointment', appointment_id)
) with check (
  has_role(circle_id, array['admin','family','supported','contributor']::circle_role[])
  and can_see_subject(circle_id, 'appointment', appointment_id)
);
create policy "remove questions" on appointment_questions for delete using (added_by = auth.uid() or can_edit(circle_id));

-- ---------------------------------------------------------------- recordings
-- Health conversations: only the inner circle (administrators, family and the
-- person themselves) can hear or read them.
create table appointment_recordings (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references care_circles on delete cascade,
  appointment_id uuid not null references appointments on delete cascade,
  storage_path text unique,                 -- "<circle_id>/<uuid>.<ext>", null once the audio is deleted
  mime text,
  seconds int check (seconds between 0 and 7200),
  consent_confirmed boolean not null check (consent_confirmed),  -- the recorder confirmed the clinician agreed
  status text not null default 'saved' check (status in ('saved','transcribing','done','failed')),
  transcript text,
  summary jsonb,
  recorded_by uuid references profiles on delete set null,
  created_at timestamptz not null default now(),
  audio_deleted_at timestamptz
);
create index on appointment_recordings (appointment_id, created_at);
alter table appointment_recordings enable row level security;
create policy "inner read recordings" on appointment_recordings for select using (
  is_inner(circle_id) and can_see_subject(circle_id, 'appointment', appointment_id)
);
create policy "inner add recordings" on appointment_recordings for insert with check (
  recorded_by = auth.uid() and is_inner(circle_id) and can_see_subject(circle_id, 'appointment', appointment_id)
  and status = 'saved' and transcript is null and summary is null
  and split_part(storage_path, '/', 1) = circle_id::text
);
create policy "remove recordings" on appointment_recordings for delete using (recorded_by = auth.uid() or can_edit(circle_id));
-- Transcripts and summaries are written by the server only (no update policy for people)

-- ---------------------------------------------------------------- audio files
insert into storage.buckets (id, name, public) values ('recordings', 'recordings', false) on conflict (id) do nothing;
create policy "inner upload recordings" on storage.objects for insert
  with check (bucket_id = 'recordings' and public.is_inner(((storage.foldername(name))[1])::uuid));
create policy "inner listen to recordings" on storage.objects for select
  using (bucket_id = 'recordings' and exists (select 1 from public.appointment_recordings r where r.storage_path = storage.objects.name));
create policy "remove recording audio" on storage.objects for delete
  using (bucket_id = 'recordings' and exists (select 1 from public.appointment_recordings r where r.storage_path = storage.objects.name
    and (r.recorded_by = auth.uid() or public.can_edit(r.circle_id))));

-- ---------------------------------------------------------------- AI limits
alter table ai_usage drop constraint if exists ai_usage_kind_check;
alter table ai_usage add constraint ai_usage_kind_check check (kind in ('setup','help','letter','tone','email','transcribe'));
