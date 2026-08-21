-- =====================================================
-- 소속(membership) 과 참가(participation) 분리
--
-- 문제:
--   초대장으로 행사 하나에 참가한 것만으로 app_user_orgs 행이 생겨,
--   등록한 적도 없는 기관이 그 보호자의 "내 기관"이 됐다.
--   ("도원센트럴은 셋팅도 안 했고 연락처를 입력하지도 않았는데")
--
-- 정리:
--   소속 = 기관이 명단에 올린 사람만
--            bulk_import / admin / self_register / backfill
--   참가 = org_event_participants (그 행사 접근권만)
--
--   → source='invitation' 행 제거.
--
-- 접근 권한은 줄어들지 않는다:
--   앱은 이제 hasOrgAccess(소속 ∪ 그 기관 행사 참가자) 로 판단하고,
--   행사 화면은 isEventParticipant 하나로 판단한다. 소속 행이 없어도
--   참가 기록이 있으면 그대로 들어갈 수 있다.
--
-- 관제 명단도 소속 ∪ 행사 참가자를 합쳐 보여주므로 아무도 사라지지 않는다.
--   (화면에서 '원생' / '행사 참가자' 배지로 구분)
--
-- 재실행 안전.
-- =====================================================

DO $$
DECLARE
  n int;
BEGIN
  SELECT COUNT(*) INTO n
    FROM app_user_orgs WHERE source = 'invitation';
  RAISE NOTICE '초대장 참가로 생겼던 소속 % 건 정리', n;
END $$;

DELETE FROM app_user_orgs WHERE source = 'invitation';

-- source 의 의미를 문서화 — 'invitation' 은 더 이상 쓰지 않는다.
COMMENT ON COLUMN app_user_orgs.source IS
  '소속이 생긴 경로: backfill / bulk_import / self_register / admin. '
  '(invitation 은 폐기 — 행사 참가는 소속이 아니다)';

-- 검증 — 소속이 사라진 보호자가 그 기관 행사 참가 기록은 유지하는지.
DO $$
DECLARE
  orphan int;
BEGIN
  SELECT COUNT(DISTINCT p.user_id) INTO orphan
    FROM org_event_participants p
    JOIN org_events e ON e.id = p.event_id
   WHERE NOT EXISTS (
     SELECT 1 FROM app_user_orgs m
      WHERE m.user_id = p.user_id AND m.org_id = e.org_id
   );
  RAISE NOTICE '소속 없이 행사만 참가한 보호자 % 명 — 명단에는 "행사 참가자" 로 표시됩니다', orphan;
END $$;

NOTIFY pgrst, 'reload schema';
