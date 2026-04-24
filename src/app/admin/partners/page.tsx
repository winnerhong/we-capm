import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { countPendingDocumentsByPartner } from "@/lib/documents/queries";
import { loadPartnerProfileSnapshot } from "@/lib/profile-completeness/queries";
import { calcCompleteness } from "@/lib/profile-completeness/calculator";
import { PARTNER_PROFILE_SCHEMA } from "@/lib/profile-completeness/schemas/partner";
import { PartnerRowActions } from "./partner-row-actions";
import { AcornIcon } from "@/components/acorn-icon";

export const dynamic = "force-dynamic";

type PartnerTier = "SPROUT" | "EXPLORER" | "TREE" | "FOREST" | "LEGEND";
type PartnerStatus = "PENDING" | "ACTIVE" | "SUSPENDED" | "CLOSED";

type PartnerRow = {
  id: string;
  name: string;
  business_name: string | null;
  username: string;
  email: string | null;
  phone: string | null;
  tier: PartnerTier;
  commission_rate: number;
  acorn_balance: number;
  total_sales: number;
  total_events: number;
  avg_rating: number | null;
  status: PartnerStatus;
  created_at: string;
};

const TIER_LABEL: Record<PartnerTier, { emoji: string; label: string; color: string }> = {
  SPROUT:   { emoji: "🌱", label: "새싹",   color: "bg-[#E8F0E4] text-[#2D5A3D]" },
  EXPLORER: { emoji: "🌿", label: "탐험가", color: "bg-[#D4E4BC] text-[#2D5A3D]" },
  TREE:     { emoji: "🌳", label: "나무",   color: "bg-[#A8C686] text-white" },
  FOREST:   { emoji: "🏞️", label: "숲",     color: "bg-[#2D5A3D] text-white" },
  LEGEND:   { emoji: "🌟", label: "레전드", color: "bg-gradient-to-r from-[#B8860B] to-[#FFD700] text-white" },
};

const STATUS_LABEL: Record<PartnerStatus, { dot: string; label: string; text: string }> = {
  PENDING:   { dot: "bg-gray-400",   label: "대기중", text: "text-gray-600" },
  ACTIVE:    { dot: "bg-green-500",  label: "활성",   text: "text-green-700" },
  SUSPENDED: { dot: "bg-yellow-500", label: "정지",   text: "text-yellow-700" },
  CLOSED:    { dot: "bg-red-500",    label: "폐업",   text: "text-red-700" },
};

function fmtNumber(n: number) {
  return n.toLocaleString("ko-KR");
}

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("ko-KR", { year: "2-digit", month: "2-digit", day: "2-digit" });
  } catch {
    return iso;
  }
}

export default async function AdminPartnersPage() {
  const supabase = await createClient();

  let partners: PartnerRow[] = [];
  let tableMissing = false;

  try {
    const { data, error } = await (supabase as unknown as {
      from: (t: string) => {
        select: (cols: string) => { order: (col: string, opts: { ascending: boolean }) => Promise<{ data: PartnerRow[] | null; error: { message: string; code?: string } | null }> };
      };
    })
      .from("partners")
      .select("id, name, business_name, username, email, phone, tier, commission_rate, acorn_balance, total_sales, total_events, avg_rating, status, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      // 42P01: undefined_table in Postgres
      if (error.code === "42P01" || /relation .* does not exist/i.test(error.message)) {
        tableMissing = true;
      } else {
        throw new Error(error.message);
      }
    } else {
      partners = data ?? [];
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/relation .* does not exist|partners/i.test(msg)) {
      tableMissing = true;
    } else {
      tableMissing = true; // 안전하게 빈 상태로 렌더
    }
  }

  // 파트너별 서류 PENDING 개수 맵 (테이블 미존재 시 빈 맵)
  let docPendingMap: Map<string, number> = new Map();
  if (!tableMissing) {
    try {
      docPendingMap = await countPendingDocumentsByPartner();
    } catch {
      docPendingMap = new Map();
    }
  }

  // 파트너별 프로필 완성도 % (병렬 로드)
  const completenessMap = new Map<string, number>();
  if (!tableMissing && partners.length > 0) {
    const results = await Promise.all(
      partners.map(async (p) => {
        try {
          const snap = await loadPartnerProfileSnapshot(p.id);
          return {
            id: p.id,
            percent: calcCompleteness(PARTNER_PROFILE_SCHEMA, snap).percent,
          };
        } catch {
          return { id: p.id, percent: 0 };
        }
      })
    );
    for (const r of results) completenessMap.set(r.id, r.percent);
  }

  const totalCount = partners.length;
  const activeCount = partners.filter((p) => p.status === "ACTIVE").length;
  const pendingCount = partners.filter((p) => p.status === "PENDING").length;
  const totalSales = partners.reduce((acc, p) => acc + (p.total_sales ?? 0), 0);
  const avgCommission = totalCount
    ? partners.reduce((acc, p) => acc + (p.commission_rate ?? 0), 0) / totalCount
    : 0;

  // 온보딩 지표
  const onboardingStats = (() => {
    if (partners.length === 0) {
      return { avg: 0, under50: 0, complete: 0 };
    }
    const values = partners.map((p) => completenessMap.get(p.id) ?? 0);
    const sum = values.reduce((a, b) => a + b, 0);
    return {
      avg: Math.round(sum / values.length),
      under50: values.filter((v) => v < 50).length,
      complete: values.filter((v) => v >= 100).length,
    };
  })();

  return (
    <div className="space-y-6">
      {/* 상단 네비 */}
      <div className="flex items-center justify-between">
        <Link href="/admin" className="text-sm font-medium text-[#2D5A3D] hover:underline">
          ← 대시보드
        </Link>
        {tableMissing && (
          <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-700">
            DB 테이블 미존재
          </span>
        )}
      </div>

      {/* 헤더 */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-extrabold text-[#2D5A3D]">
            <span>🏢</span>
            <span>숲지기 관리</span>
          </h1>
          <p className="mt-1 text-sm text-[#6B6560]">
            파트너 업체(토리로의 숲지기)를 관리하세요
          </p>
        </div>
        <Link
          href="/admin/partners/new"
          className="whitespace-nowrap rounded-xl bg-[#2D5A3D] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#3A7A52]"
        >
          + 새 숲지기 등록
        </Link>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded-2xl border border-[#D4E4BC] bg-white p-4">
          <div className="text-xs font-medium text-[#8B6F47]">총 파트너</div>
          <div className="mt-1 text-2xl font-bold text-[#2D5A3D]">
            {fmtNumber(totalCount)}
            <span className="ml-1 text-sm font-medium">곳</span>
          </div>
          {pendingCount > 0 && (
            <div className="mt-1 text-[11px] text-[#8B6F47]">대기 {pendingCount}</div>
          )}
        </div>
        <div className="rounded-2xl border border-[#D4E4BC] bg-white p-4">
          <div className="text-xs font-medium text-[#8B6F47]">활성</div>
          <div className="mt-1 text-2xl font-bold text-[#2D5A3D]">
            {fmtNumber(activeCount)}
            <span className="ml-1 text-sm font-medium">곳</span>
          </div>
        </div>
        <div className="rounded-2xl border border-[#D4E4BC] bg-white p-4">
          <div className="text-xs font-medium text-[#8B6F47]">누적 매출</div>
          <div className="mt-1 text-2xl font-bold text-[#2D5A3D]">
            {fmtNumber(totalSales)}
            <span className="ml-1 text-sm font-medium">원</span>
          </div>
        </div>
        <div className="rounded-2xl border border-[#D4E4BC] bg-white p-4">
          <div className="text-xs font-medium text-[#8B6F47]">평균 커미션</div>
          <div className="mt-1 text-2xl font-bold text-[#2D5A3D]">
            {avgCommission.toFixed(1)}
            <span className="ml-1 text-sm font-medium">%</span>
          </div>
        </div>
      </div>

      {/* 🌱 온보딩 현황 위젯 */}
      {!tableMissing && partners.length > 0 && (
        <section className="rounded-2xl border border-[#D4E4BC] bg-gradient-to-br from-[#E8F0E4] via-white to-[#FFF8F0] p-4 md:p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="flex items-center gap-1.5 text-sm font-bold text-[#2D5A3D]">
                <span>🌱</span>
                <span>지사 온보딩 현황</span>
              </h3>
              <p className="mt-0.5 text-[11px] text-[#6B6560]">
                프로필 완성도가 낮은 지사는 운영에 문제가 생길 수 있어요.
              </p>
            </div>
            <span className="rounded-full bg-white/60 px-2 py-0.5 text-[10px] font-semibold text-[#2D5A3D]">
              지사 {totalCount}곳 기준
            </span>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <div className="rounded-xl border border-[#D4E4BC] bg-white p-3">
              <div className="text-[10px] font-semibold text-[#6B6560]">평균 완성도</div>
              <div className="mt-0.5 text-2xl font-bold text-[#2D5A3D]">
                {onboardingStats.avg}%
              </div>
            </div>
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-3">
              <div className="text-[10px] font-semibold text-rose-700">50% 미만</div>
              <div className="mt-0.5 text-2xl font-bold text-rose-800">
                {onboardingStats.under50}
                <span className="ml-0.5 text-xs font-semibold">곳</span>
              </div>
            </div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
              <div className="text-[10px] font-semibold text-emerald-700">완료(100%)</div>
              <div className="mt-0.5 text-2xl font-bold text-emerald-800">
                {onboardingStats.complete}
                <span className="ml-0.5 text-xs font-semibold">곳</span>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* 리스트 */}
      <section>
        <h2 className="mb-2 text-sm font-bold text-[#2D5A3D]">🌲 등록된 숲지기</h2>

        {tableMissing ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
            <div className="font-semibold">⚠️ partners 테이블이 아직 준비되지 않았어요.</div>
            <p className="mt-1 text-xs">
              DB 마이그레이션을 먼저 실행해 주세요. 마이그레이션이 끝나면 이 화면이 자동으로 동작합니다.
            </p>
          </div>
        ) : partners.length === 0 ? (
          <div className="rounded-2xl border border-[#D4E4BC] bg-white p-5">
            <div className="py-16 text-center">
              <span className="text-5xl">🌳</span>
              <p className="mt-3 text-sm font-semibold text-[#2D5A3D]">
                아직 등록된 숲지기가 없어요
              </p>
              <p className="mt-1 text-xs text-[#6B6560]">
                첫 파트너 업체를 등록하고 숲을 풍성하게 만들어보세요
              </p>
              <Link
                href="/admin/partners/new"
                className="mt-4 inline-block rounded-xl bg-[#2D5A3D] px-4 py-2 text-sm font-semibold text-white hover:bg-[#3A7A52]"
              >
                + 새 숲지기 등록
              </Link>
            </div>
          </div>
        ) : (
          <>
            {/* 모바일: 카드 */}
            <div className="space-y-2 md:hidden">
              {partners.map((p) => {
                const t = TIER_LABEL[p.tier];
                const s = STATUS_LABEL[p.status];
                return (
                  <div
                    key={p.id}
                    className="rounded-2xl border border-[#D4E4BC] bg-white p-4 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${t.color}`}>
                            {t.emoji} {t.label}
                          </span>
                          <span className={`flex items-center gap-1 text-[11px] font-semibold ${s.text}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
                            {s.label}
                          </span>
                        </div>
                        <Link
                          href={`/admin/partners/${p.id}`}
                          className="mt-1 block truncate font-bold text-[#2C2C2C] hover:text-[#2D5A3D] hover:underline"
                        >
                          {p.name}
                        </Link>
                        {p.business_name && (
                          <div className="truncate text-xs text-[#6B6560]">{p.business_name}</div>
                        )}
                        <div className="mt-1 text-[11px] text-[#8B6F47]">
                          @{p.username} · {p.phone ?? "연락처 미등록"}
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                      <div className="rounded-lg bg-[#FFF8F0] p-2">
                        <div className="text-[10px] text-[#8B6F47]">매출</div>
                        <div className="text-xs font-bold text-[#2D5A3D]">
                          {fmtNumber(p.total_sales ?? 0)}
                        </div>
                      </div>
                      <div className="rounded-lg bg-[#FFF8F0] p-2">
                        <div className="text-[10px] text-[#8B6F47]">도토리</div>
                        <div className="text-xs font-bold text-[#2D5A3D]">
                          <AcornIcon /> {fmtNumber(p.acorn_balance ?? 0)}
                        </div>
                      </div>
                      <div className="rounded-lg bg-[#FFF8F0] p-2">
                        <div className="text-[10px] text-[#8B6F47]">커미션</div>
                        <div className="text-xs font-bold text-[#2D5A3D]">
                          {p.commission_rate}%
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      <CompletenessMini
                        percent={completenessMap.get(p.id) ?? 0}
                        partnerId={p.id}
                      />
                      <DocStatusBadge
                        partnerId={p.id}
                        pending={docPendingMap.get(p.id) ?? 0}
                      />
                    </div>
                    <div className="mt-2">
                      <PartnerRowActions
                        id={p.id}
                        status={p.status}
                        tier={p.tier}
                        name={p.name}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 데스크톱: 테이블 */}
            <div className="hidden overflow-x-auto rounded-2xl border border-[#D4E4BC] bg-white md:block">
              <table className="w-full text-sm">
                <thead className="bg-[#F5E6D3]/40 text-left text-xs text-[#8B6F47]">
                  <tr>
                    <th className="px-4 py-3 font-semibold">숲지기</th>
                    <th className="px-4 py-3 font-semibold">등급</th>
                    <th className="px-4 py-3 font-semibold">상태</th>
                    <th className="px-4 py-3 font-semibold">🌱 완성도</th>
                    <th className="px-4 py-3 text-right font-semibold">총매출</th>
                    <th className="px-4 py-3 text-right font-semibold">도토리</th>
                    <th className="px-4 py-3 text-right font-semibold">커미션</th>
                    <th className="px-4 py-3 font-semibold">📄 서류</th>
                    <th className="px-4 py-3 font-semibold">가입일</th>
                    <th className="px-4 py-3 font-semibold">작업</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E8F0E4]">
                  {partners.map((p) => {
                    const t = TIER_LABEL[p.tier];
                    const s = STATUS_LABEL[p.status];
                    return (
                      <tr key={p.id} className="hover:bg-[#FFF8F0]/40">
                        <td className="px-4 py-3">
                          <Link
                            href={`/admin/partners/${p.id}`}
                            className="font-semibold text-[#2C2C2C] hover:text-[#2D5A3D] hover:underline"
                          >
                            {p.name}
                          </Link>
                          {p.business_name && (
                            <div className="text-xs text-[#6B6560]">{p.business_name}</div>
                          )}
                          <div className="text-[11px] text-[#8B6F47]">
                            @{p.username}
                            {p.phone ? ` · ${p.phone}` : ""}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${t.color}`}>
                            {t.emoji} {t.label}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`flex items-center gap-1.5 text-xs font-semibold ${s.text}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
                            {s.label}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <CompletenessMini
                            percent={completenessMap.get(p.id) ?? 0}
                            partnerId={p.id}
                          />
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-[#2D5A3D]">
                          {fmtNumber(p.total_sales ?? 0)}원
                        </td>
                        <td className="px-4 py-3 text-right text-[#2D5A3D]">
                          <AcornIcon /> {fmtNumber(p.acorn_balance ?? 0)}
                        </td>
                        <td className="px-4 py-3 text-right">{p.commission_rate}%</td>
                        <td className="px-4 py-3">
                          <DocStatusBadge
                            partnerId={p.id}
                            pending={docPendingMap.get(p.id) ?? 0}
                          />
                        </td>
                        <td className="px-4 py-3 text-xs text-[#6B6560]">
                          {fmtDate(p.created_at)}
                        </td>
                        <td className="px-4 py-3">
                          <PartnerRowActions
                            id={p.id}
                            status={p.status}
                            tier={p.tier}
                            name={p.name}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      {/* 수익원 설명 */}
      <section className="rounded-2xl border border-[#E5D3B8] bg-gradient-to-br from-[#FFF8F0] to-[#F5E6D3] p-5">
        <h3 className="flex items-center gap-1.5 text-sm font-bold text-[#6B4423]">
          <span>💡</span>
          <span>숲지기 수익 모델</span>
        </h3>
        <p className="mt-2 text-xs leading-relaxed text-[#8B6F47]">
          14가지 수익원 중 숲지기 관련 수익은 <b>크레딧 판매(도토리)</b>, <b>구독 서비스</b>, <b>B2B 행사 주최</b>, <b>마켓 수수료</b>입니다.
          숲지기는 도토리 크레딧을 충전해 행사 참가자 리워드·홍보·배너 광고를 집행하며, 월 구독으로 고정 트래픽을 확보할 수 있어요.
        </p>
      </section>
    </div>
  );
}

function CompletenessMini({
  partnerId,
  percent,
}: {
  partnerId: string;
  percent: number;
}) {
  let tone = "border-rose-200 bg-rose-50 text-rose-700";
  let icon = "🌱";
  if (percent >= 100) {
    tone = "border-emerald-300 bg-emerald-50 text-emerald-800";
    icon = "🎉";
  } else if (percent >= 80) {
    tone = "border-emerald-200 bg-emerald-50 text-emerald-700";
    icon = "🌳";
  } else if (percent >= 50) {
    tone = "border-amber-200 bg-amber-50 text-amber-700";
    icon = "🌿";
  }
  return (
    <Link
      href={`/admin/partners/${partnerId}`}
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-semibold hover:opacity-80 ${tone}`}
      title={`프로필 완성도 ${percent}%`}
    >
      <span aria-hidden>{icon}</span>
      <span>{percent}%</span>
    </Link>
  );
}

function DocStatusBadge({
  partnerId,
  pending,
}: {
  partnerId: string;
  pending: number;
}) {
  if (pending > 0) {
    return (
      <Link
        href={`/admin/partners/${partnerId}/documents`}
        className="inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800 hover:bg-amber-100"
      >
        ⏳ 검토중 {pending}건
      </Link>
    );
  }
  return (
    <Link
      href={`/admin/partners/${partnerId}/documents`}
      className="inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-800 hover:bg-emerald-100"
    >
      ✅ 승인완료
    </Link>
  );
}
