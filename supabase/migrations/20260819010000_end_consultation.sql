-- Lets either party mark an in_progress consultation completed. Needed so
-- the messages "no new sends after completed" gate (20260819000000) is
-- actually reachable, not just theoretical.
--
-- Rather than relying on exactly how Postgres combines multiple permissive
-- UPDATE policies' USING/WITH CHECK clauses across policies (a genuinely
-- easy thing to get subtly wrong — see consultation_requests_update_doctor_
-- respond's pending-only USING), the actual authority on which status
-- transitions are valid is this trigger, not the RLS policy shape. RLS just
-- has to allow the right people to attempt an update at all; the trigger
-- rejects anything that isn't an approved (old, new) pair regardless of
-- which policy's clauses matched.

create or replace function public.consultation_requests_validate_status_transition()
returns trigger
language plpgsql
as $$
begin
  if new.status is distinct from old.status then
    if not (
      (old.status = 'pending' and new.status in ('accepted', 'declined'))
      or (old.status = 'in_progress' and new.status = 'completed')
    ) then
      raise exception 'invalid consultation_requests status transition: % -> %', old.status, new.status;
    end if;
  end if;
  return new;
end;
$$;

create trigger consultation_requests_validate_status_transition
  before update on public.consultation_requests
  for each row execute function public.consultation_requests_validate_status_transition();

-- completed_at is set by trigger, not the client, same reasoning as
-- accepted_at.
create or replace function public.consultation_requests_set_completed_at()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'completed' and old.status is distinct from 'completed' then
    new.completed_at = now();
  end if;
  return new;
end;
$$;

create trigger consultation_requests_set_completed_at
  before update on public.consultation_requests
  for each row execute function public.consultation_requests_set_completed_at();

create policy "consultation_requests_update_complete"
  on public.consultation_requests for update
  using (
    status = 'in_progress'
    and (patient_id = auth.uid() or doctor_id = auth.uid())
  )
  with check (
    status = 'completed'
    and (patient_id = auth.uid() or doctor_id = auth.uid())
  );
