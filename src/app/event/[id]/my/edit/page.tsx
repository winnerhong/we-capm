import Link from "next/link";
import { redirect } from "next/navigation";
import { getParticipant } from "@/lib/participant-session";
import { updateMyInfoAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function MyEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getParticipant(id);
  if (!session) redirect("/join");

  // Server Action에 eventId 바인딩
  const updateAction = updateMyInfoAction.bind(null, id);

  return (
    <main className="min-h-dvh bg-neutral-50 p-4 pb-24">
      <div className="mx-auto max-w-lg space-y-4">
        {/* Header */}
        <nav aria-label="breadcrumb" className="text-xs text-[#8B7F75]">
          <Link href={`/event/${id}/my`} className="hover:text-[#2D5A3D]">
            나의 숲 기록
          </Link>
          <span className="mx-2">/</span>
          <span className="font-semibold text-[#2D5A3D]">내 정보 수정</span>
        </nav>

        <div className="rounded-2xl bg-gradient-to-br from-[#2D5A3D] to-[#3A7A52] p-5 text-white shadow-lg">
          <h1 className="text-lg font-bold">✏️ 내 정보 수정</h1>
          <p className="mt-1 text-xs opacity-90">
            개인정보보호법 제36조에 따라 정정권을 행사할 수 있어요
          </p>
        </div>

        <section className="rounded-2xl border border-[#D4E4BC] bg-white p-5 shadow-sm">
          <form action={updateAction} className="space-y-4">
            <div>
              <label
                htmlFor="name"
                className="mb-1 block text-xs font-semibold text-[#6B6560]"
              >
                이름 <span className="text-rose-500">*</span>
              </label>
              <input
                id="name"
                name="name"
                type="text"
                defaultValue={session.name}
                required
                maxLength={40}
                autoComplete="name"
                className="w-full rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] px-3 py-2.5 text-sm text-[#2C2C2C] focus:border-[#2D5A3D] focus:outline-none focus:ring-2 focus:ring-[#3A7A52]/30"
              />
            </div>

            <div>
              <label
                htmlFor="phone"
                className="mb-1 block text-xs font-semibold text-[#6B6560]"
              >
                전화번호
              </label>
              <input
                id="phone"
                type="tel"
                defaultValue={session.phone}
                disabled
                readOnly
                className="w-full cursor-not-allowed rounded-xl border border-[#E5D3B8] bg-[#F0EBE3] px-3 py-2.5 text-sm text-[#8B7F75]"
                aria-describedby="phone-help"
              />
              <p id="phone-help" className="mt-1 text-[11px] text-[#8B7F75]">
                전화번호는 본인 확인 수단이므로 변경할 수 없어요. 변경이 필요하면
                고객센터에 문의해 주세요.
              </p>
            </div>

            <div>
              <label
                htmlFor="email"
                className="mb-1 block text-xs font-semibold text-[#6B6560]"
              >
                이메일 (선택)
              </label>
              <input
                id="email"
                name="email"
                type="email"
                defaultValue=""
                autoComplete="email"
                inputMode="email"
                placeholder="example@toriro.kr"
                className="w-full rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] px-3 py-2.5 text-sm text-[#2C2C2C] focus:border-[#2D5A3D] focus:outline-none focus:ring-2 focus:ring-[#3A7A52]/30"
              />
              <p className="mt-1 text-[11px] text-[#8B7F75]">
                월간 소식을 받고 싶으실 때만 입력해 주세요.
              </p>
            </div>

            <div className="flex flex-col gap-2 pt-2 md:flex-row">
              <button
                type="submit"
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-[#2D5A3D] to-[#3A7A52] px-4 py-3 text-sm font-bold text-white shadow-md hover:from-[#234a30] hover:to-[#2D5A3D] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2D5A3D]/40 md:w-auto"
              >
                💾 저장하기
              </button>
              <Link
                href={`/event/${id}/my`}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-[#D4E4BC] bg-white px-4 py-3 text-sm font-semibold text-[#6B6560] hover:bg-[#F0EBE3] md:w-auto"
              >
                취소
              </Link>
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}
