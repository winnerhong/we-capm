import Link from "next/link";
import { WinnerTalkIcon } from "@/components/winner-talk-icon";

export default function EventLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  return (
    <>
      {children}
      <EventTabBar paramsPromise={params} />
    </>
  );
}

async function EventTabBar({ paramsPromise }: { paramsPromise: Promise<{ id: string }> }) {
  const { id } = await paramsPromise;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-white pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto flex max-w-lg">
        <Link href={`/event/${id}`} className="flex flex-1 flex-col items-center gap-0.5 py-2 text-xs hover:bg-neutral-50">
          <span className="text-lg">🏠</span><span>홈</span>
        </Link>
        <Link href={`/event/${id}/missions`} className="flex flex-1 flex-col items-center gap-0.5 py-2 text-xs hover:bg-neutral-50">
          <span className="text-lg">🎯</span><span>숲길</span>
        </Link>
        <Link href={`/event/${id}/chat`} className="flex flex-1 flex-col items-center gap-0.5 py-2 text-xs hover:bg-neutral-50">
          <WinnerTalkIcon size={22} /><span>토리톡</span>
        </Link>
        <Link href={`/event/${id}/leaderboard`} className="flex flex-1 flex-col items-center gap-0.5 py-2 text-xs hover:bg-neutral-50">
          <span className="text-lg">🏆</span><span>숲지기 순위</span>
        </Link>
        <Link href={`/event/${id}/stamps`} className="flex flex-1 flex-col items-center gap-0.5 py-2 text-xs hover:bg-neutral-50">
          <span className="text-lg">🌰</span><span>도토리</span>
        </Link>
      </div>
    </nav>
  );
}
