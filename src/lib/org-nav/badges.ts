// 기관 포털 상단 네비게이션의 실시간 신호용 배지 카운트 (워크플로우 단계별).
//
// - draftEvents     : 1단계 만들기 — DRAFT 행사 수 (마무리 안 한 것들)
// - unpublishedPacks: 4단계 콘텐츠 — DRAFT/PAUSED 스탬프북 수
// - pendingReview   : 5단계 진행 — 미션 제출 검수 대기 수
// - fmLive          : 5단계 진행 — 토리FM LIVE 방송 진행 여부 (펄스 dot)
// - missingDocs     : 계정 메뉴 알림 dot — 필수 서류 미완료 수
//
// 각 쿼리는 try/catch 로 isolated — 하나가 실패해도 나머지 배지는 살아남는다.
// layout.tsx 에서 한 번 호출되어 OrgNav 에 prop 으로 주입됨.

import { createClient } from "@/lib/supabase/server";
import { loadOrgDocumentStats } from "@/lib/org-documents/queries";
import { loadLiveFmSessionForOrg } from "@/lib/missions/queries";

export interface OrgNavBadges {
  draftEvents: number;
  unpublishedPacks: number;
  pendingReview: number;
  fmLive: boolean;
  missingDocs: number;
}

async function countPendingReview(orgId: string): Promise<number> {
  if (!orgId) return 0;
  try {
    const supabase = await createClient();

    const missionsResp = (await (
      supabase.from("org_missions" as never) as unknown as {
        select: (c: string) => {
          eq: (
            k: string,
            v: string
          ) => Promise<{ data: { id: string }[] | null }>;
        };
      }
    )
      .select("id")
      .eq("org_id", orgId)) as { data: { id: string }[] | null };

    const missionIds = (missionsResp.data ?? []).map((m) => m.id);
    if (missionIds.length === 0) return 0;

    const subsResp = (await (
      supabase.from("mission_submissions" as never) as unknown as {
        select: (
          c: string,
          opts: { count: "exact"; head: true }
        ) => {
          in: (k: string, v: string[]) => {
            in: (
              k: string,
              v: string[]
            ) => Promise<{ count: number | null }>;
          };
        };
      }
    )
      .select("id", { count: "exact", head: true })
      .in("org_mission_id", missionIds)
      .in("status", ["SUBMITTED", "PENDING_REVIEW"])) as {
      count: number | null;
    };

    return subsResp.count ?? 0;
  } catch {
    return 0;
  }
}

async function countDraftEvents(orgId: string): Promise<number> {
  if (!orgId) return 0;
  try {
    const supabase = await createClient();
    const resp = (await (
      supabase.from("org_events" as never) as unknown as {
        select: (
          c: string,
          opts: { count: "exact"; head: true }
        ) => {
          eq: (k: string, v: string) => {
            eq: (k: string, v: string) => Promise<{ count: number | null }>;
          };
        };
      }
    )
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId)
      .eq("status", "DRAFT")) as { count: number | null };
    return resp.count ?? 0;
  } catch {
    return 0;
  }
}

async function countUnpublishedPacks(orgId: string): Promise<number> {
  if (!orgId) return 0;
  try {
    const supabase = await createClient();
    const resp = (await (
      supabase.from("org_quest_packs" as never) as unknown as {
        select: (
          c: string,
          opts: { count: "exact"; head: true }
        ) => {
          eq: (k: string, v: string) => {
            eq: (k: string, v: string) => Promise<{ count: number | null }>;
          };
        };
      }
    )
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId)
      .eq("status", "DRAFT")) as { count: number | null };
    return resp.count ?? 0;
  } catch {
    return 0;
  }
}

async function checkFmLive(orgId: string): Promise<boolean> {
  try {
    const session = await loadLiveFmSessionForOrg(orgId);
    return !!session?.is_live;
  } catch {
    return false;
  }
}

async function countMissingDocs(orgId: string): Promise<number> {
  try {
    const stats = await loadOrgDocumentStats(orgId);
    return stats.missingRequired.length;
  } catch {
    return 0;
  }
}

export async function loadOrgNavBadges(orgId: string): Promise<OrgNavBadges> {
  const [draftEvents, unpublishedPacks, pendingReview, fmLive, missingDocs] =
    await Promise.all([
      countDraftEvents(orgId),
      countUnpublishedPacks(orgId),
      countPendingReview(orgId),
      checkFmLive(orgId),
      countMissingDocs(orgId),
    ]);
  return {
    draftEvents,
    unpublishedPacks,
    pendingReview,
    fmLive,
    missingDocs,
  };
}
