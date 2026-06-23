-- 토리 빙고 — 기관(운영자) 문구 타일.
--   운영자가 사진 없이 "엄마가 아빠보다 연상인 가족" 같은 문구를 직접 만들어
--   모든 가족의 피드에 노출 → 가족이 자기 판에 배치 → 운영자가 호명 가능.
--   기관 타일은 소유 가족이 없으므로 user_id = NULL, is_org = true.

ALTER TABLE org_bingo_entries
  ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE org_bingo_entries
  ADD COLUMN IF NOT EXISTS is_org boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN org_bingo_entries.is_org IS
  '기관(운영자)이 만든 문구 타일. true면 user_id=NULL, photo_url="" 이고 keyword가 문구.';
