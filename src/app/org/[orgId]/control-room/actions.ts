"use server";

// 관제실 액션 — 사진 월에서 부적절한 사진을 운영자가 제거.
//
// 정책:
//  - 하드 삭제 대신 status='REVOKED' 로 마킹 (audit 보존).
//  - loadPhotoWall 쿼리가 REVOKED 를 제외하므로 사진 월에서 즉시 사라짐.
//  - 도토리 회수는 별도 로직 없음 (이미 지급된 도토리는 유지).

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireOrg } from "@/lib/org-auth-guard";
import {
  loadPendingReviews,
  type ReviewSubmissionItem,
} from "@/lib/missions/review-queries";
import { resignSubmissionPhotoUrls } from "@/lib/missions/resign-photos";

type SbErr = { message: string } | null;

/**
 * 관제실 인라인 검수 모달용 — pending 큐 전체를 한 번에 로드.
 *  - payload 안의 사진 URL (photo_urls / shared_photo_url / content)
 *    을 모두 모아 admin client 로 일괄 재서명 (signed URL 24h 만료 대응).
 *  - 모달 마운트 시 호출하고 결과 큐를 client state 로 들고 있다가
 *    승인/반려 처리하면 큐에서 제거.
 */
export async function loadPendingReviewsForControlRoomAction(): Promise<
  { ok: true; items: ReviewSubmissionItem[] } | { ok: false; error: string }
> {
  try {
    const session = await requireOrg();
    const items = await loadPendingReviews(session.orgId);

    // payload 내 사진 URL 위치 평탄화 → 한 번에 resign → 같은 자리 교체
    type Plan =
      | { kind: "photo_urls"; itemIdx: number; arrIdx: number }
      | { kind: "shared_photo_url"; itemIdx: number }
      | { kind: "content"; itemIdx: number };
    const plans: Plan[] = [];
    const urls: string[] = [];

    for (let i = 0; i < items.length; i++) {
      const payload = items[i].payload as {
        photo_urls?: unknown;
        shared_photo_url?: unknown;
        content?: unknown;
        content_type?: unknown;
      };
      // photo_urls: string[]
      if (Array.isArray(payload.photo_urls)) {
        for (let j = 0; j < payload.photo_urls.length; j++) {
          const u = payload.photo_urls[j];
          if (typeof u === "string" && u) {
            plans.push({ kind: "photo_urls", itemIdx: i, arrIdx: j });
            urls.push(u);
          }
        }
      }
      // COOP: shared_photo_url
      if (
        typeof payload.shared_photo_url === "string" &&
        payload.shared_photo_url
      ) {
        plans.push({ kind: "shared_photo_url", itemIdx: i });
        urls.push(payload.shared_photo_url);
      }
      // BROADCAST: content_type=PHOTO 일 때 content 가 사진 URL
      if (
        payload.content_type === "PHOTO" &&
        typeof payload.content === "string" &&
        payload.content
      ) {
        plans.push({ kind: "content", itemIdx: i });
        urls.push(payload.content);
      }
    }

    if (urls.length > 0) {
      const fresh = await resignSubmissionPhotoUrls(urls);
      for (let k = 0; k < plans.length; k++) {
        const p = plans[k];
        const payload = items[p.itemIdx].payload as {
          photo_urls?: string[];
          shared_photo_url?: string;
          content?: string;
        };
        if (
          p.kind === "photo_urls" &&
          Array.isArray(payload.photo_urls)
        ) {
          payload.photo_urls[p.arrIdx] = fresh[k];
        } else if (p.kind === "shared_photo_url") {
          payload.shared_photo_url = fresh[k];
        } else if (p.kind === "content") {
          payload.content = fresh[k];
        }
      }
    }

    return { ok: true, items };
  } catch (e) {
    console.error("[control-room/loadPendingReviews] threw", e);
    return {
      ok: false,
      error: e instanceof Error ? e.message : "큐를 불러오지 못했어요",
    };
  }
}

export async function deletePhotoFromWallAction(
  submissionId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!submissionId) return { ok: false, error: "잘못된 요청이에요" };

  const session = await requireOrg();
  const supabase = await createClient();

  // 1) 제출이 우리 기관의 미션인지 검증 — 다른 기관 사진을 지우지 못하게.
  const subResp = (await (
    supabase.from("mission_submissions" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          maybeSingle: () => Promise<{
            data: { id: string; org_mission_id: string } | null;
            error: SbErr;
          }>;
        };
      };
    }
  )
    .select("id, org_mission_id")
    .eq("id", submissionId)
    .maybeSingle()) as {
    data: { id: string; org_mission_id: string } | null;
    error: SbErr;
  };

  if (subResp.error) {
    console.error("[control-room/deletePhoto] sub lookup", subResp.error);
    return { ok: false, error: "사진을 찾을 수 없어요" };
  }
  if (!subResp.data) return { ok: false, error: "이미 삭제된 사진이에요" };

  const missionResp = (await (
    supabase.from("org_missions" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          maybeSingle: () => Promise<{
            data: { org_id: string } | null;
            error: SbErr;
          }>;
        };
      };
    }
  )
    .select("org_id")
    .eq("id", subResp.data.org_mission_id)
    .maybeSingle()) as {
    data: { org_id: string } | null;
    error: SbErr;
  };

  if (missionResp.error || !missionResp.data) {
    return { ok: false, error: "미션 정보를 찾을 수 없어요" };
  }
  if (missionResp.data.org_id !== session.orgId) {
    return { ok: false, error: "다른 기관의 사진은 삭제할 수 없어요" };
  }

  // 2) REVOKED 로 마킹.
  const upd = (await (
    supabase.from("mission_submissions" as never) as unknown as {
      update: (r: Record<string, unknown>) => {
        eq: (k: string, v: string) => Promise<{ error: SbErr }>;
      };
    }
  )
    .update({ status: "REVOKED" })
    .eq("id", submissionId)) as { error: SbErr };

  if (upd.error) {
    console.error("[control-room/deletePhoto] update", upd.error);
    return { ok: false, error: "삭제에 실패했어요" };
  }

  revalidatePath(`/org/${session.orgId}/control-room`);
  revalidatePath(`/org/${session.orgId}/control-room/tv`);
  return { ok: true };
}
