import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { InquiryRowActions } from "./inquiry-row-actions";

export const dynamic = "force-dynamic";

type InquiryStatus = "NEW" | "CONTACTED" | "PROPOSED" | "WON" | "LOST";

type InquiryRow = {
  id: string;
  company_name: string;
  contact_name: string;
  contact_email: string | null;
  contact_phone: string | null;
  expected_attendees: string | null;
  interested_packages: string[] | null;
  preferred_date: string | null;
  message: string | null;
  status: InquiryStatus;
  assigned_to: string | null;
  created_at: string;
};

const STATUS_META: Record<InquiryStatus, { label: string; dot: string; text: string; bg: string }> = {
  NEW: { label: "신규", dot: "bg-blue-500", text: "text-blue-700", bg: "bg-blue-50" },
  CONTACTED: { label: "상담중", dot: "bg-amber-500", text: "text-amber-700", bg: "bg-amber-50" },
  PROPOSED: { label: "제안완료", dot: "bg-violet-500", text: "text-violet-700", bg: "bg-violet-50" },
  WON: { label: "계약성사", dot: "bg-green-500", text: "text-green-700", bg: "bg-green-50" },
  LOST: { label: "무산", dot: "bg-red-500", text: "text-red-700", bg: "bg-red-50" },
};

const PACKAGE_LABEL: Record<string, string> = {
  BASIC: "🥉 베이직",
  PREMIUM: "🥈 프리미엄",
  ENTERPRISE: "🥇 엔터프라이즈",
};

function fmtDate(iso: string | null) {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleString("ko-KR", {
      year: "2-digit",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export default async function AdminB2BPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const sp = await searchParams;
  const filterStatus = (sp.status ?? "ALL").toUpperCase();
  const supabase = await createClient();

  let inquiries: InquiryRow[] = [];
  let tableMissing = false;

  try {
    const { data, error } = await (
      supabase as unknown as {
        from: (t: string) => {
          select: (cols: string) => {
            order: (
              col: string,
              opts: { ascending: boolean }
            ) => Promise<{
              data: InquiryRow[] | null;
              error: { message: string; code?: string } | null;
            }>;
          };
        };
      }
    )
      .from("b2b_inquiries")
      .select(
        "id, company_name, contact_name, contact_email, contact_phone, expected_attendees, interested_packages, preferred_date, message, status, assigned_to, created_at"
      )
      .order("created_at", { ascending: false });

    if (error) {
      if (error.code === "42P01" || /relation .* does not exist/i.test(error.message)) {
        tableMissing = true;
      } else {
        throw new Error(error.message);
      }
    } else {
      inquiries = data ?? [];
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/relation .* does not exist|b2b_inquiries/i.test(msg)) {
      tableMissing = true;
    } else {
      tableMissing = true;
    }
  }

  const filtered =
    filterStatus === "ALL"
      ? inquiries
      : inquiries.filter((i) => i.status === (filterStatus as InquiryStatus));

  const counts: Record<InquiryStatus | "ALL", number> = {
    ALL: inquiries.length,
    NEW: inquiries.filter((i) => i.status === "NEW").length,
    CONTACTED: inquiries.filter((i) => i.status === "CONTACTED").length,
    PROPOSED: inquiries.filter((i) => i.status === "PROPOSED").length,
    WON: inquiries.filter((i) => i.status === "WON").length,
    LOST: inquiries.filter((i) => i.status === "LOST").length,
  };

  const FILTERS: Array<{ key: string; label: string; count: number }> = [
    { key: "ALL", label: "전체", count: counts.ALL },
    { key: "NEW", label: "신규", count: counts.NEW },
    { key: "CONTACTED", label: "상담중", count: counts.CONTACTED },
    { key: "PROPOSED", label: "제안완료", count: counts.PROPOSED },
    { key: "WON", label: "성사", count: counts.WON },
    { key: "LOST", label: "무산", count: counts.LOST },
  ];

  return (
    <div className="space-y-6">
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

      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-extrabold text-[#2D5A3D]">
            <span>🏢</span>
            <span>기업 문의 관리</span>
          </h1>
          <p className="mt-1 text-sm text-[#6B6560]">
            /enterprise 페이지에서 접수된 B2B 상담 요청을 관리하세요
          </p>
        </div>
        <Link
          href="/enterprise"
          target="_blank"
          className="whitespace-nowrap rounded-xl border border-[#D4E4BC] bg-white px-4 py-2 text-sm font-semibold text-[#2D5A3D] hover:bg-[#E8F0E4]"
        >
          공개 페이지 열기 ↗
        </Link>
      </div>

      {/* 통계 */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {(["NEW", "CONTACTED", "PROPOSED", "WON", "LOST"] as InquiryStatus[]).map((k) => {
          const m = STATUS_META[k];
          return (
            <div key={k} className={`rounded-2xl border border-[#D4E4BC] ${m.bg} p-4`}>
              <div className={`text-xs font-medium ${m.text}`}>{m.label}</div>
              <div className={`mt-1 text-2xl font-bold ${m.text}`}>
                {counts[k].toLocaleString("ko-KR")}
                <span className="ml-1 text-sm font-medium">건</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* 필터 */}
      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map((f) => {
          const active = filterStatus === f.key;
          return (
            <Link
              key={f.key}
              href={f.key === "ALL" ? "/admin/b2b" : `/admin/b2b?status=${f.key}`}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                active
                  ? "bg-[#2D5A3D] text-white"
                  : "border border-[#D4E4BC] bg-white text-[#2D5A3D] hover:bg-[#E8F0E4]"
              }`}
            >
              {f.label}
              <span
                className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] ${
                  active ? "bg-white/20" : "bg-[#E8F0E4] text-[#2D5A3D]"
                }`}
              >
                {f.count}
              </span>
            </Link>
          );
        })}
      </div>

      {/* 리스트 */}
      <section>
        {tableMissing ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
            <div className="font-semibold">⚠️ b2b_inquiries 테이블이 아직 준비되지 않았어요.</div>
            <p className="mt-1 text-xs">
              DB 마이그레이션(20260421200000_b2b_inquiries.sql)을 먼저 실행해 주세요.
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-[#D4E4BC] bg-white p-5">
            <div className="py-16 text-center">
              <span className="text-5xl">📭</span>
              <p className="mt-3 text-sm font-semibold text-[#2D5A3D]">
                {filterStatus === "ALL"
                  ? "아직 접수된 기업 문의가 없어요"
                  : "해당 상태의 문의가 없어요"}
              </p>
              <p className="mt-1 text-xs text-[#6B6560]">
                /enterprise 페이지에서 접수된 상담 요청이 이곳에 표시됩니다
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* 모바일 카드 */}
            <div className="space-y-2 md:hidden">
              {filtered.map((i) => {
                const s = STATUS_META[i.status];
                return (
                  <div
                    key={i.id}
                    className="rounded-2xl border border-[#D4E4BC] bg-white p-4 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${s.text} ${s.bg}`}
                          >
                            <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
                            {s.label}
                          </span>
                          <span className="text-[11px] text-[#8B6F47]">
                            {fmtDate(i.created_at)}
                          </span>
                        </div>
                        <div className="mt-1 truncate font-bold text-[#2C2C2C]">
                          {i.company_name}
                        </div>
                        <div className="text-xs text-[#6B6560]">
                          담당 {i.contact_name}
                          {i.contact_phone ? ` · ${i.contact_phone}` : ""}
                          {i.contact_email ? ` · ${i.contact_email}` : ""}
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-lg bg-[#FFF8F0] p-2">
                        <div className="text-[10px] text-[#8B6F47]">예상 인원</div>
                        <div className="font-bold text-[#2D5A3D]">
                          {i.expected_attendees ?? "-"}
                        </div>
                      </div>
                      <div className="rounded-lg bg-[#FFF8F0] p-2">
                        <div className="text-[10px] text-[#8B6F47]">희망 일정</div>
                        <div className="font-bold text-[#2D5A3D]">
                          {i.preferred_date ? fmtDate(i.preferred_date) : "-"}
                        </div>
                      </div>
                    </div>

                    {i.interested_packages && i.interested_packages.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {i.interested_packages.map((p) => (
                          <span
                            key={p}
                            className="rounded-full bg-[#E8F0E4] px-2 py-0.5 text-[10px] font-semibold text-[#2D5A3D]"
                          >
                            {PACKAGE_LABEL[p] ?? p}
                          </span>
                        ))}
                      </div>
                    )}

                    {i.message && (
                      <p className="mt-2 line-clamp-3 whitespace-pre-wrap rounded-lg bg-[#FFF8F0] p-2 text-xs text-[#6B6560]">
                        {i.message}
                      </p>
                    )}

                    <div className="mt-3">
                      <InquiryRowActions
                        id={i.id}
                        status={i.status}
                        assignedTo={i.assigned_to}
                        companyName={i.company_name}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 데스크톱 테이블 */}
            <div className="hidden overflow-x-auto rounded-2xl border border-[#D4E4BC] bg-white md:block">
              <table className="w-full text-sm">
                <thead className="bg-[#F5E6D3]/40 text-left text-xs text-[#8B6F47]">
                  <tr>
                    <th className="px-4 py-3 font-semibold">회사 / 담당자</th>
                    <th className="px-4 py-3 font-semibold">연락처</th>
                    <th className="px-4 py-3 font-semibold">인원</th>
                    <th className="px-4 py-3 font-semibold">희망 일정</th>
                    <th className="px-4 py-3 font-semibold">관심 패키지</th>
                    <th className="px-4 py-3 font-semibold">상태 / 담당</th>
                    <th className="px-4 py-3 font-semibold">접수</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E8F0E4]">
                  {filtered.map((i) => (
                    <tr key={i.id} className="align-top hover:bg-[#FFF8F0]/40">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-[#2C2C2C]">{i.company_name}</div>
                        <div className="text-xs text-[#6B6560]">{i.contact_name}</div>
                        {i.message && (
                          <div
                            title={i.message}
                            className="mt-1 max-w-xs truncate text-[11px] text-[#8B6F47]"
                          >
                            “{i.message}”
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-[#6B6560]">
                        {i.contact_phone && <div>{i.contact_phone}</div>}
                        {i.contact_email && <div>{i.contact_email}</div>}
                        {!i.contact_phone && !i.contact_email && "-"}
                      </td>
                      <td className="px-4 py-3 text-xs font-semibold text-[#2D5A3D]">
                        {i.expected_attendees ?? "-"}
                      </td>
                      <td className="px-4 py-3 text-xs text-[#6B6560]">
                        {i.preferred_date ? fmtDate(i.preferred_date) : "-"}
                      </td>
                      <td className="px-4 py-3">
                        {i.interested_packages && i.interested_packages.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {i.interested_packages.map((p) => (
                              <span
                                key={p}
                                className="rounded-full bg-[#E8F0E4] px-2 py-0.5 text-[10px] font-semibold text-[#2D5A3D]"
                              >
                                {PACKAGE_LABEL[p] ?? p}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-[#8B6F47]">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <InquiryRowActions
                          id={i.id}
                          status={i.status}
                          assignedTo={i.assigned_to}
                          companyName={i.company_name}
                        />
                      </td>
                      <td className="px-4 py-3 text-xs text-[#6B6560]">
                        {fmtDate(i.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      <section className="rounded-2xl border border-[#E5D3B8] bg-gradient-to-br from-[#FFF8F0] to-[#F5E6D3] p-5">
        <h3 className="flex items-center gap-1.5 text-sm font-bold text-[#6B4423]">
          <span>💡</span>
          <span>B2B 수익 파이프라인</span>
        </h3>
        <p className="mt-2 text-xs leading-relaxed text-[#8B6F47]">
          신규 → 상담중 → 제안완료 → 계약성사 / 무산 단계로 관리합니다. 계약성사 건은 자동으로 매출
          대시보드에 반영되며, 무산 건도 인사이트로 분류해 주세요.
        </p>
      </section>
    </div>
  );
}
