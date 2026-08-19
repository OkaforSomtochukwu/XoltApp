-- Xolt — live location sharing (gated by an accepted consultation) and
-- doctor discovery (nearest verified/online doctors).
--
-- Prerequisite note: "a live, accepted consultation request between them" in
-- the locations RLS needs *some* consultation table to check against, and
-- none existed yet in this fresh schema (the previous migration was
-- identity/verification only). `consultation_requests` below is a minimal
-- version added specifically to make that RLS check meaningful — it was not
-- separately specced, so treat its own RLS as a placeholder to revisit once
-- consultations become a first-class feature (e.g. patient-side cancel,
-- doctor-side completion, stricter status-transition enforcement).

-- ─────────────────────────────────────────────────────────────────────────
-- consultation_requests — prerequisite for the locations RLS below
-- ─────────────────────────────────────────────────────────────────────────

create table public.consultation_requests (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.profiles (id) on delete cascade,
  doctor_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'requested'
    check (status in ('requested', 'accepted', 'declined', 'completed', 'cancelled')),
  requested_at timestamptz not null default now(),
  responded_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.consultation_requests enable row level security;

create policy "consultation_requests_select_participant"
  on public.consultation_requests for select
  using (patient_id = auth.uid() or doctor_id = auth.uid());

create policy "consultation_requests_insert_patient"
  on public.consultation_requests for insert
  with check (
    patient_id = auth.uid()
    and status = 'requested'
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'patient')
  );

create policy "consultation_requests_update_doctor_respond"
  on public.consultation_requests for update
  using (doctor_id = auth.uid())
  with check (doctor_id = auth.uid());

create trigger consultation_requests_set_updated_at
  before update on public.consultation_requests
  for each row execute function public.set_updated_at();

-- security definer: the locations policy below needs this to hold
-- regardless of the caller's own SELECT visibility into
-- consultation_requests (which is itself RLS-scoped to participants — same
-- reasoning as `is_admin()` in the previous migration).
create or replace function public.has_live_consultation(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.consultation_requests cr
    where cr.status = 'accepted'
      and (
        (cr.patient_id = a and cr.doctor_id = b) or
        (cr.patient_id = b and cr.doctor_id = a)
      )
  );
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- locations — one row per user, current position only (not a history log)
-- ─────────────────────────────────────────────────────────────────────────

create table public.locations (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  latitude double precision not null,
  longitude double precision not null,
  accuracy double precision,
  updated_at timestamptz not null default now()
);

alter table public.locations enable row level security;

create trigger locations_set_updated_at
  before update on public.locations
  for each row execute function public.set_updated_at();

create policy "locations_all_own"
  on public.locations for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- The only other way in: the counterpart of a live (status='accepted')
-- consultation can read this user's location. Never a standing ability to
-- browse anyone's position — this policy is the entire enforcement of that.
create policy "locations_select_live_consultation_counterpart"
  on public.locations for select
  using (public.has_live_consultation(auth.uid(), user_id));

-- ─────────────────────────────────────────────────────────────────────────
-- doctor_profiles — add discovery/online-status columns
-- ─────────────────────────────────────────────────────────────────────────

alter table public.doctor_profiles
  add column is_online boolean not null default false,
  add column last_lat double precision,
  add column last_lng double precision,
  add column last_location_updated_at timestamptz;

-- ─────────────────────────────────────────────────────────────────────────
-- get_available_doctors — nearest verified + online doctors within a radius
-- security definer: doctor_profiles has no public SELECT policy on purpose
-- (see the previous migration's comment on that table) — this function is
-- the sanctioned "find a doctor" read path, returning only public-safe
-- columns, never a relaxed policy on the table itself.
-- ─────────────────────────────────────────────────────────────────────────

create or replace function public.get_available_doctors(
  p_patient_lat double precision,
  p_patient_lng double precision,
  -- Keep this default in sync with DEFAULT_SEARCH_RADIUS_KM in
  -- packages/shared/src/constants.ts — callers should pass it explicitly
  -- rather than rely on this default, but they should match regardless.
  p_radius_km double precision default 25
)
returns table (
  doctor_id uuid,
  full_name text,
  specialty text,
  years_of_experience integer,
  consultation_fee numeric,
  distance_km double precision
)
language sql
stable
security definer
set search_path = public
as $$
  with candidates as (
    select
      p.id as doctor_id,
      p.full_name,
      dp.specialty,
      dp.years_of_experience,
      dp.consultation_fee,
      -- Haversine distance in km (Earth radius 6371km). Clamp the acos
      -- argument to [-1, 1] — floating-point error can push it just past
      -- either bound for near-antipodal or near-identical points, which
      -- would otherwise make acos() return NaN.
      6371 * acos(
        least(1.0, greatest(-1.0,
          cos(radians(p_patient_lat)) * cos(radians(dp.last_lat)) *
          cos(radians(dp.last_lng) - radians(p_patient_lng)) +
          sin(radians(p_patient_lat)) * sin(radians(dp.last_lat))
        ))
      ) as distance_km
    from public.doctor_profiles dp
    join public.profiles p on p.id = dp.id
    where dp.is_online = true
      and dp.last_lat is not null
      and dp.last_lng is not null
      and exists (
        select 1 from public.doctor_verifications dv
        where dv.doctor_id = dp.id and dv.status = 'verified'
      )
  )
  select * from candidates
  where distance_km <= p_radius_km
  order by distance_km asc;
$$;
