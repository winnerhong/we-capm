import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getParticipant } from "@/lib/participant-session";
import { SubscriptionActions } from "./subscription-actions";

export const dynamic = "force-dynamic";

type SubscriptionRow = {
  id: string;
  participant_phone: string;
  tier: "SPROUT" | "TREE" | "FOREST";
  monthly_price: number;
  monthly_acorns: number;
  status: "ACTIVE" | "PAUSED" | "CANCELED";
  started_at: string;
  next_billing_at: string;
  canceled_at: string | null;
  auto_renew: boolean;
};

const TIER_META: Record<
  SubscriptionRow["tier"],
  { emoji: string; name: string; benefits: string[]; accent: string; cardBg: string }
> = {
  SPROUT: {
    emoji: "🌱",
    name: "새싹 플랜",
    benefits: [
      "월 2회 다람이 참여 가능",
      "🌰 매월 도토리 500개",
      "기본 사진 무료",
      "일반 대비 27% 할인",
    ],
    accent: "text-[#4A7C59]",
    cardBg: "from-[#D4E4BC] via-[#FFF8F0] to-[#EAF3DE]",
  },
  TREE: {
    emoji: "🌳",
    name: "나무 플랜",
    benefits: [
      "월 4회 다람이 참여 가능",
      "🌰 매월 도토리 1,200개",
      "기본 사진 + 영상 무료",
      "우선 예약권",
      "가맹점 쿠폰 월 3장",
    ],
    accent: "text-[#2D5A3D]",
    cardBg: "from-[#BFDAA8] via-[#FFF8F0] to-[#D4E4BC]",
  },
  FOREST: {
    emoji: "🏞️",
    name: "숲 플랜 VIP",
    benefits: [
      "월 무제한 다람이 참여",
      "🌰 매월 도토리 2,500개",
      "📦 월간 구독 박스",
      "🎁 오늘 사진 1회 무료",
      "전담 매니저 케어",
      "가족 2팀까지 공동 사용",
    ],
    accent: "text-[#8B6F47]",
    cardBg: "from-[#E6D3B8] via-[#FFF8F0] to-[#F5E4CB]",
  },
};

function formatKoreanDate(iso: string): string {
  try {
    const d = new Date(iso);
    return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
  } catch {
    return iso;
  }
}

function daysUntil(iso: string): number {
  try {
    const d = new Date(iso).getTime();
    const now = Date.now();
    return Math.max(0, Math.ceil((d - now) / (1000 * 60 * 60 * 24)));
  } catch {
    return 0;
  }
}

export default async function SubscriptionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: eventId } = await params;
  const p = await getParticipant(eventId);
  if (!p) redirect(`/event/${eventId}/join`);

  const supabase = await createClient();
  const anyClient = supabase as unknown as {
    from: (t: string) => {
      select: (cols: string) => {
        eq: (col: string, val: unknown) => {
          order: (col: string, opts: { ascending: boolean }) => {
            limit: (n: number) => {
              maybeSingle: () => Promise<{ data: SubscriptionRow | null; error: unknown }>;
            };
          };
        };
      };
    };
  };

  // Get latest ACTIVE or PAUSED subscription for this phone
  const { data: sub } = await anyClient
    .from("subscriptions")
    .select(
      "id, participant_phone, tier, monthly_price, monthly_acorns, status, started_at, next_billing_at, canceled_at, auto_renew",
    )
    .eq("participant_phone", p.phone)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const activeSub: SubscriptionRow | null =
    sub && sub.status !== "CANCELED" ? sub : null;

  return (
    <main className="min-h-dvh bg-[#FFF8F0] pb-24">
      {/* 헤더 */}
      <header className="sticky top-0 z-10 border-b border-[#E6D3B8]/60 bg-[#FFF8F0]/90 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-2">
          <Link
            href={`/event/${eventId}`}
            aria-label="뒤로 가기"
            className="flex h-9 w-9 items-center justify-center rounded-full text-[#2D5A3D] transition-colors hover:bg-[#D4E4BC]/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
          >
            <span aria-hidden="true">←</span>
          </Link>
          <h1 className="text-sm font-bold text-[#2D5A3D]">🌳 내 구독</h1>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 pt-6">
        {!activeSub ? (
          <EmptyState eventId={eventId} />
        ) : (
          <CurrentSubscription eventId={eventId} sub={activeSub} />
        )}
      </div>
    </main>
  );
}

function EmptyState({ eventId }: { eventId: string }) {
  return (
    <section className="rounded-3xl border border-[#E6D3B8] bg-white p-8 text-center shadow-sm">
      <div className="text-5xl" aria-hidden="true">
        🌰
      </div>
      <h2 className="mt-3 text-xl font-bold text-[#2D5A3D]">
        아직 구독하지 않으셨어요
      </h2>
      <p className="mt-2 text-sm text-[#6B6560]">
        나만의 숲길을 구독하고 매달 특별한 혜택을 받아보세요.
      </p>
      <Link
        href={`/event/${eventId}/subscribe`}
        className="mt-6 inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#2D5A3D] to-[#4A7C59] px-6 py-3 text-sm font-bold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus-visible:ring-4 focus-visible:ring-violet-300"
      >
        🌳 구독 시작하기 <span aria-hidden="true">→</span>
      </Link>
    </section>
  );
}

function CurrentSubscription({
  eventId,
  sub,
}: {
  eventId: string;
  sub: SubscriptionRow;
}) {
  const meta = TIER_META[sub.tier];
  const isPaused = sub.status === "PAUSED";
  const daysLeft = daysUntil(sub.next_billing_at);

  return (
    <div className="space-y-6">
      {/* 현재 플랜 카드 */}
      <section
        aria-labelledby="current-plan-title"
        className={`rounded-3xl bg-gradient-to-br ${meta.cardBg} p-6 shadow-sm`}
      >
        <div className="flex items-center gap-3">
          <span className="text-4xl" aria-hidden="true">
            {meta.emoji}
          </span>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#6B6560]">
              현재 플랜
            </p>
            <h2
              id="current-plan-title"
              className={`text-xl font-extrabold ${meta.accent}`}
            >
              {meta.name}
            </h2>
          </div>
          <div className="ml-auto">
            {isPaused ? (
              <span className="inline-flex items-center rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">
                ⏸ 일시 정지
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full bg-[#2D5A3D]/10 px-3 py-1 text-xs font-bold text-[#2D5A3D]">
                ● 이용 중
              </span>
            )}
          </div>
        </div>

        <div className="mt-5 flex items-baseline gap-1">
          <span className={`text-3xl font-extrabold ${meta.accent}`}>
            {sub.monthly_price.toLocaleString("ko-KR")}
          </span>
          <span className="text-sm text-[#6B6560]">원 / 월</span>
        </div>

        <ul className="mt-4 grid gap-2">
          {meta.benefits.map((b) => (
            <li
              key={b}
              className="flex items-start gap-2 text-sm text-[#3C3731]"
            >
              <span
                aria-hidden="true"
                className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-white/80 text-xs font-bold text-[#2D5A3D]"
              >
                ✓
              </span>
              <span>{b}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* 다음 결제일 */}
      <section
        aria-labelledby="next-billing-title"
        className="rounded-3xl border border-[#E6D3B8] bg-white p-5 shadow-sm"
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <p
              id="next-billing-title"
              className="text-xs font-semibold text-[#6B6560]"
            >
              다음 결제일
            </p>
            <p className="mt-1 text-lg font-bold text-[#2D5A3D]">
              {formatKoreanDate(sub.next_billing_at)}
            </p>
          </div>
          <div className="rounded-2xl bg-[#FFF8F0] px-4 py-2 text-center">
            <p className="text-[10px] text-[#6B6560]">남은 일수</p>
            <p className="text-lg font-extrabold text-[#2D5A3D]">
              {daysLeft}일
            </p>
          </div>
        </div>
        <p className="mt-3 text-[11px] text-[#6B6560]">
          {sub.auto_renew
            ? "자동 갱신이 켜져 있어요. 다음 결제일에 자동으로 갱신됩니다."
            : "자동 갱신이 꺼져 있어요. 구독이 만료되면 혜택이 종료됩니다."}
        </p>
      </section>

      {/* 이번 달 사용 현황 (mock) */}
      <section
        aria-labelledby="usage-title"
        className="rounded-3xl border border-[#E6D3B8] bg-white p-5 shadow-sm"
      >
        <h3
          id="usage-title"
          className="text-sm font-bold text-[#2D5A3D]"
        >
          🌿 이번 달 이용 현황
        </h3>
        <div className="mt-4 grid grid-cols-3 gap-3">
          <UsageCell label="참여" value="2" unit="회" />
          <UsageCell
            label="도토리"
            value={sub.monthly_acorns.toLocaleString("ko-KR")}
            unit="개"
          />
          <UsageCell label="쿠폰" value="1" unit="장" />
        </div>
        <p className="mt-3 text-[10px] text-[#8B6F47]">
          · 이용 현황은 예시 데이터입니다
        </p>
      </section>

      {/* 액션 */}
      <SubscriptionActions
        eventId={eventId}
        subId={sub.id}
        status={sub.status}
      />

      {/* 하단 안내 */}
      <p className="text-center text-[10px] text-[#8B6F47]">
        구독 시작일: {formatKoreanDate(sub.started_at)}
      </p>
    </div>
  );
}

function UsageCell({
  label,
  value,
  unit,
}: {
  label: string;
  value: string;
  unit: string;
}) {
  return (
    <div className="rounded-2xl bg-[#FFF8F0] p-3 text-center">
      <p className="text-[10px] text-[#6B6560]">{label}</p>
      <p className="mt-1 text-lg font-extrabold text-[#2D5A3D]">
        {value}
        <span className="ml-0.5 text-xs font-normal text-[#6B6560]">
          {unit}
        </span>
      </p>
    </div>
  );
}
