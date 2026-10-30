// 참가 접수 통계 + 가족별 상세 명단 CSV 내보내기 (엑셀에서 바로 열림).
//
// 접수 탭의 📊 통계 패널 "엑셀로 받기" 버튼이 부른다.
// ?scope=approved (기본, 승인만) | active (승인+대기, 거절·취소 제외)
//
// 파일 구성: [요약] → [반별 현황] → [동반 구성] → [가족별 상세 명단]
// 숫자는 화면 통계 패널과 같은 computeApplicationStats 를 쓴다 — 어긋나지 않는다.

import { type NextRequest, NextResponse } from "next/server";
import { csvResponse } from "@/lib/csv-export";
import { requireOrg } from "@/lib/org-auth-guard";
import { createClient } from "@/lib/supabase/server";
import { loadEventApplications } from "@/lib/org-events/application-queries";
import {
  computeHeadcount,
  formatPhoneDisplay,
} from "@/lib/org-events/application-core";
import { computeApplicationStats } from "@/lib/org-events/application-stats";
import { ORG_EVENT_APPLICATION_STATUS_META } from "@/lib/org-events/types";
import { fmtDateTimeKst } from "@/lib/datetime/kst";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** CSV 셀 이스케이프 — 항상 따옴표로 감싼다. */
function esc(raw: unknown): string {
  if (raw === null || raw === undefined) return '""';
  return `"${String(raw).replace(/"/g, '""')}"`;
}

function line(...cells: unknown[]): string {
  return cells.map(esc).join(",");
}

export async function GET(
  req: NextRequest,
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

  // 행사 소유권 확인 + 파일명에 쓸 행사 이름.
  const supabase = await createClient();
  const evResp = (await (
    supabase.from("org_events" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          maybeSingle: () => Promise<{
            data: { id: string; org_id: string; name: string } | null;
          }>;
        };
      };
    }
  )
    .select("id, org_id, name")
    .eq("id", eventId)
    .maybeSingle()) as {
    data: { id: string; org_id: string; name: string } | null;
  };
  const event = evResp.data;
  if (!event || event.org_id !== orgId) {
    return NextResponse.json({ error: "event not found" }, { status: 404 });
  }

  const scope =
    req.nextUrl.searchParams.get("scope") === "active" ? "active" : "approved";
  const all = await loadEventApplications(eventId);
  const rows = all.filter((a) =>
    scope === "approved"
      ? a.status === "APPROVED"
      : a.status === "APPROVED" || a.status === "PENDING"
  );
  const stats = computeApplicationStats(rows);

  const out: string[] = [];
  const scopeLabel = scope === "approved" ? "승인된 신청" : "승인+대기 신청";

  // [요약]
  out.push(line(`${event.name} — 참가 접수 통계 (${scopeLabel})`));
  out.push(line("내려받은 시각", fmtDateTimeKst(new Date().toISOString())));
  out.push("");
  out.push(line("구분", "값"));
  out.push(line("가족 수", stats.familyCount));
  out.push(line("총 인원", stats.headcount.total));
  out.push(line("유아", stats.headcount.childCount));
  out.push(line("성인", stats.headcount.adultCount));
  out.push(line("조부모", stats.headcount.seniorCount));
  out.push(line("가족당 평균 인원", stats.avgPartySize));
  out.push(line("조부모 동반 가족", stats.seniorFamilyCount));
  out.push("");

  // [반별 현황]
  out.push(line("반별 현황"));
  out.push(line("반", "원아 수", "가족 수", "총 인원(어른 포함)"));
  for (const c of stats.byClass) {
    out.push(line(c.className, c.childCount, c.familyCount, c.personTotal));
  }
  out.push("");

  // [동반 구성]
  out.push(line("동반 구성"));
  out.push(line("구분", "분류", "인원"));
  for (const c of stats.byCompanionLabel) {
    const kindLabel =
      c.kind === "SENIOR" ? "조부모" : c.kind === "CHILD" ? "유아" : "성인";
    out.push(line(c.label, kindLabel, c.count));
  }
  out.push("");

  // [가족별 상세 명단]
  out.push(line("가족별 상세 명단"));
  out.push(
    line(
      "원아명",
      "반",
      "연락처",
      "유아",
      "성인",
      "조부모",
      "총 인원",
      "동반 구성",
      "상태",
      "신청 시각"
    )
  );
  for (const a of rows) {
    const h = computeHeadcount(a.children, a.companions);
    out.push(
      line(
        a.children.map((c) => c.name).join(", "),
        a.children
          .map((c) => (c.class_name ?? "").trim() || "미지정")
          .join(", "),
        formatPhoneDisplay(a.phone),
        h.childCount,
        h.adultCount,
        h.seniorCount,
        h.total,
        a.companions.map((c) => c.label).join(" · "),
        ORG_EVENT_APPLICATION_STATUS_META[a.status]?.label ?? a.status,
        fmtDateTimeKst(a.created_at)
      )
    );
  }

  // BOM — 엑셀이 UTF-8 한글을 바로 읽는다.
  const csv = "﻿" + out.join("\r\n");
  const scopeSuffix = scope === "approved" ? "승인" : "승인대기";
  return csvResponse(csv, `${event.name}_접수통계_${scopeSuffix}.csv`);
}
