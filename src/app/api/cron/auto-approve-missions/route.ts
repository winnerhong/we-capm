// /api/cron/auto-approve-missions
//  - AUTO_24H 미션에 24h 경과된 SUBMITTED 제출을 일괄 승인.
//  - 인증: Authorization: Bearer <CRON_SECRET>   또는   ?secret=<CRON_SECRET>
//  - Vercel Cron 등록은 Phase 3 — 지금은 수동/외부 트리거 가능.
//
// 보안:
//   - CRON_SECRET 환경변수 없으면 403 (실수로 퍼블릭하게 열리지 않도록)
//   - 민감 정보 로깅 금지: scanned/approved/failed 카운트만 리턴.

import { NextResponse, type NextRequest } from "next/server";
import { runAutoApprove24h } from "@/lib/missions/auto-approve";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const auth = req.headers.get("authorization") ?? "";
  if (auth === `Bearer ${secret}`) return true;

  const q = req.nextUrl.searchParams.get("secret") ?? "";
  if (q && q === secret) return true;

  return false;
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const result = await runAutoApprove24h();
    return NextResponse.json({
      ok: true,
      scanned: result.scanned,
      approved: result.approved,
      skipped: result.skipped,
      failed: result.failed,
      errorCount: result.errors.length,
    });
  } catch (e) {
    console.error("[cron/auto-approve] error", {
      msg: e instanceof Error ? e.message : String(e),
    });
    return NextResponse.json(
      { error: "auto_approve_failed" },
      { status: 500 }
    );
  }
}

// POST 도 동일하게 허용 (일부 외부 cron 서비스는 POST 만 지원)
export async function POST(req: NextRequest) {
  return GET(req);
}
