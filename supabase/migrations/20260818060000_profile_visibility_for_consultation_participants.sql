-- Xolt — let consultation_requests participants see each other's basic
-- profile (full_name etc). Without this, a doctor's incoming-request list
-- has a patient_id and nothing else to show — profiles RLS only allowed
-- reading your own row or (if admin) any row. Same "only while there's a
-- real relationship" reasoning as locations' has_live_consultation, except
-- this one isn't status-gated to 'accepted' — a doctor legitimately needs to
-- see who's asking even for a still-pending request.

create policy "profiles_select_consultation_counterpart"
  on public.profiles for select
  using (
    exists (
      select 1 from public.consultation_requests cr
      where (cr.patient_id = profiles.id and cr.doctor_id = auth.uid())
         or (cr.doctor_id = profiles.id and cr.patient_id = auth.uid())
    )
  );
