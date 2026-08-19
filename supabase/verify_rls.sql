-- Run against a live database to confirm RLS is actually enabled and every
-- table has at least one policy — a migration reviewed by hand is not the
-- same as RLS confirmed on the real database.

-- Every public table should have rowsecurity = true.
select schemaname, tablename, rowsecurity
from pg_tables
where schemaname = 'public'
order by tablename;

-- Every public table should show up here at least once (no policies = no
-- access at all under RLS, which is a silent lockout, not a security hole —
-- but it usually means a table was created without its policies).
select schemaname, tablename, policyname, cmd, roles
from pg_policies
where schemaname = 'public'
order by tablename, policyname;

-- Tables with RLS enabled but zero policies — worth a second look, since
-- these are fully locked (every command denied) unless that's intentional.
select t.tablename
from pg_tables t
where t.schemaname = 'public'
  and t.rowsecurity = true
  and not exists (
    select 1 from pg_policies p
    where p.schemaname = t.schemaname and p.tablename = t.tablename
  )
order by t.tablename;
