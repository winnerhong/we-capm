-- =====================================================
-- 미션 사진 나눠보기 — 참가 가족끼리 서로의 사진 보기
--
-- 배경:
--   사진 미션을 열면 "찍는 자리" 만 있다. 우리가 뭘 올렸는지는 제출 완료 화면으로
--   넘어가야 보이고, 다른 가족이 뭘 올렸는지는 어디서도 볼 수 없다. 기관 관제실
--   에는 사진 월이 있는데 정작 그 자리에 있는 가족들은 못 본다.
--
-- 공개 판단은 **기관 한 곳**에서 한다. 두 조건이 맞아야 한 장이 피드에 오른다:
--
--   org_events.photo_feed_enabled        기관이 이 행사에서 열었는가
--   status IN (AUTO_APPROVED, APPROVED)  기관이 이미 확인한 사진인가
--
-- 보호자별 개별 동의 컬럼(is_shared)을 두지 않는 이유:
--   켤 사람은 안 켜고, 안 켠 사람은 자기 사진이 왜 안 보이는지 모른 채 끝난다.
--   피드는 텅 비고 "다들 안 올리네" 로 읽힌다. 기관이 스위치를 켜는 순간이 곧
--   "이 행사는 사진을 나눠본다" 는 선언이고, 그때부터 확인 끝난 사진은 모두
--   피드에 오른다. 스위치를 내리면 전부 동시에 사라진다.
--
-- 재실행 안전(idempotent).
-- =====================================================

-- ─────────────────────────────────────────────────────
-- 1) org_events — 기관 스위치 (행사 단위)
--
--    기관 단위가 아니라 행사 단위인 이유: 같은 어린이집이라도 원내 행사와
--    외부 개방 행사의 판단이 다르다. 행사마다 정할 수 있어야 한다.
-- ─────────────────────────────────────────────────────
ALTER TABLE org_events
  ADD COLUMN IF NOT EXISTS photo_feed_enabled boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN org_events.photo_feed_enabled IS
  '참가 가족끼리 미션 사진을 서로 볼 수 있게 할지. 켜면 이 행사에서 기관 확인이 '
  '끝난 사진이 모두 참가 가족에게 보인다. 내리면 전부 즉시 사라진다(삭제는 아님). '
  '기본 false — 아이 사진 공개는 기관이 명시적으로 열어야 시작된다.';


-- ─────────────────────────────────────────────────────
-- 2) mission_submissions — 피드 조회 인덱스
--
--    피드는 "이 행사의 사진 미션들 + 확인 끝난 것" 을 최신순으로 매번 훑는다.
--    상태를 조건으로 박은 부분 인덱스라 검토 중·반려분은 아예 타지 않는다.
-- ─────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_mission_sub_feed
  ON mission_submissions (org_mission_id, submitted_at DESC)
  WHERE status IN ('AUTO_APPROVED', 'APPROVED');


-- ─────────────────────────────────────────────────────
-- 3) 실시간 — 새 사진이 저절로 피드에 뜨게
--
--    참가자 화면(PhotoFeedRealtime)은 mission_submissions 의 변경을 구독해
--    router.refresh() 를 건다. 그런데 이 테이블은 publication 에 들어있지 않아
--    채널은 SUBSCRIBED 로 붙고도 이벤트가 한 건도 오지 않았다 — "실시간인 줄
--    알았는데 아무 일도 안 일어나는" 조용한 실패다.
--
--    INSERT(새 제출) 뿐 아니라 UPDATE(기관 승인) 도 필요하다. 검토 후 승인된
--    사진이 그 순간 피드에 올라야 한다.
--
--    이미 등록돼 있으면 duplicate_object 예외 → 무시(다른 마이그레이션과 같은 꼴).
-- ─────────────────────────────────────────────────────
DO $realtime$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE mission_submissions;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN
    RAISE NOTICE 'supabase_realtime publication 이 없습니다 — 건너뜁니다.';
END $realtime$;


-- ─────────────────────────────────────────────────────
-- 4) 개별 동의 방식의 잔재 정리
--
--    이 파일의 이전 판(같은 날 적용분)이 만든 컬럼·인덱스다. 읽는 코드가 더는
--    없는데 남겨두면, 나중에 조회를 손보는 사람이 "공개 플래그가 있네" 하고
--    되살려 규칙이 두 갈래가 된다. 없으면 그냥 넘어간다.
-- ─────────────────────────────────────────────────────
DROP INDEX IF EXISTS idx_mission_sub_shared;

ALTER TABLE mission_submissions
  DROP COLUMN IF EXISTS is_shared,
  DROP COLUMN IF EXISTS shared_at;


-- ─────────────────────────────────────────────────────
-- 검증 로그
-- ─────────────────────────────────────────────────────
DO $$
DECLARE
  n_events  int;
  n_on      int;
  n_visible int;
BEGIN
  SELECT COUNT(*) INTO n_events FROM org_events;
  SELECT COUNT(*) INTO n_on FROM org_events WHERE photo_feed_enabled;
  SELECT COUNT(*) INTO n_visible FROM mission_submissions
    WHERE status IN ('AUTO_APPROVED', 'APPROVED');

  RAISE NOTICE '행사 % 개 중 사진 나눠보기 켠 행사 % 개', n_events, n_on;
  RAISE NOTICE '확인 끝난 제출물 % 건 — 켠 행사의 사진 미션분이 피드에 오릅니다.',
    n_visible;
  RAISE NOTICE '기관이 스위치를 켜기 전까지는 아무 사진도 공개되지 않습니다.';

  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'mission_submissions'
  ) THEN
    RAISE NOTICE '실시간 ON — 새 사진·승인이 참가자 화면에 저절로 뜹니다.';
  ELSE
    RAISE WARNING '실시간 OFF — mission_submissions 가 publication 에 없습니다.';
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
