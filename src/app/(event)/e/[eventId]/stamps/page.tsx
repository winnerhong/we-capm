import { redirect } from "next/navigation";
import { eventHref } from "@/lib/event-context";

export const dynamic = "force-dynamic";

/** 스탬프 탭은 스탬프북으로 바로 보낸다 (행사 안에서). */
export default async function StampsPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  redirect(eventHref(eventId, "/stampbook"));
}
