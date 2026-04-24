-- ============================================================================
-- Migration: 20260524000000_children_is_enrolled.sql
-- Purpose : 아이(app_children) 별로 "이 기관 원생 여부" 플래그 추가.
--           - 원생(ENROLLED): 이 기관에 실제 다니는 아이
--           - 외부(EXTERNAL): 친척·친구 등 같이 체험하러 온 아이
-- Default : true (기존 데이터 전부 원생으로 간주, 기관이 필요 시 토글 해제)
-- ============================================================================

ALTER TABLE app_children
  ADD COLUMN IF NOT EXISTS is_enrolled boolean NOT NULL DEFAULT true;

-- 빠른 카운트용 부분 인덱스 (원생만 필터).
CREATE INDEX IF NOT EXISTS idx_app_children_enrolled
  ON app_children (user_id)
  WHERE is_enrolled = true;

-- ============================================================================
-- 참고: NOTIFY pgrst, 'reload schema';
-- 실행 후 바로 API에서 컬럼 인식되게 하려면 위 NOTIFY 도 같이 실행하세요.
-- ============================================================================
