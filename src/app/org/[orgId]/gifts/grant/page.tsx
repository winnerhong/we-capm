// 수동 발급 — 기관이 임의 학부모에게 동일 선물을 일괄 지급.
// 단계: (1) 행사 선택 / 전체 / 임의 → (2) 받는 사람 체크 → (3) 선물 정보 입력 → 발급.

import Link from "next/link";
import { requireOrg } from "@/lib/org-auth-guard";
import { createClient } from "@/lib/supabase/server";
import { loadOrgEvents } from "@/lib/org-events/queries";
import { GrantForm, type RecipientRow } from "./grant-form";

export const dynamic = "force-dynamic";

async function loadOrgUsers(orgId: string): Promise<RecipientRow[]> {
  const supabase = await createClient();
  type Row = {
    id: string;
    phone: string | null;
    parent_name: string | null;
    status: string | null;
  };
  const resp = (await (
    supabase.from("app_users" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          order: (
            c: string,
            o: { ascending: boolean }
          ) => Promise<{ data: Row[] | null }>;
        };
      };
    }
  )
    .select("id, phone, parent_name, status")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false })) as { data: Row[] | null };

  const rows = resp.data ?? [];

  // 자녀 이름 + 대표 반 (원생 표시용 — created_at ASC 로 첫 enrolled 반 사용)
  const ids = rows.map((r) => r.id);
  const childMap = new Map<string, string[]>();
  const classMap = new Map<string, string>();
  if (ids.length > 0) {
    type ChildRow = {
      user_id: string;
      name: string;
      is_enrolled: boolean;
      class_name: string | null;
      created_at: string;
    };
    const cResp = (await (
      supabase.from("app_children" as never) as unknown as {
        select: (c: string) => {
          in: (
            k: string,
            v: string[]
          ) => {
            order: (
              c: string,
              o: { ascending: boolean }
            ) => Promise<{ data: ChildRow[] | null }>;
          };
        };
      }
    )
      .select("user_id, name, is_enrolled, class_name, created_at")
      .in("user_id", ids)
      .order("created_at", { ascending: true })) as {
      data: ChildRow[] | null;
    };
    for (const c of cResp.data ?? []) {
      if (!c.is_enrolled) continue;
      const arr = childMap.get(c.user_id) ?? [];
      arr.push(c.name);
      childMap.set(c.user_id, arr);
      const cn = (c.class_name ?? "").trim();
      if (cn && !classMap.has(c.user_id)) classMap.set(c.user_id, cn);
    }
  }

  return rows
    .filter((r) => r.status !== "CLOSED")
    .map((r) => ({
      id: r.id,
      parentName: r.parent_name ?? "",
      phone: r.phone ?? "",
      childNames: childMap.get(r.id) ?? [],
      className: classMap.get(r.id) ?? null,
    }));
}

async function loadEventParticipantMap(
  orgId: string
): Promise<Map<string, string[]>> {
  // event_id → user_id[]
  const supabase = await createClient();

  // 1) 이 org 의 모든 event id
  type Ev = { id: string };
  const eResp = (await (
    supabase.from("org_events" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => Promise<{ data: Ev[] | null }>;
      };
    }
  )
    .select("id")
    .eq("org_id", orgId)) as { data: Ev[] | null };
  const eventIds = (eResp.data ?? []).map((e) => e.id);
  const result = new Map<string, string[]>();
  if (eventIds.length === 0) return result;

  // 2) 참가자 join
  type P = { event_id: string; user_id: string };
  const pResp = (await (
    supabase.from("org_event_participants" as never) as unknown as {
      select: (c: string) => {
        in: (k: string, v: string[]) => Promise<{ data: P[] | null }>;
      };
    }
  )
    .select("event_id, user_id")
    .in("event_id", eventIds)) as { data: P[] | null };

  for (const p of pResp.data ?? []) {
    const arr = result.get(p.event_id) ?? [];
    arr.push(p.user_id);
    result.set(p.event_id, arr);
  }
  return result;
}

export default async function OrgGiftGrantPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  await requireOrg();

  const [recipients, events, participantMap] = await Promise.all([
    loadOrgUsers(orgId),
    loadOrgEvents(orgId),
    loadEventParticipantMap(orgId),
  ]);

  const visibleEvents = events
    .filter((e) => e.status !== "ARCHIVED")
    .map((e) => ({
      id: e.id,
      name: e.name,
      participantIds: participantMap.get(e.id) ?? [],
    }));

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-6">
      <nav aria-label="breadcrumb" className="text-xs text-[#8B7F75]">
        <Link href={`/org/${orgId}`} className="hover:text-[#2D5A3D]">
          기관 홈
        </Link>
        <span className="mx-2">/</span>
        <Link
          href={`/org/${orgId}/gifts`}
          className="hover:text-[#2D5A3D]"
        >
          선물함 모아보기
        </Link>
        <span className="mx-2">/</span>
        <span className="font-semibold text-[#2D5A3D]">수동 발급</span>
      </nav>

      <header className="rounded-3xl border border-[#D4E4BC] bg-gradient-to-br from-[#E8F0E4] via-white to-[#FAE7D0] p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <span className="text-3xl" aria-hidden>
            🚀
          </span>
          <div>
            <h1 className="text-xl font-bold text-[#2D5A3D]">
              선물 수동 발급
            </h1>
            <p className="mt-1 text-xs text-[#6B6560]">
              행사 참가자 전원 또는 임의로 고른 학부모에게 동일 선물을 한 번에
              지급해요. 발급된 선물은 학부모 포털 선물함과 모아보기에서 즉시
              확인할 수 있어요.
            </p>
          </div>
        </div>
      </header>

      <GrantForm
        orgId={orgId}
        recipients={recipients}
        events={visibleEvents}
      />
    </div>
  );
}
