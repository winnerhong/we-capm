import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getPartner } from "@/lib/auth-guard";
import { PartnerLoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "숲지기 되기",
  description:
    "토리로 숲지기가 되어 우리 숲길과 체험 프로그램을 운영해보세요.",
};

export const dynamic = "force-dynamic";

export default async function PartnerLoginPage() {
  const partner = await getPartner();
  if (partner) {
    redirect("/partner/dashboard");
  }

  return (
    <div className="flex min-h-[calc(100dvh-110px)] items-center justify-center py-10">
      <div className="w-full max-w-sm rounded-2xl border border-[#D4E4BC] bg-white p-6 shadow-sm md:p-8">
        <div className="mb-6 text-center">
          <div className="mb-2 text-4xl">🏡</div>
          <h1 className="text-2xl font-bold text-[#2D5A3D]">숲지기 로그인</h1>
          <p className="mt-1 text-sm text-[#6B6560]">숲길 운영을 시작해보세요</p>
        </div>

        <PartnerLoginForm />

        <div className="mt-6 border-t border-[#D4E4BC] pt-4 text-center text-sm text-[#6B6560]">
          아직 가입하지 않으셨나요?{" "}
          <Link
            href="/partner/signup"
            className="font-semibold text-[#2D5A3D] underline-offset-2 hover:underline"
          >
            숲지기 되기 →
          </Link>
        </div>
      </div>
    </div>
  );
}
