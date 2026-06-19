import Link from "next/link";
import { requireOrg } from "@/lib/org-auth-guard";
import { loadBoardsByOrg } from "@/lib/bingo/queries";
import { BINGO_STATUS_META } from "@/lib/bingo/types";
import { fmtFullDateKst } from "@/lib/datetime/kst";

export const dynamic = "force-dynamic";

export default async function OrgBingoListPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  await requireOrg();
  const boards = await loadBoardsByOrg(orgId);

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-6">
      <nav className="text-xs text-[#8B7F75]">
        <Link href={`/org/${orgId}`} className="hover:text-[#2D5A3D]">
          기관 홈
        </Link>
        <span className="mx-2">/</span>
        <span className="font-semibold text-[#2D5A3D]">🎯 빙고</span>
      </nav>

      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#2D5A3D]">🎯 토리 빙고</h1>
          <p className="mt-1 text-sm text-[#6B6560]">
            가족 사진+키워드로 즐기는 협업형 빙고 게임을 만들고 운영해요.
          </p>
        </div>
        <Link
          href={`/org/${orgId}/bingo/new`}
          className="rounded-xl bg-[#2D5A3D] px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-[#234A31]"
        >
          + 새 빙고 만들기
        </Link>
      </header>

      {boards.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#D4E4BC] bg-white p-10 text-center">
          <div className="text-5xl" aria-hidden>
            🎯
          </div>
          <p className="mt-3 text-sm font-bold text-[#2D5A3D]">
            아직 만들어진 빙고가 없어요
          </p>
          <p className="mt-1 text-xs text-[#6B6560]">
            새 빙고를 만들고 시작하면 참가자 사이트에 자동으로 노출돼요.
          </p>
        </div>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {boards.map((b) => {
            const meta = BINGO_STATUS_META[b.status];
            return (
              <li key={b.id}>
                <Link
                  href={`/org/${orgId}/bingo/${b.id}`}
                  className="block rounded-2xl border border-[#D4E4BC] bg-white p-4 shadow-sm transition hover:border-[#2D5A3D] hover:shadow-md"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ${meta.chip}`}
                    >
                      {meta.label}
                    </span>
                    <span className="ml-auto rounded-full bg-[#FAE7D0] px-2 py-0.5 text-[10px] font-bold text-[#6B4423]">
                      {b.size}×{b.size}
                    </span>
                    <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-bold text-violet-700 ring-1 ring-violet-200">
                      {b.lines_to_win}줄 승리
                    </span>
                  </div>
                  <h2 className="mt-2 text-base font-bold text-[#2D5A3D]">
                    {b.name}
                  </h2>
                  {b.keyword_theme && (
                    <p className="mt-1 text-xs text-[#6B6560]">
                      🗝 {b.keyword_theme}
                    </p>
                  )}
                  <p className="mt-2 text-[11px] text-[#8B7F75]">
                    {fmtFullDateKst(b.created_at)}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
