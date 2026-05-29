import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getAppUser } from "@/lib/user-auth-guard";
import { loadLiveEventsForSameOrgAs } from "@/lib/org-events/queries";
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

  // 행사 노출 정책 — "초대장 링크로 들어왔을 때만" 그 기관의 LIVE 행사 노출.
  //   ?org=  : 참가자 로그인 공유 / 로그아웃 폴백 — 행사 목록 노출하지 않음.
  //   직접 진입 / 로그아웃 : 행사 목록 노출하지 않음. 핸드폰만 입력해 바로 입장.
  const invitationMatch = returnTo
    ? returnTo.match(/^\/invitation\/([0-9a-fA-F-]{8,})/)
    : null;
  const invitationEventId = invitationMatch?.[1] ?? null;
  const orgIdParam =
    typeof sp.org === "string" && /^[0-9a-fA-F-]{8,}$/.test(sp.org)
      ? sp.org
      : null;

  const existing = await getAppUser();
  if (existing && !orgIdParam) {
    // 이미 로그인 + 일반 진입 → 초대장 같은 원래 가려던 곳 또는 home 으로.
    //   ?org=<orgId> 로 들어온 경우(기관 참가자 링크)는 의도적으로 자동
    //   리다이렉트하지 않고 로그인 폼을 다시 보여줌 — 운영자가 공유한 링크는
    //   "이 기관 계정으로 새로 입장" 의미이므로 매번 연락처를 재입력.
    redirect(returnTo ?? "/home");
  }

  const initialError =
    typeof sp.error === "string" && sp.error.trim() ? sp.error : null;

  // 초대장 링크 진입에서만 행사 노출. 그 외(직접 방문 / 로그아웃 / 기관 참가자
  // 링크 ?org=)에서는 행사 목록 숨기고 로그인 폼만 보여줌.
  const liveEvents = invitationEventId
    ? await loadLiveEventsForSameOrgAs(invitationEventId)
    : [];

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
              // 라이브 이벤트가 정확히 1개일 때만 자동 안내(초대장으로 직행).
              // 단, 기관 참가자 로그인 공유 링크(?org=)로 들어왔다면 — 운영자
              // 의도가 "웹앱으로 바로 입장" — 이므로 무조건 /home 으로 보냄.
              liveEventId={
                orgIdParam
                  ? null
                  : liveEvents.length === 1
                    ? liveEvents[0].id
                    : null
              }
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
