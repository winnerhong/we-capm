import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireOrg } from "@/lib/org-auth-guard";
import {
  loadFmSessionById,
  loadRadioQueueDetailed,
} from "@/lib/missions/queries";
import type { RadioModerationStatus } from "@/lib/missions/types";
import { SessionEditForm } from "./session-edit-form";
import { QueueAssignButton } from "./queue-assign-button";

export const dynamic = "force-dynamic";

function fmtDateTime(iso: string | null): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function OrgToriFmSessionEditPage({
  params,
}: {
  params: Promise<{ orgId: string; sessionId: string }>;
}) {
  const { orgId, sessionId } = await params;
  await requireOrg();

  const fmSession = await loadFmSessionById(sessionId);
  if (!fmSession) notFound();
  if (fmSession.org_id !== orgId) redirect(`/org/${orgId}/tori-fm`);

  // 이 org 의 APPROVED 큐 전체를 한 번에 로드 후,
  // fm_session_id 기준으로 편성된/편성 가능 분리.
  const approvedAll = await loadRadioQueueDetailed(
    orgId,
    "APPROVED" as RadioModerationStatus
  );

  const assignedRaw = approvedAll.filter(
    (q) => q.fm_session_id === sessionId
  );
  // position ASC, created_at ASC
  const assigned = assignedRaw.slice().sort((a, b) => {
    const pa = a.position ?? 9_999_999;
    const pb = b.position ?? 9_999_999;
    if (pa !== pb) return pa - pb;
    return (a.created_at ?? "").localeCompare(b.created_at ?? "");
  });

  const unassigned = approvedAll.filter((q) => !q.fm_session_id);

  const currentQueueId = fmSession.current_queue_id;

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6">
      <nav aria-label="breadcrumb" className="text-xs text-[#8B7F75]">
        <Link href={`/org/${orgId}`} className="hover:text-[#2D5A3D]">
          기관홈
        </Link>
        <span className="mx-2">/</span>
        <Link
          href={`/org/${orgId}/tori-fm`}
          className="hover:text-[#2D5A3D]"
        >
          토리FM 제어실
        </Link>
        <span className="mx-2">/</span>
        <span className="font-semibold text-[#2D5A3D]">세션 편집</span>
      </nav>

      <header className="rounded-3xl border border-[#D4E4BC] bg-white p-5 shadow-sm md:p-7">
        <div className="flex flex-wrap items-center gap-3">
          <span
            className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-[#F5F1E8] text-3xl"
            aria-hidden
          >
            📻
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-bold text-[#2D5A3D] md:text-xl">
              {fmSession.name}
            </h1>
            <p className="text-xs text-[#6B6560]">
              🕐 {fmtDateTime(fmSession.scheduled_start)} ~{" "}
              {fmtDateTime(fmSession.scheduled_end)}
            </p>
          </div>
          {fmSession.is_live && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-600 px-3 py-1 text-xs font-bold text-white">
              <span className="h-2 w-2 animate-pulse rounded-full bg-white" />
              ON AIR
            </span>
          )}
        </div>
      </header>

      {/* 1) 세션 이름·일정 편집 */}
      <SessionEditForm
        sessionId={fmSession.id}
        initialName={fmSession.name}
        initialStart={fmSession.scheduled_start}
        initialEnd={fmSession.scheduled_end}
        isLive={fmSession.is_live}
      />

      {/* 2) 편성된 큐 */}
      <section>
        <h2 className="mb-2 flex items-center gap-2 text-base font-bold text-[#2D5A3D]">
          <span aria-hidden>🎶</span>
          <span>편성된 큐 ({assigned.length})</span>
        </h2>
        {assigned.length === 0 ? (
          <p className="rounded-2xl border border-[#D4E4BC] bg-white p-4 text-xs text-[#6B6560]">
            아직 편성된 사연이 없어요. 아래 ‘편성 가능한 큐’에서 추가해 주세요.
          </p>
        ) : (
          <ul className="space-y-2">
            {assigned.map((q, idx) => {
              const song =
                typeof q.submission_payload.song_title === "string"
                  ? q.submission_payload.song_title
                  : "";
              const story =
                typeof q.submission_payload.story_text === "string"
                  ? q.submission_payload.story_text
                  : "";
              const isCurrent = currentQueueId === q.id;
              const isPlayed = Boolean(q.played_at);
              const disableUnassign = isCurrent;
              const disableReason = isCurrent
                ? "지금 재생 중이에요. 다른 큐로 바꾼 뒤 해제하세요."
                : undefined;

              return (
                <li
                  key={q.id}
                  className={`rounded-2xl border bg-white p-3 shadow-sm ${
                    isCurrent
                      ? "border-rose-300 ring-2 ring-rose-200"
                      : "border-[#D4E4BC]"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[#E8F0E4] text-xs font-bold text-[#2D5A3D]">
                      {q.position != null ? q.position : idx + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <p className="truncate text-sm font-bold text-[#2D5A3D]">
                          🎵 {song || "(제목 미입력)"}
                        </p>
                        {isCurrent && (
                          <span className="shrink-0 rounded-full bg-rose-600 px-2 py-0.5 text-[10px] font-bold text-white">
                            ▶ 재생 중
                          </span>
                        )}
                        {isPlayed && !isCurrent && (
                          <span className="shrink-0 rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-semibold text-sky-800">
                            방송됨
                          </span>
                        )}
                      </div>
                      {story && (
                        <p className="mt-1 line-clamp-2 text-[11px] text-[#6B6560]">
                          {story}
                        </p>
                      )}
                      <p className="mt-1 text-[10px] text-[#8B7F75]">
                        {q.user_parent_name || "신청자 미표시"}
                        {q.played_at && ` · 방송 ${fmtDateTime(q.played_at)}`}
                      </p>
                    </div>
                    <QueueAssignButton
                      sessionId={fmSession.id}
                      queueId={q.id}
                      mode="unassign"
                      disabled={disableUnassign}
                      disabledReason={disableReason}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* 3) 편성 가능한 큐 */}
      <section>
        <h2 className="mb-2 flex items-center gap-2 text-base font-bold text-[#2D5A3D]">
          <span aria-hidden>📝</span>
          <span>편성 가능한 큐 ({unassigned.length})</span>
        </h2>
        {unassigned.length === 0 ? (
          <p className="rounded-2xl border border-[#D4E4BC] bg-white p-4 text-xs text-[#6B6560]">
            편성 가능한 승인 큐가 없어요.{" "}
            <Link
              href={`/org/${orgId}/missions/radio`}
              className="font-semibold text-[#2D5A3D] underline"
            >
              모더레이션으로 이동
            </Link>
          </p>
        ) : (
          <ul className="space-y-2">
            {unassigned.map((q) => {
              const song =
                typeof q.submission_payload.song_title === "string"
                  ? q.submission_payload.song_title
                  : "";
              const story =
                typeof q.submission_payload.story_text === "string"
                  ? q.submission_payload.story_text
                  : "";
              return (
                <li
                  key={q.id}
                  className="rounded-2xl border border-[#D4E4BC] bg-white p-3 shadow-sm"
                >
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-[#2D5A3D]">
                        🎵 {song || "(제목 미입력)"}
                      </p>
                      {story && (
                        <p className="mt-1 line-clamp-2 text-[11px] text-[#6B6560]">
                          {story}
                        </p>
                      )}
                      <p className="mt-1 text-[10px] text-[#8B7F75]">
                        {q.user_parent_name || "신청자 미표시"}
                      </p>
                    </div>
                    <QueueAssignButton
                      sessionId={fmSession.id}
                      queueId={q.id}
                      mode="assign"
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
