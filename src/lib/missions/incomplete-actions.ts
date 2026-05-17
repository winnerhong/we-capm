"use server";

// 참가자 미완료 미션 조회 — BoostModal 의 "도토리 더 받기" 펼침 카드에서 사용.
// 사용자가 가진 잠재 도토리 (아직 완료 안 한 활성 미션의 acorns 합) 를 안내해서
// 신청곡 끌어올리기에 더 쓰도록 유도.

import { createClient } from "@/lib/supabase/server";
import { requireAppUser } from "@/lib/user-auth-guard";

type SbErr = { message: string; code?: string } | null;

export interface IncompleteMissionItem {
  id: string;
  title: string;
  icon: string | null;
  kind: string;
  acorns: number;
}

/**
 * 현재 사용자의 org 에서 활성 미션 중 본인이 아직 완료 안 한 것들 + 보상.
 *  - "완료" = mission_submissions.status in (APPROVED, AUTO_APPROVED)
 *  - 결과 정렬: acorns DESC (가장 많이 받을 수 있는 것 우선)
 *  - 최대 limit 개 반환 (디폴트 10)
 */
export async function loadIncompleteMissionsForUserAction(
  limit: number = 10
): Promise<IncompleteMissionItem[]> {
  const user = await requireAppUser();
  const orgId = user.orgId;
  if (!orgId) return [];

  const supabase = await createClient();

  // 1) 활성 org 미션 모두 조회.
  type MissionRow = {
    id: string;
    title: string;
    icon: string | null;
    kind: string;
    acorns: number | null;
  };
  const missionResp = (await (
    supabase.from("org_missions" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          eq: (
            k: string,
            v: boolean
          ) => Promise<{ data: MissionRow[] | null; error: SbErr }>;
        };
      };
    }
  )
    .select("id, title, icon, kind, acorns")
    .eq("org_id", orgId)
    .eq("is_active", true)) as {
    data: MissionRow[] | null;
    error: SbErr;
  };

  if (missionResp.error || !missionResp.data) return [];
  const missions = missionResp.data;
  if (missions.length === 0) return [];

  const missionIds = missions.map((m) => m.id);

  // 2) 본인의 APPROVED/AUTO_APPROVED submission 들 — 어떤 미션을 이미 완료했는지.
  const subResp = (await (
    supabase.from("mission_submissions" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          in: (k: string, v: string[]) => {
            in: (
              k: string,
              v: string[]
            ) => Promise<{
              data: Array<{ org_mission_id: string }> | null;
              error: SbErr;
            }>;
          };
        };
      };
    }
  )
    .select("org_mission_id")
    .eq("user_id", user.id)
    .in("org_mission_id", missionIds)
    .in("status", ["APPROVED", "AUTO_APPROVED"])) as {
    data: Array<{ org_mission_id: string }> | null;
    error: SbErr;
  };

  const completedSet = new Set(
    (subResp.data ?? []).map((s) => s.org_mission_id)
  );

  // 3) 미완료 미션만 필터 + 정렬.
  return missions
    .filter((m) => !completedSet.has(m.id))
    .filter((m) => (m.acorns ?? 0) > 0)
    .sort((a, b) => (b.acorns ?? 0) - (a.acorns ?? 0))
    .slice(0, Math.max(1, Math.min(limit, 30)))
    .map((m) => ({
      id: m.id,
      title: m.title,
      icon: m.icon,
      kind: m.kind,
      acorns: m.acorns ?? 0,
    }));
}
