// server-only: admin client 로 사설 버킷 signed URL 을 재서명.
// 미션 사진은 24시간 만료 — 결과 화면 / 사진 월 등에서 표시 직전 재서명 필요.

import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

const SUBMISSION_BUCKET = "submission-photos";
const MARKER = `/storage/v1/object/sign/${SUBMISSION_BUCKET}/`;
const TTL_SECONDS = 60 * 60 * 6; // 6시간 — 페이지 한 세션 충분

/**
 * 한 번 서명한 URL 을 이만큼 재사용한다(만료 6시간의 1/3).
 *
 * 왜 캐시가 필요한가 — 성능 문제가 아니라 **화면이 깜빡이는 문제**다:
 *   createSignedUrls 는 부를 때마다 다른 토큰을 준다. 그래서 서버 컴포넌트가 다시
 *   그려질 때마다 60장의 <img src> 가 전부 바뀌고, 브라우저는 캐시를 못 쓰고 60장을
 *   새로 내려받는다. 하트 한 번 누를 때마다 사진 그리드가 하얗게 비는 이유였다.
 *   같은 문자열을 돌려주면 브라우저가 그냥 쓰던 이미지를 계속 쓴다.
 *
 * 프로세스 메모리라 인스턴스마다 따로 쌓이지만, 한 사람이 한 화면을 보는 동안은
 * 같은 인스턴스에 붙는 일이 대부분이라 그것만으로 깜빡임이 사라진다.
 */
const CACHE_TTL_MS = 1000 * 60 * 60 * 2;
/** 무한정 쌓이지 않게 — 넘으면 통째로 비운다(다음 요청이 다시 채운다). */
const CACHE_MAX = 4000;

const signedCache = new Map<string, { url: string; until: number }>();

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
  const now = Date.now();

  // 아직 살아있는 서명은 그대로 쓴다 — 같은 문자열이어야 브라우저가 다시 안 받는다.
  const misses: Plan[] = [];
  for (const p of plans) {
    const hit = signedCache.get(p.path);
    if (hit && hit.until > now) out[p.idx] = hit.url;
    else misses.push(p);
  }
  if (misses.length === 0) return out;

  try {
    const admin = createAdminClient();
    const { data: signed } = await admin.storage
      .from(SUBMISSION_BUCKET)
      .createSignedUrls(
        misses.map((p) => p.path),
        TTL_SECONDS
      );
    const signedArr = (signed ?? []) as Array<{
      path?: string;
      signedUrl?: string;
      error?: string | null;
    }>;
    if (signedCache.size > CACHE_MAX) signedCache.clear();
    for (let i = 0; i < misses.length; i++) {
      const fresh = signedArr[i]?.signedUrl;
      if (!fresh) continue;
      out[misses[i].idx] = fresh;
      signedCache.set(misses[i].path, {
        url: fresh,
        until: now + CACHE_TTL_MS,
      });
    }
  } catch (e) {
    console.error("[resignSubmissionPhotoUrls] threw", e);
  }
  return out;
}
