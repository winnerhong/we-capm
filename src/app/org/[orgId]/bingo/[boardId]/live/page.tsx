// 별도 빙고 관제 페이지는 폐기 — 모든 진행 상황은 메인 관제실의 🎯 빙고 위젯에서 통합 관제.
// 기존 링크/북마크 호환을 위해 메인 관제실로 리다이렉트.

import { redirect } from "next/navigation";

export default async function DeprecatedBingoLivePage({
  params,
}: {
  params: Promise<{ orgId: string; boardId: string }>;
}) {
  const { orgId } = await params;
  redirect(`/org/${orgId}/control-room`);
}
