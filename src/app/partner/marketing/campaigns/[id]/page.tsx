import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePartner } from "@/lib/auth-guard";
import { createClient } from "@/lib/supabase/server";
import {
  CHANNEL_OPTIONS,
  CHANNEL_LABEL,
  GOAL_OPTIONS,
  GOAL_LABEL,
  STATUS_LABEL,
  STATUS_STYLE,
  type CampaignRow,
  type CampaignChannel,
  type SegmentOption,
} from "../types";
import { updateCampaignAction } from "../actions";
import { ActionButtons } from "./action-buttons";

export const dynamic = "force-dynamic";

async function loadCampaign(id: string): Promise<CampaignRow | null> {
  const supabase = await createClient();
  const client = supabase as unknown as {
    from: (t: string) => {
      select: (c: string) => {
        eq: (
          k: string,
          v: string
        ) => {
          maybeSingle: () => Promise<{ data: unknown | null }>;
        };
      };
    };
  };
  const { data } = await client
    .from("partner_campaigns")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return (data as CampaignRow | null) ?? null;
}

async function loadSegments(partnerId: string): Promise<SegmentOption[]> {
  const supabase = await createClient();
  const client = supabase as unknown as {
    from: (t: string) => {
      select: (c: string) => {
        eq: (k: string, v: string) => Promise<{ data: unknown[] | null }>;
      };
    };
  };
  const { data } = await client
    .from("partner_segments")
    .select("id,name,icon,member_count")
    .eq("partner_id", partnerId);
  return (data ?? []) as SegmentOption[];
}

function pct(num: number, denom: number): string {
  if (!denom || denom <= 0) return "-";
  return `${((num / denom) * 100).toFixed(1)}%`;
}

function fmtDate(iso: string | null): string {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleString("ko-KR");
  } catch {
    return iso;
  }
}

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const partner = await requirePartner();
  const { id } = await params;

  const campaign = await loadCampaign(id);
  if (!campaign || campaign.partner_id !== partner.id) notFound();

  const segments = await loadSegments(partner.id);
  const selectedSegment = segments.find(
    (s) => s.id === campaign.target_segment_id
  );

  const updateBound = updateCampaignAction.bind(null, id);
  const canEdit =
    campaign.status === "DRAFT" ||
    campaign.status === "SCHEDULED" ||
    campaign.status === "PAUSED";
  const canSend =
    campaign.status === "DRAFT" || campaign.status === "PAUSED";
  const canPause = campaign.status === "SCHEDULED";

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="text-xs text-[#6B6560]">
        <Link href="/partner/dashboard" className="hover:underline">
          대시보드
        </Link>
        <span className="mx-1">›</span>
        <Link href="/partner/marketing/campaigns" className="hover:underline">
          캠페인
        </Link>
        <span className="mx-1">›</span>
        <span className="font-semibold text-[#2D5A3D]">{campaign.name}</span>
      </nav>

      {/* Header */}
      <section className="overflow-hidden rounded-2xl border border-[#D4E4BC] bg-white p-5 shadow-sm md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              {campaign.goal && (
                <span className="inline-flex items-center rounded-full border border-[#D4E4BC] bg-[#F5F1E8] px-2 py-0.5 text-[10px] font-semibold text-[#2D5A3D]">
                  {GOAL_LABEL[campaign.goal]}
                </span>
              )}
              <span
                className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                  STATUS_STYLE[campaign.status]
                }`}
              >
                {STATUS_LABEL[campaign.status]}
              </span>
            </div>
            <h1 className="mt-2 text-xl font-bold text-[#2C2C2C] md:text-2xl">
              📢 {campaign.name}
            </h1>
            <p className="mt-1 text-xs text-[#6B6560]">
              생성 {fmtDate(campaign.created_at)}
              {campaign.scheduled_at &&
                ` · 예약 ${fmtDate(campaign.scheduled_at)}`}
            </p>
          </div>

          <ActionButtons
            campaignId={campaign.id}
            canSend={canSend}
            canPause={canPause}
          />
        </div>
      </section>

      {/* 성과 */}
      <section>
        <h2 className="mb-3 flex items-center gap-2 text-base font-bold text-[#2D5A3D]">
          <span>📊</span>
          <span>성과 통계</span>
        </h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard
            icon="📤"
            label="발송"
            value={campaign.sent_count.toLocaleString("ko-KR")}
            sub="건"
          />
          <StatCard
            icon="👀"
            label="오픈"
            value={campaign.opened_count.toLocaleString("ko-KR")}
            sub={pct(campaign.opened_count, campaign.sent_count)}
          />
          <StatCard
            icon="🖱️"
            label="클릭"
            value={campaign.clicked_count.toLocaleString("ko-KR")}
            sub={pct(campaign.clicked_count, campaign.sent_count)}
          />
          <StatCard
            icon="🎯"
            label="전환"
            value={campaign.converted_count.toLocaleString("ko-KR")}
            sub={pct(campaign.converted_count, campaign.sent_count)}
            highlight
          />
        </div>
      </section>

      {/* 수정 폼 */}
      <section>
        <h2 className="mb-3 flex items-center gap-2 text-base font-bold text-[#2D5A3D]">
          <span>✏️</span>
          <span>캠페인 내용</span>
          {!canEdit && (
            <span className="rounded-full bg-[#F5F1E8] px-2 py-0.5 text-[10px] font-normal text-[#6B6560]">
              발송된 캠페인은 수정할 수 없어요
            </span>
          )}
        </h2>

        <form
          action={updateBound}
          className="space-y-4 rounded-2xl border border-[#D4E4BC] bg-white p-5 shadow-sm"
        >
          <fieldset disabled={!canEdit} className="space-y-4">
            <div>
              <label
                htmlFor="name"
                className="text-xs font-semibold text-[#2D5A3D]"
              >
                캠페인 이름 *
              </label>
              <input
                id="name"
                name="name"
                type="text"
                defaultValue={campaign.name}
                required
                className="mt-1 w-full rounded-lg border border-[#D4E4BC] bg-white px-3 py-2 text-sm focus:border-[#2D5A3D] focus:outline-none focus:ring-2 focus:ring-[#2D5A3D]/20 disabled:bg-[#F5F1E8]"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label
                  htmlFor="goal"
                  className="text-xs font-semibold text-[#2D5A3D]"
                >
                  목표
                </label>
                <select
                  id="goal"
                  name="goal"
                  defaultValue={campaign.goal ?? ""}
                  className="mt-1 w-full rounded-lg border border-[#D4E4BC] bg-white px-3 py-2 text-sm focus:border-[#2D5A3D] focus:outline-none focus:ring-2 focus:ring-[#2D5A3D]/20 disabled:bg-[#F5F1E8]"
                >
                  <option value="">-</option>
                  {GOAL_OPTIONS.map((g) => (
                    <option key={g.key} value={g.key}>
                      {g.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  htmlFor="target_segment_id"
                  className="text-xs font-semibold text-[#2D5A3D]"
                >
                  타겟 세그먼트
                </label>
                <select
                  id="target_segment_id"
                  name="target_segment_id"
                  defaultValue={campaign.target_segment_id ?? ""}
                  className="mt-1 w-full rounded-lg border border-[#D4E4BC] bg-white px-3 py-2 text-sm focus:border-[#2D5A3D] focus:outline-none focus:ring-2 focus:ring-[#2D5A3D]/20 disabled:bg-[#F5F1E8]"
                >
                  <option value="">🌍 전체 고객</option>
                  {segments.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.icon ?? "🎯"} {s.name} ({s.member_count ?? 0}명)
                    </option>
                  ))}
                </select>
                {selectedSegment && (
                  <p className="mt-1 text-[10px] text-[#6B6560]">
                    현재: {selectedSegment.icon ?? "🎯"} {selectedSegment.name}
                  </p>
                )}
              </div>
            </div>

            <div>
              <div className="text-xs font-semibold text-[#2D5A3D]">채널</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {CHANNEL_OPTIONS.map((opt) => {
                  const active = (campaign.channels ?? []).includes(
                    opt.key as CampaignChannel
                  );
                  return (
                    <label
                      key={opt.key}
                      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition ${
                        active
                          ? "border-[#2D5A3D] bg-[#F5F1E8] text-[#2D5A3D]"
                          : "border-[#D4E4BC] bg-white text-[#6B6560] hover:border-[#4A7C59]"
                      }`}
                    >
                      <input
                        type="checkbox"
                        name="channels"
                        value={opt.key}
                        defaultChecked={active}
                        className="h-3 w-3"
                      />
                      <span>
                        {opt.icon} {opt.label}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div>
              <label
                htmlFor="message_title"
                className="text-xs font-semibold text-[#2D5A3D]"
              >
                메시지 제목
              </label>
              <input
                id="message_title"
                name="message_title"
                type="text"
                defaultValue={campaign.message_title ?? ""}
                className="mt-1 w-full rounded-lg border border-[#D4E4BC] bg-white px-3 py-2 text-sm focus:border-[#2D5A3D] focus:outline-none focus:ring-2 focus:ring-[#2D5A3D]/20 disabled:bg-[#F5F1E8]"
              />
            </div>

            <div>
              <label
                htmlFor="message_body"
                className="text-xs font-semibold text-[#2D5A3D]"
              >
                메시지 본문
              </label>
              <textarea
                id="message_body"
                name="message_body"
                rows={5}
                defaultValue={campaign.message_body ?? ""}
                className="mt-1 w-full rounded-lg border border-[#D4E4BC] bg-white px-3 py-2 text-sm focus:border-[#2D5A3D] focus:outline-none focus:ring-2 focus:ring-[#2D5A3D]/20 disabled:bg-[#F5F1E8]"
              />
            </div>

            <div>
              <label
                htmlFor="message_cta_url"
                className="text-xs font-semibold text-[#2D5A3D]"
              >
                CTA URL
              </label>
              <input
                id="message_cta_url"
                name="message_cta_url"
                type="url"
                inputMode="url"
                defaultValue={campaign.message_cta_url ?? ""}
                className="mt-1 w-full rounded-lg border border-[#D4E4BC] bg-white px-3 py-2 text-sm focus:border-[#2D5A3D] focus:outline-none focus:ring-2 focus:ring-[#2D5A3D]/20 disabled:bg-[#F5F1E8]"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label
                  htmlFor="schedule_type"
                  className="text-xs font-semibold text-[#2D5A3D]"
                >
                  발송 유형
                </label>
                <select
                  id="schedule_type"
                  name="schedule_type"
                  defaultValue={campaign.schedule_type ?? "IMMEDIATE"}
                  className="mt-1 w-full rounded-lg border border-[#D4E4BC] bg-white px-3 py-2 text-sm focus:border-[#2D5A3D] focus:outline-none focus:ring-2 focus:ring-[#2D5A3D]/20 disabled:bg-[#F5F1E8]"
                >
                  <option value="IMMEDIATE">🚀 즉시</option>
                  <option value="SCHEDULED">📅 예약</option>
                </select>
              </div>
              <div>
                <label
                  htmlFor="scheduled_at"
                  className="text-xs font-semibold text-[#2D5A3D]"
                >
                  예약 시각
                </label>
                <input
                  id="scheduled_at"
                  name="scheduled_at"
                  type="datetime-local"
                  defaultValue={
                    campaign.scheduled_at
                      ? campaign.scheduled_at.slice(0, 16)
                      : ""
                  }
                  className="mt-1 w-full rounded-lg border border-[#D4E4BC] bg-white px-3 py-2 text-sm focus:border-[#2D5A3D] focus:outline-none focus:ring-2 focus:ring-[#2D5A3D]/20 disabled:bg-[#F5F1E8]"
                />
              </div>
            </div>
          </fieldset>

          {canEdit && (
            <div className="flex justify-end">
              <button
                type="submit"
                className="rounded-xl bg-[#2D5A3D] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#4A7C59]"
              >
                💾 저장
              </button>
            </div>
          )}
        </form>
      </section>

      {/* 선택된 채널 미리보기 */}
      {campaign.channels && campaign.channels.length > 0 && (
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-base font-bold text-[#2D5A3D]">
            <span>📡</span>
            <span>발송 채널</span>
          </h2>
          <div className="flex flex-wrap gap-2">
            {campaign.channels.map((ch) => (
              <span
                key={ch}
                className="inline-flex items-center gap-1 rounded-full border border-[#D4E4BC] bg-white px-3 py-1 text-xs font-semibold text-[#2D5A3D]"
              >
                {CHANNEL_LABEL[ch]}
              </span>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  sub,
  highlight,
}: {
  icon: string;
  label: string;
  value: string;
  sub: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-4 ${
        highlight
          ? "border-[#2D5A3D] bg-gradient-to-br from-[#F5F1E8] to-[#D4E4BC]"
          : "border-[#D4E4BC] bg-white"
      }`}
    >
      <div className="text-xl">{icon}</div>
      <div className="mt-1 text-[10px] font-semibold text-[#6B6560]">
        {label}
      </div>
      <div
        className={`mt-0.5 text-xl font-extrabold ${
          highlight ? "text-[#2D5A3D]" : "text-[#2C2C2C]"
        }`}
      >
        {value}
      </div>
      <div className="mt-0.5 text-[10px] text-[#6B6560]">{sub}</div>
    </div>
  );
}
