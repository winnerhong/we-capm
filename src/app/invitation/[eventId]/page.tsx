import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { getAppUser } from "@/lib/user-auth-guard";
import { loadOrgEventById } from "@/lib/org-events/queries";
import { loadAppUserById } from "@/lib/app-user/queries";
import { loadPartnerDisplayNameForOrg } from "@/lib/org-partner";
import { loadTimelineSlots } from "@/lib/event-timeline/queries";
import { TimelineCollapsible } from "./timeline-collapsible";
// 시간 포맷은 KST 강제 (SSR/CSR 일치 보장).
import {
  fmtAmPmClockKst,
  fmtClockKstAlways,
  fmtKoreanLongDateKst,
} from "@/lib/datetime/kst";
import { CopyButton } from "./copy-button";

export const dynamic = "force-dynamic";

const fmtFullDate = fmtKoreanLongDateKst;
const fmtClock = fmtAmPmClockKst;

function fmtDuration(startsAt: string | null, endsAt: string | null): string {
  if (!startsAt || !endsAt) return "";
  const start = new Date(startsAt).getTime();
  const end = new Date(endsAt).getTime();
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return "";
  const totalMin = Math.round((end - start) / 60000);
  const days = Math.floor(totalMin / (60 * 24));
  const hours = Math.floor((totalMin % (60 * 24)) / 60);
  const mins = totalMin % 60;
  const parts: string[] = [];
  if (days) parts.push(`${days}일`);
  if (hours) parts.push(`${hours}시간`);
  if (mins) parts.push(`${mins}분`);
  return parts.join(" ");
}

function fmtSlotTime(iso: string): string {
  return fmtClockKstAlways(iso);
}

/**
 * 슬롯 시작 시각을 행사 시작 시각 + 누적 길이로 재계산.
 *  - DB 의 slot.starts_at 는 행사 시각이 바뀐 후 timeline 재저장이 안 됐으면
 *    구 값일 수 있어, 항상 event.starts_at 기준 누적으로 표시하는 게 안전.
 *  - duration = ends_at - starts_at (둘 다 있을 때) / 없으면 0 분.
 */
function computeSlotDisplayTimes(
  eventStartsAt: string | null,
  slots: Array<{ starts_at: string; ends_at: string | null }>
): Array<{ start: string; end: string | null; durationMin: number | null }> {
  if (!eventStartsAt || slots.length === 0) {
    return slots.map((s) => ({
      start: fmtSlotTime(s.starts_at),
      end: s.ends_at ? fmtSlotTime(s.ends_at) : null,
      durationMin: null,
    }));
  }
  const startMs = new Date(eventStartsAt).getTime();
  if (!Number.isFinite(startMs)) {
    return slots.map((s) => ({
      start: fmtSlotTime(s.starts_at),
      end: s.ends_at ? fmtSlotTime(s.ends_at) : null,
      durationMin: null,
    }));
  }
  let cursor = startMs;
  const out: Array<{ start: string; end: string | null; durationMin: number | null }> = [];
  for (const s of slots) {
    const sMs = new Date(s.starts_at).getTime();
    const eMs = s.ends_at ? new Date(s.ends_at).getTime() : NaN;
    const durMs =
      Number.isFinite(sMs) && Number.isFinite(eMs) && eMs > sMs ? eMs - sMs : 0;
    const slotStart = cursor;
    const slotEnd = cursor + durMs;
    out.push({
      start: fmtSlotTime(new Date(slotStart).toISOString()),
      end: durMs > 0 ? fmtSlotTime(new Date(slotEnd).toISOString()) : null,
      durationMin: durMs > 0 ? Math.round(durMs / 60000) : null,
    });
    cursor = slotEnd;
  }
  return out;
}

/** 행사 시작까지 남은 일수. 오늘이면 0, 지났으면 음수. */
function calcDDay(startsAt: string | null): number | null {
  if (!startsAt) return null;
  const start = new Date(startsAt);
  if (Number.isNaN(start.getTime())) return null;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const eventDate = new Date(
    start.getFullYear(),
    start.getMonth(),
    start.getDate()
  );
  return Math.round(
    (eventDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );
}

/** D-day 라벨: D-DAY / D-32 / D+3 (지난 행사) */
function fmtDDayLabel(d: number): string {
  if (d === 0) return "D-DAY";
  if (d > 0) return `D-${d}`;
  return `D+${-d}`;
}

/**
 * 지도 서비스 딥링크 — 카카오 / 네이버 / 티맵.
 *  - 카카오·네이버는 웹 URL 로 검색 결과 페이지 오픈.
 *  - 티맵은 mobile 전용 deep-link (앱 미설치/PC 환경에서는 동작 안 함).
 */
function buildMapUrls(query: string): {
  kakao: string;
  naver: string;
  tmap: string;
} {
  const q = encodeURIComponent(query);
  return {
    kakao: `https://map.kakao.com/?q=${q}`,
    naver: `https://map.naver.com/v5/search/${q}`,
    tmap: `tmap://search?name=${q}`,
  };
}

/**
 * OG 메타 — 카카오톡/페이스북 등에 공유할 때 미리보기 카드.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ eventId: string }>;
}): Promise<Metadata> {
  const { eventId } = await params;
  const event = await loadOrgEventById(eventId).catch(() => null);
  if (!event) {
    return {
      title: "초대장",
      description: "토리로 — 우리 아이 첫 캠프의 추억",
    };
  }
  const date = fmtFullDate(event.starts_at);
  const message = event.invitation_message || "함께 즐거운 시간을 만들어요";
  return {
    title: `${event.name} — 초대장`,
    description: `📅 ${date} · ${message}`,
    openGraph: {
      title: `${event.name} — 초대장`,
      description: `📅 ${date} · ${message}`,
      images: event.cover_image_url ? [event.cover_image_url] : [],
      type: "website",
    },
  };
}

export default async function EventInvitationPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;

  // 로그인 — 미로그인이면 로그인 페이지로 리다이렉트 (return URL 포함)
  const session = await getAppUser();
  if (!session) {
    redirect(`/user-login?return=/invitation/${eventId}`);
  }

  const [event, user] = await Promise.all([
    loadOrgEventById(eventId),
    loadAppUserById(session.id),
  ]);

  if (!event) notFound();

  // 행사 미발행 — 초안 안내
  if (!event.invitation_published_at) {
    return <PendingState eventName={event.name} />;
  }

  // 기관 완전 분리 — 다른 기관 계정으로 로그인한 상태면 차단.
  //  - 비로그인: 초대장 링크(UUID)가 credential → 열람 허용 (참여 시 로그인 유도)
  //  - 같은 기관 로그인: 허용
  //  - 다른 기관 로그인: 차단 (로그아웃 후 재시도 안내)
  // 이 페이지는 (user) 레이아웃 밖이라 다른 기관 헤더 chrome 이 새지 않음.
  if (user && user.org_id !== event.org_id) {
    return <NoAccessState eventId={eventId} />;
  }

  const orgName = await loadPartnerDisplayNameForOrg(event.org_id).catch(
    () => null
  );

  // 타임테이블 — 행사 전체 흐름을 모두 노출 (참가자가 미리 보고 준비할 수 있도록)
  const slots = await loadTimelineSlots(eventId).catch(() => []);

  const dateLabel = fmtFullDate(event.starts_at);
  const startClock = fmtClock(event.starts_at);
  const endClock = fmtClock(event.ends_at);
  const dDay = calcDDay(event.starts_at);
  // 입장가능시간 — 시작 20분 전
  const earlyArrivalLabel = (() => {
    if (!event.starts_at) return "";
    const start = new Date(event.starts_at);
    if (Number.isNaN(start.getTime())) return "";
    const early = new Date(start.getTime() - 20 * 60_000);
    return fmtClock(early.toISOString());
  })();
  const dur = fmtDuration(event.starts_at, event.ends_at);
  const timeLabel =
    startClock || endClock
      ? `${startClock}${startClock && endClock ? " ~ " : ""}${endClock}${dur ? ` (${dur})` : ""}`
      : "";

  const message =
    event.invitation_message?.trim() || "함께 즐거운 시간을 만들어요";
  const body = event.invitation_body?.trim() ?? "";
  const location = event.invitation_location?.trim();
  const address = event.invitation_address?.trim();
  const dressCode = event.invitation_dress_code?.trim();
  // 입장가능시간 라벨
  const earlyArrivalRow = earlyArrivalLabel
    ? `${earlyArrivalLabel}부터 (20분 전)`
    : "";
  const parkings = (event.invitation_parkings ?? []).filter(
    (p) => p.name?.trim() || p.address?.trim()
  );

  // 지도 검색은 주소가 있으면 주소로, 없으면 장소명으로
  const mapQuery = address || location;
  const mapUrls = mapQuery ? buildMapUrls(mapQuery) : null;

  return (
    <div className="min-h-dvh bg-[#FFFDF8]">
      {/* ─── Hero — 풀스크린 커버 + 행사명 ─── */}
      <section className="relative flex min-h-[24vh] w-full items-center justify-center overflow-hidden">
        {event.cover_image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={event.cover_image_url}
            alt=""
            aria-hidden
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <div
            aria-hidden
            className="absolute inset-0 bg-gradient-to-br from-[#2D5A3D] via-[#4A7C59] to-[#3A7A52]"
          />
        )}
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-b from-black/45 via-black/25 to-black/65"
        />

        {/* D-day 배지 — 좌상단 고정, 빨강 */}
        {dDay !== null && (
          <span
            className={`absolute left-4 top-4 z-[2] inline-flex items-center gap-1 rounded-full px-3.5 py-1.5 text-sm font-extrabold tabular-nums shadow-lg ring-2 ${
              dDay === 0
                ? "animate-pulse bg-rose-500 text-white ring-rose-200/70"
                : dDay > 0
                  ? "bg-rose-600 text-white ring-white/40"
                  : "bg-white/30 text-white ring-white/30 backdrop-blur-sm"
            }`}
          >
            {fmtDDayLabel(dDay)}
          </span>
        )}

        <div className="relative z-[1] mx-auto max-w-md px-6 py-16 text-center text-white">
          <p className="mb-4 inline-flex items-center gap-1 rounded-full border border-white/30 bg-white/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-white backdrop-blur-sm">
            💌 INVITATION
          </p>
          {orgName && (
            <p className="mb-2 text-xs font-semibold tracking-wide text-[#D4E4BC] drop-shadow">
              🌲 {orgName}
            </p>
          )}
          <h1 className="text-3xl font-extrabold leading-tight drop-shadow-md sm:text-4xl">
            {event.name || "(이름 없음)"}
          </h1>
          {dateLabel !== "-" && (
            <p className="mt-6 text-base font-semibold drop-shadow">
              📅 {dateLabel}
            </p>
          )}
          {timeLabel && (
            <p className="mt-1 text-sm text-white/90 drop-shadow">
              ⏰ {timeLabel}
            </p>
          )}
          {earlyArrivalLabel && (
            <p className="mt-1 text-xs text-white/85 drop-shadow">
              🚪 입장가능시간:{" "}
              <span className="font-bold text-amber-200">
                {earlyArrivalLabel}
              </span>{" "}
              <span className="text-white/70">(20분 전)</span>
            </p>
          )}
          {(event.invitation_host || event.invitation_organizer) && (
            <div className="mt-2 space-y-0.5 text-xs text-white/90 drop-shadow">
              {event.invitation_host && (
                <p>
                  <span aria-hidden>🏫</span>{" "}
                  <span className="text-white/75">주최:</span>{" "}
                  <span className="font-bold">{event.invitation_host}</span>
                </p>
              )}
              {event.invitation_organizer && (
                <p>
                  <span aria-hidden>🎯</span>{" "}
                  <span className="text-white/75">주관:</span>{" "}
                  {event.invitation_organizer}
                </p>
              )}
            </div>
          )}
          {(location || address) && (
            <div className="mt-1 inline-flex flex-wrap items-center justify-center gap-1.5 text-xs text-white/90 drop-shadow">
              <span aria-hidden>📍</span>
              {location && <span className="font-bold">{location}</span>}
              {location && address && <span>:</span>}
              {address && <span className="text-white/80">{address}</span>}
              {(address || location) && (
                <CopyButton
                  text={address || location || ""}
                  label="📋 복사"
                  className="inline-flex items-center gap-1 rounded-full border border-white/30 bg-white/15 px-2 py-0.5 text-[10px] font-bold text-white shadow-sm backdrop-blur-sm hover:bg-white/25"
                  copiedLabel="✓ 복사됨"
                />
              )}
            </div>
          )}

          <span
            aria-hidden
            className="mt-12 inline-block animate-bounce text-2xl text-white/70"
          >
            ▼
          </span>
        </div>
      </section>

      {/* ─── 환영 인사 + 안내문 + 행사 디테일 ─── */}
      <section className="mx-auto max-w-md px-6 py-10">
        <div className="mb-6 text-center">
          <p className="text-3xl" aria-hidden>
            💬
          </p>
          <p className="mt-3 whitespace-pre-line break-words text-lg font-bold leading-relaxed text-[#2D5A3D] sm:text-xl">
            {message}
          </p>
        </div>

        {/* 안내문 (본문) */}
        {body && (
          <div className="mb-6 rounded-2xl border border-[#E5D3B8] bg-[#FFF8F0] p-5 shadow-sm">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-[#6B4423]">
              <span aria-hidden>📋</span>
              <span>안내문</span>
            </h2>
            <p className="whitespace-pre-line break-words text-sm leading-relaxed text-[#3D3A36]">
              {body}
            </p>
          </div>
        )}

        <div className="mx-auto my-6 flex items-center justify-center gap-2 text-[#D4C8B8]">
          <span className="h-px w-10 bg-current" />
          <span aria-hidden>◇</span>
          <span className="h-px w-10 bg-current" />
        </div>

        <div className="space-y-2 rounded-2xl bg-gradient-to-br from-[#2D5A3D] to-[#3A7A52] p-4 text-white shadow-md">
          {dateLabel !== "-" && (
            <DetailRow icon="📅" label="날짜" value={dateLabel} dark />
          )}
          {timeLabel && (
            <DetailRow icon="⏰" label="일시" value={timeLabel} dark />
          )}
          {earlyArrivalRow && (
            <DetailRow
              icon="🚪"
              label="입장"
              value={earlyArrivalRow}
              dark
            />
          )}
          {/* 장소 — 비어있어도 placeholder 로 노출해 운영자가 비어있음을 인지하게 함 */}
          <div className="flex items-start gap-2">
            <span aria-hidden className="shrink-0 text-base leading-snug">
              📍
            </span>
            <div className="min-w-0 flex-1 text-sm leading-snug">
              <span className="text-white/70">장소:</span>{" "}
              {location ? (
                <span className="font-bold text-white">{location}</span>
              ) : !address ? (
                <span className="italic text-white/60">
                  장소 안내가 곧 업데이트됩니다
                </span>
              ) : null}
              {address && (
                <span className="text-white/85">
                  {location ? " · " : ""}
                  {address}
                </span>
              )}
            </div>
            {(address || location) && (
              <CopyButton
                text={address || location || ""}
                label="📋 복사"
                className="shrink-0 self-start rounded-full border border-white/30 bg-white/15 px-2 py-0.5 text-[10px] font-bold text-white shadow-sm backdrop-blur-sm hover:bg-white/25"
              />
            )}
          </div>
          {dressCode && (
            <DetailRow icon="🎒" label="준비물" value={dressCode} multiline dark />
          )}
        </div>
      </section>

      {/* ─── 오시는 길 (장소 또는 주소가 있을 때만) ─── */}
      {(location || address) && mapUrls && (
        <section className="mx-auto max-w-md space-y-4 px-6 py-6">
          {/* 메인 장소 카드 */}
          <div className="rounded-2xl border border-[#D4E4BC] bg-white p-5 shadow-sm">
            <h2 className="flex items-center gap-2 text-sm font-bold text-[#2D5A3D]">
              <span aria-hidden>🗺</span>
              <span>행사장 오시는 길</span>
            </h2>

            <div className="mt-3 flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                {location && (
                  <p className="break-words text-base font-bold text-[#2C2C2C]">
                    {location}
                  </p>
                )}
                {address && (
                  <p className="mt-0.5 break-words text-xs text-[#6B6560]">
                    {address}
                  </p>
                )}
              </div>
              {(address || location) && (
                <CopyButton
                  text={address || location || ""}
                  label="📋 복사"
                />
              )}
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <a
                href={mapUrls.kakao}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-1 rounded-xl bg-yellow-400 px-3 py-2.5 text-xs font-bold text-yellow-900 shadow-sm hover:bg-yellow-500"
              >
                <span aria-hidden>🟡</span>
                <span>카카오지도</span>
              </a>
              <a
                href={mapUrls.naver}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-1 rounded-xl bg-emerald-500 px-3 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-emerald-600"
              >
                <span aria-hidden>🟢</span>
                <span>네이버지도</span>
              </a>
            </div>

            {/* 행사장 사진 — 입구/간판 등 */}
            {event.invitation_location_image_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={event.invitation_location_image_url}
                alt={location ? `${location} 행사장 사진` : "행사장 사진"}
                className="mt-3 w-full rounded-xl border border-[#D4E4BC] object-cover shadow-sm"
                loading="lazy"
              />
            )}
          </div>

          {/* 주차장 카드들 */}
          {parkings.length > 0 && (
            <div className="space-y-2">
              {parkings.map((p, idx) => {
                const pQuery = (p.address?.trim() || p.name?.trim()) ?? "";
                if (!pQuery) return null;
                const pUrls = buildMapUrls(pQuery);
                return (
                  <div
                    key={idx}
                    className="rounded-2xl border border-[#E5D3B8] bg-[#FFF8F0] p-4 shadow-sm"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-800">
                        🅿 제{idx + 1}주차장
                      </span>
                      {(p.address || p.name) && (
                        <CopyButton
                          text={p.address || p.name}
                          label="📋 복사"
                          className="rounded-full border border-[#D4E4BC] bg-white px-2.5 py-1 text-[10px] font-bold text-[#2D5A3D] shadow-sm hover:bg-[#F5F1E8]"
                        />
                      )}
                    </div>
                    {p.name && (
                      <p className="mt-2 break-words text-sm font-bold text-[#2C2C2C]">
                        {p.name}
                      </p>
                    )}
                    {p.address && (
                      <p className="mt-0.5 break-words text-xs text-[#6B6560]">
                        {p.address}
                      </p>
                    )}
                    {p.image_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.image_url}
                        alt={p.name ? `${p.name} 사진` : `제${idx + 1}주차장 사진`}
                        className="mt-2 w-full rounded-lg border border-[#E5D3B8] object-cover shadow-sm"
                        loading="lazy"
                      />
                    )}
                    <div className="mt-3 grid grid-cols-3 gap-1.5">
                      <a
                        href={pUrls.naver}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center justify-center gap-1 rounded-lg bg-emerald-500 px-2 py-2 text-[11px] font-bold text-white shadow-sm hover:bg-emerald-600"
                      >
                        <span aria-hidden>🟢</span>
                        <span>네이버</span>
                      </a>
                      <a
                        href={pUrls.kakao}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center justify-center gap-1 rounded-lg bg-yellow-400 px-2 py-2 text-[11px] font-bold text-yellow-900 shadow-sm hover:bg-yellow-500"
                      >
                        <span aria-hidden>🟡</span>
                        <span>카카오</span>
                      </a>
                      <a
                        href={pUrls.tmap}
                        className="inline-flex items-center justify-center gap-1 rounded-lg bg-blue-600 px-2 py-2 text-[11px] font-bold text-white shadow-sm hover:bg-blue-700"
                      >
                        <span aria-hidden>🔵</span>
                        <span>티맵</span>
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* ─── 타임테이블 — 4개까지 보이고 "전체 보기" 토글로 펼침. ─── */}
      {slots.length > 0 && (() => {
        const slotTimes = computeSlotDisplayTimes(event.starts_at, slots);
        return (
          <section className="mx-auto max-w-md px-6 py-10">
            <h2 className="mb-4 flex items-center justify-center gap-2 text-base font-bold text-[#2D5A3D]">
              <span aria-hidden>🕐</span>
              <span>그날의 흐름</span>
            </h2>
            <TimelineCollapsible slots={slots} slotTimes={slotTimes} />
          </section>
        );
      })()}

      {/* DRAFT(예정) 행사 — 행사 시작 전 안내만 노출. 미션/FM 링크는 숨김. */}
      {event.status === "DRAFT" && (
        <section className="mx-auto max-w-md px-6 py-8">
          <div className="rounded-2xl border border-amber-200 bg-amber-50/80 px-5 py-4 text-center">
            <p className="text-sm font-bold text-amber-900">
              🌱 행사 시작일에 다시 만나요
            </p>
            <p className="mt-1.5 text-[11px] text-amber-800/80">
              행사가 시작되면 미션·라이브 방송이 활성화돼요.
            </p>
          </div>
        </section>
      )}

    </div>
  );
}

/* ────────────────────────── 보조 컴포넌트 ────────────────────────── */

function DetailRow({
  icon,
  label,
  value,
  multiline = false,
  copyText,
  large = false,
  dark = false,
}: {
  icon: string;
  label: string;
  value: string;
  multiline?: boolean;
  /** 있으면 행 우측에 📋 주소복사 버튼 표시 — 클립보드 텍스트. */
  copyText?: string;
  /** true 면 값 글씨 크게. */
  large?: boolean;
  /** 어두운(초록 그라데이션) 배경에서 흰 글씨 모드. */
  dark?: boolean;
}) {
  const labelCls = dark ? "text-white/70" : "text-[#8B7F75]";
  const valueCls = dark ? "text-white" : "text-[#2C2C2C]";
  return (
    <div className="flex items-start gap-2">
      <span
        aria-hidden
        className={`shrink-0 leading-snug ${large ? "text-lg" : "text-base"}`}
      >
        {icon}
      </span>
      <p
        className={`min-w-0 flex-1 ${
          large ? "text-base" : "text-sm"
        } leading-snug ${
          multiline ? "whitespace-pre-line break-words" : ""
        }`}
      >
        <span className={labelCls}>{label}:</span>{" "}
        <span className={`font-bold ${valueCls}`}>{value}</span>
      </p>
      {copyText && (
        <CopyButton
          text={copyText}
          label="📋 복사"
          className={
            dark
              ? "shrink-0 self-start rounded-full border border-white/30 bg-white/15 px-2 py-0.5 text-[10px] font-bold text-white shadow-sm backdrop-blur-sm hover:bg-white/25"
              : "shrink-0 self-start rounded-full border border-[#D4E4BC] bg-[#F5F1E8] px-2 py-0.5 text-[10px] font-bold text-[#2D5A3D] shadow-sm hover:bg-[#E8DDC8]"
          }
        />
      )}
    </div>
  );
}

function PendingState({ eventName }: { eventName: string }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-[#FFFDF8] px-6 py-12 text-center">
      <p className="text-6xl" aria-hidden>
        🌱
      </p>
      <h1 className="mt-6 text-xl font-bold text-[#2D5A3D]">
        초대장이 곧 공개돼요
      </h1>
      <p className="mt-2 max-w-sm text-sm text-[#6B6560]">
        <b className="text-[#2D5A3D]">{eventName}</b> 초대장이 아직 발행되지
        않았어요. 기관에서 발행하면 이 페이지에서 자동으로 보여집니다.
      </p>
      <Link
        href="/home"
        className="mt-6 inline-flex items-center gap-1.5 rounded-xl border border-[#D4E4BC] bg-white px-4 py-2.5 text-sm font-semibold text-[#2D5A3D] hover:bg-[#F5F1E8]"
      >
        <span aria-hidden>🏠</span>
        <span>홈으로 돌아가기</span>
      </Link>
    </div>
  );
}

function NoAccessState({ eventId }: { eventId: string }) {
  // 로그아웃 후 다시 이 초대장으로 — 비로그인 상태가 되면 열람 가능,
  // 또는 해당 기관 계정으로 다시 로그인하면 정상 진입.
  const logoutHref = `/api/auth/user-logout?redirect=${encodeURIComponent(
    `/invitation/${eventId}`
  )}`;
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-[#FFFDF8] px-6 py-12 text-center">
      <p className="text-6xl" aria-hidden>
        🚫
      </p>
      <h1 className="mt-6 text-xl font-bold text-rose-700">
        다른 기관 계정으로 로그인되어 있어요
      </h1>
      <p className="mt-2 max-w-sm text-sm text-[#6B6560]">
        이 초대장은 다른 기관의 행사예요. 지금 로그인된 계정은 이 초대장을 볼 수
        없어요. 로그아웃하면 초대장을 열람하거나, 해당 기관 계정으로 다시
        로그인할 수 있어요.
      </p>
      {/* 로그아웃은 쿠키 삭제라 POST — form 으로 처리 */}
      <form action={logoutHref} method="post" className="mt-6">
        <button
          type="submit"
          className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#2D5A3D] to-[#3A7A52] px-5 py-2.5 text-sm font-bold text-white shadow-md hover:from-[#234a30]"
        >
          <span aria-hidden>🔓</span>
          <span>로그아웃하고 이 초대장 보기</span>
        </button>
      </form>
      <Link
        href="/home"
        className="mt-3 inline-flex items-center gap-1.5 rounded-xl border border-[#D4E4BC] bg-white px-4 py-2 text-xs font-semibold text-[#2D5A3D] hover:bg-[#F5F1E8]"
      >
        <span aria-hidden>🏠</span>
        <span>내 기관 홈으로</span>
      </Link>
    </div>
  );
}
