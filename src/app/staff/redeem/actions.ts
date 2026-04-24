"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/staff-auth";
import { loadFinalRedemptionByToken } from "@/lib/missions/queries";

type Row = Record<string, unknown>;

/**
 * 스태프가 QR을 스캔/입력했을 때 호출.
 * 검증/갱신은 verify 페이지에서 하므로 여기선 토큰 정규화 + redirect만.
 */
export async function lookupRedemptionAction(
  tokenRaw: string
): Promise<void> {
  await requireStaff();
  const token = String(tokenRaw ?? "").trim();
  if (!token) {
    redirect("/staff/redeem?err=empty");
  }
  // URL 인코딩 방어
  redirect(`/staff/redeem/verify/${encodeURIComponent(token)}`);
}

/**
 * 교환 완료 확정. redeemed_at IS NULL 조건으로 멱등.
 */
export async function confirmRedemptionAction(
  token: string,
  staffNameOverride?: string
): Promise<void> {
  const staff = await requireStaff();
  const cleanToken = String(token ?? "").trim();
  if (!cleanToken) throw new Error("토큰이 비어 있어요");

  const redemption = await loadFinalRedemptionByToken(cleanToken);
  if (!redemption) throw new Error("유효하지 않은 교환권이에요");
  if (redemption.redeemed_at) throw new Error("이미 교환된 교환권이에요");
  if (new Date(redemption.expires_at).getTime() <= Date.now()) {
    throw new Error("만료된 교환권이에요");
  }

  const byName =
    (staffNameOverride && staffNameOverride.trim()) ||
    `${staff.type === "PARTNER" ? "파트너" : "기관"} · ${staff.name}`;

  const supabase = await createClient();

  // UPDATE … WHERE qr_token = ? AND redeemed_at IS NULL
  // supabase-js 의 `.is("redeemed_at", null)` 사용 (update 체인 타입은 loose cast)
  const resp = (await (
    supabase.from("mission_final_redemptions" as never) as unknown as {
      update: (p: Row) => {
        eq: (k: string, v: string) => {
          is: (k: string, v: null) => Promise<{
            error: { message: string } | null;
          }>;
        };
      };
    }
  )
    .update({
      redeemed_at: new Date().toISOString(),
      redeemed_by: byName,
    } satisfies Row)
    .eq("qr_token", cleanToken)
    .is("redeemed_at", null)) as {
    error: { message: string } | null;
  };

  if (resp.error) {
    console.error("[staff/redeem/confirm] update error", resp.error);
    throw new Error(`교환 확정 실패: ${resp.error.message}`);
  }

  revalidatePath("/staff/redeem");
  revalidatePath(`/staff/redeem/verify/${cleanToken}`);
  redirect("/staff/redeem?ok=1");
}
