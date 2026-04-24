import Link from "next/link";
import { requirePartner } from "@/lib/auth-guard";
import { createClient } from "@/lib/supabase/server";
import {
  ORG_STATUS_META,
  ORG_STATUS_OPTIONS,
  ORG_TYPE_META,
  ORG_TYPE_OPTIONS,
  daysUntil,
  formatDate,
  formatPhone,
  type OrgRow,
} from "./meta";
import type { OrgStatus, OrgType } from "./actions";
import { regenerateAllOrgAccountsAction } from "./actions";
import { OrgRowActions } from "./org-row-actions";

export const dynamic = "force-dynamic";

const COLUMNS =
  "id,partner_id,org_name,org_type,org_phone,representative_name,representative_phone,email,address,children_count,class_count,teacher_count,business_number,tax_email,commission_rate,discount_rate,contract_start,contract_end,tags,internal_memo,auto_username,status,created_at";

async function loadOrgs(partnerId: string): Promise<OrgRow[]> {
  const supabase = await createClient();

  type QueryResult = Promise<{ data: OrgRow[] | null; error: unknown }>;
  const sb = supabase as unknown as {
    from: (t: string) => {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          order: (c: string, o: { ascending: boolean }) => QueryResult;
        };
      };
    };
  };

  try {
    const { data, error } = await sb
      .from("partner_orgs")
      .select(COLUMNS)
      .eq("partner_id", partnerId)
      .order("created_at", { ascending: false });

    if (error) {
      const e = error as { message?: string; hint?: string; code?: string };
      console.error(
        "[partner/customers/org] load error",
        JSON.stringify({ message: e.message, hint: e.hint, code: e.code })
      );
      return [];
    }
    return data ?? [];
  } catch (e) {
    console.error("[partner/customers/org] load throw", e);
    return [];
  }
}

type SearchParams = {
  q?: string;
  type?: string;
  status?: string;
  tag?: string;
  regen?: string;
  success?: string;
  failed?: string;
  skipped?: string;
};

export default async function OrgListPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const partner = await requirePartner();
  const sp = await searchParams;
  const all = await loadOrgs(partner.id);

  // Filter in memory (simple approach, partner has limited orgs)
  const q = (sp.q ?? "").trim().toLowerCase();
  const typeFilter = (sp.type ?? "").trim();
  const statusFilter = (sp.status ?? "").trim();
  const tagFilter = (sp.tag ?? "").trim().toLowerCase();

  const filtered = all.filter((o) => {
    if (q && !o.org_name.toLowerCase().includes(q)) return false;
    if (typeFilter && o.org_type !== typeFilter) return false;
    if (statusFilter && o.status !== statusFilter) return false;
    if (
      tagFilter &&
      !(o.tags ?? []).some((t) => t.toLowerCase().includes(tagFilter))
    )
      return false;
    return true;
  });

  // Stats (based on all, not filtered)
  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const total = all.length;
  const activeCount = all.filter((o) => o.status === "ACTIVE").length;
  const expiringSoon = all.filter((o) => {
    const d = daysUntil(o.contract_end);
    return d !== null && d >= 0 && d <= 30 && o.status === "ACTIVE";
  }).length;
  const newThisMonth = all.filter(
    (o) => new Date(o.created_at).getTime() >= thisMonthStart.getTime()
  ).length;

  // All unique tags
  const allTags = Array.from(
    new Set(all.flatMap((o) => o.tags ?? []))
  ).slice(0, 20);

  const STATS = [
    {
      icon: "🏫",
      label: "전체",
      value: total,
      tone: "border-[#D4E4BC] bg-white text-[#2D5A3D]",
    },
    {
      icon: "🌿",
      label: "활성",
      value: activeCount,
      tone: "border-emerald-200 bg-emerald-50 text-emerald-900",
    },
    {
      icon: "⏰",
      label: "계약만료 임박",
      value: expiringSoon,
      tone: "border-amber-200 bg-amber-50 text-amber-900",
    },
    {
      icon: "✨",
      label: "이번달 신규",
      value: newThisMonth,
      tone: "border-sky-200 bg-sky-50 text-sky-900",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav aria-label="breadcrumb" className="text-xs text-[#8B7F75]">
        <Link href="/partner/dashboard" className="hover:text-[#2D5A3D]">
          대시보드
        </Link>
        <span className="mx-2">/</span>
        <span>고객</span>
        <span className="mx-2">/</span>
        <span className="font-semibold text-[#2D5A3D]">기관 고객 (B2B2C)</span>
      </nav>

      {/* Header */}
      <header className="rounded-3xl border border-[#D4E4BC] bg-gradient-to-br from-[#E8F0E4] via-white to-sky-50 p-5 shadow-sm md:p-7">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <span className="text-3xl" aria-hidden>
              🏫
            </span>
            <div>
              <h1 className="text-xl font-bold text-[#2D5A3D] md:text-2xl">
                기관 고객 (B2B2C)
              </h1>
              <p className="mt-1 text-xs text-[#6B6560] md:text-sm">
                어린이집·학교·교육청 등 B2B2C 기관을 등록하고 관리하세요.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/partner/customers/org/new"
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-[#2D5A3D] to-sky-700 px-4 py-2.5 text-sm font-bold text-white shadow-md hover:from-[#234a30] hover:to-sky-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2D5A3D]/40"
            >
              <span aria-hidden>➕</span>
              <span>새 기관 등록</span>
            </Link>
            <Link
              href="/partner/customers/org/import"
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-[#D4E4BC] bg-white px-4 py-2.5 text-sm font-semibold text-[#2D5A3D] hover:bg-[#F5F1E8]"
            >
              <span aria-hidden>📥</span>
              <span>엑셀 일괄등록</span>
            </Link>
            <form action={regenerateAllOrgAccountsAction}>
              <button
                type="submit"
                className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-[#D4A15A] bg-[#FFF8F0] px-4 py-2.5 text-sm font-semibold text-[#8B6B3F] hover:bg-[#F5E8D3]"
                title="아이디=기관명, 비밀번호=담당자 연락처 뒷 4자리 로 일괄 재발급합니다"
              >
                <span aria-hidden>🔄</span>
                <span>계정 일괄 갱신</span>
              </button>
            </form>
          </div>
        </div>
        {sp.regen === "done" && (
          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            ✅ 계정 일괄 갱신 완료 — 성공 <strong>{sp.success ?? 0}</strong>건 / 실패{" "}
            <strong>{sp.failed ?? 0}</strong>건
            {sp.skipped && Number(sp.skipped) > 0 && (
              <> / 건너뜀 <strong>{sp.skipped}</strong>건 (기관 전화번호 없음)</>
            )}
            . 아이디=기관 전화번호, 비밀번호=담당자 핸드폰 뒷 4자리입니다.
          </div>
        )}
        {sp.regen === "empty" && (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            ⚠️ 재발급할 기관이 없어요.
          </div>
        )}
      </header>

      {/* Stats */}
      <section
        aria-label="기관 고객 통계"
        className="grid grid-cols-2 gap-3 md:grid-cols-4"
      >
        {STATS.map((s) => (
          <div
            key={s.label}
            className={`rounded-2xl border p-4 shadow-sm ${s.tone}`}
          >
            <p className="flex items-center gap-1.5 text-[11px] font-semibold opacity-80">
              <span aria-hidden>{s.icon}</span>
              <span>{s.label}</span>
            </p>
            <p className="mt-1 text-2xl font-extrabold">
              {s.value.toLocaleString("ko-KR")}
            </p>
          </div>
        ))}
      </section>

      {/* Filters */}
      <section className="rounded-2xl border border-[#D4E4BC] bg-white p-4 shadow-sm md:p-5">
        <form method="get" className="grid grid-cols-1 gap-3 md:grid-cols-5">
          <div className="md:col-span-2">
            <label
              htmlFor="q"
              className="mb-1 block text-xs font-semibold text-[#2D5A3D]"
            >
              🔍 기관명 검색
            </label>
            <input
              id="q"
              name="q"
              type="search"
              defaultValue={sp.q ?? ""}
              autoComplete="off"
              placeholder="예) 토리로 어린이집"
              className="w-full rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] px-3 py-2 text-sm text-[#2C2C2C] focus:border-[#3A7A52] focus:outline-none focus:ring-2 focus:ring-[#3A7A52]/30"
            />
          </div>
          <div>
            <label
              htmlFor="type"
              className="mb-1 block text-xs font-semibold text-[#2D5A3D]"
            >
              유형
            </label>
            <select
              id="type"
              name="type"
              defaultValue={sp.type ?? ""}
              className="w-full rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] px-3 py-2 text-sm text-[#2C2C2C] focus:border-[#3A7A52] focus:outline-none focus:ring-2 focus:ring-[#3A7A52]/30"
            >
              <option value="">전체</option>
              {ORG_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.icon} {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label
              htmlFor="status"
              className="mb-1 block text-xs font-semibold text-[#2D5A3D]"
            >
              상태
            </label>
            <select
              id="status"
              name="status"
              defaultValue={sp.status ?? ""}
              className="w-full rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] px-3 py-2 text-sm text-[#2C2C2C] focus:border-[#3A7A52] focus:outline-none focus:ring-2 focus:ring-[#3A7A52]/30"
            >
              <option value="">전체</option>
              {ORG_STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label
              htmlFor="tag"
              className="mb-1 block text-xs font-semibold text-[#2D5A3D]"
            >
              태그
            </label>
            <input
              id="tag"
              name="tag"
              type="search"
              list="tag-options"
              defaultValue={sp.tag ?? ""}
              autoComplete="off"
              placeholder="예) VIP"
              className="w-full rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] px-3 py-2 text-sm text-[#2C2C2C] focus:border-[#3A7A52] focus:outline-none focus:ring-2 focus:ring-[#3A7A52]/30"
            />
            {allTags.length > 0 && (
              <datalist id="tag-options">
                {allTags.map((t) => (
                  <option key={t} value={t} />
                ))}
              </datalist>
            )}
          </div>
          <div className="flex items-end gap-2 md:col-span-5">
            <button
              type="submit"
              className="rounded-xl bg-[#2D5A3D] px-4 py-2 text-xs font-bold text-white hover:bg-[#234a30]"
            >
              필터 적용
            </button>
            <Link
              href="/partner/customers/org"
              className="rounded-xl border border-[#D4E4BC] bg-white px-4 py-2 text-xs font-semibold text-[#6B6560] hover:bg-[#FFF8F0]"
            >
              초기화
            </Link>
            <p className="ml-auto text-[11px] text-[#8B7F75]">
              {filtered.length.toLocaleString("ko-KR")}개 표시 /{" "}
              {total.toLocaleString("ko-KR")}개 전체
            </p>
          </div>
        </form>
      </section>

      {/* Table (desktop) / Cards (mobile) */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#D4E4BC] bg-white p-10 text-center">
          <div className="text-5xl" aria-hidden>
            🏫
          </div>
          <p className="mt-3 text-sm font-semibold text-[#2D5A3D]">
            {all.length === 0
              ? "아직 등록된 기관이 없어요"
              : "조건에 맞는 기관이 없어요"}
          </p>
          <p className="mt-1 text-xs text-[#6B6560]">
            {all.length === 0
              ? "첫 번째 기관 고객을 등록해 보세요."
              : "필터를 조정하거나 초기화해 보세요."}
          </p>
          {all.length === 0 && (
            <Link
              href="/partner/customers/org/new"
              className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-[#2D5A3D] px-4 py-2 text-xs font-bold text-white hover:bg-[#234a30]"
            >
              <span aria-hidden>➕</span>
              <span>첫 기관 등록하기</span>
            </Link>
          )}
        </div>
      ) : (
        <>
          {/* 모바일: 카드 */}
          <section className="grid grid-cols-1 gap-3 md:hidden" aria-label="기관 목록">
            {filtered.map((o) => {
              const typeMeta = ORG_TYPE_META[o.org_type] ?? ORG_TYPE_META.OTHER;
              const statusMeta = ORG_STATUS_META[o.status];
              const daysLeft = daysUntil(o.contract_end);
              return (
                <div
                  key={o.id}
                  className="rounded-2xl border border-[#D4E4BC] bg-white p-4 shadow-sm transition hover:border-[#3A7A52] hover:shadow-md"
                >
                  <Link
                    href={`/partner/customers/org/${o.id}`}
                    className="block"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${typeMeta.chip}`}
                          >
                            <span aria-hidden>{typeMeta.icon}</span>
                            <span>{typeMeta.label}</span>
                          </span>
                          <span
                            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${statusMeta.chip}`}
                          >
                            <span
                              aria-hidden
                              className={`h-1.5 w-1.5 rounded-full ${statusMeta.dot}`}
                            />
                            {statusMeta.label}
                          </span>
                        </div>
                        <h3 className="mt-1.5 truncate text-base font-bold text-[#2D5A3D]">
                          {o.org_name}
                        </h3>
                        <p className="mt-0.5 text-xs text-[#6B6560]">
                          {o.representative_name ?? "담당자 미지정"} ·{" "}
                          {formatPhone(o.representative_phone)}
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
                      <div className="rounded-lg bg-[#FFF8F0] px-2 py-1.5 text-center">
                        <div className="text-[10px] text-[#8B7F75]">아동</div>
                        <div className="font-bold text-[#2D5A3D]">
                          {o.children_count.toLocaleString("ko-KR")}명
                        </div>
                      </div>
                      <div className="rounded-lg bg-[#FFF8F0] px-2 py-1.5 text-center">
                        <div className="text-[10px] text-[#8B7F75]">반</div>
                        <div className="font-bold text-[#2D5A3D]">
                          {o.class_count}
                        </div>
                      </div>
                      <div className="rounded-lg bg-[#FFF8F0] px-2 py-1.5 text-center">
                        <div className="text-[10px] text-[#8B7F75]">교사</div>
                        <div className="font-bold text-[#2D5A3D]">
                          {o.teacher_count}
                        </div>
                      </div>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-[11px] text-[#8B7F75]">
                      <span>작성 {formatDate(o.created_at)}</span>
                      {daysLeft !== null && daysLeft <= 30 && daysLeft >= 0 ? (
                        <span className="font-semibold text-amber-700">
                          계약 {daysLeft}일 남음
                        </span>
                      ) : o.contract_end ? (
                        <span>계약만료 {formatDate(o.contract_end)}</span>
                      ) : null}
                    </div>
                  </Link>
                  <OrgRowActions
                    orgId={o.id}
                    orgName={o.org_name}
                    status={o.status}
                    variant="card"
                  />
                </div>
              );
            })}
          </section>

          {/* 데스크탑: 테이블 */}
          <section
            className="hidden overflow-hidden rounded-2xl border border-[#D4E4BC] bg-white shadow-sm md:block"
            aria-label="기관 목록 테이블"
          >
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-[#D4E4BC] bg-[#FFF8F0] text-xs text-[#2D5A3D]">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">기관명</th>
                    <th className="px-4 py-3 text-left font-semibold">유형</th>
                    <th className="px-4 py-3 text-left font-semibold">대표자</th>
                    <th className="px-4 py-3 text-left font-semibold">연락처</th>
                    <th className="px-4 py-3 text-right font-semibold">아동수</th>
                    <th className="px-4 py-3 text-left font-semibold">상태</th>
                    <th className="px-4 py-3 text-left font-semibold">작성일</th>
                    <th className="px-4 py-3 text-right font-semibold">액션</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((o, i) => {
                    const typeMeta =
                      ORG_TYPE_META[o.org_type] ?? ORG_TYPE_META.OTHER;
                    const statusMeta = ORG_STATUS_META[o.status];
                    return (
                      <tr
                        key={o.id}
                        className={`border-b border-[#F0E8D8] text-[#2C2C2C] hover:bg-[#FFFBF3] ${
                          i % 2 === 0 ? "bg-white" : "bg-[#FFFDF8]"
                        }`}
                      >
                        <td className="px-4 py-3">
                          <Link
                            href={`/partner/customers/org/${o.id}`}
                            className="font-bold text-[#2D5A3D] hover:underline"
                          >
                            {o.org_name}
                          </Link>
                          {o.tags && o.tags.length > 0 && (
                            <div className="mt-1 flex flex-wrap gap-1">
                              {o.tags.slice(0, 3).map((t) => (
                                <span
                                  key={t}
                                  className="rounded-full bg-[#F5F1E8] px-1.5 py-0.5 text-[10px] text-[#6B6560]"
                                >
                                  #{t}
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${typeMeta.chip}`}
                          >
                            <span aria-hidden>{typeMeta.icon}</span>
                            <span>{typeMeta.label}</span>
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-[#6B6560]">
                          {o.representative_name ?? "-"}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-[#6B6560]">
                          {formatPhone(o.representative_phone)}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-[#2D5A3D]">
                          {o.children_count.toLocaleString("ko-KR")}
                          <span className="ml-0.5 text-[10px] text-[#8B7F75]">
                            명
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${statusMeta.chip}`}
                          >
                            <span
                              aria-hidden
                              className={`h-1.5 w-1.5 rounded-full ${statusMeta.dot}`}
                            />
                            {statusMeta.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-[#8B7F75]">
                          {formatDate(o.created_at)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <OrgRowActions
                            orgId={o.id}
                            orgName={o.org_name}
                            status={o.status}
                            variant="table"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
