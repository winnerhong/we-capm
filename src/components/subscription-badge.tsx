import { createClient } from "@/lib/supabase/server";

type SubRow = {
  tier: "SPROUT" | "TREE" | "FOREST";
  status: "ACTIVE" | "PAUSED" | "CANCELED";
};

const BADGE_META: Record<
  SubRow["tier"],
  { emoji: string; label: string; className: string }
> = {
  SPROUT: {
    emoji: "🌱",
    label: "새싹",
    className:
      "border-[#A8C686] bg-[#D4E4BC] text-[#4A7C59]",
  },
  TREE: {
    emoji: "🌳",
    label: "나무",
    className:
      "border-[#2D5A3D] bg-gradient-to-r from-[#2D5A3D] to-[#4A7C59] text-white",
  },
  FOREST: {
    emoji: "🏞️",
    label: "숲 VIP",
    className:
      "border-[#C4956A] bg-gradient-to-r from-[#C4956A] to-[#8B6F47] text-white",
  },
};

/**
 * 현재 활성 구독 티어를 보여주는 작은 뱃지.
 * - 서버 컴포넌트: phone 으로 최신 구독을 조회
 * - 구독 없음 → null 반환 (렌더 안 됨)
 * - PAUSED 상태도 표시하되 "⏸" 표시
 */
export async function SubscriptionBadge({ phone }: { phone: string }) {
  if (!phone) return null;

  const supabase = await createClient();
  const anyClient = supabase as unknown as {
    from: (t: string) => {
      select: (cols: string) => {
        eq: (col: string, val: unknown) => {
          order: (col: string, opts: { ascending: boolean }) => {
            limit: (n: number) => {
              maybeSingle: () => Promise<{ data: SubRow | null; error: unknown }>;
            };
          };
        };
      };
    };
  };

  const { data: sub } = await anyClient
    .from("subscriptions")
    .select("tier, status")
    .eq("participant_phone", phone)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!sub || sub.status === "CANCELED") return null;

  const meta = BADGE_META[sub.tier];
  const paused = sub.status === "PAUSED";

  return (
    <span
      aria-label={`구독 티어: ${meta.label}${paused ? " (일시 정지)" : ""}`}
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-bold shadow-sm ${meta.className} ${
        paused ? "opacity-60" : ""
      }`}
    >
      <span aria-hidden="true">{paused ? "⏸" : meta.emoji}</span>
      <span>{meta.label}</span>
    </span>
  );
}
