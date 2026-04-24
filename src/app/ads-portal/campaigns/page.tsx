import Link from "next/link";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { AcornIcon } from "@/components/acorn-icon";
import {
  deleteCampaignAction,
  updateCampaignStatusAction,
  type CampaignPlacement,
  type CampaignPortal,
  type CampaignStatus,
} from "./actions";

type Campaign = {
  id: string;
  advertiser_name: string;
  title: string;
  description: string | null;
  creative_url: string | null;
  target_portal: CampaignPortal;
  target_region: string | null;
  target_age_group: string | null;
  placement: CampaignPlacement;
  budget: number;
  spent: number;
  impressions: number;
  clicks: number;
  conversions: number;
  start_date: string | null;
  end_date: string | null;
  status: CampaignStatus;
  created_at: string;
};

const PORTAL_META: Record<
  CampaignPortal,
  { label: string; icon: string; chip: string }
> = {
  FAMILY: {
    label: "가족",
    icon: "👨‍👩‍👧",
    chip: "bg-rose-50 text-rose-700 border-rose-200",
  },
  ORG: {
    label: "기관",
    icon: "🏫",
    chip: "bg-sky-50 text-sky-700 border-sky-200",
  },
  PARTNER: {
    label: "업체",
    icon: "🏡",
    chip: "bg-amber-50 text-amber-700 border-amber-200",
  },
  TALK: {
    label: "토리톡",
    icon: "🌲",
    chip: "bg-violet-50 text-violet-700 border-violet-200",
  },
};

const STATUS_META: Record<
  CampaignStatus,
  { label: string; chip: string; dot: string }
> = {
  DRAFT: {
    label: "초안",
    chip: "bg-[#F1EDE7] text-[#6B6560] border-[#E5D3B8]",
    dot: "bg-[#B5AFA8]",
  },
  PENDING: {
    label: "검토 중",
    chip: "bg-amber-50 text-amber-800 border-amber-200",
    dot: "bg-amber-500",
  },
  ACTIVE: {
    label: "진행 중",
    chip: "bg-emerald-50 text-emerald-800 border-emerald-200",
    dot: "bg-emerald-500",
  },
  PAUSED: {
    label: "일시정지",
    chip: "bg-slate-50 text-slate-700 border-slate-200",
    dot: "bg-slate-400",
  },
  ENDED: {
    label: "종료",
    chip: "bg-zinc-100 text-zinc-600 border-zinc-200",
    dot: "bg-zinc-400",
  },
};

function formatNumber(n: number): string {
  return (n ?? 0).toLocaleString("ko-KR");
}

function formatWon(n: number): string {
  return `${formatNumber(n)}원`;
}

function formatDate(iso: string | null): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function calcCtr(impressions: number, clicks: number): string {
  if (!impressions || impressions === 0) return "0.00";
  return ((clicks / impressions) * 100).toFixed(2);
}

async function loadCampaigns(): Promise<Campaign[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ad_campaigns")
    .select(
      "id,advertiser_name,title,description,creative_url,target_portal,target_region,target_age_group,placement,budget,spent,impressions,clicks,conversions,start_date,end_date,status,created_at"
    )
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[ads-portal/campaigns] load error", error);
    return [];
  }
  return (data ?? []) as Campaign[];
}

async function SubmittedBanner({ submitted }: { submitted: boolean }) {
  if (!submitted) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="rounded-2xl border border-emerald-300 bg-emerald-50 p-4 flex items-start gap-3"
    >
      <span className="text-2xl flex-shrink-0" aria-hidden>
        <AcornIcon size={24} />
      </span>
      <div className="flex-1">
        <p className="text-sm font-bold text-emerald-900">
          캠페인이 검토 대기열에 추가됐어요.
        </p>
        <p className="mt-1 text-xs text-emerald-800 leading-relaxed">
          관리자 승인 후 Stage 2에서 활성화됩니다. 진행 상태는 아래 목록에서
          확인하세요.
        </p>
      </div>
    </div>
  );
}

export default async function CampaignsListPage({
  searchParams,
}: {
  searchParams: Promise<{ submitted?: string }>;
}) {
  const sp = await searchParams;
  const submitted = sp?.submitted === "1";
  const campaigns = await loadCampaigns();

  const activeCount = campaigns.filter((c) => c.status === "ACTIVE").length;
  const pendingCount = campaigns.filter((c) => c.status === "PENDING").length;
  const endedCount = campaigns.filter(
    (c) => c.status === "ENDED" || c.status === "PAUSED"
  ).length;

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav aria-label="breadcrumb" className="text-xs text-[#8B7F75]">
        <Link href="/ads-portal/dashboard" className="hover:text-[#2D5A3D]">
          대시보드
        </Link>
        <span className="mx-2">/</span>
        <span className="font-semibold text-[#2D5A3D]">캠페인 관리</span>
      </nav>

      <Suspense fallback={null}>
        <SubmittedBanner submitted={submitted} />
      </Suspense>

      {/* Header */}
      <header className="rounded-3xl border border-[#E8C9A0] bg-gradient-to-br from-[#FAE7D0] via-white to-[#E8F0E4] p-5 shadow-sm md:p-7">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <span className="text-3xl" aria-hidden>
              📣
            </span>
            <div>
              <h1 className="text-xl font-bold text-[#2D5A3D] md:text-2xl">
                내 캠페인
              </h1>
              <p className="mt-1 text-xs text-[#6B6560] md:text-sm">
                집행 현황·성과·일시정지까지 한 곳에서 관리하세요.
              </p>
            </div>
          </div>
          <Link
            href="/ads-portal/campaigns/new"
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-[#2D5A3D] to-[#3A7A52] px-4 py-2.5 text-sm font-bold text-white shadow-md hover:from-[#234a30] hover:to-[#2D5A3D] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2D5A3D]/40"
          >
            <span aria-hidden>+</span>
            <span>새 캠페인</span>
          </Link>
        </div>
      </header>

      {/* 통계 */}
      <section
        aria-label="캠페인 통계"
        className="grid grid-cols-3 gap-3"
      >
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-[11px] font-semibold text-emerald-700">진행중</p>
          <p className="mt-1 text-2xl font-extrabold text-emerald-900">
            {activeCount}
          </p>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-[11px] font-semibold text-amber-700">검토중</p>
          <p className="mt-1 text-2xl font-extrabold text-amber-900">
            {pendingCount}
          </p>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
          <p className="text-[11px] font-semibold text-zinc-600">종료/중지</p>
          <p className="mt-1 text-2xl font-extrabold text-zinc-800">
            {endedCount}
          </p>
        </div>
      </section>

      {/* 목록 */}
      <section className="space-y-3">
        {campaigns.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#E5D3B8] bg-white p-10 text-center">
            <div className="text-5xl" aria-hidden>
              🌱
            </div>
            <p className="mt-3 text-sm font-semibold text-[#6B4423]">
              아직 등록된 캠페인이 없어요
            </p>
            <p className="mt-1 text-xs text-[#8B6F47]">
              6단계 마법사로 첫 캠페인을 만들어보세요.
            </p>
            <Link
              href="/ads-portal/campaigns/new"
              className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-[#2D5A3D] px-4 py-2 text-xs font-bold text-white hover:bg-[#234a30]"
            >
              <span aria-hidden>+</span>
              <span>새 캠페인 만들기</span>
            </Link>
          </div>
        ) : (
          <ul className="space-y-3">
            {campaigns.map((c) => {
              const portal = PORTAL_META[c.target_portal];
              const statusMeta = STATUS_META[c.status];
              const ctr = calcCtr(c.impressions, c.clicks);
              const spentPct = c.budget > 0
                ? Math.min(100, Math.round((c.spent / c.budget) * 100))
                : 0;

              return (
                <li
                  key={c.id}
                  className="rounded-2xl border border-[#E5D3B8] bg-white p-4 shadow-sm hover:shadow-md transition-shadow"
                >
                  {/* 상단: 제목 + 상태 */}
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${portal.chip}`}
                        >
                          <span aria-hidden>{portal.icon}</span>
                          <span>{portal.label}</span>
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${statusMeta.chip}`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${statusMeta.dot}`}
                            aria-hidden
                          />
                          {statusMeta.label}
                        </span>
                        <span className="rounded-full bg-[#F5E6D3] px-2 py-0.5 text-[10px] font-medium text-[#8B6F47] border border-[#E5D3B8]">
                          {c.placement}
                        </span>
                      </div>
                      <h3 className="mt-1.5 text-base font-bold text-[#2D5A3D] truncate">
                        {c.title}
                      </h3>
                      {c.description ? (
                        <p className="mt-0.5 text-xs text-[#6B6560] line-clamp-2">
                          {c.description}
                        </p>
                      ) : null}
                      <p className="mt-1 text-[11px] text-[#8B6F47]">
                        {formatDate(c.start_date)} ~ {formatDate(c.end_date)}
                      </p>
                    </div>
                  </div>

                  {/* 성과 지표 */}
                  <dl className="mt-3 grid grid-cols-3 gap-2">
                    <div className="rounded-lg bg-[#FFF8F0] p-2 text-center">
                      <dt className="text-[10px] text-[#8B6F47]">노출</dt>
                      <dd className="text-sm font-bold text-[#6B4423]">
                        {formatNumber(c.impressions)}
                      </dd>
                    </div>
                    <div className="rounded-lg bg-[#FFF8F0] p-2 text-center">
                      <dt className="text-[10px] text-[#8B6F47]">클릭</dt>
                      <dd className="text-sm font-bold text-[#6B4423]">
                        {formatNumber(c.clicks)}
                      </dd>
                    </div>
                    <div className="rounded-lg bg-[#FFF8F0] p-2 text-center">
                      <dt className="text-[10px] text-[#8B6F47]">CTR</dt>
                      <dd className="text-sm font-bold text-[#6B4423]">
                        {ctr}%
                      </dd>
                    </div>
                  </dl>

                  {/* 예산 진행 바 */}
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-[11px] text-[#6B6560]">
                      <span>집행 예산</span>
                      <span className="font-semibold text-[#2D5A3D]">
                        {formatWon(c.spent)} / {formatWon(c.budget)}
                      </span>
                    </div>
                    <div
                      className="mt-1 h-2 w-full overflow-hidden rounded-full bg-[#F1EDE7]"
                      role="progressbar"
                      aria-valuenow={spentPct}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label="집행 예산 비율"
                    >
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[#C4956A] to-[#2D5A3D] transition-all"
                        style={{ width: `${spentPct}%` }}
                      />
                    </div>
                  </div>

                  {/* 액션 */}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Link
                      href={`/ads-portal/campaigns/new?edit=${c.id}`}
                      className="rounded-lg border border-[#E5D3B8] bg-white px-3 py-1.5 text-xs font-semibold text-[#6B4423] hover:bg-[#FFF8F0] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C4956A]/40"
                    >
                      편집
                    </Link>
                    {c.status === "ACTIVE" ? (
                      <form
                        action={async () => {
                          "use server";
                          await updateCampaignStatusAction(c.id, "PAUSED");
                        }}
                      >
                        <button
                          type="submit"
                          className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-100"
                        >
                          일시정지
                        </button>
                      </form>
                    ) : c.status === "PAUSED" ? (
                      <form
                        action={async () => {
                          "use server";
                          await updateCampaignStatusAction(c.id, "ACTIVE");
                        }}
                      >
                        <button
                          type="submit"
                          className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100"
                        >
                          재개
                        </button>
                      </form>
                    ) : null}
                    {c.status !== "ENDED" ? (
                      <form
                        action={async () => {
                          "use server";
                          await updateCampaignStatusAction(c.id, "ENDED");
                        }}
                      >
                        <button
                          type="submit"
                          className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
                        >
                          종료
                        </button>
                      </form>
                    ) : (
                      <form
                        action={async () => {
                          "use server";
                          await deleteCampaignAction(c.id);
                        }}
                      >
                        <button
                          type="submit"
                          className="rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50"
                        >
                          삭제
                        </button>
                      </form>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Stage 1 안내 */}
      <section
        role="note"
        className="rounded-xl border border-amber-300 bg-amber-50 p-4 flex items-center gap-3"
      >
        <span className="text-xl flex-shrink-0" aria-hidden>
          ⏳
        </span>
        <p className="text-xs text-amber-900 leading-relaxed">
          <span className="font-bold">Stage 1 (OFF)</span> — 캠페인 생성·편집은
          가능하지만 실제 노출은 Stage 2 파일럿 오픈 이후 관리자 승인 시
          시작됩니다.
        </p>
      </section>
    </div>
  );
}
