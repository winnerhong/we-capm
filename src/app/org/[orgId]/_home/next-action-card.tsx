import Link from "next/link";
import type { OrgHomeDashboard } from "@/lib/org-home/types";

type Props = {
  action: OrgHomeDashboard["nextAction"];
  orgId: string;
};

const ACCENT_BG: Record<
  NonNullable<Props["action"]>["accent"],
  { bg: string; border: string; title: string; body: string }
> = {
  amber: {
    bg: "from-[#FEF3C7] to-[#FDE68A]",
    border: "border-[#F59E0B]/40",
    title: "text-[#78350F]",
    body: "text-[#92400E]",
  },
  pink: {
    bg: "from-[#FCE7F3] to-[#FBCFE8]",
    border: "border-[#EC4899]/30",
    title: "text-[#831843]",
    body: "text-[#9D174D]",
  },
  green: {
    bg: "from-[#E8F0E4] to-[#D4E4BC]",
    border: "border-[#4A7C59]/30",
    title: "text-[#2D5A3D]",
    body: "text-[#3A7A52]",
  },
  violet: {
    bg: "from-[#EDE9FE] to-[#DDD6FE]",
    border: "border-[#8B5CF6]/30",
    title: "text-[#4C1D95]",
    body: "text-[#5B21B6]",
  },
  zinc: {
    bg: "from-[#F4F4F5] to-[#E4E4E7]",
    border: "border-[#71717A]/30",
    title: "text-[#18181B]",
    body: "text-[#3F3F46]",
  },
  cyan: {
    bg: "from-[#CFFAFE] to-[#A5F3FC]",
    border: "border-[#06B6D4]/30",
    title: "text-[#164E63]",
    body: "text-[#155E75]",
  },
};

const KIND_EMOJI: Record<
  NonNullable<Props["action"]>["kind"],
  string
> = {
  PENDING_OLD: "⏳",
  PROFILE: "🌱",
  DRAFT_EVENT: "🚀",
  NO_PARTICIPANTS: "🌱",
  DOCUMENTS: "📄",
  BROADCAST_READY: "📣",
  NONE: "✨",
};

export function NextActionCard({ action, orgId: _orgId }: Props) {
  if (!action) {
    return (
      <section className="rounded-3xl border border-[#D4E4BC] bg-gradient-to-br from-[#E8F0E4] to-[#F5F1E8] p-5 shadow-sm">
        <p className="text-base font-bold text-[#2D5A3D]">
          🎉 오늘은 한가로워요
        </p>
        <p className="mt-1 text-xs text-[#6B6560]">
          급한 일이 없어요. 차 한 잔 어떠세요?
        </p>
      </section>
    );
  }

  const tone = ACCENT_BG[action.accent];
  const emoji = KIND_EMOJI[action.kind];

  return (
    <section
      className={`rounded-3xl border bg-gradient-to-br p-5 shadow-sm ${tone.bg} ${tone.border}`}
    >
      <div className="flex items-start gap-4">
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/60 text-2xl shadow-sm"
          aria-hidden
        >
          {emoji}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className={`text-base font-extrabold ${tone.title}`}>
            {action.title}
          </h2>
          <p className={`mt-1 text-xs leading-relaxed ${tone.body}`}>
            {action.description}
          </p>
        </div>
      </div>

      {typeof action.progressPct === "number" && (
        <div
          className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white/60"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(action.progressPct)}
          aria-label="진행도"
        >
          <div
            className="h-full rounded-full bg-[#2D5A3D] transition-all"
            style={{ width: `${Math.max(0, Math.min(100, action.progressPct))}%` }}
          />
        </div>
      )}

      <div className="mt-4 flex justify-end">
        <Link
          href={action.ctaHref}
          className="inline-flex items-center gap-1 rounded-2xl bg-[#2D5A3D] px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-[#234a30] active:scale-[0.98]"
        >
          {action.ctaLabel}
          <span aria-hidden>→</span>
        </Link>
      </div>
    </section>
  );
}
