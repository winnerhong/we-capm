import Link from "next/link";
import type { OrgHomeDashboard } from "@/lib/org-home/types";

type Props = {
  fm: OrgHomeDashboard["fm"];
  orgId: string;
};

function fmtTime(iso: string | null): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString("ko-KR", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

export function ToriFmCard({ fm, orgId }: Props) {
  const href = `/org/${orgId}/tori-fm`;

  let title: string;
  let body: React.ReactNode;
  let cta: string;
  let emoji: string;

  if (fm.mode === "LIVE") {
    emoji = "🔴";
    title = fm.sessionName ?? "토리FM";
    body = (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-[#ff5a5a]/15 px-2.5 py-1 text-[11px] font-bold text-[#B91C1C]">
        <span
          className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-[#ff5a5a]"
          aria-hidden
        />
        지금 방송중
      </span>
    );
    cta = "FM 제어실 →";
  } else if (fm.mode === "UPCOMING") {
    emoji = "📅";
    title = fm.sessionName ?? "다음 방송";
    body = (
      <p className="text-xs text-[#6B4423]">
        다음 방송 · {fmtTime(fm.scheduledStart)}
      </p>
    );
    cta = "제어실 준비 →";
  } else {
    emoji = "🎙";
    title = "첫 FM 세션 만들기";
    body = (
      <p className="text-xs text-[#6B4423]">
        토리와 함께 즐거운 방송을 시작해 보세요
      </p>
    );
    cta = "제어실 →";
  }

  return (
    <section className="rounded-3xl bg-gradient-to-br from-[#FCE7F3] to-[#FAE7D0] p-5 shadow-sm">
      <div className="flex items-start gap-4">
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/70 text-2xl shadow-sm"
          aria-hidden
        >
          {emoji}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold text-[#9D174D]">
            📻 토리FM
          </p>
          <h2 className="mt-0.5 truncate text-base font-extrabold text-[#831843]">
            {title}
          </h2>
          <div className="mt-2">{body}</div>
        </div>
      </div>

      <div className="mt-4 flex justify-end">
        <Link
          href={href}
          className="inline-flex items-center gap-1 rounded-2xl bg-[#831843] px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-[#6B133A] active:scale-[0.98]"
        >
          {cta}
        </Link>
      </div>
    </section>
  );
}
