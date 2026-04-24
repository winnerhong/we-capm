import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ChargeAcornsForm } from "./charge-form";
import { AcornIcon } from "@/components/acorn-icon";

export const dynamic = "force-dynamic";

export default async function ChargeAcornsPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const supabase = await createClient();

  const { data: event } = await supabase
    .from("events")
    .select("id, name")
    .eq("id", eventId)
    .single();
  if (!event) notFound();

  const [{ count: familyCount }, { count: missionCount }] = await Promise.all([
    supabase
      .from("event_registrations")
      .select("*", { count: "exact", head: true })
      .eq("event_id", eventId),
    supabase
      .from("missions")
      .select("*", { count: "exact", head: true })
      .eq("event_id", eventId)
      .eq("is_active", true),
  ]);

  const families = familyCount ?? 0;
  const missions = missionCount ?? 5;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-extrabold text-blue-800">
            <span aria-hidden><AcornIcon size={24} /></span>
            <span>행사 도토리 충전</span>
          </h1>
          <p className="mt-1 text-sm text-[#6B6560]">
            {event.name} — 참가자 보상에 쓸 도토리를 미리 충전해두세요
          </p>
        </div>
        <Link
          href={`/manager/${eventId}/billing`}
          className="text-sm font-medium text-blue-700 hover:underline"
        >
          ← 결제 허브
        </Link>
      </div>

      {/* Estimator */}
      <section className="rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 to-white p-5 shadow-sm">
        <h2 className="flex items-center gap-2 text-sm font-bold text-blue-800">
          <span aria-hidden>🧮</span>
          <span>우리 행사에 몇 도토리가 필요할까?</span>
        </h2>
        <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="rounded-xl bg-white p-3 text-center">
            <div className="text-[11px] text-[#6B6560]">참가 가족</div>
            <div className="mt-1 text-lg font-bold text-blue-800">{families}명</div>
          </div>
          <div className="rounded-xl bg-white p-3 text-center">
            <div className="text-[11px] text-[#6B6560]">미션 수</div>
            <div className="mt-1 text-lg font-bold text-blue-800">{missions}개</div>
          </div>
          <div className="rounded-xl bg-white p-3 text-center">
            <div className="text-[11px] text-[#6B6560]">평균 도토리</div>
            <div className="mt-1 inline-flex items-center gap-0.5 text-lg font-bold text-blue-800">10<AcornIcon /></div>
          </div>
          <div className="rounded-xl bg-blue-600 p-3 text-center text-white">
            <div className="text-[11px] opacity-80">추천 충전</div>
            <div className="mt-1 inline-flex items-center gap-0.5 text-lg font-bold">
              {(families * missions * 10).toLocaleString("ko-KR")}<AcornIcon />
            </div>
          </div>
        </div>
        <p className="mt-3 text-[11px] text-[#6B6560]">
          공식: 가족 수 × 미션 수 × 평균 10도토리. 실제 소요량은 운영 상황에 따라 달라져요.
        </p>
      </section>

      <ChargeAcornsForm eventId={eventId} recommendedAcorns={families * missions * 10} />

      {/* 안내 */}
      <section className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-[#FFF8F0] p-5">
        <h3 className="flex items-center gap-2 text-sm font-bold text-amber-800">
          <span aria-hidden>📜</span>
          <span>충전 안내</span>
        </h3>
        <ul className="mt-2 space-y-1 pl-5 text-[12px] text-amber-900 list-disc">
          <li className="flex items-center gap-1"><AcornIcon /> 1개 = 1,000원 (VAT 별도)</li>
          <li>30만원 이상 +10% · 100만원 이상 +15% · 300만원 이상 +20% 보너스</li>
          <li>결제 후 자동 충전되며, 행사 종료 시 미사용분은 내부 정책에 따라 처리됩니다</li>
          <li>세금계산서는 결제 확정 후 이메일로 발송되어요</li>
        </ul>
      </section>
    </div>
  );
}
