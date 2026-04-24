-- ============================================================================
-- Migration: 20260528000000_fm_reaction_emoji_acorn_to_sprout.sql
-- Purpose : 토리FM 리액션 이모지 유니콘상 "Chestnut(밤)" 🌰 → 🌱(새싹) 으로 치환.
--           브랜드 도토리 아이콘은 프론트 `<AcornIcon />` 컴포넌트로 분리됨.
-- ============================================================================

-- 1) 기존 데이터 마이그레이션
UPDATE tori_fm_reactions
SET emoji = '🌱'
WHERE emoji = '🌰';

-- 2) CHECK 제약 교체 (기존 제약은 익명/자동이름일 수 있어 drop 대신 단순 재정의)
ALTER TABLE tori_fm_reactions
  DROP CONSTRAINT IF EXISTS tori_fm_reactions_emoji_check;

ALTER TABLE tori_fm_reactions
  ADD CONSTRAINT tori_fm_reactions_emoji_check
  CHECK (emoji IN ('❤','👏','🎉','🌲','🌱','😂'));

-- 실행 후: NOTIFY pgrst, 'reload schema';
