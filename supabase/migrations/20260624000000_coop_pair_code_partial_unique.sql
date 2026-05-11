-- mission_coop_sessions.pair_code: 영구 UNIQUE → 활성 세션만 UNIQUE.
--
-- 배경: 페어 코드를 6자 영숫자(31^6 ≈ 9억) → 4자리 숫자(10,000) 로 변경.
--   알파벳 공간이 좁아져서 만료/완료/취소된 코드는 재사용해야 충돌 빈발 방지.
--
-- 정책:
--   - 활성 상태(WAITING/PAIRED/A_DONE/B_DONE) 사이에서만 UNIQUE 강제.
--   - 종료 상태(COMPLETED/EXPIRED/CANCELLED) 의 코드는 자유롭게 재사용 가능.
--   - 이 변경은 4자리 숫자 코드로의 전환과 함께 출시.
--
-- 안전: 기존 데이터에 중복이 있을 가능성은 매우 낮지만(영구 UNIQUE 였으므로),
--   부분 UNIQUE 인덱스 생성은 IF NOT EXISTS 로 idempotent.

-- 1) 기존 영구 UNIQUE 제약 제거.
--    Postgres 는 UNIQUE 제약을 "constraint" 로 만들면 컬럼 정의에 따라 자동 인덱스 생성.
--    20260517 마이그레이션의 "pair_code text NOT NULL UNIQUE" 가 이런 케이스.
--    constraint 이름은 보통 "<table>_<col>_key" → "mission_coop_sessions_pair_code_key".
ALTER TABLE mission_coop_sessions
  DROP CONSTRAINT IF EXISTS mission_coop_sessions_pair_code_key;

-- 혹시 직접 인덱스로 만든 경우 대비.
DROP INDEX IF EXISTS mission_coop_sessions_pair_code_idx;

-- 2) 활성 상태에서만 UNIQUE 보장하는 부분 UNIQUE 인덱스.
--    종료 상태(COMPLETED/EXPIRED/CANCELLED) 의 코드는 새 세션이 같은 값으로 INSERT 가능.
CREATE UNIQUE INDEX IF NOT EXISTS idx_coop_sessions_pair_code_active
  ON mission_coop_sessions (pair_code)
  WHERE state IN ('WAITING', 'PAIRED', 'A_DONE', 'B_DONE');

-- 3) 조회 보조 — 종료 상태 코드 lookup 이 가끔 필요할 수 있어 일반 인덱스 유지.
CREATE INDEX IF NOT EXISTS idx_coop_sessions_pair_code_any
  ON mission_coop_sessions (pair_code);

-- 4) PostgREST 스키마 캐시 새로고침.
NOTIFY pgrst, 'reload schema';
