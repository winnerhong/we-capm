// 기관 포털용 미션 제출 이력 CSV 내보내기.
// 조건: 기관 세션 필수 + 경로의 orgId 와 세션 orgId 일치 확인.
// 쿼리: ?status=approved|pending|rejected|all (기본 approved)
//       ?days=30 (기본 30일)
// 컬럼: 제출시각, 보호자명, 자녀명, 미션명, 미션 종류(kind), 상태,
//       지급 도토리, 리뷰시각, 반려사유, 팩명

import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  toCSV,
  csvResponse,
  formatDateKR,
  todayISO,
} from "@/lib/csv-export";
import { requireOrg } from "@/lib/org-auth-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type StatusFilter = "approved" | "pending" | "rejected" | "all";

function parseStatus(raw: string | null): StatusFilter {
  if (raw === "pending" || raw === "rejected" || raw === "all") return raw;
  return "approved";
}

function statusSet(f: StatusFilter): string[] | null {
  if (f === "approved") return ["APPROVED", "AUTO_APPROVED"];
  if (f === "pending") return ["PENDING_REVIEW", "SUBMITTED"];
  if (f === "rejected") return ["REJECTED"];
  return null; // all
}

function statusLabel(s: string): string {
  if (s === "APPROVED") return "승인";
  if (s === "AUTO_APPROVED") return "자동승인";
  if (s === "PENDING_REVIEW") return "대기";
  if (s === "SUBMITTED") return "제출";
  if (s === "REJECTED") return "반려";
  if (s === "REVOKED") return "취소";
  return s;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const { orgId } = await params;

  try {
    const session = await requireOrg();
    if (session.orgId !== orgId) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 403 });
  }

  const statusFilter = parseStatus(req.nextUrl.searchParams.get("status"));
  const daysRaw = Number(req.nextUrl.searchParams.get("days") ?? "30");
  const days =
    Number.isFinite(daysRaw) && daysRaw > 0 && daysRaw <= 365 ? daysRaw : 30;
  const sinceISO = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const supabase = await createClient();

  // 1) 기관명 (파일명용)
  const orgResp = (await (
    supabase.from("partner_orgs" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          maybeSingle: () => Promise<{ data: { org_name: string } | null }>;
        };
      };
    }
  )
    .select("org_name")
    .eq("id", orgId)
    .maybeSingle()) as { data: { org_name: string } | null };
  const orgName = orgResp.data?.org_name ?? "기관";

  // 2) 이 기관의 org_missions → id 맵
  type MissionMeta = {
    id: string;
    title: string;
    kind: string;
    icon: string | null;
    quest_pack_id: string | null;
    acorns: number;
  };
  const missionsResp = (await (
    supabase.from("org_missions" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => Promise<{ data: MissionMeta[] | null }>;
      };
    }
  )
    .select("id, title, kind, icon, quest_pack_id, acorns")
    .eq("org_id", orgId)) as { data: MissionMeta[] | null };

  const missions = missionsResp.data ?? [];
  const missionMap = new Map<string, MissionMeta>();
  for (const m of missions) missionMap.set(m.id, m);
  const missionIds = missions.map((m) => m.id);

  if (missionIds.length === 0) {
    const csv = toCSV([], [
      { key: "submitted_at", label: "제출시각" },
      { key: "parent_name", label: "보호자명" },
      { key: "child_name", label: "자녀명" },
      { key: "mission_title", label: "미션명" },
      { key: "kind", label: "미션 종류" },
      { key: "status", label: "상태" },
      { key: "awarded_acorns", label: "지급 도토리" },
      { key: "reviewed_at", label: "리뷰시각" },
      { key: "reject_reason", label: "반려사유" },
      { key: "pack_name", label: "팩명" },
    ]);
    return csvResponse(csv, `submissions_${orgName}_${todayISO()}.csv`);
  }

  // 3) mission_submissions — org_mission_id IN + status + 기간 필터
  type SubRow = {
    id: string;
    org_mission_id: string;
    user_id: string;
    child_id: string | null;
    status: string;
    awarded_acorns: number | null;
    reviewed_at: string | null;
    reject_reason: string | null;
    submitted_at: string;
  };

  const allowedStatuses = statusSet(statusFilter);
  type BaseBuilder = {
    in: (k: string, v: string[]) => BaseBuilder;
    gte: (k: string, v: string) => BaseBuilder;
    order: (
      c: string,
      o: { ascending: boolean }
    ) => Promise<{ data: SubRow[] | null }>;
  };
  let subQuery = (
    supabase.from("mission_submissions" as never) as unknown as {
      select: (c: string) => BaseBuilder;
    }
  )
    .select(
      "id, org_mission_id, user_id, child_id, status, awarded_acorns, reviewed_at, reject_reason, submitted_at"
    )
    .in("org_mission_id", missionIds)
    .gte("submitted_at", sinceISO);
  if (allowedStatuses) subQuery = subQuery.in("status", allowedStatuses);
  const subsResp = (await subQuery.order("submitted_at", {
    ascending: false,
  })) as { data: SubRow[] | null };
  const submissions = subsResp.data ?? [];

  // 4) 배치 조회: 보호자명, 자녀명, 팩명
  const userIds = Array.from(new Set(submissions.map((s) => s.user_id)));
  const childIds = Array.from(
    new Set(submissions.map((s) => s.child_id).filter((v): v is string => !!v))
  );
  const packIds = Array.from(
    new Set(
      submissions
        .map((s) => missionMap.get(s.org_mission_id)?.quest_pack_id ?? null)
        .filter((v): v is string => !!v)
    )
  );

  const userMap = new Map<string, string>();
  if (userIds.length > 0) {
    const uResp = (await (
      supabase.from("app_users" as never) as unknown as {
        select: (c: string) => {
          in: (
            k: string,
            v: string[]
          ) => Promise<{
            data: Array<{ id: string; parent_name: string | null }> | null;
          }>;
        };
      }
    )
      .select("id, parent_name")
      .in("id", userIds)) as {
      data: Array<{ id: string; parent_name: string | null }> | null;
    };
    for (const u of uResp.data ?? []) {
      userMap.set(u.id, u.parent_name ?? "");
    }
  }

  const childMap = new Map<string, string>();
  if (childIds.length > 0) {
    const cResp = (await (
      supabase.from("app_children" as never) as unknown as {
        select: (c: string) => {
          in: (
            k: string,
            v: string[]
          ) => Promise<{
            data: Array<{ id: string; name: string }> | null;
          }>;
        };
      }
    )
      .select("id, name")
      .in("id", childIds)) as {
      data: Array<{ id: string; name: string }> | null;
    };
    for (const c of cResp.data ?? []) childMap.set(c.id, c.name);
  }

  const packMap = new Map<string, string>();
  if (packIds.length > 0) {
    const pResp = (await (
      supabase.from("org_quest_packs" as never) as unknown as {
        select: (c: string) => {
          in: (
            k: string,
            v: string[]
          ) => Promise<{
            data: Array<{ id: string; name: string }> | null;
          }>;
        };
      }
    )
      .select("id, name")
      .in("id", packIds)) as {
      data: Array<{ id: string; name: string }> | null;
    };
    for (const p of pResp.data ?? []) packMap.set(p.id, p.name);
  }

  type Row = {
    submitted_at: string;
    parent_name: string;
    child_name: string;
    mission_title: string;
    kind: string;
    status: string;
    awarded_acorns: string;
    reviewed_at: string;
    reject_reason: string;
    pack_name: string;
  };

  const rows: Row[] = submissions.map((s) => {
    const mission = missionMap.get(s.org_mission_id);
    const packName = mission?.quest_pack_id
      ? packMap.get(mission.quest_pack_id) ?? ""
      : "";
    return {
      submitted_at: formatDateKR(s.submitted_at),
      parent_name: userMap.get(s.user_id) ?? "",
      child_name: s.child_id ? childMap.get(s.child_id) ?? "" : "",
      mission_title: mission?.title ?? "",
      kind: mission?.kind ?? "",
      status: statusLabel(s.status),
      awarded_acorns: String(s.awarded_acorns ?? 0),
      reviewed_at: formatDateKR(s.reviewed_at),
      reject_reason: s.reject_reason ?? "",
      pack_name: packName,
    };
  });

  const csv = toCSV<Row>(rows, [
    { key: "submitted_at", label: "제출시각" },
    { key: "parent_name", label: "보호자명" },
    { key: "child_name", label: "자녀명" },
    { key: "mission_title", label: "미션명" },
    { key: "kind", label: "미션 종류" },
    { key: "status", label: "상태" },
    { key: "awarded_acorns", label: "지급 도토리" },
    { key: "reviewed_at", label: "리뷰시각" },
    { key: "reject_reason", label: "반려사유" },
    { key: "pack_name", label: "팩명" },
  ]);

  return csvResponse(
    csv,
    `submissions_${orgName}_${statusFilter}_${days}d_${todayISO()}.csv`
  );
}
