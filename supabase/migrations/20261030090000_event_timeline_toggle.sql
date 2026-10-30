-- =====================================================
-- 행사 타임테이블 켜고 끄기
--
-- 배경:
--   타임테이블을 안 쓰는 행사도 참가자 「일정」 탭에 "아직 일정표가 없어요"
--   가 떠서, 기관이 일정을 깜빡한 것처럼 보였다. 기관이 스위치로 "이 행사는
--   일정표를 쓰지 않는다" 를 선언할 수 있게 한다. 끄면 참가자 일정 화면과
--   행사홈의 다음 일정 카드가 함께 숨는다.
--
-- 기본값 true — 기존 행사들은 지금 동작 그대로.
-- 재실행 안전(idempotent).
-- =====================================================

alter table public.org_events
  add column if not exists timeline_enabled boolean not null default true;

comment on column public.org_events.timeline_enabled is
  '행사 타임테이블 사용 여부. false 면 참가자 일정 화면·다음 일정 카드를 숨긴다.';
