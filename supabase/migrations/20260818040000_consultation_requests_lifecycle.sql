-- Xolt — consultation request lifecycle: status enum expansion, the
-- patient-location snapshot, accept/decline as a constrained RLS transition
-- (not an open-ended doctor UPDATE), and Realtime so both sides see changes
-- without polling.
--
-- consultation_requests already existed as a minimal placeholder (added in
-- 20260818020000 only to make the locations RLS meaningful) — this migration
-- brings it up to the real spec rather than replacing it.

-- ─────────────────────────────────────────────────────────────────────────
-- status enum: 'requested' -> 'pending', add 'in_progress'
-- ─────────────────────────────────────────────────────────────────────────

update public.consultation_requests set status = 'pending' where status = 'requested';

alter table public.consultation_requests
  alter column status set default 'pending';

alter table public.consultation_requests
  drop constraint if exists consultation_requests_status_check;

alter table public.consultation_requests
  add constraint consultation_requests_status_check
  check (status in ('pending', 'accepted', 'declined', 'in_progress', 'completed', 'cancelled'));

-- ─────────────────────────────────────────────────────────────────────────
-- new columns
-- ─────────────────────────────────────────────────────────────────────────

alter table public.consultation_requests
  add column if not exists patient_location jsonb,
  add column if not exists accepted_at timestamptz;

comment on column public.consultation_requests.patient_location is
  'Snapshot of the patient''s coordinates at request time ({latitude, longitude, accuracy}) — not live-updated; live tracking during an active consultation goes through the locations table instead.';

-- accepted_at is set by trigger, not the client — never trust a
-- client-supplied timestamp for state that gates anything.
create or replace function public.consultation_requests_set_accepted_at()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'accepted' and old.status is distinct from 'accepted' then
    new.accepted_at = now();
  end if;
  return new;
end;
$$;

create trigger consultation_requests_set_accepted_at
  before update on public.consultation_requests
  for each row execute function public.consultation_requests_set_accepted_at();

-- Columns that should only ever be set at insert. Without this, the
-- doctor's accept/decline UPDATE below has no way to be blocked from also
-- smuggling in a changed patient_id/doctor_id/patient_location — `with
-- check` alone only pins doctor_id, it doesn't stop other columns moving.
create or replace function public.consultation_requests_protect_immutable_columns()
returns trigger
language plpgsql
as $$
begin
  if new.patient_id is distinct from old.patient_id
    or new.doctor_id is distinct from old.doctor_id
    or new.patient_location is distinct from old.patient_location
    or new.created_at is distinct from old.created_at
  then
    raise exception 'patient_id, doctor_id, patient_location and created_at cannot be changed after creation';
  end if;
  return new;
end;
$$;

create trigger consultation_requests_protect_immutable_columns
  before update on public.consultation_requests
  for each row execute function public.consultation_requests_protect_immutable_columns();

-- ─────────────────────────────────────────────────────────────────────────
-- RLS: replace the placeholder insert/update policies
-- ─────────────────────────────────────────────────────────────────────────

drop policy if exists "consultation_requests_insert_patient" on public.consultation_requests;

create policy "consultation_requests_insert_patient"
  on public.consultation_requests for insert
  with check (
    patient_id = auth.uid()
    and status = 'pending'
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'patient')
  );

drop policy if exists "consultation_requests_update_doctor_respond" on public.consultation_requests;

-- Doctor can only respond to their own still-pending requests, and only to
-- accept or decline. The in_progress/completed/cancelled transitions belong
-- to later phases (call/OTP/chat) — extend with their own scoped policies
-- when those flows exist rather than widening this one into an open-ended
-- doctor UPDATE.
create policy "consultation_requests_update_doctor_respond"
  on public.consultation_requests for update
  using (doctor_id = auth.uid() and status = 'pending')
  with check (doctor_id = auth.uid() and status in ('accepted', 'declined'));

-- select_participant policy (patient sees own, doctor sees assigned only) is
-- unchanged from 20260818020000 — still correct for this spec.

-- ─────────────────────────────────────────────────────────────────────────
-- Realtime — both apps subscribe to postgres_changes on this table so a
-- new/updated request appears without a refresh. Realtime enforces RLS using
-- the connecting user's session, so this doesn't widen access on its own.
-- ─────────────────────────────────────────────────────────────────────────

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'consultation_requests'
  ) then
    alter publication supabase_realtime add table public.consultation_requests;
  end if;
end $$;
