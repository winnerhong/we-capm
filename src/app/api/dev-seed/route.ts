import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// DEV 전용 - 테스트 데이터 시드
export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available" }, { status: 403 });
  }

  const supabase = await createClient();
  const log: string[] = [];

  // 테스트 행사 ID
  const EVENT_ID = "aca98cdb-e727-4feb-a537-3b48375a5438";

  // 1. 행사 정보 확인
  const { data: event } = await supabase.from("events").select("id, name").eq("id", EVENT_ID).single();
  if (!event) return NextResponse.json({ error: "테스트 행사 없음" }, { status: 404 });
  log.push(`✅ 행사: ${event.name}`);

  // 2. 등록명단 (학급별 가족 20명)
  const registrations = [
    // 해바라기반
    { name: "[해바라기반] 김민준", phone: "010-1111-0001" },
    { name: "[해바라기반] 이서윤", phone: "010-1111-0002" },
    { name: "[해바라기반] 박하준", phone: "010-1111-0003" },
    { name: "[해바라기반] 최수아", phone: "010-1111-0004" },
    { name: "[해바라기반] 정도윤", phone: "010-1111-0005" },
    // 장미반
    { name: "[장미반] 강지호", phone: "010-2222-0001" },
    { name: "[장미반] 윤하은", phone: "010-2222-0002" },
    { name: "[장미반] 임시우", phone: "010-2222-0003" },
    { name: "[장미반] 한소율", phone: "010-2222-0004" },
    { name: "[장미반] 오예준", phone: "010-2222-0005" },
    // 코스모스반
    { name: "[코스모스반] 서은우", phone: "010-3333-0001" },
    { name: "[코스모스반] 조아린", phone: "010-3333-0002" },
    { name: "[코스모스반] 황태현", phone: "010-3333-0003" },
    { name: "[코스모스반] 배서연", phone: "010-3333-0004" },
    { name: "[코스모스반] 노현서", phone: "010-3333-0005" },
    // 선생님
    { name: "[선생님] 김영희", phone: "010-9999-0001" },
    { name: "[선생님] 박철수", phone: "010-9999-0002" },
    { name: "[선생님] 이미영", phone: "010-9999-0003" },
  ];

  // 기존 등록명단 삭제 후 재입력
  await supabase.from("event_registrations").delete().eq("event_id", EVENT_ID);
  const { error: regErr } = await supabase.from("event_registrations").insert(
    registrations.map((r) => ({ event_id: EVENT_ID, phone: r.phone, name: r.name, status: "REGISTERED" }))
  );
  log.push(regErr ? `❌ 등록명단: ${regErr.message}` : `✅ 등록명단: ${registrations.length}명`);

  // 3. 참가자 (입장한 사람 12명)
  await supabase.from("reward_claims").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await supabase.from("submissions").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await supabase.from("participants").delete().eq("event_id", EVENT_ID);

  const enteredPhones = registrations.slice(0, 12); // 첫 12명 입장
  const participantInserts = enteredPhones.map((r) => ({
    event_id: EVENT_ID,
    phone: r.phone,
    participation_type: "INDIVIDUAL" as const,
    total_score: 0,
  }));
  const { data: participants, error: pErr } = await supabase
    .from("participants")
    .insert(participantInserts)
    .select("id, phone");
  log.push(pErr ? `❌ 참가자: ${pErr.message}` : `✅ 참가자: ${participants?.length}명 입장`);

  // 입장 상태 업데이트
  for (const p of enteredPhones) {
    await supabase.from("event_registrations")
      .update({ status: "ENTERED", entered_at: new Date().toISOString() })
      .eq("event_id", EVENT_ID).eq("phone", p.phone);
  }

  // 4. 미션 (5개)
  await supabase.from("missions").delete().eq("event_id", EVENT_ID);
  const missions = [
    { title: "가족 사진 찍기", description: "가족 모두가 함께 찍은 사진을 올려주세요!", template_type: "PHOTO" as const, points: 10, order: 1, auto_approve: false, instruction: "자연 배경에서 찍어주세요", config: {} },
    { title: "보물찾기", description: "캠핑장에 숨겨진 보물 3개를 찾아보세요!", template_type: "PHOTO" as const, points: 20, order: 2, auto_approve: false, instruction: "보물을 찾은 모습을 사진으로!", config: {} },
    { title: "자연물 만들기", description: "주변의 자연물로 작품을 만들어보세요", template_type: "PHOTO" as const, points: 15, order: 3, auto_approve: false, instruction: "나뭇잎, 돌, 꽃 등을 활용", config: {} },
    { title: "캠프 요리 도전", description: "간식이나 요리를 만들어보세요!", template_type: "PHOTO" as const, points: 25, order: 4, auto_approve: false, instruction: "만드는 과정과 완성작 모두 찍어주세요", config: {} },
    { title: "OX 퀴즈", description: "자연에 대한 퀴즈를 풀어보세요!", template_type: "QUIZ" as const, points: 5, order: 5, auto_approve: true, instruction: "", config: { quiz_question: "소나무는 활엽수이다?", quiz_answer: "X" } },
  ];
  const { data: missionRows, error: mErr } = await supabase
    .from("missions")
    .insert(missions.map((m) => ({ ...m, event_id: EVENT_ID, is_active: true })))
    .select("id, title, points");
  log.push(mErr ? `❌ 미션: ${mErr.message}` : `✅ 미션: ${missionRows?.length}개`);

  // 5. 제출물 + 점수 (일부 참가자)
  if (participants && missionRows) {
    const phoneToId = new Map(participants.map((p) => [p.phone, p.id]));
    const scoreByParticipant = new Map<string, number>();

    // 참가자별 제출 (다양한 상태)
    const submissionData = [
      // 김민준: 미션1,2 완료 (30점)
      { phone: "010-1111-0001", missionIdx: 0, status: "APPROVED" },
      { phone: "010-1111-0001", missionIdx: 1, status: "APPROVED" },
      // 이서윤: 미션1,2,3 완료 (45점)
      { phone: "010-1111-0002", missionIdx: 0, status: "APPROVED" },
      { phone: "010-1111-0002", missionIdx: 1, status: "APPROVED" },
      { phone: "010-1111-0002", missionIdx: 2, status: "APPROVED" },
      // 박하준: 미션1,2,3,4 완료 (70점) - 1등
      { phone: "010-1111-0003", missionIdx: 0, status: "APPROVED" },
      { phone: "010-1111-0003", missionIdx: 1, status: "APPROVED" },
      { phone: "010-1111-0003", missionIdx: 2, status: "APPROVED" },
      { phone: "010-1111-0003", missionIdx: 3, status: "APPROVED" },
      // 최수아: 미션1 완료, 미션2 대기 (10점 + pending)
      { phone: "010-1111-0004", missionIdx: 0, status: "APPROVED" },
      { phone: "010-1111-0004", missionIdx: 1, status: "PENDING" },
      // 강지호: 미션1,2,3 완료 (45점)
      { phone: "010-2222-0001", missionIdx: 0, status: "APPROVED" },
      { phone: "010-2222-0001", missionIdx: 1, status: "APPROVED" },
      { phone: "010-2222-0001", missionIdx: 2, status: "APPROVED" },
      // 윤하은: 미션1 대기
      { phone: "010-2222-0002", missionIdx: 0, status: "PENDING" },
      // 임시우: 미션1,2 완료, 미션3 반려
      { phone: "010-2222-0003", missionIdx: 0, status: "APPROVED" },
      { phone: "010-2222-0003", missionIdx: 1, status: "APPROVED" },
      { phone: "010-2222-0003", missionIdx: 2, status: "REJECTED" },
      // 서은우: 미션1,2,4 완료 (55점)
      { phone: "010-3333-0001", missionIdx: 0, status: "APPROVED" },
      { phone: "010-3333-0001", missionIdx: 1, status: "APPROVED" },
      { phone: "010-3333-0001", missionIdx: 3, status: "APPROVED" },
    ];

    for (const s of submissionData) {
      const participantId = phoneToId.get(s.phone);
      const mission = missionRows[s.missionIdx];
      if (!participantId || !mission) continue;

      await supabase.from("submissions").insert({
        mission_id: mission.id,
        participant_id: participantId,
        status: s.status as "APPROVED" | "PENDING" | "REJECTED",
        text_content: s.status === "REJECTED" ? "반려 사유: 사진이 흐려요" : "테스트 제출입니다",
      });

      if (s.status === "APPROVED") {
        const prev = scoreByParticipant.get(participantId) ?? 0;
        scoreByParticipant.set(participantId, prev + mission.points);
      }
    }

    // 점수 업데이트
    for (const [pid, score] of scoreByParticipant) {
      await supabase.from("participants").update({ total_score: score }).eq("id", pid);
    }

    log.push(`✅ 제출물: ${submissionData.length}개 (PENDING ${submissionData.filter((s) => s.status === "PENDING").length}건)`);
  }

  // 6. 보상 (5종류)
  await supabase.from("rewards").delete().eq("event_id", EVENT_ID);
  const rewardInserts = [
    { event_id: EVENT_ID, name: "음료 쿠폰", description: "시원한 음료 1잔", reward_type: "POINT" as const, config: { threshold: 30 }, quantity: 10 },
    { event_id: EVENT_ID, name: "간식 세트", description: "맛있는 간식 세트", reward_type: "POINT" as const, config: { threshold: 50 }, quantity: 5 },
    { event_id: EVENT_ID, name: "금메달", description: "1~3등 금메달", reward_type: "RANK" as const, config: { rankFrom: 1, rankTo: 3 } },
    { event_id: EVENT_ID, name: "행운 상품권", description: "추첨으로 2명에게!", reward_type: "LOTTERY" as const, config: { minScore: 10, winners: 2 } },
    ...(missionRows ? [{ event_id: EVENT_ID, name: "요리왕 뱃지", description: "캠프 요리 미션 완료!", reward_type: "BADGE" as const, config: { missionId: missionRows[3]?.id } }] : []),
  ];
  const { data: rewards, error: rwErr } = await supabase.from("rewards").insert(rewardInserts).select("id, name, reward_type, config");
  log.push(rwErr ? `❌ 보상: ${rwErr.message}` : `✅ 보상: ${rewards?.length}개`);

  // 보상 자동 지급 (점수 기반)
  if (rewards && participants) {
    const phoneToId = new Map(participants.map((p) => [p.phone, p.id]));
    const pointRewards = rewards.filter((r) => r.reward_type === "POINT");

    const scoreMap: Record<string, number> = {
      "010-1111-0001": 30, "010-1111-0002": 45, "010-1111-0003": 70,
      "010-1111-0004": 10, "010-2222-0001": 45, "010-2222-0003": 30,
      "010-3333-0001": 55,
    };

    let claimCount = 0;
    for (const [phone, score] of Object.entries(scoreMap)) {
      const pid = phoneToId.get(phone);
      if (!pid) continue;
      for (const reward of pointRewards) {
        const threshold = (reward.config as { threshold: number }).threshold;
        if (score >= threshold) {
          await supabase.from("reward_claims").insert({
            reward_id: reward.id, participant_id: pid, status: "EARNED",
          });
          claimCount++;
        }
      }
    }
    log.push(`✅ 보상 지급: ${claimCount}건 (EARNED 상태)`);
  }

  // 7. 채팅방 + 메시지
  await supabase.from("chat_rooms").delete().eq("event_id", EVENT_ID);

  const { data: chatRooms } = await supabase.from("chat_rooms").insert([
    { event_id: EVENT_ID, type: "ANNOUNCEMENT", name: "📢 전체 공지" },
    { event_id: EVENT_ID, type: "GROUP", name: "💬 전체 단톡방" },
    { event_id: EVENT_ID, type: "GROUP", name: "💬 해바라기반" },
    { event_id: EVENT_ID, type: "GROUP", name: "💬 장미반" },
    { event_id: EVENT_ID, type: "GROUP", name: "💬 코스모스반" },
  ]).select("id, name, type");
  log.push(`✅ 채팅방: ${chatRooms?.length}개`);

  if (chatRooms && participants) {
    const groupRoom = chatRooms.find((r) => r.name === "💬 전체 단톡방");
    const annoRoom = chatRooms.find((r) => r.type === "ANNOUNCEMENT");
    const classRooms = new Map(chatRooms.filter((r) => r.name?.startsWith("💬 ") && r.name !== "💬 전체 단톡방").map((r) => [r.name?.replace("💬 ", ""), r.id]));

    // 멤버 추가
    for (const p of enteredPhones) {
      const reg = registrations.find((r) => r.phone === p.phone);
      if (!reg) continue;
      const displayName = reg.name.replace(/^\[.+?\]\s*/, "") + (reg.name.includes("선생님") ? "" : " 가족");
      const classMatch = reg.name.match(/^\[(.+?)\]/);
      const className = classMatch ? classMatch[1] : null;

      // 전체방 + 공지방
      if (groupRoom) await supabase.from("chat_members").insert({ room_id: groupRoom.id, participant_name: displayName, participant_phone: p.phone });
      if (annoRoom) await supabase.from("chat_members").insert({ room_id: annoRoom.id, participant_name: displayName, participant_phone: p.phone });

      // 학급방
      if (className && classRooms.has(className)) {
        await supabase.from("chat_members").insert({ room_id: classRooms.get(className)!, participant_name: displayName, participant_phone: p.phone });
      }
    }

    // 기관 멤버
    for (const room of chatRooms) {
      await supabase.from("chat_members").insert({ room_id: room.id, participant_name: "[기관] 관리자", role: "ADMIN" });
    }

    // 채팅 메시지
    if (groupRoom) {
      const msgs = [
        { sender_name: "시스템", type: "SYSTEM", content: "김민준 가족님이 입장했습니다" },
        { sender_name: "시스템", type: "SYSTEM", content: "이서윤 가족님이 입장했습니다" },
        { sender_name: "[기관] 관리자", type: "ANNOUNCEMENT", content: "안녕하세요! 오늘 행사에 오신 것을 환영합니다 🎉 미션 열심히 해주세요!" },
        { sender_name: "김민준 가족", type: "TEXT", content: "안녕하세요~ 날씨가 너무 좋네요!" },
        { sender_name: "이서윤 가족", type: "TEXT", content: "반갑습니다! 아이가 정말 좋아해요 ㅎㅎ" },
        { sender_name: "박하준 가족", type: "TEXT", content: "보물찾기 미션 재밌어요!!" },
        { sender_name: "[기관] 관리자", type: "TEXT", content: "열심히 참여해주셔서 감사합니다!" },
        { sender_name: "강지호 가족", type: "TEXT", content: "요리 미션 어려운데 재밌네요 ㅋㅋ" },
        { sender_name: "시스템", type: "SYSTEM", content: "🎉 박하준 가족님이 [음료 쿠폰] 보상을 획득했습니다!" },
        { sender_name: "최수아 가족", type: "TEXT", content: "우와 축하해요!!" },
      ];
      for (let i = 0; i < msgs.length; i++) {
        const ts = new Date(Date.now() - (msgs.length - i) * 120000).toISOString();
        await supabase.from("chat_messages").insert({ room_id: groupRoom.id, ...msgs[i], created_at: ts });
      }
    }

    // 공지방 메시지
    if (annoRoom) {
      await supabase.from("chat_messages").insert([
        { room_id: annoRoom.id, sender_name: "시스템", type: "ANNOUNCEMENT", content: "🏕️ 행사가 시작되었습니다! 미션을 확인해주세요." },
        { room_id: annoRoom.id, sender_name: "시스템", type: "ANNOUNCEMENT", content: "📸 가족 사진 찍기 미션이 인기가 많아요! 아직 안하신 분들은 도전해보세요!" },
      ]);
    }

    log.push("✅ 채팅 메시지 삽입 완료");
  }

  // ================================
  // Phase C: 파트너/챌린지/쿠폰/길드/광고
  // ================================

  // 8. Partners (3 samples)
  try {
    await (supabase.from("partners" as never) as unknown as { delete: () => { neq: (k: string, v: string) => Promise<unknown> } })
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000");
    const partnerInserts = [
      { name: "숲속친구 체험원", business_name: "(주)숲속친구", username: "partner_test1", password: "1234", email: "test1@toriro.com", phone: "010-5555-1111", tier: "TREE", commission_rate: 15, acorn_balance: 500000, total_sales: 12000000, total_events: 45, avg_rating: 4.7, status: "ACTIVE" },
      { name: "자연놀이터", business_name: "(주)자연놀이터", username: "partner_test2", password: "1234", email: "test2@toriro.com", phone: "010-5555-2222", tier: "EXPLORER", commission_rate: 18, acorn_balance: 150000, total_sales: 3500000, total_events: 12, avg_rating: 4.3, status: "ACTIVE" },
      { name: "도토리 농장", business_name: "도토리농장협동조합", username: "partner_test3", password: "1234", email: "test3@toriro.com", phone: "010-5555-3333", tier: "SPROUT", commission_rate: 20, acorn_balance: 30000, total_sales: 800000, total_events: 3, avg_rating: null, status: "PENDING" },
    ];
    const { error: prErr } = await (supabase.from("partners" as never) as unknown as { insert: (d: unknown) => Promise<{ error: unknown }> }).insert(partnerInserts);
    log.push(prErr ? `❌ 파트너: 테이블 없음` : `✅ 파트너: ${partnerInserts.length}개`);
  } catch {
    log.push(`❌ 파트너: 테이블 없음`);
  }

  // 9. Challenges (2 samples)
  try {
    await (supabase.from("challenges" as never) as unknown as { delete: () => { eq: (k: string, v: string) => Promise<unknown> } })
      .delete()
      .eq("event_id", EVENT_ID);
    const challengeInserts = [
      { event_id: EVENT_ID, title: "이번주 숲길 챌린지", description: "3개의 숲길을 완주해보세요", icon: "🎯", goal_type: "MISSION_COUNT", goal_value: 3, reward_acorns: 10, starts_at: new Date().toISOString(), ends_at: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(), status: "ACTIVE" },
      { event_id: EVENT_ID, title: "도토리 수집가", description: "도토리 50개를 모으세요", icon: "🌰", goal_type: "ACORN_COUNT", goal_value: 50, reward_acorns: 20, starts_at: new Date().toISOString(), ends_at: new Date(Date.now() + 14 * 24 * 3600 * 1000).toISOString(), status: "ACTIVE" },
    ];
    const { error: chErr } = await (supabase.from("challenges" as never) as unknown as { insert: (d: unknown) => Promise<{ error: unknown }> }).insert(challengeInserts);
    log.push(chErr ? `❌ 챌린지: 테이블 없음` : `✅ 챌린지: ${challengeInserts.length}개`);
  } catch {
    log.push(`❌ 챌린지: 테이블 없음`);
  }

  // 10. Coupons (3 samples) + Coupon Deliveries
  try {
    await (supabase.from("coupons" as never) as unknown as { delete: () => { neq: (k: string, v: string) => Promise<unknown> } })
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000");
    const couponInserts = [
      { affiliate_name: "숲속 카페", title: "아메리카노 30% 할인", description: "따뜻한 음료 한잔", discount_type: "PERCENT", discount_value: 30, category: "CAFE", send_delay_minutes: 30, valid_from: new Date().toISOString(), valid_until: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(), max_uses: 100, status: "ACTIVE" },
      { affiliate_name: "도토리 피자", title: "피자 1판 무료 사이드", description: "치즈 스틱 증정", discount_type: "FREE", category: "FOOD", send_delay_minutes: 30, valid_from: new Date().toISOString(), valid_until: new Date(Date.now() + 14 * 24 * 3600 * 1000).toISOString(), status: "ACTIVE" },
      { affiliate_name: "자연 체험관", title: "다음 체험 5,000원 할인", description: "전 체험 프로그램", discount_type: "AMOUNT", discount_value: 5000, category: "ACTIVITY", send_delay_minutes: 120, valid_from: new Date().toISOString(), valid_until: new Date(Date.now() + 60 * 24 * 3600 * 1000).toISOString(), status: "ACTIVE" },
    ];
    const { error: cpErr } = await (supabase.from("coupons" as never) as unknown as { insert: (d: unknown) => Promise<{ error: unknown }> }).insert(couponInserts);
    if (cpErr) {
      log.push(`❌ 쿠폰: 테이블 없음`);
    } else {
      log.push(`✅ 쿠폰: ${couponInserts.length}개`);

      // Coupon deliveries
      try {
        const { data: couponsData } = await (supabase.from("coupons" as never) as unknown as { select: (c: string) => Promise<{ data: Array<{ id: string }> | null }> }).select("id");
        if (participants && couponsData && couponsData.length > 0) {
          const firstThree = participants.slice(0, 3);
          const deliveries: Array<{ coupon_id: string; participant_phone: string; event_id: string }> = [];
          for (const p of firstThree) {
            if (!p.phone) continue;
            for (const c of couponsData) {
              deliveries.push({ coupon_id: c.id, participant_phone: p.phone, event_id: EVENT_ID });
            }
          }
          const { error: cdErr } = await (supabase.from("coupon_deliveries" as never) as unknown as { insert: (d: unknown) => Promise<{ error: unknown }> }).insert(deliveries);
          log.push(cdErr ? `❌ 쿠폰 발송: 테이블 없음` : `✅ 쿠폰 발송: ${deliveries.length}건`);
        }
      } catch {
        log.push(`❌ 쿠폰 발송: 테이블 없음`);
      }
    }
  } catch {
    log.push(`❌ 쿠폰: 테이블 없음`);
  }

  // 11. Guilds (2 samples) + Guild Members
  try {
    await (supabase.from("guilds" as never) as unknown as { delete: () => { eq: (k: string, v: string) => Promise<unknown> } })
      .delete()
      .eq("event_id", EVENT_ID);
    const guildInserts = [
      { event_id: EVENT_ID, name: "해바라기 패밀리", description: "해바라기반 친구들", icon: "🌻", leader_phone: "010-1111-0001", max_members: 10, total_acorns: 200, is_public: true },
      { event_id: EVENT_ID, name: "도토리 탐험대", description: "탐험을 좋아하는 가족들", icon: "🐿️", leader_phone: "010-2222-0001", max_members: 8, total_acorns: 120, is_public: true },
    ];
    const { error: gErr } = await (supabase.from("guilds" as never) as unknown as { insert: (d: unknown) => Promise<{ error: unknown }> }).insert(guildInserts);
    if (gErr) {
      log.push(`❌ 길드: 테이블 없음`);
    } else {
      log.push(`✅ 길드: ${guildInserts.length}개`);

      // Guild members
      try {
        const { data: guildsData } = await (supabase.from("guilds" as never) as unknown as { select: (c: string) => { eq: (k: string, v: string) => Promise<{ data: Array<{ id: string; name: string }> | null }> } }).select("id, name").eq("event_id", EVENT_ID);
        if (guildsData && guildsData.length >= 2) {
          const sunflower = guildsData.find((g) => g.name === "해바라기 패밀리");
          const acorn = guildsData.find((g) => g.name === "도토리 탐험대");
          const memberInserts: Array<{ guild_id: string; participant_phone: string; role: string }> = [];
          if (sunflower) {
            memberInserts.push({ guild_id: sunflower.id, participant_phone: "010-1111-0001", role: "LEADER" });
            memberInserts.push({ guild_id: sunflower.id, participant_phone: "010-1111-0002", role: "MEMBER" });
            memberInserts.push({ guild_id: sunflower.id, participant_phone: "010-1111-0003", role: "MEMBER" });
          }
          if (acorn) {
            memberInserts.push({ guild_id: acorn.id, participant_phone: "010-2222-0001", role: "LEADER" });
            memberInserts.push({ guild_id: acorn.id, participant_phone: "010-2222-0002", role: "MEMBER" });
          }
          const { error: gmErr } = await (supabase.from("guild_members" as never) as unknown as { insert: (d: unknown) => Promise<{ error: unknown }> }).insert(memberInserts);
          log.push(gmErr ? `❌ 길드 멤버: 테이블 없음` : `✅ 길드 멤버: ${memberInserts.length}명`);
        }
      } catch {
        log.push(`❌ 길드 멤버: 테이블 없음`);
      }
    }
  } catch {
    log.push(`❌ 길드: 테이블 없음`);
  }

  // 12. Ad Campaigns (2 samples, DRAFT/PENDING)
  try {
    await (supabase.from("ad_campaigns" as never) as unknown as { delete: () => { neq: (k: string, v: string) => Promise<unknown> } })
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000");
    const adInserts = [
      { advertiser_name: "토리로 플랫폼 자체", title: "봄맞이 숲길 이벤트 광고", target_portal: "FAMILY", placement: "BANNER", budget: 500000, status: "DRAFT" },
      { advertiser_name: "캠핑용품 브랜드", title: "텐트 특가", target_portal: "PARTNER", placement: "CARD", budget: 1000000, status: "PENDING" },
    ];
    const { error: adErr } = await (supabase.from("ad_campaigns" as never) as unknown as { insert: (d: unknown) => Promise<{ error: unknown }> }).insert(adInserts);
    log.push(adErr ? `❌ 광고: 테이블 없음` : `✅ 광고: ${adInserts.length}개`);
  } catch {
    log.push(`❌ 광고: 테이블 없음`);
  }

  // dev-login용 테스트 참가자 쿠키 데이터도 업데이트
  const testParticipant = participants?.find((p) => p.phone === "010-1111-0001");

  return NextResponse.json({
    success: true,
    eventId: EVENT_ID,
    testParticipantPhone: "010-1111-0001",
    testParticipantId: testParticipant?.id,
    log,
  }, { status: 200 });
}
