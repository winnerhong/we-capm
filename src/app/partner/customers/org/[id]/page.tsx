import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePartner } from "@/lib/auth-guard";
import { createClient } from "@/lib/supabase/server";
import { deleteOrgAction } from "../actions";
import {
  ORG_STATUS_META,
  ORG_TYPE_META,
  daysUntil,
  formatDate,
  formatPhone,
  type OrgRow,
} from "../meta";
import { CopyButton } from "./copy-button";
import { WelcomeToast } from "./welcome-toast";

export const dynamic = "force-dynamic";

type TabId =
  | "info"
  | "events"
  | "billing"
  | "contacts"
  | "docs"
  | "messages"
  | "memo";

const TABS: Array<{ id: TabId; label: string; icon: string }> = [
  { id: "info", label: "기본정보", icon: "📋" },
  { id: "events", label: "행사이력", icon: "🎪" },
  { id: "billing", label: "결제", icon: "💳" },
  { id: "contacts", label: "담당자", icon: "👤" },
  { id: "docs", label: "서류", icon: "📄" },
  { id: "messages", label: "메시지", icon: "💬" },
  { id: "memo", label: "메모", icon: "📝" },
];

const COLUMNS =
  "id,partner_id,org_name,org_type,representative_name,representative_phone,email,address,children_count,class_count,teacher_count,business_number,tax_email,commission_rate,discount_rate,contract_start,contract_end,tags,internal_memo,auto_username,status,created_at";

async function loadOrg(id: string): Promise<OrgRow | null> {
  const supabase = await createClient();

  const sb = supabase as unknown as {
    from: (t: string) => {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          maybeSingle: () => Promise<{ data: OrgRow | null; error: unknown }>;
        };
      };
    };
  };

  try {
    const { data, error } = await sb
      .from("partner_orgs")
      .select(COLUMNS)
      .eq("id", id)
      .maybeSingle();
    if (error) {
      console.error("[partner/customers/org/detail] load error", error);
      return null;
    }
    return data;
  } catch (e) {
    console.error("[partner/customers/org/detail] throw", e);
    return null;
  }
}

export default async function OrgDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    tab?: string;
    welcome?: string;
    username?: string;
    password?: string;
  }>;
}) {
  await requirePartner();
  const { id } = await params;
  const sp = await searchParams;
  const org = await loadOrg(id);
  if (!org) notFound();

  const activeTab: TabId = (TABS.find((t) => t.id === sp.tab)?.id ?? "info");
  const typeMeta = ORG_TYPE_META[org.org_type] ?? ORG_TYPE_META.OTHER;
  const statusMeta = ORG_STATUS_META[org.status];
  const daysLeft = daysUntil(org.contract_end);

  const showWelcome =
    sp.welcome === "1" && sp.username && sp.password
      ? { username: sp.username, password: sp.password }
      : null;

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav aria-label="breadcrumb" className="text-xs text-[#8B7F75]">
        <Link href="/partner/dashboard" className="hover:text-[#2D5A3D]">
          대시보드
        </Link>
        <span className="mx-2">/</span>
        <Link href="/partner/customers/org" className="hover:text-[#2D5A3D]">
          기관 고객
        </Link>
        <span className="mx-2">/</span>
        <span className="font-semibold text-[#2D5A3D]">{org.org_name}</span>
      </nav>

      {/* Header */}
      <header className="rounded-3xl border border-[#D4E4BC] bg-gradient-to-br from-[#E8F0E4] via-white to-sky-50 p-5 shadow-sm md:p-7">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="flex items-start gap-3 min-w-0">
            <span className="text-3xl" aria-hidden>
              {typeMeta.icon}
            </span>
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
                {daysLeft !== null && daysLeft >= 0 && daysLeft <= 30 && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                    ⏰ 계약 {daysLeft}일 남음
                  </span>
                )}
              </div>
              <h1 className="mt-1 truncate text-xl font-bold text-[#2D5A3D] md:text-2xl">
                {org.org_name}
              </h1>
              <p className="mt-0.5 text-xs text-[#6B6560]">
                {org.representative_name ?? "담당자 미지정"} ·{" "}
                {formatPhone(org.representative_phone)} · 등록{" "}
                {formatDate(org.created_at)}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/partner/customers/org/${org.id}/edit`}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#E5D3B8] bg-white px-3.5 py-2 text-xs font-semibold text-[#6B4423] hover:bg-[#FFF8F0]"
            >
              ✏️ 편집
            </Link>
            <button
              type="button"
              disabled
              title="대리 로그인 기능은 곧 제공됩니다"
              className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-xl border border-[#D4E4BC] bg-[#F5F1E8] px-3.5 py-2 text-xs font-semibold text-[#8B7F75]"
            >
              🔓 대리 로그인
            </button>
            {org.status !== "CLOSED" && (
              <form
                action={async () => {
                  "use server";
                  await deleteOrgAction(org.id);
                }}
              >
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-white px-3.5 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50"
                >
                  🗑️ 해지
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Summary chips */}
        <div className="mt-5 grid grid-cols-2 gap-2 md:grid-cols-4">
          <SummaryChip
            label="아동"
            value={`${org.children_count.toLocaleString("ko-KR")}명`}
          />
          <SummaryChip label="반" value={`${org.class_count}반`} />
          <SummaryChip label="교사" value={`${org.teacher_count}명`} />
          <SummaryChip
            label="수수료율"
            value={`${org.commission_rate}%`}
          />
        </div>
      </header>

      {/* Tabs */}
      <nav
        aria-label="기관 상세 탭"
        className="flex items-center gap-1 overflow-x-auto border-b border-[#D4E4BC] pb-1"
      >
        {TABS.map((t) => {
          const selected = t.id === activeTab;
          return (
            <Link
              key={t.id}
              href={`/partner/customers/org/${org.id}?tab=${t.id}`}
              className={`flex items-center gap-1 whitespace-nowrap rounded-t-lg border-b-2 px-3 py-2 text-xs font-semibold transition-colors ${
                selected
                  ? "border-[#2D5A3D] bg-[#E8F0E4] text-[#2D5A3D]"
                  : "border-transparent text-[#6B6560] hover:bg-[#FFF8F0]"
              }`}
              aria-current={selected ? "page" : undefined}
            >
              <span aria-hidden>{t.icon}</span>
              <span>{t.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Tab panels */}
      {activeTab === "info" && <InfoTab org={org} />}
      {activeTab === "events" && <StubTab title="행사 이력" desc="이 기관의 예약·행사 진행 기록이 여기 표시됩니다." icon="🎪" />}
      {activeTab === "billing" && (
        <StubTab
          title="결제 내역"
          desc="청구서와 결제 기록은 결제 관리 메뉴에서 동기화됩니다."
          icon="💳"
          ctaLabel="받은 청구서로 이동"
          ctaHref="/partner/billing/invoices"
        />
      )}
      {activeTab === "contacts" && <StubTab title="담당자 관리" desc="추가 담당자를 등록할 수 있어요. 곧 오픈 예정." icon="👤" />}
      {activeTab === "docs" && <StubTab title="서류" desc="계약서·업무위탁서 PDF 업로드 기능은 준비 중입니다." icon="📄" />}
      {activeTab === "messages" && <StubTab title="메시지" desc="SMS·알림톡 발송 이력과 템플릿 관리가 여기 표시됩니다." icon="💬" />}
      {activeTab === "memo" && <MemoTab memo={org.internal_memo} />}

      {showWelcome && (
        <WelcomeToast
          username={showWelcome.username!}
          password={showWelcome.password!}
        />
      )}
    </div>
  );
}

function SummaryChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[#D4E4BC] bg-white px-3 py-2.5">
      <p className="text-[10px] font-semibold text-[#8B7F75]">{label}</p>
      <p className="mt-0.5 text-base font-extrabold text-[#2D5A3D]">{value}</p>
    </div>
  );
}

function InfoTab({ org }: { org: OrgRow }) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <Panel title="기본 정보" icon="📋">
        <Field label="기관명" value={org.org_name} />
        <Field
          label="유형"
          value={`${ORG_TYPE_META[org.org_type]?.icon ?? "🏢"} ${
            ORG_TYPE_META[org.org_type]?.label ?? "기타"
          }`}
        />
        <Field label="이메일" value={org.email ?? "-"} />
        <Field label="주소" value={org.address ?? "-"} />
        {org.tags && org.tags.length > 0 && (
          <Field
            label="태그"
            value={
              <div className="mt-1 flex flex-wrap gap-1">
                {org.tags.map((t) => (
                  <span
                    key={t}
                    className="rounded-full bg-[#F5F1E8] px-2 py-0.5 text-[10px] font-semibold text-[#6B6560]"
                  >
                    #{t}
                  </span>
                ))}
              </div>
            }
          />
        )}
      </Panel>

      <Panel title="담당자" icon="👤">
        <Field label="담당자 이름" value={org.representative_name ?? "-"} />
        <Field
          label="담당자 연락처"
          value={
            <span className="font-mono">
              {formatPhone(org.representative_phone)}
            </span>
          }
        />
      </Panel>

      <Panel title="규모" icon="👥">
        <Field
          label="아동 수"
          value={`${org.children_count.toLocaleString("ko-KR")}명`}
        />
        <Field label="반 수" value={`${org.class_count}반`} />
        <Field label="교사 수" value={`${org.teacher_count}명`} />
      </Panel>

      <Panel title="사업자" icon="🧾">
        <Field label="사업자등록번호" value={org.business_number ?? "-"} />
        <Field label="세금계산서 이메일" value={org.tax_email ?? "-"} />
      </Panel>

      <Panel title="계약" icon="📜">
        <Field label="수수료율" value={`${org.commission_rate}%`} />
        <Field label="할인율" value={`${org.discount_rate}%`} />
        <Field label="계약 시작" value={formatDate(org.contract_start)} />
        <Field label="계약 종료" value={formatDate(org.contract_end)} />
      </Panel>

      <Panel title="자동 발급 계정" icon="🔐">
        {org.auto_username ? (
          <div className="rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold text-[#8B7F75]">
                  아이디
                </p>
                <p className="truncate font-mono text-xs font-bold text-[#2D5A3D]">
                  {org.auto_username}
                </p>
              </div>
              <CopyButton text={org.auto_username} label="복사" />
            </div>
            <p className="mt-2 text-[11px] text-[#8B7F75]">
              비밀번호는 저장되지 않아 재발급이 필요해요.
            </p>
          </div>
        ) : (
          <p className="text-xs text-[#8B7F75]">계정이 아직 발급되지 않았어요.</p>
        )}
      </Panel>
    </div>
  );
}

function MemoTab({ memo }: { memo: string | null }) {
  return (
    <Panel title="내부 메모" icon="📝">
      {memo ? (
        <p className="whitespace-pre-wrap text-sm leading-6 text-[#2C2C2C]">
          {memo}
        </p>
      ) : (
        <p className="text-xs text-[#8B7F75]">아직 작성된 메모가 없어요.</p>
      )}
    </Panel>
  );
}

function StubTab({
  title,
  desc,
  icon,
  ctaLabel,
  ctaHref,
}: {
  title: string;
  desc: string;
  icon: string;
  ctaLabel?: string;
  ctaHref?: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-[#D4E4BC] bg-white p-10 text-center">
      <div className="text-5xl" aria-hidden>
        {icon}
      </div>
      <p className="mt-3 text-sm font-semibold text-[#2D5A3D]">{title}</p>
      <p className="mt-1 text-xs text-[#6B6560]">{desc}</p>
      {ctaLabel && ctaHref && (
        <Link
          href={ctaHref}
          className="mt-4 inline-flex items-center gap-1.5 rounded-xl border border-[#D4E4BC] bg-white px-3.5 py-2 text-xs font-semibold text-[#2D5A3D] hover:bg-[#E8F0E4]"
        >
          {ctaLabel} →
        </Link>
      )}
    </div>
  );
}

function Panel({
  title,
  icon,
  children,
}: {
  title: string;
  icon: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-[#D4E4BC] bg-white p-5 shadow-sm">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-[#2D5A3D]">
        <span aria-hidden>{icon}</span>
        <span>{title}</span>
      </h2>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function Field({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-[#F0E8D8] py-2 last:border-0">
      <dt className="text-xs font-semibold text-[#8B7F75]">{label}</dt>
      <dd className="text-right text-sm text-[#2C2C2C]">{value}</dd>
    </div>
  );
}
