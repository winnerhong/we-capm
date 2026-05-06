import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAppUser } from "@/lib/user-auth-guard";
import { loadActiveEventsForUser } from "@/lib/org-events/queries";
import { WinnerTalkIcon } from "@/components/winner-talk-icon";

export const dynamic = "force-dynamic";

// 주의: 레거시 chat_rooms.event_id 가 events(id) FK 라 신규 org_events 기반
// 참가자는 채팅 인프라를 바로 못 씀. 추후 org_events 기반으로 재구축 예정 —
// 그 전까지 신규 포털에서는 "준비 중" 안내만 노출.
export default async function ToriTalkHubPage() {
  const user = await requireAppUser();
  const activeEvents = await loadActiveEventsForUser(user.id);

  // LIVE 행사 없음 → 홈으로 (탭바도 이미 숨김 처리)
  if (activeEvents.length === 0) redirect("/home");

  return (
    <div className="space-y-4">
      <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-[#2D5A3D] via-[#3A7A52] to-[#4A7C59] p-5 text-white shadow-lg">
        <div className="flex items-center gap-2">
          <WinnerTalkIcon size={32} className="brightness-200" />
          <h1 className="text-xl font-bold">🐿️ 토리톡</h1>
        </div>
        <p className="mt-2 text-sm text-[#D4E4BC]">
          숲에서 함께하는 우리들의 이야기
        </p>
      </section>

      <section className="rounded-3xl border-2 border-dashed border-[#D4E4BC] bg-white/70 p-8 text-center shadow-sm">
        <p className="text-4xl" aria-hidden>
          💬
        </p>
        <p className="mt-3 text-base font-bold text-[#2D5A3D]">
          토리톡은 곧 출시돼요
        </p>
        <p className="mt-2 text-xs leading-relaxed text-[#6B6560]">
          참가자·기관 간 실시간 대화 기능을 준비 중이에요.
          <br />
          행사 동안에는 <b>홈</b>의 토리FM 사연·신청곡으로 소통할 수 있어요.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Link
            href="/home"
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#2D5A3D] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#234a30]"
          >
            <span aria-hidden>🏠</span>
            <span>홈으로</span>
          </Link>
          <Link
            href="/tori-fm"
            className="inline-flex items-center gap-1.5 rounded-xl border border-[#D4E4BC] bg-white px-4 py-2.5 text-sm font-bold text-[#2D5A3D] transition hover:bg-[#F5F1E8]"
          >
            <span aria-hidden>📻</span>
            <span>토리FM 가기</span>
          </Link>
        </div>
      </section>
    </div>
  );
}
