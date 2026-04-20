"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requirePartner } from "@/lib/auth-guard";
import { logAccess } from "@/lib/audit-log";

/**
 * 파트너 계약 해지 (PIPA 제36조 + 계약 해지)
 * - 삭제 대신 status=CLOSED 로 마감 (세금계산서 · 정산 이력 보존 필요)
 * - 쿠키 삭제, 감사 로그 기록
 */
export async function closePartnerAccountAction(formData: FormData) {
  const partner = await requirePartner();

  const confirm = String(formData.get("confirm") ?? "");
  if (confirm !== "해지합니다") {
    throw new Error("확인 문구를 정확히 입력해 주세요");
  }

  const reason = String(formData.get("reason") ?? "").trim() || null;

  const supabase = await createClient();

  const { error } = await (
    supabase.from("partners") as unknown as {
      update: (p: unknown) => {
        eq: (k: string, v: string) => Promise<{
          error: { message: string } | null;
        }>;
      };
    }
  )
    .update({ status: "CLOSED" } as never)
    .eq("id", partner.id);

  if (error) throw new Error(`계정 해지 실패: ${error.message}`);

  await logAccess(supabase, {
    user_type: "PARTNER",
    user_id: partner.id,
    user_identifier: partner.username,
    action: "CLOSE_PARTNER_ACCOUNT",
    resource: reason ? `reason:${reason}` : undefined,
  });

  const cookieStore = await cookies();
  cookieStore.delete("campnic_partner");
  redirect("/partner?closed=1");
}
