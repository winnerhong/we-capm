import { redirect } from "next/navigation";

// 기존 /partner/marketing/reviews 는 /partner/analytics/reviews 로 이관되었습니다.
export default function LegacyReviewsRedirect(): never {
  redirect("/partner/analytics/reviews");
}
