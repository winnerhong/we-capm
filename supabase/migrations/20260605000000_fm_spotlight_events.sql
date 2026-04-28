-- ============================================================
-- fm_spotlight_events
--   DJ 콘솔 → 전광판 (보이는 라디오) 스포트라이트 트리거 이벤트.
--   - kind: 'STORY' (사연 풀스크린)
--           'HEART_RAIN' (떠오르는 하트)
--           'EMOJI_RAIN' (이모지 비)
--           'BANNER' (가로 슬라이드 응원 배너)
--           'POLL_FULLSCREEN' (투표 풀스크린 차트)
--   - payload_json: kind 별 추가 데이터
--       STORY     → { request_id, song_title, artist, story, child_name, parent_name }
--       HEART_RAIN→ { intensity?: 'low'|'high' }
--       EMOJI_RAIN→ { emoji?: string }
--       BANNER    → { text }
--       POLL_FULLSCREEN → { poll_id }
--   - expires_at: 자동 dismiss 시각 (NULL 이면 DJ 가 명시적 dismiss 할 때까지)
--   - dismissed_at: 명시적 dismiss 시각 (UI 에서 OFF 처리)
--
-- 활성 스포트라이트 = expires_at > now() AND dismissed_at IS NULL.
-- 같은 session 의 동일 kind 가 활성화된 상태에서 새 트리거가 오면
--   기존 row 의 dismissed_at = now() 로 덮어쓰는 정책 (앱 레이어에서 처리).
-- ============================================================

CREATE TABLE IF NOT EXISTS fm_spotlight_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES tori_fm_sessions(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (
    kind IN ('STORY','HEART_RAIN','EMOJI_RAIN','BANNER','POLL_FULLSCREEN')
  ),
  payload_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  triggered_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  dismissed_at timestamptz,
  triggered_by_org_id uuid REFERENCES partner_orgs(id) ON DELETE SET NULL
);

-- 활성 이벤트만 빠르게 가져오기 위한 partial index.
CREATE INDEX IF NOT EXISTS idx_fm_spotlight_session_active
  ON fm_spotlight_events (session_id, triggered_at DESC)
  WHERE dismissed_at IS NULL;

-- RLS — Phase 0 permissive (Phase X 에서 같은 org 만 트리거 가능하도록 조임)
ALTER TABLE fm_spotlight_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "fm_spotlight_events_all" ON fm_spotlight_events;
CREATE POLICY "fm_spotlight_events_all" ON fm_spotlight_events
  FOR ALL USING (true) WITH CHECK (true);

-- Realtime publication 등록 — 전광판이 즉시 반영
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE fm_spotlight_events;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN undefined_object THEN NULL;
  END;
END $$;
