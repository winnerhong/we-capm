-- =====================================================
-- 테스트 시드: 프로그램 10개 + 숲길 10개 (+ 지점 + 할당)
-- Supabase SQL Editor에 통째로 복붙 → Run
-- 여러 번 실행 안전 ([테스트] 접두 항목을 먼저 지우고 재생성)
-- =====================================================

DO $$
#variable_conflict use_variable
DECLARE
  v_partner_id uuid;
  v_trail_id uuid;
  v_prog_id uuid;
  v_org_ids uuid[];
  v_assign_targets uuid[];
BEGIN
  -- 1) 사용할 파트너 선택: 첫 번째 ACTIVE, 없으면 첫 번째
  SELECT p.id INTO v_partner_id FROM public.partners p
    WHERE p.status = 'ACTIVE' ORDER BY p.created_at ASC LIMIT 1;
  IF v_partner_id IS NULL THEN
    SELECT p.id INTO v_partner_id FROM public.partners p ORDER BY p.created_at ASC LIMIT 1;
  END IF;
  IF v_partner_id IS NULL THEN
    RAISE NOTICE '파트너가 없습니다. 먼저 파트너를 만드세요.';
    RETURN;
  END IF;

  -- 2) 이 파트너의 기관 최대 3개 (SELECTED 할당 대상)
  SELECT ARRAY_AGG(sub.id) INTO v_org_ids FROM (
    SELECT o.id FROM public.partner_orgs o
    WHERE o.partner_id = v_partner_id
    ORDER BY o.created_at ASC LIMIT 3
  ) sub;

  -- 3) 기존 [테스트] 항목 삭제 (idempotent)
  IF to_regclass('public.partner_trail_assignments') IS NOT NULL THEN
    DELETE FROM public.partner_trail_assignments a
      WHERE a.trail_id IN (SELECT t.id FROM public.partner_trails t
                           WHERE t.name LIKE '[테스트]%' AND t.partner_id = v_partner_id);
  END IF;
  DELETE FROM public.partner_trail_stops s
    WHERE s.trail_id IN (SELECT t.id FROM public.partner_trails t
                         WHERE t.name LIKE '[테스트]%' AND t.partner_id = v_partner_id);
  DELETE FROM public.partner_trails t
    WHERE t.name LIKE '[테스트]%' AND t.partner_id = v_partner_id;

  IF to_regclass('public.partner_program_assignments') IS NOT NULL THEN
    DELETE FROM public.partner_program_assignments a
      WHERE a.program_id IN (SELECT p.id FROM public.partner_programs p
                             WHERE p.title LIKE '[테스트]%' AND p.partner_id = v_partner_id);
  END IF;
  DELETE FROM public.partner_programs p
    WHERE p.title LIKE '[테스트]%' AND p.partner_id = v_partner_id;

  -- =====================================================
  -- 프로그램 10개 삽입
  -- =====================================================
  INSERT INTO partner_programs (partner_id, title, description, long_description, category,
    duration_hours, capacity_min, capacity_max, price_per_person, b2b_price_per_person,
    location_region, location_detail, image_url, tags, visibility, is_published,
    safety_notes, target_audience, required_items, schedule_items, faq)
  VALUES
    (v_partner_id, '[테스트] 가족 숲길 체험', '가족과 함께 떠나는 반나절 숲 산책',
     '계절에 맞는 숲길을 따라 걸으며 자연을 관찰하고 가족과 대화를 나누는 프로그램.',
     'FOREST', 2.5, 4, 20, 35000, 28000, '경기도', '가평 자라섬',
     NULL, ARRAY['가족','반나절','입문'], 'ALL', true,
     '우천 시 취소될 수 있어요. 미끄럼 방지 신발 권장.', '5~10세 가족',
     ARRAY['운동화','물 500ml','얇은 겉옷'],
     '[{"time":"10:00","title":"집결","desc":"주차장 안내소 앞"},{"time":"10:30","title":"숲길 입장"},{"time":"12:00","title":"마무리"}]'::jsonb,
     '[{"q":"비 오면 어떻게 되나요?","a":"당일 아침 8시에 결정됩니다."}]'::jsonb),

    (v_partner_id, '[테스트] 아이들 자연 관찰 교실', '돋보기와 도감을 들고 떠나는 탐험',
     NULL, 'KIDS', 2.0, 5, 15, 30000, 25000, '경기도', '양평 수목원',
     NULL, ARRAY['어린이','관찰','돋보기'], 'ALL', true,
     NULL, '초등 저학년',
     ARRAY['모자','돋보기(제공)','간식'],
     '[{"time":"10:00","title":"시작"},{"time":"11:30","title":"결과 나눔"}]'::jsonb,
     '[]'::jsonb),

    (v_partner_id, '[테스트] 가을 낙엽 밟기 산책', '바스락 소리와 함께하는 힐링 산책',
     NULL, 'FAMILY', 1.5, 2, 30, 20000, 15000, '서울', '북한산 둘레길',
     NULL, ARRAY['가을','산책','힐링'], 'ALL', true,
     '낙엽에 미끄러질 수 있으니 조심.', '전 연령',
     ARRAY['편한 신발','물'],
     '[]'::jsonb, '[]'::jsonb),

    (v_partner_id, '[테스트] 팀빌딩 숲 놀이', '회사 팀과 함께하는 자연 속 게임',
     NULL, 'TEAM', 4.0, 10, 40, 55000, 45000, '강원도', '평창 숲속 놀이터',
     NULL, ARRAY['팀빌딩','기업','게임'], 'SELECTED', true,
     NULL, '20~50대 직장인',
     ARRAY['운동복','수건'],
     '[]'::jsonb, '[]'::jsonb),

    (v_partner_id, '[테스트] 캠핑 1박 체험', '하룻밤 숲에서 잠자기',
     '텐트 설치부터 모닥불까지 초보자도 가능한 1박 캠핑.',
     'CAMPING', 24.0, 4, 24, 120000, 100000, '충남', '태안 솔숲 캠핑장',
     NULL, ARRAY['캠핑','1박','장비제공'], 'ALL', true,
     '밤 기온 주의, 침낭 권장.', '가족 / 4인 이상',
     ARRAY['침낭','세면도구','손전등'],
     '[]'::jsonb, '[]'::jsonb),

    (v_partner_id, '[테스트] 자연 예술 워크숍', '숲에서 주운 재료로 만드는 작품',
     NULL, 'ART', 2.0, 5, 20, 40000, 32000, '경기도', '여주 공방',
     NULL, ARRAY['예술','공예','창작'], 'SELECTED', true,
     NULL, '초등 이상',
     ARRAY['앞치마(제공)'],
     '[]'::jsonb, '[]'::jsonb),

    (v_partner_id, '[테스트] 숲속 요가 명상', '새소리와 함께하는 아침 요가',
     NULL, 'FAMILY', 1.0, 3, 12, 25000, 20000, '경기도', '가평 명상숲',
     NULL, ARRAY['요가','명상','아침'], 'ALL', true,
     NULL, '성인',
     ARRAY['요가매트(제공)','편한 복장'],
     '[]'::jsonb, '[]'::jsonb),

    (v_partner_id, '[테스트] 별빛 야행', '랜턴 들고 떠나는 밤 숲 탐험',
     '해가 진 후 보이는 숲의 다른 얼굴을 만나봐요.',
     'FAMILY', 2.5, 4, 20, 45000, 38000, '강원도', '영월 별빛 숲',
     NULL, ARRAY['야간','별','랜턴'], 'SELECTED', true,
     '밤이라 보호자 필수. 어두우니 조심.', '7세 이상 가족',
     ARRAY['랜턴(제공)','따뜻한 옷'],
     '[]'::jsonb, '[]'::jsonb),

    (v_partner_id, '[테스트] 겨울 숲 탐험 (작성 중)', '초안 상태 — 아직 공개 안 됨',
     NULL, 'FOREST', 3.0, 4, 16, 50000, 42000, '강원도', '평창 겨울숲',
     NULL, ARRAY['겨울','초안'], 'DRAFT', false,
     NULL, NULL,
     ARRAY[]::text[],
     '[]'::jsonb, '[]'::jsonb),

    (v_partner_id, '[테스트] 숲 속 보물 찾기 (보관)', '지난 시즌 운영 — 보관됨',
     NULL, 'KIDS', 1.5, 5, 20, 22000, 18000, '경기도', '어딘가',
     NULL, ARRAY['보관','이전'], 'ARCHIVED', false,
     NULL, NULL,
     ARRAY[]::text[],
     '[]'::jsonb, '[]'::jsonb);

  -- 프로그램 중 SELECTED인 것에 대해 기관 할당
  IF to_regclass('public.partner_program_assignments') IS NOT NULL
     AND v_org_ids IS NOT NULL AND array_length(v_org_ids, 1) >= 1 THEN
    FOR v_prog_id IN
      SELECT p.id FROM public.partner_programs p
      WHERE p.partner_id = v_partner_id
        AND p.title LIKE '[테스트]%'
        AND p.visibility = 'SELECTED'
    LOOP
      v_assign_targets := v_org_ids[1:LEAST(array_length(v_org_ids,1),2)];
      INSERT INTO public.partner_program_assignments (program_id, org_id, assigned_by)
        SELECT v_prog_id, org_row, v_partner_id
        FROM UNNEST(v_assign_targets) AS org_row
        ON CONFLICT (program_id, org_id) DO NOTHING;
    END LOOP;
  END IF;

  -- =====================================================
  -- 숲길 10개 삽입 (+ 각 3~4개 지점)
  -- =====================================================

  -- 1. 가벼운 산책길 (EASY / ALL)
  INSERT INTO partner_trails (partner_id, name, description, difficulty, estimated_minutes, distance_km, visibility, status)
    VALUES (v_partner_id, '[테스트] 가벼운 산책길', '30분 미니 코스', 'EASY', 30, 1.2, 'ALL', 'PUBLISHED')
    RETURNING id INTO v_trail_id;
  INSERT INTO partner_trail_stops (trail_id, "order", name, description, qr_code, mission_type, mission_config, reward_points) VALUES
    (v_trail_id, 1, '입구 안내판', '코스 설명판 앞', 'TEST0001', 'CHECKIN', '{}'::jsonb, 10),
    (v_trail_id, 2, '첫 번째 벤치', '쉬어가기 좋은 곳', 'TEST0002', 'PHOTO', '{"minPhotos":1}'::jsonb, 15),
    (v_trail_id, 3, '도착 지점', '작은 정자', 'TEST0003', 'CHECKIN', '{}'::jsonb, 10);

  -- 2. 자연 관찰 코스 (EASY / ALL)
  INSERT INTO partner_trails (partner_id, name, description, difficulty, estimated_minutes, distance_km, visibility, status)
    VALUES (v_partner_id, '[테스트] 자연 관찰 코스', '숲의 생물을 찾아보는 코스', 'EASY', 40, 1.5, 'ALL', 'PUBLISHED')
    RETURNING id INTO v_trail_id;
  INSERT INTO partner_trail_stops (trail_id, "order", name, description, qr_code, mission_type, mission_config, reward_points) VALUES
    (v_trail_id, 1, '곤충 관찰 포인트', '큰 나무 밑', 'TEST0011', 'QUIZ', '{"question":"여기서 볼 수 있는 곤충은?","answer":"개미"}'::jsonb, 15),
    (v_trail_id, 2, '새집 관찰대', '위를 올려다 보세요', 'TEST0012', 'PHOTO', '{"minPhotos":1}'::jsonb, 15),
    (v_trail_id, 3, '식물 도감 포인트', '이름표가 있어요', 'TEST0013', 'QUIZ', '{"question":"이 나무는?","answer":"참나무"}'::jsonb, 20);

  -- 3. 역사 탐방 코스 (MEDIUM / SELECTED)
  INSERT INTO partner_trails (partner_id, name, description, difficulty, estimated_minutes, distance_km, visibility, status)
    VALUES (v_partner_id, '[테스트] 역사 탐방 코스', '옛 사찰과 유적지를 따라', 'MEDIUM', 60, 2.5, 'SELECTED', 'PUBLISHED')
    RETURNING id INTO v_trail_id;
  INSERT INTO partner_trail_stops (trail_id, "order", name, description, qr_code, mission_type, mission_config, reward_points) VALUES
    (v_trail_id, 1, '마을 입구 비석', '큰 돌비석', 'TEST0021', 'CHECKIN', '{}'::jsonb, 10),
    (v_trail_id, 2, '옛 정자', '조선시대 정자', 'TEST0022', 'PHOTO', '{"minPhotos":1}'::jsonb, 20),
    (v_trail_id, 3, '역사 게시판', '안내문을 읽고', 'TEST0023', 'QUIZ', '{"question":"세워진 연도는?","answer":"1800"}'::jsonb, 25),
    (v_trail_id, 4, '종착지 박물관', '마무리 체크인', 'TEST0024', 'CHECKIN', '{}'::jsonb, 15);

  -- 4. 가족 모험 코스 (MEDIUM / ALL)
  INSERT INTO partner_trails (partner_id, name, description, difficulty, estimated_minutes, distance_km, visibility, status)
    VALUES (v_partner_id, '[테스트] 가족 모험 코스', '아이와 함께 도전', 'MEDIUM', 90, 3.0, 'ALL', 'PUBLISHED')
    RETURNING id INTO v_trail_id;
  INSERT INTO partner_trail_stops (trail_id, "order", name, description, qr_code, mission_type, mission_config, reward_points) VALUES
    (v_trail_id, 1, '출발 지점', '지도 앞', 'TEST0031', 'CHECKIN', '{}'::jsonb, 10),
    (v_trail_id, 2, '작은 개울', '물소리 듣기', 'TEST0032', 'PHOTO', '{"minPhotos":1}'::jsonb, 20),
    (v_trail_id, 3, '큰 바위', '기념 사진', 'TEST0033', 'PHOTO', '{"minPhotos":1}'::jsonb, 20),
    (v_trail_id, 4, '정상 전망대', '탁 트인 풍경', 'TEST0034', 'LOCATION', '{"radiusMeters":30}'::jsonb, 30);

  -- 5. 숲 체험 종합 코스 (EASY / SELECTED)
  INSERT INTO partner_trails (partner_id, name, description, difficulty, estimated_minutes, distance_km, visibility, status)
    VALUES (v_partner_id, '[테스트] 숲 체험 종합 코스', '숲 전체 체험 올인원', 'EASY', 50, 1.8, 'SELECTED', 'PUBLISHED')
    RETURNING id INTO v_trail_id;
  INSERT INTO partner_trail_stops (trail_id, "order", name, description, qr_code, mission_type, mission_config, reward_points) VALUES
    (v_trail_id, 1, '오감 체험장', '만지고 냄새 맡기', 'TEST0041', 'PHOTO', '{"minPhotos":1}'::jsonb, 15),
    (v_trail_id, 2, '퀴즈 존', '숲 상식 퀴즈', 'TEST0042', 'QUIZ', '{"question":"가장 큰 나무는?","answer":"참나무"}'::jsonb, 20),
    (v_trail_id, 3, '체크 포인트', '간단 체크인', 'TEST0043', 'CHECKIN', '{}'::jsonb, 10);

  -- 6. 야생화 코스 (EASY / ALL)
  INSERT INTO partner_trails (partner_id, name, description, difficulty, estimated_minutes, distance_km, visibility, status)
    VALUES (v_partner_id, '[테스트] 야생화 코스', '계절 꽃을 따라 걷는 길', 'EASY', 40, 1.4, 'ALL', 'PUBLISHED')
    RETURNING id INTO v_trail_id;
  INSERT INTO partner_trail_stops (trail_id, "order", name, description, qr_code, mission_type, mission_config, reward_points) VALUES
    (v_trail_id, 1, '진달래 군락', '봄 명소', 'TEST0051', 'PHOTO', '{"minPhotos":1}'::jsonb, 15),
    (v_trail_id, 2, '들국화 포인트', '가을 포인트', 'TEST0052', 'PHOTO', '{"minPhotos":1}'::jsonb, 15),
    (v_trail_id, 3, '마지막 꽃길', '종점', 'TEST0053', 'CHECKIN', '{}'::jsonb, 10);

  -- 7. 전망대 코스 (HARD / ALL)
  INSERT INTO partner_trails (partner_id, name, description, difficulty, estimated_minutes, distance_km, visibility, status)
    VALUES (v_partner_id, '[테스트] 전망대 코스', '정상에서 바라보는 풍경', 'HARD', 120, 5.0, 'ALL', 'PUBLISHED')
    RETURNING id INTO v_trail_id;
  INSERT INTO partner_trail_stops (trail_id, "order", name, description, qr_code, mission_type, mission_config, reward_points) VALUES
    (v_trail_id, 1, '등산 시작', '체조 후 출발', 'TEST0061', 'CHECKIN', '{}'::jsonb, 15),
    (v_trail_id, 2, '중간 쉼터', '물 한 모금', 'TEST0062', 'PHOTO', '{"minPhotos":1}'::jsonb, 20),
    (v_trail_id, 3, '정상 전망대', '파노라마', 'TEST0063', 'LOCATION', '{"radiusMeters":50}'::jsonb, 40),
    (v_trail_id, 4, '하산 완료', '출발지 복귀', 'TEST0064', 'CHECKIN', '{}'::jsonb, 25);

  -- 8. 계곡 코스 (MEDIUM / SELECTED)
  INSERT INTO partner_trails (partner_id, name, description, difficulty, estimated_minutes, distance_km, visibility, status)
    VALUES (v_partner_id, '[테스트] 계곡 코스', '시원한 물소리와 함께', 'MEDIUM', 80, 2.8, 'SELECTED', 'PUBLISHED')
    RETURNING id INTO v_trail_id;
  INSERT INTO partner_trail_stops (trail_id, "order", name, description, qr_code, mission_type, mission_config, reward_points) VALUES
    (v_trail_id, 1, '계곡 초입', '물이 시작되는 곳', 'TEST0071', 'PHOTO', '{"minPhotos":1}'::jsonb, 15),
    (v_trail_id, 2, '무지개 폭포', '가장 아름다운 포인트', 'TEST0072', 'PHOTO', '{"minPhotos":2}'::jsonb, 25),
    (v_trail_id, 3, '계곡 끝', '종점 체크인', 'TEST0073', 'CHECKIN', '{}'::jsonb, 15);

  -- 9. 미공개 코스 (DRAFT)
  INSERT INTO partner_trails (partner_id, name, description, difficulty, estimated_minutes, distance_km, visibility, status)
    VALUES (v_partner_id, '[테스트] 미공개 코스 (초안)', '아직 작성 중', 'EASY', 30, 1.0, 'DRAFT', 'DRAFT')
    RETURNING id INTO v_trail_id;
  INSERT INTO partner_trail_stops (trail_id, "order", name, description, qr_code, mission_type, mission_config, reward_points) VALUES
    (v_trail_id, 1, '초안 지점 1', '임시', 'TEST0081', 'CHECKIN', '{}'::jsonb, 10),
    (v_trail_id, 2, '초안 지점 2', '임시', 'TEST0082', 'CHECKIN', '{}'::jsonb, 10);

  -- 10. 보관 코스 (ARCHIVED)
  INSERT INTO partner_trails (partner_id, name, description, difficulty, estimated_minutes, distance_km, visibility, status)
    VALUES (v_partner_id, '[테스트] 보관 코스', '지난 시즌 — 보관됨', 'EASY', 20, 0.8, 'ARCHIVED', 'ARCHIVED')
    RETURNING id INTO v_trail_id;
  INSERT INTO partner_trail_stops (trail_id, "order", name, description, qr_code, mission_type, mission_config, reward_points) VALUES
    (v_trail_id, 1, '보관 지점', '이전 운영 기록', 'TEST0091', 'CHECKIN', '{}'::jsonb, 10);

  -- 숲길 SELECTED 할당
  IF to_regclass('public.partner_trail_assignments') IS NOT NULL
     AND v_org_ids IS NOT NULL AND array_length(v_org_ids, 1) >= 1 THEN
    FOR v_trail_id IN
      SELECT t.id FROM public.partner_trails t
      WHERE t.partner_id = v_partner_id
        AND t.name LIKE '[테스트]%'
        AND t.visibility = 'SELECTED'
    LOOP
      v_assign_targets := v_org_ids[1:LEAST(array_length(v_org_ids,1),2)];
      INSERT INTO public.partner_trail_assignments (trail_id, org_id, assigned_by)
        SELECT v_trail_id, org_row, v_partner_id
        FROM UNNEST(v_assign_targets) AS org_row
        ON CONFLICT (trail_id, org_id) DO NOTHING;
    END LOOP;
  END IF;

  RAISE NOTICE '✅ 시드 완료: partner=%, 프로그램 10개, 숲길 10개', v_partner_id;
  IF v_org_ids IS NOT NULL THEN
    RAISE NOTICE '기관 할당 대상: %', v_org_ids;
  ELSE
    RAISE NOTICE '기관 없음 — SELECTED 항목은 할당되지 않음';
  END IF;
END $$;

-- =====================================================
-- 확인용 쿼리
-- =====================================================
SELECT 'programs' AS kind, COUNT(*) AS count, visibility
  FROM partner_programs WHERE title LIKE '[테스트]%' GROUP BY visibility
UNION ALL
SELECT 'trails' AS kind, COUNT(*) AS count, visibility
  FROM partner_trails WHERE name LIKE '[테스트]%' GROUP BY visibility
ORDER BY kind, visibility;
