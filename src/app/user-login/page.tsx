import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getAppUser } from "@/lib/user-auth-guard";
import {
  loadAllLiveEvents,
  loadLiveEventsForOrg,
  loadLiveEventsForSameOrgAs,
} from "@/lib/org-events/queries";
import { fmtFullDateKst, fmtAmPmClockKst } from "@/lib/datetime/kst";
import { LoginForm } from "./login-form";
import { AcornIcon } from "@/components/acorn-icon";

export const dynamic = "force-dynamic";

function formatEventWindow(
  startsAt: string | null,
  endsAt: string | null
): { dateLabel: string; timeLabel: string } {
  if (!startsAt) return { dateLabel: "", timeLabel: "" };
  const dateLabel = fmtFullDateKst(startsAt);
  const startLabel = fmtAmPmClockKst(startsAt);
  const endLabel = endsAt ? fmtAmPmClockKst(endsAt) : "";
  return {
    dateLabel,
    timeLabel: endLabel ? `${startLabel} ~ ${endLabel}` : startLabel,
  };
}

function safeReturnPath(raw: unknown): string | null {
  if (typeof raw !== "string" || !raw) return null;
  if (!raw.startsWith("/")) return null;
  if (raw.startsWith("//") || raw.startsWith("/\\")) return null;
  if (raw.length > 500) return null;
  return raw;
}

export default async function UserLoginPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string; return?: string; org?: string }>;
}) {
  const sp = (await searchParams) ?? {};
  // 초대장 등에서 ?return= 으로 보내준 경로가 있으면 우선 처리.
  const returnTo = safeReturnPath(sp.return);

  const existing = await getAppUser();
  if (existing) {
    // 이미 로그인 → 초대장 같은 원래 가려던 곳이 있으면 거기로, 아니면 home
    redirect(returnTo ?? "/home");
  }

  const initialError =
    typeof sp.error === "string" && sp.error.trim() ? sp.error : null;

  // 행사 노출 스코핑 — 우선순위: 초대장 링크 → ?org= 파라미터(기관 참가자 링크) → 전체.
  //   초대장: /invitation/{eventId} → 그 행사가 속한 기관의 LIVE 만.
  //   ?org=  : 기관 관리자 페이지의 "참가자 링크" 가 붙임 → 그 기관의 LIVE 만.
  const invitationMatch = returnTo
    ? returnTo.match(/^\/invitation\/([0-9a-fA-F-]{8,})/)
    : null;
  const invitationEventId = invitationMatch?.[1] ?? null;
  const orgIdParam =
    typeof sp.org === "string" && /^[0-9a-fA-F-]{8,}$/.test(sp.org)
      ? sp.org
      : null;

  const liveEvents = invitationEventId
    ? await loadLiveEventsForSameOrgAs(invitationEventId)
    : orgIdParam
      ? await loadLiveEventsForOrg(orgIdParam)
      : await loadAllLiveEvents();

  return (
    <main className="flex min-h-dvh items-center justify-center bg-gradient-to-b from-[#FFF8F0] via-[#F5F1E8] to-[#E8F0E4] px-4 py-10">
      <div className="w-full max-w-md space-y-6">
        {/* Logo / heading */}
        <div className="text-center">
          <div
            className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-[#D4E4BC] to-[#FAE7D0] text-[#2D5A3D] shadow-md"
          >
            <AcornIcon size={40} />
          </div>
          <h1 className="mt-4 text-2xl font-bold text-[#2D5A3D]">
            토리로에 오신 걸 환영해요
          </h1>
          <p className="mt-1.5 text-sm text-[#6B6560]">
            학부모 연락처만 입력하면 바로 입장돼요
          </p>
        </div>

        {/* 진행 중인 행사 — 있을 때만 노출 */}
        {liveEvents.length > 0 && (
          <section className="space-y-2">
            <div className="flex items-center gap-2 px-1">
              <span className="inline-flex h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
              <h2 className="text-xs font-bold uppercase tracking-wide text-emerald-700">
                지금 진행 중 ({liveEvents.length})
              </h2>
            </div>
            <ul className="space-y-2">
              {liveEvents.map((e) => {
                const { dateLabel, timeLabel } = formatEventWindow(
                  e.starts_at,
                  e.ends_at
                );
                return (
                  <li key={e.id}>
                    <article className="overflow-hidden rounded-3xl border border-[#D4E4BC] bg-white shadow-sm">
                      {e.cover_image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={e.cover_image_url}
                          alt={e.name}
                          className="aspect-[16/9] w-full object-cover"
                        />
                      ) : (
                        <div className="aspect-[16/9] w-full bg-gradient-to-br from-[#D4E4BC] via-[#E8F0E4] to-[#FAE7D0]" />
                      )}
                      <div className="space-y-1 p-4">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 ring-1 ring-emerald-200">
                            <span className="inline-flex h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                            진행중
                          </span>
                          {e.org_name && (
                            <span className="truncate text-[11px] font-semibold text-[#6B6560]">
                              🌲 {e.org_name}
                            </span>
                          )}
                        </div>
                        <h3 className="truncate text-base font-bold text-[#2D5A3D]">
                          {e.name || "(이름 없음)"}
                        </h3>
                        {dateLabel && (
                          <p className="text-xs text-[#6B6560]">
                            📅 {dateLabel}
                            {timeLabel && (
                              <span className="ml-1.5 font-mono text-[#8B7F75]">
                                {timeLabel}
                              </span>
                            )}
                          </p>
                        )}
                      </div>
                    </article>
                  </li>
                );
              })}
            </ul>
            {/* 행사 카드 바로 아래 안내 — 행사장 위치·식순은 로그인 후 노출됨 */}
            <div className="rounded-2xl border-2 border-amber-300 bg-amber-50 px-4 py-3 text-center shadow-sm">
              <p className="text-sm font-bold text-amber-900">
                📍 행사 장소와 식순을 보시려면
              </p>
              <p className="mt-1 text-xs text-amber-800">
                아래에 <b>등록된 학부모 연락처</b>를 입력해 주세요!
              </p>
            </div>
          </section>
        )}

        {/* Card */}
        <section className="rounded-3xl border border-[#D4E4BC] bg-white/80 p-6 shadow-sm backdrop-blur-sm">
          <Suspense fallback={<div className="h-40" aria-hidden />}>
            <LoginForm
              initialError={initialError}
              // 라이브 이벤트가 정확히 1개일 때만 자동 안내. 여러 개면 사용자가
              // home 에서 직접 선택하도록 둠.
              liveEventId={liveEvents.length === 1 ? liveEvents[0].id : null}
            />
          </Suspense>
        </section>

        {/* Help */}
        <p className="text-center text-xs text-[#8B7F75]">
          로그인이 안 되나요? 기관(어린이집·학교)에 문의해주세요.
        </p>

        <div className="flex justify-center">
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-xs text-[#8B7F75] transition hover:text-[#2D5A3D]"
          >
            ← 첫 화면으로
          </Link>
        </div>
      </div>
    </main>
  );
}
