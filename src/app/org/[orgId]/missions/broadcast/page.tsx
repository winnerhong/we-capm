import Link from "next/link";
import { requireOrg } from "@/lib/org-auth-guard";
import { createClient } from "@/lib/supabase/server";
import {
  loadLiveBroadcastsForOrg,
  loadRecentBroadcastsForOrg,
  loadOrgMissionById,
  loadBroadcastParticipationCounts,
} from "@/lib/missions/queries";
import { loadOrgEvents } from "@/lib/org-events/queries";
import {
  MISSION_KIND_META,
  type BroadcastMissionConfig,
  type BroadcastTargetScope,
  type MissionBroadcastRow,
  type OrgMissionRow,
} from "@/lib/missions/types";
import { BroadcastCountdown } from "./broadcast-countdown";
import {
  BroadcastTriggerPanel,
  CancelBroadcastButton,
} from "./trigger-panel";

export const dynamic = "force-dynamic";

type BroadcastSummary = {
  id: string;
  title: string;
  icon: string | null;
  description: string | null;
  acorns: number;
  prompt: string;
  duration_sec: number;
  submission_kind: "PHOTO" | "TEXT";
  is_active: boolean;
};

function parseBroadcastCfg(raw: Record<string, unknown>): BroadcastMissionConfig {
  const dur =
    typeof raw.duration_sec === "number" && raw.duration_sec > 0
      ? Math.floor(raw.duration_sec)
      : 300;
  const prompt = typeof raw.prompt === "string" ? raw.prompt : "";
  const kindRaw =
    typeof raw.submission_kind === "string" ? raw.submission_kind : "";
  return {
    duration_sec: dur,
    prompt,
    submission_kind: kindRaw === "TEXT" ? "TEXT" : "PHOTO",
  };
}

async function loadBroadcastMissions(
  orgId: string
): Promise<BroadcastSummary[]> {
  const supabase = await createClient();
  const resp = (await (
    supabase.from("org_missions" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          eq: (
            k: string,
            v: string
          ) => {
            order: (
              c: string,
              o: { ascending: boolean }
            ) => Promise<{ data: OrgMissionRow[] | null }>;
          };
        };
      };
    }
  )
    .select("*")
    .eq("org_id", orgId)
    .eq("kind", "BROADCAST")
    .order("updated_at", { ascending: false })) as {
    data: OrgMissionRow[] | null;
  };

  return (resp.data ?? []).map((m) => {
    const cfg = parseBroadcastCfg(
      (m.config_json ?? {}) as Record<string, unknown>
    );
    return {
      id: m.id,
      title: m.title,
      icon: m.icon,
      description: m.description,
      acorns: m.acorns,
      prompt: cfg.prompt,
      duration_sec: cfg.duration_sec,
      submission_kind: cfg.submission_kind,
      is_active: m.is_active,
    };
  });
}

function scopeLabel(scope: BroadcastTargetScope): string {
  switch (scope) {
    case "ORG":
      return "🏠 기관 전체";
    case "EVENT":
      return "📅 행사";
    case "ALL":
      return "🌍 전사";
    default:
      return scope;
  }
}

function statusOf(row: MissionBroadcastRow): {
  label: string;
  cls: string;
} {
  if (row.cancelled_at)
    return {
      label: "취소됨",
      cls: "border-zinc-300 bg-zinc-100 text-zinc-700",
    };
  const expired = new Date(row.expires_at).getTime() <= Date.now();
  if (expired)
    return {
      label: "완료",
      cls: "border-emerald-200 bg-emerald-50 text-emerald-800",
    };
  return {
    label: "활성",
    cls: "border-rose-200 bg-rose-50 text-rose-800",
  };
}

export default async function BroadcastConsolePage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  const session = await requireOrg();

  const [broadcastMissions, liveBroadcasts, recentBroadcasts, orgEvents] =
    await Promise.all([
      loadBroadcastMissions(orgId),
      loadLiveBroadcastsForOrg(orgId),
      loadRecentBroadcastsForOrg(orgId, 20),
      loadOrgEvents(orgId),
    ]);

  // 활성 행사(LIVE + 기간 내)만 드롭다운에 노출
  const nowMs = Date.now();
  const activeEvents = orgEvents
    .filter((e) => e.status === "LIVE")
    .filter((e) => {
      const startsOk =
        !e.starts_at || new Date(e.starts_at).getTime() <= nowMs;
      const endsOk = !e.ends_at || new Date(e.ends_at).getTime() >= nowMs;
      return startsOk && endsOk;
    })
    .map((e) => ({ id: e.id, name: e.name }));

  // For live/recent cards — look up mission title via cache
  const missionIds = Array.from(
    new Set(
      [...liveBroadcasts, ...recentBroadcasts].map((b) => b.org_mission_id)
    )
  );
  const missionMap = new Map<string, OrgMissionRow>();
  await Promise.all(
    missionIds.map(async (id) => {
      const m = await loadOrgMissionById(id);
      if (m) missionMap.set(id, m);
    })
  );

  // 라이브 돌발 미션의 실시간 참여자 수 집계
  const liveParticipation = await loadBroadcastParticipationCounts(
    liveBroadcasts.map((b) => b.id)
  );

  const kindMeta = MISSION_KIND_META.BROADCAST;

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6">
      {/* Breadcrumb */}
      <nav aria-label="breadcrumb" className="text-xs text-[#8B7F75]">
        <Link href={`/org/${orgId}`} className="hover:text-[#2D5A3D]">
          기관홈
        </Link>
        <span className="mx-2">/</span>
        <Link
          href={`/org/${orgId}/missions/catalog`}
          className="hover:text-[#2D5A3D]"
        >
          미션
        </Link>
        <span className="mx-2">/</span>
        <span className="font-semibold text-[#2D5A3D]">돌발 미션 발동</span>
      </nav>

      {/* Header */}
      <header className="rounded-3xl border border-[#D4E4BC] bg-gradient-to-br from-[#E8F0E4] via-white to-[#FAE7D0] p-5 shadow-sm md:p-7">
        <div className="flex flex-wrap items-center gap-3">
          <span
            className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-white text-3xl shadow-sm"
            aria-hidden
          >
            {kindMeta.icon}
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-bold text-[#2D5A3D] md:text-xl">
              돌발 미션 발동 콘솔
            </h1>
            <p className="mt-1 text-xs text-[#6B6560] md:text-sm">
              버튼을 누르는 즉시 전체 참가자에게 알림이 가요. 설정된 제한 시간
              안에 참여한 참가자에게 도토리가 지급됩니다.
            </p>
          </div>
        </div>
      </header>

      {/* Live section */}
      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-sm font-bold text-[#2D5A3D]">
          <span aria-hidden>🔴</span>
          <span>지금 발동 중</span>
          {liveBroadcasts.length > 0 && (
            <span className="inline-flex min-w-[1.5rem] items-center justify-center rounded-full bg-rose-600 px-2 py-0.5 text-[10px] font-bold text-white">
              {liveBroadcasts.length}
            </span>
          )}
        </h2>

        {liveBroadcasts.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#D4E4BC] bg-[#FFF8F0] px-4 py-6 text-center">
            <p className="text-xs text-[#6B6560]">
              현재 진행 중인 돌발 미션이 없어요.
            </p>
          </div>
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">
            {liveBroadcasts.map((b) => {
              const mission = missionMap.get(b.org_mission_id);
              return (
                <li
                  key={b.id}
                  className="rounded-2xl border border-rose-300 bg-gradient-to-br from-rose-50 via-white to-amber-50 p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-rose-700">
                        <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-rose-600" />
                        LIVE
                      </p>
                      <p className="mt-0.5 truncate text-sm font-bold text-[#2D5A3D]">
                        {mission?.icon || "⚡"}{" "}
                        {mission?.title ?? "(미션 삭제됨)"}
                      </p>
                      <p className="text-[11px] text-[#6B6560]">
                        {scopeLabel(b.target_scope)} ·{" "}
                        {new Date(b.fires_at).toLocaleString("ko-KR")}
                      </p>
                    </div>
                    <BroadcastCountdown expiresAt={b.expires_at} />
                  </div>

                  <p className="mt-3 whitespace-pre-wrap rounded-lg border border-amber-200 bg-white p-2 text-xs text-[#2C2C2C]">
                    {b.prompt_snapshot}
                  </p>

                  <div className="mt-3 flex items-center justify-between text-[11px]">
                    <span className="text-[#6B6560]">
                      참여{" "}
                      <b className="text-[#2D5A3D] tabular-nums">
                        {liveParticipation.get(b.id) ?? 0}
                      </b>
                      명
                    </span>
                    <CancelBroadcastButton broadcastId={b.id} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Trigger section */}
      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-sm font-bold text-[#2D5A3D]">
          <span aria-hidden>📢</span>
          <span>지금 발동하기</span>
        </h2>
        <BroadcastTriggerPanel
          missions={broadcastMissions}
          activeEvents={activeEvents}
        />
      </section>

      {/* History section */}
      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-sm font-bold text-[#2D5A3D]">
          <span aria-hidden>📜</span>
          <span>최근 발동 기록</span>
        </h2>

        {recentBroadcasts.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#D4E4BC] bg-[#FFF8F0] px-4 py-6 text-center">
            <p className="text-xs text-[#6B6560]">
              아직 발동한 기록이 없어요.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-[#E8F0E4] overflow-hidden rounded-2xl border border-[#D4E4BC] bg-white shadow-sm">
            {recentBroadcasts.map((b) => {
              const mission = missionMap.get(b.org_mission_id);
              const status = statusOf(b);
              return (
                <li key={b.id} className="p-4">
                  <details className="group">
                    <summary className="flex cursor-pointer list-none items-start gap-2">
                      <span className="text-xl" aria-hidden>
                        {mission?.icon || "⚡"}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <p className="truncate text-sm font-bold text-[#2D5A3D]">
                            {mission?.title ?? "(미션 삭제됨)"}
                          </p>
                          <span
                            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${status.cls}`}
                          >
                            {status.label}
                          </span>
                          <span className="inline-flex items-center rounded-full border border-[#D4E4BC] bg-[#F5F1E8] px-2 py-0.5 text-[10px] font-semibold text-[#2D5A3D]">
                            {scopeLabel(b.target_scope)}
                          </span>
                        </div>
                        <p className="mt-0.5 text-[11px] text-[#6B6560]">
                          {new Date(b.fires_at).toLocaleString("ko-KR")} ·
                          지속 {Math.round(b.duration_sec / 60)}분
                          {b.cancelled_at && (
                            <>
                              {" "}· 취소 {" "}
                              {new Date(b.cancelled_at).toLocaleString(
                                "ko-KR"
                              )}
                            </>
                          )}
                        </p>
                      </div>
                      <span
                        aria-hidden
                        className="text-[#8B7F75] transition group-open:rotate-90"
                      >
                        ▶
                      </span>
                    </summary>
                    <div className="mt-3 rounded-lg border border-[#D4E4BC] bg-[#FFF8F0] p-3">
                      <p className="text-[10px] font-semibold text-[#8B6F47]">
                        방송 문구
                      </p>
                      <p className="mt-0.5 whitespace-pre-wrap text-xs text-[#2C2C2C]">
                        {b.prompt_snapshot}
                      </p>
                    </div>
                  </details>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
