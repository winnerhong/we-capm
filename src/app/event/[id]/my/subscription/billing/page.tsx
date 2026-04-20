import Link from "next/link";
import { redirect } from "next/navigation";
import { getParticipant } from "@/lib/participant-session";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Tier = "SPROUT" | "TREE" | "FOREST";
type SubStatus = "ACTIVE" | "PAUSED" | "CANCELED";

const TIER_META: Record<Tier, { emoji: string; name: string; accent: string }> = {
  SPROUT: { emoji: "🌱", name: "새싹 플랜", accent: "text-[#4A7C59]" },
  TREE: { emoji: "🌳", name: "나무 플랜", accent: "text-[#2D5A3D]" },
  FOREST: { emoji: "🏞️", name: "숲 플랜 VIP", accent: "text-[#8B6F47]" },
};

const STATUS_META: Record<SubStatus, { label: string; chip: string }> = {
  ACTIVE: { label: "구독 중", chip: "bg-emerald-100 text-emerald-800" },
  PAUSED: { label: "일시 정지", chip: "bg-amber-100 text-amber-800" },
  CANCELED: { label: "해지됨", chip: "bg-rose-100 text-rose-700" },
};

function formatWon(amount: number | null | undefined): string {
  return `${(amount ?? 0).toLocaleString("ko-KR")}원`;
}

function formatKoreanDate(iso: string | null): string {
  if (!iso) return "-";
  try {
    const d = new Date(iso);
    return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
  } catch {
    return iso;
  }
}

function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  try {
    const diff = new Date(iso).getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  } catch {
    return null;
  }
}

export default async function SubscriptionBillingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: eventId } = await params;

  const session = await getParticipant(eventId);
  if (!session) redirect("/join");

  const supabase = await createClient();

  const { data: subscription } = await supabase
    .from("subscriptions")
    .select(
      "id, tier, monthly_price, monthly_acorns, status, started_at, next_billing_at, canceled_at, auto_renew"
    )
    .eq("participant_phone", session.phone)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // 구독 인보이스 이력
  const { data: invoices } = await supabase
    .from("invoices")
    .select(
      "id, invoice_number, description, total_amount, status, issued_at, paid_at"
    )
    .eq("target_type", "PARTICIPANT")
    .eq("target_phone", session.phone)
    .eq("category", "SUBSCRIPTION")
    .order("issued_at", { ascending: false })
    .limit(24);

  const hasSubscription = !!subscription;
  const tier = subscription ? TIER_META[subscription.tier as Tier] : null;
  const st = subscription ? STATUS_META[subscription.status as SubStatus] : null;
  const nextInDays = subscription ? daysUntil(subscription.next_billing_at) : null;

  return (
    <main className="min-h-dvh bg-neutral-50 p-4 pb-28">
      <div className="mx-auto max-w-lg space-y-4">
        {/* Header */}
        <div className="rounded-2xl bg-gradient-to-br from-[#2D5A3D] via-[#3A7A52] to-[#4A7C59] p-5 text-white shadow-lg">
          <div className="flex items-center gap-3">
            <div className="text-3xl">📆</div>
            <div>
              <h1 className="text-xl font-bold">구독 결제 관리</h1>
              <p className="mt-0.5 text-xs opacity-90">
                플랜·결제수단·청구서를 한 곳에서 관리해요
              </p>
            </div>
          </div>
        </div>

        {/* 현재 플랜 */}
        {hasSubscription && subscription && tier && st ? (
          <section className="rounded-2xl border border-[#D4E4BC] bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold text-[#8B7F75]">
                  현재 플랜
                </p>
                <p className={`mt-0.5 text-lg font-bold ${tier.accent}`}>
                  {tier.emoji} {tier.name}
                </p>
              </div>
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${st.chip}`}
              >
                {st.label}
              </span>
            </div>

            <dl className="mt-4 space-y-2.5 text-sm">
              <InfoRow
                label="월 구독료"
                value={formatWon(subscription.monthly_price)}
              />
              <InfoRow
                label="월 지급 도토리"
                value={`🌰 ${subscription.monthly_acorns.toLocaleString("ko-KR")}개`}
              />
              <InfoRow
                label="시작일"
                value={formatKoreanDate(subscription.started_at)}
              />
              <InfoRow
                label="다음 결제일"
                value={`${formatKoreanDate(subscription.next_billing_at)}${
                  nextInDays !== null ? ` (D-${nextInDays})` : ""
                }`}
                strong
              />
              <InfoRow
                label="자동 갱신"
                value={subscription.auto_renew ? "켜짐" : "꺼짐"}
              />
              {subscription.canceled_at && (
                <InfoRow
                  label="해지일"
                  value={formatKoreanDate(subscription.canceled_at)}
                />
              )}
            </dl>
          </section>
        ) : (
          <section className="rounded-2xl border border-dashed border-[#D4E4BC] bg-white p-8 text-center shadow-sm">
            <div className="text-4xl">🌱</div>
            <p className="mt-2 text-sm font-semibold text-[#2D5A3D]">
              아직 구독 중인 플랜이 없어요
            </p>
            <Link
              href={`/event/${eventId}/subscribe`}
              className="mt-4 inline-flex items-center justify-center rounded-xl bg-[#2D5A3D] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#1F3F2A]"
            >
              플랜 구독하러 가기
            </Link>
          </section>
        )}

        {/* 결제수단 (mock) */}
        <section className="rounded-2xl border border-[#D4E4BC] bg-white p-5 shadow-sm">
          <h2 className="mb-3 flex items-center gap-2 text-base font-bold text-[#2D5A3D]">
            <span>💳</span>
            <span>결제 수단</span>
          </h2>
          <div className="rounded-xl border border-[#E8E0D3] bg-[#FFF8F0] p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-[#2C2C2C]">
                  신용카드 (****-****-****-1234)
                </p>
                <p className="mt-0.5 text-[11px] text-[#8B7F75]">
                  토스 결제 · 매월 자동 결제
                </p>
              </div>
              <span className="text-xl" aria-hidden>
                💳
              </span>
            </div>
          </div>
          <button
            type="button"
            disabled
            aria-disabled="true"
            title="준비중입니다"
            className="mt-3 inline-flex w-full items-center justify-center gap-1 rounded-xl border border-[#D4E4BC] bg-white px-4 py-3 text-sm font-semibold text-[#6B6560] opacity-60"
          >
            결제 수단 변경 (준비중)
          </button>
        </section>

        {/* 청구서(인보이스) 이력 */}
        <section className="rounded-2xl border border-[#D4E4BC] bg-white p-5 shadow-sm">
          <h2 className="mb-3 flex items-center gap-2 text-base font-bold text-[#2D5A3D]">
            <span>🧾</span>
            <span>청구서 이력</span>
          </h2>
          {invoices && invoices.length > 0 ? (
            <ul className="space-y-2">
              {invoices.map((inv) => (
                <li
                  key={inv.id}
                  className="flex items-center justify-between rounded-xl border border-[#E8E0D3] bg-[#FFF8F0] p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[#2C2C2C]">
                      {inv.description ?? inv.invoice_number}
                    </p>
                    <p className="mt-0.5 text-[11px] text-[#8B7F75]">
                      {formatKoreanDate(inv.paid_at ?? inv.issued_at)} ·{" "}
                      {inv.status}
                    </p>
                  </div>
                  <div className="ml-3 flex items-center gap-2">
                    <span className="text-sm font-bold text-[#2D5A3D]">
                      {formatWon(inv.total_amount)}
                    </span>
                    <Link
                      href={`/event/${eventId}/my/payments/${inv.id}`}
                      className="rounded-lg border border-[#D4E4BC] bg-white px-2 py-1 text-[11px] font-semibold text-[#2D5A3D] hover:bg-[#E8F0E4]"
                    >
                      상세
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-[#8B7F75]">
              아직 발행된 청구서가 없어요.
            </p>
          )}
          <Link
            href={`/event/${eventId}/my/payments?tab=SUBSCRIPTION`}
            className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[#2D5A3D] hover:underline"
          >
            전체 결제 이력 보기 →
          </Link>
        </section>

        {/* 해지 */}
        {hasSubscription && subscription?.status === "ACTIVE" && (
          <section className="rounded-2xl border border-rose-200 bg-rose-50 p-5">
            <h2 className="mb-1 flex items-center gap-2 text-sm font-bold text-rose-800">
              <span>⚠️</span>
              <span>구독 해지</span>
            </h2>
            <p className="text-[11px] text-rose-700">
              해지하면 다음 결제일부터 청구가 중단되며, 현재 결제 기간까지는
              혜택이 유지돼요.
            </p>
            <Link
              href={`/event/${eventId}/subscription`}
              className="mt-3 inline-flex items-center justify-center rounded-xl border border-rose-300 bg-white px-4 py-2.5 text-sm font-semibold text-rose-700 hover:bg-rose-100"
            >
              구독 해지 화면으로
            </Link>
          </section>
        )}

        <div className="pt-2">
          <Link
            href={`/event/${eventId}/my`}
            className="inline-flex items-center gap-1 text-sm font-semibold text-[#2D5A3D] hover:underline"
          >
            ← 나의 숲 기록으로
          </Link>
        </div>
      </div>
    </main>
  );
}

function InfoRow({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-[#F0EBE3] pb-2 last:border-none last:pb-0">
      <dt className="text-xs font-semibold text-[#6B6560]">{label}</dt>
      <dd
        className={[
          "text-right text-sm",
          strong ? "font-bold text-[#2D5A3D]" : "font-medium text-[#2C2C2C]",
        ].join(" ")}
      >
        {value}
      </dd>
    </div>
  );
}
