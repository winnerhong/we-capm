import Link from "next/link";
import type { OrgHomeDashboard } from "@/lib/org-home/types";

type Props = {
  participants: OrgHomeDashboard["recentParticipants"];
  thisWeekSubmissions: number;
  totalParticipants: number;
  orgId: string;
};

function fmtJoinDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("ko-KR", {
      month: "2-digit",
      day: "2-digit",
    });
  } catch {
    return "";
  }
}

export function RecentParticipantsCard({
  participants,
  thisWeekSubmissions,
  totalParticipants,
  orgId,
}: Props) {
  const hasParticipants = participants.length > 0;

  return (
    <section className="rounded-3xl border border-[#D4E4BC] bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-bold text-[#2D5A3D]">
          🧑‍🤝‍🧑 최근 가입 가족
        </h2>
        {totalParticipants > 0 && (
          <span className="text-xs font-semibold text-[#6B6560]">
            전체 {totalParticipants}
          </span>
        )}
      </div>

      {hasParticipants ? (
        <ul className="mt-3 flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {participants.map((p) => (
            <li
              key={p.userId}
              className="flex min-w-[96px] snap-start flex-col items-center gap-1.5 rounded-2xl bg-[#F5F1E8] px-2 py-3"
            >
              <span
                className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-[#3A7A52] to-[#4A7C59] text-base font-bold text-white"
                aria-hidden
              >
                {p.avatarInitial}
              </span>
              <span className="max-w-[80px] truncate text-xs font-semibold text-[#2D5A3D]">
                {p.displayName}
              </span>
              <span className="text-[10px] text-[#6B6560]">
                {fmtJoinDate(p.joinedAt)}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 rounded-2xl bg-[#F5F1E8] py-5 text-center text-xs text-[#6B6560]">
          첫 가족이 들어올 준비 중이에요 🌱
        </p>
      )}

      <div className="mt-4 border-t border-[#D4E4BC] pt-3">
        <p className="text-xs font-semibold text-[#6B6560]">
          이번 주 제출{" "}
          <span className="tabular-nums text-[#2D5A3D]">
            {thisWeekSubmissions}
          </span>
          건 · 전체{" "}
          <span className="tabular-nums text-[#2D5A3D]">{totalParticipants}</span>{" "}
          가족
        </p>
        <div className="mt-3 flex gap-2">
          <Link
            href={`/org/${orgId}/users`}
            className="flex-1 rounded-xl bg-[#2D5A3D] px-3 py-2 text-center text-xs font-bold text-white transition hover:bg-[#234a30]"
          >
            전체 관리 →
          </Link>
          <Link
            href={`/org/${orgId}/missions/stats`}
            className="flex-1 rounded-xl border border-[#D4E4BC] bg-white px-3 py-2 text-center text-xs font-bold text-[#2D5A3D] transition hover:bg-[#F5F1E8]"
          >
            통계 보기
          </Link>
        </div>
      </div>
    </section>
  );
}
