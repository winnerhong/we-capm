import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

function html(body: string) {
  return new NextResponse(
    `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>오늘의 선물</title></head><body style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#FEFCF8;color:#2C2C2C">${body}</body></html>`,
    { headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}

// GET /api/gift/use?delivery_id=xxx — 가맹점(관리자/기관)이 QR 스캔 시 사용 처리
export async function GET(request: NextRequest) {
  const deliveryId = request.nextUrl.searchParams.get("delivery_id");
  if (!deliveryId) {
    return NextResponse.json({ error: "delivery_id required" }, { status: 400 });
  }

  // 관리자 또는 기관 인증 확인 (추후 affiliate 인증 추가 예정)
  const cookieStore = await cookies();
  const isAdmin = !!cookieStore.get("campnic_admin")?.value;
  const isManager = !!cookieStore.get("campnic_manager")?.value;
  if (!isAdmin && !isManager) {
    return html(
      `<div style="text-align:center;padding:60px 20px">
        <div style="font-size:64px;margin-bottom:16px">🔒</div>
        <h1 style="color:#C4956A">권한이 필요해요</h1>
        <p style="margin-top:12px;color:#6B6560">가맹점 관리자로 로그인 후 다시 스캔해주세요</p>
        <a href="/login" style="display:inline-block;margin-top:24px;padding:12px 24px;background:#2D5A3D;color:white;border-radius:12px;text-decoration:none">로그인</a>
      </div>`
    );
  }

  const supabase = await createClient();

  const { data: delivery, error: deliveryErr } = await supabase
    .from("coupon_deliveries")
    .select("id, coupon_id, participant_phone, used_at")
    .eq("id", deliveryId)
    .maybeSingle();

  if (deliveryErr || !delivery) {
    return html(
      `<div style="text-align:center;padding:60px 20px">
        <div style="font-size:64px;margin-bottom:16px">❌</div>
        <h1 style="color:#DC2626">선물을 찾을 수 없어요</h1>
        <p style="margin-top:12px;color:#6B6560">QR 코드를 다시 확인해주세요</p>
      </div>`
    );
  }

  // 이미 사용한 경우
  if (delivery.used_at) {
    return html(
      `<div style="text-align:center;padding:60px 20px">
        <div style="font-size:64px;margin-bottom:16px">ℹ️</div>
        <h1 style="color:#C4956A">이미 사용된 선물이에요</h1>
        <p style="margin-top:12px;color:#6B6560">사용 시각: ${new Date(delivery.used_at).toLocaleString("ko-KR")}</p>
      </div>`
    );
  }

  // 쿠폰 정보 + 유효기간 검사
  const { data: coupon } = await supabase
    .from("coupons")
    .select("id, title, affiliate_name, discount_type, discount_value, valid_until, used_count, max_uses, status")
    .eq("id", delivery.coupon_id)
    .maybeSingle();

  if (!coupon) {
    return html(
      `<div style="text-align:center;padding:60px 20px">
        <div style="font-size:64px;margin-bottom:16px">❌</div>
        <h1 style="color:#DC2626">쿠폰 정보가 없어요</h1>
      </div>`
    );
  }

  // 유효기간 만료
  if (coupon.valid_until && new Date(coupon.valid_until).getTime() < Date.now()) {
    return html(
      `<div style="text-align:center;padding:60px 20px">
        <div style="font-size:64px;margin-bottom:16px">⏰</div>
        <h1 style="color:#6B6560">유효기간이 지났어요</h1>
        <p style="margin-top:12px;color:#6B6560">${new Date(coupon.valid_until).toLocaleDateString("ko-KR")}까지</p>
      </div>`
    );
  }

  // 사용 처리
  const { error: updateErr } = await supabase
    .from("coupon_deliveries")
    .update({ used_at: new Date().toISOString() })
    .eq("id", deliveryId)
    .is("used_at", null); // race condition 방지

  if (updateErr) {
    return html(
      `<div style="text-align:center;padding:60px 20px">
        <div style="font-size:64px;margin-bottom:16px">❌</div>
        <h1 style="color:#DC2626">처리 실패</h1>
        <p style="margin-top:12px;color:#6B6560">${updateErr.message}</p>
      </div>`
    );
  }

  // used_count 증가
  await supabase
    .from("coupons")
    .update({ used_count: (coupon.used_count ?? 0) + 1 })
    .eq("id", coupon.id);

  // 참가자 이름 조회
  let participantName = delivery.participant_phone;
  const { data: reg } = await supabase
    .from("event_registrations")
    .select("name")
    .eq("phone", delivery.participant_phone)
    .maybeSingle();
  if (reg?.name) participantName = reg.name;

  // 할인 라벨
  let discountLabel = "할인";
  if (coupon.discount_type === "FREE") discountLabel = "무료";
  else if (coupon.discount_type === "PERCENT") discountLabel = `${coupon.discount_value ?? 0}% 할인`;
  else if (coupon.discount_type === "AMOUNT")
    discountLabel = `${(coupon.discount_value ?? 0).toLocaleString("ko-KR")}원 할인`;

  return html(
    `<div style="text-align:center;padding:60px 20px;max-width:420px;margin:0 auto">
      <div style="font-size:72px;margin-bottom:12px">🎁</div>
      <h1 style="color:#2D5A3D;font-size:28px">사용 완료!</h1>
      <div style="margin-top:24px;padding:20px;background:linear-gradient(135deg,#FFF2D6,#F5D9B5);border-radius:16px">
        <div style="font-size:14px;color:#8B6F47">${coupon.affiliate_name}</div>
        <div style="margin-top:6px;font-size:20px;font-weight:bold;color:#8B6F47">${coupon.title}</div>
        <div style="margin-top:12px;display:inline-block;padding:6px 16px;background:#C4956A;color:white;border-radius:999px;font-weight:bold">${discountLabel}</div>
      </div>
      <p style="margin-top:20px;color:#2D5A3D"><strong>${participantName}</strong>님</p>
      <p style="margin-top:4px;color:#6B6560;font-size:13px">${new Date().toLocaleString("ko-KR")}</p>
      <a href="javascript:window.close()" style="display:inline-block;margin-top:28px;padding:12px 28px;background:#2D5A3D;color:white;border-radius:12px;text-decoration:none;font-weight:bold">닫기</a>
    </div>`
  );
}
