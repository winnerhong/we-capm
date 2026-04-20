import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getParticipant } from "@/lib/participant-session";
import { HelpAccordion } from "./help-accordion";

export const dynamic = "force-dynamic";

export default async function HelpPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = await getParticipant(id);
  if (!p) redirect("/join");

  const supabase = await createClient();
  const { data: event } = await supabase.from("events").select("id, name").eq("id", id).single();
  if (!event) notFound();

  return (
    <main className="min-h-dvh bg-gradient-to-br from-[#FFF8F0] via-[#F5EFE0] to-[#E8F0E4] p-4 pb-24">
      <div className="mx-auto max-w-lg space-y-4">
        {/* 헤더 */}
        <div className="rounded-2xl bg-gradient-to-br from-[#2D5A3D] via-[#3A7A52] to-[#4A7C59] p-5 text-white shadow-lg">
          <Link
            href={`/event/${id}`}
            className="mb-2 inline-flex items-center gap-1 text-xs opacity-80 hover:opacity-100"
          >
            ← 홈으로
          </Link>
          <h1 className="text-xl font-bold">🌲 토리로 사용법</h1>
          <p className="mt-1 text-sm opacity-90">
            궁금한 항목을 눌러보면 자세한 설명이 펼쳐져요
          </p>
        </div>

        {/* 다시 둘러보기 */}
        <Link
          href={`/event/${id}/welcome`}
          className="block rounded-2xl border border-[#D4E4BC] bg-white/80 p-4 hover:shadow-md"
        >
          <div className="flex items-center gap-3">
            <span className="text-2xl">🐿️</span>
            <div className="flex-1">
              <div className="font-bold text-[#2D5A3D]">토리와 다시 둘러보기</div>
              <p className="mt-0.5 text-xs text-[#6B6560]">환영 안내를 처음부터 다시 봐요</p>
            </div>
            <div className="text-[#6B6560]">→</div>
          </div>
        </Link>

        {/* FAQ 아코디언 */}
        <HelpAccordion eventId={id} />
      </div>
    </main>
  );
}
