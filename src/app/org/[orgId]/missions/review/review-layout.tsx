// 서버 컴포넌트 — 검토 페이지 상단 구조(브레드크럼/헤더/탭)와 빈 상태 처리
import Link from "next/link";
import type { ReviewSubmissionItem } from "@/lib/missions/review-queries";
import { ReviewList } from "./review-list";

export type ReviewTab = "pending" | "approved" | "rejected";

type Props = {
  orgId: string;
  tab: ReviewTab;
  pendingCount: number;
  items: ReviewSubmissionItem[];
};

type TabDef = {
  key: ReviewTab;
  label: string;
  emoji: string;
};

const TABS: TabDef[] = [
  { key: "pending", label: "대기", emoji: "⏳" },
  { key: "approved", label: "오늘 승인", emoji: "✅" },
  { key: "rejected", label: "반려된 제출", emoji: "❌" },
];

const EMPTY_STATE: Record<ReviewTab, { icon: string; title: string; hint: string }> = {
  pending: {
    icon: "🎉",
    title: "검토 대기 없음 · 잠시 숨 돌리세요",
    hint: "참가자가 새로 제출하면 여기에 나타나요.",
  },
  approved: {
    icon: "🌱",
    title: "오늘은 아직 승인한 제출이 없어요",
    hint: "대기 탭에서 승인을 시작해 보세요.",
  },
  rejected: {
    icon: "🌲",
    title: "반려된 제출이 없어요",
    hint: "반려 처리한 건은 최근 30건까지 여기에 모여요.",
  },
};

const CSV_STATUS_LABEL: Record<ReviewTab, string> = {
  pending: "최근 30일 대기 내역 CSV",
  approved: "최근 30일 승인 내역 CSV",
  rejected: "최근 30일 반려 내역 CSV",
};

export function ReviewLayout({ orgId, tab, pendingCount, items }: Props) {
  const empty = EMPTY_STATE[tab];
  const csvHref = `/api/org/${orgId}/export/submissions?status=${tab}&days=30`;
  const csvLabel = CSV_STATUS_LABEL[tab];

  return (
    <div className="mx-auto max-w-6xl space-y-5 px-4 py-6 md:space-y-6 md:py-8">
      {/* 브레드크럼 */}
      <nav aria-label="breadcrumb" className="text-xs text-[#8B7F75]">
        <Link href={`/org/${orgId}`} className="hover:text-[#2D5A3D]">
          기관 홈
        </Link>
        <span className="mx-2" aria-hidden>
          /
        </span>
        <span className="font-semibold text-[#2D5A3D]">미션 검토</span>
      </nav>

      {/* 헤더 */}
      <header className="rounded-3xl border border-[#D4E4BC] bg-gradient-to-br from-[#FAE7D0] via-white to-[#E8F0E4] p-5 shadow-sm md:p-7">
        <div className="flex flex-wrap items-center gap-3">
          <span
            className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-white text-3xl shadow-sm"
            aria-hidden
          >
            🧐
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-bold text-[#2D5A3D] md:text-xl">
              미션 검토
            </h1>
            <p className="text-xs text-[#6B6560] md:text-sm">
              참가자가 올린 제출을 확인하고 도토리를 지급해요
            </p>
          </div>
          <a
            href={csvHref}
            download
            className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-xl border border-[#D4E4BC] bg-white px-3 py-2 text-xs font-bold text-[#2D5A3D] hover:bg-[#F5F1E8]"
            title={`현재 탭(${tab}) 기준 ${csvLabel}`}
          >
            <span aria-hidden>📥</span>
            <span>{csvLabel}</span>
          </a>
        </div>
      </header>

      {/* 탭 네비 */}
      <nav
        aria-label="검토 탭"
        className="flex flex-wrap gap-2"
      >
        {TABS.map((t) => {
          const isActive = t.key === tab;
          const showBadge = t.key === "pending";
          const badgeCount = pendingCount;
          const href =
            t.key === "pending"
              ? `/org/${orgId}/missions/review`
              : `/org/${orgId}/missions/review?tab=${t.key}`;
          return (
            <Link
              key={t.key}
              href={href}
              aria-current={isActive ? "page" : undefined}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-xs font-semibold transition md:text-sm ${
                isActive
                  ? "border-[#2D5A3D] bg-[#2D5A3D] text-white shadow-sm"
                  : "border-[#D4E4BC] bg-white text-[#2D5A3D] hover:bg-[#E8F0E4]"
              }`}
            >
              <span aria-hidden>{t.emoji}</span>
              <span>{t.label}</span>
              {showBadge && (
                <span
                  className={`inline-flex min-w-[1.25rem] items-center justify-center rounded-full px-1.5 text-[10px] font-bold ${
                    isActive
                      ? "bg-white/20 text-white"
                      : badgeCount > 0
                        ? "bg-[#FFC83D] text-[#2D5A3D]"
                        : "bg-[#F5F1E8] text-[#6B6560]"
                  }`}
                >
                  {badgeCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* 본문 */}
      {items.length === 0 ? (
        <div className="rounded-2xl border border-[#D4E4BC] bg-white p-10 text-center shadow-sm">
          <p className="text-4xl" aria-hidden>
            {empty.icon}
          </p>
          <p className="mt-3 text-sm font-bold text-[#2D5A3D] md:text-base">
            {empty.title}
          </p>
          <p className="mt-1 text-xs text-[#6B6560]">{empty.hint}</p>
        </div>
      ) : (
        <ReviewList items={items} tab={tab} />
      )}
    </div>
  );
}
