import Link from "next/link";
import type { OrgHomeDashboard } from "@/lib/org-home/types";

type Props = {
  preview: OrgHomeDashboard["controlRoomPreview"];
  orgId: string;
};

export function ControlRoomBanner({ preview, orgId }: Props) {
  return (
    <section
      className="overflow-hidden rounded-3xl border border-[#5EE9F0]/30 bg-gradient-to-br from-[#0A0F0D] via-[#121916] to-[#0A0F0D] p-5 text-white shadow-lg"
      style={{
        boxShadow:
          "0 10px 30px -10px rgba(94, 233, 240, 0.25), inset 0 1px 0 rgba(94, 233, 240, 0.08)",
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2
            className="text-2xl font-extrabold text-[#5EE9F0]"
            style={{ textShadow: "0 0 12px rgba(94, 233, 240, 0.5)" }}
          >
            🎛️ 관제실
          </h2>
          <p className="mt-1 text-xs text-[#7FA892]">
            실시간 전광판 · FM · 토리톡 · 스탬프 흐름
          </p>
        </div>
        {preview.fmLive && (
          <span
            className="inline-flex items-center gap-1.5 rounded-full border border-[#ff5a5a]/40 bg-[#1a0a0a] px-2.5 py-1 text-[10px] font-bold text-[#ff5a5a]"
            style={{ textShadow: "0 0 6px rgba(255, 90, 90, 0.5)" }}
          >
            <span
              className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-[#ff5a5a]"
              aria-hidden
            />
            FM LIVE
          </span>
        )}
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <NeonStat
          label="FM"
          value={preview.fmLive ? "🔴" : "⚫"}
          color={preview.fmLive ? "#ff5a5a" : "#5EE9F0"}
          isText
        />
        <NeonStat
          label="오늘 활동"
          value={String(preview.todayActive)}
          color="#a3f66b"
        />
        <NeonStat
          label="오늘 스탬프"
          value={String(preview.todayStamps)}
          color="#f5c451"
        />
      </div>

      <div className="mt-4 flex gap-2">
        <Link
          href={`/org/${orgId}/control-room`}
          className="flex-1 rounded-2xl bg-[#5EE9F0] px-4 py-2.5 text-center text-sm font-bold text-[#0A0F0D] shadow-md transition hover:bg-[#8af2f7] active:scale-[0.98]"
          style={{
            boxShadow: "0 4px 18px -4px rgba(94, 233, 240, 0.6)",
          }}
        >
          관제실 열기 →
        </Link>
        <Link
          href={`/org/${orgId}/control-room/tv`}
          className="rounded-2xl border border-[#5EE9F0]/40 bg-transparent px-4 py-2.5 text-center text-sm font-bold text-[#5EE9F0] transition hover:bg-[#5EE9F0]/10"
        >
          📺 TV 모드
        </Link>
      </div>
    </section>
  );
}

function NeonStat({
  label,
  value,
  color,
  isText,
}: {
  label: string;
  value: string;
  color: string;
  isText?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-white/5 bg-black/40 p-3 text-center">
      <p
        className={`font-mono font-bold tabular-nums ${
          isText ? "text-xl" : "text-lg"
        }`}
        style={{ color, textShadow: `0 0 10px ${color}80` }}
      >
        {value}
      </p>
      <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#7FA892]">
        {label}
      </p>
    </div>
  );
}
