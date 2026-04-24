// 서버 컴포넌트 — ReviewSubmissionItem 배열을 카드 리스트로 렌더
import type { ReviewSubmissionItem } from "@/lib/missions/review-queries";
import type { ReviewTab } from "./review-layout";
import { ReviewItemCard } from "./review-item-card";

type Props = {
  items: ReviewSubmissionItem[];
  tab: ReviewTab;
};

export function ReviewList({ items, tab }: Props) {
  return (
    <ul className="space-y-3 md:space-y-4">
      {items.map((item) => (
        <li key={item.id}>
          <ReviewItemCard item={item} tab={tab} />
        </li>
      ))}
    </ul>
  );
}
