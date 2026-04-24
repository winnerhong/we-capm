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
