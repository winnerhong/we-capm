// server-only: @/lib/supabase/server 를 참조하므로 클라이언트 번들 포함 금지
//
// 보호자 ↔ 기관 다중 소속(app_user_orgs) 조회·기록 헬퍼.
//
// 배경: app_users.org_id 는 "홈(최초) 기관" 일 뿐이고, 실제 접근 권한은
//       app_user_orgs 가 정한다. 한 보호자가 여러 기관 초대장을 받는 것이
//       정상 시나리오이므로 org_id 직접 비교는 더 이상 권한 판단에 쓰면 안 된다.
//
//       ✗ user.org_id === event.org_id
//       ○ await hasOrgMembership(user.id, event.org_id)

import { createClient } from "@/lib/supabase/server";

/** 소속이 생긴 경로. 감사·통계용이며 권한 판단에는 쓰지 않는다. */
export type OrgMembershipSource =
  | "backfill"
  | "bulk_import"
  | "self_register"
  | "invitation"
  | "admin";

export interface UserOrgSummary {
  orgId: string;
  orgName: string;
  joinedAt: string;
}

type SbResp<T> = { data: T[] | null; error: unknown };
type SbRespOne<T> = { data: T | null; error: unknown };

/**
 * app_user_orgs 테이블이 아직 없는가 (마이그레이션 미적용).
 *
 * 배포 순서 안전장치: 코드가 먼저 올라가고 SQL 이 나중에 실행되는 창이 생기면
 * 소속 조회가 전부 빈 값이 되어 기관 관제 명단이 통째로 사라진다. 그 사이에는
 * 예전 기준(app_users.org_id = 홈 기관)으로 폴백한다.
 *   - 42P01   : postgres undefined_table
 *   - PGRST205: PostgREST 스키마 캐시에 테이블 없음
 * 마이그레이션이 적용되면 이 경로는 더 이상 타지 않는다.
 */
function isMissingTable(error: unknown): boolean {
  const code = (error as { code?: string } | null)?.code;
  return code === "42P01" || code === "PGRST205";
}

/** 폴백 — 홈 기관만 보던 예전 기준. */
async function legacyHomeOrgMatch(
  userId: string,
  orgId: string
): Promise<boolean> {
  const supabase = await createClient();
  const resp = (await (
    supabase.from("app_users" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          eq: (k: string, v: string) => {
            maybeSingle: () => Promise<SbRespOne<{ id: string }>>;
          };
        };
      };
    }
  )
    .select("id")
    .eq("id", userId)
    .eq("org_id", orgId)
    .maybeSingle()) as SbRespOne<{ id: string }>;
  return !!resp.data;
}

/** 폴백 — 홈 기관 기준 소속자 id 목록. */
async function legacyHomeOrgUserIds(orgId: string): Promise<string[]> {
  const supabase = await createClient();
  const resp = (await (
    supabase.from("app_users" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => Promise<SbResp<{ id: string }>>;
      };
    }
  )
    .select("id")
    .eq("org_id", orgId)) as SbResp<{ id: string }>;
  return (resp.data ?? []).map((r) => r.id).filter(Boolean);
}

/**
 * 이 보호자가 해당 기관에 소속돼 있는가.
 *
 * 실패 시 false — 권한 판단이므로 조회 오류는 "권한 없음" 으로 닫는다(fail-closed).
 */
export async function hasOrgMembership(
  userId: string,
  orgId: string
): Promise<boolean> {
  if (!userId || !orgId) return false;
  const supabase = await createClient();
  const resp = (await (
    supabase.from("app_user_orgs" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          eq: (k: string, v: string) => {
            maybeSingle: () => Promise<SbRespOne<{ user_id: string }>>;
          };
        };
      };
    }
  )
    .select("user_id")
    .eq("user_id", userId)
    .eq("org_id", orgId)
    .maybeSingle()) as SbRespOne<{ user_id: string }>;

  if (resp.error) {
    if (isMissingTable(resp.error)) return legacyHomeOrgMatch(userId, orgId);
    console.error("[app-user/orgs] hasOrgMembership error", resp.error);
    return false;
  }
  return !!resp.data;
}

/**
 * 소속 추가 — (user_id, org_id) PK 라 멱등.
 *
 * best-effort: 실패해도 throw 하지 않는다. 호출자는 대부분 참가 등록 흐름
 * 한복판이라, 소속 기록 실패로 참가 자체를 막는 건 과하다.
 * (소속이 누락돼도 다음 진입 때 다시 upsert 된다.)
 */
export async function addOrgMembership(
  userId: string,
  orgId: string,
  source: OrgMembershipSource
): Promise<void> {
  if (!userId || !orgId) return;
  try {
    const supabase = await createClient();
    const resp = (await (
      supabase.from("app_user_orgs" as never) as unknown as {
        upsert: (
          r: unknown,
          opts: { onConflict: string }
        ) => Promise<{ error: { code?: string } | null }>;
      }
    ).upsert(
      {
        user_id: userId,
        org_id: orgId,
        joined_at: new Date().toISOString(),
        source,
      },
      { onConflict: "user_id,org_id" }
    )) as { error: { code?: string } | null };

    // 23505 는 onConflict 로 피해가지만 경합 대비 무시
    if (resp.error && resp.error.code !== "23505") {
      console.error("[app-user/orgs] addOrgMembership error", resp.error);
    }
  } catch (e) {
    console.error("[app-user/orgs] addOrgMembership threw", e);
  }
}

/**
 * 이 보호자가 속한 기관 목록 — 홈 기관 스위처용.
 * joined_at 오름차순(먼저 소속된 기관이 앞).
 */
export async function listUserOrgs(
  userId: string
): Promise<UserOrgSummary[]> {
  if (!userId) return [];
  const supabase = await createClient();

  const memResp = (await (
    supabase.from("app_user_orgs" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          order: (
            c: string,
            o: { ascending: boolean }
          ) => Promise<SbResp<{ org_id: string; joined_at: string }>>;
        };
      };
    }
  )
    .select("org_id, joined_at")
    .eq("user_id", userId)
    .order("joined_at", { ascending: true })) as SbResp<{
    org_id: string;
    joined_at: string;
  }>;

  if (memResp.error) {
    // 폴백 없음 — 스위처 라벨 용도라, 테이블이 없으면 그냥 안 보이면 된다.
    if (!isMissingTable(memResp.error)) {
      console.error("[app-user/orgs] listUserOrgs mem error", memResp.error);
    }
    return [];
  }
  const rows = memResp.data ?? [];
  if (rows.length === 0) return [];

  const orgIds = Array.from(new Set(rows.map((r) => r.org_id)));
  const orgResp = (await (
    supabase.from("partner_orgs" as never) as unknown as {
      select: (c: string) => {
        in: (
          k: string,
          v: string[]
        ) => Promise<SbResp<{ id: string; org_name: string | null }>>;
      };
    }
  )
    .select("id, org_name")
    .in("id", orgIds)) as SbResp<{ id: string; org_name: string | null }>;

  const nameById = new Map<string, string>();
  for (const o of orgResp.data ?? []) {
    nameById.set(o.id, o.org_name?.trim() || "소속 기관");
  }

  return rows.map((r) => ({
    orgId: r.org_id,
    orgName: nameById.get(r.org_id) ?? "소속 기관",
    joinedAt: r.joined_at,
  }));
}

/**
 * 기관에 소속된 보호자 id 목록 — 관제 명단·CSV 내보내기용.
 *
 * 기존 `app_users.org_id = orgId` 필터를 이걸로 교체해야, 타 기관 소속이지만
 * 이 기관 행사에 참가한 보호자가 명단에서 누락되지 않는다.
 */
export async function listOrgUserIds(orgId: string): Promise<string[]> {
  if (!orgId) return [];
  const supabase = await createClient();
  const resp = (await (
    supabase.from("app_user_orgs" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => Promise<SbResp<{ user_id: string }>>;
      };
    }
  )
    .select("user_id")
    .eq("org_id", orgId)) as SbResp<{ user_id: string }>;

  if (resp.error) {
    if (isMissingTable(resp.error)) return legacyHomeOrgUserIds(orgId);
    console.error("[app-user/orgs] listOrgUserIds error", resp.error);
    return [];
  }
  return Array.from(
    new Set((resp.data ?? []).map((r) => r.user_id).filter(Boolean))
  );
}
