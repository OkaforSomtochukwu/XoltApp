-- Text chat between the two parties on a consultation request. Visible
-- while in_progress and afterward (completed) as history; sendable only
-- while in_progress — matches the access-grants gate: chat only opens once
-- OTP has been verified, which per has_verified_payment() means payment is
-- verified too.

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.consultation_requests (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);

create index messages_request_id_created_at_idx on public.messages (request_id, created_at);

alter table public.messages enable row level security;

create policy messages_select_participants
  on public.messages for select
  to authenticated
  using (
    exists (
      select 1
      from public.consultation_requests cr
      where cr.id = messages.request_id
        and cr.status in ('in_progress', 'completed')
        and (cr.patient_id = auth.uid() or cr.doctor_id = auth.uid())
    )
  );

create policy messages_insert_participants
  on public.messages for insert
  to authenticated
  with check (
    sender_id = auth.uid()
    and exists (
      select 1
      from public.consultation_requests cr
      where cr.id = messages.request_id
        and cr.status = 'in_progress'
        and (cr.patient_id = auth.uid() or cr.doctor_id = auth.uid())
    )
  );

-- No update/delete policies anywhere — messages are immutable, same as
-- medical_records.

alter publication supabase_realtime add table public.messages;
