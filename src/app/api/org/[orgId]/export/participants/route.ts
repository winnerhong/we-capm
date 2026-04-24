// 기관 포털용 전체 참가자(app_users) CSV 내보내기.
// 조건: 기관 세션 필수 + 경로의 orgId 와 세션 orgId 일치 확인.
// 컬럼: 보호자명, 연락처, 자녀, 자녀 수, 도토리 잔액, 상태, 첫 로그인, 최근 로그인, 가입일
//
// Legacy /api/export/participants 는 events(event_registrations) 시스템 전용이라
// org 포털은 별도 라우트로 분리.

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

  // 2) app_users — 이 기관 소속 전체
  const usersResp = (await (
    supabase.from("app_users" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          order: (
            c: string,
            o: { ascending: boolean }
          ) => Promise<{
            data: Array<{
              id: string;
              parent_name: string | null;
              phone: string;
              acorn_balance: number;
              status: string;
              first_login_at: string | null;
              last_login_at: string | null;
              created_at: string;
            }> | null;
          }>;
        };
      };
    }
  )
    .select(
      "id, parent_name, phone, acorn_balance, status, first_login_at, last_login_at, created_at"
    )
    .eq("org_id", orgId)
    .order("created_at", { ascending: false })) as {
    data: Array<{
      id: string;
      parent_name: string | null;
      phone: string;
      acorn_balance: number;
      status: string;
      first_login_at: string | null;
      last_login_at: string | null;
      created_at: string;
    }> | null;
  };

  const users = usersResp.data ?? [];

  // 3) 자녀 정보 배치 로드 (app_children)
  const userIds = users.map((u) => u.id);
  let childMap = new Map<
    string,
    Array<{ name: string; birth_date: string | null }>
  >();
  if (userIds.length > 0) {
    const childResp = (await (
      supabase.from("app_children" as never) as unknown as {
        select: (c: string) => {
          in: (k: string, v: string[]) => Promise<{
            data: Array<{
              user_id: string;
              name: string;
              birth_date: string | null;
            }> | null;
          }>;
        };
      }
    )
      .select("user_id, name, birth_date")
      .in("user_id", userIds)) as {
      data: Array<{
        user_id: string;
        name: string;
        birth_date: string | null;
      }> | null;
    };
    childMap = (childResp.data ?? []).reduce((m, c) => {
      const arr = m.get(c.user_id) ?? [];
      arr.push({ name: c.name, birth_date: c.birth_date });
      m.set(c.user_id, arr);
      return m;
    }, new Map<string, Array<{ name: string; birth_date: string | null }>>());
  }

  type Row = {
    parent_name: string;
    phone: string;
    children: string;
    child_count: string;
    acorn_balance: string;
    status: string;
    first_login_at: string;
    last_login_at: string;
    created_at: string;
  };

  const rows: Row[] = users.map((u) => {
    const children = childMap.get(u.id) ?? [];
    return {
      parent_name: u.parent_name ?? "",
      phone: u.phone,
      children: children.map((c) => c.name).join(" / "),
      child_count: String(children.length),
      acorn_balance: String(u.acorn_balance ?? 0),
      status: u.status,
      first_login_at: formatDateKR(u.first_login_at),
      last_login_at: formatDateKR(u.last_login_at),
      created_at: formatDateKR(u.created_at),
    };
  });

  const csv = toCSV<Row>(rows, [
    { key: "parent_name", label: "보호자명" },
    { key: "phone", label: "연락처" },
    { key: "children", label: "자녀" },
    { key: "child_count", label: "자녀 수" },
    { key: "acorn_balance", label: "도토리 잔액" },
    { key: "status", label: "상태" },
    { key: "first_login_at", label: "첫 로그인" },
    { key: "last_login_at", label: "최근 로그인" },
    { key: "created_at", label: "가입일" },
  ]);

  return csvResponse(csv, `participants_${orgName}_${todayISO()}.csv`);
}
