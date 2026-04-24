// 관리자 대시보드용 "등록된 숲지기" 테이블 섹션.
// /admin/partners 페이지와 동일한 UX 를 최근 10명 한정으로 축약 노출.

import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { countPendingDocumentsByPartner } from "@/lib/documents/queries";
import { loadPartnerProfileSnapshot } from "@/lib/profile-completeness/queries";
import { calcCompleteness } from "@/lib/profile-completeness/calculator";
import { PARTNER_PROFILE_SCHEMA } from "@/lib/profile-completeness/schemas/partner";
import { PartnerRowActions } from "./partners/partner-row-actions";
import { AcornIcon } from "@/components/acorn-icon";

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

const TIER_LABEL: Record<
  PartnerTier,
  { emoji: string; label: string; color: string }
> = {
  SPROUT: { emoji: "🌱", label: "새싹", color: "bg-[#E8F0E4] text-[#2D5A3D]" },
  EXPLORER: {
    emoji: "🌿",
    label: "탐험가",
    color: "bg-[#D4E4BC] text-[#2D5A3D]",
  },
  TREE: { emoji: "🌳", label: "나무", color: "bg-[#A8C686] text-white" },
  FOREST: { emoji: "🏞️", label: "숲", color: "bg-[#2D5A3D] text-white" },
  LEGEND: {
    emoji: "🌟",
    label: "레전드",
    color: "bg-gradient-to-r from-[#B8860B] to-[#FFD700] text-white",
  },
};

const STATUS_LABEL: Record<
  PartnerStatus,
  { dot: string; label: string; text: string }
> = {
  PENDING: { dot: "bg-gray-400", label: "대기중", text: "text-gray-600" },
  ACTIVE: { dot: "bg-green-500", label: "활성", text: "text-green-700" },
  SUSPENDED: {
    dot: "bg-yellow-500",
    label: "정지",
    text: "text-yellow-700",
  },
  CLOSED: { dot: "bg-red-500", label: "폐업", text: "text-red-700" },
};

function fmtNumber(n: number) {
  return n.toLocaleString("ko-KR");
}
function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("ko-KR", {
      year: "2-digit",
      month: "2-digit",
      day: "2-digit",
    });
  } catch {
    return iso;
  }
}

const DASHBOARD_LIMIT = 10;

export async function DashboardPartnersSection() {
  const supabase = await createClient();

  let partners: PartnerRow[] = [];
  let total = 0;
  let tableMissing = false;

  try {
    const [listResp, countResp] = await Promise.all([
      (supabase as unknown as {
        from: (t: string) => {
          select: (cols: string) => {
            order: (
              col: string,
              opts: { ascending: boolean }
            ) => {
              limit: (n: number) => Promise<{
                data: PartnerRow[] | null;
                error: { code?: string; message: string } | null;
              }>;
            };
          };
        };
      })
        .from("partners")
        .select(
          "id, name, business_name, username, email, phone, tier, commission_rate, acorn_balance, total_sales, total_events, avg_rating, status, created_at"
        )
        .order("created_at", { ascending: false })
        .limit(DASHBOARD_LIMIT),
      (supabase as unknown as {
        from: (t: string) => {
          select: (
            c: string,
            o: { count: "exact"; head: true }
          ) => Promise<{
            count: number | null;
            error: { code?: string; message: string } | null;
          }>;
        };
      })
        .from("partners")
        .select("id", { count: "exact", head: true }),
    ]);

    if (listResp.error) {
      if (
        listResp.error.code === "42P01" ||
        /relation .* does not exist/i.test(listResp.error.message)
      ) {
        tableMissing = true;
      }
    } else {
      partners = listResp.data ?? [];
    }
    total = countResp.count ?? partners.length;
  } catch {
    tableMissing = true;
  }

  // 완성도 + 서류 PENDING (병렬)
  const completenessMap = new Map<string, number>();
  let docPendingMap: Map<string, number> = new Map();
  if (!tableMissing && partners.length > 0) {
    const [compResults, docMap] = await Promise.all([
      Promise.all(
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
      ),
      countPendingDocumentsByPartner().catch(() => new Map<string, number>()),
    ]);
    for (const r of compResults) completenessMap.set(r.id, r.percent);
    docPendingMap = docMap;
  }

  return (
    <section>
      <div className="mb-2 flex items-center justify-between px-1">
        <h2 className="text-sm font-bold text-[#2D5A3D]">🌲 등록된 숲지기</h2>
        <Link
          href="/admin/partners"
          className="text-xs font-semibold text-[#3A7A52] hover:text-[#2D5A3D] hover:underline"
        >
          전체 관리 →
        </Link>
      </div>

      {tableMissing ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
          ⚠️ partners 테이블이 아직 준비되지 않았어요. DB 마이그레이션을
          실행해 주세요.
        </div>
      ) : partners.length === 0 ? (
        <div className="rounded-2xl border border-[#D4E4BC] bg-white p-8 text-center">
          <span className="text-5xl">🌳</span>
          <p className="mt-3 text-sm font-semibold text-[#2D5A3D]">
            아직 등록된 숲지기가 없어요
          </p>
          <Link
            href="/admin/partners/new"
            className="mt-4 inline-block rounded-xl bg-[#2D5A3D] px-4 py-2 text-sm font-semibold text-white hover:bg-[#3A7A52]"
          >
            + 새 숲지기 등록
          </Link>
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
                  className="rounded-2xl border border-[#D4E4BC] bg-white p-3 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${t.color}`}
                        >
                          {t.emoji} {t.label}
                        </span>
                        <span
                          className={`flex items-center gap-1 text-[11px] font-semibold ${s.text}`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${s.dot}`}
                          />
                          {s.label}
                        </span>
                      </div>
                      <Link
                        href={`/admin/partners/${p.id}`}
                        className="mt-1 block truncate font-bold text-[#2C2C2C] hover:text-[#2D5A3D]"
                      >
                        {p.name}
                      </Link>
                      {p.business_name && (
                        <div className="truncate text-[11px] text-[#6B6560]">
                          {p.business_name}
                        </div>
                      )}
                      <div className="text-[11px] text-[#8B6F47]">
                        @{p.username}
                      </div>
                    </div>
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-1.5 text-center">
                    <div className="rounded-lg bg-[#FFF8F0] p-1.5">
                      <div className="text-[9px] text-[#8B6F47]">매출</div>
                      <div className="text-[11px] font-bold text-[#2D5A3D]">
                        {fmtNumber(p.total_sales ?? 0)}
                      </div>
                    </div>
                    <div className="rounded-lg bg-[#FFF8F0] p-1.5">
                      <div className="text-[9px] text-[#8B6F47]">도토리</div>
                      <div className="text-[11px] font-bold text-[#2D5A3D]">
                        <AcornIcon /> {fmtNumber(p.acorn_balance ?? 0)}
                      </div>
                    </div>
                    <div className="rounded-lg bg-[#FFF8F0] p-1.5">
                      <div className="text-[9px] text-[#8B6F47]">커미션</div>
                      <div className="text-[11px] font-bold text-[#2D5A3D]">
                        {p.commission_rate}%
                      </div>
                    </div>
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
                  <th className="px-3 py-2.5 font-semibold">숲지기</th>
                  <th className="px-3 py-2.5 font-semibold">등급</th>
                  <th className="px-3 py-2.5 font-semibold">상태</th>
                  <th className="px-3 py-2.5 font-semibold">🌱 완성도</th>
                  <th className="px-3 py-2.5 text-right font-semibold">
                    총매출
                  </th>
                  <th className="px-3 py-2.5 text-right font-semibold">
                    도토리
                  </th>
                  <th className="px-3 py-2.5 text-right font-semibold">
                    커미션
                  </th>
                  <th className="px-3 py-2.5 font-semibold">📄 서류</th>
                  <th className="px-3 py-2.5 font-semibold">가입일</th>
                  <th className="px-3 py-2.5 font-semibold">작업</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8F0E4]">
                {partners.map((p) => {
                  const t = TIER_LABEL[p.tier];
                  const s = STATUS_LABEL[p.status];
                  const percent = completenessMap.get(p.id) ?? 0;
                  const pendingDocs = docPendingMap.get(p.id) ?? 0;
                  return (
                    <tr key={p.id} className="hover:bg-[#FFF8F0]/40">
                      <td className="px-3 py-2.5">
                        <Link
                          href={`/admin/partners/${p.id}`}
                          className="font-semibold text-[#2C2C2C] hover:text-[#2D5A3D] hover:underline"
                        >
                          {p.name}
                        </Link>
                        {p.business_name && (
                          <div className="text-[11px] text-[#6B6560]">
                            {p.business_name}
                          </div>
                        )}
                        <div className="text-[10px] text-[#8B6F47]">
                          @{p.username}
                          {p.phone ? ` · ${p.phone}` : ""}
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <span
                          className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-semibold ${t.color}`}
                        >
                          {t.emoji} {t.label}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <span
                          className={`flex items-center gap-1.5 text-[11px] font-semibold ${s.text}`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${s.dot}`}
                          />
                          {s.label}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <span
                          className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                            percent >= 80
                              ? "bg-emerald-50 text-emerald-700"
                              : percent >= 50
                                ? "bg-amber-50 text-amber-700"
                                : "bg-rose-50 text-rose-700"
                          }`}
                        >
                          🌱 {percent}%
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-right font-semibold text-[#2D5A3D]">
                        {fmtNumber(p.total_sales ?? 0)}원
                      </td>
                      <td className="px-3 py-2.5 text-right text-[#2D5A3D]">
                        <AcornIcon /> {fmtNumber(p.acorn_balance ?? 0)}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        {p.commission_rate}%
                      </td>
                      <td className="px-3 py-2.5">
                        {pendingDocs > 0 ? (
                          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                            📋 검토중 {pendingDocs}건
                          </span>
                        ) : (
                          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                            ✅ 승인완료
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-[11px] text-[#6B6560]">
                        {fmtDate(p.created_at)}
                      </td>
                      <td className="px-3 py-2.5">
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

          {total > partners.length && (
            <div className="mt-2 text-right text-[11px] text-[#8B6F47]">
              최근 {partners.length}곳 표시 · 전체 {total}곳{" "}
              <Link
                href="/admin/partners"
                className="font-semibold text-[#3A7A52] hover:underline"
              >
                전체 관리 →
              </Link>
            </div>
          )}
        </>
      )}
    </section>
  );
}
