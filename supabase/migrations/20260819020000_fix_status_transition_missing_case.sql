-- Fix a regression introduced by 20260819010000_end_consultation.sql: the
-- status-transition trigger's allowed-pairs list omitted accepted ->
-- in_progress, which is exactly the transition verify_request_otp performs
-- (supabase/migrations/20260818090000). Triggers fire on every UPDATE
-- regardless of caller, including from a security definer function, so
-- verify_request_otp would have started failing with "invalid
-- consultation_requests status transition: accepted -> in_progress" the
-- next time it ran. Caught before it hit real usage — nobody had gone
-- through this path since the trigger was added.

create or replace function public.consultation_requests_validate_status_transition()
returns trigger
language plpgsql
as $$
begin
  if new.status is distinct from old.status then
    if not (
      (old.status = 'pending' and new.status in ('accepted', 'declined'))
      or (old.status = 'accepted' and new.status = 'in_progress')
      or (old.status = 'in_progress' and new.status = 'completed')
    ) then
      raise exception 'invalid consultation_requests status transition: % -> %', old.status, new.status;
    end if;
  end if;
  return new;
end;
$$;
