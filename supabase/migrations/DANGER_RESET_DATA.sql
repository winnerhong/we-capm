-- ============================================================================
-- 🚨 DANGER — 토리로 운영 데이터 전체 초기화 스크립트
-- ============================================================================
-- 목적 : 지사(partners) · 기관(partner_orgs) · 이용자(app_users) · 행사(events)
--        관련 모든 데이터를 비워서 관리자 포털에서 처음부터 다시 등록하기 위함.
--
-- 실행 방법 :
--   1) Supabase Dashboard > Database > Backups 에서 백업/PITR 준비 상태 확인
--   2) Supabase Dashboard > SQL Editor 에서 이 파일 통째로 복붙 → Run
--   3) 중간의 확인용 SELECT 결과가 모두 0 인지 확인
--   4) 문제 없으면 COMMIT, 이상하면 ROLLBACK 주석 처리한 후 실행 취소
--
-- 보존되는 것 :
--   - 관리자 계정 (DB 테이블 아닌 env/쿠키 기반이라 영향 없음)
--   - stamp_boards / stamp_slots 등 partner 참조 없는 참조 데이터
--
-- CASCADE 로 자동 삭제되는 것 (주요) :
--   partners ▸ partner_orgs, partner_programs, partner_trails, partner_trail_stops,
--             partner_customers, partner_companies, partner_segments,
--             partner_campaigns, partner_missions, partner_doc_templates,
--             partner_media_assets, partner_team_members,
--             subscriptions, coupons, invoices, settlements, tax_invoices,
--             refunds, payment_transactions, acorn_recharges, referrals,
--             partner_landing_pages, partner_external_reviews,
--             partner_automations, partner_bulk_imports, ...
--   partner_orgs ▸ org_programs, org_missions, org_quest_packs, org_documents,
--                  org_children, tori_fm_sessions, mission_submissions,
--                  mission_broadcasts, ... (기관 참조 모든 테이블)
--   app_users ▸ app_children, mission_submissions,
--               tori_fm_chat_messages, tori_fm_requests, tori_fm_reactions,
--               tori_fm_poll_votes, tori_fm_request_hearts, stamp_records, ...
--   events ▸ guilds, guild_members, challenges, event_reviews,
--            event_team_assignments, ... (행사 참조 테이블)
-- ============================================================================

BEGIN;

-- 1) 지사 뿌리 CASCADE 삭제
TRUNCATE TABLE partners RESTART IDENTITY CASCADE;

-- 2) 이용자(보호자·자녀) CASCADE 삭제
TRUNCATE TABLE app_users RESTART IDENTITY CASCADE;

-- 3) 행사(events) CASCADE 삭제 — 캠픽 매니저 포털 초기화
TRUNCATE TABLE events RESTART IDENTITY CASCADE;

-- ---------------------------------------------------------------------------
-- 확인 쿼리 — 모두 0 나와야 정상
-- ---------------------------------------------------------------------------
SELECT
  (SELECT count(*) FROM partners)       AS partners_left,
  (SELECT count(*) FROM partner_orgs)   AS orgs_left,
  (SELECT count(*) FROM app_users)      AS users_left,
  (SELECT count(*) FROM app_children)   AS children_left,
  (SELECT count(*) FROM events)         AS events_left,
  (SELECT count(*) FROM partner_programs) AS programs_left,
  (SELECT count(*) FROM partner_trails) AS trails_left,
  (SELECT count(*) FROM partner_missions) AS missions_left;

-- ---------------------------------------------------------------------------
-- ✅ 확인 결과가 모두 0 이면 아래 COMMIT 줄을 실행
-- ❌ 이상 있으면 ROLLBACK 줄을 대신 실행
-- ---------------------------------------------------------------------------
COMMIT;
-- ROLLBACK;

-- ============================================================================
-- 끝. 이제 /admin 으로 로그인해서 지사를 하나씩 등록하시면 됩니다.
-- ============================================================================
