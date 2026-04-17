alter table public.events add column if not exists manager_id text;
alter table public.events add column if not exists manager_password text;
alter table public.events alter column created_by_user_id drop not null;
