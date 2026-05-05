import Link from "next/link";
import { getPartner } from "@/lib/auth-guard";
import { PartnerNav } from "@/components/partner-nav";
import { countPendingTeamMembers } from "@/lib/team/event-team-queries";
import { loadPartnerProfileSnapshot } from "@/lib/profile-completeness/queries";
import { calcCompleteness } from "@/lib/profile-completeness/calculator";
import { PARTNER_PROFILE_SCHEMA } from "@/lib/profile-completeness/schemas/partner";
import { createClient } from "@/lib/supabase/server";

async function safeCountPending(partnerId: string): Promise<number> {
  try {
    const n = await countPendingTeamMembers(partnerId);
    return typeof n === "number" && Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

async function safeProfilePercent(partnerId: string): Promise<number | null> {
  try {
    const snap = await loadPartnerProfileSnapshot(partnerId);
    return calcCompleteness(PARTNER_PROFILE_SCHEMA, snap).percent;
  } catch {
    return null;
  }
}

/**
 * 파트너의 회사명(business_name) 을 DB 에서 로드.
 * 쿠키 세션은 표시용 `name` 만 들고 있어서, 실제 사업자명은 별도 조회가 필요.
 * 실패하거나 비어있으면 null 반환 → PartnerNav 가 name 으로 fallback.
 */
async function safeBusinessName(partnerId: string): Promise<string | null> {
  try {
    const supabase = await createClient();
    const resp = (await (
      supabase.from("partners" as never) as unknown as {
        select: (c: string) => {
          eq: (k: string, v: string) => {
            maybeSingle: () => Promise<{
              data: { business_name: string | null } | null;
            }>;
          };
        };
      }
    )
      .select("business_name")
      .eq("id", partnerId)
      .maybeSingle()) as {
      data: { business_name: string | null } | null;
    };
    const v = resp.data?.business_name?.trim();
    return v && v.length > 0 ? v : null;
  } catch {
    return null;
  }
}

export default async function PartnerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const partner = await getPartner();
  // 세션에 role이 없으면 (구버전 쿠키) OWNER로 폴백 — auth-guard의 normalize에서도 처리됨
  const partnerRole = partner?.role ?? null;

  const [pendingCount, profilePercent, businessName] = partner
    ? await Promise.all([
        partner.role === "OWNER" || partner.role === "MANAGER"
          ? safeCountPending(partner.id)
          : Promise.resolve(0),
        safeProfilePercent(partner.id),
        safeBusinessName(partner.id),
      ])
    : [0, null as number | null, null as string | null];

  return (
    <div className="min-h-dvh bg-[#FFF8F0]">
      {/* 준비 중 wait-list 배너 */}
      <div className="bg-gradient-to-r from-[#C4956A] to-[#D4E4BC] px-4 py-1.5 text-center text-xs font-semibold text-[#2D5A3D]">
        🌱 숲지기 포털은 현재 준비 중입니다 · 베타 오픈 대기자 신청을 받고 있어요
      </div>

      {/* 로그인 안 한 상태면 심플 헤더, 로그인 되어 있으면 풀 네비 */}
      {partner ? (
        <PartnerNav
          /* business_name 우선 — DB 매번 다시 조회한 값(businessName) → 세션 쿠키(partner.businessName) → display name(partner.name) 순. */
          partnerName={
            businessName ?? partner.businessName ?? partner.name
          }
          role={partnerRole}
          pendingCount={pendingCount}
          profilePercent={profilePercent}
        />
      ) : (
        <header className="border-b border-[#D4E4BC] bg-white shadow-sm">
          <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
            <Link href="/partner" className="flex items-center gap-2 font-bold text-[#2D5A3D]">
              <span className="text-xl">🏡</span>
              <span>토리로 숲지기</span>
            </Link>
            <Link
              href="/partner"
              className="rounded-lg border border-[#D4E4BC] px-3 py-1 text-xs text-[#6B6560] hover:bg-[#FFF8F0]"
            >
              로그인
            </Link>
          </div>
        </header>
      )}

      <main className={partner ? "mx-auto max-w-7xl px-4 py-6" : "mx-auto max-w-4xl px-4 py-6"}>
        {children}
      </main>
    </div>
  );
}
