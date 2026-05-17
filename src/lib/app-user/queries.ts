// server-only: @/lib/supabase/server를 참조하므로 클라이언트 번들 포함 금지
import { createClient } from "@/lib/supabase/server";

export type AppUserStatus = "ACTIVE" | "SUSPENDED" | "CLOSED";

export interface AppUserRow {
  id: string;
  phone: string;
  password_hash: string;
  parent_name: string;
  org_id: string;
  acorn_balance: number;
  status: AppUserStatus;
  notification_consent: boolean;
  first_login_at: string | null;
  last_login_at: string | null;
  onboarding_rewarded: boolean;
  onboarding_bonus_count: number;
  created_at: string;
}

export interface AppChildRow {
  id: string;
  user_id: string;
  name: string;
  birth_date: string | null;
  gender: "M" | "F" | null;
  notes: string | null;
  is_enrolled: boolean;
  class_name: string | null;
  created_at: string;
}

export type AcornReason =
  | "STAMP_SLOT"
  | "STAMPBOOK_COMPLETE"
  | "CHALLENGE"
  | "ATTENDANCE"
  | "SPEND_COUPON"
  | "SPEND_DECORATION"
  | "ADMIN_GRANT"
  | "ADMIN_DEDUCT"
  | "OTHER";

export interface AcornTransactionRow {
  id: string;
  user_id: string;
  amount: number;
  reason: AcornReason;
  source_id: string | null;
  source_type: string | null;
  memo: string | null;
  created_at: string;
}

type SbRespOne<T> = { data: T | null; error: unknown };
type SbResp<T> = { data: T[] | null; error: unknown };

/**
 * id로 보호자 단건 로드
 */
export async function loadAppUserById(id: string): Promise<AppUserRow | null> {
  if (!id) return null;
  const supabase = await createClient();
  const resp = (await (
    supabase.from("app_users" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          maybeSingle: () => Promise<SbRespOne<AppUserRow>>;
        };
      };
    }
  )
    .select("*")
    .eq("id", id)
    .maybeSingle()) as SbRespOne<AppUserRow>;
  return resp.data ?? null;
}

/**
 * 전화번호(숫자만)로 보호자 단건 로드
 */
export async function loadAppUserByPhone(
  phone: string
): Promise<AppUserRow | null> {
  const digits = (phone ?? "").replace(/\D/g, "");
  if (!digits) return null;
  const supabase = await createClient();
  const resp = (await (
    supabase.from("app_users" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          maybeSingle: () => Promise<SbRespOne<AppUserRow>>;
        };
      };
    }
  )
    .select("*")
    .eq("phone", digits)
    .maybeSingle()) as SbRespOne<AppUserRow>;
  return resp.data ?? null;
}

/**
 * 여러 보호자의 자녀 이름을 한 번에 로드 — userId → 이름 배열.
 *  - 등록(is_enrolled=true) 된 자녀가 있으면 그 자녀들만 반환
 *  - 없으면 모든 자녀 이름 반환
 *  - 자녀가 전혀 없으면 빈 배열
 */
export async function loadChildNamesByUserIds(
  userIds: string[]
): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  if (userIds.length === 0) return map;
  const supabase = await createClient();
  const resp = (await (
    supabase.from("app_children" as never) as unknown as {
      select: (c: string) => {
        in: (
          k: string,
          v: string[]
        ) => Promise<SbResp<AppChildRow>>;
      };
    }
  )
    .select("*")
    .in("user_id", userIds)) as SbResp<AppChildRow>;
  for (const row of resp.data ?? []) {
    if (!row.name?.trim()) continue;
    const arr = map.get(row.user_id) ?? [];
    arr.push({ name: row.name.trim(), enrolled: row.is_enrolled } as never);
    map.set(row.user_id, arr as never);
  }
  // 후처리 — enrolled 있으면 그것만, 없으면 전부
  const out = new Map<string, string[]>();
  for (const [uid, raw] of map.entries()) {
    const list = raw as unknown as { name: string; enrolled: boolean }[];
    const enrolled = list.filter((x) => x.enrolled).map((x) => x.name);
    out.set(uid, enrolled.length > 0 ? enrolled : list.map((x) => x.name));
  }
  return out;
}

/**
 * 보호자의 아이 목록 (오래된 순)
 */
export async function loadChildrenForUser(
  userId: string
): Promise<AppChildRow[]> {
  if (!userId) return [];
  const supabase = await createClient();
  const resp = (await (
    supabase.from("app_children" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          order: (
            c: string,
            o: { ascending: boolean }
          ) => Promise<SbResp<AppChildRow>>;
        };
      };
    }
  )
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })) as SbResp<AppChildRow>;
  return resp.data ?? [];
}

/**
 * org 내 도토리 잔액 TOP N 가족 — 참가자 홈 상단 리더보드용.
 *
 * 표시명 규칙: enrolled 자녀 있으면 "{이름들} 가족", 없고 자녀만 있으면
 * "{자녀이름들} 가족", 둘 다 없으면 "{보호자명} 가족".
 * acorn_balance > 0 만, 동점은 created_at ASC (먼저 가입 우선).
 */
export interface TopAcornFamily {
  userId: string;
  rank: number;
  familyLabel: string;
  acorns: number;
}

export async function loadTopAcornFamilies(
  orgId: string,
  limit: number
): Promise<TopAcornFamily[]> {
  if (!orgId) return [];
  const n = Math.max(1, Math.min(20, Math.floor(limit) || 5));
  const supabase = await createClient();

  type Row = {
    id: string;
    parent_name: string | null;
    acorn_balance: number | null;
    created_at: string;
  };
  const usersResp = (await (
    supabase.from("app_users" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          eq: (k: string, v: string) => {
            gt: (k: string, v: number) => {
              order: (
                c: string,
                o: { ascending: boolean }
              ) => {
                order: (
                  c: string,
                  o: { ascending: boolean }
                ) => {
                  limit: (n: number) => Promise<SbResp<Row>>;
                };
              };
            };
          };
        };
      };
    }
  )
    .select("id, parent_name, acorn_balance, created_at")
    .eq("org_id", orgId)
    .eq("status", "ACTIVE")
    .gt("acorn_balance", 0)
    .order("acorn_balance", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(n)) as SbResp<Row>;

  const users = usersResp.data ?? [];
  if (users.length === 0) return [];

  const ids = users.map((u) => u.id);
  const childMap = await loadChildNamesByUserIds(ids);

  return users.map((u, idx) => {
    const childNames = childMap.get(u.id) ?? [];
    const familyLabel =
      childNames.length > 0
        ? `${childNames.join("·")} 가족`
        : `${(u.parent_name ?? "").trim() || "보호자"} 가족`;
    return {
      userId: u.id,
      rank: idx + 1,
      familyLabel,
      acorns: u.acorn_balance ?? 0,
    };
  });
}

/**
 * 현재 도토리 잔액. 유저가 없으면 0 반환.
 */
export async function getAcornBalance(userId: string): Promise<number> {
  if (!userId) return 0;
  const supabase = await createClient();
  const resp = (await (
    supabase.from("app_users" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          maybeSingle: () => Promise<
            SbRespOne<{ acorn_balance: number | null }>
          >;
        };
      };
    }
  )
    .select("acorn_balance")
    .eq("id", userId)
    .maybeSingle()) as SbRespOne<{ acorn_balance: number | null }>;
  return resp.data?.acorn_balance ?? 0;
}

/**
 * 최근 도토리 거래 내역 (최신순)
 */
export async function loadRecentAcornTransactions(
  userId: string,
  limit: number
): Promise<AcornTransactionRow[]> {
  if (!userId) return [];
  const safeLimit = Math.max(1, Math.min(200, Math.floor(limit) || 20));
  const supabase = await createClient();
  const resp = (await (
    supabase.from("user_acorn_transactions" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          order: (
            c: string,
            o: { ascending: boolean }
          ) => {
            limit: (n: number) => Promise<SbResp<AcornTransactionRow>>;
          };
        };
      };
    }
  )
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(safeLimit)) as SbResp<AcornTransactionRow>;
  return resp.data ?? [];
}
