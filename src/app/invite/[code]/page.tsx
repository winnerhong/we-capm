import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { InviteAcceptClient } from "./accept-client";

export const dynamic = "force-dynamic";

type ReferralRow = {
  referrer_name: string | null;
  status: "PENDING" | "JOINED" | "COMPLETED" | "EXPIRED";
  expires_at: string | null;
  referrer_event_id: string | null;
};

type SupabaseShim = {
  from: (t: string) => {
    select: (c: string) => {
      eq: (k: string, v: string) => {
        maybeSingle: () => Promise<{ data: ReferralRow | null }>;
      };
    };
  };
};

export default async function InviteLandingPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const supabase = await createClient();
  const shim = supabase as unknown as SupabaseShim;

  const { data: referral } = await shim
    .from("referrals")
    .select("referrer_name, status, expires_at, referrer_event_id")
    .eq("referral_code", code)
    .maybeSingle();

  // Invalid or expired
  const isInvalid = !referral;
  const isExpired =
    referral &&
    (referral.status === "EXPIRED" ||
      (referral.expires_at && new Date(referral.expires_at) < new Date()));

  if (isInvalid || isExpired) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-gradient-to-b from-[#FFF8F0] to-[#F5E6D3] p-6">
        <div className="w-full max-w-sm space-y-4 text-center">
          <div className="text-5xl">⚠️</div>
          <h1 className="text-xl font-bold text-[#2D5A3D]">
            {isInvalid ? "유효하지 않은 초대" : "만료된 초대"}
          </h1>
          <p className="text-sm text-[#6B6560]">
            {isInvalid
              ? "초대 링크를 다시 확인해주세요."
              : "초대 링크가 만료되었어요. 친구에게 다시 요청해주세요."}
          </p>
          <Link
            href="/"
            className="mt-4 inline-block rounded-2xl bg-violet-600 px-6 py-3 text-sm font-bold text-white hover:bg-violet-700"
          >
            메인으로
          </Link>
        </div>
      </main>
    );
  }

  const referrerName = referral!.referrer_name?.trim() || "친구";

  return (
    <main className="min-h-dvh bg-gradient-to-b from-[#FFF8F0] to-[#F5E6D3] pb-24">
      <div className="mx-auto max-w-sm px-6 pt-10">
        {/* 헤더 */}
        <div className="text-center space-y-3">
          <div className="text-6xl" aria-hidden>
            🎉
          </div>
          <h1 className="text-2xl font-extrabold text-[#2D5A3D]">
            초대받으셨어요!
          </h1>
          <p className="text-base text-[#6B6560]">
            <span className="font-bold text-[#2D5A3D]">{referrerName}</span>님이{" "}
            <span className="font-bold text-[#C4956A]">토리로</span>에 초대했어요
          </p>
        </div>

        {/* 보상 강조 카드 */}
        <div className="mt-6 rounded-3xl border-2 border-[#C4956A] bg-white p-5 text-center shadow-lg">
          <div className="text-4xl mb-2" aria-hidden>
            🌰
          </div>
          <p className="text-lg font-bold text-[#2D5A3D]">
            가입하면 <span className="text-[#C4956A]">도토리 20개</span> 선물!
          </p>
          <p className="mt-1 text-xs text-[#6B6560]">
            초대한 친구도 20개를 받아요
          </p>
        </div>

        {/* Phone + name form */}
        <InviteAcceptClient code={code} />

        <p className="mt-6 text-center text-[10px] text-[#9A928B]">
          가입 시 이용약관 및 개인정보처리방침에 동의합니다
        </p>
      </div>
    </main>
  );
}
