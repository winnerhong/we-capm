import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { getAppUser } from "@/lib/user-auth-guard";
import { loadOrgEventById } from "@/lib/org-events/queries";
import { loadAppUserById, loadChildrenForUser } from "@/lib/app-user/queries";
import { loadPartnerDisplayNameForOrg } from "@/lib/org-partner";
import { loadTimelineSlots } from "@/lib/event-timeline/queries";
import { SLOT_KIND_META } from "@/lib/event-timeline/types";
import { CopyButton } from "./copy-button";

export const dynamic = "force-dynamic";

const WEEKDAY = ["일", "월", "화", "수", "목", "금", "토"];

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

function fmtFullDate(iso: string | null): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 (${WEEKDAY[d.getDay()]})`;
}

function fmtClock(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const h = d.getHours();
  const m = d.getMinutes();
  if (h === 0 && m === 0) return "";
  const period = h < 12 ? "오전" : "오후";
  const hh = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${period} ${hh}:${pad2(m)}`;
}

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
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
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

  const [event, user, children] = await Promise.all([
    loadOrgEventById(eventId),
    loadAppUserById(session.id),
    loadChildrenForUser(session.id),
  ]);

  if (!event) notFound();

  // 행사 미발행 — 초안 안내
  if (!event.invitation_published_at) {
    return <PendingState eventName={event.name} />;
  }

  // 같은 기관 소속이 아니면 접근 차단
  if (user && user.org_id !== event.org_id) {
    return <NoAccessState />;
  }

  const orgName = await loadPartnerDisplayNameForOrg(event.org_id).catch(
    () => null
  );

  // 타임테이블 미리보기 (있으면 최대 6개 표시)
  const slots = await loadTimelineSlots(eventId).catch(() => []);
  const previewSlots = slots.slice(0, 6);

  // 자녀 이름 추출 (원생만)
  const enrolledNames = children
    .filter((c) => c.is_enrolled)
    .map((c) => c.name);
  const greetName =
    enrolledNames.length === 0
      ? user?.parent_name || "보호자"
      : enrolledNames.length === 1
        ? enrolledNames[0]
        : enrolledNames.length === 2
          ? enrolledNames.join(" · ")
          : `${enrolledNames[0]} · ${enrolledNames[1]} 외 ${enrolledNames.length - 2}명`;

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
      <section className="relative flex min-h-[80vh] w-full items-center justify-center overflow-hidden">
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

        <div className="space-y-4 rounded-2xl border border-[#D4E4BC] bg-white p-5 shadow-sm">
          {dateLabel !== "-" && (
            <DetailRow icon="📅" label="날짜" value={dateLabel} large />
          )}
          {timeLabel && (
            <DetailRow icon="⏰" label="일시" value={timeLabel} />
          )}
          {earlyArrivalRow && (
            <DetailRow icon="🚪" label="입장가능시간" value={earlyArrivalRow} />
          )}
          {(location || address) && (
            <div className="flex items-start gap-3">
              <span aria-hidden className="text-xl">
                📍
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#8B7F75]">
                  장소
                </p>
                {location && (
                  <p className="mt-0.5 text-base font-bold text-[#2C2C2C]">
                    {location}
                  </p>
                )}
                {address && (
                  <p className="mt-0.5 text-sm font-semibold text-[#6B6560]">
                    {address}
                  </p>
                )}
              </div>
              <CopyButton
                text={address || location || ""}
                label="📋 주소복사"
                className="shrink-0 self-start rounded-full border border-[#D4E4BC] bg-[#F5F1E8] px-2.5 py-1 text-[10px] font-bold text-[#2D5A3D] shadow-sm hover:bg-[#E8DDC8]"
              />
            </div>
          )}
          {dressCode && (
            <DetailRow icon="🎒" label="준비물" value={dressCode} multiline />
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
              <span>오시는 길</span>
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

      {/* ─── 개인화 인사 ─── */}
      <section className="mx-auto max-w-md px-6 py-10">
        <div className="rounded-3xl border-2 border-emerald-200 bg-gradient-to-br from-emerald-50/60 via-white to-[#FAE7D0]/40 p-8 text-center shadow-md">
          <p className="text-4xl" aria-hidden>
            🎒
          </p>
          <p className="mt-4 text-2xl font-extrabold text-[#2D5A3D] sm:text-3xl">
            {greetName}
          </p>
          <p className="mt-2 text-base font-bold text-[#2D5A3D]">
            가족을 초대합니다
          </p>
          {user?.phone && (
            <p className="mt-3 font-mono text-[11px] text-[#8B7F75]">
              보호자{" "}
              {user.phone.length === 11
                ? `${user.phone.slice(0, 3)}-${user.phone.slice(3, 7)}-${user.phone.slice(7)}`
                : user.phone}
            </p>
          )}
        </div>
      </section>

      {/* ─── 타임테이블 미리보기 (있을 때만) ─── */}
      {previewSlots.length > 0 && (
        <section className="mx-auto max-w-md px-6 py-10">
          <h2 className="mb-4 flex items-center justify-center gap-2 text-base font-bold text-[#2D5A3D]">
            <span aria-hidden>🕐</span>
            <span>그날의 흐름</span>
          </h2>
          <ol className="relative space-y-3 border-l-2 border-emerald-200 pl-5">
            {previewSlots.map((slot) => {
              const meta = SLOT_KIND_META[slot.slot_kind];
              const emoji = slot.icon_emoji || meta?.defaultEmoji || "🌲";
              return (
                <li
                  key={slot.id}
                  className="relative rounded-xl border border-[#D4E4BC] bg-white p-3 shadow-sm"
                >
                  <span
                    aria-hidden
                    className="absolute -left-[27px] top-3 inline-flex h-4 w-4 items-center justify-center rounded-full border-2 border-emerald-400 bg-white"
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  </span>
                  <p className="text-xs font-semibold text-[#6B6560]">
                    {fmtSlotTime(slot.starts_at)}
                  </p>
                  <p className="mt-0.5 text-sm font-bold text-[#2D5A3D]">
                    {emoji} {slot.title || meta?.label || "활동"}
                  </p>
                </li>
              );
            })}
          </ol>
          {slots.length > previewSlots.length && (
            <p className="mt-3 text-center text-[11px] text-[#8B7F75]">
              외 {slots.length - previewSlots.length}개 더 있어요
            </p>
          )}
          <div className="mt-4 text-center">
            <Link
              href="/schedule"
              className="text-xs font-semibold text-[#2D5A3D] underline-offset-2 hover:underline"
            >
              📅 전체 일정 보기 →
            </Link>
          </div>
        </section>
      )}

      {/* ─── CTA ─── */}
      <section className="mx-auto max-w-md px-6 py-8">
        <Link
          href="/home"
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#2D5A3D] to-[#3A7A52] px-6 py-4 text-base font-bold text-white shadow-lg transition hover:from-[#234a30] hover:to-[#2D5A3D]"
        >
          <span aria-hidden>🌲</span>
          <span>참여 확인하기</span>
          <span aria-hidden>→</span>
        </Link>

        <div className="mt-3 grid grid-cols-3 gap-2">
          <Link
            href="/schedule"
            className="flex flex-col items-center gap-0.5 rounded-xl border border-[#D4E4BC] bg-white px-2 py-3 text-[11px] font-semibold text-[#2D5A3D] transition hover:bg-[#F5F1E8]"
          >
            <span className="text-base" aria-hidden>
              📅
            </span>
            <span>일정</span>
          </Link>
          <Link
            href="/missions"
            className="flex flex-col items-center gap-0.5 rounded-xl border border-[#D4E4BC] bg-white px-2 py-3 text-[11px] font-semibold text-[#2D5A3D] transition hover:bg-[#F5F1E8]"
          >
            <span className="text-base" aria-hidden>
              🎯
            </span>
            <span>미션</span>
          </Link>
          <Link
            href="/tori-fm"
            className="flex flex-col items-center gap-0.5 rounded-xl border border-[#D4E4BC] bg-white px-2 py-3 text-[11px] font-semibold text-[#2D5A3D] transition hover:bg-[#F5F1E8]"
          >
            <span className="text-base" aria-hidden>
              📻
            </span>
            <span>토리FM</span>
          </Link>
        </div>

      </section>

      {/* ─── 푸터 ─── */}
      <footer className="mx-auto max-w-md px-6 pb-12 pt-6 text-center text-[11px] text-[#8B7F75]">
        {orgName && (
          <p className="font-semibold text-[#2D5A3D]">
            🌲 {orgName} 이(가) 초대합니다
          </p>
        )}
        <p className="mt-1">토리로 · 우리 아이 첫 캠프의 추억</p>
      </footer>
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
}: {
  icon: string;
  label: string;
  value: string;
  multiline?: boolean;
  /** 있으면 행 우측에 📋 주소복사 버튼 표시 — 클립보드 텍스트. */
  copyText?: string;
  /** true 면 값 글씨 크게. */
  large?: boolean;
}) {
  return (
    <div className="flex items-start gap-3">
      <span aria-hidden className={large ? "text-2xl" : "text-xl"}>
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-bold uppercase tracking-wider text-[#8B7F75]">
          {label}
        </p>
        <p
          className={`mt-0.5 font-bold text-[#2C2C2C] ${
            large ? "text-lg" : "text-sm font-semibold"
          } ${
            multiline ? "whitespace-pre-line break-words leading-relaxed" : ""
          }`}
        >
          {value}
        </p>
      </div>
      {copyText && (
        <CopyButton
          text={copyText}
          label="📋 주소복사"
          className="shrink-0 self-start rounded-full border border-[#D4E4BC] bg-[#F5F1E8] px-2.5 py-1 text-[10px] font-bold text-[#2D5A3D] shadow-sm hover:bg-[#E8DDC8]"
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

function NoAccessState() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-[#FFFDF8] px-6 py-12 text-center">
      <p className="text-6xl" aria-hidden>
        🚫
      </p>
      <h1 className="mt-6 text-xl font-bold text-rose-700">
        접근 권한이 없어요
      </h1>
      <p className="mt-2 max-w-sm text-sm text-[#6B6560]">
        이 초대장은 다른 기관의 행사예요. 등록된 기관의 초대장만 볼 수 있어요.
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
