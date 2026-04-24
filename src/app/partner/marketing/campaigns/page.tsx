import Link from "next/link";
import { requirePartner } from "@/lib/auth-guard";
import { createClient } from "@/lib/supabase/server";
import {
  CAMPAIGN_STATUSES,
  type CampaignRow,
  type CampaignStatus,
  STATUS_LABEL,
  STATUS_STYLE,
  GOAL_LABEL,
  CHANNEL_LABEL,
} from "./types";

export const dynamic = "force-dynamic";

type FilterKey = "ALL" | CampaignStatus;

const TAB_FILTERS: { key: FilterKey; label: string }[] = [
  { key: "ALL", label: "전체" },
  { key: "DRAFT", label: "초안" },
  { key: "SCHEDULED", label: "예약됨" },
  { key: "SENT", label: "발송완료" },
  { key: "PAUSED", label: "일시중지" },
];

function pct(num: number, denom: number): string {
  if (!denom || denom <= 0) return "-";
  return `${((num / denom) * 100).toFixed(1)}%`;
}

function fmtDate(iso: string): string {
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

async function loadCampaigns(partnerId: string): Promise<CampaignRow[]> {
  const supabase = await createClient();
  const client = supabase as unknown as {
    from: (t: string) => {
      select: (c: string) => {
        eq: (
          k: string,
          v: string
        ) => {
          order: (
            c: string,
            opt: { ascending: boolean }
          ) => Promise<{ data: unknown[] | null }>;
        };
      };
    };
  };

  const { data } = await client
    .from("partner_campaigns")
    .select("*")
    .eq("partner_id", partnerId)
    .order("created_at", { ascending: false });

  return (data ?? []) as CampaignRow[];
}

export default async function CampaignsListPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const partner = await requirePartner();
  const { filter } = await searchParams;

  const activeFilter: FilterKey =
    filter && (CAMPAIGN_STATUSES as string[]).includes(filter)
      ? (filter as CampaignStatus)
      : filter === "ALL" || !filter
      ? "ALL"
      : "ALL";

  const all = await loadCampaigns(partner.id);
  const list =
    activeFilter === "ALL"
      ? all
      : all.filter((c) => c.status === activeFilter);

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="text-xs text-[#6B6560]">
        <Link href="/partner/dashboard" className="hover:underline">
          대시보드
        </Link>
        <span className="mx-1">›</span>
        <span className="font-semibold text-[#2D5A3D]">마케팅 캠페인</span>
      </nav>

      {/* Header */}
      <section className="overflow-hidden rounded-2xl bg-gradient-to-br from-[#2D5A3D] via-[#4A7C59] to-[#2D5A3D] p-6 text-white shadow-sm md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[#D4E4BC]">
              Marketing · 캠페인
            </p>
            <h1 className="mt-2 flex items-center gap-2 text-2xl font-bold md:text-3xl">
              <span>📢</span>
              <span>캠페인</span>
            </h1>
            <p className="mt-1 text-sm text-[#D4E4BC]">
              목표를 정하고 고객에게 알림을 보내세요.
            </p>
          </div>
          <Link
            href="/partner/marketing/campaigns/new"
            className="inline-flex items-center gap-1.5 rounded-xl bg-white px-4 py-2 text-sm font-bold text-[#2D5A3D] shadow-sm transition hover:bg-[#F5F1E8]"
          >
            <span>➕</span>
            <span>새 캠페인</span>
          </Link>
        </div>
      </section>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        {TAB_FILTERS.map((tab) => {
          const isActive = tab.key === activeFilter;
          const count =
            tab.key === "ALL"
              ? all.length
              : all.filter((c) => c.status === tab.key).length;
          const href =
            tab.key === "ALL"
              ? "/partner/marketing/campaigns"
              : `/partner/marketing/campaigns?filter=${tab.key}`;
          return (
            <Link
              key={tab.key}
              href={href}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                isActive
                  ? "border-[#2D5A3D] bg-[#2D5A3D] text-white"
                  : "border-[#D4E4BC] bg-white text-[#6B6560] hover:border-[#2D5A3D] hover:text-[#2D5A3D]"
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] ${
                  isActive ? "bg-white/20" : "bg-[#F5F1E8]"
                }`}
              >
                {count}
              </span>
            </Link>
          );
        })}
      </div>

      {/* List */}
      {list.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#D4E4BC] bg-white p-10 text-center">
          <div className="text-5xl">🌱</div>
          <p className="mt-3 text-base font-bold text-[#2D5A3D]">
            아직 캠페인이 없어요. 첫 캠페인을 시작해보세요!
          </p>
          <p className="mt-1 text-xs text-[#6B6560]">
            목표를 정하고, 타겟을 고르고, 메시지를 보내면 끝!
          </p>
          <Link
            href="/partner/marketing/campaigns/new"
            className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-[#2D5A3D] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#4A7C59]"
          >
            <span>➕</span>
            <span>첫 캠페인 만들기</span>
          </Link>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {list.map((c) => {
            const channels = c.channels ?? [];
            return (
              <Link
                key={c.id}
                href={`/partner/marketing/campaigns/${c.id}`}
                className="group flex flex-col rounded-2xl border border-[#D4E4BC] bg-white p-4 shadow-sm transition hover:border-[#2D5A3D] hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {c.goal && (
                        <span className="inline-flex items-center rounded-full border border-[#D4E4BC] bg-[#F5F1E8] px-2 py-0.5 text-[10px] font-semibold text-[#2D5A3D]">
                          {GOAL_LABEL[c.goal]}
                        </span>
                      )}
                      <span
                        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                          STATUS_STYLE[c.status]
                        }`}
                      >
                        {STATUS_LABEL[c.status]}
                      </span>
                    </div>
                    <div className="mt-2 text-base font-bold text-[#2C2C2C] group-hover:text-[#2D5A3D]">
                      {c.name}
                    </div>
                    {c.message_title && (
                      <div className="mt-0.5 line-clamp-1 text-xs text-[#6B6560]">
                        {c.message_title}
                      </div>
                    )}
                  </div>
                </div>

                {channels.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {channels.map((ch) => (
                      <span
                        key={ch}
                        className="inline-flex items-center rounded-md border border-[#D4E4BC] bg-white px-1.5 py-0.5 text-[10px] font-semibold text-[#6B6560]"
                      >
                        {CHANNEL_LABEL[ch]}
                      </span>
                    ))}
                  </div>
                )}

                {/* Metrics */}
                <div className="mt-3 grid grid-cols-4 gap-2 rounded-xl bg-[#FFF8F0] p-2 text-center">
                  <div>
                    <div className="text-[10px] text-[#6B6560]">발송</div>
                    <div className="text-sm font-bold text-[#2C2C2C]">
                      {c.sent_count.toLocaleString("ko-KR")}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-[#6B6560]">오픈</div>
                    <div className="text-sm font-bold text-[#2C2C2C]">
                      {pct(c.opened_count, c.sent_count)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-[#6B6560]">클릭</div>
                    <div className="text-sm font-bold text-[#2C2C2C]">
                      {pct(c.clicked_count, c.sent_count)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-[#6B6560]">전환</div>
                    <div className="text-sm font-bold text-[#2D5A3D]">
                      {pct(c.converted_count, c.sent_count)}
                    </div>
                  </div>
                </div>

                <div className="mt-3 text-[10px] text-[#6B6560]">
                  생성 {fmtDate(c.created_at)}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
