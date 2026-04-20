import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "상담 신청 접수 · 토리로",
  description: "기업 상담 신청이 정상 접수되었습니다.",
};

export default function EnterpriseThankYouPage() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-gradient-to-br from-[#FFF8F0] via-[#E8F0E4] to-[#D4E4BC] px-4 py-10">
      <div className="w-full max-w-lg rounded-3xl border border-[#D4E4BC] bg-white p-8 text-center shadow-lg md:p-10">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-[#E8F0E4] text-4xl">
          ✅
        </div>
        <h1 className="mt-6 text-2xl font-extrabold text-[#2D5A3D] md:text-3xl">
          문의가 접수되었어요!
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-[#6B6560] md:text-base">
          영업일 기준 <b className="text-[#2D5A3D]">1~2일 내</b>로
          <br />
          담당 PM이 이메일 또는 연락처로 회신드릴게요.
        </p>

        <div className="mt-8 rounded-2xl border border-[#E5D3B8] bg-[#FFF8F0] p-4 text-left">
          <p className="flex items-center gap-1.5 text-xs font-bold text-[#6B4423]">
            <span>🌰</span>
            <span>기다리시는 동안</span>
          </p>
          <ul className="mt-2 space-y-1 text-xs text-[#8B6F47]">
            <li>• 토리로 일반 서비스를 둘러보세요</li>
            <li>• 팀 내 참여 희망 인원·날짜를 확정해두면 좋아요</li>
            <li>• 궁금한 점이 생기면 회신 메일에 바로 답장해주세요</li>
          </ul>
        </div>

        <div className="mt-8 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Link
            href="/"
            className="rounded-xl bg-[#2D5A3D] px-6 py-3 text-sm font-bold text-white shadow-sm transition-colors hover:bg-[#3A7A52]"
          >
            그동안 토리로 살펴보기 →
          </Link>
          <Link
            href="/enterprise"
            className="rounded-xl border border-[#D4E4BC] bg-white px-6 py-3 text-sm font-semibold text-[#2D5A3D] transition-colors hover:bg-[#E8F0E4]"
          >
            기업 패키지로 돌아가기
          </Link>
        </div>

        <p className="mt-6 text-[11px] text-[#8B6F47]">
          문의 관련 긴급 요청은 enterprise@toriro.kr 로 연락주세요.
        </p>
      </div>
    </div>
  );
}
