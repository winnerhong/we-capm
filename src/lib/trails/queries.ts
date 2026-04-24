// server-only: @/lib/supabase/server를 참조하므로 클라이언트 번들에 포함 불가
import { createClient } from "@/lib/supabase/server";
import type { TrailRow } from "@/lib/trails/types";

type SbResp<T> = { data: T[] | null; error: unknown };

/**
 * 기관(org) 포털용: 해당 기관에 노출되어야 할 모든 숲길을 반환한다.
 *   - visibility='ALL' 인 모든 숲길
 *   - visibility='SELECTED' AND partner_trail_assignments(org_id=orgId) 에 등록된 숲길
 *
 * ARCHIVED / DRAFT 는 자동으로 제외된다.
 * 쿼리 에러는 조용히 빈 배열로 fallback (throw 안 함).
 */
export async function loadTrailsAssignedToOrg(
  orgId: string
): Promise<TrailRow[]> {
  if (!orgId) return [];

  const supabase = await createClient();

  // 1) visibility='ALL'인 모든 trails
  const allResp = (await (supabase.from("partner_trails" as never) as unknown as {
    select: (c: string) => {
      eq: (k: string, v: string) => {
        order: (
          c: string,
          o: { ascending: boolean }
        ) => Promise<SbResp<TrailRow>>;
      };
    };
  })
    .select("*")
    .eq("visibility", "ALL")
    .order("created_at", { ascending: false })) as SbResp<TrailRow>;

  // 2) 이 org에 할당된 trail_ids
  const assignResp = (await (
    supabase.from("partner_trail_assignments" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => Promise<SbResp<{ trail_id: string }>>;
      };
    }
  )
    .select("trail_id")
    .eq("org_id", orgId)) as SbResp<{ trail_id: string }>;

  const assignedIds = (assignResp.data ?? [])
    .map((r) => r.trail_id)
    .filter(Boolean);

  // 3) visibility='SELECTED' + assignedIds
  let selectedTrails: TrailRow[] = [];
  if (assignedIds.length > 0) {
    const selResp = (await (
      supabase.from("partner_trails" as never) as unknown as {
        select: (c: string) => {
          eq: (k: string, v: string) => {
            in: (k: string, v: string[]) => Promise<SbResp<TrailRow>>;
          };
        };
      }
    )
      .select("*")
      .eq("visibility", "SELECTED")
      .in("id", assignedIds)) as SbResp<TrailRow>;

    selectedTrails = selResp.data ?? [];
  }

  // 4) 머지 + dedupe (동일 id가 양쪽 결과에 뜨는 케이스 방지)
  const map = new Map<string, TrailRow>();
  for (const row of allResp.data ?? []) {
    if (row && typeof row.id === "string") map.set(row.id, row);
  }
  for (const row of selectedTrails) {
    if (row && typeof row.id === "string") map.set(row.id, row);
  }

  return Array.from(map.values());
}
