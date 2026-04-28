-- ============================================================
-- org_event_timeline_slots — 행사 타임테이블의 시간 슬롯
--
-- 행사(org_events) 안에서 시간순으로 흐르는 슬롯들. 참가자가 보면
-- "오늘 09:00 입소식 / 10:00 사진 미션 / 12:00 점심 ..." 같은 일정표가 됨.
-- 기관이 직접 추가/편집/삭제. ref_id 로 미션/스탬프북/FM 세션을 가리킬 수
-- 있지만 v1 은 free-form (title + description) 만 사용.
--
-- slot_kind 9종:
--   MISSION       — 단일 미션 시작 안내
--   STAMPBOOK     — 스탬프북 묶음 안내
--   FM_SESSION    — 토리FM 라디오
--   BROADCAST     — 돌발 미션
--   TRAIL         — 숲길 산책
--   FREE          — 자유시간/자유체험
--   MEAL          — 식사
--   BREAK         — 휴식
--   CUSTOM        — 기타 사용자 정의
-- ============================================================

CREATE TABLE IF NOT EXISTS org_event_timeline_slots (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id        uuid NOT NULL REFERENCES org_events(id) ON DELETE CASCADE,
  starts_at       timestamptz NOT NULL,
  ends_at         timestamptz,
  title           text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 100),
  description     text,
  slot_kind       text NOT NULL CHECK (
    slot_kind IN (
      'MISSION','STAMPBOOK','FM_SESSION','BROADCAST','TRAIL',
      'FREE','MEAL','BREAK','CUSTOM'
    )
  ),
  ref_id          uuid,
  icon_emoji      text,
  location        text,
  display_order   int NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- 행사별 시간순 + display_order 정렬 인덱스 (참가자 화면이 가장 자주 호출)
CREATE INDEX IF NOT EXISTS idx_event_timeline_slots_event_starts
  ON org_event_timeline_slots (event_id, starts_at, display_order);

-- updated_at 자동 갱신 트리거 (mission 시스템에서 만든 public.set_updated_at 재사용)
DROP TRIGGER IF EXISTS trg_event_timeline_slots_updated_at
  ON org_event_timeline_slots;
CREATE TRIGGER trg_event_timeline_slots_updated_at
  BEFORE UPDATE ON org_event_timeline_slots
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS — Phase 0 permissive
ALTER TABLE org_event_timeline_slots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "event_timeline_slots_all" ON org_event_timeline_slots;
CREATE POLICY "event_timeline_slots_all" ON org_event_timeline_slots
  FOR ALL USING (true) WITH CHECK (true);
-- TODO(phase X): event 의 org_id 와 일치하는 기관 스태프만 INSERT/UPDATE/DELETE,
--                참가자(같은 org_event_participants) 만 SELECT.

-- Realtime publication 등록 — 기관이 슬롯 추가하면 참가자 화면 즉시 반영
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE org_event_timeline_slots;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN undefined_object THEN NULL;
  END;
END $$;
