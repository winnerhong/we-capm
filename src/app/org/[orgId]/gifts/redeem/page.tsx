// 기관 매장 카운터 — 선물 QR 수령 페이지.
// QR 스캐너 + 수동 코드 입력 폴백. 실제 처리는 redeemGiftAction 서버 액션.

import { requireOrg } from "@/lib/org-auth-guard";
import { RedeemScanner } from "./RedeemScanner";

export const dynamic = "force-dynamic";

export default async function OrgGiftRedeemPage() {
  const org = await requireOrg();

  return (
    <div className="mx-auto max-w-2xl space-y-5 px-4 py-6">
      <header className="space-y-1.5">
        <p className="text-[11px] font-bold uppercase tracking-widest text-[#6B6560]">
          {org.orgName}
        </p>
        <h1 className="text-xl font-extrabold text-[#2D5A3D]">
          🎁 선물 수령 처리
        </h1>
        <p className="text-[12px] leading-relaxed text-[#6B6560]">
          QR을 스캔하거나 8자리 코드를 입력해 선물 수령을 처리하세요.
          <br />
          <span className="text-[11px] text-[#8B7F75]">
            동일한 QR은 한 번만 사용할 수 있어요. 카메라 권한을 허용해 주세요.
          </span>
        </p>
      </header>

      <RedeemScanner />
    </div>
  );
}
