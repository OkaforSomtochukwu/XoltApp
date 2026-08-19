-- Xolt — initial schema: identity profiles and the doctor verification workflow.
--
-- Fresh design (not ported from any prior schema). Scope is deliberately just
-- identity/onboarding for now: profiles, patient-side profile/medical info,
-- and doctor-side profile/verification. Clinical records and the
-- patient-controlled access-grant mechanism come in a later migration.
--
-- Core rule this enforces: a patient's data is visible to nobody but that
-- patient (and, for the verification workflow, an admin reviewing a doctor's
-- submitted documents). There is no doctor access to any patient table here.

create extension if not exists pgcrypto;

-- ─────────────────────────────────────────────────────────────────────────
-- Shared helpers
-- ─────────────────────────────────────────────────────────────────────────

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- profiles — one row per auth.users row, role-discriminated
-- ─────────────────────────────────────────────────────────────────────────

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null check (role in ('patient', 'doctor', 'admin')),
  full_name text not null,
  email text not null,
  phone text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- security definer so RLS policies can check the caller's role without
-- needing a SELECT policy on profiles that would otherwise leak rows.
-- Defined here (after the table, before its first use below) because
-- `language sql` functions are validated against the catalog at CREATE time
-- — unlike plpgsql, which only resolves references when actually called.
create or replace function public.is_admin(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles where id = uid and role = 'admin'
  );
$$;

alter table public.profiles enable row level security;

create policy "profiles_select_own"
  on public.profiles for select
  using (id = auth.uid());

create policy "profiles_select_admin"
  on public.profiles for select
  using (public.is_admin(auth.uid()));

create policy "profiles_update_own"
  on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Auto-create the profile row on signup. role/full_name are read from the
-- auth.users signup metadata the client passes (`options.data` in
-- supabase-js `signUp`); role defaults to 'patient' if the client omits it.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, role, full_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'role', 'patient'),
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    new.email
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─────────────────────────────────────────────────────────────────────────
-- patient_profiles — patient-side identity details, 1:1 with profiles
-- ─────────────────────────────────────────────────────────────────────────

create table public.patient_profiles (
  id uuid primary key references public.profiles (id) on delete cascade,
  date_of_birth date,
  gender text,
  address text,
  emergency_contact_name text,
  emergency_contact_phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.patient_profiles enable row level security;

create policy "patient_profiles_all_own"
  on public.patient_profiles for all
  using (id = auth.uid())
  with check (
    id = auth.uid()
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'patient')
  );

create trigger patient_profiles_set_updated_at
  before update on public.patient_profiles
  for each row execute function public.set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────
-- patient_medical_info — clinical basics, 1:1 with profiles
-- Nobody but the patient has any access here — no doctor policy at all.
-- Doctor access to clinical data is a future, explicitly-granted mechanism.
-- ─────────────────────────────────────────────────────────────────────────

create table public.patient_medical_info (
  id uuid primary key references public.profiles (id) on delete cascade,
  blood_group text,
  genotype text,
  allergies text[],
  chronic_conditions text[],
  current_medications text[],
  past_surgeries text[],
  notes text,
  updated_at timestamptz not null default now()
);

alter table public.patient_medical_info enable row level security;

create policy "patient_medical_info_all_own"
  on public.patient_medical_info for all
  using (id = auth.uid())
  with check (
    id = auth.uid()
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'patient')
  );

create trigger patient_medical_info_set_updated_at
  before update on public.patient_medical_info
  for each row execute function public.set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────
-- doctor_profiles — doctor-side practice details, 1:1 with profiles
-- Locked to the owning doctor for now; a public "find a doctor" directory
-- should read through a security-definer function exposing only public-safe
-- columns (never a relaxed SELECT policy on this table — license_number and
-- clinic_address don't belong in a broadly-readable row).
-- ─────────────────────────────────────────────────────────────────────────

create table public.doctor_profiles (
  id uuid primary key references public.profiles (id) on delete cascade,
  specialty text,
  bio text,
  years_of_experience integer,
  consultation_fee numeric(10, 2),
  license_number text,
  clinic_name text,
  clinic_address text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.doctor_profiles enable row level security;

create policy "doctor_profiles_all_own"
  on public.doctor_profiles for all
  using (id = auth.uid())
  with check (
    id = auth.uid()
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'doctor')
  );

create trigger doctor_profiles_set_updated_at
  before update on public.doctor_profiles
  for each row execute function public.set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────
-- doctor_verifications — the verification workflow, one row per attempt
-- A doctor can submit (insert) but never update their own row: status
-- transitions are admin/service-role only, so a doctor can't self-approve.
-- ─────────────────────────────────────────────────────────────────────────

create table public.doctor_verifications (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'under_review', 'verified', 'rejected')),
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles (id),
  rejection_reason text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Only one active (pending/under_review) attempt per doctor at a time —
-- a rejected attempt doesn't block resubmission, so history is preserved
-- as separate rows rather than mutating one row in place.
create unique index doctor_verifications_one_active_per_doctor
  on public.doctor_verifications (doctor_id)
  where status in ('pending', 'under_review');

alter table public.doctor_verifications enable row level security;

create policy "doctor_verifications_select_own"
  on public.doctor_verifications for select
  using (doctor_id = auth.uid());

create policy "doctor_verifications_insert_own"
  on public.doctor_verifications for insert
  with check (
    doctor_id = auth.uid()
    and status = 'pending'
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'doctor')
  );

create policy "doctor_verifications_select_admin"
  on public.doctor_verifications for select
  using (public.is_admin(auth.uid()));

create policy "doctor_verifications_update_admin"
  on public.doctor_verifications for update
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

create trigger doctor_verifications_set_updated_at
  before update on public.doctor_verifications
  for each row execute function public.set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────
-- doctor_verification_documents — evidence uploaded for a verification
-- Immutable from the client once uploaded: no update/delete policy for the
-- doctor, so a submitted document can't be swapped after the fact.
-- doctor_id is denormalized from the parent verification so RLS here never
-- needs a join.
-- ─────────────────────────────────────────────────────────────────────────

create table public.doctor_verification_documents (
  id uuid primary key default gen_random_uuid(),
  verification_id uuid not null references public.doctor_verifications (id) on delete cascade,
  doctor_id uuid not null references public.profiles (id) on delete cascade,
  document_type text not null
    check (document_type in ('medical_license', 'id_card', 'specialty_certificate', 'other')),
  file_path text not null,
  file_name text,
  uploaded_at timestamptz not null default now()
);

alter table public.doctor_verification_documents enable row level security;

create policy "doctor_verification_documents_select_own"
  on public.doctor_verification_documents for select
  using (doctor_id = auth.uid());

create policy "doctor_verification_documents_insert_own"
  on public.doctor_verification_documents for insert
  with check (
    doctor_id = auth.uid()
    and exists (
      select 1 from public.doctor_verifications v
      where v.id = verification_id and v.doctor_id = auth.uid()
    )
  );

create policy "doctor_verification_documents_select_admin"
  on public.doctor_verification_documents for select
  using (public.is_admin(auth.uid()));
