import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function HallOfFamePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/event/${id}/leaderboard`);
}
