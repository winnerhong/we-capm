/**
 * ESG(Environmental, Social, Governance) 임팩트 계산 라이브러리
 *
 * 토리로 플랫폼의 이벤트 데이터를 기반으로 ESG 점수를 산출합니다.
 * - Environmental: CO2 절감, 가상 나무 심기, 친환경 활동 시간
 * - Social: 연결된 가족 수, 참여 어린이, 협력 기관, 평균 만족도
 * - Governance: 투명성 점수, 지역 상공인 연계, 파트너 프로그램 수
 *
 * MVP 계수 (휴리스틱):
 * - 1 참가자 = 0.5kg CO2 절감 (실내 활동 대비 숲 체험)
 * - 10 도토리 = 1 가상 나무
 * - 참가자 1인당 평균 2시간 친환경 활동으로 가정
 */

export interface ESGImpact {
  environmental: {
    co2Saved: number; // kg CO2 추정
    treesPlanted: number; // 도토리 기반 가상 나무 수
    greenActivitiesHours: number;
  };
  social: {
    familiesConnected: number;
    childrenParticipated: number;
    schoolsSupported: number;
    averageRating: number;
  };
  governance: {
    transparencyScore: number; // 0-100
    localBusinessesEngaged: number; // 제휴 쿠폰/파트너 수
    partnerPrograms: number;
  };
  totalScore: number; // 전체 0-100
}

// Phase C 테이블(타입 미정의) 접근용 헬퍼 타입
type AnySupabase = {
  from: (table: string) => {
    select: (cols: string, opts?: { count?: "exact"; head?: boolean }) => {
      eq: (col: string, val: unknown) => {
        gte: (col: string, val: unknown) => {
          lte: (col: string, val: unknown) => Promise<{ data: unknown; count: number | null; error: unknown }>;
        } & Promise<{ data: unknown; count: number | null; error: unknown }>;
        lte: (col: string, val: unknown) => Promise<{ data: unknown; count: number | null; error: unknown }>;
      } & Promise<{ data: unknown; count: number | null; error: unknown }>;
      gte: (col: string, val: unknown) => {
        lte: (col: string, val: unknown) => Promise<{ data: unknown; count: number | null; error: unknown }>;
      } & Promise<{ data: unknown; count: number | null; error: unknown }>;
      lte: (col: string, val: unknown) => Promise<{ data: unknown; count: number | null; error: unknown }>;
    } & Promise<{ data: unknown; count: number | null; error: unknown }>;
  };
};

/**
 * 쿼리 안전 실행 — 테이블이 없거나 실패해도 0을 반환
 */
async function safeCount(
  supabase: AnySupabase,
  table: string,
  filter?: { col: string; val: unknown }
): Promise<number> {
  try {
    let q = supabase.from(table).select("*", { count: "exact", head: true });
    if (filter) {
      q = (q.eq(filter.col, filter.val) as never) as typeof q;
    }
    const res = await q;
    return res.count ?? 0;
  } catch {
    return 0;
  }
}

async function safeRows<T>(
  supabase: AnySupabase,
  table: string,
  cols: string,
  filter?: { col: string; val: unknown }
): Promise<T[]> {
  try {
    let q = supabase.from(table).select(cols);
    if (filter) {
      q = (q.eq(filter.col, filter.val) as never) as typeof q;
    }
    const res = await q;
    return (res.data as T[] | null) ?? [];
  } catch {
    return [];
  }
}

export async function calculateESGImpact(
  supabase: unknown,
  params: { eventId?: string; partnerId?: string; startDate?: string; endDate?: string } = {}
): Promise<ESGImpact> {
  const sb = supabase as AnySupabase;
  const { eventId } = params;

  // ─────────────────────────────
  // Environmental
  // ─────────────────────────────
  const participantCount = eventId
    ? await safeCount(sb, "participants", { col: "event_id", val: eventId })
    : await safeCount(sb, "participants");

  const scoreRows = await safeRows<{ total_score: number | null; event_id?: string }>(
    sb,
    "participants",
    eventId ? "total_score, event_id" : "total_score",
    eventId ? { col: "event_id", val: eventId } : undefined
  );
  const totalAcorns = scoreRows.reduce((sum, r) => sum + (r.total_score ?? 0), 0);

  const co2Saved = Math.round(participantCount * 0.5 * 10) / 10; // 소수 1자리
  const treesPlanted = Math.floor(totalAcorns / 10);
  const greenActivitiesHours = participantCount * 2;

  // ─────────────────────────────
  // Social
  // ─────────────────────────────
  const regRows = await safeRows<{ name: string; event_id?: string }>(
    sb,
    "event_registrations",
    eventId ? "name, event_id" : "name",
    eventId ? { col: "event_id", val: eventId } : undefined
  );
  const familiesConnected = regRows.filter((r) => !r.name?.includes("선생님")).length;
  // 가족당 평균 2명의 어린이로 가정 (보수적)
  const childrenParticipated = Math.round(familiesConnected * 1.8);

  // 학교 지원: SCHOOL 타입 이벤트 수 또는 "선생님" 등록 수로 근사
  const teacherCount = regRows.filter((r) => r.name?.includes("선생님")).length;
  let schoolsSupported = 0;
  try {
    if (eventId) {
      const ev = await (sb.from("events").select("type").eq("id", eventId) as unknown as Promise<{
        data: { type: string }[] | null;
      }>);
      schoolsSupported = (ev.data ?? []).some((e) => e.type === "SCHOOL") ? 1 : 0;
    } else {
      const evAll = await (sb.from("events").select("type") as unknown as Promise<{
        data: { type: string }[] | null;
      }>);
      schoolsSupported = (evAll.data ?? []).filter((e) => e.type === "SCHOOL").length;
    }
  } catch {
    schoolsSupported = Math.max(1, Math.floor(teacherCount / 2));
  }

  const reviewRows = await safeRows<{ rating: number }>(
    sb,
    "event_reviews",
    "rating",
    eventId ? { col: "event_id", val: eventId } : undefined
  );
  const averageRating =
    reviewRows.length > 0
      ? Math.round((reviewRows.reduce((s, r) => s + (r.rating ?? 0), 0) / reviewRows.length) * 10) / 10
      : 4.5; // 기본값

  // ─────────────────────────────
  // Governance
  // ─────────────────────────────
  const reviewCount = reviewRows.length;
  // 투명성: 리뷰 수 기반. 참여자 대비 리뷰율이 높을수록 투명. (max 100)
  const reviewRate = participantCount > 0 ? reviewCount / participantCount : 0;
  const transparencyScore = Math.min(100, Math.round(60 + reviewRate * 100));

  const localBusinessesEngaged = await safeCount(sb, "partners");
  const partnerPrograms = await safeCount(sb, "partner_programs");

  // ─────────────────────────────
  // 총점 계산 (각 영역 가중 평균)
  // ─────────────────────────────
  // Environmental score: CO2 절감량 기반 (1톤=100점)
  const envScore = Math.min(100, Math.round((co2Saved / 1000) * 100 + (treesPlanted / 100) * 20));
  // Social score: 참여 가족/어린이/만족도 복합
  const socialScore = Math.min(
    100,
    Math.round(
      Math.min(70, (familiesConnected / 200) * 70) + (averageRating / 5) * 30
    )
  );
  // Governance score: 투명성 점수를 그대로 + 파트너/지역 보너스
  const govScore = Math.min(
    100,
    Math.round(transparencyScore * 0.7 + Math.min(20, localBusinessesEngaged * 2) + Math.min(10, partnerPrograms))
  );

  const totalScore = Math.round((envScore + socialScore + govScore) / 3);

  return {
    environmental: {
      co2Saved,
      treesPlanted,
      greenActivitiesHours,
    },
    social: {
      familiesConnected,
      childrenParticipated,
      schoolsSupported,
      averageRating,
    },
    governance: {
      transparencyScore,
      localBusinessesEngaged,
      partnerPrograms,
    },
    totalScore,
  };
}

export function getESGGrade(score: number): string {
  if (score >= 90) return "AAA";
  if (score >= 80) return "AA";
  if (score >= 70) return "A";
  if (score >= 60) return "BBB";
  if (score >= 50) return "BB";
  return "B";
}

export function getESGGradeColor(grade: string): { bg: string; text: string; border: string } {
  if (grade === "AAA") return { bg: "bg-yellow-100", text: "text-yellow-700", border: "border-yellow-400" };
  if (grade === "AA") return { bg: "bg-amber-100", text: "text-amber-700", border: "border-amber-400" };
  if (grade === "A") return { bg: "bg-green-100", text: "text-green-700", border: "border-green-400" };
  if (grade === "BBB") return { bg: "bg-lime-100", text: "text-lime-700", border: "border-lime-400" };
  if (grade === "BB") return { bg: "bg-neutral-100", text: "text-neutral-700", border: "border-neutral-400" };
  return { bg: "bg-neutral-100", text: "text-neutral-600", border: "border-neutral-300" };
}

/**
 * 여의도 공원 = 약 23만m² = 23헥타르
 * 가상 나무 1그루 = 약 10m² 커버 가정
 */
export function calculateYeouidoEquivalent(treesPlanted: number): number {
  const m2 = treesPlanted * 10;
  const yeouidoM2 = 230000;
  return Math.round((m2 / yeouidoM2) * 100) / 100;
}

/**
 * 월별 임팩트 트렌드 (최근 6개월)
 */
export async function getMonthlyESGTrend(
  supabase: unknown,
  months = 6
): Promise<Array<{ month: string; co2Saved: number; participants: number }>> {
  const sb = supabase as AnySupabase;
  const now = new Date();
  const result: Array<{ month: string; co2Saved: number; participants: number }> = [];

  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthStart = new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
    const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 1).toISOString();
    let count = 0;
    try {
      const res = await (sb
        .from("participants")
        .select("*", { count: "exact", head: true })
        .gte("joined_at", monthStart)
        .lte("joined_at", monthEnd) as unknown as Promise<{ count: number | null }>);
      count = res.count ?? 0;
    } catch {
      count = 0;
    }
    result.push({
      month: `${d.getMonth() + 1}월`,
      co2Saved: Math.round(count * 0.5 * 10) / 10,
      participants: count,
    });
  }
  return result;
}
