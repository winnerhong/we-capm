import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth-guard";
import { createClient } from "@/lib/supabase/server";
import { getFeatureByCode } from "@/lib/features/queries";
import { PACK_TIER_META } from "@/lib/features/types";
import {
  bulkGrantFeatureAction,
  grantFeatureAction,
  revokeGrantAction,
} from "../../grant-actions";

export const dynamic = "force-dynamic";

type GrantWithPartner = {
  id: string;
  partner_id: string;
  source: string;
  granted_at: string;
  note: string | null;
  partner_name: string;
  partner_business_name: string | null;
  partner_username: string;
};

async function loadGrants(featureCode: string): Promise<GrantWithPartner[]> {
  const supabase = await createClient();
  const { data } = await (
    supabase.from("partner_feature_grants" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          eq: (k: string, v: string) => {
            order: (
              c: string,
              o: { ascending: boolean }
            ) => Promise<{
              data:
                | {
                    id: string;
                    partner_id: string;
                    source: string;
                    granted_at: string;
                    note: string | null;
                    partners: {
                      name: string;
                      business_name: string | null;
                      username: string;
                    } | null;
                  }[]
                | null;
              error: unknown;
            }>;
          };
        };
      };
    }
  )
    .select(
      "id,partner_id,source,granted_at,note,partners(name,business_name,username)"
    )
    .eq("feature_code", featureCode)
    .eq("status", "ACTIVE")
    .order("granted_at", { ascending: false });

  return (data ?? []).map((r) => ({
    id: r.id,
    partner_id: r.partner_id,
    source: r.source,
    granted_at: r.granted_at,
    note: r.note,
    partner_name: r.partners?.name ?? "(이름 없음)",
    partner_business_name: r.partners?.business_name ?? null,
    partner_username: r.partners?.username ?? "",
  }));
}

async function countAllPartners(): Promise<number> {
  const supabase = await createClient();
  const { count } = await (
    supabase.from("partners" as never) as unknown as {
      select: (
        c: string,
        opts: { count: string; head: boolean }
      ) => Promise<{ count: number | null; error: unknown }>;
    }
  ).select("*", { count: "exact", head: true });
  return count ?? 0;
}

type PageProps = {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ ok?: string; n?: string }>;
};

export default async function FeatureGrantsPage({
  params,
  searchParams,
}: PageProps) {
  await requireAdmin();
  const { code } = await params;
  const sp = await searchParams;
  const feature = await getFeatureByCode(code);
  if (!feature) notFound();

  const [grants, totalPartners] = await Promise.all([
    loadGrants(code),
    countAllPartners(),
  ]);

  // 단건 부여
  async function doGrant(formData: FormData) {
    "use server";
    const partnerId = String(formData.get("partner_id") ?? "").trim();
    const note = String(formData.get("note") ?? "").trim() || undefined;
    if (!partnerId) throw new Error("지사 ID 가 필요합니다.");
    const res = await grantFeatureAction(partnerId, code, note);
    if (!res.ok) throw new Error(res.message);
    redirect(`/admin/features/${code}/grants?ok=grant`);
  }

  // 일괄 부여
  async function doBulk(formData: FormData) {
    "use server";
    const selection = String(formData.get("selection") ?? "ALL").trim();
    const note = String(formData.get("note") ?? "").trim() || undefined;
    const res = await bulkGrantFeatureAction(code, selection, note);
    if (!res.ok) throw new Error(res.message);
    redirect(`/admin/features/${code}/grants?ok=bulk&n=${res.affected ?? 0}`);
  }

  // 회수
  async function doRevoke(formData: FormData) {
    "use server";
    const grantId = String(formData.get("grant_id") ?? "").trim();
    if (!grantId) throw new Error("grant ID 가 필요합니다.");
    const res = await revokeGrantAction(grantId);
    if (!res.ok) throw new Error(res.message);
    redirect(`/admin/features/${code}/grants?ok=revoke`);
  }

  const tier = PACK_TIER_META[feature.pack_tier];
  const coverage =
    totalPartners === 0
      ? 0
      : Math.round((grants.length / totalPartners) * 100);

  return (
    <div className="space-y-6">
      <nav aria-label="breadcrumb" className="text-xs text-[#8B7F75]">
        <Link href="/admin" className="hover:text-[#2D5A3D]">
          관리자
        </Link>
        <span className="mx-2">/</span>
        <Link href="/admin/features" className="hover:text-[#2D5A3D]">
          기능 카탈로그
        </Link>
        <span className="mx-2">/</span>
        <Link
          href={`/admin/features/${code}/edit`}
          className="hover:text-[#2D5A3D]"
        >
          {feature.name}
        </Link>
        <span className="mx-2">/</span>
        <span className="font-semibold text-[#2D5A3D]">보유 지사</span>
      </nav>

      <header className="rounded-3xl border border-[#D4E4BC] bg-gradient-to-br from-[#E8F0E4] via-white to-[#FAE7D0] p-5 shadow-sm md:p-7">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="text-3xl" aria-hidden>
              {feature.icon ?? "🧩"}
            </span>
            <div>
              <h1 className="text-xl font-bold text-[#2D5A3D] md:text-2xl">
                {feature.name} 보유 지사
              </h1>
              <p className="mt-1 font-mono text-[11px] text-[#8B7F75]">
                {feature.code}
              </p>
              <p className="mt-1 text-xs text-[#6B6560]">
                {tier.emoji} {tier.label} · {grants.length} / {totalPartners}{" "}
                지사 보유 ({coverage}%)
              </p>
            </div>
          </div>
        </div>

        {sp.ok === "grant" && (
          <p className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-800">
            ✅ 부여 완료
          </p>
        )}
        {sp.ok === "bulk" && (
          <p className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-800">
            ✅ 일괄 부여 완료 ({sp.n ?? 0}건 신규)
          </p>
        )}
        {sp.ok === "revoke" && (
          <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-semibold text-amber-800">
            🔒 회수 완료
          </p>
        )}
      </header>

      {/* 단건 부여 */}
      <section className="rounded-3xl border border-[#D4E4BC] bg-white p-5 shadow-sm md:p-7">
        <h2 className="flex items-center gap-2 text-sm font-bold text-[#2D5A3D]">
          <span aria-hidden>➕</span>
          <span>지사 부여 (단건)</span>
        </h2>
        <p className="mt-1 text-[11px] text-[#6B6560]">
          지사 ID 를 입력해 한 곳에 부여합니다. 지사 ID 는{" "}
          <Link href="/admin/partners" className="font-semibold underline">
            지사 목록
          </Link>{" "}
          에서 복사하세요.
        </p>
        <form
          action={doGrant}
          className="mt-3 grid gap-2 md:grid-cols-[1fr_2fr_auto]"
        >
          <input
            name="partner_id"
            required
            placeholder="partner UUID"
            className="rounded-xl border border-[#E5DDD0] bg-white px-3 py-2 font-mono text-xs focus:border-[#2D5A3D] focus:outline-none"
          />
          <input
            name="note"
            placeholder="메모 (선택)"
            className="rounded-xl border border-[#E5DDD0] bg-white px-3 py-2 text-xs focus:border-[#2D5A3D] focus:outline-none"
          />
          <button
            type="submit"
            className="rounded-xl bg-[#2D5A3D] px-4 py-2 text-xs font-semibold text-white hover:bg-[#3A7A52]"
          >
            부여
          </button>
        </form>
      </section>

      {/* 일괄 부여 */}
      <section className="rounded-3xl border border-amber-200 bg-amber-50 p-5 shadow-sm md:p-7">
        <h2 className="flex items-center gap-2 text-sm font-bold text-amber-900">
          <span aria-hidden>📦</span>
          <span>일괄 부여</span>
        </h2>
        <p className="mt-1 text-[11px] text-amber-800">
          <b>ALL</b> 입력 시 모든 지사에 부여 (이미 보유한 곳은 자동 제외).
          UUID 를 콤마로 구분해 일부 지사에만 부여할 수도 있습니다.
        </p>
        <form
          action={doBulk}
          className="mt-3 grid gap-2 md:grid-cols-[1fr_2fr_auto]"
        >
          <input
            name="selection"
            required
            defaultValue="ALL"
            placeholder="ALL 또는 uuid,uuid,..."
            className="rounded-xl border border-amber-200 bg-white px-3 py-2 font-mono text-xs focus:border-amber-500 focus:outline-none"
          />
          <input
            name="note"
            placeholder="메모 (선택)"
            className="rounded-xl border border-amber-200 bg-white px-3 py-2 text-xs focus:border-amber-500 focus:outline-none"
          />
          <button
            type="submit"
            className="rounded-xl bg-amber-700 px-4 py-2 text-xs font-semibold text-white hover:bg-amber-800"
          >
            일괄 부여
          </button>
        </form>
      </section>

      {/* 보유 지사 목록 */}
      <section className="overflow-hidden rounded-3xl border border-[#D4E4BC] bg-white shadow-sm">
        <div className="border-b border-[#F0EBE3] bg-[#FFF8F0] px-5 py-3 text-xs font-semibold text-[#6B6560]">
          현재 보유 지사 · 총 <b className="text-[#2D5A3D]">{grants.length}</b>{" "}
          곳
        </div>

        {grants.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-4 py-16 text-center">
            <div className="text-4xl">🌱</div>
            <p className="mt-3 text-sm font-semibold text-[#2D5A3D]">
              아직 부여된 지사가 없어요
            </p>
            <p className="mt-1 text-xs text-[#6B6560]">
              위에서 단건 또는 일괄 부여로 시작하세요.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-[#F0EBE3]">
            {grants.map((g) => (
              <li
                key={g.id}
                className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 hover:bg-[#FFF8F0]"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/admin/partners/${g.partner_id}`}
                      className="truncate text-sm font-bold text-[#2D5A3D] hover:underline"
                    >
                      {g.partner_business_name ?? g.partner_name}
                    </Link>
                    <span className="rounded-full bg-[#E8F0E4] px-2 py-0.5 text-[10px] font-semibold text-[#2D5A3D]">
                      {g.source}
                    </span>
                  </div>
                  <div className="text-[11px] text-[#6B6560]">
                    @{g.partner_username} · 부여 {fmt(g.granted_at)}
                    {g.note && ` · ${g.note}`}
                  </div>
                </div>
                <form action={doRevoke}>
                  <input type="hidden" name="grant_id" value={g.id} />
                  <button
                    type="submit"
                    className="rounded-lg border border-rose-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-rose-700 hover:bg-rose-50"
                  >
                    회수
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function fmt(iso: string): string {
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
