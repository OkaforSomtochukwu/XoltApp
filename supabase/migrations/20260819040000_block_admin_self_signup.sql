-- Fix a real gap: handle_new_user() trusted a client-supplied `role` from
-- signup metadata with no restriction. apps/admin has no signup UI, but the
-- same Supabase project's public signUp() endpoint is reachable by anyone
-- with the anon key (e.g. directly via the REST/JS client, not just through
-- an app's UI) — nothing stopped a signup call from passing role: 'admin'
-- in its metadata and self-promoting. "No self-signup for admins" needs to
-- be enforced here, in the trigger, not just by omitting a signup form.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_role text := new.raw_user_meta_data ->> 'role';
begin
  insert into public.profiles (id, role, full_name, email)
  values (
    new.id,
    case when requested_role in ('patient', 'doctor') then requested_role else 'patient' end,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    new.email
  );
  return new;
end;
$$;
