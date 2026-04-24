import Link from "next/link";
import { requireOrg } from "@/lib/org-auth-guard";
import { loadRadioQueueDetailed } from "@/lib/missions/queries";
import {
  RADIO_MODERATION_META,
  type RadioModerationStatus,
} from "@/lib/missions/types";
import { RadioQueueActions } from "./RadioQueueActions";

export const dynamic = "force-dynamic";

const TABS: Array<{ value: RadioModerationStatus; label: string }> = [
  { value: "PENDING", label: "⏳ 검토 대기" },
  { value: "APPROVED", label: "✅ 방송 대기" },
  { value: "HIDDEN", label: "🙈 숨김" },
];

function formatRelative(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const ms = Date.now() - d.getTime();
  const min = Math.floor(ms / 60_000);
  if (min < 1) return "방금 전";
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  return d.toLocaleDateString("ko-KR");
}

export default async function OrgRadioModerationPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { orgId } = await params;
  const sp = await searchParams;
  const session = await requireOrg();

  const selectedTab: RadioModerationStatus = TABS.some(
    (t) => t.value === sp.tab
  )
    ? (sp.tab as RadioModerationStatus)
    : "PENDING";

  const items = await loadRadioQueueDetailed(orgId, selectedTab);

  // 전체 탭별 카운트 — pending/approved/hidden 한꺼번에 가져와서 뱃지에 쓰기
  const allItems = await loadRadioQueueDetailed(orgId);
  const counts: Record<RadioModerationStatus, number> = {
    PENDING: 0,
    APPROVED: 0,
    HIDDEN: 0,
  };
  for (const it of allItems) counts[it.moderation] += 1;

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6">
      <nav aria-label="breadcrumb" className="text-xs text-[#8B7F75]">
        <Link href={`/org/${orgId}`} className="hover:text-[#2D5A3D]">
          기관홈
        </Link>
        <span className="mx-2">/</span>
        <span className="font-semibold text-[#2D5A3D]">
          신청곡 모더레이션
        </span>
      </nav>

      <header className="rounded-3xl border border-[#D4E4BC] bg-gradient-to-br from-[#FAE7D0] via-white to-[#E8F0E4] p-5 shadow-sm md:p-7">
        <div className="flex flex-wrap items-center gap-3">
          <span
            className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-white text-3xl shadow-sm"
            aria-hidden
          >
            🎙
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-bold text-[#2D5A3D] md:text-xl">
              신청곡 모더레이션 큐
            </h1>
            <p className="text-xs text-[#6B6560]">
              제출된 신청곡·사연을 검토하고 토리FM에 편성해 보세요
            </p>
          </div>
          <Link
            href={`/org/${orgId}/tori-fm`}
            className="rounded-xl border border-[#2D5A3D] bg-[#2D5A3D] px-3 py-2 text-xs font-bold text-white transition hover:bg-[#234a30]"
          >
            📻 토리FM 제어실
          </Link>
        </div>
      </header>

      <nav aria-label="탭" className="flex flex-wrap gap-2">
        {TABS.map((t) => {
          const isActive = selectedTab === t.value;
          return (
            <Link
              key={t.value}
              href={`/org/${orgId}/missions/radio?tab=${t.value}`}
              className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                isActive
                  ? "border-[#2D5A3D] bg-[#2D5A3D] text-white"
                  : "border-[#D4E4BC] bg-white text-[#2D5A3D] hover:bg-[#E8F0E4]"
              }`}
            >
              <span>{t.label}</span>
              <span
                className={`rounded-full px-1.5 text-[10px] ${
                  isActive
                    ? "bg-white/20 text-white"
                    : "bg-[#F5F1E8] text-[#6B6560]"
                }`}
              >
                {counts[t.value]}
              </span>
            </Link>
          );
        })}
      </nav>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-[#D4E4BC] bg-white p-10 text-center">
          <p className="text-4xl" aria-hidden>
            🎵
          </p>
          <p className="mt-3 text-sm font-bold text-[#2D5A3D]">
            {selectedTab === "PENDING"
              ? "검토할 사연이 없어요"
              : selectedTab === "APPROVED"
                ? "방송 대기 중인 사연이 없어요"
                : "숨긴 사연이 없어요"}
          </p>
          <p className="mt-1 text-xs text-[#6B6560]">
            참가자가 신청곡을 제출하면 여기에 표시돼요.
          </p>
        </div>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {items.map((it) => {
            const meta = RADIO_MODERATION_META[it.moderation];
            const song =
              typeof it.submission_payload.song_title === "string"
                ? it.submission_payload.song_title
                : "";
            const artist =
              typeof it.submission_payload.artist === "string"
                ? it.submission_payload.artist
                : "";
            const story =
              typeof it.submission_payload.story_text === "string"
                ? it.submission_payload.story_text
                : "";
            const childName =
              typeof it.submission_payload.child_name === "string"
                ? it.submission_payload.child_name
                : "";

            return (
              <li
                key={it.id}
                className="rounded-2xl border border-[#D4E4BC] bg-white p-4 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${meta.color}`}
                      >
                        <span aria-hidden>{meta.icon}</span>
                        <span>{meta.label}</span>
                      </span>
                      {it.played_at && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[10px] font-semibold text-sky-800">
                          📻 방송됨
                        </span>
                      )}
                    </div>
                    <h2 className="mt-1 truncate text-sm font-bold text-[#2D5A3D]">
                      🎵 {song || "(곡 미입력)"}
                    </h2>
                    {artist && (
                      <p className="text-[11px] text-[#6B6560]">
                        — {artist}
                      </p>
                    )}
                    <p className="mt-0.5 text-[11px] text-[#8B7F75]">
                      {childName ? `${childName} ` : ""}
                      {it.user_parent_name && `· ${it.user_parent_name}`}
                    </p>
                    <p className="text-[11px] text-[#8B7F75]">
                      {formatRelative(it.created_at)}
                    </p>
                  </div>
                </div>

                {story && (
                  <p className="mt-3 line-clamp-4 rounded-lg bg-[#F5F1E8] p-3 text-xs text-[#2C2C2C]">
                    {story}
                  </p>
                )}

                {it.moderator_note && (
                  <p className="mt-2 rounded-lg border border-[#D4E4BC] bg-[#FFF8F0] p-2 text-[11px] text-[#8B6F47]">
                    📝 {it.moderator_note}
                  </p>
                )}

                <div className="mt-3 border-t border-[#D4E4BC] pt-3">
                  <RadioQueueActions
                    queueId={it.id}
                    moderation={it.moderation}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
