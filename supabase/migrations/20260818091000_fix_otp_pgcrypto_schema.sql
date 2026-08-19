-- Fix: gen_salt()/crypt() live in the `extensions` schema on this project
-- (Supabase installs pgcrypto there, not `public`), but
-- generate_request_otp/verify_request_otp set search_path = public only,
-- so the calls failed with "function gen_salt(unknown) does not exist".
-- gen_random_uuid() never hit this because it's built into core Postgres
-- (13+) and needs no extension at all — every other use of it in this
-- schema was never actually exercising pgcrypto.

create or replace function public.generate_request_otp(p_request_id uuid)
returns text
language plpgsql
security definer
set search_path = public, extensions
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
set search_path = public, extensions
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
