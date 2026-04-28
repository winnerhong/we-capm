import Link from "next/link";
import { requireOrg } from "@/lib/org-auth-guard";
import { loadOrgEventSummaries } from "@/lib/org-events/queries";
import { bulkImportAppUsersAction } from "./actions";
import { BulkImportForm } from "./csv-preview";

export const dynamic = "force-dynamic";

export default async function OrgUsersBulkImportPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string }>;
  searchParams: Promise<{ event?: string }>;
}) {
  const { orgId } = await params;
  const sp = await searchParams;
  await requireOrg();

  // 행사 목록 + 선택 행사 검증
  const events = await loadOrgEventSummaries(orgId);
  const requestedEventId = (sp.event ?? "").trim();
  const selectedEvent =
    requestedEventId && events.find((e) => e.event_id === requestedEventId)
      ? events.find((e) => e.event_id === requestedEventId) ?? null
      : null;

  const baseHref = `/org/${orgId}/users/bulk-import`;

  // 일괄 액션 — 행사 선택 시 해당 행사 자동 연결
  const action = bulkImportAppUsersAction.bind(
    null,
    orgId,
    selectedEvent?.event_id ?? null
  );

  return (
    <div
      className={`min-h-dvh ${selectedEvent ? "bg-emerald-50/30" : ""}`}
    >
      {/* Sticky 컨텍스트 바 */}
      {selectedEvent && (
        <div
          role="status"
          className="sticky top-[64px] z-30 border-b-2 border-emerald-500/40 bg-gradient-to-r from-emerald-600 via-[#2D5A3D] to-emerald-600 text-white shadow-md"
        >
          <div className="mx-auto flex max-w-4xl items-center gap-2 px-4 py-2 text-xs font-semibold">
            <span aria-hidden>📍</span>
            <span className="truncate">
              <b>{selectedEvent.name || "(이름 없음)"}</b> 행사로 일괄 등록 중
            </span>
            <Link
              href={baseHref}
              className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-bold text-white transition hover:bg-white/25"
              aria-label="필터 해제하고 기관 전체로 등록"
            >
              <span aria-hidden>✕</span>
              <span>전체로</span>
            </Link>
          </div>
        </div>
      )}

      <div className="mx-auto max-w-4xl space-y-6 px-4 py-6">
        {/* Breadcrumb */}
        <nav aria-label="breadcrumb" className="text-xs text-[#8B7F75]">
          <Link href={`/org/${orgId}`} className="hover:text-[#2D5A3D]">
            기관 홈
          </Link>
          <span className="mx-2">/</span>
          <Link
            href={`/org/${orgId}/users`}
            className="hover:text-[#2D5A3D]"
          >
            참가자 관리
          </Link>
          <span className="mx-2">/</span>
          <span className="font-semibold text-[#2D5A3D]">일괄 등록</span>
        </nav>

        {/* Header — 행사 모드면 hero, 아니면 기본 */}
        {selectedEvent ? (
          <header className="relative overflow-hidden rounded-3xl border-2 border-emerald-300 shadow-md">
            {selectedEvent.cover_image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={selectedEvent.cover_image_url}
                alt=""
                aria-hidden
                className="absolute inset-0 h-full w-full object-cover"
              />
            ) : (
              <div
                aria-hidden
                className="absolute inset-0 bg-gradient-to-br from-emerald-100 via-[#D4E4BC] to-emerald-300"
              />
            )}
            <div
              aria-hidden
              className="absolute inset-0 bg-gradient-to-br from-black/65 via-black/40 to-black/55"
            />
            <div className="relative z-[1] p-5 text-white md:p-6">
              <p className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white backdrop-blur-sm">
                📍 이 행사로 일괄 등록
              </p>
              <h1 className="mt-3 text-xl font-extrabold leading-tight drop-shadow-md md:text-2xl">
                📥 {selectedEvent.name || "(이름 없음)"} — CSV 일괄 등록
              </h1>
              <p className="mt-1 text-xs text-white/95 drop-shadow md:text-sm">
                CSV 파일의 모든 참가자가 이 행사 명단에 자동 연결돼요.
              </p>
            </div>
          </header>
        ) : (
          <header className="rounded-3xl border border-[#D4E4BC] bg-gradient-to-br from-[#E8F0E4] via-white to-[#FAE7D0] p-5 shadow-sm md:p-7">
            <div className="flex items-center gap-3">
              <span className="text-3xl" aria-hidden>
                🌱
              </span>
              <div className="min-w-0 flex-1">
                <h1 className="text-xl font-bold text-[#2D5A3D] md:text-2xl">
                  참가자 일괄 등록
                </h1>
                <p className="mt-1 text-xs text-[#6B6560] md:text-sm">
                  🔑 <b>아이디 = 전화번호</b> · 같은 번호는 한 계정으로 묶여요
                </p>
              </div>
            </div>
          </header>
        )}

        {/* 행사별 필터 */}
        {events.length > 0 && (
          <section
            aria-label="행사별 필터"
            className="rounded-2xl border border-[#D4E4BC] bg-white p-3 shadow-sm"
          >
            <p className="mb-2 px-1 text-[11px] font-bold text-[#6B6560]">
              🎪 어디에 등록할까요?
            </p>
            <div className="flex flex-wrap gap-1.5">
              <Link
                href={baseHref}
                className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                  !selectedEvent
                    ? "border-[#2D5A3D] bg-[#2D5A3D] text-white"
                    : "border-[#D4E4BC] bg-white text-[#6B6560] hover:border-[#2D5A3D] hover:text-[#2D5A3D]"
                }`}
              >
                <span>기관 전체 (행사 미연결)</span>
              </Link>
              {events.map((e) => {
                const active = selectedEvent?.event_id === e.event_id;
                const isLive = e.status === "LIVE";
                return (
                  <Link
                    key={e.event_id}
                    href={`${baseHref}?event=${e.event_id}`}
                    className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                      active
                        ? "border-[#2D5A3D] bg-[#2D5A3D] text-white"
                        : isLive
                          ? "border-emerald-400 bg-emerald-50 text-emerald-800 hover:border-emerald-600"
                          : "border-[#D4E4BC] bg-white text-[#6B6560] hover:border-[#2D5A3D] hover:text-[#2D5A3D]"
                    }`}
                  >
                    {isLive && (
                      <span
                        className="relative inline-flex h-1.5 w-1.5"
                        aria-hidden
                      >
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" />
                        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-rose-500" />
                      </span>
                    )}
                    <span className="max-w-[12rem] truncate">
                      {e.name || "(이름 없음)"}
                    </span>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {/* 폼 — 행사 선택 필수. 전체 모드에서는 안내. */}
        {selectedEvent ? (
          <BulkImportForm orgId={orgId} action={action} />
        ) : (
          <section
            aria-label="행사 선택 필요"
            className="rounded-2xl border-2 border-dashed border-[#E5D3B8] bg-[#FFFDF8] px-5 py-8 text-center"
          >
            <div className="mb-2 text-4xl" aria-hidden>
              🎪
            </div>
            <p className="text-base font-bold text-[#2D5A3D]">
              먼저 어느 행사에 등록할지 선택해 주세요
            </p>
            <p className="mt-1 text-xs text-[#6B6560]">
              참가자는 <b>행사별로 따로</b> 등록해요. 위쪽 행사 칩에서 등록할
              행사를 고르면 일괄 등록 폼이 활성화됩니다.
            </p>
            {events.length === 0 && (
              <Link
                href={`/org/${orgId}/events/new`}
                className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-[#2D5A3D] px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-[#234a30]"
              >
                <span aria-hidden>➕</span>
                <span>먼저 새 행사 만들기</span>
              </Link>
            )}
          </section>
        )}

        <div className="text-center">
          <Link
            href={`/org/${orgId}/users${selectedEvent ? `?event=${selectedEvent.event_id}` : ""}`}
            className="text-xs text-[#6B6560] hover:text-[#2D5A3D]"
          >
            ← 참가자 목록으로 돌아가기
          </Link>
        </div>
      </div>
    </div>
  );
}
