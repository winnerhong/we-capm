/**
 * 리뷰 관리 — 서버 전용 쿼리 헬퍼 (not "use server")
 * 서버 컴포넌트/서버 액션에서 직접 import 해서 사용합니다.
 */

import { createClient } from "@/lib/supabase/server";

// -----------------------------
// Types
// -----------------------------

export type ReviewSource = "INTERNAL" | "EXTERNAL";
export type ReviewPlatform =
  | "TORIRO"
  | "NAVER"
  | "GOOGLE"
  | "INSTAGRAM"
  | "BLOG"
  | "KAKAO"
  | "MANUAL";

export interface UnifiedReview {
  id: string;
  source: ReviewSource;
  platform: ReviewPlatform;
  rating: number;
  content: string | null;
  author_name: string | null;
  created_at: string;
  response_text: string | null;
  response_at: string | null;
  is_flagged: boolean;
  program_id: string | null;
  program_title: string | null;
  event_id: string | null;
  event_name: string | null;
  source_url: string | null;
}

export interface ReviewStats {
  total: number;
  average: number;
  thisMonth: number;
  unanswered: number;
  distribution: { 1: number; 2: number; 3: number; 4: number; 5: number };
  internalCount: number;
  externalCount: number;
}

// -----------------------------
// Row 타입 (Supabase raw)
// -----------------------------

type InternalReviewRow = {
  id: string;
  event_id: string | null;
  participant_phone: string | null;
  participant_name: string | null;
  rating: number | null;
  comment: string | null;
  mission_highlight: string | null;
  improvement: string | null;
  photo_consent: boolean | null;
  is_public: boolean | null;
  response_text: string | null;
  response_at: string | null;
  is_flagged: boolean | null;
  created_at: string | null;
};

type ExternalReviewRow = {
  id: string;
  partner_id: string | null;
  program_id: string | null;
  platform: string | null;
  external_id: string | null;
  author_name: string | null;
  author_avatar: string | null;
  rating: number | null;
  content: string | null;
  published_at: string | null;
  response_text: string | null;
  response_at: string | null;
  sentiment: string | null;
  is_flagged: boolean | null;
  source_url: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type EventNameRow = { id: string; name: string | null };
type ProgramTitleRow = { id: string; title: string | null };

// -----------------------------
// Helpers
// -----------------------------

function coercePlatform(raw: string | null | undefined): ReviewPlatform {
  const upper = (raw ?? "").toUpperCase();
  if (
    upper === "NAVER" ||
    upper === "GOOGLE" ||
    upper === "INSTAGRAM" ||
    upper === "BLOG" ||
    upper === "KAKAO" ||
    upper === "MANUAL" ||
    upper === "TORIRO"
  ) {
    return upper;
  }
  return "MANUAL";
}

// -----------------------------
// 1) 내부 리뷰 (event_reviews) 로드
// -----------------------------
/**
 * Phase 1: event 소유권(파트너) 연결이 아직 명확하지 않아,
 * is_public=true인 모든 event_reviews를 반환하고,
 * event 이름만 join(별도 쿼리 후 머지) 합니다.
 * 추후 events→partner 관계 정립 후 여기서 필터링하도록 개선.
 */
export async function loadInternalReviews(
  _partnerId: string
): Promise<UnifiedReview[]> {
  const supabase = await createClient();

  let rows: InternalReviewRow[] = [];
  try {
    const { data } = await (supabase.from("event_reviews" as never) as unknown as {
      select: (cols: string) => {
        eq: (col: string, val: unknown) => {
          order: (
            col: string,
            opts: { ascending: boolean }
          ) => Promise<{ data: InternalReviewRow[] | null }>;
        };
      };
    })
      .select("*")
      .eq("is_public", true)
      .order("created_at", { ascending: false });
    rows = (data ?? []) as InternalReviewRow[];
  } catch {
    rows = [];
  }

  // event name 매핑
  const eventIds = Array.from(
    new Set(rows.map((r) => r.event_id).filter((v): v is string => Boolean(v)))
  );
  const eventNameMap = new Map<string, string>();
  if (eventIds.length > 0) {
    try {
      const { data } = await (supabase.from("events" as never) as unknown as {
        select: (cols: string) => {
          in: (
            col: string,
            vals: string[]
          ) => Promise<{ data: EventNameRow[] | null }>;
        };
      })
        .select("id,name")
        .in("id", eventIds);
      for (const row of (data ?? []) as EventNameRow[]) {
        if (row.id && row.name) eventNameMap.set(row.id, row.name);
      }
    } catch {
      // ignore
    }
  }

  return rows.map((r): UnifiedReview => {
    const rating = typeof r.rating === "number" ? r.rating : 0;
    return {
      id: r.id,
      source: "INTERNAL",
      platform: "TORIRO",
      rating,
      content: r.comment ?? null,
      author_name: r.participant_name ?? null,
      created_at: r.created_at ?? new Date(0).toISOString(),
      response_text: r.response_text ?? null,
      response_at: r.response_at ?? null,
      is_flagged: Boolean(r.is_flagged),
      program_id: null,
      program_title: null,
      event_id: r.event_id ?? null,
      event_name: r.event_id ? eventNameMap.get(r.event_id) ?? null : null,
      source_url: null,
    };
  });
}

// -----------------------------
// 2) 외부 리뷰 (partner_external_reviews) 로드
// -----------------------------
export async function loadExternalReviews(
  partnerId: string
): Promise<UnifiedReview[]> {
  const supabase = await createClient();
  if (!partnerId) return [];

  let rows: ExternalReviewRow[] = [];
  try {
    const { data } = await (supabase.from("partner_external_reviews" as never) as unknown as {
      select: (cols: string) => {
        eq: (col: string, val: unknown) => {
          order: (
            col: string,
            opts: { ascending: boolean }
          ) => Promise<{ data: ExternalReviewRow[] | null }>;
        };
      };
    })
      .select("*")
      .eq("partner_id", partnerId)
      .order("published_at", { ascending: false });
    rows = (data ?? []) as ExternalReviewRow[];
  } catch {
    rows = [];
  }

  // program title 매핑
  const programIds = Array.from(
    new Set(rows.map((r) => r.program_id).filter((v): v is string => Boolean(v)))
  );
  const programTitleMap = new Map<string, string>();
  if (programIds.length > 0) {
    try {
      const { data } = await (supabase.from("partner_programs" as never) as unknown as {
        select: (cols: string) => {
          in: (
            col: string,
            vals: string[]
          ) => Promise<{ data: ProgramTitleRow[] | null }>;
        };
      })
        .select("id,title")
        .in("id", programIds);
      for (const row of (data ?? []) as ProgramTitleRow[]) {
        if (row.id && row.title) programTitleMap.set(row.id, row.title);
      }
    } catch {
      // ignore
    }
  }

  return rows.map((r): UnifiedReview => {
    const rating = typeof r.rating === "number" ? r.rating : 0;
    return {
      id: r.id,
      source: "EXTERNAL",
      platform: coercePlatform(r.platform),
      rating,
      content: r.content ?? null,
      author_name: r.author_name ?? null,
      created_at: r.published_at ?? r.created_at ?? new Date(0).toISOString(),
      response_text: r.response_text ?? null,
      response_at: r.response_at ?? null,
      is_flagged: Boolean(r.is_flagged),
      program_id: r.program_id ?? null,
      program_title: r.program_id
        ? programTitleMap.get(r.program_id) ?? null
        : null,
      event_id: null,
      event_name: null,
      source_url: r.source_url ?? null,
    };
  });
}

// -----------------------------
// 3) 통계 (ReviewStats) 집계
// -----------------------------
export async function loadReviewStats(partnerId: string): Promise<ReviewStats> {
  const [internal, external] = await Promise.all([
    loadInternalReviews(partnerId),
    loadExternalReviews(partnerId),
  ]);
  const combined: UnifiedReview[] = [...internal, ...external];

  const total = combined.length;
  const rated = combined.filter(
    (r) => typeof r.rating === "number" && r.rating >= 1 && r.rating <= 5
  );
  const average =
    rated.length > 0
      ? rated.reduce((sum, r) => sum + r.rating, 0) / rated.length
      : 0;

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const thisMonth = combined.filter((r) => {
    if (!r.created_at) return false;
    const t = new Date(r.created_at).getTime();
    return Number.isFinite(t) && t >= monthStart;
  }).length;

  const unanswered = combined.filter((r) => !r.response_text).length;

  const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } as ReviewStats["distribution"];
  for (const r of combined) {
    const star = Math.round(r.rating);
    if (star === 1 || star === 2 || star === 3 || star === 4 || star === 5) {
      distribution[star as 1 | 2 | 3 | 4 | 5] += 1;
    }
  }

  return {
    total,
    average: Number.isFinite(average) ? Math.round(average * 10) / 10 : 0,
    thisMonth,
    unanswered,
    distribution,
    internalCount: internal.length,
    externalCount: external.length,
  };
}
