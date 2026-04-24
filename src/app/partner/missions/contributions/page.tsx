import Link from "next/link";
import { requirePartner } from "@/lib/auth-guard";
import { createClient } from "@/lib/supabase/server";
import { loadContributionsByPartner } from "@/lib/missions/queries";
import {
  CONTRIBUTION_STATUS_META,
  MISSION_KIND_META,
  type ContributionStatus,
  type MissionContributionRow,
  type PartnerMissionRow,
  type MissionKind,
} from "@/lib/missions/types";
import { ReviewActions } from "./review-actions";

export const dynamic = "force-dynamic";

type TabKey = "PROPOSED" | "ACCEPTED" | "REJECTED" | "ALL";

const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: "PROPOSED", label: "검토 대기", icon: "💌" },
  { key: "ACCEPTED", label: "수용함", icon: "✅" },
  { key: "REJECTED", label: "반려함", icon: "❌" },
  { key: "ALL", label: "전체", icon: "📚" },
];

type SbResp<T> = { data: T[] | null; error: unknown };

interface OrgRow {
  id: string;
  org_name: string;
}

async function loadOrgNameMap(orgIds: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (orgIds.length === 0) return map;
  const supabase = await createClient();
  const resp = (await (
    supabase.from("partner_orgs" as never) as unknown as {
      select: (c: string) => {
        in: (k: string, v: string[]) => Promise<SbResp<OrgRow>>;
      };
    }
  )
    .select("id, org_name")
    .in("id", orgIds)) as SbResp<OrgRow>;

  for (const r of resp.data ?? []) map.set(r.id, r.org_name);
  return map;
}

async function loadMissionMap(
  missionIds: string[]
): Promise<Map<string, PartnerMissionRow>> {
  const map = new Map<string, PartnerMissionRow>();
  // 단건 쿼리를 반복해서 쓰는 게 번거로우므로 배치로.
  if (missionIds.length === 0) return map;
  const supabase = await createClient();
  const resp = (await (
    supabase.from("partner_missions" as never) as unknown as {
      select: (c: string) => {
        in: (k: string, v: string[]) => Promise<SbResp<PartnerMissionRow>>;
      };
    }
  )
    .select("*")
    .in("id", missionIds)) as SbResp<PartnerMissionRow>;

  for (const r of resp.data ?? []) map.set(r.id, r);
  return map;
}

function fmtDateTime(iso: string | null): string {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

type DiffMap = Record<string, { from: unknown; to: unknown }>;

function normalizeDiffValue(v: unknown): string {
  if (v == null) return "(비어 있음)";
  if (typeof v === "string") return v || "(비어 있음)";
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
}

const FIELD_LABEL: Record<string, string> = {
  title: "제목",
  description: "설명",
  acorns: "도토리",
  config_json: "세부 설정",
};

function DiffTable({ diff }: { diff: DiffMap }) {
  const keys = Object.keys(diff ?? {});
  if (keys.length === 0) {
    return (
      <p className="text-[11px] text-zinc-500">변경 사항이 기록되어 있지 않아요.</p>
    );
  }
  return (
    <table className="mt-1.5 w-full border-separate border-spacing-y-1.5 text-xs">
      <thead className="sr-only">
        <tr>
          <th>항목</th>
          <th>Before</th>
          <th>After</th>
        </tr>
      </thead>
      <tbody>
        {keys.map((k) => (
          <tr key={k} className="align-top">
            <th
              scope="row"
              className="w-20 rounded-l-lg bg-violet-50 px-2 py-1.5 text-left text-[11px] font-semibold text-violet-900"
            >
              {FIELD_LABEL[k] ?? k}
            </th>
            <td className="border-l border-zinc-200 bg-rose-50/60 p-2">
              <p className="text-[9px] font-semibold uppercase tracking-wide text-rose-700">
                Before
              </p>
              <pre className="mt-0.5 whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-zinc-800">
                {normalizeDiffValue(diff[k]?.from)}
              </pre>
            </td>
            <td className="rounded-r-lg bg-emerald-50/60 p-2">
              <p className="text-[9px] font-semibold uppercase tracking-wide text-emerald-700">
                After
              </p>
              <pre className="mt-0.5 whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-zinc-800">
                {normalizeDiffValue(diff[k]?.to)}
              </pre>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function buildHref(tab: TabKey): string {
  return tab === "PROPOSED"
    ? "/partner/missions/contributions"
    : `/partner/missions/contributions?tab=${tab}`;
}

function tabFromParam(raw?: string): TabKey {
  if (raw === "ACCEPTED" || raw === "REJECTED" || raw === "ALL") return raw;
  return "PROPOSED";
}

function missionKindLabel(kind: MissionKind): {
  icon: string;
  label: string;
} {
  const m = MISSION_KIND_META[kind];
  return { icon: m.icon, label: m.label };
}

export default async function PartnerContributionsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const partner = await requirePartner();
  const sp = await searchParams;
  const tab = tabFromParam(sp.tab);

  // 전체 로드 후 필터 (카운트 배지에도 사용)
  const all = await loadContributionsByPartner(partner.id);
  const filtered: MissionContributionRow[] =
    tab === "ALL" ? all : all.filter((c) => c.status === tab);

  const counts: Record<ContributionStatus, number> = {
    PROPOSED: 0,
    ACCEPTED: 0,
    REJECTED: 0,
    WITHDRAWN: 0,
  };
  for (const c of all) counts[c.status] += 1;

  const missionIds = Array.from(
    new Set(filtered.map((c) => c.target_partner_mission_id))
  );
  const orgIds = Array.from(new Set(filtered.map((c) => c.proposed_by_org_id)));
  const acceptedVersionIds = Array.from(
    new Set(
      filtered
        .map((c) => c.accepted_version_id)
        .filter((v): v is string => typeof v === "string" && v.length > 0)
    )
  );

  const [missionMap, orgMap, acceptedVersionMap] = await Promise.all([
    loadMissionMap([...missionIds, ...acceptedVersionIds]),
    loadOrgNameMap(orgIds),
    Promise.resolve(new Map<string, PartnerMissionRow>()), // merged into missionMap above
  ]);
  // acceptedVersionMap 는 missionMap 에 이미 포함됨
  void acceptedVersionMap;

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      {/* Breadcrumb */}
      <nav aria-label="breadcrumb" className="text-xs text-[#8B7F75]">
        <Link href="/partner/dashboard" className="hover:text-[#2D5A3D]">
          대시보드
        </Link>
        <span className="mx-2">/</span>
        <Link href="/partner/missions" className="hover:text-[#2D5A3D]">
          미션 라이브러리
        </Link>
        <span className="mx-2">/</span>
        <span className="font-semibold text-[#2D5A3D]">기관 제안함</span>
      </nav>

      {/* Header card */}
      <section className="overflow-hidden rounded-2xl bg-gradient-to-br from-violet-600 via-violet-500 to-violet-700 p-6 text-white shadow-sm md:p-7">
        <p className="text-xs font-semibold uppercase tracking-wider text-violet-100">
          Partner · Contributions
        </p>
        <h1 className="mt-2 flex items-center gap-2 text-2xl font-bold md:text-3xl">
          <span aria-hidden>💌</span>
          <span>기관에서 온 개선 제안</span>
        </h1>
        <p className="mt-2 max-w-xl text-sm text-violet-50">
          현장에서 미션을 운영하는 기관들이 직접 개선한 아이디어예요. 수용하면
          지사 가이드의 새 버전(DRAFT)으로 승격돼요.
        </p>

        <div className="mt-4 grid grid-cols-4 gap-2 text-violet-900 sm:max-w-md">
          <StatBadge label="검토 대기" count={counts.PROPOSED} icon="💌" />
          <StatBadge label="수용" count={counts.ACCEPTED} icon="✅" />
          <StatBadge label="반려" count={counts.REJECTED} icon="❌" />
          <StatBadge label="회수" count={counts.WITHDRAWN} icon="↩" />
        </div>
      </section>

      {/* Tabs */}
      <nav aria-label="제안 상태 탭" className="flex flex-wrap gap-2">
        {TABS.map((t) => {
          const isActive = t.key === tab;
          const count =
            t.key === "ALL"
              ? all.length
              : counts[t.key as ContributionStatus] ?? 0;
          return (
            <Link
              key={t.key}
              href={buildHref(t.key)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                isActive
                  ? "border-violet-600 bg-violet-600 text-white"
                  : "border-zinc-200 bg-white text-zinc-700 hover:border-violet-400 hover:text-violet-700"
              }`}
            >
              <span aria-hidden>{t.icon}</span>
              <span>{t.label}</span>
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] ${
                  isActive ? "bg-white/20" : "bg-zinc-100"
                }`}
              >
                {count}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-violet-200 bg-white p-10 text-center">
          <span className="text-5xl" aria-hidden>
            🌱
          </span>
          <p className="mt-3 text-base font-bold text-violet-900">
            {tab === "PROPOSED"
              ? "아직 검토할 제안이 없어요"
              : "조건에 맞는 제안이 없어요"}
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            기관이 미션을 편집하면서 개선 아이디어를 보내오면 여기 쌓여요.
          </p>
        </div>
      ) : (
        <ul className="grid gap-3">
          {filtered.map((c) => {
            const mission = missionMap.get(c.target_partner_mission_id);
            const acceptedMission = c.accepted_version_id
              ? missionMap.get(c.accepted_version_id)
              : null;
            const orgName = orgMap.get(c.proposed_by_org_id) ?? "(알 수 없는 기관)";
            const meta = CONTRIBUTION_STATUS_META[c.status];
            const kind = mission ? missionKindLabel(mission.kind) : null;

            return (
              <li
                key={c.id}
                className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm"
              >
                <div className="space-y-3 p-4 md:p-5">
                  {/* Header row */}
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-semibold ${meta.color}`}
                        >
                          <span aria-hidden>{meta.icon}</span>
                          <span>{meta.label}</span>
                        </span>
                        {kind && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-[#D4E4BC] bg-[#F5F1E8] px-2 py-0.5 font-semibold text-[#2D5A3D]">
                            <span aria-hidden>{kind.icon}</span>
                            <span>{kind.label}</span>
                          </span>
                        )}
                        <span className="inline-flex items-center gap-1 rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 font-semibold text-violet-800">
                          <span aria-hidden>🏫</span>
                          <span>{orgName}</span>
                        </span>
                      </div>
                      <h3 className="mt-1.5 truncate text-base font-bold text-zinc-900">
                        {mission?.title ?? "(삭제된 미션)"}
                      </h3>
                      <p className="mt-0.5 text-[10px] text-zinc-500">
                        제안일: {fmtDateTime(c.created_at)}
                      </p>
                    </div>
                  </div>

                  {/* 제안 메시지 */}
                  {c.proposal_note && (
                    <div className="rounded-xl border border-violet-100 bg-violet-50/50 p-3">
                      <p className="text-[11px] font-semibold text-violet-900">
                        기관의 제안 메시지
                      </p>
                      <p className="mt-1 whitespace-pre-wrap text-xs text-zinc-700">
                        {c.proposal_note}
                      </p>
                    </div>
                  )}

                  {/* Diff */}
                  <div>
                    <p className="text-[11px] font-semibold text-zinc-700">
                      변경 내용
                    </p>
                    <DiffTable diff={(c.proposed_diff ?? {}) as DiffMap} />
                  </div>

                  {/* 상태별 하단 영역 */}
                  {c.status === "PROPOSED" && (
                    <ReviewActions contributionId={c.id} />
                  )}

                  {c.status === "ACCEPTED" && (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3 text-xs">
                      <p className="font-semibold text-emerald-900">
                        ✅ 수용 완료 · 새 버전 생성됨
                      </p>
                      <p className="mt-0.5 text-[10px] text-emerald-800/80">
                        검토: {c.reviewed_by ?? "-"} ·{" "}
                        {fmtDateTime(c.reviewed_at)}
                      </p>
                      {c.review_note && (
                        <p className="mt-1 whitespace-pre-wrap text-zinc-700">
                          {c.review_note}
                        </p>
                      )}
                      {acceptedMission && (
                        <div className="mt-2">
                          <Link
                            href={`/partner/missions/${acceptedMission.id}/edit`}
                            className="inline-flex items-center gap-1 rounded-lg border border-emerald-300 bg-white px-2.5 py-1.5 text-[11px] font-bold text-emerald-800 hover:bg-emerald-100"
                          >
                            → 새 버전(v{acceptedMission.version}) 편집하기
                          </Link>
                        </div>
                      )}
                    </div>
                  )}

                  {c.status === "REJECTED" && (
                    <div className="rounded-xl border border-rose-200 bg-rose-50/60 p-3 text-xs">
                      <p className="font-semibold text-rose-900">❌ 반려됨</p>
                      <p className="mt-0.5 text-[10px] text-rose-800/80">
                        검토: {c.reviewed_by ?? "-"} ·{" "}
                        {fmtDateTime(c.reviewed_at)}
                      </p>
                      {c.review_note && (
                        <p className="mt-1 whitespace-pre-wrap text-zinc-700">
                          {c.review_note}
                        </p>
                      )}
                    </div>
                  )}

                  {c.status === "WITHDRAWN" && (
                    <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-600">
                      ↩ 기관이 제안을 회수했어요.
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function StatBadge({
  label,
  count,
  icon,
}: {
  label: string;
  count: number;
  icon: string;
}) {
  return (
    <div className="rounded-xl bg-white/95 p-2 text-center">
      <p className="flex items-center justify-center gap-0.5 text-[10px] font-semibold text-zinc-600">
        <span aria-hidden>{icon}</span>
        <span>{label}</span>
      </p>
      <p className="text-lg font-extrabold text-violet-900">{count}</p>
    </div>
  );
}
