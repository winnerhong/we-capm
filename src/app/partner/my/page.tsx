import Link from "next/link";
import { requirePartner } from "@/lib/auth-guard";
import { createClient } from "@/lib/supabase/server";
import {
  loadDocumentStats,
  loadDocumentsPreview,
} from "@/lib/documents/queries";
import {
  DOC_TYPE_META,
  type DocStatus,
  type DocType,
} from "@/lib/documents/types";
import { loadPartnerProfileSnapshot } from "@/lib/profile-completeness/queries";
import { calcCompleteness } from "@/lib/profile-completeness/calculator";
import { PARTNER_PROFILE_SCHEMA } from "@/lib/profile-completeness/schemas/partner";
import { CompletenessCard } from "@/components/profile-completeness/CompletenessCard";
import { MissingList } from "@/components/profile-completeness/MissingList";

export const dynamic = "force-dynamic";

type PartnerDetail = {
  id: string;
  name: string;
  username: string;
  business_name: string | null;
  representative_name: string | null;
  business_number: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  bank_name: string | null;
  account_number: string | null;
  account_holder: string | null;
  tier: string;
  status: string | null;
  created_at: string;
};

async function loadPartnerDetail(id: string): Promise<PartnerDetail | null> {
  const supabase = await createClient();
  try {
    const { data } = await (
      supabase.from("partners") as unknown as {
        select: (c: string) => {
          eq: (k: string, v: string) => {
            maybeSingle: () => Promise<{ data: PartnerDetail | null }>;
          };
        };
      }
    )
      .select(
        "id,name,username,business_name,representative_name,business_number,phone,email,address,bank_name,account_number,account_holder,tier,status,created_at"
      )
      .eq("id", id)
      .maybeSingle();
    return data ?? null;
  } catch {
    return null;
  }
}

function getInitial(name: string): string {
  const trimmed = name.trim();
  return trimmed ? trimmed.charAt(0) : "🌿";
}

export default async function PartnerMyPage() {
  const session = await requirePartner();
  const [detail, docStats, docPreview, profileSnap] = await Promise.all([
    loadPartnerDetail(session.id),
    loadDocumentStats(session.id),
    loadDocumentsPreview(session.id),
    loadPartnerProfileSnapshot(session.id),
  ]);

  const displayName = detail?.business_name ?? detail?.name ?? session.name;
  const initial = getInitial(displayName);
  const completeness = calcCompleteness(PARTNER_PROFILE_SCHEMA, profileSnap);

  return (
    <div className="mx-auto max-w-2xl space-y-4 pb-6">
      {/* Hero: 프로필 헤더 */}
      <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-[#2D5A3D] via-[#3A7A52] to-[#4A7C59] shadow-lg">
        <div className="flex items-center gap-4 p-6">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-white/20 text-2xl font-bold text-white backdrop-blur-sm">
            {initial}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-xl font-bold text-white md:text-2xl">
              {displayName}님
            </h1>
            <p className="mt-0.5 text-sm text-[#D4E4BC]">
              {detail?.username ?? session.username} · 숲지기(지사)
            </p>
          </div>
          <Link
            href="/partner/dashboard"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-sm transition hover:bg-white/20"
            aria-label="닫기"
          >
            ✕
          </Link>
        </div>
      </section>

      {/* 프로필 완성도 카드 */}
      <CompletenessCard result={completeness} missingAnchor="#missing" />

      {/* 회사 정보 */}
      <section className="space-y-3">
        <div className="flex items-center justify-between px-2">
          <h2 className="text-sm font-semibold text-[#6B6560]">회사 정보</h2>
          <Link
            href="/partner/my/edit"
            className="text-xs font-semibold text-[#2D5A3D] hover:underline"
          >
            수정하기 →
          </Link>
        </div>
        <dl className="space-y-0 overflow-hidden rounded-2xl border border-[#D4E4BC] bg-[#FFF8F0]">
          <InfoRow label="회사명" value={detail?.business_name ?? "-"} first />
          <InfoRow label="대표자" value={detail?.representative_name ?? detail?.name ?? "-"} />
          <InfoRow label="사업자번호" value={detail?.business_number ?? "-"} mono />
          <InfoRow label="연락처" value={detail?.phone ?? "-"} mono />
          <InfoRow label="주소" value={detail?.address ?? "-"} multiline last />
        </dl>
      </section>

      {/* 📄 서류 현황 */}
      <section className="space-y-3">
        <div className="flex items-center justify-between px-2">
          <h2 className="text-sm font-semibold text-[#6B6560]">📄 서류 현황</h2>
          <Link
            href="/partner/settings/documents"
            className="text-xs font-semibold text-[#2D5A3D] hover:underline"
          >
            📂 전체 관리 →
          </Link>
        </div>
        <div className="space-y-3 rounded-2xl border border-[#D4E4BC] bg-white p-4 shadow-sm">
          {/* 4 미니 통계 */}
          <div className="grid grid-cols-4 gap-2">
            <MiniStat
              label="제출"
              value={`${docStats.submitted}/9`}
              tone="green"
            />
            <MiniStat
              label="승인"
              value={String(docStats.approved)}
              tone="emerald"
            />
            <MiniStat
              label="검토"
              value={String(docStats.pending)}
              tone="amber"
            />
            <MiniStat
              label="반려"
              value={String(docStats.rejected)}
              tone="rose"
            />
          </div>

          {/* 반려 경고 */}
          {docStats.rejected > 0 && (
            <Link
              href="/partner/settings/documents"
              className="flex items-center justify-between gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-900 transition hover:bg-rose-100"
            >
              <span>
                ⚠️ 반려된 서류 {docStats.rejected}건 · 즉시 재제출이 필요해요
              </span>
              <span aria-hidden>→</span>
            </Link>
          )}

          {/* 주요 서류 (계약 전 필수) 4종 */}
          <div>
            <p className="mb-2 text-[11px] font-semibold text-[#8B7F75]">
              주요 서류 (계약 전 필수)
            </p>
            <div className="grid grid-cols-2 gap-2">
              {docPreview.map((d) => (
                <DocPreviewCard
                  key={d.doc_type}
                  docType={d.doc_type}
                  status={d.status}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 정산 계좌 */}
      <section className="space-y-3">
        <div className="flex items-center justify-between px-2">
          <h2 className="text-sm font-semibold text-[#6B6560]">정산 계좌</h2>
          <Link
            href="/partner/my/edit#bank"
            className="text-xs font-semibold text-[#2D5A3D] hover:underline"
          >
            수정하기 →
          </Link>
        </div>
        <dl className="space-y-0 overflow-hidden rounded-2xl border border-[#D4E4BC] bg-[#FFF8F0]">
          <InfoRow label="은행" value={detail?.bank_name ?? "-"} first />
          <InfoRow label="계좌번호" value={detail?.account_number ?? "-"} mono />
          <InfoRow label="예금주" value={detail?.account_holder ?? "-"} last />
        </dl>
      </section>

      {/* 관리자 계정 */}
      <section className="space-y-3">
        <h2 className="px-2 text-sm font-semibold text-[#6B6560]">관리자 계정</h2>
        <dl className="space-y-0 overflow-hidden rounded-2xl border border-[#D4E4BC] bg-[#FFF8F0]">
          <InfoRow
            label="아이디"
            value={detail?.username ?? session.username}
            mono
            first
            last
          />
        </dl>
      </section>

      {/* 미완료 항목 리스트 (anchor: #missing) */}
      <MissingList result={completeness} id="missing" />

      {/* Action 버튼 */}
      <div className="space-y-2 pt-2">
        <Link
          href="/partner/settings"
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-[#D4E4BC] bg-white px-4 py-3.5 text-sm font-bold text-[#2D5A3D] shadow-sm transition hover:bg-[#F5F1E8]"
        >
          <span>🔒</span>
          <span>비밀번호 변경</span>
        </Link>
        <form action="/api/auth/partner-logout" method="post">
          <button
            type="submit"
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-rose-200 bg-white px-4 py-3.5 text-sm font-bold text-rose-700 shadow-sm transition hover:bg-rose-50"
          >
            <span>🚪</span>
            <span>로그아웃</span>
          </button>
        </form>
      </div>
    </div>
  );
}

function MiniStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "green" | "emerald" | "amber" | "rose";
}) {
  const bg: Record<typeof tone, string> = {
    green: "border-[#D4E4BC] bg-[#E8F0E4]",
    emerald: "border-emerald-200 bg-emerald-50",
    amber: "border-amber-200 bg-amber-50",
    rose: "border-rose-200 bg-rose-50",
  };
  const text: Record<typeof tone, string> = {
    green: "text-[#2D5A3D]",
    emerald: "text-emerald-800",
    amber: "text-amber-800",
    rose: "text-rose-800",
  };
  return (
    <div className={`rounded-xl border px-2 py-2 text-center ${bg[tone]}`}>
      <div className={`text-[10px] font-semibold ${text[tone]}`}>{label}</div>
      <div className={`mt-0.5 text-base font-bold ${text[tone]}`}>{value}</div>
    </div>
  );
}

function DocPreviewCard({
  docType,
  status,
}: {
  docType: DocType;
  status: DocStatus | null;
}) {
  const meta = DOC_TYPE_META[docType];

  let badgeClass = "";
  let badgeLabel = "";
  let cardClass = "border-[#D4E4BC] bg-[#FFF8F0]";
  if (status === null) {
    badgeClass = "border-dashed border-[#D4E4BC] bg-white text-[#8B7F75]";
    badgeLabel = "📤 미제출";
    cardClass = "border-dashed border-[#D4E4BC] bg-white";
  } else if (status === "PENDING") {
    badgeClass = "border-amber-200 bg-amber-50 text-amber-800";
    badgeLabel = "⏳ 검토중";
  } else if (status === "APPROVED") {
    badgeClass = "border-emerald-200 bg-emerald-50 text-emerald-800";
    badgeLabel = "✅ 승인";
  } else if (status === "REJECTED") {
    badgeClass = "border-rose-200 bg-rose-50 text-rose-800";
    badgeLabel = "❌ 반려";
    cardClass = "border-rose-200 bg-rose-50/40";
  } else if (status === "EXPIRED") {
    badgeClass = "border-zinc-300 bg-zinc-100 text-zinc-600";
    badgeLabel = "⚰️ 만료";
  }

  return (
    <Link
      href={`/partner/settings/documents/upload?type=${docType}`}
      className={`flex flex-col gap-1.5 rounded-xl border p-3 transition hover:bg-[#E8F0E4] ${cardClass}`}
    >
      <div className="flex items-center gap-1.5">
        <span className="text-base" aria-hidden>
          {meta.icon}
        </span>
        <span className="truncate text-xs font-semibold text-[#2D5A3D]">
          {meta.label}
        </span>
      </div>
      <span
        className={`inline-flex w-fit items-center rounded-md border px-1.5 py-0.5 text-[10px] font-semibold ${badgeClass}`}
      >
        {badgeLabel}
      </span>
    </Link>
  );
}

function InfoRow({
  label,
  value,
  mono,
  multiline,
  first,
  last,
}: {
  label: string;
  value: string;
  mono?: boolean;
  multiline?: boolean;
  first?: boolean;
  last?: boolean;
}) {
  return (
    <div
      className={`flex ${multiline ? "items-start" : "items-center"} justify-between gap-3 px-4 py-3 ${
        !first ? "border-t border-[#E8E0D0]" : ""
      } ${last ? "" : ""}`}
    >
      <dt className="shrink-0 text-xs text-[#8B7F75]">{label}</dt>
      <dd
        className={`text-right text-sm font-semibold text-[#2C2C2C] ${
          mono ? "font-mono tracking-tight" : ""
        } ${multiline ? "whitespace-pre-wrap leading-relaxed" : ""}`}
      >
        {value}
      </dd>
    </div>
  );
}
