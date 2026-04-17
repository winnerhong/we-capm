-- =====================================================================
-- Chat System: rooms, members, messages, reactions
-- =====================================================================

create table public.chat_rooms (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  type text not null default 'DIRECT',
  name text,
  team_id uuid references public.teams(id) on delete set null,
  pinned_message_id uuid,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  check (type in ('DIRECT','TEAM','ANNOUNCEMENT','GROUP'))
);
create index on public.chat_rooms (event_id);
create index on public.chat_rooms (team_id);

create table public.chat_members (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.chat_rooms(id) on delete cascade,
  user_id uuid references public.profiles(id),
  participant_name text,
  participant_phone text,
  role text not null default 'MEMBER',
  last_read_at timestamptz not null default now(),
  is_muted boolean not null default false,
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  check (role in ('ADMIN','MEMBER'))
);
create index on public.chat_members (room_id);
create index on public.chat_members (user_id);
create index on public.chat_members (participant_phone);

create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.chat_rooms(id) on delete cascade,
  sender_id uuid references public.profiles(id),
  sender_name text not null,
  type text not null default 'TEXT',
  content text,
  file_url text,
  file_name text,
  reply_to_id uuid references public.chat_messages(id) on delete set null,
  is_deleted boolean not null default false,
  edited_at timestamptz,
  created_at timestamptz not null default now(),
  metadata jsonb,
  check (type in ('TEXT','IMAGE','FILE','SYSTEM','ANNOUNCEMENT'))
);
create index on public.chat_messages (room_id, created_at);

create table public.chat_reactions (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.chat_messages(id) on delete cascade,
  user_name text not null,
  emoji text not null,
  created_at timestamptz not null default now(),
  unique (message_id, user_name, emoji)
);

-- RLS
alter table public.chat_rooms enable row level security;
alter table public.chat_members enable row level security;
alter table public.chat_messages enable row level security;
alter table public.chat_reactions enable row level security;

create policy "chat_rooms_select" on public.chat_rooms for select using (
  public.is_admin() or public.is_event_staff(event_id) or public.is_event_participant(event_id)
  or exists (select 1 from public.chat_members cm where cm.room_id = id and cm.left_at is null
    and (cm.user_id = auth.uid() or cm.participant_phone is not null))
);
create policy "chat_rooms_insert" on public.chat_rooms for insert with check (
  public.is_admin() or public.is_event_staff(event_id) or public.is_event_participant(event_id));
create policy "chat_members_all" on public.chat_members for all using (true);
create policy "chat_messages_select" on public.chat_messages for select using (
  exists (select 1 from public.chat_members cm where cm.room_id = chat_messages.room_id and cm.left_at is null));
create policy "chat_messages_insert" on public.chat_messages for insert with check (
  exists (select 1 from public.chat_members cm where cm.room_id = chat_messages.room_id and cm.left_at is null));
create policy "chat_messages_update" on public.chat_messages for update using (
  sender_name = (select participant_name from public.chat_members cm
    where cm.room_id = chat_messages.room_id limit 1) or public.is_admin());
create policy "chat_reactions_all" on public.chat_reactions for all using (true);

-- Storage bucket for chat files
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('chat-files', 'chat-files', false, 10485760,
   array['image/jpeg','image/png','image/webp','image/gif','application/pdf','video/mp4']::text[])
on conflict (id) do update set file_size_limit = excluded.file_size_limit;

-- RPC: enter chat by name
create or replace function public.chat_enter_by_name(p_event_id uuid, p_name text, p_phone_last4 text default null)
returns json language plpgsql security definer set search_path = public as $$
declare
  v_regs record[];
  v_reg record;
  v_count int;
begin
  select array_agg(r) into v_regs from (
    select id, name, phone from public.event_registrations
    where event_id = p_event_id and name = p_name
  ) r;

  v_count := coalesce(array_length(v_regs, 1), 0);

  if v_count = 0 then
    return json_build_object('ok', false, 'message', '등록되지 않은 이름입니다. 관리자에게 문의해주세요.');
  end if;

  if v_count > 1 and p_phone_last4 is null then
    return json_build_object('ok', false, 'needPhone', true, 'message', '같은 이름이 있습니다. 전화번호 뒷 4자리를 입력해주세요.');
  end if;

  if v_count > 1 then
    select r.* into v_reg from unnest(v_regs) r where r.phone like '%' || p_phone_last4;
    if v_reg.id is null then
      return json_build_object('ok', false, 'message', '일치하는 정보가 없습니다.');
    end if;
  else
    v_reg := v_regs[1];
  end if;

  if v_reg.status is distinct from 'ENTERED' then
    update public.event_registrations set status = 'ENTERED', entered_at = now() where id = v_reg.id;
  end if;

  return json_build_object('ok', true, 'name', v_reg.name, 'phone', v_reg.phone, 'registrationId', v_reg.id);
end;
$$;
grant execute on function public.chat_enter_by_name(uuid, text, text) to anon, authenticated;
