// server-only: 행사에 참가하는 아동만 골라내기.
//
// app_children 은 계정 단위(사람)라 "우리 아이 4명"이 어느 기관 화면에서든
// 그대로 떴다. 참좋은어린이집 원생 4명이 도원센트럴 행사 화면에 뜨는 식이다.
// 행사 화면은 그 행사에 실제로 참가하는 아이만 보여준다.
//
// 폴백 정책 (둘 다 "예전 동작 유지" 방향):
//   · 테이블이 아직 없으면(마이그레이션 미적용) → 전체 자녀
//   · 연결이 하나도 없으면(그 행사에 아직 아무도 지정 안 됨) → 전체 자녀
//   자녀가 통째로 사라지는 화면을 만들지 않는 게 우선이다.

import "server-only";
import { createClient } from "@/lib/supabase/server";
import { loadChildrenForUser } from "@/lib/app-user/queries";
import type { AppChildRow } from "@/lib/app-user/queries";

type SbResp<T> = { data: T[] | null; error: unknown };

function isMissingTable(error: unknown): boolean {
  const code = (error as { code?: string } | null)?.code;
  return code === "42P01" || code === "PGRST205";
}

/**
 * 이 행사에 참가하는 아동. 지정이 없으면 보호자의 전체 자녀로 폴백.
 */
export async function loadChildrenForEvent(
  userId: string,
  eventId: string
): Promise<AppChildRow[]> {
  if (!userId) return [];
  const all = await loadChildrenForUser(userId).catch(() => []);
  if (!eventId || all.length === 0) return all;

  const supabase = await createClient();
  const resp = (await (
    supabase.from("org_event_participant_children" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          eq: (k: string, v: string) => Promise<SbResp<{ child_id: string }>>;
        };
      };
    }
  )
    .select("child_id")
    .eq("event_id", eventId)
    .eq("user_id", userId)) as SbResp<{ child_id: string }>;

  if (resp.error) {
    if (!isMissingTable(resp.error)) {
      console.error("[event-children] load error", resp.error);
    }
    return all;
  }

  const picked = new Set((resp.data ?? []).map((r) => r.child_id));
  if (picked.size === 0) return all; // 아직 지정 전 — 전체로 보여준다
  return all.filter((c) => picked.has(c.id));
}
