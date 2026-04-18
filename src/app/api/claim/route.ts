import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

// GET /api/claim?claimId=xxx — 스태프가 QR 스캔 시 수령 처리
export async function GET(request: NextRequest) {
  const claimId = request.nextUrl.searchParams.get("claimId");
  if (!claimId) {
    return NextResponse.json({ error: "claimId required" }, { status: 400 });
  }

  // 스태프(관리자/기관) 인증 확인
  const cookieStore = await cookies();
  const isAdmin = !!cookieStore.get("campnic_admin")?.value;
  const isManager = !!cookieStore.get("campnic_manager")?.value;
  if (!isAdmin && !isManager) {
    return new NextResponse(
      `<html><body style="font-family:sans-serif;text-align:center;padding:60px 20px">
        <h1>❌ 권한 없음</h1>
        <p>관리자 또는 기관으로 로그인해주세요</p>
        <a href="/login" style="color:#7c3aed">로그인 →</a>
      </body></html>`,
      { headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }

  const supabase = await createClient();

  const { data: claim } = await supabase
    .from("reward_claims")
    .select("id, status, reward_id, participant_id")
    .eq("id", claimId)
    .single();

  if (!claim) {
    return new NextResponse(
      `<html><body style="font-family:sans-serif;text-align:center;padding:60px 20px">
        <h1>❌ 보상을 찾을 수 없습니다</h1>
      </body></html>`,
      { headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }

  if (claim.status === "CLAIMED") {
    return new NextResponse(
      `<html><body style="font-family:sans-serif;text-align:center;padding:60px 20px">
        <h1>✅ 이미 수령 완료</h1>
        <p>이 보상은 이미 수령 처리되었습니다</p>
      </body></html>`,
      { headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }

  // 수령 처리
  await supabase.from("reward_claims").update({
    status: "CLAIMED",
    claimed_at: new Date().toISOString(),
  }).eq("id", claimId);

  // 참가자 이름, 보상 이름 가져오기
  const { data: reward } = await supabase.from("rewards").select("name").eq("id", claim.reward_id).single();
  const { data: participant } = await supabase.from("participants").select("phone").eq("id", claim.participant_id).single();

  let participantName = participant?.phone ?? "참가자";
  if (participant?.phone) {
    const { data: reg } = await supabase
      .from("event_registrations")
      .select("name")
      .eq("phone", participant.phone)
      .maybeSingle();
    if (reg) participantName = reg.name;
  }

  return new NextResponse(
    `<html><body style="font-family:sans-serif;text-align:center;padding:60px 20px">
      <div style="font-size:64px;margin-bottom:16px">✅</div>
      <h1 style="color:#16a34a">수령 완료!</h1>
      <p style="margin-top:12px"><strong>${participantName}</strong></p>
      <p style="font-size:20px;margin-top:8px">🎁 ${reward?.name ?? "보상"}</p>
      <p style="color:#999;margin-top:20px;font-size:14px">
        ${new Date().toLocaleString("ko-KR")}
      </p>
      <a href="javascript:window.close()" style="display:inline-block;margin-top:24px;padding:12px 24px;background:#7c3aed;color:white;border-radius:12px;text-decoration:none">
        닫기
      </a>
    </body></html>`,
    { headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}
