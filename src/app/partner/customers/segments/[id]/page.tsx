import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePartner } from "@/lib/auth-guard";
import { createClient } from "@/lib/supabase/server";
import { refreshSegmentMembersAction, deleteSegmentAction } from "../actions";
import type { SegmentRules, SegmentType } from "../actions";

export const dynamic = "force-dynamic";

type Segment = {
  id: string;
  partner_id: string;
  name: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  segment_type: SegmentType | null;
  rules: SegmentRules | null;
  member_count: number;
  created_at: string;
};

type MemberRow = {
  id: string;
  name: string;
  subtitle: string;
  type: "ORG" | "CUSTOMER" | "COMPANY";
  href: string;
};

function matchRow(row: Record<string, unknown>, rules: SegmentRules): boolean {
  if (!rules?.conditions || rules.conditions.length === 0) return true;
  const results = rules.conditions.map((c) => {
    const raw = row[c.field];
    if (raw == null) return false;
    if (c.op === "contains") {
      return String(raw).toLowerCase().includes(String(c.value).toLowerCase());
    }
    const a = typeof raw === "number" ? raw : Number(raw);
    const b = typeof c.value === "number" ? c.value : Number(c.value);
    if (!Number.isFinite(a) || !Number.isFinite(b)) {
      if (c.op === "=") return String(raw) === String(c.value);
      return false;
    }
    switch (c.op) {
      case ">":
        return a > b;
      case "<":
        return a < b;
      case ">=":
        return a >= b;
      case "<=":
        return a <= b;
      case "=":
        return a === b;
      default:
        return false;
    }
  });
  return rules.combinator === "OR" ? results.some(Boolean) : results.every(Boolean);
}

async function loadSegmentAndMembers(
  partnerId: string,
  segmentId: string
): Promise<{ segment: Segment | null; members: MemberRow[] }> {
  const supabase = await createClient();
  const client = supabase as unknown as {
    from: (t: string) => {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          maybeSingle?: () => Promise<{ data: Segment | null }>;
        } & Promise<{ data: unknown[] | null }>;
      };
    };
  };

  const { data: segment } = await (
    supabase.from("partner_segments") as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          maybeSingle: () => Promise<{ data: Segment | null }>;
        };
      };
    }
  )
    .select("*")
    .eq("id", segmentId)
    .maybeSingle();

  if (!segment || segment.partner_id !== partnerId) {
    return { segment: null, members: [] };
  }

  const rules: SegmentRules = segment.rules ?? { combinator: "AND", conditions: [] };
  const type = (segment.segment_type ?? "CUSTOMER") as SegmentType;

  const tables: { name: string; type: "ORG" | "CUSTOMER" | "COMPANY" }[] = [];
  if (type === "ORG" || type === "MIXED") tables.push({ name: "partner_orgs", type: "ORG" });
  if (type === "CUSTOMER" || type === "MIXED")
    tables.push({ name: "partner_customers", type: "CUSTOMER" });
  if (type === "COMPANY" || type === "MIXED")
    tables.push({ name: "partner_companies", type: "COMPANY" });

  const members: MemberRow[] = [];
  for (const t of tables) {
    const res = await client.from(t.name).select("*").eq("partner_id", partnerId);
    const rows = (res.data ?? []) as Record<string, unknown>[];
    rows
      .filter((r) => matchRow(r, rules))
      .slice(0, 200)
      .forEach((r) => {
        if (t.type === "ORG") {
          members.push({
            id: String(r.id),
            name: String(r.org_name ?? "기관"),
            subtitle: `${r.org_type ?? "기관"} · ${r.status ?? ""}`,
            type: "ORG",
            href: `/partner/customers/org/${r.id}`,
          });
        } else if (t.type === "CUSTOMER") {
          members.push({
            id: String(r.id),
            name: String(r.parent_name ?? "고객"),
            subtitle: `${r.parent_phone ?? ""} · 참여 ${r.total_events ?? 0}회`,
            type: "CUSTOMER",
            href: `/partner/customers/individual/${r.id}`,
          });
        } else {
          members.push({
            id: String(r.id),
            name: String(r.company_name ?? "기업"),
            subtitle: `${r.industry ?? "산업"} · ${r.status ?? ""}`,
            type: "COMPANY",
            href: `/partner/customers/corporate/${r.id}`,
          });
        }
      });
  }

  return { segment, members };
}

export default async function SegmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const partner = await requirePartner();
  const { id } = await params;
  const { segment, members } = await loadSegmentAndMembers(partner.id, id);

  if (!segment) notFound();

  const rules = segment.rules ?? { combinator: "AND", conditions: [] };
  const typeLabel =
    segment.segment_type === "ORG"
      ? "🏫 기관"
      : segment.segment_type === "CUSTOMER"
      ? "👨‍👩‍👧 개인"
      : segment.segment_type === "COMPANY"
      ? "🏢 기업"
      : "🔀 혼합";

  const refreshWithId = refreshSegmentMembersAction.bind(null, id);
  const deleteWithId = deleteSegmentAction.bind(null, id);

  return (
    <div className="space-y-6">
      <nav className="text-xs text-[#6B6560]">
        <Link href="/partner/customers" className="hover:underline">
          고객 관리
        </Link>
        <span className="mx-1">›</span>
        <Link href="/partner/customers/segments" className="hover:underline">
          세그먼트
        </Link>
        <span className="mx-1">›</span>
        <span className="font-semibold text-[#2D5A3D]">{segment.name}</span>
      </nav>

      {/* Header */}
      <section
        className="overflow-hidden rounded-2xl p-6 text-white shadow-sm"
        style={{
          background: `linear-gradient(135deg, ${segment.color ?? "#7c3aed"}, ${
            segment.color ?? "#7c3aed"
          }dd, #c026d3)`,
        }}
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold">
              <span className="rounded-full bg-white/20 px-2 py-0.5">{typeLabel}</span>
              <span className="rounded-full bg-white/20 px-2 py-0.5">
                {rules.combinator === "OR" ? "OR 조건" : "AND 조건"}
              </span>
            </div>
            <h1 className="flex items-center gap-2 text-2xl font-bold md:text-3xl">
              <span>{segment.icon ?? "🎯"}</span>
              <span>{segment.name}</span>
            </h1>
            {segment.description && (
              <p className="mt-1 text-sm opacity-90">{segment.description}</p>
            )}
          </div>
          <div className="text-right">
            <div className="text-xs font-semibold uppercase tracking-wider opacity-80">대상</div>
            <div className="text-4xl font-extrabold">
              {segment.member_count.toLocaleString("ko-KR")}
              <span className="ml-1 text-base">명</span>
            </div>
          </div>
        </div>
      </section>

      {/* 액션 버튼 */}
      <section className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <button
          type="button"
          className="rounded-xl border border-violet-300 bg-violet-50 px-4 py-3 text-sm font-bold text-violet-700 shadow-sm transition hover:bg-violet-100"
          title="준비 중"
          disabled
        >
          📣 그룹 메시지
        </button>
        <button
          type="button"
          className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-700 shadow-sm transition hover:bg-amber-100"
          title="준비 중"
          disabled
        >
          🎁 쿠폰 발행
        </button>
        <Link
          href="/partner/analytics"
          className="rounded-xl border border-sky-300 bg-sky-50 px-4 py-3 text-center text-sm font-bold text-sky-700 shadow-sm transition hover:bg-sky-100"
        >
          📊 상세 분석
        </Link>
        <form action={refreshWithId}>
          <button
            type="submit"
            className="w-full rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700 shadow-sm transition hover:bg-emerald-100"
          >
            🔄 다시 계산
          </button>
        </form>
      </section>

      {/* 규칙 표시 */}
      <section className="rounded-2xl border border-[#D4E4BC] bg-white p-5 shadow-sm">
        <h2 className="mb-3 flex items-center gap-2 text-base font-bold text-[#2D5A3D]">
          <span>🧩</span>
          <span>적용 규칙</span>
        </h2>
        {rules.conditions.length === 0 ? (
          <p className="text-sm text-[#6B6560]">규칙이 없습니다. 모든 대상 고객이 포함됩니다.</p>
        ) : (
          <div className="space-y-2">
            {rules.conditions.map((c, i) => (
              <div
                key={i}
                className="flex flex-wrap items-center gap-2 rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] p-3 text-sm"
              >
                <span className="inline-flex items-center rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-bold text-violet-700">
                  {i === 0 ? "WHERE" : rules.combinator}
                </span>
                <span className="rounded bg-white px-2 py-0.5 font-semibold text-[#2C2C2C] ring-1 ring-[#D4E4BC]">
                  {c.field}
                </span>
                <span className="font-mono text-[#6B6560]">{c.op}</span>
                <span className="rounded bg-white px-2 py-0.5 font-semibold text-violet-700 ring-1 ring-violet-200">
                  {String(c.value)}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 멤버 리스트 */}
      <section className="rounded-2xl border border-[#D4E4BC] bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-base font-bold text-[#2D5A3D]">
            <span>👥</span>
            <span>포함된 고객</span>
          </h2>
          <span className="text-xs text-[#6B6560]">
            {members.length.toLocaleString("ko-KR")}명 표시
            {members.length >= 200 && " (상위 200)"}
          </span>
        </div>
        {members.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[#D4E4BC] bg-[#FFF8F0] p-8 text-center">
            <div className="text-3xl">🌱</div>
            <p className="mt-2 text-sm font-semibold text-[#2D5A3D]">
              조건에 맞는 고객이 없어요
            </p>
            <p className="mt-1 text-xs text-[#6B6560]">
              규칙을 완화하거나 값을 조정해 보세요.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-[#F5F1E8]">
            {members.map((m) => (
              <li key={`${m.type}-${m.id}`}>
                <Link
                  href={m.href}
                  className="flex items-center justify-between gap-2 rounded-lg px-2 py-2.5 text-sm hover:bg-[#FFF8F0]"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="text-lg">
                      {m.type === "ORG" ? "🏫" : m.type === "CUSTOMER" ? "👨‍👩‍👧" : "🏢"}
                    </span>
                    <div className="min-w-0">
                      <div className="truncate font-semibold text-[#2C2C2C]">{m.name}</div>
                      <div className="truncate text-xs text-[#6B6560]">{m.subtitle}</div>
                    </div>
                  </div>
                  <span className="text-xs text-[#6B6560]">→</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 삭제 */}
      <section className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
        <form action={deleteWithId}>
          <button
            type="submit"
            className="text-xs font-semibold text-rose-700 hover:underline"
          >
            🗑️ 이 세그먼트 삭제
          </button>
        </form>
      </section>
    </div>
  );
}
