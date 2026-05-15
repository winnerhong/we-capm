// server-only: admin client 로 사설 버킷 signed URL 을 재서명.
// 미션 사진은 24시간 만료 — 결과 화면 / 사진 월 등에서 표시 직전 재서명 필요.

import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

const SUBMISSION_BUCKET = "submission-photos";
const MARKER = `/storage/v1/object/sign/${SUBMISSION_BUCKET}/`;
const TTL_SECONDS = 60 * 60 * 6; // 6시간 — 페이지 한 세션 충분

/**
 * Supabase signed URL 배열을 재서명해 fresh 한 URL 로 교체.
 *  - submission-photos 버킷의 sign URL 만 처리 (그 외는 원본 유지)
 *  - 재서명 실패해도 원본 그대로 (best-effort)
 *  - 같은 순서로 반환
 */
export async function resignSubmissionPhotoUrls(
  urls: string[]
): Promise<string[]> {
  if (urls.length === 0) return [];

  type Plan = { idx: number; path: string };
  const plans: Plan[] = [];
  for (let i = 0; i < urls.length; i++) {
    const u = urls[i];
    if (!u) continue;
    try {
      const parsed = new URL(u);
      const at = parsed.pathname.indexOf(MARKER);
      if (at < 0) continue; // 비 Supabase signed URL — 원본 유지
      const path = decodeURIComponent(parsed.pathname.slice(at + MARKER.length));
      if (path) plans.push({ idx: i, path });
    } catch {
      /* invalid URL — skip */
    }
  }

  if (plans.length === 0) return urls;

  const out = [...urls];
  try {
    const admin = createAdminClient();
    const { data: signed } = await admin.storage
      .from(SUBMISSION_BUCKET)
      .createSignedUrls(
        plans.map((p) => p.path),
        TTL_SECONDS
      );
    const signedArr = (signed ?? []) as Array<{
      path?: string;
      signedUrl?: string;
      error?: string | null;
    }>;
    for (let i = 0; i < plans.length; i++) {
      const fresh = signedArr[i]?.signedUrl;
      if (fresh) out[plans[i].idx] = fresh;
    }
  } catch (e) {
    console.error("[resignSubmissionPhotoUrls] threw", e);
  }
  return out;
}
