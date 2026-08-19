-- Xolt — the actual enforcement of "a patient owns their medical data": a
-- doctor has zero standing access to any patient's records. Access exists
-- only after an OTP the patient generates and reads out is entered by the
-- doctor, is scoped to that (patient, doctor) pair, and is revocable by the
-- patient at any time. record_access_grants is the one source of truth this
-- is checked against — not consultation_requests.status, not payments.

-- ─────────────────────────────────────────────────────────────────────────
-- record_access_grants
-- ─────────────────────────────────────────────────────────────────────────

create table public.record_access_grants (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.profiles (id) on delete cascade,
  doctor_id uuid not null references public.profiles (id) on delete cascade,
  request_id uuid not null references public.consultation_requests (id) on delete cascade,
  status text not null check (status in ('granted', 'revoked')),
  granted_at timestamptz,
  revoked_at timestamptz
);

-- Only one ACTIVE grant per (patient, doctor) pair — a revoked history can
-- have many rows (grant, revoke, grant again...), this only constrains the
-- currently-granted one. Also the ON CONFLICT target verify_request_otp
-- upserts into below, so re-granting an already-granted pair is idempotent
-- rather than a constraint violation.
create unique index record_access_grants_one_active_per_pair
  on public.record_access_grants (patient_id, doctor_id)
  where status = 'granted';

alter table public.record_access_grants enable row level security;

create policy "record_access_grants_select_participant"
  on public.record_access_grants for select
  using (patient_id = auth.uid() or doctor_id = auth.uid());

-- No insert policy at all — grants are only ever created by
-- verify_request_otp (security definer, bypasses this). Only the patient
-- can revoke, only their own currently-granted row, only to 'revoked'.
create policy "record_access_grants_update_revoke_own"
  on public.record_access_grants for update
  using (patient_id = auth.uid() and status = 'granted')
  with check (patient_id = auth.uid() and status = 'revoked');

create or replace function public.record_access_grants_set_revoked_at()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'revoked' and old.status is distinct from 'revoked' then
    new.revoked_at = now();
  end if;
  return new;
end;
$$;

create trigger record_access_grants_set_revoked_at
  before update on public.record_access_grants
  for each row execute function public.record_access_grants_set_revoked_at();

-- Same class of gap as consultation_requests had before it: without this,
-- the patient's revoke UPDATE (RLS only pins status + patient_id) has no
-- protection against also changing doctor_id/request_id/granted_at in the
-- same payload.
create or replace function public.record_access_grants_protect_immutable_columns()
returns trigger
language plpgsql
as $$
begin
  if new.patient_id is distinct from old.patient_id
    or new.doctor_id is distinct from old.doctor_id
    or new.request_id is distinct from old.request_id
    or new.granted_at is distinct from old.granted_at
  then
    raise exception 'patient_id, doctor_id, request_id and granted_at cannot be changed after creation';
  end if;
  return new;
end;
$$;

create trigger record_access_grants_protect_immutable_columns
  before update on public.record_access_grants
  for each row execute function public.record_access_grants_protect_immutable_columns();

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'record_access_grants'
  ) then
    alter publication supabase_realtime add table public.record_access_grants;
  end if;
end $$;

-- ─────────────────────────────────────────────────────────────────────────
-- access_history — append-only. No update/delete policy for anyone, ever.
-- 'requested'/'granted'/'revoked' are trigger-written (security definer, so
-- they write regardless of the invoking client's own access_history
-- permissions); 'viewed' is the one event a doctor can write directly, and
-- only while they currently hold an active grant for that patient.
-- ─────────────────────────────────────────────────────────────────────────

create table public.access_history (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.profiles (id) on delete cascade,
  doctor_id uuid not null references public.profiles (id) on delete cascade,
  event text not null check (event in ('requested', 'granted', 'revoked', 'viewed')),
  created_at timestamptz not null default now()
);

alter table public.access_history enable row level security;

create policy "access_history_select_participant"
  on public.access_history for select
  using (patient_id = auth.uid() or doctor_id = auth.uid());

create policy "access_history_insert_doctor_viewed"
  on public.access_history for insert
  with check (
    doctor_id = auth.uid()
    and event = 'viewed'
    and exists (
      select 1 from public.record_access_grants g
      where g.doctor_id = auth.uid() and g.patient_id = access_history.patient_id and g.status = 'granted'
    )
  );

create or replace function public.log_requested_history()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.access_history (patient_id, doctor_id, event)
  values (new.patient_id, new.doctor_id, 'requested');
  return new;
end;
$$;

create trigger consultation_requests_log_requested
  after insert on public.consultation_requests
  for each row execute function public.log_requested_history();

create or replace function public.log_grant_history()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' and new.status = 'granted' then
    insert into public.access_history (patient_id, doctor_id, event) values (new.patient_id, new.doctor_id, 'granted');
  elsif tg_op = 'UPDATE' and new.status = 'granted' and old.status is distinct from 'granted' then
    insert into public.access_history (patient_id, doctor_id, event) values (new.patient_id, new.doctor_id, 'granted');
  elsif tg_op = 'UPDATE' and new.status = 'revoked' and old.status is distinct from 'revoked' then
    insert into public.access_history (patient_id, doctor_id, event) values (new.patient_id, new.doctor_id, 'revoked');
  end if;
  return new;
end;
$$;

create trigger record_access_grants_log_history
  after insert or update on public.record_access_grants
  for each row execute function public.log_grant_history();

-- ─────────────────────────────────────────────────────────────────────────
-- request_otps — fully locked, same as payments: no client policy of any
-- kind. Only generate_request_otp/verify_request_otp ever touch this.
-- ─────────────────────────────────────────────────────────────────────────

create table public.request_otps (
  request_id uuid primary key references public.consultation_requests (id) on delete cascade,
  code_hash text not null,
  expires_at timestamptz not null,
  attempts integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.request_otps enable row level security;

-- ─────────────────────────────────────────────────────────────────────────
-- generate_request_otp / verify_request_otp — security definer, mirroring
-- the pattern used elsewhere in this schema for multi-effect, tightly
-- authorized transitions (see init-payment/verify-payment's Edge Function
-- equivalent, and consultation_requests' accept/decline). Each function
-- re-checks identity/authorization itself since security definer bypasses
-- RLS on the tables it touches.
-- ─────────────────────────────────────────────────────────────────────────

create or replace function public.generate_request_otp(p_request_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.consultation_requests;
  v_code text;
begin
  select * into v_request from public.consultation_requests where id = p_request_id;

  if v_request is null then
    raise exception 'Request not found';
  end if;
  if v_request.patient_id <> auth.uid() then
    raise exception 'This request does not belong to you';
  end if;
  if v_request.status <> 'accepted' then
    raise exception 'Request must be accepted before generating a code';
  end if;
  if not public.has_verified_payment(p_request_id) then
    raise exception 'Payment must be verified before generating a code';
  end if;

  v_code := lpad(floor(random() * 1000000)::text, 6, '0');

  insert into public.request_otps (request_id, code_hash, expires_at, attempts)
  values (p_request_id, crypt(v_code, gen_salt('bf')), now() + interval '10 minutes', 0)
  on conflict (request_id) do update
    set code_hash = excluded.code_hash,
        expires_at = excluded.expires_at,
        attempts = 0,
        created_at = now();

  return v_code;
end;
$$;

create or replace function public.verify_request_otp(p_request_id uuid, p_code text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.consultation_requests;
  v_otp public.request_otps;
  v_max_attempts constant integer := 5;
begin
  select * into v_request from public.consultation_requests where id = p_request_id;

  if v_request is null then
    raise exception 'Request not found';
  end if;
  if v_request.doctor_id <> auth.uid() then
    raise exception 'This request is not assigned to you';
  end if;

  select * into v_otp from public.request_otps where request_id = p_request_id;

  if v_otp is null or v_otp.expires_at < now() then
    return false;
  end if;
  if v_otp.attempts >= v_max_attempts then
    return false;
  end if;

  update public.request_otps set attempts = attempts + 1 where request_id = p_request_id;

  if crypt(p_code, v_otp.code_hash) <> v_otp.code_hash then
    return false;
  end if;

  insert into public.record_access_grants (patient_id, doctor_id, request_id, status, granted_at)
  values (v_request.patient_id, v_request.doctor_id, p_request_id, 'granted', now())
  on conflict (patient_id, doctor_id) where status = 'granted'
  do update set request_id = excluded.request_id, granted_at = excluded.granted_at;

  update public.consultation_requests set status = 'in_progress' where id = p_request_id;

  delete from public.request_otps where request_id = p_request_id;

  return true;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- medical_records — diagnostic results, consultation notes, diagnoses,
-- medications. Doctor-authored clinical data; the patient's own
-- patient_medical_info (self-reported blood group/allergies/etc, a
-- different table) is unaffected by any of this.
-- ─────────────────────────────────────────────────────────────────────────

create table public.medical_records (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.profiles (id) on delete cascade,
  doctor_id uuid not null references public.profiles (id) on delete cascade,
  request_id uuid not null references public.consultation_requests (id) on delete cascade,
  record_type text not null
    check (record_type in ('consultation_note', 'diagnosis', 'medication', 'diagnostic_result')),
  title text,
  content jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.medical_records enable row level security;

-- Always visible to the patient it belongs to, unconditionally.
create policy "medical_records_select_patient_own"
  on public.medical_records for select
  using (patient_id = auth.uid());

-- Gated purely on holding an active grant *right now* — even the doctor who
-- wrote a record loses read access once the patient revokes. No exceptions.
create policy "medical_records_select_doctor_granted"
  on public.medical_records for select
  using (
    exists (
      select 1 from public.record_access_grants g
      where g.doctor_id = auth.uid() and g.patient_id = medical_records.patient_id and g.status = 'granted'
    )
  );

create policy "medical_records_insert_doctor_granted"
  on public.medical_records for insert
  with check (
    doctor_id = auth.uid()
    and exists (
      select 1 from public.record_access_grants g
      where g.doctor_id = auth.uid() and g.patient_id = medical_records.patient_id and g.status = 'granted'
    )
  );

-- No update/delete policy for anyone — once written, a record is immutable;
-- amendments are new rows, preserving the clinical history intact.
