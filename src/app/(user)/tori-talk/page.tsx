import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAppUser } from "@/lib/user-auth-guard";
import { loadActiveEventsForUser } from "@/lib/org-events/queries";
import { WinnerTalkIcon } from "@/components/winner-talk-icon";

export const dynamic = "force-dynamic";

export default async function ToriTalkHubPage() {
  const user = await requireAppUser();
  const activeEvents = await loadActiveEventsForUser(user.id);

  if (activeEvents.length === 1) {
    redirect(`/event/${activeEvents[0].id}/chat`);
  }

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

      {activeEvents.length === 0 ? (
        <section className="rounded-3xl border-2 border-dashed border-[#D4E4BC] bg-white/70 p-8 text-center shadow-sm">
          <p className="text-4xl" aria-hidden>
            🌱
          </p>
          <p className="mt-3 text-base font-bold text-[#2D5A3D]">
            아직 참여 중인 행사가 없어요
          </p>
          <p className="mt-1 text-xs text-[#6B6560]">
            행사에 참가하면 참가자들과 토리톡으로 이야기를 나눌 수 있어요
          </p>
          <Link
            href="/home"
            className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-[#2D5A3D] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#234a30]"
          >
            <span aria-hidden>🏠</span>
            <span>홈으로</span>
          </Link>
        </section>
      ) : (
        <section className="space-y-3">
          <p className="text-xs font-semibold text-[#6B6560]">
            어떤 행사의 토리톡을 열까요?
          </p>
          <ul className="space-y-2">
            {activeEvents.map((e) => (
              <li key={e.id}>
                <Link
                  href={`/event/${e.id}/chat`}
                  className="flex items-center gap-3 rounded-2xl border border-[#D4E4BC] bg-white p-4 shadow-sm transition hover:border-[#2D5A3D] hover:bg-[#F5F1E8]"
                >
                  <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-[#E8F0E4] text-2xl">
                    🎪
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-[#2D5A3D]">
                      {e.name}
                    </p>
                    <p className="text-[11px] text-[#6B6560]">
                      토리톡 열기 →
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
