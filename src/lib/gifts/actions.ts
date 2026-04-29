"use server";

// 사용자 선물함(user_gifts) — server actions.
// 발급(grant) / 수령(redeem) / 취소(cancel) — 모두 RLS Phase 0 permissive 라
// 일반 supabase server client 만으로 동작. Phase 1 에서 정책 조여지면
// admin client 또는 SECURITY DEFINER RPC 로 전환 검토.
//
// 호출자:
//   grantGiftAction  : src/lib/rps/actions.ts(sendGiftsAction), 미션 보상 등 시스템 발급
//   redeemGiftAction : src/app/org/[orgId]/gifts/redeem (매장 카운터)
//   cancelGiftAction : 기관 발급 현황 페이지

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireOrg } from "@/lib/org-auth-guard";
import {
  COUPON_ALPHABET,
  COUPON_CODE_LENGTH,
  normalizeCouponCode,
  type GiftSourceType,
  type UserGiftRow,
} from "@/lib/gifts/types";

type Row = Record<string, unknown>;
type SbErr = { message: string; code?: string } | null;
type SbRespOne<T> = { data: T | null; error: SbErr };

const DEFAULT_EXPIRES_IN_DAYS = 30;
const COUPON_RETRY_LIMIT = 10;

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * 충돌 없는 coupon_code 생성. 최대 10번 재시도.
 *  - INSERT 시 UNIQUE 제약 위반(23505)을 잡는 것이 1차 보호 → 여기서는
 *    조회 기반 사전 체크로 동시성 충돌을 줄인다(완벽한 동기화는 아님).
 *  - 실제 INSERT 도 23505 retry 로직과 함께 사용해야 안전.
 */
async function generateUniqueCouponCode(): Promise<string> {
  const supabase = await createClient();

  for (let i = 0; i < COUPON_RETRY_LIMIT; i += 1) {
    const code = randomCouponCode();
    const resp = (await (
      supabase.from("user_gifts" as never) as unknown as {
        select: (c: string) => {
          eq: (k: string, v: string) => {
            maybeSingle: () => Promise<SbRespOne<{ id: string }>>;
          };
        };
      }
    )
      .select("id")
      .eq("coupon_code", code)
      .maybeSingle()) as SbRespOne<{ id: string }>;

    if (!resp.data) return code;
  }

  console.error("[gifts/generateUniqueCouponCode] retry exhausted");
  throw new Error("쿠폰 코드 발급에 실패했어요. 잠시 후 다시 시도해 주세요");
}

function randomCouponCode(): string {
  let out = "";
  for (let i = 0; i < COUPON_CODE_LENGTH; i += 1) {
    out += COUPON_ALPHABET.charAt(
      Math.floor(Math.random() * COUPON_ALPHABET.length)
    );
  }
  return out;
}

/* ========================================================================== */
/* 1) grantGiftAction — INTERNAL (다른 도메인에서 호출)                         */
/* ========================================================================== */

/**
 * 선물 발급 — 다른 도메인(rps, missions, lottery 등)에서 호출하는 내부 액션.
 *  - (sourceType, sourceId, userId) 가 모두 주어지고 이미 발급된 row 가 있으면
 *    멱등적으로 기존 row 정보를 반환 (중복 발급 방지).
 *  - sourceId 가 null 이면 멱등 키가 부족 → 항상 새 발급.
 *  - expiresInDays 기본 30일. 0 이하면 만료 없음(null)으로 저장.
 */
export async function grantGiftAction(input: {
  userId: string;
  orgId: string;
  sourceType: GiftSourceType;
  sourceId?: string | null;
  displayName: string;
  giftLabel: string;
  giftUrl?: string | null;
  message?: string | null;
  expiresInDays?: number;
}): Promise<{ giftId: string; couponCode: string; expiresAt: string | null }> {
  const userId = (input.userId ?? "").trim();
  const orgId = (input.orgId ?? "").trim();
  const displayName = (input.displayName ?? "").trim();
  const giftLabel = (input.giftLabel ?? "").trim();
  if (!userId) throw new Error("받는 사람을 찾을 수 없어요");
  if (!orgId) throw new Error("기관 정보를 찾을 수 없어요");
  if (!giftLabel) throw new Error("선물 이름을 입력해 주세요");
  if (!displayName) throw new Error("표시할 이름을 입력해 주세요");

  const sourceId = input.sourceId ?? null;
  const giftUrl = (input.giftUrl ?? "").trim() || null;
  const message = (input.message ?? "").trim() || null;

  const supabase = await createClient();

  // 멱등 가드: (sourceType, sourceId, userId) 트리플로 이미 발급된 row 가 있으면 반환.
  if (sourceId) {
    const dupResp = (await (
      supabase.from("user_gifts" as never) as unknown as {
        select: (c: string) => {
          eq: (k: string, v: string) => {
            eq: (k: string, v: string) => {
              eq: (k: string, v: string) => {
                maybeSingle: () => Promise<SbRespOne<UserGiftRow>>;
              };
            };
          };
        };
      }
    )
      .select("*")
      .eq("source_type", input.sourceType)
      .eq("source_id", sourceId)
      .eq("user_id", userId)
      .maybeSingle()) as SbRespOne<UserGiftRow>;

    if (dupResp.data) {
      return {
        giftId: dupResp.data.id,
        couponCode: dupResp.data.coupon_code,
        expiresAt: dupResp.data.expires_at,
      };
    }
  }

  // 만료일 계산
  const days =
    typeof input.expiresInDays === "number"
      ? Math.floor(input.expiresInDays)
      : DEFAULT_EXPIRES_IN_DAYS;
  const expiresAtIso =
    days > 0
      ? new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()
      : null;

  // 쿠폰 코드 생성 + INSERT — UNIQUE 제약 충돌(23505) 시 최대 N회 재시도.
  let lastErr: SbErr = null;
  for (let attempt = 0; attempt < COUPON_RETRY_LIMIT; attempt += 1) {
    const couponCode = await generateUniqueCouponCode();

    const insResp = (await (
      supabase.from("user_gifts" as never) as unknown as {
        insert: (r: Row) => {
          select: (c: string) => {
            maybeSingle: () => Promise<
              SbRespOne<{ id: string; coupon_code: string }>
            >;
          };
        };
      }
    )
      .insert({
        user_id: userId,
        org_id: orgId,
        source_type: input.sourceType,
        source_id: sourceId,
        display_name: displayName,
        gift_label: giftLabel,
        gift_url: giftUrl,
        message,
        coupon_code: couponCode,
        status: "pending",
        expires_at: expiresAtIso,
      } satisfies Row)
      .select("id, coupon_code")
      .maybeSingle()) as SbRespOne<{ id: string; coupon_code: string }>;

    if (insResp.data?.id) {
      revalidatePath("/gifts");
      revalidatePath(`/org/${orgId}/gifts`);
      revalidatePath(`/org/${orgId}/gifts/redeem`);
      return {
        giftId: insResp.data.id,
        couponCode: insResp.data.coupon_code,
        expiresAt: expiresAtIso,
      };
    }

    lastErr = insResp.error;
    // UNIQUE 충돌 외 에러면 즉시 중단.
    if (insResp.error && insResp.error.code !== "23505") break;
  }

  console.error("[gifts/grantGift] insert failed", { code: lastErr?.code });
  throw new Error("선물 발급에 실패했어요");
}

/* ========================================================================== */
/* 2) redeemGiftAction — STAFF (매장 카운터)                                   */
/* ========================================================================== */

/**
 * 매장에서 QR 스캔 또는 코드 직접 입력으로 수령 처리.
 *  - requireOrg() — 로그인된 기관 staff 만.
 *  - 다른 기관 쿠폰은 거부 ("이 매장에서 사용할 수 없어요").
 *  - 이미 redeemed/cancelled 또는 만료(expires_at < now) 면 적절한 에러.
 *  - 만료 시점에는 status='expired' 로 자동 갱신 후 throw.
 */
export async function redeemGiftAction(input: {
  couponCode: string;
}): Promise<{ gift: UserGiftRow }> {
  const org = await requireOrg();
  const code = normalizeCouponCode(input.couponCode ?? "");
  if (!code || code.length !== COUPON_CODE_LENGTH) {
    throw new Error("쿠폰 코드를 정확히 입력해 주세요");
  }

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
    .eq("coupon_code", code)
    .maybeSingle()) as SbRespOne<UserGiftRow>;

  const gift = resp.data;
  if (!gift) throw new Error("등록되지 않은 쿠폰이에요");

  // 다른 기관 쿠폰
  if (gift.org_id !== org.orgId) {
    throw new Error("이 매장에서 사용할 수 없는 쿠폰이에요");
  }

  // 상태별 사전 체크
  if (gift.status === "redeemed") {
    const at = gift.redeemed_at
      ? new Date(gift.redeemed_at).toLocaleString("ko-KR")
      : "";
    throw new Error(
      at ? `이미 ${at} 에 수령된 선물이에요` : "이미 수령된 선물이에요"
    );
  }
  if (gift.status === "cancelled") {
    throw new Error("취소된 선물이에요");
  }
  if (gift.status === "expired") {
    throw new Error("기간이 만료된 선물이에요");
  }

  // 만료 시점 도달 → expired 로 갱신 후 에러
  if (gift.expires_at && new Date(gift.expires_at).getTime() < Date.now()) {
    await (
      supabase.from("user_gifts" as never) as unknown as {
        update: (p: Row) => {
          eq: (k: string, v: string) => Promise<{ error: SbErr }>;
        };
      }
    )
      .update({ status: "expired" })
      .eq("id", gift.id);
    throw new Error("기간이 만료된 선물이에요");
  }

  // pending → redeemed (조건부 UPDATE 로 동시 redeem 방지)
  const nowIso = new Date().toISOString();
  const updResp = (await (
    supabase.from("user_gifts" as never) as unknown as {
      update: (p: Row) => {
        eq: (k: string, v: string) => {
          eq: (k: string, v: string) => {
            select: (c: string) => {
              maybeSingle: () => Promise<SbRespOne<UserGiftRow>>;
            };
          };
        };
      };
    }
  )
    .update({
      status: "redeemed",
      redeemed_at: nowIso,
      // requireOrg() 의 managerId 는 partner_orgs.auto_username (text)
      // redeemed_by 는 uuid 컬럼이라 매핑 불가 → null 유지.
      // (TODO Phase 1: org_managers.id 같은 uuid 도입 시 채울 것)
      redeemed_by: null,
    })
    .eq("id", gift.id)
    .eq("status", "pending")
    .select("*")
    .maybeSingle()) as SbRespOne<UserGiftRow>;

  if (updResp.error) {
    console.error("[gifts/redeem] update error", { code: updResp.error.code });
    throw new Error("수령 처리에 실패했어요");
  }
  if (!updResp.data) {
    // status='pending' 조건이 안 맞아 0 row update — 동시 처리 충돌
    throw new Error("이미 처리된 선물이에요. 새로고침 후 다시 확인해 주세요");
  }

  revalidatePath("/gifts");
  revalidatePath(`/org/${org.orgId}/gifts`);
  revalidatePath(`/org/${org.orgId}/gifts/redeem`);

  return { gift: updResp.data };
}

/* ========================================================================== */
/* 3) cancelGiftAction — STAFF                                                */
/* ========================================================================== */

/**
 * 발급 취소 — 미수령(pending) 건만 가능.
 *  - requireOrg() + org 일치 검증.
 *  - 이미 redeemed/expired/cancelled 면 거부.
 */
export async function cancelGiftAction(giftId: string): Promise<void> {
  const org = await requireOrg();
  const id = (giftId ?? "").trim();
  if (!id) throw new Error("선물 정보가 없어요");

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
    .eq("id", id)
    .maybeSingle()) as SbRespOne<UserGiftRow>;

  const gift = resp.data;
  if (!gift) throw new Error("선물을 찾을 수 없어요");
  if (gift.org_id !== org.orgId) {
    throw new Error("다른 기관의 선물은 취소할 수 없어요");
  }
  if (gift.status === "redeemed") {
    throw new Error("이미 수령된 선물은 취소할 수 없어요");
  }
  if (gift.status === "cancelled") {
    throw new Error("이미 취소된 선물이에요");
  }
  if (gift.status === "expired") {
    throw new Error("이미 만료된 선물이에요");
  }

  const updResp = (await (
    supabase.from("user_gifts" as never) as unknown as {
      update: (p: Row) => {
        eq: (k: string, v: string) => {
          eq: (k: string, v: string) => Promise<{ error: SbErr }>;
        };
      };
    }
  )
    .update({ status: "cancelled" })
    .eq("id", id)
    .eq("status", "pending")) as { error: SbErr };

  if (updResp.error) {
    console.error("[gifts/cancel] error", { code: updResp.error.code });
    throw new Error("선물 취소에 실패했어요");
  }

  revalidatePath("/gifts");
  revalidatePath(`/org/${org.orgId}/gifts`);
  revalidatePath(`/org/${org.orgId}/gifts/redeem`);
}

