import Link from "next/link";
import { PartnerSignupForm } from "./signup-form";

export const dynamic = "force-dynamic";

export default function PartnerSignupPage() {
  return (
    <div className="min-h-[calc(100dvh-110px)] bg-[#FFF8F0] py-8">
      <div className="mx-auto w-full max-w-lg space-y-5 px-4">
        <div className="text-center">
          <div className="text-4xl">🏡</div>
          <h1 className="mt-2 text-2xl font-extrabold text-[#2D5A3D]">숲지기 되기</h1>
          <p className="mt-1 text-sm text-[#6B6560]">토리로와 함께 숲길을 운영해요</p>
        </div>

        <PartnerSignupForm />

        <div className="text-center text-sm text-[#6B6560]">
          이미 숲지기세요?{" "}
          <Link
            href="/partner"
            className="font-semibold text-[#2D5A3D] underline-offset-2 hover:underline"
          >
            로그인 →
          </Link>
        </div>
      </div>
    </div>
  );
}
