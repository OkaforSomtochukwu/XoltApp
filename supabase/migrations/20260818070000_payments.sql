-- Xolt — payments for an accepted consultation request.
--
-- No client (patient, doctor, or otherwise) has any INSERT/UPDATE policy on
-- this table at all — only backend service-role code writes here, and only
-- after independently verifying with Paystack. This matches the original
-- design intent recorded for this project: never trust a client-reported
-- payment status. See supabase/functions/init-payment and verify-payment.

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.consultation_requests (id) on delete cascade,
  patient_id uuid not null references public.profiles (id) on delete cascade,
  doctor_id uuid not null references public.profiles (id) on delete cascade,
  amount numeric(10, 2) not null,
  provider_reference text not null unique,
  status text not null default 'pending'
    check (status in ('pending', 'verified', 'failed')),
  created_at timestamptz not null default now(),
  verified_at timestamptz
);

-- Only one active (pending/verified) payment per request at a time — a
-- failed attempt doesn't block retrying, same pattern as
-- doctor_verifications_one_active_per_doctor.
create unique index payments_one_active_per_request
  on public.payments (request_id)
  where status in ('pending', 'verified');

alter table public.payments enable row level security;

create policy "payments_select_participant"
  on public.payments for select
  using (patient_id = auth.uid() or doctor_id = auth.uid());

-- Deliberately no insert/update/delete policy for any authenticated role —
-- Edge Functions write here using the service_role key, which bypasses RLS
-- entirely. A client attempting to write directly is denied by default-deny.

-- ─────────────────────────────────────────────────────────────────────────
-- has_verified_payment — the enforcement point for a later phase
-- (OTP generation) that doesn't exist yet. Whatever database function
-- generates an OTP must call this and refuse if it returns false — the gate
-- belongs here, not in app/UI code, so it can't be bypassed by calling the
-- API directly.
-- ─────────────────────────────────────────────────────────────────────────

create or replace function public.has_verified_payment(p_request_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.payments
    where request_id = p_request_id and status = 'verified'
  );
$$;
