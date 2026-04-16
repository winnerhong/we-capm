-- =====================================================================
-- Event registrations: pre-register participants by phone
-- =====================================================================

create table public.event_registrations (
  id              uuid primary key default gen_random_uuid(),
  event_id        uuid not null references public.events(id) on delete cascade,
  phone           text not null,
  name            text not null,
  status          text not null default 'REGISTERED',
  entered_at      timestamptz,
  registered_by   uuid references public.profiles(id),
  created_at      timestamptz not null default now(),
  unique (event_id, phone)
);

create index on public.event_registrations (event_id);
create index on public.event_registrations (phone);

alter table public.event_registrations enable row level security;

create policy "event_registrations_select" on public.event_registrations
  for select using (public.is_admin() or public.is_event_staff(event_id));

create policy "event_registrations_write" on public.event_registrations
  for all using (public.is_admin() or public.is_event_staff(event_id));

create policy "event_registrations_self_select" on public.event_registrations
  for select using (
    phone in (select phone from auth.users where id = auth.uid())
  );
