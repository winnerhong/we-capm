import Link from "next/link";
import { requireAdmin } from "@/lib/auth-guard";
import { createClient } from "@/lib/supabase/server";
import { loadOrgProfileSnapshot } from "@/lib/profile-completeness/queries";
import { calcCompleteness } from "@/lib/profile-completeness/calculator";
import { buildOrgProfileSchema } from "@/lib/profile-completeness/schemas/org";

export const dynamic = "force-dynamic";

type OrgStatus = "ACTIVE" | "INACTIVE" | "SUSPENDED" | "CLOSED";
type OrgType =
  | "DAYCARE"
  | "KINDERGARTEN"
  | "ELEMENTARY"
  | "MIDDLE"
  | "HIGH"
  | "EDUCATION_OFFICE"
  | "OTHER";

type OrgRow = {
  id: string;
  partner_id: string;
  org_name: string;
  org_type: OrgType | null;
  representative_name: string | null;
  representative_phone: string | null;
  email: string | null;
  children_count: number | null;
  status: OrgStatus;
  created_at: string;
};

type PartnerName = { id: string; name: string; business_name: string | null };

const TYPE_LABEL: Record<OrgType, string> = {
  DAYCARE: "어린이집",
  KINDERGARTEN: "유치원",
  ELEMENTARY: "초등학교",
  MIDDLE: "중학교",
  HIGH: "고등학교",
  EDUCATION_OFFICE: "교육청",
  OTHER: "기타",
};

const STATUS_LABEL: Record<
  OrgStatus,
  { dot: string; label: string; text: string }
> = {
  ACTIVE: { dot: "bg-green-500", label: "활성", text: "text-green-700" },
  INACTIVE: { dot: "bg-gray-400", label: "비활성", text: "text-gray-600" },
  SUSPENDED: {
    dot: "bg-yellow-500",
    label: "정지",
    text: "text-yellow-700",
  },
  CLOSED: { dot: "bg-red-500", label: "종료", text: "text-red-700" },
};

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

function fmtNumber(n: number) {
  return n.toLocaleString("ko-KR");
}

export default async function AdminOrgsPage() {
  try {
    await requireAdmin();
  } catch {
    return (
      <div className="space-y-4 rounded-3xl border border-rose-200 bg-rose-50 p-6 text-center">
        <h1 className="text-xl font-bold text-rose-800">관리자 권한 필요</h1>
        <Link
          href="/admin"
          className="inline-block rounded-xl border border-rose-300 bg-white px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100"
        >
          관리자 로그인
        </Link>
      </div>
    );
  }

  const supabase = await createClient();

  let orgs: OrgRow[] = [];
  let tableMissing = false;
  try {
    const { data, error } = await (
      supabase as unknown as {
        from: (t: string) => {
          select: (c: string) => {
            order: (
              c: string,
              o: { ascending: boolean }
            ) => Promise<{
              data: OrgRow[] | null;
              error: { message: string; code?: string } | null;
            }>;
          };
        };
      }
    )
      .from("partner_orgs")
      .select(
        "id,partner_id,org_name,org_type,representative_name,representative_phone,email,children_count,status,created_at"
      )
      .order("created_at", { ascending: false });
    if (error) {
      if (error.code === "42P01") tableMissing = true;
      else throw new Error(error.message);
    } else {
      orgs = data ?? [];
    }
  } catch {
    tableMissing = true;
  }

  // 파트너 이름 맵
  const partnerNameMap = new Map<string, string>();
  if (!tableMissing && orgs.length > 0) {
    const partnerIds = Array.from(new Set(orgs.map((o) => o.partner_id)));
    try {
      const { data } = await (
        supabase as unknown as {
          from: (t: string) => {
            select: (c: string) => {
              in: (
                k: string,
                v: string[]
              ) => Promise<{ data: PartnerName[] | null }>;
            };
          };
        }
      )
        .from("partners")
        .select("id,name,business_name")
        .in("id", partnerIds);
      for (const p of data ?? []) {
        partnerNameMap.set(p.id, p.business_name ?? p.name);
      }
    } catch {
      // 무시
    }
  }

  // 완성도 맵 (병렬)
  const completenessMap = new Map<string, number>();
  if (!tableMissing && orgs.length > 0) {
    const results = await Promise.all(
      orgs.map(async (o) => {
        try {
          const snap = await loadOrgProfileSnapshot(o.id);
          const schema = buildOrgProfileSchema(o.id);
          return { id: o.id, percent: calcCompleteness(schema, snap).percent };
        } catch {
          return { id: o.id, percent: 0 };
        }
      })
    );
    for (const r of results) completenessMap.set(r.id, r.percent);
  }

  const totalCount = orgs.length;
  const activeCount = orgs.filter((o) => o.status === "ACTIVE").length;

  // 온보딩 지표
  const onboarding = (() => {
    if (orgs.length === 0) return { avg: 0, under50: 0, complete: 0 };
    const values = orgs.map((o) => completenessMap.get(o.id) ?? 0);
    const sum = values.reduce((a, b) => a + b, 0);
    return {
      avg: Math.round(sum / values.length),
      under50: values.filter((v) => v < 50).length,
      complete: values.filter((v) => v >= 100).length,
    };
  })();

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav aria-label="breadcrumb" className="text-xs text-[#8B7F75]">
        <Link href="/admin" className="hover:text-[#2D5A3D]">
          관리자
        </Link>
        <span className="mx-2">/</span>
        <span className="font-semibold text-[#2D5A3D]">기관 관리</span>
      </nav>

      {/* 헤더 */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-extrabold text-[#2D5A3D]">
            <span>🏫</span>
            <span>기관 관리</span>
          </h1>
          <p className="mt-1 text-sm text-[#6B6560]">
            지사들이 연결한 기관 고객(어린이집·유치원·학교)을 확인하세요
          </p>
        </div>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded-2xl border border-[#D4E4BC] bg-white p-4">
          <div className="text-xs font-medium text-[#8B6F47]">총 기관</div>
          <div className="mt-1 text-2xl font-bold text-[#2D5A3D]">
            {fmtNumber(totalCount)}
            <span className="ml-1 text-sm font-medium">곳</span>
          </div>
        </div>
        <div className="rounded-2xl border border-[#D4E4BC] bg-white p-4">
          <div className="text-xs font-medium text-[#8B6F47]">활성</div>
          <div className="mt-1 text-2xl font-bold text-[#2D5A3D]">
            {fmtNumber(activeCount)}
            <span className="ml-1 text-sm font-medium">곳</span>
          </div>
        </div>
        <div className="rounded-2xl border border-[#D4E4BC] bg-white p-4">
          <div className="text-xs font-medium text-[#8B6F47]">평균 완성도</div>
          <div className="mt-1 text-2xl font-bold text-[#2D5A3D]">
            {onboarding.avg}
            <span className="ml-1 text-sm font-medium">%</span>
          </div>
        </div>
        <div
          className={`rounded-2xl border p-4 ${
            onboarding.under50 > 0
              ? "border-rose-200 bg-rose-50"
              : "border-[#D4E4BC] bg-white"
          }`}
        >
          <div
            className={`text-xs font-medium ${
              onboarding.under50 > 0 ? "text-rose-700" : "text-[#8B6F47]"
            }`}
          >
            50% 미만
          </div>
          <div
            className={`mt-1 text-2xl font-bold ${
              onboarding.under50 > 0 ? "text-rose-800" : "text-[#2D5A3D]"
            }`}
          >
            {onboarding.under50}
            <span className="ml-1 text-sm font-medium">곳</span>
          </div>
        </div>
      </div>

      {/* 리스트 */}
      <section>
        <h2 className="mb-2 text-sm font-bold text-[#2D5A3D]">
          🏫 등록된 기관
        </h2>

        {tableMissing ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
            <div className="font-semibold">
              ⚠️ partner_orgs 테이블이 아직 준비되지 않았어요.
            </div>
          </div>
        ) : orgs.length === 0 ? (
          <div className="rounded-2xl border border-[#D4E4BC] bg-white p-12 text-center">
            <span className="text-5xl">🏫</span>
            <p className="mt-3 text-sm font-semibold text-[#2D5A3D]">
              아직 등록된 기관이 없어요
            </p>
            <p className="mt-1 text-xs text-[#6B6560]">
              지사가 기관 고객을 등록하면 여기에 표시됩니다.
            </p>
          </div>
        ) : (
          <>
            {/* 모바일 */}
            <div className="space-y-2 md:hidden">
              {orgs.map((o) => {
                const s = STATUS_LABEL[o.status];
                const pct = completenessMap.get(o.id) ?? 0;
                const pName =
                  partnerNameMap.get(o.partner_id) ?? "(소속 지사 미상)";
                return (
                  <div
                    key={o.id}
                    className="rounded-2xl border border-[#D4E4BC] bg-white p-4 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {o.org_type && (
                            <span className="rounded-full bg-[#E8F0E4] px-2 py-0.5 text-[10px] font-semibold text-[#2D5A3D]">
                              {TYPE_LABEL[o.org_type]}
                            </span>
                          )}
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
                          href={`/admin/orgs/${o.id}`}
                          className="mt-1 block truncate font-bold text-[#2C2C2C] hover:text-[#2D5A3D] hover:underline"
                        >
                          {o.org_name}
                        </Link>
                        <div className="text-[11px] text-[#8B6F47]">
                          소속: 🏡 {pName}
                        </div>
                        <div className="text-[11px] text-[#6B6560]">
                          {o.representative_name ?? "담당자 미등록"}
                          {o.representative_phone
                            ? ` · ${o.representative_phone}`
                            : ""}
                        </div>
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <a
                        href={`/api/admin/impersonate?role=org&id=${o.id}`}
                        title={`${o.org_name}(으)로 로그인 전환`}
                        className="inline-flex items-center gap-1 rounded-full border border-violet-300 bg-violet-50 px-2.5 py-0.5 text-[11px] font-semibold text-violet-800 hover:bg-violet-100"
                      >
                        🔑 로그인
                      </a>
                      <CompletenessMini orgId={o.id} percent={pct} />
                      {o.children_count != null && o.children_count > 0 && (
                        <span className="rounded-full border border-[#D4E4BC] bg-[#FFF8F0] px-2 py-0.5 text-[11px] font-semibold text-[#6B4423]">
                          아동 {o.children_count}명
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 데스크톱 */}
            <div className="hidden overflow-x-auto rounded-2xl border border-[#D4E4BC] bg-white md:block">
              <table className="w-full text-sm">
                <thead className="bg-[#F5E6D3]/40 text-left text-xs text-[#8B6F47]">
                  <tr>
                    <th className="px-4 py-3 font-semibold">기관</th>
                    <th className="px-4 py-3 font-semibold">유형</th>
                    <th className="px-4 py-3 font-semibold">상태</th>
                    <th className="px-4 py-3 font-semibold">🌱 완성도</th>
                    <th className="px-4 py-3 font-semibold">소속 지사</th>
                    <th className="px-4 py-3 text-right font-semibold">
                      아동
                    </th>
                    <th className="px-4 py-3 font-semibold">담당자</th>
                    <th className="px-4 py-3 font-semibold">등록일</th>
                    <th className="px-4 py-3 font-semibold">작업</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E8F0E4]">
                  {orgs.map((o) => {
                    const s = STATUS_LABEL[o.status];
                    const pct = completenessMap.get(o.id) ?? 0;
                    const pName =
                      partnerNameMap.get(o.partner_id) ?? "(미상)";
                    return (
                      <tr key={o.id} className="hover:bg-[#FFF8F0]/40">
                        <td className="px-4 py-3">
                          <Link
                            href={`/admin/orgs/${o.id}`}
                            className="font-semibold text-[#2C2C2C] hover:text-[#2D5A3D] hover:underline"
                          >
                            {o.org_name}
                          </Link>
                          {o.email && (
                            <div className="text-[11px] text-[#8B6F47]">
                              {o.email}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-[#6B6560]">
                          {o.org_type ? TYPE_LABEL[o.org_type] : "-"}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`flex items-center gap-1.5 text-xs font-semibold ${s.text}`}
                          >
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${s.dot}`}
                            />
                            {s.label}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <CompletenessMini orgId={o.id} percent={pct} />
                        </td>
                        <td className="px-4 py-3">
                          <Link
                            href={`/admin/partners/${o.partner_id}`}
                            className="text-xs text-[#2D5A3D] hover:underline"
                          >
                            🏡 {pName}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-right text-xs">
                          {o.children_count != null && o.children_count > 0
                            ? `${o.children_count}명`
                            : "-"}
                        </td>
                        <td className="px-4 py-3 text-xs text-[#6B6560]">
                          {o.representative_name ?? "-"}
                          {o.representative_phone && (
                            <div className="text-[11px]">
                              {o.representative_phone}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-[#6B6560]">
                          {fmtDate(o.created_at)}
                        </td>
                        <td className="px-4 py-3">
                          <a
                            href={`/api/admin/impersonate?role=org&id=${o.id}`}
                            title={`${o.org_name}(으)로 로그인 전환`}
                            className="inline-flex items-center gap-1 rounded-lg border border-violet-300 bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-800 hover:bg-violet-100"
                          >
                            🔑 로그인
                          </a>
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
    </div>
  );
}

function CompletenessMini({
  orgId,
  percent,
}: {
  orgId: string;
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
      href={`/admin/orgs/${orgId}`}
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-semibold hover:opacity-80 ${tone}`}
      title={`프로필 완성도 ${percent}%`}
    >
      <span aria-hidden>{icon}</span>
      <span>{percent}%</span>
    </Link>
  );
}
