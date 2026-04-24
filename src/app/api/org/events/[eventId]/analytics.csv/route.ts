// 행사 참가자별 성과 CSV 내보내기 — org 세션 검증 + 소유권 체크 후 stream.
// 컬럼: 순위, 보호자명, 총 제출, 승인, 대기, 반려, 획득 도토리

import { NextResponse } from "next/server";
import { requireOrg } from "@/lib/org-auth-guard";
import { createClient } from "@/lib/supabase/server";
import { loadOrgEventById } from "@/lib/org-events/queries";

type SubmissionRow = {
  user_id: string;
  status: "APPROVED" | "PENDING" | "REJECTED" | "REVOKED" | string;
  awarded_acorns: number | null;
  org_mission_id: string;
};
type MissionRow = { id: string; quest_pack_id: string | null };
type UserRow = { id: string; parent_name: string | null };

function csvEscape(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId } = await params;
  const org = await requireOrg();

  const event = await loadOrgEventById(eventId);
  if (!event || event.org_id !== org.orgId) {
    return new NextResponse("행사를 찾을 수 없거나 권한이 없습니다", {
      status: 404,
    });
  }

  const supabase = await createClient();

  // 1) 이 행사 참가자 ids
  const partResp = (await (
    supabase.from("org_event_participants" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => Promise<{
          data: Array<{ user_id: string }> | null;
        }>;
      };
    }
  )
    .select("user_id")
    .eq("event_id", eventId)) as {
    data: Array<{ user_id: string }> | null;
  };
  const userIds = (partResp.data ?? []).map((r) => r.user_id);

  if (userIds.length === 0) {
    const empty =
      "순위,보호자명,총 제출,승인,대기,반려,획득 도토리\n(참가자 없음)\n";
    return csvResponse(empty, event.name);
  }

  // 2) 이 행사 스탬프북들 → 미션 ids
  const packResp = (await (
    supabase.from("org_event_quest_packs" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => Promise<{
          data: Array<{ quest_pack_id: string }> | null;
        }>;
      };
    }
  )
    .select("quest_pack_id")
    .eq("event_id", eventId)) as {
    data: Array<{ quest_pack_id: string }> | null;
  };
  const packIds = (packResp.data ?? []).map((r) => r.quest_pack_id);

  let missionIds: string[] = [];
  if (packIds.length > 0) {
    const mResp = (await (
      supabase.from("org_missions" as never) as unknown as {
        select: (c: string) => {
          in: (k: string, v: string[]) => Promise<{
            data: MissionRow[] | null;
          }>;
        };
      }
    )
      .select("id, quest_pack_id")
      .in("quest_pack_id", packIds)) as { data: MissionRow[] | null };
    missionIds = (mResp.data ?? []).map((m) => m.id);
  }

  // 3) 참가자들의 제출 (이 행사 미션 한정)
  let submissions: SubmissionRow[] = [];
  if (missionIds.length > 0) {
    const sResp = (await (
      supabase.from("mission_submissions" as never) as unknown as {
        select: (c: string) => {
          in: (k: string, v: string[]) => {
            in: (k: string, v: string[]) => Promise<{
              data: SubmissionRow[] | null;
            }>;
          };
        };
      }
    )
      .select("user_id, status, awarded_acorns, org_mission_id")
      .in("user_id", userIds)
      .in("org_mission_id", missionIds)) as {
      data: SubmissionRow[] | null;
    };
    submissions = sResp.data ?? [];
  }

  // 4) 참가자 이름 조회
  const uResp = (await (
    supabase.from("app_users" as never) as unknown as {
      select: (c: string) => {
        in: (k: string, v: string[]) => Promise<{
          data: UserRow[] | null;
        }>;
      };
    }
  )
    .select("id, parent_name")
    .in("id", userIds)) as { data: UserRow[] | null };
  const nameMap = new Map<string, string>();
  for (const u of uResp.data ?? []) {
    nameMap.set(u.id, u.parent_name ?? "(이름 없음)");
  }

  // 5) 참가자별 집계
  type Agg = {
    userId: string;
    name: string;
    total: number;
    approved: number;
    pending: number;
    rejected: number;
    acorns: number;
  };
  const aggByUser = new Map<string, Agg>();
  for (const uid of userIds) {
    aggByUser.set(uid, {
      userId: uid,
      name: nameMap.get(uid) ?? "(알수없음)",
      total: 0,
      approved: 0,
      pending: 0,
      rejected: 0,
      acorns: 0,
    });
  }
  for (const s of submissions) {
    if (s.status === "REVOKED") continue;
    const a = aggByUser.get(s.user_id);
    if (!a) continue;
    a.total += 1;
    if (s.status === "APPROVED") a.approved += 1;
    else if (s.status === "PENDING") a.pending += 1;
    else if (s.status === "REJECTED") a.rejected += 1;
    if (s.status === "APPROVED") {
      a.acorns += Number(s.awarded_acorns ?? 0);
    }
  }

  // 6) 정렬: 승인 DESC, 도토리 DESC, 이름 ASC
  const sorted = Array.from(aggByUser.values()).sort((x, y) => {
    if (y.approved !== x.approved) return y.approved - x.approved;
    if (y.acorns !== x.acorns) return y.acorns - x.acorns;
    return x.name.localeCompare(y.name, "ko-KR");
  });

  // 7) CSV 생성 (BOM 포함 — Excel 한글 호환)
  const lines: string[] = [];
  lines.push("순위,보호자명,총 제출,승인,대기,반려,획득 도토리");
  sorted.forEach((a, i) => {
    lines.push(
      [
        i + 1,
        csvEscape(a.name),
        a.total,
        a.approved,
        a.pending,
        a.rejected,
        a.acorns,
      ].join(",")
    );
  });
  const body = "﻿" + lines.join("\n") + "\n";

  return csvResponse(body, event.name);
}

function csvResponse(body: string, eventName: string): NextResponse {
  const safeName = eventName.replace(/[^0-9A-Za-z가-힣_-]+/g, "_").slice(0, 40);
  const filename = `event_${safeName}_analytics.csv`;
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "Cache-Control": "no-store",
    },
  });
}
