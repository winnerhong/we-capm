import { redirect } from "next/navigation";
import { requireOrg } from "@/lib/org-auth-guard";

// 신청곡 모더레이션 페이지는 관제실(FmStudioEmbed 안 RequestModerationList)로
// 통합되어 별도 페이지가 필요 없어졌다. 기존 링크 호환을 위해 관제실로 redirect.
export default async function RadioModerationPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  await requireOrg();
  redirect(`/org/${orgId}/control-room`);
}
