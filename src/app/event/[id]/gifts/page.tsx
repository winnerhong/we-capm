import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getParticipant } from "@/lib/participant-session";
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { GiftQRModal } from "./gift-qr";

export const dynamic = "force-dynamic";

type CouponRow = {
  id: string;
  affiliate_name: string;
  title: string;
  description: string | null;
  discount_type: "PERCENT" | "AMOUNT" | "FREE";
  discount_value: number | null;
  category: "FOOD" | "CAFE" | "DESSERT" | "ACTIVITY" | "EDU" | "OTHER" | null;
  valid_until: string | null;
};

type DeliveryRow = {
  id: string;
  coupon_id: string;
  participant_phone: string;
  event_id: string | null;
  delivered_at: string;
  used_at: string | null;
  used_amount: number | null;
  coupons: CouponRow | null;
};

const CATEGORY_META: Record<string, { icon: string; label: string; tint: string; badge: string; border: string; text: string }> = {
  FOOD: {
    icon: "🍽️",
    label: "맛집",
    tint: "bg-[#FFF2E0]",
    badge: "bg-[#FFB774]",
    border: "border-[#FFB774]",
    text: "text-[#B25B00]",
  },
  CAFE: {
    icon: "☕",
    label: "카페",
    tint: "bg-[#F4ECE2]",
    badge: "bg-[#8B6F47]",
    border: "border-[#C4956A]",
    text: "text-[#6B4A2B]",
  },
  DESSERT: {
    icon: "🍰",
    label: "디저트",
    tint: "bg-[#FCE4EC]",
    badge: "bg-[#E87BA6]",
    border: "border-[#E87BA6]",
    text: "text-[#A03D68]",
  },
  ACTIVITY: {
    icon: "🎨",
    label: "액티비티",
    tint: "bg-[#E8F0E4]",
    badge: "bg-[#4A7C59]",
    border: "border-[#A8C686]",
    text: "text-[#2D5A3D]",
  },
  EDU: {
    icon: "📚",
    label: "교육",
    tint: "bg-[#E3EEFF]",
    badge: "bg-[#4A7AC4]",
    border: "border-[#7DA6E0]",
    text: "text-[#234F8E]",
  },
  OTHER: {
    icon: "🎁",
    label: "기타",
    tint: "bg-[#FFF8F0]",
    badge: "bg-[#C4956A]",
    border: "border-[#D4E4BC]",
    text: "text-[#6B6560]",
  },
};

function getCategoryMeta(cat: string | null) {
  return CATEGORY_META[cat ?? "OTHER"] ?? CATEGORY_META.OTHER;
}

function discountLabel(d: CouponRow): string {
  if (d.discount_type === "FREE") return "무료";
  if (d.discount_type === "PERCENT") return `${d.discount_value ?? 0}% 할인`;
  if (d.discount_type === "AMOUNT") return `${(d.discount_value ?? 0).toLocaleString("ko-KR")}원 할인`;
  return "할인";
}

function ddayLabel(validUntil: string | null): { text: string; urgent: boolean; expired: boolean } {
  if (!validUntil) return { text: "기간 제한 없음", urgent: false, expired: false };
  const now = new Date();
  const until = new Date(validUntil);
  const diffMs = until.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return { text: "기간 만료", urgent: false, expired: true };
  if (diffDays === 0) return { text: "오늘까지", urgent: true, expired: false };
  return { text: `D-${diffDays}`, urgent: diffDays <= 3, expired: false };
}

export default async function EventGiftsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const { tab } = await searchParams;
  const activeTab: "received" | "used" | "expired" = tab === "used" ? "used" : tab === "expired" ? "expired" : "received";

  const p = await getParticipant(id);
  if (!p) redirect("/join");

  const supabase = await createClient();

  const [eventRes, deliveryRes] = await Promise.all([
    supabase.from("events").select("id, name, location").eq("id", id).single(),
    supabase
      .from("coupon_deliveries")
      .select("id, coupon_id, participant_phone, event_id, delivered_at, used_at, used_amount, coupons(id, affiliate_name, title, description, discount_type, discount_value, category, valid_until)")
      .eq("participant_phone", p.phone)
      .eq("event_id", id)
      .order("delivered_at", { ascending: false }),
  ]);

  const event = eventRes.data;
  if (!event) notFound();

  // Supabase relation 타입 정규화 (coupons는 단일 객체)
  const rawDeliveries = (deliveryRes.data ?? []) as unknown as Array<
    Omit<DeliveryRow, "coupons"> & { coupons: CouponRow | CouponRow[] | null }
  >;
  const deliveries: DeliveryRow[] = rawDeliveries.map((d) => ({
    ...d,
    coupons: Array.isArray(d.coupons) ? (d.coupons[0] ?? null) : d.coupons,
  }));

  // 테이블이 아직 없거나 에러
  const tablesMissing =
    !!deliveryRes.error &&
    /(coupon_deliveries|coupons)/i.test(deliveryRes.error.message ?? "");

  const now = Date.now();
  const received: DeliveryRow[] = [];
  const used: DeliveryRow[] = [];
  const expired: DeliveryRow[] = [];

  for (const d of deliveries) {
    if (d.used_at) {
      used.push(d);
      continue;
    }
    const validUntil = d.coupons?.valid_until ? new Date(d.coupons.valid_until).getTime() : null;
    if (validUntil !== null && validUntil < now) {
      expired.push(d);
      continue;
    }
    received.push(d);
  }

  const visible = activeTab === "received" ? received : activeTab === "used" ? used : expired;

  return (
    <main className="min-h-dvh bg-neutral-50 pb-28">
      <RealtimeRefresh table="coupon_deliveries" />

      {/* 헤더 */}
      <div className="bg-gradient-to-br from-[#2D5A3D] via-[#3A7A52] to-[#4A7C59] px-4 pt-5 pb-8 text-white shadow-lg">
        <div className="mx-auto max-w-lg">
          <Link
            href={`/event/${id}`}
            className="inline-flex items-center gap-1 text-xs opacity-80 hover:opacity-100 mb-2"
          >
            ← 돌아가기
          </Link>
          <h1 className="text-2xl font-bold">🎁 오늘의 선물</h1>
          <p className="mt-1 text-sm opacity-90">숲길을 걸은 당신에게 전하는 감사</p>

          {/* 요약 카운트 */}
          <div className="mt-4 flex gap-2">
            <div className="flex-1 rounded-xl bg-white/20 p-3 text-center">
              <div className="text-xl font-bold">
                {received.length}
                <span className="ml-0.5 text-xs">개</span>
              </div>
              <div className="text-[11px] opacity-80">받은 선물</div>
            </div>
            <div className="flex-1 rounded-xl bg-white/20 p-3 text-center">
              <div className="text-xl font-bold">
                {used.length}
                <span className="ml-0.5 text-xs">개</span>
              </div>
              <div className="text-[11px] opacity-80">사용</div>
            </div>
            <div className="flex-1 rounded-xl bg-white/20 p-3 text-center">
              <div className="text-xl font-bold">
                {expired.length}
                <span className="ml-0.5 text-xs">개</span>
              </div>
              <div className="text-[11px] opacity-80">만료</div>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-lg px-4 -mt-3 space-y-4">
        {/* 탭 */}
        <div
          role="tablist"
          aria-label="선물 상태"
          className="flex rounded-2xl bg-white p-1 shadow-sm border border-[#D4E4BC]"
        >
          {(
            [
              { key: "received", label: "받은 선물", count: received.length },
              { key: "used", label: "사용한 선물", count: used.length },
              { key: "expired", label: "만료", count: expired.length },
            ] as const
          ).map((t) => {
            const active = activeTab === t.key;
            return (
              <Link
                key={t.key}
                role="tab"
                aria-selected={active}
                href={`/event/${id}/gifts?tab=${t.key}`}
                scroll={false}
                className={`flex-1 rounded-xl py-2 text-center text-xs font-semibold transition-all ${
                  active
                    ? "bg-[#2D5A3D] text-white shadow"
                    : "text-[#6B6560] hover:bg-[#F4ECE2]"
                }`}
              >
                {t.label}
                {t.count > 0 && (
                  <span
                    className={`ml-1 inline-block rounded-full px-1.5 py-0.5 text-[10px] ${
                      active ? "bg-white/20" : "bg-[#FFF8F0] text-[#C4956A]"
                    }`}
                  >
                    {t.count}
                  </span>
                )}
              </Link>
            );
          })}
        </div>

        {/* 테이블 없음 */}
        {tablesMissing && (
          <div className="rounded-2xl border-2 border-dashed border-[#D4E4BC] bg-white p-12 text-center">
            <div className="text-5xl mb-3">🌱</div>
            <h2 className="text-lg font-bold text-[#2D5A3D]">곧 열려요</h2>
            <p className="mt-2 text-sm text-[#6B6560]">오늘의 선물 기능을 준비하고 있어요</p>
          </div>
        )}

        {/* 빈 상태 */}
        {!tablesMissing && visible.length === 0 && (
          <div className="rounded-2xl border-2 border-dashed border-[#D4E4BC] bg-white p-12 text-center">
            <div className="text-5xl mb-3">🌱</div>
            <p className="text-sm text-[#2D5A3D] font-semibold">
              {activeTab === "received"
                ? "숲길을 걸어 선물을 모아보세요"
                : activeTab === "used"
                ? "아직 사용한 선물이 없어요"
                : "만료된 선물이 없어요"}
            </p>
            {activeTab === "received" && (
              <Link
                href={`/event/${id}/missions`}
                className="mt-4 inline-block rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-violet-700"
              >
                숲길 걸으러 가기 🐾
              </Link>
            )}
          </div>
        )}

        {/* 쿠폰 리스트 */}
        {!tablesMissing && visible.length > 0 && (
          <div className="space-y-3">
            {visible.map((d) => {
              const c = d.coupons;
              if (!c) return null;
              const meta = getCategoryMeta(c.category);
              const dday = ddayLabel(c.valid_until);
              const isUsed = !!d.used_at;
              const isExpired = dday.expired;
              const disabled = isUsed || isExpired;

              return (
                <article
                  key={d.id}
                  className={`relative overflow-hidden rounded-2xl border-2 ${meta.border} bg-white shadow-sm ${disabled ? "opacity-70" : ""}`}
                >
                  {/* 본체 */}
                  <div className={`p-4 ${meta.tint}`}>
                    <div className="flex items-start gap-3">
                      <div
                        className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl ${meta.badge} text-2xl`}
                      >
                        {meta.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className={`text-[11px] font-bold ${meta.text}`}>
                          {meta.label}
                        </div>
                        <h3 className="mt-0.5 text-base font-bold text-[#2C2C2C] truncate">
                          {c.title}
                        </h3>
                        <p className="mt-0.5 text-xs text-[#6B6560] truncate">
                          🏪 {c.affiliate_name}
                        </p>
                      </div>
                      <div
                        className={`flex-shrink-0 rounded-full ${meta.badge} px-3 py-1.5 text-sm font-bold text-white`}
                      >
                        {discountLabel(c)}
                      </div>
                    </div>

                    {c.description && (
                      <p className="mt-3 text-xs text-[#6B6560] line-clamp-2">
                        {c.description}
                      </p>
                    )}
                  </div>

                  {/* 티켓 구분선 (대시 + 반원 punch) */}
                  <div className="relative h-0">
                    <div
                      className="absolute inset-x-3 top-1/2 -translate-y-1/2 border-t-2 border-dashed"
                      style={{ borderColor: "#D4E4BC" }}
                    />
                    <div className="absolute -left-2 top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-neutral-50 border-2 border-[#D4E4BC]" />
                    <div className="absolute -right-2 top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-neutral-50 border-2 border-[#D4E4BC]" />
                  </div>

                  {/* 스터브 */}
                  <div className="bg-white p-3 pt-4 flex items-center gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[11px] font-bold ${
                            isUsed
                              ? "text-[#6B6560]"
                              : isExpired
                              ? "text-red-500"
                              : dday.urgent
                              ? "text-[#C4956A]"
                              : "text-[#2D5A3D]"
                          }`}
                        >
                          {isUsed
                            ? `✓ 사용 완료 · ${new Date(d.used_at!).toLocaleDateString("ko-KR")}`
                            : isExpired
                            ? "⏰ 기간 만료"
                            : `⏳ ${dday.text}`}
                        </span>
                      </div>
                      {!isUsed && !isExpired && c.valid_until && (
                        <p className="mt-0.5 text-[10px] text-[#A8A49F]">
                          {new Date(c.valid_until).toLocaleDateString("ko-KR")}까지
                        </p>
                      )}
                    </div>

                    {!disabled && (
                      <div className="w-32">
                        <GiftQRModal
                          deliveryId={d.id}
                          couponTitle={c.title}
                          affiliateName={c.affiliate_name}
                          discountLabel={discountLabel(c)}
                        />
                      </div>
                    )}
                    {isUsed && (
                      <div className="w-32 rounded-xl bg-[#D4E4BC] py-2.5 text-center text-xs font-bold text-[#2D5A3D]">
                        사용 완료
                      </div>
                    )}
                    {isExpired && !isUsed && (
                      <div className="w-32 rounded-xl bg-neutral-200 py-2.5 text-center text-xs font-bold text-[#6B6560]">
                        만료됨
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {/* 안내 */}
        {!tablesMissing && (
          <div className="rounded-2xl border border-[#D4E4BC] bg-white p-4">
            <h3 className="text-xs font-bold text-[#2D5A3D]">🌿 선물 이용 안내</h3>
            <ul className="mt-2 space-y-1 text-[11px] text-[#6B6560]">
              <li>• 가게에 방문해 QR을 보여주세요</li>
              <li>• 유효기간이 지나면 자동으로 만료돼요</li>
              <li>• 한 번 사용하면 다시 쓸 수 없어요</li>
            </ul>
          </div>
        )}
      </div>
    </main>
  );
}
