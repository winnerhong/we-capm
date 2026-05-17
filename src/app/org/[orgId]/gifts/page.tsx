// 기관 선물함 모아보기 — 발급 현황 통계 + 필터 + 리스트.
// 모든 user_gifts 행을 한 번 불러와 기간/상태/출처/검색을 SSR로 필터링.

import Link from "next/link";
import { requireOrg } from "@/lib/org-auth-guard";
import { loadOrgGifts } from "@/lib/gifts/queries";
import { createClient } from "@/lib/supabase/server";
import {
  GIFT_SOURCE_LABELS,
  GIFT_STATUS_LABELS,
  formatCouponCode,
  isGiftEffectivelyExpired,
  type GiftSourceType,
  type GiftStatus,
  type UserGiftRow,
} from "@/lib/gifts/types";
import { GiftRowActions } from "./gift-row-actions";
import { ExpireOverdueButton } from "./expire-overdue-button";

export const dynamic = "force-dynamic";

const STATUS_TABS: { key: "all" | GiftStatus; label: string; color: string }[] =
  [
    { key: "all", label: "전체", color: "text-[#2D5A3D]" },
    { key: "pending", label: "대기", color: "text-emerald-700" },
    { key: "redeemed", label: "수령완료", color: "text-sky-700" },
    { key: "expired", label: "만료", color: "text-amber-700" },
    { key: "cancelled", label: "취소", color: "text-rose-700" },
  ];

const SOURCE_OPTIONS: { value: "all" | GiftSourceType; label: string }[] = [
  { value: "all", label: "전체 출처" },
  { value: "rps_winner", label: "가위바위보 우승" },
  { value: "manual_grant", label: "관리자 지급" },
  { value: "mission_reward", label: "미션 보상" },
  { value: "event_lottery", label: "행사 추첨" },
];

const SOURCE_BADGE: Record<GiftSourceType, string> = {
  rps_winner: "bg-rose-100 text-rose-800 border-rose-200",
  manual_grant: "bg-violet-100 text-violet-800 border-violet-200",
  mission_reward: "bg-emerald-100 text-emerald-800 border-emerald-200",
  event_lottery: "bg-amber-100 text-amber-800 border-amber-200",
};

const STATUS_BADGE: Record<GiftStatus, string> = {
  pending: "bg-emerald-100 text-emerald-800 border-emerald-200",
  redeemed: "bg-sky-100 text-sky-800 border-sky-200",
  expired: "bg-amber-100 text-amber-800 border-amber-200",
  cancelled: "bg-rose-100 text-rose-800 border-rose-200",
};

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

function fmtDate(iso: string | null): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return `${d.getFullYear()}.${pad2(d.getMonth() + 1)}.${pad2(d.getDate())}`;
}

function fmtDateTime(iso: string | null): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return `${pad2(d.getMonth() + 1)}.${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/** 7일 이내 / 이번 달 / 사용자 지정 단순 분기. */
function withinRange(
  gIso: string,
  range: "all" | "today" | "7d" | "month"
): boolean {
  if (range === "all") return true;
  const t = new Date(gIso).getTime();
  const now = Date.now();
  if (range === "today") {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return t >= start.getTime();
  }
  if (range === "7d") return now - t <= 7 * 24 * 60 * 60 * 1000;
  if (range === "month") {
    const d = new Date();
    const start = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
    return t >= start;
  }
  return true;
}

/* parent_name lookup — display 이름이 비어있는 row 보강용 (소량). */
async function loadParentNames(
  userIds: string[]
): Promise<Map<string, { name: string; phone: string }>> {
  const out = new Map<string, { name: string; phone: string }>();
  if (userIds.length === 0) return out;
  const supabase = await createClient();
  type Row = { id: string; parent_name: string | null; phone: string | null };
  const resp = (await (
    supabase.from("app_users" as never) as unknown as {
      select: (c: string) => {
        in: (k: string, v: string[]) => Promise<{ data: Row[] | null }>;
      };
    }
  )
    .select("id, parent_name, phone")
    .in("id", userIds)) as { data: Row[] | null };

  for (const r of resp.data ?? []) {
    out.set(r.id, {
      name: (r.parent_name ?? "").trim(),
      phone: (r.phone ?? "").trim(),
    });
  }
  return out;
}

type SearchParams = {
  status?: string;
  source?: string;
  range?: string;
  q?: string;
};

export default async function OrgGiftsPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { orgId } = await params;
  await requireOrg();
  const sp = (await searchParams) ?? {};

  const status = ((): "all" | GiftStatus => {
    const s = sp.status ?? "all";
    if (
      s === "pending" ||
      s === "redeemed" ||
      s === "expired" ||
      s === "cancelled"
    )
      return s;
    return "all";
  })();
  const source = ((): "all" | GiftSourceType => {
    const s = sp.source ?? "all";
    if (
      s === "rps_winner" ||
      s === "manual_grant" ||
      s === "mission_reward" ||
      s === "event_lottery"
    )
      return s;
    return "all";
  })();
  const range = ((): "all" | "today" | "7d" | "month" => {
    const s = sp.range ?? "all";
    if (s === "today" || s === "7d" || s === "month") return s;
    return "all";
  })();
  const q = (sp.q ?? "").trim().toLowerCase();

  const all = await loadOrgGifts(orgId);

  // 받는 사람 보강용 — display_name 이 비었을 때만 fallback 으로 사용.
  const userIds = Array.from(new Set(all.map((g) => g.user_id))).filter(Boolean);
  const userMap = await loadParentNames(userIds);

  // 통계는 "전체" 기준 (기간/상태/출처 필터 영향 없음)
  const total = all.length;
  const cnt = {
    pending: 0,
    redeemed: 0,
    expired: 0,
    cancelled: 0,
  };
  const sourceCnt: Record<GiftSourceType, number> = {
    rps_winner: 0,
    manual_grant: 0,
    mission_reward: 0,
    event_lottery: 0,
  };
  let overdueCount = 0;
  for (const g of all) {
    cnt[g.status] += 1;
    sourceCnt[g.source_type] += 1;
    if (isGiftEffectivelyExpired(g)) overdueCount += 1;
  }
  const redeemPct = total > 0 ? Math.round((cnt.redeemed / total) * 100) : 0;

  // 필터 적용
  const filtered = all.filter((g) => {
    if (status !== "all" && g.status !== status) return false;
    if (source !== "all" && g.source_type !== source) return false;
    if (!withinRange(g.granted_at, range)) return false;
    if (q) {
      const u = userMap.get(g.user_id);
      const hay = `${g.display_name} ${g.gift_label} ${g.coupon_code} ${u?.name ?? ""} ${u?.phone ?? ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  // 매뉴얼 발급 페이지 링크는 /org/[orgId]/gifts/grant — 별도 페이지에서 일괄 처리.
  const buildHref = (
    nextStatus: typeof status,
    nextSource: typeof source = source,
    nextRange: typeof range = range
  ): string => {
    const sp = new URLSearchParams();
    if (nextStatus !== "all") sp.set("status", nextStatus);
    if (nextSource !== "all") sp.set("source", nextSource);
    if (nextRange !== "all") sp.set("range", nextRange);
    if (q) sp.set("q", q);
    const qs = sp.toString();
    return qs
      ? `/org/${orgId}/gifts?${qs}`
      : `/org/${orgId}/gifts`;
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6">
      <nav aria-label="breadcrumb" className="text-xs text-[#8B7F75]">
        <Link href={`/org/${orgId}`} className="hover:text-[#2D5A3D]">
          기관 홈
        </Link>
        <span className="mx-2">/</span>
        <span className="font-semibold text-[#2D5A3D]">선물함 모아보기</span>
      </nav>

      <header className="rounded-3xl border border-[#D4E4BC] bg-gradient-to-br from-[#E8F0E4] via-white to-[#FAE7D0] p-5 shadow-sm md:p-7">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="text-3xl" aria-hidden>
              🎁
            </span>
            <div>
              <h1 className="text-xl font-bold text-[#2D5A3D] md:text-2xl">
                선물함 모아보기
              </h1>
              <p className="mt-1 text-xs text-[#6B6560] md:text-sm">
                발급된 모든 선물의 수령 현황을 한 곳에서 확인하고 관리하세요.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/org/${orgId}/gifts/templates`}
              className="inline-flex items-center gap-1 rounded-xl border border-[#E5D3B8] bg-[#FFF8F0] px-3 py-2 text-xs font-bold text-[#8B6F47] hover:bg-[#FAE7D0]"
            >
              🎟️ 쿠폰 만들기
            </Link>
            <Link
              href={`/org/${orgId}/gifts/grant`}
              className="inline-flex items-center gap-1 rounded-xl bg-gradient-to-r from-[#2D5A3D] to-[#3A7A52] px-3 py-2 text-xs font-bold text-white shadow-sm hover:from-[#234a30]"
            >
              🚀 수동 발급
            </Link>
            <Link
              href={`/org/${orgId}/gifts/redeem`}
              className="inline-flex items-center gap-1 rounded-xl border border-[#D4E4BC] bg-white px-3 py-2 text-xs font-bold text-[#2D5A3D] hover:bg-[#F5F1E8]"
            >
              🏪 선물 수령 QR카메라
            </Link>
            <ExpireOverdueButton overdueCount={overdueCount} />
          </div>
        </div>
      </header>

      {/* 통계 */}
      <section className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <StatCard label="총 발급" value={total} icon="🎁" color="text-[#2D5A3D]" />
        <StatCard
          label="대기"
          value={cnt.pending}
          icon="⏳"
          color="text-emerald-700"
          hint={overdueCount > 0 ? `만료 ${overdueCount}건 정리 필요` : undefined}
        />
        <StatCard
          label="수령완료"
          value={cnt.redeemed}
          icon="✅"
          color="text-sky-700"
          hint={`사용률 ${redeemPct}%`}
        />
        <StatCard label="만료" value={cnt.expired} icon="⌛" color="text-amber-700" />
        <StatCard label="취소" value={cnt.cancelled} icon="🚫" color="text-rose-700" />
      </section>

      {/* 출처별 미니 통계 */}
      <section className="rounded-2xl border border-[#D4E4BC] bg-white p-4 shadow-sm">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-[#6B6560]">
          출처별 발급
        </p>
        <ul className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-4">
          {(Object.keys(sourceCnt) as GiftSourceType[]).map((s) => (
            <li
              key={s}
              className="flex items-center justify-between rounded-xl border border-[#F0EBE3] bg-[#FFF8F0] px-3 py-2"
            >
              <span className="text-[11px] font-semibold text-[#6B6560]">
                {GIFT_SOURCE_LABELS[s]}
              </span>
              <span className="text-sm font-bold tabular-nums text-[#2D5A3D]">
                {sourceCnt[s]}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* 필터 바 */}
      <section className="space-y-3 rounded-2xl border border-[#D4E4BC] bg-white p-4 shadow-sm">
        {/* 상태 탭 */}
        <div className="flex flex-wrap gap-1.5">
          {STATUS_TABS.map((tab) => {
            const active = tab.key === status;
            const count =
              tab.key === "all"
                ? total
                : tab.key === "pending"
                  ? cnt.pending
                  : tab.key === "redeemed"
                    ? cnt.redeemed
                    : tab.key === "expired"
                      ? cnt.expired
                      : cnt.cancelled;
            return (
              <Link
                key={tab.key}
                href={buildHref(tab.key)}
                className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                  active
                    ? "border-[#2D5A3D] bg-[#2D5A3D] text-white"
                    : "border-[#D4E4BC] bg-white text-[#6B6560] hover:border-[#2D5A3D] hover:text-[#2D5A3D]"
                }`}
              >
                <span>{tab.label}</span>
                <span className="tabular-nums">{count}</span>
              </Link>
            );
          })}
        </div>

        {/* 출처 + 기간 + 검색 */}
        <form method="get" className="flex flex-wrap items-end gap-2">
          {status !== "all" && (
            <input type="hidden" name="status" value={status} />
          )}
          <label className="flex flex-col gap-0.5 text-[11px] font-semibold text-[#6B6560]">
            출처
            <select
              name="source"
              defaultValue={source}
              className="rounded-lg border border-[#D4E4BC] bg-white px-2.5 py-1.5 text-xs"
            >
              {SOURCE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-0.5 text-[11px] font-semibold text-[#6B6560]">
            기간
            <select
              name="range"
              defaultValue={range}
              className="rounded-lg border border-[#D4E4BC] bg-white px-2.5 py-1.5 text-xs"
            >
              <option value="all">전체</option>
              <option value="today">오늘</option>
              <option value="7d">7일</option>
              <option value="month">이번 달</option>
            </select>
          </label>
          <label className="flex flex-1 min-w-[180px] flex-col gap-0.5 text-[11px] font-semibold text-[#6B6560]">
            검색 (이름·연락처·쿠폰코드)
            <input
              type="search"
              name="q"
              defaultValue={q}
              placeholder="홍유준 / 1234 / KMA2"
              className="rounded-lg border border-[#D4E4BC] bg-white px-2.5 py-1.5 text-xs"
            />
          </label>
          <button
            type="submit"
            className="rounded-lg bg-[#2D5A3D] px-3 py-2 text-xs font-bold text-white hover:bg-[#234a30]"
          >
            적용
          </button>
        </form>
      </section>

      {/* 리스트 */}
      <section className="overflow-hidden rounded-2xl border border-[#D4E4BC] bg-white shadow-sm">
        {filtered.length === 0 ? (
          <div className="px-4 py-16 text-center">
            <p className="text-3xl" aria-hidden>
              🌱
            </p>
            <p className="mt-2 text-sm font-semibold text-[#2D5A3D]">
              조건에 맞는 선물이 없어요
            </p>
            <p className="mt-1 text-[11px] text-[#6B6560]">
              필터를 바꾸거나 수동 발급으로 시작해 보세요
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-[#F0EBE3]">
            {filtered.map((g) => (
              <GiftItem
                key={g.id}
                gift={g}
                userMap={userMap}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

/* ─────────────────────────── Sub components ─────────────────────────── */

function StatCard({
  label,
  value,
  icon,
  color,
  hint,
}: {
  label: string;
  value: number;
  icon: string;
  color: string;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-[#D4E4BC] bg-white p-4 shadow-sm">
      <p className="flex items-center gap-1 text-[11px] font-semibold text-[#6B6560]">
        <span aria-hidden>{icon}</span>
        <span>{label}</span>
      </p>
      <p className={`mt-1 text-2xl font-extrabold tabular-nums ${color}`}>
        {value}
      </p>
      {hint && (
        <p className="mt-0.5 text-[10px] font-semibold text-[#8B7F75]">
          {hint}
        </p>
      )}
    </div>
  );
}

function GiftItem({
  gift,
  userMap,
}: {
  gift: UserGiftRow;
  userMap: Map<string, { name: string; phone: string }>;
}) {
  const u = userMap.get(gift.user_id);
  const recipientName = gift.display_name?.trim() || u?.name || "참가자";
  const phoneTail = u?.phone ? u.phone.slice(-4) : "";
  const overdue = isGiftEffectivelyExpired(gift);

  return (
    <li className="grid grid-cols-1 gap-2 px-4 py-3 md:grid-cols-[1.4fr_1.4fr_1fr_1fr_auto] md:items-center">
      {/* 받는 사람 */}
      <div className="min-w-0">
        <p className="truncate text-sm font-bold text-[#2D5A3D]">
          {recipientName}
        </p>
        {phoneTail && (
          <p className="text-[11px] text-[#8B7F75]">010-…-{phoneTail}</p>
        )}
      </div>

      {/* 선물명 + 출처 */}
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-[#3D3A36]">
          {gift.gift_label}
        </p>
        <span
          className={`mt-0.5 inline-block rounded-full border px-2 py-0.5 text-[10px] font-bold ${SOURCE_BADGE[gift.source_type]}`}
        >
          {GIFT_SOURCE_LABELS[gift.source_type]}
        </span>
      </div>

      {/* 상태 */}
      <div>
        <span
          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-bold ${STATUS_BADGE[gift.status]}`}
        >
          {GIFT_STATUS_LABELS[gift.status]}
        </span>
        {overdue && (
          <span className="ml-1 inline-block rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">
            만료 임박
          </span>
        )}
      </div>

      {/* 일자 */}
      <div className="text-[11px] text-[#6B6560]">
        <p>발급 {fmtDate(gift.granted_at)}</p>
        {gift.expires_at && (
          <p>만료 {fmtDate(gift.expires_at)}</p>
        )}
        {gift.redeemed_at && (
          <p className="text-sky-700">
            수령 {fmtDateTime(gift.redeemed_at)}
          </p>
        )}
      </div>

      {/* 액션 + 쿠폰 코드 */}
      <div className="flex flex-col items-end gap-1">
        <code className="rounded-md bg-[#F5F1E8] px-2 py-0.5 font-mono text-[11px] font-bold tracking-wider text-[#2D5A3D]">
          {formatCouponCode(gift.coupon_code)}
        </code>
        <GiftRowActions giftId={gift.id} status={gift.status} />
      </div>
    </li>
  );
}
