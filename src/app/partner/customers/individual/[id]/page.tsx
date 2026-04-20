import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requirePartner } from "@/lib/auth-guard";
import {
  deleteCustomerAction,
  updateTierAction,
  type CustomerStatus,
  type CustomerTier,
} from "../actions";

type Child = { name: string; age: number | null };

type Customer = {
  id: string;
  partner_id: string;
  parent_name: string;
  parent_phone: string;
  email: string | null;
  address: string | null;
  children: Child[] | null;
  interests: string[] | null;
  marketing_sms: boolean;
  marketing_email: boolean;
  marketing_kakao: boolean;
  source: string | null;
  total_events: number;
  total_spent: number;
  last_visit_at: string | null;
  ltv: number;
  retention_score: number | null;
  tier: CustomerTier;
  tags: string[] | null;
  memo: string | null;
  auto_username: string | null;
  first_login_at: string | null;
  status: CustomerStatus;
  created_at: string;
};

const TIER_META: Record<
  CustomerTier,
  { label: string; icon: string; badge: string; gradient: string }
> = {
  SPROUT: {
    label: "새싹",
    icon: "🌱",
    badge: "border-emerald-300 bg-emerald-50 text-emerald-900",
    gradient: "from-emerald-100 via-white to-[#FAE7D0]",
  },
  EXPLORER: {
    label: "탐험가",
    icon: "🌿",
    badge: "border-lime-300 bg-lime-50 text-lime-900",
    gradient: "from-lime-100 via-white to-[#FAE7D0]",
  },
  TREE: {
    label: "나무",
    icon: "🌳",
    badge: "border-teal-300 bg-teal-50 text-teal-900",
    gradient: "from-teal-100 via-white to-[#FAE7D0]",
  },
  FOREST: {
    label: "숲 (VIP)",
    icon: "🏞️",
    badge: "border-[#2D5A3D] bg-[#2D5A3D] text-white",
    gradient: "from-[#E8F0E4] via-white to-[#C4956A]/30",
  },
};

const STATUS_META: Record<CustomerStatus, { label: string; chip: string }> = {
  ACTIVE: {
    label: "활성",
    chip: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  INACTIVE: {
    label: "비활성",
    chip: "border-zinc-200 bg-zinc-50 text-zinc-700",
  },
  DORMANT: {
    label: "휴면",
    chip: "border-amber-200 bg-amber-50 text-amber-700",
  },
  CHURNED: {
    label: "이탈",
    chip: "border-rose-200 bg-rose-50 text-rose-700",
  },
};

function formatWon(n: number | null | undefined): string {
  if (n === null || n === undefined) return "-";
  return `${n.toLocaleString("ko-KR")}원`;
}

function formatDateTime(iso: string | null): string {
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
    return "-";
  }
}

function formatDate(iso: string | null): string {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleDateString("ko-KR", {
      year: "2-digit",
      month: "2-digit",
      day: "2-digit",
    });
  } catch {
    return "-";
  }
}

async function loadCustomer(id: string, partnerId: string): Promise<Customer | null> {
  const supabase = await createClient();
  const columns =
    "id,partner_id,parent_name,parent_phone,email,address,children,interests,marketing_sms,marketing_email,marketing_kakao,source,total_events,total_spent,last_visit_at,ltv,retention_score,tier,tags,memo,auto_username,first_login_at,status,created_at";
  const { data, error } = await supabase
    .from("partner_customers")
    .select(columns)
    .eq("id", id)
    .eq("partner_id", partnerId)
    .maybeSingle();

  if (error) {
    console.error("[partner/customers/individual/[id]] load error", error);
    return null;
  }
  return (data ?? null) as unknown as Customer | null;
}

type TimelineItem = { at: string; title: string; desc?: string; icon: string };

function buildTimeline(c: Customer): TimelineItem[] {
  const items: TimelineItem[] = [];
  if (c.created_at) {
    items.push({
      at: c.created_at,
      title: "고객 등록",
      desc: "자동 계정이 생성되고 안내 SMS가 발송되었어요.",
      icon: "📝",
    });
  }
  if (c.first_login_at) {
    items.push({
      at: c.first_login_at,
      title: "첫 로그인",
      desc: "비밀번호 변경 후 첫 접속이 확인되었어요.",
      icon: "🔓",
    });
  }
  if (c.last_visit_at) {
    items.push({
      at: c.last_visit_at,
      title: "최근 방문",
      desc: "오프라인 행사에 참여했어요.",
      icon: "⛺",
    });
  }
  return items.sort((a, b) => (a.at < b.at ? 1 : -1));
}

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const partner = await requirePartner();
  const { id } = await params;
  const c = await loadCustomer(id, partner.id);
  if (!c) notFound();

  const tier = TIER_META[c.tier] ?? TIER_META.SPROUT;
  const status = STATUS_META[c.status] ?? STATUS_META.ACTIVE;
  const children = c.children ?? [];
  const interests = c.interests ?? [];
  const timeline = buildTimeline(c);

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav aria-label="breadcrumb" className="text-xs text-[#8B7F75]">
        <Link href="/partner/dashboard" className="hover:text-[#2D5A3D]">
          대시보드
        </Link>
        <span className="mx-2">/</span>
        <Link href="/partner/customers/individual" className="hover:text-[#2D5A3D]">
          개인 고객
        </Link>
        <span className="mx-2">/</span>
        <span className="font-semibold text-[#2D5A3D]">{c.parent_name}</span>
      </nav>

      {/* VIP Hero */}
      <header
        className={`rounded-3xl border border-[#D4E4BC] bg-gradient-to-br ${tier.gradient} p-5 shadow-sm md:p-7`}
      >
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white text-3xl shadow-md md:h-20 md:w-20 md:text-4xl">
              <span aria-hidden>👨‍👩‍👧</span>
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-bold text-[#2D5A3D] md:text-2xl">
                  {c.parent_name}
                </h1>
                <span
                  className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-bold ${tier.badge}`}
                >
                  <span aria-hidden>{tier.icon}</span>
                  VIP {tier.label}
                </span>
                <span
                  className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${status.chip}`}
                >
                  {status.label}
                </span>
              </div>
              <p className="mt-1 text-xs text-[#6B6560] md:text-sm">
                {c.parent_phone}
                {c.email ? ` · ${c.email}` : ""}
              </p>
              {c.address ? (
                <p className="mt-0.5 text-[11px] text-[#8B7F75] md:text-xs">
                  📍 {c.address}
                </p>
              ) : null}
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/partner/customers/individual/${c.id}/impersonate`}
              className="inline-flex items-center gap-1 rounded-lg border border-[#E5D3B8] bg-white px-3 py-2 text-xs font-bold text-[#6B4423] hover:bg-[#FFF8F0]"
            >
              <span aria-hidden>🔓</span>
              대리 로그인
            </Link>
            <Link
              href={`/partner/customers/individual/${c.id}/edit`}
              className="inline-flex items-center gap-1 rounded-lg border border-[#D4E4BC] bg-white px-3 py-2 text-xs font-bold text-[#2D5A3D] hover:bg-[#E8F0E4]"
            >
              <span aria-hidden>✏️</span>
              편집
            </Link>
            <Link
              href={`/partner/customers/individual/${c.id}/message`}
              className="inline-flex items-center gap-1 rounded-lg bg-[#2D5A3D] px-3 py-2 text-xs font-bold text-white hover:bg-[#234a30]"
            >
              <span aria-hidden>💬</span>
              메시지
            </Link>
            <form
              action={async () => {
                "use server";
                await deleteCustomerAction(c.id);
              }}
            >
              <button
                type="submit"
                className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-white px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-50"
              >
                <span aria-hidden>🗑️</span>
                해지
              </button>
            </form>
          </div>
        </div>
      </header>

      {/* Stat cards */}
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard icon="💰" label="LTV" value={formatWon(c.ltv)} tone="amber" />
        <StatCard
          icon="📅"
          label="총 방문"
          value={`${c.total_events.toLocaleString("ko-KR")}회`}
          tone="forest"
        />
        <StatCard
          icon="⭐"
          label="재방문 지수"
          value={
            c.retention_score === null
              ? "-"
              : `${Number(c.retention_score).toFixed(1)} / 5`
          }
          tone="rose"
        />
        <StatCard
          icon="🌰"
          label="누적 도토리"
          value={`${Math.floor(c.total_spent / 100).toLocaleString("ko-KR")}개`}
          tone="sky"
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* 좌측 2열 */}
        <div className="space-y-6 lg:col-span-2">
          {/* 가족 구성 */}
          <section className="rounded-2xl border border-[#D4E4BC] bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-[#2D5A3D]">
                <span className="mr-1.5" aria-hidden>
                  👶
                </span>
                가족 구성
              </h2>
              <span className="rounded-full bg-[#FAE7D0] px-2 py-0.5 text-[11px] font-bold text-[#6B4423]">
                아이 {children.length}명
              </span>
            </div>
            {children.length === 0 ? (
              <p className="mt-3 text-xs text-[#8B7F75]">등록된 아이 정보가 없어요.</p>
            ) : (
              <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                {children.map((child, i) => (
                  <li
                    key={`${child.name}-${i}`}
                    className="flex items-center gap-3 rounded-xl border border-[#F4EFE8] bg-[#FFF8F0] px-3 py-2.5"
                  >
                    <span
                      className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-lg"
                      aria-hidden
                    >
                      👶
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-[#2D5A3D]">
                        {child.name}
                      </p>
                      <p className="text-[11px] text-[#6B6560]">
                        {child.age !== null ? `만 ${child.age}세` : "나이 미입력"}
                      </p>
                    </div>
                    {child.age !== null ? (
                      <span className="rounded-full border border-[#D4E4BC] bg-[#E8F0E4] px-2 py-0.5 text-[10px] font-bold text-[#2D5A3D]">
                        {child.age}세
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* 관심사 태그 */}
          <section className="rounded-2xl border border-[#D4E4BC] bg-white p-5 shadow-sm">
            <h2 className="text-sm font-bold text-[#2D5A3D]">
              <span className="mr-1.5" aria-hidden>
                🌿
              </span>
              관심사 태그
            </h2>
            {interests.length === 0 ? (
              <p className="mt-3 text-xs text-[#8B7F75]">등록된 관심사가 없어요.</p>
            ) : (
              <div className="mt-3 flex flex-wrap gap-2">
                {interests.map((t) => (
                  <span
                    key={t}
                    className="inline-flex items-center rounded-full border border-[#D4E4BC] bg-[#E8F0E4] px-2.5 py-1 text-[11px] font-semibold text-[#2D5A3D]"
                  >
                    # {t}
                  </span>
                ))}
              </div>
            )}
          </section>

          {/* 최근 활동 타임라인 */}
          <section className="rounded-2xl border border-[#D4E4BC] bg-white p-5 shadow-sm">
            <h2 className="text-sm font-bold text-[#2D5A3D]">
              <span className="mr-1.5" aria-hidden>
                ⏱️
              </span>
              최근 활동
            </h2>
            {timeline.length === 0 ? (
              <p className="mt-3 text-xs text-[#8B7F75]">활동 이력이 없어요.</p>
            ) : (
              <ol className="mt-4 space-y-4">
                {timeline.map((item, i) => (
                  <li key={i} className="relative pl-8">
                    <span
                      className="absolute left-0 top-0 flex h-6 w-6 items-center justify-center rounded-full bg-[#E8F0E4] text-sm ring-2 ring-white"
                      aria-hidden
                    >
                      {item.icon}
                    </span>
                    {i < timeline.length - 1 ? (
                      <span
                        className="absolute left-[11px] top-6 h-[calc(100%+4px)] w-px bg-[#D4E4BC]"
                        aria-hidden
                      />
                    ) : null}
                    <p className="text-sm font-semibold text-[#2D5A3D]">
                      {item.title}
                    </p>
                    {item.desc ? (
                      <p className="mt-0.5 text-xs text-[#6B6560]">{item.desc}</p>
                    ) : null}
                    <p className="mt-0.5 text-[11px] text-[#8B7F75]">
                      {formatDateTime(item.at)}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </section>

          {/* 행사 이력 */}
          <section className="rounded-2xl border border-[#D4E4BC] bg-white p-5 shadow-sm">
            <h2 className="text-sm font-bold text-[#2D5A3D]">
              <span className="mr-1.5" aria-hidden>
                🗺️
              </span>
              행사 이력
            </h2>
            <p className="mt-3 text-xs text-[#8B7F75]">
              연결된 행사 이력이 표시될 자리예요. (총 {c.total_events.toLocaleString("ko-KR")}회 참여
              · 최근 방문 {formatDate(c.last_visit_at)})
            </p>
          </section>

          {/* 결제 내역 */}
          <section className="rounded-2xl border border-[#D4E4BC] bg-white p-5 shadow-sm">
            <h2 className="text-sm font-bold text-[#2D5A3D]">
              <span className="mr-1.5" aria-hidden>
                💳
              </span>
              결제 내역
            </h2>
            <p className="mt-3 text-xs text-[#8B7F75]">
              누적 결제 {formatWon(c.total_spent)} · 상세 내역은 결제 모듈 연동 후 표시돼요.
            </p>
          </section>
        </div>

        {/* 우측 1열 */}
        <aside className="space-y-6">
          {/* 티어 변경 */}
          <section className="rounded-2xl border border-[#D4E4BC] bg-white p-5 shadow-sm">
            <h2 className="text-sm font-bold text-[#2D5A3D]">
              <span className="mr-1.5" aria-hidden>
                🏅
              </span>
              티어 조정
            </h2>
            <p className="mt-1 text-[11px] text-[#6B6560]">
              LTV와 방문 이력을 고려해 수동 조정할 수 있어요.
            </p>
            <ul className="mt-3 grid grid-cols-2 gap-2">
              {(Object.keys(TIER_META) as CustomerTier[]).map((t) => {
                const meta = TIER_META[t];
                const active = c.tier === t;
                return (
                  <li key={t}>
                    <form
                      action={async () => {
                        "use server";
                        await updateTierAction(c.id, t);
                      }}
                    >
                      <button
                        type="submit"
                        aria-pressed={active}
                        className={`w-full rounded-lg border px-2 py-2 text-xs font-bold transition ${
                          active
                            ? "border-[#2D5A3D] bg-[#2D5A3D] text-white shadow"
                            : "border-[#E5D3B8] bg-white text-[#6B4423] hover:bg-[#FFF8F0]"
                        }`}
                      >
                        <span className="mr-1" aria-hidden>
                          {meta.icon}
                        </span>
                        {meta.label}
                      </button>
                    </form>
                  </li>
                );
              })}
            </ul>
          </section>

          {/* 계정 정보 */}
          <section className="rounded-2xl border border-[#D4E4BC] bg-white p-5 shadow-sm">
            <h2 className="text-sm font-bold text-[#2D5A3D]">
              <span className="mr-1.5" aria-hidden>
                🔑
              </span>
              자동 생성 계정
            </h2>
            <dl className="mt-3 space-y-2 text-xs">
              <Row label="아이디" value={c.auto_username ?? "-"} mono />
              <Row label="첫 로그인" value={formatDateTime(c.first_login_at)} />
              <Row label="가입일" value={formatDate(c.created_at)} />
            </dl>
          </section>

          {/* 수신 동의 상태 */}
          <section className="rounded-2xl border border-[#D4E4BC] bg-white p-5 shadow-sm">
            <h2 className="text-sm font-bold text-[#2D5A3D]">
              <span className="mr-1.5" aria-hidden>
                📬
              </span>
              마케팅 수신
            </h2>
            <ul className="mt-3 space-y-1.5 text-xs">
              <ConsentRow label="SMS" on={c.marketing_sms} />
              <ConsentRow label="이메일" on={c.marketing_email} />
              <ConsentRow label="카카오톡" on={c.marketing_kakao} />
            </ul>
            {c.source ? (
              <p className="mt-3 text-[11px] text-[#8B7F75]">
                유입 경로: <span className="font-semibold text-[#6B4423]">{c.source}</span>
              </p>
            ) : null}
          </section>

          {c.memo ? (
            <section className="rounded-2xl border border-[#D4E4BC] bg-white p-5 shadow-sm">
              <h2 className="text-sm font-bold text-[#2D5A3D]">
                <span className="mr-1.5" aria-hidden>
                  📝
                </span>
                내부 메모
              </h2>
              <p className="mt-2 whitespace-pre-wrap text-xs text-[#6B6560]">
                {c.memo}
              </p>
            </section>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: string;
  label: string;
  value: string;
  tone: "forest" | "amber" | "rose" | "sky";
}) {
  const toneClasses: Record<typeof tone, string> = {
    forest: "border-[#D4E4BC] bg-white text-[#2D5A3D]",
    amber: "border-amber-200 bg-amber-50 text-amber-900",
    rose: "border-rose-200 bg-rose-50 text-rose-900",
    sky: "border-sky-200 bg-sky-50 text-sky-900",
  };
  return (
    <div className={`rounded-2xl border p-4 shadow-sm ${toneClasses[tone]}`}>
      <p className="text-[11px] font-semibold opacity-80">
        <span className="mr-1" aria-hidden>
          {icon}
        </span>
        {label}
      </p>
      <p className="mt-1 text-xl font-extrabold md:text-2xl">{value}</p>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-[#8B7F75]">{label}</dt>
      <dd
        className={`truncate font-semibold text-[#2D5A3D] ${
          mono ? "font-mono" : ""
        }`}
      >
        {value}
      </dd>
    </div>
  );
}

function ConsentRow({ label, on }: { label: string; on: boolean }) {
  return (
    <li className="flex items-center justify-between rounded-lg border border-[#F4EFE8] bg-[#FFF8F0] px-3 py-1.5">
      <span className="text-[#6B4423]">{label}</span>
      <span
        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
          on
            ? "bg-emerald-100 text-emerald-800"
            : "bg-zinc-100 text-zinc-600"
        }`}
      >
        <span
          aria-hidden
          className={`h-1.5 w-1.5 rounded-full ${
            on ? "bg-emerald-500" : "bg-zinc-400"
          }`}
        />
        {on ? "동의" : "거부"}
      </span>
    </li>
  );
}
