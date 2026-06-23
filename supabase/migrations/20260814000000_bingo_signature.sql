-- 토리 빙고 — ✍️ 싸인 받기 모드.
--   운영자가 보드에 "싸인 모드"를 켜면, 자동 호명 동그라미가 아니라
--   참가자가 자기 판의 각 사진 주인 가족을 직접 찾아가 4자리 인증번호를
--   받아 입력해야 그 칸이 동그라미(체크)된다. (사교형 미션 빙고)
--
--   - org_bingo_boards.signature_mode : 보드 전체 토글
--   - org_bingo_entries.signature_code: 가족(사진)별 고유 4자리 (본인 화면에 표시)
--   - org_bingo_signatures           : 누가(user_id) 어떤 칸(entry_id)을 인증했는지

ALTER TABLE org_bingo_boards
  ADD COLUMN IF NOT EXISTS signature_mode boolean NOT NULL DEFAULT false;

ALTER TABLE org_bingo_entries
  ADD COLUMN IF NOT EXISTS signature_code text;

COMMENT ON COLUMN org_bingo_entries.signature_code IS
  '싸인 모드용 가족별 고유 4자리 인증번호. 사진 주인이 다른 가족에게 보여줌. 기관 타일(is_org)은 NULL.';

-- 기존 사진 entry 에 보드별 고유 순차 코드 백필 (1000부터).
UPDATE org_bingo_entries e
SET signature_code = sub.code
FROM (
  SELECT
    id,
    lpad(
      (((row_number() OVER (PARTITION BY board_id ORDER BY created_at)) - 1) % 9000 + 1000)::text,
      4, '0'
    ) AS code
  FROM org_bingo_entries
  WHERE is_org = false
) sub
WHERE e.id = sub.id
  AND e.is_org = false
  AND e.signature_code IS NULL;

-- 보드 안에서 코드는 유일 (입력 시 주인을 특정할 수 있게).
CREATE UNIQUE INDEX IF NOT EXISTS uq_bingo_entries_sigcode
  ON org_bingo_entries (board_id, signature_code)
  WHERE signature_code IS NOT NULL;

-- 수집한 싸인 기록 — (board, 수집자 user, 인증한 칸 entry) 유일.
CREATE TABLE IF NOT EXISTS org_bingo_signatures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id uuid NOT NULL REFERENCES org_bingo_boards(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  entry_id uuid NOT NULL REFERENCES org_bingo_entries(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (board_id, user_id, entry_id)
);
CREATE INDEX IF NOT EXISTS idx_bingo_sign_board_user
  ON org_bingo_signatures (board_id, user_id);

ALTER TABLE org_bingo_signatures ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "bingo_signatures_all" ON org_bingo_signatures FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
