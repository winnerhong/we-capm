// server-only: @/lib/supabase/server 참조 → 클라이언트 번들 금지.
// 사용자 선물함(user_gifts) — SSR 데이터 로더.

import { createClient } from "@/lib/supabase/server";
import type {
  GiftSourceType,
  GiftStatus,
  UserGiftRow,
} from "@/lib/gifts/types";

type SbResp<T> = { data: T[] | null; error: unknown };
type SbRespOne<T> = { data: T | null; error: unknown };

/* -------------------------------------------------------------------------- */
/* 사용자(참가자) 입장                                                          */
/* -------------------------------------------------------------------------- */

/**
 * 한 사용자가 받은 모든 선물.
 *  - status 별 우선순위(pending → redeemed → expired/cancelled), 동일 status 내 granted_at DESC.
 *  - DB ORDER 로 status enum 우선순위를 못 줘서 JS 에서 2차 정렬.
 */
const GIFT_STATUS_ORDER: Record<GiftStatus, number> = {
  pending: 0,
  redeemed: 1,
  expired: 2,
  cancelled: 3,
};

export async function loadUserGifts(userId: string): Promise<UserGiftRow[]> {
  if (!userId) return [];
  const supabase = await createClient();
  const resp = (await (
    supabase.from("user_gifts" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          order: (
            c: string,
            o: { ascending: boolean }
          ) => Promise<SbResp<UserGiftRow>>;
        };
      };
    }
  )
    .select("*")
    .eq("user_id", userId)
    .order("granted_at", { ascending: false })) as SbResp<UserGiftRow>;
  const rows = resp.data ?? [];
  return rows.slice().sort((a, b) => {
    const sa = GIFT_STATUS_ORDER[a.status] ?? 99;
    const sb = GIFT_STATUS_ORDER[b.status] ?? 99;
    if (sa !== sb) return sa - sb;
    // 동일 status 내 granted_at DESC
    return new Date(b.granted_at).getTime() - new Date(a.granted_at).getTime();
  });
}

/**
 * 한 사용자의 선물 단건 조회 (본인 소유 검증 포함).
 *  - giftId 의 user_id 가 userId 와 다르면 null 반환.
 */
export async function loadUserGift(
  userId: string,
  giftId: string
): Promise<UserGiftRow | null> {
  if (!userId || !giftId) return null;
  const supabase = await createClient();
  const resp = (await (
    supabase.from("user_gifts" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          eq: (k: string, v: string) => {
            maybeSingle: () => Promise<SbRespOne<UserGiftRow>>;
          };
        };
      };
    }
  )
    .select("*")
    .eq("id", giftId)
    .eq("user_id", userId)
    .maybeSingle()) as SbRespOne<UserGiftRow>;
  return resp.data ?? null;
}

/* -------------------------------------------------------------------------- */
/* 매장 직원 / 기관 입장                                                        */
/* -------------------------------------------------------------------------- */

/**
 * 쿠폰 코드로 선물 단건 조회 — 매장 QR 스캔 후 redeem 전 검증용.
 *  - couponCode 는 호출 측에서 normalize (대문자 + dash 제거) 후 넘겨야 함.
 */
export async function loadGiftByCouponCode(
  couponCode: string
): Promise<UserGiftRow | null> {
  if (!couponCode) return null;
  const supabase = await createClient();
  const resp = (await (
    supabase.from("user_gifts" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          maybeSingle: () => Promise<SbRespOne<UserGiftRow>>;
        };
      };
    }
  )
    .select("*")
    .eq("coupon_code", couponCode)
    .maybeSingle()) as SbRespOne<UserGiftRow>;
  return resp.data ?? null;
}

/**
 * 기관(org)이 발급한 선물 목록 — granted_at DESC.
 *  - opts.status / opts.sourceType / opts.limit 로 필터 가능.
 */
export async function loadOrgGifts(
  orgId: string,
  opts?: {
    status?: GiftStatus;
    sourceType?: GiftSourceType;
    limit?: number;
  }
): Promise<UserGiftRow[]> {
  if (!orgId) return [];
  const supabase = await createClient();

  // 빌더 체인 시그니처가 분기마다 달라져 cast 양식을 단순화.
  // .eq() / .order() / .limit() 추가시마다 타입은 같은 형태로 유지된다고 가정.
  type Builder = {
    eq: (k: string, v: string) => Builder;
    order: (c: string, o: { ascending: boolean }) => Builder;
    limit: (n: number) => Builder;
    then: <R>(
      onfulfilled: (v: SbResp<UserGiftRow>) => R | PromiseLike<R>
    ) => Promise<R>;
  };

  let q = (
    supabase.from("user_gifts" as never) as unknown as {
      select: (c: string) => Builder;
    }
  )
    .select("*")
    .eq("org_id", orgId);

  if (opts?.status) q = q.eq("status", opts.status);
  if (opts?.sourceType) q = q.eq("source_type", opts.sourceType);

  q = q.order("granted_at", { ascending: false });
  if (typeof opts?.limit === "number" && opts.limit > 0) {
    q = q.limit(Math.floor(opts.limit));
  }

  const resp = (await (q as unknown as Promise<SbResp<UserGiftRow>>));
  return resp.data ?? [];
}
