import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOrg } from "@/lib/org-auth-guard";
import { createClient } from "@/lib/supabase/server";
import { updateOwnOrgInfoAction, changeOrgPasswordAction } from "../actions";
import { loadOrgProfileSnapshot } from "@/lib/profile-completeness/queries";
import { calcCompleteness } from "@/lib/profile-completeness/calculator";
import { buildOrgProfileSchema } from "@/lib/profile-completeness/schemas/org";
import { MissingList } from "@/components/profile-completeness/MissingList";
import { loadOrgDocumentStats } from "@/lib/org-documents/queries";
import { ORG_DOC_META, type OrgDocType } from "@/lib/org-documents/types";

export const dynamic = "force-dynamic";

const INPUT_CLASS =
  "w-full rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] px-3 py-2.5 text-sm text-[#2C2C2C] focus:border-[#3A7A52] focus:outline-none focus:ring-2 focus:ring-[#3A7A52]/30";
const LABEL_CLASS = "mb-1 block text-xs font-semibold text-[#2D5A3D]";

type OrgRow = {
  id: string;
  org_name: string;
  org_type: string | null;
  representative_name: string | null;
  representative_phone: string | null;
  email: string | null;
  address: string | null;
  business_number: string | null;
  children_count: number | null;
  class_count: number | null;
  teacher_count: number | null;
  tax_email: string | null;
  fm_brand_name: string | null;
  commission_rate: number | null;
  discount_rate: number | null;
  contract_start: string | null;
  contract_end: string | null;
};

const ORG_TYPE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "DAYCARE", label: "어린이집" },
  { value: "KINDERGARTEN", label: "유치원" },
  { value: "ELEMENTARY", label: "초등학교" },
  { value: "MIDDLE", label: "중학교" },
  { value: "HIGH", label: "고등학교" },
  { value: "EDUCATION_OFFICE", label: "교육청" },
  { value: "OTHER", label: "기타" },
];

async function loadOrg(id: string): Promise<OrgRow | null> {
  const supabase = await createClient();
  const { data } = await (
    supabase.from("partner_orgs" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          maybeSingle: () => Promise<{ data: OrgRow | null }>;
        };
      };
    }
  )
    .select(
      "id,org_name,org_type,representative_name,representative_phone,email,address,business_number,children_count,class_count,teacher_count,tax_email,fm_brand_name,commission_rate,discount_rate,contract_start,contract_end"
    )
    .eq("id", id)
    .maybeSingle();
  return data;
}

export default async function OrgSettingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string }>;
  searchParams?: Promise<{ saved?: string }>;
}) {
  const { orgId } = await params;
  const sp = (await searchParams) ?? {};
  const session = await requireOrg();

  const org = await loadOrg(orgId);
  if (!org) notFound();

  // 프로필 완성도
  const profileSnap = await loadOrgProfileSnapshot(orgId);
  const orgSchema = buildOrgProfileSchema(orgId);
  const completeness = calcCompleteness(orgSchema, profileSnap);

  // 서류 통계
  const docStats = await loadOrgDocumentStats(orgId);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      {/* Breadcrumb */}
      <nav aria-label="breadcrumb" className="mb-4 text-xs text-[#8B7F75]">
        <Link href={`/org/${orgId}`} className="hover:text-[#2D5A3D]">
          기관 홈
        </Link>
        <span className="mx-2">/</span>
        <span className="font-semibold text-[#2D5A3D]">기관 정보 수정</span>
      </nav>

      {/* Header */}
      <header className="mb-6 rounded-3xl border border-[#D4E4BC] bg-gradient-to-br from-[#E8F0E4] via-white to-[#FAE7D0] p-5 shadow-sm md:p-7">
        <div className="flex items-center gap-3">
          <span className="text-3xl" aria-hidden>
            🏫
          </span>
          <div>
            <h1 className="text-xl font-bold text-[#2D5A3D] md:text-2xl">
              우리 기관 정보
            </h1>
            <p className="mt-1 text-xs text-[#6B6560] md:text-sm">
              프로필 완성도를 높이기 위해 기관 정보를 입력해 주세요.
              소속 지사도 함께 이 정보를 확인해요.
            </p>
          </div>
        </div>
      </header>

      {sp.saved === "1" && (
        <div
          role="status"
          className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800"
        >
          ✅ 기관 정보가 저장됐어요
        </div>
      )}
      {sp.saved === "pw" && (
        <div
          role="status"
          className="mb-4 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm font-semibold text-sky-800"
        >
          🔐 비밀번호가 변경됐어요
        </div>
      )}

      {/* 완성도 게이지 */}
      <section className="mb-4 rounded-3xl border border-[#D4E4BC] bg-white p-5 shadow-sm">
        <div className="flex items-end justify-between gap-2">
          <p className="text-xs font-semibold text-[#6B6560]">프로필 완성도</p>
          <p className="text-2xl font-bold text-[#2D5A3D] tabular-nums">
            {completeness.percent}%
            <span className="ml-1 text-xs font-normal text-[#6B6560]">
              ({completeness.completedCount}/{completeness.totalCount})
            </span>
          </p>
        </div>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-[#F5F1E8]">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#3A7A52] to-[#4A7C59] transition-all"
            style={{ width: `${completeness.percent}%` }}
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={completeness.percent}
          />
        </div>
        {completeness.percent < 100 && (
          <p className="mt-2 text-xs text-[#6B6560]">
            👉 아래 항목을 채우면 완성도가 올라가요. 모든 기능을 원활히 쓰려면 80% 이상 채우기를 권장해요.
          </p>
        )}
      </section>

      <form
        action={updateOwnOrgInfoAction}
        className="space-y-5 rounded-2xl border border-[#D4E4BC] bg-white p-5 shadow-sm md:p-6"
      >
        {/* 기본 정보 */}
        <section className="space-y-3">
          <h2 className="flex items-center gap-1.5 text-sm font-bold text-[#2D5A3D]">
            <span>🌿</span>
            <span>기본 정보</span>
          </h2>

          <div>
            <label htmlFor="org_name" className={LABEL_CLASS}>
              기관명 <span className="text-rose-500">*</span>
            </label>
            <input
              id="org_name"
              name="org_name"
              type="text"
              required
              defaultValue={org.org_name ?? ""}
              placeholder="예: OO어린이집"
              className={INPUT_CLASS}
            />
          </div>

          <div>
            <label htmlFor="org_type" className={LABEL_CLASS}>
              기관 유형
            </label>
            <select
              id="org_type"
              name="org_type"
              defaultValue={org.org_type ?? ""}
              className={INPUT_CLASS}
            >
              <option value="">선택 안 함</option>
              {ORG_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label htmlFor="representative_name" className={LABEL_CLASS}>
                🙋 대표자(담당자) 이름
              </label>
              <input
                id="representative_name"
                name="representative_name"
                type="text"
                defaultValue={org.representative_name ?? ""}
                placeholder="예: 김원장"
                className={INPUT_CLASS}
              />
            </div>

            <div>
              <label htmlFor="representative_phone" className={LABEL_CLASS}>
                📞 담당자 연락처
              </label>
              <input
                id="representative_phone"
                name="representative_phone"
                type="tel"
                inputMode="tel"
                defaultValue={org.representative_phone ?? ""}
                placeholder="010-0000-0000"
                className={INPUT_CLASS}
              />
            </div>

            <div className="md:col-span-2">
              <label htmlFor="email" className={LABEL_CLASS}>
                📧 이메일
              </label>
              <input
                id="email"
                name="email"
                type="email"
                inputMode="email"
                defaultValue={org.email ?? ""}
                placeholder="name@example.com"
                className={INPUT_CLASS}
              />
            </div>
          </div>
        </section>

        {/* 기관 정보 */}
        <section className="space-y-3">
          <h2 className="flex items-center gap-1.5 text-sm font-bold text-[#2D5A3D]">
            <span>📑</span>
            <span>기관 상세 정보</span>
          </h2>

          <div>
            <label htmlFor="address" className={LABEL_CLASS}>
              📍 주소
            </label>
            <input
              id="address"
              name="address"
              type="text"
              defaultValue={org.address ?? ""}
              placeholder="예: 서울특별시 강남구 ..."
              className={INPUT_CLASS}
            />
          </div>

          <div>
            <label htmlFor="business_number" className={LABEL_CLASS}>
              📑 사업자등록번호
            </label>
            <input
              id="business_number"
              name="business_number"
              type="text"
              defaultValue={org.business_number ?? ""}
              placeholder="000-00-00000"
              className={`${INPUT_CLASS} font-mono`}
            />
          </div>
        </section>

        {/* 기관 규모 */}
        <section className="space-y-3 border-t border-[#E8E0D0] pt-4">
          <h2 className="flex items-center gap-1.5 text-sm font-bold text-[#2D5A3D]">
            <span>👥</span>
            <span>기관 규모</span>
          </h2>
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label htmlFor="children_count" className={LABEL_CLASS}>
                🌱 원생 수
              </label>
              <input
                id="children_count"
                name="children_count"
                type="number"
                min={0}
                defaultValue={org.children_count ?? 0}
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label htmlFor="class_count" className={LABEL_CLASS}>
                🏫 반 수
              </label>
              <input
                id="class_count"
                name="class_count"
                type="number"
                min={0}
                defaultValue={org.class_count ?? 0}
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label htmlFor="teacher_count" className={LABEL_CLASS}>
                👩‍🏫 교사 수
              </label>
              <input
                id="teacher_count"
                name="teacher_count"
                type="number"
                min={0}
                defaultValue={org.teacher_count ?? 0}
                className={INPUT_CLASS}
              />
            </div>
          </div>

          <div>
            <label htmlFor="tax_email" className={LABEL_CLASS}>
              🧾 세금계산서 이메일
            </label>
            <input
              id="tax_email"
              name="tax_email"
              type="email"
              inputMode="email"
              defaultValue={org.tax_email ?? ""}
              placeholder="tax@example.com"
              className={INPUT_CLASS}
            />
            <p className="mt-1 text-[11px] text-[#8B7F75]">
              월정산·세금계산서 발행 시 사용돼요. 비워두면 위 이메일로 발송돼요.
            </p>
          </div>
        </section>

        {/* 토리FM 브랜드 */}
        <section className="space-y-3 border-t border-[#E8E0D0] pt-4">
          <h2 className="flex items-center gap-1.5 text-sm font-bold text-[#2D5A3D]">
            <span>📻</span>
            <span>토리FM 표시명</span>
          </h2>
          <div>
            <label htmlFor="fm_brand_name" className={LABEL_CLASS}>
              우리 기관만의 라디오 이름
            </label>
            <input
              id="fm_brand_name"
              name="fm_brand_name"
              type="text"
              maxLength={30}
              defaultValue={org.fm_brand_name ?? ""}
              placeholder="예: 별밤지기"
              className={INPUT_CLASS}
            />
            <p className="mt-1 text-[11px] text-[#8B7F75]">
              참가자 화면 상단에 보여요. 비워두면 기본값{" "}
              <span className="font-semibold text-[#2D5A3D]">토리FM</span>{" "}
              으로 표시돼요. (최대 30자)
            </p>
          </div>
        </section>

        {/* 안내 */}
        <aside className="rounded-xl border border-sky-200 bg-sky-50 p-3 text-xs text-sky-900">
          <p className="font-semibold">💡 안내</p>
          <p className="mt-1">
            수수료율·계약기간·할인율 등 재무 관련 정보는 소속 지사만 수정할
            수 있어요. 필요하면 지사에 문의해 주세요.
          </p>
        </aside>

        {/* 액션 */}
        <div className="flex flex-col gap-2 border-t border-[#E8E0D0] pt-4 md:flex-row md:justify-end">
          <Link
            href={`/org/${orgId}`}
            className="inline-flex items-center justify-center rounded-xl border border-[#D4E4BC] bg-white px-4 py-2.5 text-sm font-semibold text-[#6B6560] hover:bg-[#FFF8F0]"
          >
            취소
          </Link>
          <button
            type="submit"
            className="inline-flex items-center justify-center rounded-xl bg-[#2D5A3D] px-4 py-2.5 text-sm font-bold text-white shadow hover:bg-[#3A7A52]"
          >
            💾 저장하기
          </button>
        </div>
      </form>

      {/* 계약 정보 (read-only) */}
      <section className="mt-8 space-y-3">
        <header className="px-1">
          <h2 className="flex items-center gap-1.5 text-sm font-bold text-[#2D5A3D]">
            <span>📜</span>
            <span>계약 정보</span>
          </h2>
          <p className="mt-0.5 text-[11px] text-[#8B7F75]">
            지사가 관리하는 정보예요. 수정이 필요하면 지사에 문의해 주세요.
          </p>
        </header>
        <div className="grid grid-cols-2 gap-3 rounded-2xl border border-[#E5D3B8] bg-[#FFF8F0] p-4 shadow-sm md:grid-cols-4">
          <ReadOnlyField
            label="수수료율"
            value={org.commission_rate != null ? `${org.commission_rate}%` : "—"}
          />
          <ReadOnlyField
            label="할인율"
            value={org.discount_rate ? `${org.discount_rate}%` : "없음"}
          />
          <ReadOnlyField
            label="계약 시작"
            value={org.contract_start ?? "—"}
          />
          <ReadOnlyField
            label="계약 종료"
            value={org.contract_end ?? "—"}
          />
        </div>
      </section>

      {/* 비밀번호 변경 */}
      <section className="mt-8 space-y-3">
        <header className="px-1">
          <h2 className="flex items-center gap-1.5 text-sm font-bold text-[#2D5A3D]">
            <span>🔐</span>
            <span>비밀번호 변경</span>
          </h2>
          <p className="mt-0.5 text-[11px] text-[#8B7F75]">
            주기적으로 변경하세요. 최소 6자.
          </p>
        </header>
        <form
          action={changeOrgPasswordAction}
          className="space-y-3 rounded-2xl border border-[#D4E4BC] bg-white p-5 shadow-sm md:p-6"
        >
          <div>
            <label htmlFor="current_password" className={LABEL_CLASS}>
              현재 비밀번호
            </label>
            <input
              id="current_password"
              name="current_password"
              type="password"
              required
              autoComplete="current-password"
              className={INPUT_CLASS}
            />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label htmlFor="new_password" className={LABEL_CLASS}>
                새 비밀번호
              </label>
              <input
                id="new_password"
                name="new_password"
                type="password"
                required
                minLength={6}
                autoComplete="new-password"
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label htmlFor="confirm_password" className={LABEL_CLASS}>
                새 비밀번호 확인
              </label>
              <input
                id="confirm_password"
                name="confirm_password"
                type="password"
                required
                minLength={6}
                autoComplete="new-password"
                className={INPUT_CLASS}
              />
            </div>
          </div>
          <div className="flex justify-end pt-2">
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-xl bg-[#2D5A3D] px-4 py-2.5 text-sm font-bold text-white shadow hover:bg-[#3A7A52]"
            >
              🔑 비밀번호 변경
            </button>
          </div>
        </form>
      </section>

      {/* 서류 관리 요약 */}
      <section className="mt-8 space-y-4">
        <header className="flex items-center justify-between px-1">
          <div>
            <h2 className="flex items-center gap-1.5 text-sm font-bold text-[#2D5A3D]">
              <span>📄</span>
              <span>서류 관리</span>
            </h2>
            <p className="mt-0.5 text-[11px] text-[#8B7F75]">
              세금계산서 발행·행사 운영에 필요한 서류를 제출하고 현황을 확인해요.
            </p>
          </div>
          <Link
            href={`/org/${orgId}/documents`}
            className="shrink-0 rounded-xl border border-[#D4E4BC] bg-white px-3 py-1.5 text-xs font-bold text-[#2D5A3D] hover:bg-[#E8F0E4]"
          >
            전체 관리 →
          </Link>
        </header>

        {/* 누락 알림 */}
        {docStats.missingRequired.length > 0 && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <span aria-hidden className="text-2xl">
                🚨
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-bold text-rose-900">
                  필수 서류 {docStats.missingRequired.length}건 누락 · 업로드해주세요
                </div>
                <ul className="mt-2 space-y-1.5">
                  {docStats.missingRequired.map((type: OrgDocType) => {
                    const meta = ORG_DOC_META[type];
                    return (
                      <li
                        key={type}
                        className="flex items-center justify-between gap-2 text-sm"
                      >
                        <span className="flex items-center gap-2 text-rose-800">
                          <span aria-hidden>{meta.icon}</span>
                          <span>{meta.label}</span>
                        </span>
                        <Link
                          href={`/org/${orgId}/documents/upload?type=${type}`}
                          className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-rose-300 bg-white px-2.5 py-1 text-xs font-bold text-rose-800 hover:bg-rose-100"
                        >
                          📥 업로드
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* 상태 스탯 4개 */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <DocStatCard
            label="제출"
            value={`${docStats.submitted}/${docStats.totalRequired}`}
            tone="green"
            icon="📤"
          />
          <DocStatCard
            label="승인"
            value={String(docStats.approved)}
            tone="emerald"
            icon="✅"
          />
          <DocStatCard
            label="검토중"
            value={String(docStats.pending)}
            tone="amber"
            icon="⏳"
          />
          <DocStatCard
            label="반려"
            value={String(docStats.rejected)}
            tone="rose"
            icon="❌"
          />
        </div>
      </section>

      {/* 미완료 항목 */}
      <div className="mt-8">
        <MissingList result={completeness} id="missing" />
      </div>
    </div>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] font-semibold text-[#8B6F47]">{label}</div>
      <div className="mt-0.5 text-sm font-bold text-[#6B4423]">{value}</div>
    </div>
  );
}

function DocStatCard({
  label,
  value,
  tone,
  icon,
}: {
  label: string;
  value: string;
  tone: "green" | "emerald" | "amber" | "rose";
  icon: string;
}) {
  const bg: Record<typeof tone, string> = {
    green: "border-[#D4E4BC] bg-[#E8F0E4] text-[#2D5A3D]",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-800",
    amber: "border-amber-200 bg-amber-50 text-amber-800",
    rose: "border-rose-200 bg-rose-50 text-rose-800",
  };
  return (
    <div
      className={`rounded-2xl border px-4 py-3 text-left shadow-sm ${bg[tone]}`}
    >
      <div className="flex items-center gap-1.5 text-xs font-semibold">
        <span aria-hidden>{icon}</span>
        <span>{label}</span>
      </div>
      <div className="mt-1 text-2xl font-bold">{value}</div>
    </div>
  );
}
