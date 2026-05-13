"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireOrg } from "@/lib/org-auth-guard";

type Row = Record<string, unknown>;

function clamp(raw: unknown, max: number): string | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;
  return s.slice(0, max);
}

/** "https://..." / "http://..." / "/..." 만 허용. 빈 값 가능. */
function sanitizeUrl(raw: unknown): string | null {
  const s = clamp(raw, 500);
  if (!s) return null;
  if (s.startsWith("https://") || s.startsWith("http://") || s.startsWith("/")) {
    return s;
  }
  // 사용자가 호스트만 입력한 경우 https:// 자동 prefix
  return `https://${s.replace(/^\/+/, "")}`;
}

/**
 * 기관 하단 홈페이지 배너 설정 저장.
 * - 모든 필드 빈 값 가능 (필드가 NULL 이면 표시 측에서 자동 숨김).
 * - silent fail: 컬럼 누락(마이그레이션 미실행) 시에도 에러 throw X.
 */
export async function updateHomepageBannerAction(
  orgId: string,
  formData: FormData
): Promise<{ ok: boolean; error?: string }> {
  try {
    const org = await requireOrg();
    if (org.orgId !== orgId) return { ok: false, error: "권한이 없어요" };

    const text = clamp(formData.get("homepage_banner_text"), 200);
    const url = sanitizeUrl(formData.get("homepage_banner_url"));
    const imageUrl = sanitizeUrl(formData.get("homepage_banner_image_url"));

    const supabase = await createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any;
    const { error } = await sb
      .from("partner_orgs")
      .update({
        homepage_banner_text: text,
        homepage_banner_url: url,
        homepage_banner_image_url: imageUrl,
      } as Row)
      .eq("id", orgId);

    if (error) {
      console.error("[homepage-banner/update] err", error.message);
      return { ok: false, error: error.message };
    }

    revalidatePath(`/org/${orgId}/invitations`);
    revalidatePath(`/org/${orgId}`);
    // 참가자 측 — layout / invitation 페이지에 배너가 노출되므로 광범위하게.
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    console.error("[homepage-banner/update] throw", e);
    return {
      ok: false,
      error: e instanceof Error ? e.message : "저장 실패",
    };
  }
}
