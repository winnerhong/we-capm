-- 비로그인 사용자도 등록 여부 확인 가능하게 하는 RPC

create or replace function public.event_has_registrations(p_event_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.event_registrations where event_id = p_event_id) $$;

grant execute on function public.event_has_registrations(uuid) to anon, authenticated;

create or replace function public.check_phone_registration(p_join_code text, p_phone text)
returns json
language plpgsql stable security definer set search_path = public
as $$
declare
  v_event_id uuid;
  v_reg record;
begin
  select id into v_event_id from public.events where join_code = p_join_code;
  if v_event_id is null then
    return json_build_object('ok', false, 'message', '행사를 찾을 수 없습니다');
  end if;

  select id, name, status into v_reg
  from public.event_registrations
  where event_id = v_event_id and phone = p_phone;

  if v_reg.id is null then
    return json_build_object('ok', false, 'message', '등록되지 않은 번호입니다. 관리자에게 문의해주세요.');
  end if;

  if v_reg.status != 'ENTERED' then
    update public.event_registrations
    set status = 'ENTERED', entered_at = now()
    where id = v_reg.id;
  end if;

  return json_build_object(
    'ok', true,
    'eventId', v_event_id,
    'registrationId', v_reg.id,
    'name', v_reg.name
  );
end;
$$;

grant execute on function public.check_phone_registration(text, text) to anon, authenticated;
