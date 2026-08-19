-- Xolt — a scoped read path for a single doctor's public profile detail.
--
-- get_available_doctors() (20260818020000) deliberately returns only
-- list-row columns. A patient viewing one doctor's detail screen needs a
-- bit more (bio, clinic name/address) but still not everything on
-- doctor_profiles — license_number stays private. Same reasoning as the
-- list function: doctor_profiles has no public SELECT policy on purpose,
-- so this is the sanctioned path, not a relaxed policy on the table.

create or replace function public.get_doctor_profile(p_doctor_id uuid)
returns table (
  doctor_id uuid,
  full_name text,
  specialty text,
  years_of_experience integer,
  consultation_fee numeric,
  bio text,
  clinic_name text,
  clinic_address text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id as doctor_id,
    p.full_name,
    dp.specialty,
    dp.years_of_experience,
    dp.consultation_fee,
    dp.bio,
    dp.clinic_name,
    dp.clinic_address
  from public.doctor_profiles dp
  join public.profiles p on p.id = dp.id
  where dp.id = p_doctor_id
    and exists (
      select 1 from public.doctor_verifications dv
      where dv.doctor_id = dp.id and dv.status = 'verified'
    );
$$;
