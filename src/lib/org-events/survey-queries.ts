// server-only: 행사 설문 조회.
//
// 실패 정책: throw 하지 않고 빈 값. 설문은 곁들이는 기능이라, 이걸로 결과 화면이나
// 참가자 행사홈이 통째로 안 뜨면 그게 더 큰 사고다. 테이블이 아직 없는 배포 창도
// 같은 길로 흘러간다.

import "server-only";
import { createClient } from "@/lib/supabase/server";
import { loadFamilyNames } from "@/lib/missions/photo-feed-queries";

type SbResp<T> = { data: T[] | null; error: unknown };

export type SurveyResponseRow = {
  id: string;
  userId: string;
  rating: number;
  bestMissionId: string | null;
  comment: string | null;
  createdAt: string;
};

export type SurveyResponseWithName = SurveyResponseRow & {
  /** "햇살반 홍길동" — 피드 캡션과 같은 규칙(loadFamilyNames). */
  name: string;
  bestMissionTitle: string | null;
};

/** 이 행사 응답 목록 — 최근 순. 이름과 "가장 좋았던 미션" 제목까지 붙여 준다. */
export async function loadSurveyResponses(
  eventId: string,
  limit = 100
): Promise<SurveyResponseWithName[]> {
  if (!eventId) return [];
  try {
    const supabase = await createClient();
    const resp = (await (
      supabase.from("event_survey_responses" as never) as unknown as {
        select: (c: string) => {
          eq: (
            k: string,
            v: string
          ) => {
            order: (
              c: string,
              o: { ascending: boolean }
            ) => { limit: (n: number) => Promise<SbResp<RawRow>> };
          };
        };
      }
    )
      .select("id, user_id, rating, best_mission_id, comment, created_at")
      .eq("event_id", eventId)
      .order("created_at", { ascending: false })
      .limit(limit)) as SbResp<RawRow>;

    const rows = resp.data ?? [];
    if (rows.length === 0) return [];

    const [names, missionTitles] = await Promise.all([
      loadFamilyNames(
        Array.from(new Set(rows.map((r) => r.user_id))),
        eventId
      ).catch(() => new Map<string, string>()),
      loadMissionTitles(
        supabase,
        Array.from(
          new Set(
            rows
              .map((r) => r.best_mission_id)
              .filter((v): v is string => Boolean(v))
          )
        )
      ),
    ]);

    return rows.map((r) => ({
      id: r.id,
      userId: r.user_id,
      rating: r.rating,
      bestMissionId: r.best_mission_id,
      comment: r.comment,
      createdAt: r.created_at,
      name: names.get(r.user_id) || "어느",
      bestMissionTitle: r.best_mission_id
        ? (missionTitles.get(r.best_mission_id) ?? null)
        : null,
    }));
  } catch (e) {
    console.error("[survey] responses", e);
    return [];
  }
}

/** 내가 이미 낸 응답 — 있으면 폼을 그 값으로 채워 "고치기" 가 된다. */
export async function loadMySurveyResponse(
  eventId: string,
  userId: string
): Promise<SurveyResponseRow | null> {
  if (!eventId || !userId) return null;
  try {
    const supabase = await createClient();
    const resp = (await (
      supabase.from("event_survey_responses" as never) as unknown as {
        select: (c: string) => {
          eq: (
            k: string,
            v: string
          ) => {
            eq: (
              k: string,
              v: string
            ) => { maybeSingle: () => Promise<{ data: RawRow | null }> };
          };
        };
      }
    )
      .select("id, user_id, rating, best_mission_id, comment, created_at")
      .eq("event_id", eventId)
      .eq("user_id", userId)
      .maybeSingle()) as { data: RawRow | null };

    const r = resp.data;
    if (!r) return null;
    return {
      id: r.id,
      userId: r.user_id,
      rating: r.rating,
      bestMissionId: r.best_mission_id,
      comment: r.comment,
      createdAt: r.created_at,
    };
  } catch (e) {
    console.error("[survey] mine", e);
    return null;
  }
}

type RawRow = {
  id: string;
  user_id: string;
  rating: number;
  best_mission_id: string | null;
  comment: string | null;
  created_at: string;
};

type Supa = Awaited<ReturnType<typeof createClient>>;

async function loadMissionTitles(
  supabase: Supa,
  ids: string[]
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (ids.length === 0) return out;
  try {
    const resp = (await (
      supabase.from("org_missions" as never) as unknown as {
        select: (c: string) => {
          in: (
            k: string,
            v: string[]
          ) => Promise<SbResp<{ id: string; title: string }>>;
        };
      }
    )
      .select("id, title")
      .in("id", ids)) as SbResp<{ id: string; title: string }>;
    for (const m of resp.data ?? []) out.set(m.id, m.title);
  } catch (e) {
    console.error("[survey] mission titles", e);
  }
  return out;
}
