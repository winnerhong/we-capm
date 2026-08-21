import Link from "next/link";
import { requireEventContext } from "@/lib/event-context";
import { loadLiveBoardsForOrg } from "@/lib/bingo/queries";

export const dynamic = "force-dynamic";

export default async function BingoListPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const ctx = await requireEventContext(eventId);

  const boards = await loadLiveBoardsForOrg(ctx.orgId);

  return (
    <div className="mx-auto max-w-md space-y-4 px-4 py-6">
      <header>
        <h1 className="text-2xl font-bold text-[#2D5A3D]">🎯 진행중 빙고</h1>
        <p className="mt-1 text-sm text-[#6B6560]">
          {ctx.event.name} 의 빙고 게임에 참여해 보세요.
        </p>
      </header>

      {boards.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#D4E4BC] bg-white p-10 text-center">
          <div className="text-5xl" aria-hidden>
            🎯
          </div>
          <p className="mt-3 text-sm font-bold text-[#2D5A3D]">
            지금 진행 중인 빙고가 없어요
          </p>
          <p className="mt-1 text-xs text-[#6B6560]">
            행사 운영자가 시작하면 이곳에 노출돼요.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {boards.map((b) => (
            <li key={b.id}>
              <Link
                href={ctx.href(`/bingo/${b.id}`)}
                className="block rounded-2xl border-2 border-emerald-300 bg-white p-4 shadow-sm transition hover:shadow-md"
              >
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-bold text-white">
                    🟢 진행중
                  </span>
                  <span className="rounded-full bg-[#FAE7D0] px-2 py-0.5 text-[10px] font-bold text-[#6B4423]">
                    {b.size}×{b.size}
                  </span>
                  <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-bold text-violet-700 ring-1 ring-violet-200">
                    {b.lines_to_win}줄 완성
                  </span>
                </div>
                <h2 className="mt-2 text-base font-bold text-[#2D5A3D]">{b.name}</h2>
                {b.keyword_theme && (
                  <p className="mt-1 text-xs text-[#6B6560]">🗝 {b.keyword_theme}</p>
                )}
                <p className="mt-2 text-[11px] text-emerald-700">참가하러 가기 →</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
