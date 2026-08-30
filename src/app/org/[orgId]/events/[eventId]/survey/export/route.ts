// 설문 결과 CSV 내려받기.
//
// 왜 서버 라우트인가:
//   브라우저에서 만들어 내려받게 하면 화면에 그려진 만큼만 담긴다(목록에 상한이
//   있다). 파일은 전부여야 한다 — 반쪽짜리 파일은 안 주느니만 못하다.
//
// 권한:
//   requireOrg 로 로그인한 기관을 확인하고, **그 기관의 행사인지 한 번 더 본다.**
//   eventId 는 주소창에 있는 값이라, 확인하지 않으면 남의 기관 설문을 id 만 알면
//   받아갈 수 있다. 이 저장소의 다른 export 라우트에는 이 검사가 없다.

import { NextResponse } from "next/server";
import { requireOrg } from "@/lib/org-auth-guard";
import { createClient } from "@/lib/supabase/server";
import { loadSurveyResponses } from "@/lib/org-events/survey-queries";
import { buildSurveyCsv, safeFileStem } from "@/lib/org-events/survey-csv";
import { fmtDateTimeKst } from "@/lib/datetime/kst";

export const dynamic = "force-dynamic";

/** 목록 화면과 같은 상한. 그보다 큰 행사가 생기면 여기부터 늘린다. */
const MAX_ROWS = 5000;

type EventRow = { id: string; name: string | null; starts_at: string | null };

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ orgId: string; eventId: string }> }
) {
  const org = await requireOrg();
  const { orgId, eventId } = await ctx.params;

  // 주소의 orgId 와 로그인한 기관이 다르면 남의 화면이다.
  if (!orgId || orgId !== org.orgId) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (!eventId) {
    return NextResponse.json({ error: "missing eventId" }, { status: 400 });
  }

  const supabase = await createClient();
  const evResp = (await (
    supabase.from("org_events" as never) as unknown as {
      select: (c: string) => {
        eq: (
          k: string,
          v: string
        ) => {
          eq: (
            k: string,
            v: string
          ) => { maybeSingle: () => Promise<{ data: EventRow | null }> };
        };
      };
    }
  )
    .select("id, name, starts_at")
    .eq("id", eventId)
    // 이 기관의 행사가 아니면 아무것도 안 나온다 — 존재 여부도 알려주지 않는다.
    .eq("org_id", org.orgId)
    .maybeSingle()) as { data: EventRow | null };

  const event = evResp.data;
  if (!event) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const responses = await loadSurveyResponses(eventId, MAX_ROWS);
  const csv = buildSurveyCsv(
    responses.map((r) => ({
      createdAt: fmtDateTimeKst(r.createdAt),
      name: r.name,
      rating: r.rating,
      bestMissionTitle: r.bestMissionTitle,
      comment: r.comment,
    }))
  );

  const day = (event.starts_at ?? new Date().toISOString()).slice(0, 10);
  const stem = `설문_${safeFileStem(event.name ?? "")}_${day}`;
  // 한글 파일명은 filename* (RFC 5987) 로 보내야 안 깨진다. filename= 는
  // 그걸 못 읽는 브라우저를 위한 ASCII 대체본이다.
  const ascii = `survey-${eventId.slice(0, 8)}-${day}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(
        `${stem}.csv`
      )}`,
      "Cache-Control": "no-store",
    },
  });
}
