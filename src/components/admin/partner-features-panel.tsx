import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { listAllFeatures } from "@/lib/features/queries";
import {
  FEATURE_CATEGORY_META,
  PACK_TIER_META,
  type GrantSource,
} from "@/lib/features/types";
import {
  grantFeatureAction,
  revokeGrantAction,
} from "@/app/admin/features/grant-actions";

type ActiveGrant = {
  id: string;
  feature_code: string;
  source: GrantSource;
  granted_at: string;
  note: string | null;
};

async function loadActiveGrants(partnerId: string): Promise<ActiveGrant[]> {
  const supabase = await createClient();
  const { data } = await (
    supabase.from("partner_feature_grants" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          eq: (k: string, v: string) => Promise<{
            data: ActiveGrant[] | null;
            error: unknown;
          }>;
        };
      };
    }
  )
    .select("id,feature_code,source,granted_at,note")
    .eq("partner_id", partnerId)
    .eq("status", "ACTIVE");
  return data ?? [];
}

export async function PartnerFeaturesPanel({
  partnerId,
}: {
  partnerId: string;
}) {
  const [features, grants] = await Promise.all([
    listAllFeatures(),
    loadActiveGrants(partnerId),
  ]);

  const grantByCode = new Map(grants.map((g) => [g.feature_code, g]));
  const visible = features.filter(
    (f) => f.status === "GA" || f.status === "BETA" || grantByCode.has(f.code)
  );

  async function add(formData: FormData) {
    "use server";
    const code = String(formData.get("feature_code") ?? "");
    if (!code) return;
    const res = await grantFeatureAction(partnerId, code);
    if (!res.ok) throw new Error(res.message);
    redirect(`/admin/partners/${partnerId}`);
  }

  async function remove(formData: FormData) {
    "use server";
    const grantId = String(formData.get("grant_id") ?? "");
    if (!grantId) return;
    const res = await revokeGrantAction(grantId);
    if (!res.ok) throw new Error(res.message);
    redirect(`/admin/partners/${partnerId}`);
  }

  return (
    <section className="rounded-3xl border border-[#D4E4BC] bg-white p-5 shadow-sm md:p-6">
      <header className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-bold text-[#2D5A3D] md:text-base">
          <span aria-hidden>🧩</span>
          <span>보유 기능 ({grants.length})</span>
        </h2>
        <Link
          href="/admin/features"
          className="rounded-lg border border-[#D4E4BC] bg-white px-2.5 py-1 text-[11px] font-semibold text-[#2D5A3D] hover:bg-[#E8F0E4]"
        >
          카탈로그
        </Link>
      </header>

      <ul className="mt-3 divide-y divide-[#F0EBE3]">
        {visible.map((f) => {
          const grant = grantByCode.get(f.code);
          const has = !!grant;
          const tier = PACK_TIER_META[f.pack_tier];
          return (
            <li
              key={f.code}
              className="flex flex-wrap items-center justify-between gap-3 py-3"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-xl shrink-0" aria-hidden>
                    {f.icon ?? "🧩"}
                  </span>
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-[#2D5A3D]">
                      {f.name}
                    </div>
                    <div className="font-mono text-[10px] text-[#8B7F75]">
                      {f.code} · {FEATURE_CATEGORY_META[f.category]} ·{" "}
                      {tier.emoji} {tier.label}
                    </div>
                    {has && grant && (
                      <div className="text-[10px] text-[#6B6560]">
                        {grant.source} · 부여 {fmt(grant.granted_at)}
                        {grant.note && ` · ${grant.note}`}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              {has ? (
                <form action={remove}>
                  <input type="hidden" name="grant_id" value={grant!.id} />
                  <button
                    type="submit"
                    className="rounded-lg border border-rose-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-rose-700 hover:bg-rose-50"
                  >
                    회수
                  </button>
                </form>
              ) : (
                <form action={add}>
                  <input type="hidden" name="feature_code" value={f.code} />
                  <button
                    type="submit"
                    className="rounded-lg bg-[#2D5A3D] px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-[#3A7A52]"
                  >
                    + 부여
                  </button>
                </form>
              )}
            </li>
          );
        })}
      </ul>

      {visible.length === 0 && (
        <p className="rounded-xl border border-dashed border-[#D4E4BC] bg-[#FFF8F0] px-3 py-6 text-center text-xs text-[#6B6560]">
          등재된 기능이 없습니다.{" "}
          <Link
            href="/admin/features/new"
            className="font-semibold text-[#2D5A3D] underline"
          >
            새 기능 만들기
          </Link>
        </p>
      )}
    </section>
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
