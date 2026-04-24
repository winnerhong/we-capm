-- ============================================================================
-- 20260601000000_control_room_phase2_indexes.sql
-- 기관포털 "관제실" Phase 2: 스탬프 제출 카운트/피드, 도토리 집계/리더보드,
-- LIVE pack 완료율 — 네 갈래 쿼리를 위한 인덱스 보강.
-- 스키마/RLS 변경 없음. 모두 IF NOT EXISTS 멱등 처리.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- 1) mission_submissions — APPROVED/AUTO_APPROVED 부분 복합 인덱스
--
-- Phase 2 쿼리:
--   (A) 스탬프 제출 카운트 (24h):
--       SELECT count(*), count(DISTINCT user_id)
--         FROM mission_submissions
--        WHERE status IN ('APPROVED','AUTO_APPROVED')
--          AND org_mission_id = ANY($1)
--          AND submitted_at >= now() - interval '24 hours';
--
--   (B) 최근 스탬프 피드 (LIMIT 30):
--       SELECT ...
--         FROM mission_submissions
--        WHERE status IN ('APPROVED','AUTO_APPROVED')
--          AND org_mission_id = ANY($1)
--        ORDER BY submitted_at DESC LIMIT 30;
--
--   (C) LIVE pack 완료율 집계:
--       pack별 org_mission_id 목록을 모아 status IN (APPROVED/AUTO_APPROVED) 건수.
--
-- 현재 인덱스 상태:
--   - idx_mission_sub_user_time     (user_id, submitted_at DESC)   ← 사용자 중심
--   - idx_mission_sub_mission       (org_mission_id)                ← status 재필터 필요
--   - idx_mission_sub_pending       (status) WHERE status='PENDING_REVIEW'
--   - idx_mission_sub_pending_queue (org_mission_id, submitted_at ASC) WHERE PENDING_REVIEW
--       → 모두 PENDING_REVIEW 전용이거나 user 중심. APPROVED 계열 쿼리는 heap scan.
--
-- 해결:
--   (org_mission_id, submitted_at DESC) WHERE status IN ('APPROVED','AUTO_APPROVED')
--   - 카운트/피드/팩별 집계 모두 인덱스만으로 처리
--   - ORDER BY submitted_at DESC 가 인덱스 정렬로 그대로 소비됨
--   - 부분 인덱스라 PENDING/REJECTED/REVOKED 는 제외되어 크기 작음
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_mission_sub_approved_feed
  ON public.mission_submissions (org_mission_id, submitted_at DESC)
  WHERE status IN ('APPROVED', 'AUTO_APPROVED');


-- ---------------------------------------------------------------------------
-- 2) user_acorn_transactions — 양수(적립) 전용 부분 인덱스
--
-- Phase 2 쿼리:
--   (A) 도토리 집계 (24h/6h/전체):
--       SELECT sum(amount)
--         FROM user_acorn_transactions
--        WHERE user_id = ANY($1)
--          AND amount > 0
--          AND created_at >= $window;
--
--   (B) 리더보드 (30일 TOP 10):
--       SELECT user_id, sum(amount) AS total
--         FROM user_acorn_transactions
--        WHERE user_id = ANY($1)
--          AND amount > 0
--          AND created_at >= now() - interval '30 days'
--        GROUP BY user_id
--        ORDER BY total DESC LIMIT 10;
--
-- 현재 인덱스 상태:
--   - idx_user_acorn_tx_user_created    (user_id, created_at DESC)
--   - idx_user_acorn_tx_reason          (reason)
--   - uniq_user_acorn_tx_mission_source (source_type, source_id) WHERE source_type='mission_submission'
--       → (user_id, created_at DESC) 가 기본은 커버. 하지만 SPEND_COUPON/DECORATION
--         등 음수 행이 섞여 있어 user 당 절반 가량이 불필요한 힙 방문.
--
-- 해결:
--   (user_id, created_at DESC) WHERE amount > 0 부분 인덱스.
--   - 집계 창(24h/6h/30d)에서 스캔 행수 최소화
--   - 리더보드 GROUP BY user_id 에도 index-only scan 가능성 향상
--   - 기존 idx_user_acorn_tx_user_created 는 전체 거래 조회용(잔액·거래내역)으로 유지
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_user_acorn_tx_user_earn
  ON public.user_acorn_transactions (user_id, created_at DESC)
  WHERE amount > 0;


-- ---------------------------------------------------------------------------
-- 3) org_quest_packs — (org_id, status) LIVE 부분 인덱스
--
-- Phase 2 쿼리:
--   SELECT id FROM org_quest_packs
--    WHERE org_id = $1 AND status = 'LIVE';
--
-- 현재 인덱스 상태:
--   - idx_org_quest_packs_org     (org_id)
--   - idx_org_quest_packs_status  (status) WHERE status IN ('LIVE','DRAFT')
--       → 두 인덱스 중 택일해 BitmapAnd 로 합쳐야 함. org 당 pack 수가
--         수~수십 개라 현재도 빠르지만, 관제실이 5초 폴링으로 반복 호출되므로
--         (org_id, status) 복합 부분 인덱스로 단일 스캔 경로 제공.
--
-- 해결:
--   (org_id) WHERE status = 'LIVE' 부분 인덱스. status 컬럼 없이도
--   부분 조건으로 status='LIVE' 가 보장됨. 크기 최소, 조회 즉답.
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_org_quest_packs_org_live
  ON public.org_quest_packs (org_id)
  WHERE status = 'LIVE';


-- ============================================================================
-- End of migration 20260601000000_control_room_phase2_indexes.sql
-- ============================================================================
