-- =====================================================================
-- CampNic Initial Schema
-- Phase 1: Foundation tables for auth, events, missions, rewards, teams
-- =====================================================================

-- ---------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------

create type user_role as enum ('USER', 'STAFF', 'ADMIN');

create type event_status as enum ('DRAFT', 'ACTIVE', 'ENDED', 'CONFIRMED', 'ARCHIVED');

create type event_type as enum ('FAMILY', 'CORPORATE', 'CLUB', 'SCHOOL', 'ETC');

create type participation_type as enum ('INDIVIDUAL', 'TEAM', 'BOTH');

create type mission_reveal_mode as enum ('ALL', 'SEQUENTIAL', 'SCHEDULED');

create type result_publish_mode as enum ('IMMEDIATE', 'AFTER_APPROVAL', 'PRIVATE');

create type template_type as enum ('PHOTO', 'VIDEO', 'LOCATION', 'QUIZ', 'MIXED', 'TEAM', 'TIMEATTACK');

create type submission_status as enum ('PENDING', 'APPROVED', 'AUTO_APPROVED', 'REJECTED', 'RESUBMIT_REQUESTED', 'EXPIRED');

create type review_method as enum ('MANUAL', 'BULK', 'AUTO');

create type reward_type as enum ('POINT', 'RANK', 'BADGE', 'LOTTERY', 'INSTANT');

create type claim_status as enum ('EARNED', 'CLAIMED');

-- ---------------------------------------------------------------------
-- profiles: extends auth.users with app-specific fields
-- ---------------------------------------------------------------------
create table public.profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  name            text not null,
  role            user_role not null default 'USER',
  phone_verified  boolean not null default false,
  last_login_at   timestamptz,
  created_at      timestamptz not null default now()
);

comment on table public.profiles is 'App-level user profile extending auth.users (phone stored in auth.users.phone)';

-- ---------------------------------------------------------------------
-- events
-- ---------------------------------------------------------------------
create table public.events (
  id                    uuid primary key default gen_random_uuid(),
  name                  text not null,
  description           text,
  type                  event_type not null default 'FAMILY',
  start_at              timestamptz not null,
  end_at                timestamptz not null,
  location              text not null,
  location_lat          double precision,
  location_lng          double precision,
  join_code             text not null unique,
  status                event_status not null default 'DRAFT',
  participation_type    participation_type not null default 'BOTH',
  max_team_size         int not null default 6,
  max_team_count        int,
  show_leaderboard      boolean not null default true,
  show_other_scores     boolean not null default true,
  mission_reveal_mode   mission_reveal_mode not null default 'ALL',
  result_publish_mode   result_publish_mode not null default 'IMMEDIATE',
  auto_end              boolean not null default true,
  created_by_user_id    uuid not null references public.profiles(id),
  created_at            timestamptz not null default now(),
  check (end_at > start_at)
);

create index on public.events (status);
create index on public.events (created_by_user_id);

-- ---------------------------------------------------------------------
-- event_staff: assigns STAFF users to a specific event
-- ---------------------------------------------------------------------
create table public.event_staff (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid not null references public.events(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  added_at    timestamptz not null default now(),
  unique (event_id, user_id)
);

create index on public.event_staff (user_id);

-- ---------------------------------------------------------------------
-- teams
-- ---------------------------------------------------------------------
create table public.teams (
  id            uuid primary key default gen_random_uuid(),
  event_id      uuid not null references public.events(id) on delete cascade,
  name          text not null,
  team_code     text not null unique,
  leader_id     uuid not null references public.profiles(id),
  total_score   int not null default 0,
  created_at    timestamptz not null default now()
);

create index on public.teams (event_id);

-- ---------------------------------------------------------------------
-- participants: one row per (user, event)
-- ---------------------------------------------------------------------
create table public.participants (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references public.profiles(id) on delete cascade,
  event_id             uuid not null references public.events(id) on delete cascade,
  participation_type   participation_type not null,
  team_id              uuid references public.teams(id) on delete set null,
  total_score          int not null default 0,
  joined_at            timestamptz not null default now(),
  unique (user_id, event_id)
);

create index on public.participants (event_id);
create index on public.participants (team_id);

-- ---------------------------------------------------------------------
-- missions
-- ---------------------------------------------------------------------
create table public.missions (
  id              uuid primary key default gen_random_uuid(),
  event_id        uuid not null references public.events(id) on delete cascade,
  title           text not null,
  description     text not null,
  instruction     text,
  template_type   template_type not null,
  points          int not null check (points >= 0),
  "order"         int not null default 0,
  is_active       boolean not null default true,
  auto_approve    boolean not null default false,
  config          jsonb not null default '{}'::jsonb
);

create index on public.missions (event_id, "order");

-- ---------------------------------------------------------------------
-- submissions
-- ---------------------------------------------------------------------
create table public.submissions (
  id                    uuid primary key default gen_random_uuid(),
  mission_id            uuid not null references public.missions(id) on delete cascade,
  participant_id        uuid not null references public.participants(id) on delete cascade,
  team_id               uuid references public.teams(id) on delete set null,
  status                submission_status not null default 'PENDING',
  photo_urls            text[] not null default '{}',
  photo_hashes          text[] not null default '{}',
  video_url             text,
  text_content          text,
  location_lat          double precision,
  location_lng          double precision,
  location_accuracy     double precision,
  started_at            timestamptz,
  submitted_at          timestamptz not null default now(),
  reviewed_at           timestamptz,
  reviewed_by_user_id   uuid references public.profiles(id),
  review_method         review_method,
  reject_reason         text,
  earned_points         int,
  resubmit_count        int not null default 0
);

create index on public.submissions (mission_id, status);
create index on public.submissions (participant_id);
create index on public.submissions (team_id);
create index on public.submissions (status, submitted_at);

-- ---------------------------------------------------------------------
-- rewards
-- ---------------------------------------------------------------------
create table public.rewards (
  id             uuid primary key default gen_random_uuid(),
  event_id       uuid not null references public.events(id) on delete cascade,
  name           text not null,
  description    text,
  image_url      text,
  reward_type    reward_type not null,
  config         jsonb not null default '{}'::jsonb,
  quantity       int,
  applies_to     participation_type not null default 'BOTH',
  is_active      boolean not null default true
);

create index on public.rewards (event_id);

-- ---------------------------------------------------------------------
-- reward_claims
-- ---------------------------------------------------------------------
create table public.reward_claims (
  id                    uuid primary key default gen_random_uuid(),
  reward_id             uuid not null references public.rewards(id) on delete cascade,
  participant_id        uuid not null references public.participants(id) on delete cascade,
  team_id               uuid references public.teams(id) on delete set null,
  status                claim_status not null default 'EARNED',
  earned_at             timestamptz not null default now(),
  claimed_at            timestamptz,
  claimed_by_user_id    uuid references public.profiles(id)
);

create index on public.reward_claims (participant_id);
create index on public.reward_claims (reward_id);

-- ---------------------------------------------------------------------
-- badges
-- ---------------------------------------------------------------------
create table public.badges (
  id             uuid primary key default gen_random_uuid(),
  event_id       uuid not null references public.events(id) on delete cascade,
  name           text not null,
  icon_url       text,
  description    text not null,
  condition      jsonb not null default '{}'::jsonb
);

create index on public.badges (event_id);

-- ---------------------------------------------------------------------
-- badge_earns
-- ---------------------------------------------------------------------
create table public.badge_earns (
  id               uuid primary key default gen_random_uuid(),
  badge_id         uuid not null references public.badges(id) on delete cascade,
  participant_id   uuid not null references public.participants(id) on delete cascade,
  earned_at        timestamptz not null default now(),
  unique (badge_id, participant_id)
);

-- ---------------------------------------------------------------------
-- notifications
-- ---------------------------------------------------------------------
create table public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  type        text not null,
  title       text not null,
  message     text not null,
  is_read     boolean not null default false,
  created_at  timestamptz not null default now()
);

create index on public.notifications (user_id, is_read);
create index on public.notifications (user_id, created_at desc);

-- ---------------------------------------------------------------------
-- Profile auto-creation: when a new auth.users row is created,
-- create a matching public.profiles row
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', '참가자'));
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.events enable row level security;
alter table public.event_staff enable row level security;
alter table public.teams enable row level security;
alter table public.participants enable row level security;
alter table public.missions enable row level security;
alter table public.submissions enable row level security;
alter table public.rewards enable row level security;
alter table public.reward_claims enable row level security;
alter table public.badges enable row level security;
alter table public.badge_earns enable row level security;
alter table public.notifications enable row level security;

-- Helper: is current user an admin?
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'ADMIN'
  );
$$;

-- Helper: is current user staff of a given event?
create or replace function public.is_event_staff(event_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.event_staff
    where event_id = event_uuid and user_id = auth.uid()
  );
$$;

-- profiles policies
create policy "profiles: self select" on public.profiles
  for select using (id = auth.uid() or public.is_admin());

create policy "profiles: self update" on public.profiles
  for update using (id = auth.uid());

-- events policies
create policy "events: public read when active" on public.events
  for select using (
    status in ('ACTIVE', 'ENDED', 'CONFIRMED')
    or created_by_user_id = auth.uid()
    or public.is_admin()
    or public.is_event_staff(id)
  );

create policy "events: admin write" on public.events
  for all using (public.is_admin() or created_by_user_id = auth.uid());

-- event_staff policies
create policy "event_staff: admin or self read" on public.event_staff
  for select using (user_id = auth.uid() or public.is_admin());

create policy "event_staff: admin write" on public.event_staff
  for all using (public.is_admin());

-- participants policies
create policy "participants: self or same-event read" on public.participants
  for select using (
    user_id = auth.uid()
    or public.is_admin()
    or public.is_event_staff(event_id)
    or exists (
      select 1 from public.participants p
      where p.event_id = participants.event_id and p.user_id = auth.uid()
    )
  );

create policy "participants: self insert" on public.participants
  for insert with check (user_id = auth.uid());

create policy "participants: self update" on public.participants
  for update using (user_id = auth.uid() or public.is_admin() or public.is_event_staff(event_id));

-- teams policies
create policy "teams: same-event read" on public.teams
  for select using (
    public.is_admin()
    or public.is_event_staff(event_id)
    or exists (
      select 1 from public.participants p
      where p.event_id = teams.event_id and p.user_id = auth.uid()
    )
  );

create policy "teams: participant write" on public.teams
  for all using (
    public.is_admin()
    or public.is_event_staff(event_id)
    or exists (
      select 1 from public.participants p
      where p.event_id = teams.event_id and p.user_id = auth.uid()
    )
  );

-- missions policies
create policy "missions: same-event read" on public.missions
  for select using (
    public.is_admin()
    or public.is_event_staff(event_id)
    or exists (
      select 1 from public.participants p
      where p.event_id = missions.event_id and p.user_id = auth.uid()
    )
  );

create policy "missions: admin/staff write" on public.missions
  for all using (public.is_admin() or public.is_event_staff(event_id));

-- submissions policies
create policy "submissions: owner or reviewer read" on public.submissions
  for select using (
    public.is_admin()
    or exists (
      select 1 from public.participants p
      where p.id = submissions.participant_id and p.user_id = auth.uid()
    )
    or exists (
      select 1 from public.missions m
      where m.id = submissions.mission_id and public.is_event_staff(m.event_id)
    )
  );

create policy "submissions: participant insert" on public.submissions
  for insert with check (
    exists (
      select 1 from public.participants p
      where p.id = submissions.participant_id and p.user_id = auth.uid()
    )
  );

create policy "submissions: staff update" on public.submissions
  for update using (
    public.is_admin()
    or exists (
      select 1 from public.missions m
      where m.id = submissions.mission_id and public.is_event_staff(m.event_id)
    )
  );

-- rewards policies
create policy "rewards: same-event read" on public.rewards
  for select using (
    public.is_admin()
    or public.is_event_staff(event_id)
    or exists (
      select 1 from public.participants p
      where p.event_id = rewards.event_id and p.user_id = auth.uid()
    )
  );

create policy "rewards: admin/staff write" on public.rewards
  for all using (public.is_admin() or public.is_event_staff(event_id));

-- reward_claims policies
create policy "reward_claims: owner or staff read" on public.reward_claims
  for select using (
    public.is_admin()
    or exists (
      select 1 from public.participants p
      where p.id = reward_claims.participant_id and p.user_id = auth.uid()
    )
    or exists (
      select 1 from public.rewards r
      where r.id = reward_claims.reward_id and public.is_event_staff(r.event_id)
    )
  );

create policy "reward_claims: system write via staff" on public.reward_claims
  for all using (
    public.is_admin()
    or exists (
      select 1 from public.rewards r
      where r.id = reward_claims.reward_id and public.is_event_staff(r.event_id)
    )
  );

-- badges policies
create policy "badges: same-event read" on public.badges
  for select using (
    public.is_admin()
    or public.is_event_staff(event_id)
    or exists (
      select 1 from public.participants p
      where p.event_id = badges.event_id and p.user_id = auth.uid()
    )
  );

create policy "badges: admin/staff write" on public.badges
  for all using (public.is_admin() or public.is_event_staff(event_id));

-- badge_earns policies
create policy "badge_earns: owner or staff read" on public.badge_earns
  for select using (
    public.is_admin()
    or exists (
      select 1 from public.participants p
      where p.id = badge_earns.participant_id and p.user_id = auth.uid()
    )
    or exists (
      select 1 from public.badges b
      where b.id = badge_earns.badge_id and public.is_event_staff(b.event_id)
    )
  );

create policy "badge_earns: staff write" on public.badge_earns
  for all using (
    public.is_admin()
    or exists (
      select 1 from public.badges b
      where b.id = badge_earns.badge_id and public.is_event_staff(b.event_id)
    )
  );

-- notifications policies
create policy "notifications: self read" on public.notifications
  for select using (user_id = auth.uid());

create policy "notifications: self update" on public.notifications
  for update using (user_id = auth.uid());
