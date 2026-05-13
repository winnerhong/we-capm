"use server";

// 지사(partner) 가 자기 기관의 하단 홈페이지 배너를 설정하는 액션.
// - org admin 측 액션(updateHomepageBannerAction) 와 별개.
// - partner.id 가 partner_orgs.partner_id 와 일치하는지 확인 → 소속 기관만 수정 가능.

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requirePartner } from "@/lib/auth-guard";

type Row = Record<string, unknown>;

function clamp(raw: unknown, max: number): string | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;
  return s.slice(0, max);
}

function sanitizeUrl(raw: unknown): string | null {
  const s = clamp(raw, 500);
  if (!s) return null;
  if (s.startsWith("https://") || s.startsWith("http://") || s.startsWith("/")) {
    return s;
  }
  return `https://${s.replace(/^\/+/, "")}`;
}

export async function updatePartnerHomepageBannerAction(
  orgId: string,
  formData: FormData
): Promise<{ ok: boolean; error?: string }> {
  try {
    const partner = await requirePartner();
    if (!orgId) return { ok: false, error: "기관을 찾을 수 없어요" };

    const supabase = await createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any;

    // 1) 소속 기관인지 확인
    const orgResp = await sb
      .from("partner_orgs")
      .select("id, partner_id")
      .eq("id", orgId)
      .maybeSingle();
    const orgRow = orgResp.data as
      | { id: string; partner_id: string }
      | null;
    if (!orgRow) return { ok: false, error: "기관을 찾을 수 없어요" };
    if (orgRow.partner_id !== partner.id) {
      return { ok: false, error: "이 지사 소속 기관이 아니에요" };
    }

    const text = clamp(formData.get("homepage_banner_text"), 200);
    const url = sanitizeUrl(formData.get("homepage_banner_url"));
    const imageUrl = sanitizeUrl(formData.get("homepage_banner_image_url"));

    const { error } = await sb
      .from("partner_orgs")
      .update({
        homepage_banner_text: text,
        homepage_banner_url: url,
        homepage_banner_image_url: imageUrl,
      } as Row)
      .eq("id", orgId);

    if (error) {
      console.error("[partner/homepage-banner] err", error.message);
      return { ok: false, error: error.message };
    }

    revalidatePath("/partner/homepage-banner");
    revalidatePath(`/org/${orgId}/invitations`);
    revalidatePath("/", "layout"); // 참가자 측 layout/invitation 즉시 반영
    return { ok: true };
  } catch (e) {
    console.error("[partner/homepage-banner] throw", e);
    return {
      ok: false,
      error: e instanceof Error ? e.message : "저장 실패",
    };
  }
}
