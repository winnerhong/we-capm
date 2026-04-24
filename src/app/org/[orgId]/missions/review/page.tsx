// 기관 포털 "미션 검토" 페이지 — 탭 기반 UI
// - pending (검토 대기) / approved (오늘 승인) / rejected (반려)
//
// 데이터:
//   - loadPendingReviews: pending 탭 + 다른 탭에서도 카운트용으로 항상 로드
//   - 다른 탭은 해당 탭 로더만 호출
import { notFound } from "next/navigation";
import { requireOrg } from "@/lib/org-auth-guard";
import {
  loadPendingReviews,
  loadRecentlyApprovedToday,
  loadRecentlyRejected,
  type ReviewSubmissionItem,
} from "@/lib/missions/review-queries";
import { ReviewLayout, type ReviewTab } from "./review-layout";

export const dynamic = "force-dynamic";

function parseTab(raw: string | undefined): ReviewTab {
  if (raw === "approved" || raw === "rejected") return raw;
  return "pending";
}

export default async function OrgMissionReviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { orgId } = await params;
  const sp = await searchParams;
  const org = await requireOrg();

  if (org.orgId !== orgId) {
    notFound();
  }

  const tab: ReviewTab = parseTab(sp.tab);

  // pending 은 카운트용으로 항상 로드.
  // 선택 탭 데이터는 pending 탭이면 같은 결과 재사용, 아니면 별도 로드.
  let pendingItems: ReviewSubmissionItem[] = [];
  let items: ReviewSubmissionItem[] = [];

  if (tab === "pending") {
    pendingItems = await loadPendingReviews(orgId);
    items = pendingItems;
  } else if (tab === "approved") {
    const [pending, approved] = await Promise.all([
      loadPendingReviews(orgId),
      loadRecentlyApprovedToday(orgId),
    ]);
    pendingItems = pending;
    items = approved;
  } else {
    const [pending, rejected] = await Promise.all([
      loadPendingReviews(orgId),
      loadRecentlyRejected(orgId),
    ]);
    pendingItems = pending;
    items = rejected;
  }

  return (
    <ReviewLayout
      orgId={orgId}
      tab={tab}
      pendingCount={pendingItems.length}
      items={items}
    />
  );
}
