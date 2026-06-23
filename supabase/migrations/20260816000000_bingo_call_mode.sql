-- 토리 빙고 — 그림별 호명 방식 (동그라미 / QR).
--   운영자가 그림을 호명할 때 방식을 고른다:
--     CIRCLE = 그 그림을 가진 모든 참가자 자동 ⭕ (기존 동그라미)
--     QR     = 참가자가 그 그림 주인을 찾아 QR을 찍어야 ⭕
--   call_mode 는 호명(called_at) 됐을 때만 의미. 기존 호명은 모두 CIRCLE 로 백필.

ALTER TABLE org_bingo_entries
  ADD COLUMN IF NOT EXISTS call_mode text NOT NULL DEFAULT 'CIRCLE'
  CHECK (call_mode IN ('CIRCLE', 'QR'));

COMMENT ON COLUMN org_bingo_entries.call_mode IS
  '호명 방식. CIRCLE=모든 참가자 자동 ⭕, QR=참가자가 QR 찍어야 ⭕. called_at 있을 때만 의미.';
