// server-only: 행사 단위 도토리 집계.
//
// app_users.acorn_balance 는 계정 전역 누적이라 "참좋은에서 모은 21개"가
// 도원센트럴 행사 화면에도 그대로 떴다. 행사 화면은 전부 이 모듈을 쓴다.
//
// 진실의 원천은 원장(user_acorn_transactions)이다.
//   잔액 컬럼은 참고용(전체 누적)으로만 남는다.
//
// 배포 순서 안전장치:
//   event_id 컬럼이 아직 없으면(마이그레이션 미적용) 계정 전역 값으로 폴백한다.
//   코드가 먼저 올라가도 화면이 0으로 비지 않는다. 마이그레이션이 적용되면
//   폴백 경로는 더 이상 타지 않는다.

import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getAcornBalance } from "@/lib/app-user/queries";
import type {
  AcornTransactionRow,
  TopAcornFamily,
} from "@/lib/app-user/queries";
import {
  loadChildNamesByUserIds,
  loadPrimaryClassByUserIds,
} from "@/lib/app-user/queries";

type SbResp<T> = { data: T[] | null; error: unknown };

/** event_id 컬럼 미존재(42703 undefined_column / PGRST204) 판별. */
function isMissingColumn(error: unknown): boolean {
  const e = error as { code?: string; message?: string } | null;
  if (!e) return false;
  if (e.code === "42703" || e.code === "PGRST204") return true;
  return typeof e.message === "string" && e.message.includes("event_id");
}

/**
 * 이 행사에서 이 보호자가 보유한 도토리.
 * 원장의 event_id 별 합계 — 벌면 +, 쓰면 −.
 */
export async function getEventAcornBalance(
  userId: string,
  eventId: string
): Promise<number> {
  if (!userId || !eventId) return 0;
  const supabase = await createClient();
  const resp = (await (
    supabase.from("user_acorn_transactions" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          eq: (k: string, v: string) => Promise<SbResp<{ amount: number }>>;
        };
      };
    }
  )
    .select("amount")
    .eq("user_id", userId)
    .eq("event_id", eventId)) as SbResp<{ amount: number }>;

  if (resp.error) {
    if (isMissingColumn(resp.error)) return getAcornBalance(userId);
    console.error("[event-acorns] balance error", resp.error);
    return 0;
  }
  return (resp.data ?? []).reduce((sum, r) => sum + (r.amount ?? 0), 0);
}

/** 이 행사의 도토리 내역 (최신순). */
export async function loadEventAcornTransactions(
  userId: string,
  eventId: string,
  limit: number
): Promise<AcornTransactionRow[]> {
  if (!userId || !eventId) return [];
  const safeLimit = Math.max(1, Math.min(200, Math.floor(limit) || 20));
  const supabase = await createClient();
  const resp = (await (
    supabase.from("user_acorn_transactions" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          eq: (
            k: string,
            v: string
          ) => {
            order: (
              c: string,
              o: { ascending: boolean }
            ) => {
              limit: (n: number) => Promise<SbResp<AcornTransactionRow>>;
            };
          };
        };
      };
    }
  )
    .select("*")
    .eq("user_id", userId)
    .eq("event_id", eventId)
    .order("created_at", { ascending: false })
    .limit(safeLimit)) as SbResp<AcornTransactionRow>;

  if (resp.error) {
    if (isMissingColumn(resp.error)) {
      const { loadRecentAcornTransactions } = await import(
        "@/lib/app-user/queries"
      );
      return loadRecentAcornTransactions(userId, safeLimit);
    }
    console.error("[event-acorns] tx error", resp.error);
    return [];
  }
  return resp.data ?? [];
}



/**
 * 이 행사의 도토리 랭킹.
 *
 * 예전 랭킹은 app_users.acorn_balance 를 기관 기준으로 줄 세웠다. 두 기관에
 * 다니는 집이 양쪽에서 모은 도토리로 두 랭킹 모두에서 유리했다.
 * 행사 안에서 번 것만 세면 공정해진다.
 */
export async function loadTopAcornFamiliesForEvent(
  eventId: string,
  limit: number
): Promise<TopAcornFamily[]> {
  if (!eventId) return [];
  const n = Math.max(1, Math.min(20, Math.floor(limit) || 5));
  const supabase = await createClient();

  const txResp = (await (
    supabase.from("user_acorn_transactions" as never) as unknown as {
      select: (c: string) => {
        eq: (
          k: string,
          v: string
        ) => Promise<SbResp<{ user_id: string; amount: number }>>;
      };
    }
  )
    .select("user_id, amount")
    .eq("event_id", eventId)) as SbResp<{ user_id: string; amount: number }>;

  if (txResp.error) {
    // 컬럼 미존재 등 — 랭킹은 없어도 화면이 성립하므로 조용히 비운다.
    if (!isMissingColumn(txResp.error)) {
      console.error("[event-acorns] ranking error", txResp.error);
    }
    return [];
  }

  const sums = new Map<string, number>();
  for (const t of txResp.data ?? []) {
    sums.set(t.user_id, (sums.get(t.user_id) ?? 0) + (t.amount ?? 0));
  }
  const top = [...sums.entries()]
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n);
  if (top.length === 0) return [];

  const ids = top.map(([id]) => id);
  const [users, childMap, classMap] = await Promise.all([
    (
      supabase.from("app_users" as never) as unknown as {
        select: (c: string) => {
          in: (
            k: string,
            v: string[]
          ) => Promise<SbResp<{ id: string; parent_name: string | null }>>;
        };
      }
    )
      .select("id, parent_name")
      .in("id", ids) as Promise<
      SbResp<{ id: string; parent_name: string | null }>
    >,
    loadChildNamesByUserIds(ids),
    loadPrimaryClassByUserIds(ids),
  ]);

  const parentById = new Map(
    (users.data ?? []).map((u) => [u.id, u.parent_name ?? ""])
  );

  return top.map(([userId, acorns], idx) => {
    const childNames = childMap.get(userId) ?? [];
    const familyLabel =
      childNames.length > 0
        ? `${childNames.join("·")} 가족`
        : `${parentById.get(userId) || "보호자"}님`;
    return {
      userId,
      rank: idx + 1,
      familyLabel,
      className: classMap.get(userId) ?? null,
      acorns,
    };
  });
}
