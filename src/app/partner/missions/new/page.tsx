import Link from "next/link";
import { requirePartner } from "@/lib/auth-guard";
import { CreateDraftForm } from "./create-draft-form";

export const dynamic = "force-dynamic";

export default async function NewMissionPickerPage() {
  await requirePartner();

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Breadcrumb */}
      <nav aria-label="breadcrumb" className="text-xs text-[#8B7F75]">
        <Link href="/partner/dashboard" className="hover:text-[#2D5A3D]">
          대시보드
        </Link>
        <span className="mx-2">/</span>
        <Link href="/partner/missions" className="hover:text-[#2D5A3D]">
          미션 라이브러리
        </Link>
        <span className="mx-2">/</span>
        <span className="font-semibold text-[#2D5A3D]">새 미션</span>
      </nav>

      {/* Header */}
      <header className="rounded-3xl border border-[#D4E4BC] bg-gradient-to-br from-[#E8F0E4] via-white to-[#FAE7D0] p-5 shadow-sm md:p-7">
        <div className="flex items-center gap-3">
          <span className="text-3xl" aria-hidden>
            🧩
          </span>
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-[#2D5A3D] md:text-2xl">
              어떤 미션을 만들까요?
            </h1>
            <p className="mt-1 text-xs text-[#6B6560] md:text-sm">
              종류를 선택하면 초안이 자동으로 생성되고, 편집 화면으로 이동합니다.
              Phase 1에서는 사진 · QR 퀴즈 · 최종 보상 3가지를 지원해요.
            </p>
          </div>
        </div>
      </header>

      <CreateDraftForm />

      <div className="rounded-2xl border border-[#E5D3B8] bg-[#FFF8F0] p-4 text-[11px] text-[#6B6560]">
        <p className="font-semibold text-[#8B6F47]">💡 팁</p>
        <ul className="mt-1 list-disc space-y-0.5 pl-4">
          <li>같은 종류의 미션도 여러 개 만들 수 있어요 (포토존 A/B/C 등).</li>
          <li>
            초안 상태에서는 기관에 노출되지 않아요. 완성되면{" "}
            <strong>게시</strong>를 눌러주세요.
          </li>
          <li>
            Phase 2 미션(🍃 자연물, 🤝 협동, ⚡ 돌발, 🗺 보물찾기, 🎵 사연)은
            곧 만들 수 있어요.
          </li>
        </ul>
      </div>
    </div>
  );
}
