-- =====================================================
-- 🌲 토리로 - 선택 배포 스키마 + 테스트 시드 (순수 SQL 버전)
-- Supabase SQL Editor에 전체 복붙 → Run
-- 여러 번 실행 안전 (idempotent)
-- PL/pgSQL 함수 없이 세션 변수 + CTE로만 구성
-- =====================================================

-- =====================================================
-- PART 1) partner_programs 스키마 확장
-- =====================================================
ALTER TABLE partner_programs ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'DRAFT'
  CHECK (visibility IN ('DRAFT','ALL','SELECTED','ARCHIVED'));
ALTER TABLE partner_programs ADD COLUMN IF NOT EXISTS long_description text;
ALTER TABLE partner_programs ADD COLUMN IF NOT EXISTS schedule_items jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE partner_programs ADD COLUMN IF NOT EXISTS required_items text[] NOT NULL DEFAULT '{}';
ALTER TABLE partner_programs ADD COLUMN IF NOT EXISTS safety_notes text;
ALTER TABLE partner_programs ADD COLUMN IF NOT EXISTS target_audience text;
ALTER TABLE partner_programs ADD COLUMN IF NOT EXISTS images text[] NOT NULL DEFAULT '{}';
ALTER TABLE partner_programs ADD COLUMN IF NOT EXISTS faq jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE partner_programs ADD COLUMN IF NOT EXISTS linked_trail_id uuid REFERENCES partner_trails(id) ON DELETE SET NULL;

UPDATE partner_programs SET visibility = 'ALL'
  WHERE is_published = true AND visibility = 'DRAFT';

CREATE INDEX IF NOT EXISTS idx_partner_programs_visibility ON partner_programs(visibility);
CREATE INDEX IF NOT EXISTS idx_partner_programs_linked_trail ON partner_programs(linked_trail_id);

CREATE TABLE IF NOT EXISTS partner_program_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id uuid NOT NULL REFERENCES partner_programs(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES partner_orgs(id) ON DELETE CASCADE,
  assigned_by uuid,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(program_id, org_id)
);
CREATE INDEX IF NOT EXISTS idx_assignments_program ON partner_program_assignments(program_id);
CREATE INDEX IF NOT EXISTS idx_assignments_org ON partner_program_assignments(org_id);

ALTER TABLE partner_program_assignments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "partner_program_assignments_all" ON partner_program_assignments;
CREATE POLICY "partner_program_assignments_all" ON partner_program_assignments
  FOR ALL USING (true) WITH CHECK (true);

-- =====================================================
-- PART 2) partner_trails 스키마 확장
-- =====================================================
ALTER TABLE partner_trails ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'DRAFT'
  CHECK (visibility IN ('DRAFT','ALL','SELECTED','ARCHIVED'));

UPDATE partner_trails SET visibility = 'ALL'
  WHERE status = 'PUBLISHED' AND visibility = 'DRAFT';
UPDATE partner_trails SET visibility = 'ARCHIVED'
  WHERE status = 'ARCHIVED' AND visibility = 'DRAFT';

CREATE INDEX IF NOT EXISTS idx_partner_trails_visibility ON partner_trails(visibility);

CREATE TABLE IF NOT EXISTS partner_trail_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trail_id uuid NOT NULL REFERENCES partner_trails(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES partner_orgs(id) ON DELETE CASCADE,
  assigned_by uuid,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(trail_id, org_id)
);
CREATE INDEX IF NOT EXISTS idx_trail_assignments_trail ON partner_trail_assignments(trail_id);
CREATE INDEX IF NOT EXISTS idx_trail_assignments_org ON partner_trail_assignments(org_id);

ALTER TABLE partner_trail_assignments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "partner_trail_assignments_all" ON partner_trail_assignments;
CREATE POLICY "partner_trail_assignments_all" ON partner_trail_assignments
  FOR ALL USING (true) WITH CHECK (true);

-- =====================================================
-- PART 3) 세션 변수로 partner_id 저장 (PL/pgSQL 없이)
-- =====================================================
SELECT set_config(
  'seed.partner_id',
  COALESCE(
    (SELECT id::text FROM partners WHERE status='ACTIVE' ORDER BY created_at ASC LIMIT 1),
    (SELECT id::text FROM partners ORDER BY created_at ASC LIMIT 1),
    ''
  ),
  false
);

-- =====================================================
-- PART 4) 기존 [테스트] 데이터 삭제 (idempotent)
-- =====================================================
DELETE FROM partner_trail_assignments
  WHERE trail_id IN (
    SELECT id FROM partner_trails
    WHERE name LIKE '[테스트]%'
      AND partner_id = NULLIF(current_setting('seed.partner_id', true), '')::uuid
  );

DELETE FROM partner_trail_stops
  WHERE trail_id IN (
    SELECT id FROM partner_trails
    WHERE name LIKE '[테스트]%'
      AND partner_id = NULLIF(current_setting('seed.partner_id', true), '')::uuid
  );

DELETE FROM partner_trails
  WHERE name LIKE '[테스트]%'
    AND partner_id = NULLIF(current_setting('seed.partner_id', true), '')::uuid;

DELETE FROM partner_program_assignments
  WHERE program_id IN (
    SELECT id FROM partner_programs
    WHERE title LIKE '[테스트]%'
      AND partner_id = NULLIF(current_setting('seed.partner_id', true), '')::uuid
  );

DELETE FROM partner_programs
  WHERE title LIKE '[테스트]%'
    AND partner_id = NULLIF(current_setting('seed.partner_id', true), '')::uuid;

-- =====================================================
-- PART 5) 프로그램 10개 삽입
-- =====================================================
INSERT INTO partner_programs (
  partner_id, title, description, long_description, category,
  duration_hours, capacity_min, capacity_max, price_per_person, b2b_price_per_person,
  location_region, location_detail, tags, visibility, is_published,
  safety_notes, target_audience, required_items, schedule_items, faq
)
SELECT
  current_setting('seed.partner_id')::uuid,
  data.title, data.description, data.long_description, data.category,
  data.duration_hours, data.capacity_min, data.capacity_max, data.price_per_person, data.b2b_price_per_person,
  data.location_region, data.location_detail, data.tags, data.visibility, data.is_published,
  data.safety_notes, data.target_audience, data.required_items, data.schedule_items, data.faq
FROM (VALUES
  ('[테스트] 가족 숲길 체험', '가족과 함께 떠나는 반나절 숲 산책',
   '계절에 맞는 숲길을 따라 걸으며 자연을 관찰하고 가족과 대화를 나누는 프로그램.',
   'FOREST', 2.5::numeric, 4, 20, 35000, 28000, '경기도', '가평 자라섬',
   ARRAY['가족','반나절','입문']::text[], 'ALL', true,
   '우천 시 취소될 수 있어요. 미끄럼 방지 신발 권장.', '5~10세 가족',
   ARRAY['운동화','물 500ml','얇은 겉옷']::text[],
   '[{"time":"10:00","title":"집결","desc":"주차장 안내소 앞"},{"time":"10:30","title":"숲길 입장"},{"time":"12:00","title":"마무리"}]'::jsonb,
   '[{"q":"비 오면 어떻게 되나요?","a":"당일 아침 8시에 결정됩니다."}]'::jsonb),
  ('[테스트] 아이들 자연 관찰 교실', '돋보기와 도감을 들고 떠나는 탐험',
   NULL, 'KIDS', 2.0::numeric, 5, 15, 30000, 25000, '경기도', '양평 수목원',
   ARRAY['어린이','관찰','돋보기']::text[], 'ALL', true,
   NULL, '초등 저학년',
   ARRAY['모자','돋보기(제공)','간식']::text[],
   '[{"time":"10:00","title":"시작"},{"time":"11:30","title":"결과 나눔"}]'::jsonb,
   '[]'::jsonb),
  ('[테스트] 가을 낙엽 밟기 산책', '바스락 소리와 함께하는 힐링 산책',
   NULL, 'FAMILY', 1.5::numeric, 2, 30, 20000, 15000, '서울', '북한산 둘레길',
   ARRAY['가을','산책','힐링']::text[], 'ALL', true,
   '낙엽에 미끄러질 수 있으니 조심.', '전 연령',
   ARRAY['편한 신발','물']::text[],
   '[]'::jsonb, '[]'::jsonb),
  ('[테스트] 팀빌딩 숲 놀이', '회사 팀과 함께하는 자연 속 게임',
   NULL, 'TEAM', 4.0::numeric, 10, 40, 55000, 45000, '강원도', '평창 숲속 놀이터',
   ARRAY['팀빌딩','기업','게임']::text[], 'SELECTED', true,
   NULL, '20~50대 직장인',
   ARRAY['운동복','수건']::text[],
   '[]'::jsonb, '[]'::jsonb),
  ('[테스트] 캠핑 1박 체험', '하룻밤 숲에서 잠자기',
   '텐트 설치부터 모닥불까지 초보자도 가능한 1박 캠핑.',
   'CAMPING', 24.0::numeric, 4, 24, 120000, 100000, '충남', '태안 솔숲 캠핑장',
   ARRAY['캠핑','1박','장비제공']::text[], 'ALL', true,
   '밤 기온 주의, 침낭 권장.', '가족 / 4인 이상',
   ARRAY['침낭','세면도구','손전등']::text[],
   '[]'::jsonb, '[]'::jsonb),
  ('[테스트] 자연 예술 워크숍', '숲에서 주운 재료로 만드는 작품',
   NULL, 'ART', 2.0::numeric, 5, 20, 40000, 32000, '경기도', '여주 공방',
   ARRAY['예술','공예','창작']::text[], 'SELECTED', true,
   NULL, '초등 이상',
   ARRAY['앞치마(제공)']::text[],
   '[]'::jsonb, '[]'::jsonb),
  ('[테스트] 숲속 요가 명상', '새소리와 함께하는 아침 요가',
   NULL, 'FAMILY', 1.0::numeric, 3, 12, 25000, 20000, '경기도', '가평 명상숲',
   ARRAY['요가','명상','아침']::text[], 'ALL', true,
   NULL, '성인',
   ARRAY['요가매트(제공)','편한 복장']::text[],
   '[]'::jsonb, '[]'::jsonb),
  ('[테스트] 별빛 야행', '랜턴 들고 떠나는 밤 숲 탐험',
   '해가 진 후 보이는 숲의 다른 얼굴을 만나봐요.',
   'FAMILY', 2.5::numeric, 4, 20, 45000, 38000, '강원도', '영월 별빛 숲',
   ARRAY['야간','별','랜턴']::text[], 'SELECTED', true,
   '밤이라 보호자 필수. 어두우니 조심.', '7세 이상 가족',
   ARRAY['랜턴(제공)','따뜻한 옷']::text[],
   '[]'::jsonb, '[]'::jsonb),
  ('[테스트] 겨울 숲 탐험 (작성 중)', '초안 상태 — 아직 공개 안 됨',
   NULL, 'FOREST', 3.0::numeric, 4, 16, 50000, 42000, '강원도', '평창 겨울숲',
   ARRAY['겨울','초안']::text[], 'DRAFT', false,
   NULL, NULL,
   ARRAY[]::text[],
   '[]'::jsonb, '[]'::jsonb),
  ('[테스트] 숲 속 보물 찾기 (보관)', '지난 시즌 운영 — 보관됨',
   NULL, 'KIDS', 1.5::numeric, 5, 20, 22000, 18000, '경기도', '어딘가',
   ARRAY['보관','이전']::text[], 'ARCHIVED', false,
   NULL, NULL,
   ARRAY[]::text[],
   '[]'::jsonb, '[]'::jsonb)
) AS data(
  title, description, long_description, category,
  duration_hours, capacity_min, capacity_max, price_per_person, b2b_price_per_person,
  location_region, location_detail, tags, visibility, is_published,
  safety_notes, target_audience, required_items, schedule_items, faq
);

-- =====================================================
-- PART 6) 숲길 10개 삽입
-- =====================================================
INSERT INTO partner_trails (partner_id, name, description, difficulty, estimated_minutes, distance_km, visibility, status)
SELECT current_setting('seed.partner_id')::uuid, d.name, d.description, d.difficulty, d.estimated_minutes, d.distance_km, d.visibility, d.status
FROM (VALUES
  ('[테스트] 가벼운 산책길', '30분 미니 코스', 'EASY', 30, 1.2::numeric, 'ALL', 'PUBLISHED'),
  ('[테스트] 자연 관찰 코스', '숲의 생물을 찾아보는 코스', 'EASY', 40, 1.5::numeric, 'ALL', 'PUBLISHED'),
  ('[테스트] 역사 탐방 코스', '옛 사찰과 유적지를 따라', 'MEDIUM', 60, 2.5::numeric, 'SELECTED', 'PUBLISHED'),
  ('[테스트] 가족 모험 코스', '아이와 함께 도전', 'MEDIUM', 90, 3.0::numeric, 'ALL', 'PUBLISHED'),
  ('[테스트] 숲 체험 종합 코스', '숲 전체 체험 올인원', 'EASY', 50, 1.8::numeric, 'SELECTED', 'PUBLISHED'),
  ('[테스트] 야생화 코스', '계절 꽃을 따라 걷는 길', 'EASY', 40, 1.4::numeric, 'ALL', 'PUBLISHED'),
  ('[테스트] 전망대 코스', '정상에서 바라보는 풍경', 'HARD', 120, 5.0::numeric, 'ALL', 'PUBLISHED'),
  ('[테스트] 계곡 코스', '시원한 물소리와 함께', 'MEDIUM', 80, 2.8::numeric, 'SELECTED', 'PUBLISHED'),
  ('[테스트] 미공개 코스 (초안)', '아직 작성 중', 'EASY', 30, 1.0::numeric, 'DRAFT', 'DRAFT'),
  ('[테스트] 보관 코스', '지난 시즌 — 보관됨', 'EASY', 20, 0.8::numeric, 'ARCHIVED', 'ARCHIVED')
) AS d(name, description, difficulty, estimated_minutes, distance_km, visibility, status);

-- =====================================================
-- PART 7) 숲길 지점 삽입 (trail 이름으로 JOIN)
-- =====================================================
INSERT INTO partner_trail_stops (trail_id, "order", name, description, qr_code, mission_type, mission_config, reward_points)
SELECT t.id, s.ord, s.stop_name, s.stop_desc, s.qr_code, s.mission_type, s.mission_config, s.reward_points
FROM partner_trails t
JOIN (VALUES
  -- 1. 가벼운 산책길
  ('[테스트] 가벼운 산책길', 1, '입구 안내판', '코스 설명판 앞', 'TEST0001', 'CHECKIN', '{}'::jsonb, 10),
  ('[테스트] 가벼운 산책길', 2, '첫 번째 벤치', '쉬어가기 좋은 곳', 'TEST0002', 'PHOTO', '{"minPhotos":1}'::jsonb, 15),
  ('[테스트] 가벼운 산책길', 3, '도착 지점', '작은 정자', 'TEST0003', 'CHECKIN', '{}'::jsonb, 10),
  -- 2. 자연 관찰 코스
  ('[테스트] 자연 관찰 코스', 1, '곤충 관찰 포인트', '큰 나무 밑', 'TEST0011', 'QUIZ', '{"question":"여기서 볼 수 있는 곤충은?","answer":"개미"}'::jsonb, 15),
  ('[테스트] 자연 관찰 코스', 2, '새집 관찰대', '위를 올려다 보세요', 'TEST0012', 'PHOTO', '{"minPhotos":1}'::jsonb, 15),
  ('[테스트] 자연 관찰 코스', 3, '식물 도감 포인트', '이름표가 있어요', 'TEST0013', 'QUIZ', '{"question":"이 나무는?","answer":"참나무"}'::jsonb, 20),
  -- 3. 역사 탐방 코스
  ('[테스트] 역사 탐방 코스', 1, '마을 입구 비석', '큰 돌비석', 'TEST0021', 'CHECKIN', '{}'::jsonb, 10),
  ('[테스트] 역사 탐방 코스', 2, '옛 정자', '조선시대 정자', 'TEST0022', 'PHOTO', '{"minPhotos":1}'::jsonb, 20),
  ('[테스트] 역사 탐방 코스', 3, '역사 게시판', '안내문을 읽고', 'TEST0023', 'QUIZ', '{"question":"세워진 연도는?","answer":"1800"}'::jsonb, 25),
  ('[테스트] 역사 탐방 코스', 4, '종착지 박물관', '마무리 체크인', 'TEST0024', 'CHECKIN', '{}'::jsonb, 15),
  -- 4. 가족 모험 코스
  ('[테스트] 가족 모험 코스', 1, '출발 지점', '지도 앞', 'TEST0031', 'CHECKIN', '{}'::jsonb, 10),
  ('[테스트] 가족 모험 코스', 2, '작은 개울', '물소리 듣기', 'TEST0032', 'PHOTO', '{"minPhotos":1}'::jsonb, 20),
  ('[테스트] 가족 모험 코스', 3, '큰 바위', '기념 사진', 'TEST0033', 'PHOTO', '{"minPhotos":1}'::jsonb, 20),
  ('[테스트] 가족 모험 코스', 4, '정상 전망대', '탁 트인 풍경', 'TEST0034', 'LOCATION', '{"radiusMeters":30}'::jsonb, 30),
  -- 5. 숲 체험 종합 코스
  ('[테스트] 숲 체험 종합 코스', 1, '오감 체험장', '만지고 냄새 맡기', 'TEST0041', 'PHOTO', '{"minPhotos":1}'::jsonb, 15),
  ('[테스트] 숲 체험 종합 코스', 2, '퀴즈 존', '숲 상식 퀴즈', 'TEST0042', 'QUIZ', '{"question":"가장 큰 나무는?","answer":"참나무"}'::jsonb, 20),
  ('[테스트] 숲 체험 종합 코스', 3, '체크 포인트', '간단 체크인', 'TEST0043', 'CHECKIN', '{}'::jsonb, 10),
  -- 6. 야생화 코스
  ('[테스트] 야생화 코스', 1, '진달래 군락', '봄 명소', 'TEST0051', 'PHOTO', '{"minPhotos":1}'::jsonb, 15),
  ('[테스트] 야생화 코스', 2, '들국화 포인트', '가을 포인트', 'TEST0052', 'PHOTO', '{"minPhotos":1}'::jsonb, 15),
  ('[테스트] 야생화 코스', 3, '마지막 꽃길', '종점', 'TEST0053', 'CHECKIN', '{}'::jsonb, 10),
  -- 7. 전망대 코스
  ('[테스트] 전망대 코스', 1, '등산 시작', '체조 후 출발', 'TEST0061', 'CHECKIN', '{}'::jsonb, 15),
  ('[테스트] 전망대 코스', 2, '중간 쉼터', '물 한 모금', 'TEST0062', 'PHOTO', '{"minPhotos":1}'::jsonb, 20),
  ('[테스트] 전망대 코스', 3, '정상 전망대', '파노라마', 'TEST0063', 'LOCATION', '{"radiusMeters":50}'::jsonb, 40),
  ('[테스트] 전망대 코스', 4, '하산 완료', '출발지 복귀', 'TEST0064', 'CHECKIN', '{}'::jsonb, 25),
  -- 8. 계곡 코스
  ('[테스트] 계곡 코스', 1, '계곡 초입', '물이 시작되는 곳', 'TEST0071', 'PHOTO', '{"minPhotos":1}'::jsonb, 15),
  ('[테스트] 계곡 코스', 2, '무지개 폭포', '가장 아름다운 포인트', 'TEST0072', 'PHOTO', '{"minPhotos":2}'::jsonb, 25),
  ('[테스트] 계곡 코스', 3, '계곡 끝', '종점 체크인', 'TEST0073', 'CHECKIN', '{}'::jsonb, 15),
  -- 9. 미공개 코스
  ('[테스트] 미공개 코스 (초안)', 1, '초안 지점 1', '임시', 'TEST0081', 'CHECKIN', '{}'::jsonb, 10),
  ('[테스트] 미공개 코스 (초안)', 2, '초안 지점 2', '임시', 'TEST0082', 'CHECKIN', '{}'::jsonb, 10),
  -- 10. 보관 코스
  ('[테스트] 보관 코스', 1, '보관 지점', '이전 운영 기록', 'TEST0091', 'CHECKIN', '{}'::jsonb, 10)
) AS s(trail_name, ord, stop_name, stop_desc, qr_code, mission_type, mission_config, reward_points)
  ON t.name = s.trail_name
 AND t.partner_id = current_setting('seed.partner_id')::uuid;

-- =====================================================
-- PART 8) 프로그램 SELECTED → 기관 2개에 할당
-- =====================================================
INSERT INTO partner_program_assignments (program_id, org_id, assigned_by)
SELECT p.id, o.id, p.partner_id
FROM partner_programs p
CROSS JOIN LATERAL (
  SELECT id FROM partner_orgs
  WHERE partner_id = current_setting('seed.partner_id')::uuid
  ORDER BY created_at ASC
  LIMIT 2
) o
WHERE p.title LIKE '[테스트]%'
  AND p.visibility = 'SELECTED'
  AND p.partner_id = current_setting('seed.partner_id')::uuid
ON CONFLICT (program_id, org_id) DO NOTHING;

-- =====================================================
-- PART 9) 숲길 SELECTED → 기관 2개에 할당
-- =====================================================
INSERT INTO partner_trail_assignments (trail_id, org_id, assigned_by)
SELECT t.id, o.id, t.partner_id
FROM partner_trails t
CROSS JOIN LATERAL (
  SELECT id FROM partner_orgs
  WHERE partner_id = current_setting('seed.partner_id')::uuid
  ORDER BY created_at ASC
  LIMIT 2
) o
WHERE t.name LIKE '[테스트]%'
  AND t.visibility = 'SELECTED'
  AND t.partner_id = current_setting('seed.partner_id')::uuid
ON CONFLICT (trail_id, org_id) DO NOTHING;

-- =====================================================
-- PART 10) 확인 쿼리
-- =====================================================
SELECT 'partner_id' AS kind, NULL::int AS count, current_setting('seed.partner_id') AS detail
UNION ALL
SELECT 'programs' AS kind, COUNT(*)::int, visibility
  FROM partner_programs WHERE title LIKE '[테스트]%' GROUP BY visibility
UNION ALL
SELECT 'trails' AS kind, COUNT(*)::int, visibility
  FROM partner_trails WHERE name LIKE '[테스트]%' GROUP BY visibility
UNION ALL
SELECT 'program_assignments' AS kind, COUNT(*)::int, 'total' AS detail
  FROM partner_program_assignments a
  JOIN partner_programs p ON p.id = a.program_id
  WHERE p.title LIKE '[테스트]%'
UNION ALL
SELECT 'trail_assignments' AS kind, COUNT(*)::int, 'total' AS detail
  FROM partner_trail_assignments a
  JOIN partner_trails t ON t.id = a.trail_id
  WHERE t.name LIKE '[테스트]%'
ORDER BY kind, detail;
