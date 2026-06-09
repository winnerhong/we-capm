-- ============================================================
-- tori_fm_boosts.user_id FK 에 ON DELETE CASCADE 추가.
--
-- 문제:
--   참가자(app_users) 영구 삭제 시 tori_fm_boosts 가 user_id 를
--   ON DELETE 절 없이(=NO ACTION) 참조해 FK 위반(23503)으로 삭제 실패.
--   "An error occurred in the Server Components render" 로 표시됨.
--   app_users 를 참조하는 다른 모든 테이블은 CASCADE / SET NULL 인데
--   이 테이블만 누락돼 있었음 (20260729 마이그레이션).
--
-- 해결:
--   다른 토리FM 테이블(tori_fm_requests 등)과 동일하게 ON DELETE CASCADE.
--   참가자를 지우면 그 사람의 boost ledger 도 함께 정리됨.
--
-- 안전:
--   FK 제약 교체만 — 데이터 변경 없음. DROP IF EXISTS 로 멱등.
-- ============================================================

ALTER TABLE public.tori_fm_boosts
  DROP CONSTRAINT IF EXISTS tori_fm_boosts_user_id_fkey;

ALTER TABLE public.tori_fm_boosts
  ADD CONSTRAINT tori_fm_boosts_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.app_users(id) ON DELETE CASCADE;
