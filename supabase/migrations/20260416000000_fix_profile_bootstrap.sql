-- =====================================================================
-- Fix: profile bootstrap
-- - handle_new_user: idempotent insert, first user auto-ADMIN
-- - backfill: orphaned auth.users get a profiles row
-- =====================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  assigned_role user_role;
begin
  perform pg_advisory_xact_lock(hashtext('handle_new_user_lock'));
  if (select count(*) from public.profiles) = 0 then
    assigned_role := 'ADMIN';
  else
    assigned_role := 'USER';
  end if;

  insert into public.profiles (id, name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', '참가자'),
    assigned_role
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

-- Backfill orphaned auth.users (profile missing)
-- Safe default: USER. If the DB has zero profiles and any auth.users, promote
-- the earliest auth user to ADMIN so initial bootstrap still works.
with orphaned as (
  select u.id, u.raw_user_meta_data, u.created_at,
         row_number() over (order by u.created_at asc) as rn
  from auth.users u
  left join public.profiles p on p.id = u.id
  where p.id is null
),
promote_first as (
  select (select count(*) from public.profiles) = 0 as promote
)
insert into public.profiles (id, name, role)
select
  o.id,
  coalesce(o.raw_user_meta_data->>'name', '참가자'),
  case when o.rn = 1 and (select promote from promote_first) then 'ADMIN'::user_role
       else 'USER'::user_role end
from orphaned o
on conflict (id) do nothing;
