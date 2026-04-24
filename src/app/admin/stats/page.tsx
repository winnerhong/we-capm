import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { AcornIcon } from "@/components/acorn-icon";

export const dynamic = "force-dynamic";

// Phase C 테이블 접근용 헬퍼 (타입 미정의 테이블)
type PhaseCQuery = {
  select: (cols: string, opts?: { count?: "exact"; head?: boolean }) => PhaseCQuery;
  eq: (col: string, val: unknown) => PhaseCQuery;
  in: (col: string, vals: unknown[]) => PhaseCQuery;
  not: (col: string, op: string, val: unknown) => PhaseCQuery;
  then: <T>(cb: (r: { data: T[] | null; count: number | null; error: unknown }) => unknown) => Promise<unknown>;
};

async function safeQuery<T>(fn: () => Promise<T>, fallback: T): Promise<{ ok: boolean; data: T }> {
  try {
    const data = await fn();
    return { ok: true, data };
  } catch {
    return { ok: false, data: fallback };
  }
}

export default async function AdminStatsPage() {
  const supabase = await createClient();

  // ─────────────────────────────
  // 1) 핵심 지표 (항상 동작)
  // ─────────────────────────────
  const [
    { count: totalEvents },
    { count: totalParticipants },
    { count: totalSubmissions },
    { data: scoreRows },
  ] = await Promise.all([
    supabase.from("events").select("*", { count: "exact", head: true }),
    supabase.from("participants").select("*", { count: "exact", head: true }),
    supabase.from("submissions").select("*", { count: "exact", head: true }),
    supabase.from("participants").select("total_score"),
  ]);

  const totalAcorns = (scoreRows ?? []).reduce((sum, r) => sum + (r.total_score ?? 0), 0);

  // 도토리 분포 버킷
  const buckets = { sprout: 0, explorer: 0, tree: 0, forest: 0 };
  for (const r of scoreRows ?? []) {
    const s = r.total_score ?? 0;
    if (s < 30) buckets.sprout++;
    else if (s < 100) buckets.explorer++;
    else if (s < 300) buckets.tree++;
    else buckets.forest++;
  }
  const maxBucket = Math.max(1, ...Object.values(buckets));

  // ─────────────────────────────
  // 2) 파트너 현황
  // ─────────────────────────────
  type PartnerRow = {
    status: string;
    tier: string;
    total_sales: number;
    commission_rate: number;
  };
  const partners = await safeQuery(async () => {
    const q = supabase.from("partners" as never) as unknown as PhaseCQuery;
    const res = await (q.select("status, tier, total_sales, commission_rate") as unknown as Promise<{
      data: PartnerRow[] | null;
      error: unknown;
    }>);
    if (res.error) throw res.error;
    return res.data ?? [];
  }, [] as PartnerRow[]);

  const partnerStats = {
    total: partners.data.length,
    active: partners.data.filter((p) => p.status === "ACTIVE").length,
    pending: partners.data.filter((p) => p.status === "PENDING").length,
    suspended: partners.data.filter((p) => p.status === "SUSPENDED").length,
    totalSales: partners.data.reduce((s, p) => s + Number(p.total_sales ?? 0), 0),
    avgCommission:
      partners.data.length === 0
        ? 0
        : partners.data.reduce((s, p) => s + Number(p.commission_rate ?? 0), 0) / partners.data.length,
  };

  // ─────────────────────────────
  // 3) 구독 현황
  // ─────────────────────────────
  type SubRow = { status: string; tier: string; monthly_price: number };
  const subs = await safeQuery(async () => {
    const q = supabase.from("subscriptions" as never) as unknown as PhaseCQuery;
    const res = await (q.select("status, tier, monthly_price") as unknown as Promise<{
      data: SubRow[] | null;
      error: unknown;
    }>);
    if (res.error) throw res.error;
    return res.data ?? [];
  }, [] as SubRow[]);

  const subActive = subs.data.filter((s) => s.status === "ACTIVE");
  const subStats = {
    active: subActive.length,
    sprout: subActive.filter((s) => s.tier === "SPROUT").length,
    tree: subActive.filter((s) => s.tier === "TREE").length,
    forest: subActive.filter((s) => s.tier === "FOREST").length,
    mrr: subActive.reduce((sum, s) => sum + (s.monthly_price ?? 0), 0),
  };

  // ─────────────────────────────
  // 4) 쿠폰 현황
  // ─────────────────────────────
  type CouponRow = { status: string };
  type DeliveryRow = { used_at: string | null };
  const coupons = await safeQuery(async () => {
    const q = supabase.from("coupons" as never) as unknown as PhaseCQuery;
    const res = await (q.select("status") as unknown as Promise<{
      data: CouponRow[] | null;
      error: unknown;
    }>);
    if (res.error) throw res.error;
    return res.data ?? [];
  }, [] as CouponRow[]);

  const deliveries = await safeQuery(async () => {
    const q = supabase.from("coupon_deliveries" as never) as unknown as PhaseCQuery;
    const res = await (q.select("used_at") as unknown as Promise<{
      data: DeliveryRow[] | null;
      error: unknown;
    }>);
    if (res.error) throw res.error;
    return res.data ?? [];
  }, [] as DeliveryRow[]);

  const couponStats = {
    active: coupons.data.filter((c) => c.status === "ACTIVE").length,
    delivered: deliveries.data.length,
    used: deliveries.data.filter((d) => d.used_at !== null).length,
    usageRate:
      deliveries.data.length === 0
        ? 0
        : Math.round((deliveries.data.filter((d) => d.used_at !== null).length / deliveries.data.length) * 100),
  };

  // ─────────────────────────────
  // 5) 광고 현황
  // ─────────────────────────────
  type AdRow = { status: string; budget: number; spent: number };
  const ads = await safeQuery(async () => {
    const q = supabase.from("ad_campaigns" as never) as unknown as PhaseCQuery;
    const res = await (q.select("status, budget, spent") as unknown as Promise<{
      data: AdRow[] | null;
      error: unknown;
    }>);
    if (res.error) throw res.error;
    return res.data ?? [];
  }, [] as AdRow[]);

  const adStats = {
    total: ads.data.length,
    active: ads.data.filter((a) => a.status === "ACTIVE").length,
    pending: ads.data.filter((a) => a.status === "PENDING").length,
    draft: ads.data.filter((a) => a.status === "DRAFT").length,
    totalBudget: ads.data.reduce((s, a) => s + (a.budget ?? 0), 0),
    totalSpent: ads.data.reduce((s, a) => s + (a.spent ?? 0), 0),
  };

  // ─────────────────────────────
  // 6) 길드 & 챌린지
  // ─────────────────────────────
  type GuildRow = { id: string };
  type GuildMemberRow = { guild_id: string };
  type ChallengeRow = { status: string };
  const guilds = await safeQuery(async () => {
    const q = supabase.from("guilds" as never) as unknown as PhaseCQuery;
    const res = await (q.select("id") as unknown as Promise<{
      data: GuildRow[] | null;
      error: unknown;
    }>);
    if (res.error) throw res.error;
    return res.data ?? [];
  }, [] as GuildRow[]);

  const guildMembers = await safeQuery(async () => {
    const q = supabase.from("guild_members" as never) as unknown as PhaseCQuery;
    const res = await (q.select("guild_id") as unknown as Promise<{
      data: GuildMemberRow[] | null;
      error: unknown;
    }>);
    if (res.error) throw res.error;
    return res.data ?? [];
  }, [] as GuildMemberRow[]);

  const challenges = await safeQuery(async () => {
    const q = supabase.from("challenges" as never) as unknown as PhaseCQuery;
    const res = await (q.select("status") as unknown as Promise<{
      data: ChallengeRow[] | null;
      error: unknown;
    }>);
    if (res.error) throw res.error;
    return res.data ?? [];
  }, [] as ChallengeRow[]);

  const avgGuildSize =
    guilds.data.length === 0 ? 0 : Math.round((guildMembers.data.length / guilds.data.length) * 10) / 10;

  const guildChallengeStats = {
    guilds: guilds.data.length,
    guildMembers: guildMembers.data.length,
    avgGuildSize,
    activeChallenges: challenges.data.filter((c) => c.status === "ACTIVE").length,
    endedChallenges: challenges.data.filter((c) => c.status === "ENDED").length,
  };

  const won = (n: number) => `${n.toLocaleString("ko-KR")}원`;
  const num = (n: number) => n.toLocaleString("ko-KR");

  return (
    <div className="space-y-6">
      {/* 상단 네비 */}
      <div className="flex items-center justify-between">
        <Link href="/admin" className="text-sm text-[#2D5A3D] hover:underline font-medium">
          ← 대시보드
        </Link>
        <span className="text-[10px] text-[#8B6F47] font-medium">실시간 DB 기준</span>
      </div>

      {/* 헤더 — 포레스트 그라데이션 */}
      <div className="rounded-2xl bg-gradient-to-br from-[#2D5A3D] via-[#3A7A52] to-[#4A7C59] p-6 text-white shadow-lg relative overflow-hidden">
        <div className="absolute top-2 right-3 text-5xl opacity-10 select-none">📊</div>
        <div className="relative z-10">
          <p className="text-[11px] tracking-[0.4em] opacity-70 font-light">TORIRO STATS</p>
          <h1 className="text-2xl font-extrabold mt-1">전체 통계 📊</h1>
          <p className="mt-2 text-sm opacity-80">숲의 모든 숫자를 한눈에 살펴보세요</p>
        </div>
      </div>

      {/* 1) 핵심 지표 */}
      <section className="rounded-2xl border border-[#D4E4BC] bg-white p-5">
        <h2 className="text-sm font-bold text-[#2D5A3D] flex items-center gap-1.5 mb-4">
          <span>🌲</span>
          <span>핵심 지표</span>
        </h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="rounded-xl bg-gradient-to-br from-[#E8F0E4] to-[#D4E4BC] p-4 border border-[#B8D4A0]">
            <div className="text-[10px] font-semibold text-[#2D5A3D] opacity-70">총 행사</div>
            <div className="mt-1 text-3xl font-extrabold text-[#2D5A3D]">{num(totalEvents ?? 0)}</div>
            <div className="mt-1 text-[10px] text-[#2D5A3D] opacity-60">개</div>
          </div>
          <div className="rounded-xl bg-gradient-to-br from-[#E8F0E4] to-[#D4E4BC] p-4 border border-[#B8D4A0]">
            <div className="text-[10px] font-semibold text-[#2D5A3D] opacity-70">총 참가자</div>
            <div className="mt-1 text-3xl font-extrabold text-[#2D5A3D]">{num(totalParticipants ?? 0)}</div>
            <div className="mt-1 text-[10px] text-[#2D5A3D] opacity-60">명</div>
          </div>
          <div className="rounded-xl bg-gradient-to-br from-[#FFF8F0] to-[#F5E6D3] p-4 border border-[#E5D3B8]">
            <div className="text-[10px] font-semibold text-[#6B4423] opacity-70">총 도토리 획득</div>
            <div className="mt-1 text-3xl font-extrabold text-[#6B4423]">{num(totalAcorns)}</div>
            <div className="mt-1 inline-flex items-center gap-1 text-[10px] text-[#6B4423] opacity-60"><AcornIcon /> 누적</div>
          </div>
          <div className="rounded-xl bg-gradient-to-br from-[#E8F0E4] to-[#D4E4BC] p-4 border border-[#B8D4A0]">
            <div className="text-[10px] font-semibold text-[#2D5A3D] opacity-70">총 제출물</div>
            <div className="mt-1 text-3xl font-extrabold text-[#2D5A3D]">{num(totalSubmissions ?? 0)}</div>
            <div className="mt-1 text-[10px] text-[#2D5A3D] opacity-60">건</div>
          </div>
        </div>
      </section>

      {/* 7) 도토리 경제 (참가자 점수 기반 — 항상 동작) */}
      <section className="rounded-2xl border border-[#E5D3B8] bg-gradient-to-br from-white to-[#FFF8F0] p-5">
        <h2 className="text-sm font-bold text-[#6B4423] flex items-center gap-1.5 mb-4">
          <span><AcornIcon /></span>
          <span>도토리 경제</span>
        </h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 mb-4">
          <div className="rounded-xl bg-white p-3 border border-[#E5D3B8]">
            <div className="text-[10px] font-medium text-[#8B6F47]">총 발행 도토리</div>
            <div className="mt-1 text-2xl font-extrabold text-[#6B4423]">{num(totalAcorns)}</div>
          </div>
          <div className="rounded-xl bg-white p-3 border border-[#E5D3B8]">
            <div className="text-[10px] font-medium text-[#8B6F47]">인당 평균</div>
            <div className="mt-1 text-2xl font-extrabold text-[#6B4423]">
              {totalParticipants ? Math.round(totalAcorns / totalParticipants) : 0}
            </div>
          </div>
          <div className="rounded-xl bg-white p-3 border border-[#E5D3B8]">
            <div className="text-[10px] font-medium text-[#8B6F47]">최대 보유자</div>
            <div className="mt-1 text-2xl font-extrabold text-[#6B4423]">
              {num(Math.max(0, ...(scoreRows ?? []).map((r) => r.total_score ?? 0)))}
            </div>
          </div>
          <div className="rounded-xl bg-white p-3 border border-[#E5D3B8]">
            <div className="text-[10px] font-medium text-[#8B6F47]">점수 보유자</div>
            <div className="mt-1 text-2xl font-extrabold text-[#6B4423]">
              {num((scoreRows ?? []).filter((r) => (r.total_score ?? 0) > 0).length)}
            </div>
          </div>
        </div>

        {/* 분포 히스토그램 */}
        <div className="rounded-xl bg-white p-4 border border-[#E5D3B8]">
          <div className="text-xs font-bold text-[#6B4423] mb-3">참가자 티어 분포</div>
          <div className="space-y-2.5">
            {[
              { key: "sprout", label: "🌱 새싹 (0~29)", value: buckets.sprout, color: "bg-green-400" },
              { key: "explorer", label: "🧭 탐험가 (30~99)", value: buckets.explorer, color: "bg-teal-500" },
              { key: "tree", label: "🌳 나무 (100~299)", value: buckets.tree, color: "bg-emerald-600" },
              { key: "forest", label: "🌲 숲 (300+)", value: buckets.forest, color: "bg-[#2D5A3D]" },
            ].map((b) => (
              <div key={b.key} className="flex items-center gap-3">
                <div className="w-28 text-[11px] font-medium text-[#6B4423] flex-shrink-0">{b.label}</div>
                <div className="flex-1 h-4 bg-[#F5E6D3] rounded-full overflow-hidden">
                  <div
                    className={`h-full ${b.color} transition-all`}
                    style={{ width: `${(b.value / maxBucket) * 100}%` }}
                  />
                </div>
                <div className="w-14 text-right text-xs font-bold text-[#6B4423] flex-shrink-0">{b.value}명</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 2) 파트너 현황 */}
      <section className="rounded-2xl border border-[#D4E4BC] bg-white p-5">
        <h2 className="text-sm font-bold text-[#2D5A3D] flex items-center gap-1.5 mb-4">
          <span>🏢</span>
          <span>파트너 현황 (숲지기)</span>
        </h2>
        {!partners.ok ? (
          <MigrationNotice table="partners" />
        ) : (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <StatCell label="총 숲지기" value={`${partnerStats.total}곳`} tone="forest" />
            <StatCell label="활성" value={`${partnerStats.active}곳`} tone="green" />
            <StatCell label="준비중" value={`${partnerStats.pending}곳`} tone="neutral" />
            <StatCell label="정지" value={`${partnerStats.suspended}곳`} tone="red" />
            <StatCell label="총 매출" value={won(partnerStats.totalSales)} tone="acorn" />
            <StatCell
              label="평균 커미션"
              value={`${partnerStats.avgCommission.toFixed(1)}%`}
              tone="acorn"
            />
          </div>
        )}
      </section>

      {/* 3) 구독 현황 */}
      <section className="rounded-2xl border border-[#D4E4BC] bg-white p-5">
        <h2 className="text-sm font-bold text-[#2D5A3D] flex items-center gap-1.5 mb-4">
          <span>📅</span>
          <span>구독 현황</span>
        </h2>
        {!subs.ok ? (
          <MigrationNotice table="subscriptions" />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4 mb-4">
              <StatCell label="활성 구독자" value={`${subStats.active}명`} tone="green" />
              <StatCell label="MRR" value={won(subStats.mrr)} tone="acorn" />
              <StatCell label="ARR 추정" value={won(subStats.mrr * 12)} tone="acorn" />
              <StatCell
                label="평균 단가"
                value={won(subStats.active ? Math.round(subStats.mrr / subStats.active) : 0)}
                tone="neutral"
              />
            </div>
            <div className="rounded-xl bg-[#F8F6F2] p-4 border border-[#E5D3B8]">
              <div className="text-xs font-bold text-[#6B4423] mb-3">티어별 분포</div>
              <div className="grid grid-cols-3 gap-2">
                <TierCard icon="🌱" label="새싹" count={subStats.sprout} color="bg-green-100 text-green-700 border-green-200" />
                <TierCard icon="🌳" label="나무" count={subStats.tree} color="bg-emerald-100 text-emerald-700 border-emerald-200" />
                <TierCard icon="🌲" label="숲" count={subStats.forest} color="bg-[#E8F0E4] text-[#2D5A3D] border-[#B8D4A0]" />
              </div>
            </div>
          </>
        )}
      </section>

      {/* 4) 쿠폰 현황 */}
      <section className="rounded-2xl border border-[#D4E4BC] bg-white p-5">
        <h2 className="text-sm font-bold text-[#2D5A3D] flex items-center gap-1.5 mb-4">
          <span>🎟️</span>
          <span>쿠폰 현황</span>
        </h2>
        {!coupons.ok || !deliveries.ok ? (
          <MigrationNotice table="coupons / coupon_deliveries" />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4 mb-4">
              <StatCell label="활성 쿠폰" value={`${couponStats.active}개`} tone="green" />
              <StatCell label="총 발송" value={`${num(couponStats.delivered)}건`} tone="forest" />
              <StatCell label="사용 완료" value={`${num(couponStats.used)}건`} tone="acorn" />
              <StatCell label="사용률" value={`${couponStats.usageRate}%`} tone="forest" />
            </div>
            <div className="rounded-xl bg-[#F8F6F2] p-3 border border-[#E5D3B8]">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold text-[#6B4423]">전체 사용률</span>
                <span className="text-[11px] font-bold text-[#2D5A3D]">{couponStats.usageRate}%</span>
              </div>
              <div className="h-3 bg-white rounded-full overflow-hidden border border-[#E5D3B8]">
                <div
                  className="h-full bg-gradient-to-r from-[#3A7A52] to-[#4A7C59] transition-all"
                  style={{ width: `${couponStats.usageRate}%` }}
                />
              </div>
            </div>
          </>
        )}
      </section>

      {/* 5) 광고 현황 */}
      <section className="rounded-2xl border border-[#D4E4BC] bg-white p-5">
        <h2 className="text-sm font-bold text-[#2D5A3D] flex items-center gap-1.5 mb-4">
          <span>📣</span>
          <span>광고 현황 (숲속 정령)</span>
        </h2>
        {!ads.ok ? (
          <MigrationNotice table="ad_campaigns" />
        ) : (
          <>
            <div className="flex flex-wrap gap-2 mb-4">
              <StatusPill label="활성" count={adStats.active} color="bg-green-100 text-green-700" />
              <StatusPill label="검토 대기" count={adStats.pending} color="bg-yellow-100 text-yellow-700" />
              <StatusPill label="초안" count={adStats.draft} color="bg-neutral-100 text-neutral-600" />
              <StatusPill label="전체" count={adStats.total} color="bg-blue-100 text-blue-700" />
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              <StatCell label="총 예산" value={won(adStats.totalBudget)} tone="acorn" />
              <StatCell label="집행 금액" value={won(adStats.totalSpent)} tone="acorn" />
              <StatCell
                label="집행률"
                value={`${
                  adStats.totalBudget === 0 ? 0 : Math.round((adStats.totalSpent / adStats.totalBudget) * 100)
                }%`}
                tone="forest"
              />
            </div>
          </>
        )}
      </section>

      {/* 6) 길드 & 챌린지 */}
      <section className="rounded-2xl border border-[#D4E4BC] bg-white p-5">
        <h2 className="text-sm font-bold text-[#2D5A3D] flex items-center gap-1.5 mb-4">
          <span>🏡</span>
          <span>길드 & 챌린지</span>
        </h2>
        {!guilds.ok || !challenges.ok ? (
          <MigrationNotice table="guilds / challenges" />
        ) : (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <StatCell label="길드 수" value={`${guildChallengeStats.guilds}개`} tone="forest" />
            <StatCell label="길드 멤버" value={`${guildChallengeStats.guildMembers}명`} tone="forest" />
            <StatCell label="평균 참여도" value={`${guildChallengeStats.avgGuildSize}명`} tone="neutral" />
            <StatCell label="진행중 챌린지" value={`${guildChallengeStats.activeChallenges}개`} tone="green" />
            <StatCell label="종료 챌린지" value={`${guildChallengeStats.endedChallenges}개`} tone="neutral" />
          </div>
        )}
      </section>

      {/* 푸터 안내 */}
      <div className="rounded-2xl border border-[#E5D3B8] bg-gradient-to-br from-[#FFF8F0] to-[#F5E6D3] p-5 text-center">
        <div className="text-2xl mb-1">🌳</div>
        <p className="text-[11px] text-[#8B6F47] leading-relaxed">
          모든 수치는 실시간 데이터베이스 기준입니다. Phase C 테이블이 마이그레이션되지 않은 경우 해당 섹션은 안내가 표시됩니다.
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────
// 서브 컴포넌트 (서버 컴포넌트, use client 없음)
// ─────────────────────────────

function StatCell({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "forest" | "green" | "neutral" | "red" | "acorn";
}) {
  const toneMap: Record<string, string> = {
    forest: "bg-[#E8F0E4] text-[#2D5A3D] border-[#B8D4A0]",
    green: "bg-green-50 text-green-700 border-green-200",
    neutral: "bg-neutral-50 text-neutral-700 border-neutral-200",
    red: "bg-red-50 text-red-700 border-red-200",
    acorn: "bg-[#FFF8F0] text-[#6B4423] border-[#E5D3B8]",
  };
  return (
    <div className={`rounded-xl border p-3 ${toneMap[tone]}`}>
      <div className="text-[10px] font-semibold opacity-80">{label}</div>
      <div className="mt-1 text-2xl font-extrabold">{value}</div>
    </div>
  );
}

function TierCard({ icon, label, count, color }: { icon: string; label: string; count: number; color: string }) {
  return (
    <div className={`rounded-xl border p-3 text-center ${color}`}>
      <div className="text-2xl">{icon}</div>
      <div className="text-[10px] font-semibold mt-1">{label}</div>
      <div className="text-xl font-extrabold mt-0.5">{count}</div>
    </div>
  );
}

function StatusPill({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${color}`}>
      {label} · {count}
    </span>
  );
}

function MigrationNotice({ table }: { table: string }) {
  return (
    <div className="rounded-xl bg-yellow-50 border border-yellow-200 p-4 text-center">
      <div className="text-2xl mb-1">⚠️</div>
      <p className="text-xs font-semibold text-yellow-800">아직 마이그레이션되지 않음</p>
      <p className="mt-1 text-[11px] text-yellow-700">
        <code className="bg-yellow-100 px-1.5 py-0.5 rounded font-mono">{table}</code> 테이블이 없거나 접근할 수 없어요
      </p>
      <p className="mt-2 text-[10px] text-yellow-600">Phase C 마이그레이션을 실행하면 자동으로 표시됩니다</p>
    </div>
  );
}
