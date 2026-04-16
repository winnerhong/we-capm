-- =====================================================================
-- RPC helpers: combine multiple queries into single round-trips
-- =====================================================================

-- Home page: profile + unread count + event list in one call
create or replace function public.get_home_data()
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_profile json;
  v_unread int;
  v_events json;
begin
  select json_build_object('id', id, 'name', name, 'role', role)
  into v_profile
  from public.profiles where id = v_user_id;

  select count(*) into v_unread
  from public.notifications
  where user_id = v_user_id and is_read = false;

  select coalesce(json_agg(e order by e.start_at desc), '[]'::json)
  into v_events
  from (
    select ev.id, ev.name, ev.status, ev.location, ev.start_at
    from public.participants p
    join public.events ev on ev.id = p.event_id
    where p.user_id = v_user_id
  ) e;

  return json_build_object(
    'profile', v_profile,
    'unreadCount', v_unread,
    'events', v_events
  );
end;
$$;

grant execute on function public.get_home_data() to authenticated;

-- Event home: event + participant + mission count in one call
create or replace function public.get_event_home(p_event_id uuid)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_event json;
  v_participant json;
  v_mission_count int;
begin
  select json_build_object(
    'id', id, 'name', name, 'status', status, 'location', location,
    'start_at', start_at, 'end_at', end_at,
    'participation_type', participation_type,
    'show_leaderboard', show_leaderboard
  )
  into v_event
  from public.events where id = p_event_id;

  select json_build_object('id', id, 'total_score', total_score, 'team_id', team_id)
  into v_participant
  from public.participants
  where event_id = p_event_id and user_id = v_user_id;

  select count(*) into v_mission_count
  from public.missions
  where event_id = p_event_id and is_active = true;

  return json_build_object(
    'event', v_event,
    'participant', v_participant,
    'missionCount', v_mission_count
  );
end;
$$;

grant execute on function public.get_event_home(uuid) to authenticated;
