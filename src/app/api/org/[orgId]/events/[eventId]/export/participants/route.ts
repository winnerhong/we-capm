// 기관 포털용 특정 행사 참가자 CSV 내보내기.
// 조건: 기관 세션 필수 + 경로의 orgId 와 세션 orgId 일치 + event.org_id 일치.
// 컬럼: 보호자명, 연락처, 자녀, 참가일시, 행사 기간 승인 제출 수, 도토리 잔액(전체)
//
// 주의:
// - "도토리 잔액" 은 app_users.acorn_balance (기관 전체 기준) 을 그대로 싣는다.
//   행사 기간/스코프 누적 도토리는 아래 TODO 참고 — 현재 MVP 는 전체 잔액 노출.
// - "승인 제출 수" 는 이 행사 기간(starts_at ~ ends_at) 사이에 이 기관의
//   미션에 대해 APPROVED/AUTO_APPROVED 된 제출을 사용자별로 카운트.
//   starts_at 이 없으면 전체 기간, ends_at 이 없으면 now 까지.

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

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ orgId: string; eventId: string }> }
) {
  const { orgId, eventId } = await params;

  try {
    const session = await requireOrg();
    if (session.orgId !== orgId) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 403 });
  }

  const supabase = await createClient();

  // 1) 행사 로드 + 소유권 확인
  const evResp = (await (
    supabase.from("org_events" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          maybeSingle: () => Promise<{
            data: {
              id: string;
              org_id: string;
              name: string;
              starts_at: string | null;
              ends_at: string | null;
            } | null;
          }>;
        };
      };
    }
  )
    .select("id, org_id, name, starts_at, ends_at")
    .eq("id", eventId)
    .maybeSingle()) as {
    data: {
      id: string;
      org_id: string;
      name: string;
      starts_at: string | null;
      ends_at: string | null;
    } | null;
  };

  const event = evResp.data;
  if (!event || event.org_id !== orgId) {
    return NextResponse.json({ error: "event not found" }, { status: 404 });
  }

  // 2) 참가자 목록
  const partResp = (await (
    supabase.from("org_event_participants" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          order: (
            c: string,
            o: { ascending: boolean }
          ) => Promise<{
            data: Array<{ user_id: string; joined_at: string }> | null;
          }>;
        };
      };
    }
  )
    .select("user_id, joined_at")
    .eq("event_id", eventId)
    .order("joined_at", { ascending: true })) as {
    data: Array<{ user_id: string; joined_at: string }> | null;
  };

  const participants = partResp.data ?? [];
  const userIds = participants.map((p) => p.user_id);

  type Row = {
    parent_name: string;
    phone: string;
    children: string;
    joined_at: string;
    approved_count: string;
    acorn_balance: string;
  };

  if (userIds.length === 0) {
    const csv = toCSV<Row>([], [
      { key: "parent_name", label: "보호자명" },
      { key: "phone", label: "연락처" },
      { key: "children", label: "자녀" },
      { key: "joined_at", label: "참가일시" },
      { key: "approved_count", label: "승인 제출 수" },
      { key: "acorn_balance", label: "도토리 잔액(전체)" },
    ]);
    return csvResponse(
      csv,
      `event_${event.name}_participants_${todayISO()}.csv`
    );
  }

  // 3) 보호자 기본 정보
  const usersResp = (await (
    supabase.from("app_users" as never) as unknown as {
      select: (c: string) => {
        in: (k: string, v: string[]) => Promise<{
          data: Array<{
            id: string;
            parent_name: string | null;
            phone: string;
            acorn_balance: number;
          }> | null;
        }>;
      };
    }
  )
    .select("id, parent_name, phone, acorn_balance")
    .in("id", userIds)) as {
    data: Array<{
      id: string;
      parent_name: string | null;
      phone: string;
      acorn_balance: number;
    }> | null;
  };
  const userMap = new Map<
    string,
    { parent_name: string; phone: string; acorn_balance: number }
  >();
  for (const u of usersResp.data ?? []) {
    userMap.set(u.id, {
      parent_name: u.parent_name ?? "",
      phone: u.phone,
      acorn_balance: u.acorn_balance ?? 0,
    });
  }

  // 4) 자녀 정보
  const childMap = new Map<string, string[]>();
  const cResp = (await (
    supabase.from("app_children" as never) as unknown as {
      select: (c: string) => {
        in: (k: string, v: string[]) => Promise<{
          data: Array<{ user_id: string; name: string }> | null;
        }>;
      };
    }
  )
    .select("user_id, name")
    .in("user_id", userIds)) as {
    data: Array<{ user_id: string; name: string }> | null;
  };
  for (const c of cResp.data ?? []) {
    const arr = childMap.get(c.user_id) ?? [];
    arr.push(c.name);
    childMap.set(c.user_id, arr);
  }

  // 5) 이 기관의 미션 ids (제출 카운트 스코프 제한용)
  const missionsResp = (await (
    supabase.from("org_missions" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => Promise<{
          data: Array<{ id: string }> | null;
        }>;
      };
    }
  )
    .select("id")
    .eq("org_id", orgId)) as { data: Array<{ id: string }> | null };
  const missionIds = (missionsResp.data ?? []).map((m) => m.id);

  // 6) 행사 기간 내 APPROVED/AUTO_APPROVED 제출 카운트
  const windowStart = event.starts_at ?? "1970-01-01T00:00:00Z";
  const windowEnd = event.ends_at ?? new Date().toISOString();

  const approvedCountByUser = new Map<string, number>();
  if (missionIds.length > 0) {
    type SubCountRow = { user_id: string };
    type CountBuilder = {
      in: (k: string, v: string[]) => CountBuilder;
      gte: (k: string, v: string) => CountBuilder;
      lte: (k: string, v: string) => Promise<{ data: SubCountRow[] | null }>;
    };
    const sResp = (await (
      (
        supabase.from("mission_submissions" as never) as unknown as {
          select: (c: string) => CountBuilder;
        }
      )
        .select("user_id")
        .in("org_mission_id", missionIds)
        .in("user_id", userIds)
        .in("status", ["APPROVED", "AUTO_APPROVED"])
        .gte("submitted_at", windowStart)
        .lte("submitted_at", windowEnd)
    )) as { data: SubCountRow[] | null };

    for (const s of sResp.data ?? []) {
      approvedCountByUser.set(
        s.user_id,
        (approvedCountByUser.get(s.user_id) ?? 0) + 1
      );
    }
  }

  // 7) 행 생성
  const rows: Row[] = participants.map((p) => {
    const u = userMap.get(p.user_id);
    const children = childMap.get(p.user_id) ?? [];
    return {
      parent_name: u?.parent_name ?? "",
      phone: u?.phone ?? "",
      children: children.join(" / "),
      joined_at: formatDateKR(p.joined_at),
      approved_count: String(approvedCountByUser.get(p.user_id) ?? 0),
      acorn_balance: String(u?.acorn_balance ?? 0),
    };
  });

  const csv = toCSV<Row>(rows, [
    { key: "parent_name", label: "보호자명" },
    { key: "phone", label: "연락처" },
    { key: "children", label: "자녀" },
    { key: "joined_at", label: "참가일시" },
    { key: "approved_count", label: "승인 제출 수" },
    { key: "acorn_balance", label: "도토리 잔액(전체)" },
  ]);

  return csvResponse(csv, `event_${event.name}_participants_${todayISO()}.csv`);
}
