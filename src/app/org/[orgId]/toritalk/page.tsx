import Link from "next/link";
import { redirect } from "next/navigation";
import { requireOrg } from "@/lib/org-auth-guard";
import {
  isToritalkEnabled,
  loadOrgRoomsWithStats,
} from "@/lib/toritalk/queries";
import { fmtFullDateKst } from "@/lib/datetime/kst";
import { ToritalkEnableToggle } from "./enable-toggle";
import { CreateRoomCard } from "./create-room-card";

export const dynamic = "force-dynamic";

export default async function OrgToritalkPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  const org = await requireOrg();
  if (org.orgId !== orgId) redirect(`/org/${org.orgId}/toritalk`);

  const [enabled, rooms] = await Promise.all([
    isToritalkEnabled(orgId),
    loadOrgRoomsWithStats(orgId),
  ]);

  const active = rooms.filter((r) => !r.archived);
  const archived = rooms.filter((r) => r.archived);

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6">
      <header className="space-y-2">
        <p className="text-xs font-semibold text-[#8B7F75]">5단계 · 진행</p>
        <h1 className="text-2xl font-bold text-[#2D5A3D]">💬 토리톡 관리</h1>
        <p className="text-sm text-[#6B6560]">
          반(방) 단위 채팅 기능을 활성화하고 운영하세요. 1방 최대 35명까지
          입장할 수 있습니다.
        </p>
      </header>

      {/* 활성화 토글 */}
      <section className="rounded-2xl border-2 border-[#D4E4BC] bg-white p-5 shadow-sm">
        <ToritalkEnableToggle orgId={orgId} enabled={enabled} />
      </section>

      {!enabled ? (
        <section className="rounded-2xl border border-dashed border-[#D4E4BC] bg-[#FFF8F0] p-6 text-center">
          <p className="text-3xl" aria-hidden>
            💤
          </p>
          <p className="mt-2 text-sm font-bold text-[#2D5A3D]">
            토리톡이 비활성 상태에요
          </p>
          <p className="mt-1 text-xs text-[#6B6560]">
            위 토글을 켜면 방을 만들고 참가자를 초대할 수 있어요.
          </p>
        </section>
      ) : (
        <>
          {/* 방 생성 */}
          <CreateRoomCard orgId={orgId} />

          {/* 활성 방 목록 */}
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-[#2D5A3D]">
              운영 중인 방 ({active.length})
            </h2>
            {active.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#D4E4BC] bg-[#FFF8F0] p-6 text-center text-sm text-[#6B6560]">
                아직 방이 없어요. 위에서 새 방을 만들어 보세요.
              </div>
            ) : (
              <ul className="grid gap-3 md:grid-cols-2">
                {active.map((r) => {
                  // 기본값 보강: 정책 필드가 NULL/undefined 면 마이그레이션 직후 default 와 동일하게 처리.
                  const allowSelfJoin = r.allow_self_join ?? false;
                  const isListed = r.is_listed ?? true;
                  return (
                    <li key={r.id}>
                      <Link
                        href={`/org/${orgId}/toritalk/${r.id}`}
                        className="block rounded-2xl border border-[#D4E4BC] bg-white p-4 shadow-sm transition hover:border-[#2D5A3D] hover:shadow-md"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-base font-bold text-[#2D5A3D]">
                              {r.name}
                            </p>
                            {r.description && (
                              <p className="mt-0.5 truncate text-xs text-[#6B6560]">
                                {r.description}
                              </p>
                            )}
                          </div>
                          <span className="shrink-0 rounded-full bg-[#E8F0E4] px-2 py-0.5 text-[10px] font-bold text-[#2D5A3D]">
                            {r.member_count}/{r.max_members}명
                          </span>
                        </div>

                        {/* 공개 정책 chip — 누가 들어올 수 있는지·둘러보기 노출 여부 */}
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          <span
                            className={`inline-flex items-center gap-0.5 rounded-full border px-2 py-0.5 text-[10px] font-bold ${
                              allowSelfJoin
                                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                : "border-amber-200 bg-amber-50 text-amber-700"
                            }`}
                            title={
                              allowSelfJoin
                                ? "다른 반 보호자도 셀프 입장 가능"
                                : "관리자 초대만 — 같은 반은 자동 가입"
                            }
                          >
                            {allowSelfJoin ? "🌐 누구나 입장" : "✋ 같은 반만"}
                          </span>
                          <span
                            className={`inline-flex items-center gap-0.5 rounded-full border px-2 py-0.5 text-[10px] font-bold ${
                              isListed
                                ? "border-sky-200 bg-sky-50 text-sky-700"
                                : "border-zinc-200 bg-zinc-100 text-zinc-600"
                            }`}
                            title={
                              isListed
                                ? "참가자 '다른 방 둘러보기' 에 노출"
                                : "목록에서 숨김 — 멤버만 보임"
                            }
                          >
                            {isListed ? "👁️ 목록 노출" : "🙈 비공개"}
                          </span>
                        </div>

                        <div className="mt-3 rounded-xl bg-[#FFF8F0] px-3 py-2 text-[11px] text-[#6B6560]">
                          {r.last_message_preview ? (
                            <span className="line-clamp-1">
                              💬 {r.last_message_preview}
                            </span>
                          ) : (
                            <span>아직 대화가 없어요</span>
                          )}
                        </div>
                        <p className="mt-2 text-[10px] text-[#8B7F75]">
                          생성: {fmtFullDateKst(r.created_at)}
                        </p>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {archived.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-base font-bold text-[#8B7F75]">
                보관함 ({archived.length})
              </h2>
              <ul className="grid gap-2 md:grid-cols-2">
                {archived.map((r) => (
                  <li key={r.id}>
                    <Link
                      href={`/org/${orgId}/toritalk/${r.id}`}
                      className="block rounded-xl border border-[#D4E4BC]/60 bg-[#FFF8F0] p-3 text-sm text-[#6B6560] transition hover:bg-white"
                    >
                      <span className="font-semibold">{r.name}</span>
                      <span className="ml-2 text-[10px]">
                        ({r.member_count}명)
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
