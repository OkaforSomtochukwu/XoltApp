-- Xolt — admin dashboard support: read-only admin visibility into
-- consultation_requests/payments/doctor_profiles (profiles,
-- doctor_verifications and doctor_verification_documents already have
-- admin SELECT from 20260818000000), tightened doctor_verifications
-- update behavior, and a private storage bucket for verification
-- documents.
--
-- Admin auth itself has no self-signup — accounts are created directly in
-- the Supabase dashboard/DB (profiles.role = 'admin'), enforced by
-- apps/admin having no signup route at all. What this migration adds is
-- the RLS surface admin needs, all read-only except doctor_verifications.

-- ─────────────────────────────────────────────────────────────────────────
-- Read-only admin access
-- ─────────────────────────────────────────────────────────────────────────

create policy "consultation_requests_select_admin"
  on public.consultation_requests for select
  using (public.is_admin(auth.uid()));

create policy "payments_select_admin"
  on public.payments for select
  using (public.is_admin(auth.uid()));

create policy "doctor_profiles_select_admin"
  on public.doctor_profiles for select
  using (public.is_admin(auth.uid()));

-- ─────────────────────────────────────────────────────────────────────────
-- doctor_verifications — tighten the existing admin update policy.
-- It already exists (using/with check is_admin()) but has no column
-- protection at all: an admin update could currently smuggle in a changed
-- doctor_id or submitted_at. Same reasoning as
-- consultation_requests_protect_immutable_columns.
-- ─────────────────────────────────────────────────────────────────────────

create or replace function public.doctor_verifications_protect_immutable_columns()
returns trigger
language plpgsql
as $$
begin
  if new.doctor_id is distinct from old.doctor_id
    or new.submitted_at is distinct from old.submitted_at
    or new.created_at is distinct from old.created_at
  then
    raise exception 'doctor_id, submitted_at and created_at cannot be changed after creation';
  end if;
  return new;
end;
$$;

create trigger doctor_verifications_protect_immutable_columns
  before update on public.doctor_verifications
  for each row execute function public.doctor_verifications_protect_immutable_columns();

-- reviewed_at/reviewed_by are set by trigger, not trusted from the admin
-- client — same reasoning as accepted_at on consultation_requests. Also
-- rejects nonsensical status transitions (verified/rejected are terminal;
-- a review can only leave pending or under_review).
create or replace function public.doctor_verifications_set_reviewed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is distinct from old.status then
    if old.status in ('verified', 'rejected') then
      raise exception 'doctor_verifications status % is terminal and cannot change', old.status;
    end if;
    if new.status not in ('pending', 'under_review', 'verified', 'rejected') then
      raise exception 'invalid doctor_verifications status: %', new.status;
    end if;
    if new.status in ('verified', 'rejected') then
      new.reviewed_at = now();
      new.reviewed_by = auth.uid();
    end if;
  end if;
  return new;
end;
$$;

create trigger doctor_verifications_set_reviewed
  before update on public.doctor_verifications
  for each row execute function public.doctor_verifications_set_reviewed();

-- When a verification is approved, reflect it onto doctor_profiles /
-- profiles isn't needed — "verified" status IS the source of truth
-- (get_available_doctors already checks has_live_consultation()-style
-- verification via doctor_verifications, not a separate flag). Nothing to
-- denormalize here.

-- ─────────────────────────────────────────────────────────────────────────
-- Storage: private bucket for doctor verification documents.
-- Path convention: {doctor_id}/{verification_id}/{filename} — RLS checks
-- the leading path segment against auth.uid(), same idea as doctor_id
-- columns elsewhere, so it never needs a join against
-- doctor_verification_documents for the doctor's own read/write.
-- ─────────────────────────────────────────────────────────────────────────

insert into storage.buckets (id, name, public)
values ('doctor-verification-documents', 'doctor-verification-documents', false)
on conflict (id) do nothing;

create policy "verification_documents_doctor_rw"
  on storage.objects for all
  using (
    bucket_id = 'doctor-verification-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'doctor-verification-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "verification_documents_admin_read"
  on storage.objects for select
  using (
    bucket_id = 'doctor-verification-documents'
    and public.is_admin(auth.uid())
  );
