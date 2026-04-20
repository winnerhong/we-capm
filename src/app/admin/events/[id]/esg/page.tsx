import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  calculateESGImpact,
  calculateYeouidoEquivalent,
  getESGGrade,
  getESGGradeColor,
} from "@/lib/esg-metrics";
import { ESGShareCard } from "./esg-share-card";

export const dynamic = "force-dynamic";

export default async function EventESGPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: event } = await supabase
    .from("events")
    .select("id, name, start_at, end_at, location, type, manager_id")
    .eq("id", id)
    .single();
  if (!event) notFound();

  const impact = await calculateESGImpact(supabase, { eventId: id });
  const grade = getESGGrade(impact.totalScore);
  const gradeColor = getESGGradeColor(grade);
  const yeouidoEq = calculateYeouidoEquivalent(impact.environmental.treesPlanted);

  // 기업(발주사)명 추정 — manager_id를 기업명으로 사용 (없으면 이벤트 이름)
  const companyName = event.manager_id || "귀사";

  const eventDate = new Date(event.start_at).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const envScore = Math.min(
    100,
    Math.round((impact.environmental.co2Saved / 1000) * 100 + (impact.environmental.treesPlanted / 100) * 20)
  );
  const socialScore = Math.min(
    100,
    Math.round(
      Math.min(70, (impact.social.familiesConnected / 200) * 70) + (impact.social.averageRating / 5) * 30
    )
  );
  const govScore = Math.min(
    100,
    Math.round(
      impact.governance.transparencyScore * 0.7 +
        Math.min(20, impact.governance.localBusinessesEngaged * 2) +
        Math.min(10, impact.governance.partnerPrograms)
    )
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link href={`/admin/events/${id}`} className="text-sm text-[#2D5A3D] hover:underline">
          ← 행사 상세
        </Link>
      </div>

      {/* 행사 정보 헤더 */}
      <header className="rounded-2xl bg-gradient-to-br from-[#1F3D2B] via-[#2D5A3D] to-[#4A7C59] p-6 text-white shadow-lg relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 opacity-20">
          <div className="absolute right-4 top-4 text-6xl">🌱</div>
        </div>
        <div className="relative z-10">
          <p className="text-[11px] tracking-[0.4em] opacity-70 font-light">EVENT ESG REPORT</p>
          <h1 className="text-2xl font-extrabold mt-1">{event.name}</h1>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs opacity-85">
            <span>📍 {event.location}</span>
            <span>🗓 {eventDate}</span>
            {event.manager_id && <span>🏢 {event.manager_id}</span>}
          </div>
        </div>
      </header>

      {/* 총 점수 */}
      <section className={`rounded-2xl border-2 ${gradeColor.border} bg-white p-6 shadow-sm`}>
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold tracking-widest text-[#6B6560]">ESG SCORE</p>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-5xl font-extrabold text-[#2D5A3D]">{impact.totalScore}</span>
              <span className="text-lg font-bold text-[#6B6560]">/100</span>
            </div>
          </div>
          <div
            className={`rounded-2xl border-2 ${gradeColor.border} ${gradeColor.bg} px-5 py-3 text-center shadow-sm`}
          >
            <div className={`text-3xl font-extrabold ${gradeColor.text}`}>{grade}</div>
            <div className={`mt-0.5 text-[10px] font-bold ${gradeColor.text} tracking-widest`}>GRADE</div>
          </div>
        </div>

        <div className="mt-5 space-y-2.5">
          <ScoreBar label="Environmental" emoji="🌳" value={envScore} color="bg-green-500" />
          <ScoreBar label="Social" emoji="🤝" value={socialScore} color="bg-sky-500" />
          <ScoreBar label="Governance" emoji="⚖️" value={govScore} color="bg-amber-500" />
        </div>
      </section>

      {/* Environmental */}
      <section className="rounded-2xl border border-green-200 bg-green-50/50 p-5">
        <h2 className="font-extrabold text-green-800 flex items-center gap-2">
          <span>🌳</span>
          <span>환경 임팩트</span>
        </h2>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-xl bg-white border border-green-200 p-3">
            <div className="text-[10px] font-bold uppercase text-green-700">CO2 절감</div>
            <div className="mt-1 text-xl font-extrabold text-green-900">
              {impact.environmental.co2Saved.toLocaleString("ko-KR")} kg
            </div>
          </div>
          <div className="rounded-xl bg-white border border-green-200 p-3">
            <div className="text-[10px] font-bold uppercase text-green-700">가상 나무</div>
            <div className="mt-1 text-xl font-extrabold text-green-900">
              {impact.environmental.treesPlanted.toLocaleString("ko-KR")} 그루
            </div>
          </div>
          <div className="rounded-xl bg-white border border-green-200 p-3">
            <div className="text-[10px] font-bold uppercase text-green-700">친환경 활동</div>
            <div className="mt-1 text-xl font-extrabold text-green-900">
              {impact.environmental.greenActivitiesHours.toLocaleString("ko-KR")} 시간
            </div>
          </div>
        </div>
        <p className="mt-3 text-xs text-green-800">
          → 여의도 공원 <strong>{yeouidoEq.toLocaleString("ko-KR")}개 면적</strong> 상당
        </p>
      </section>

      {/* Social */}
      <section className="rounded-2xl border border-sky-200 bg-sky-50/50 p-5">
        <h2 className="font-extrabold text-sky-800 flex items-center gap-2">
          <span>🤝</span>
          <span>사회 임팩트</span>
        </h2>
        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="rounded-xl bg-white border border-sky-200 p-3">
            <div className="text-[10px] font-bold uppercase text-sky-700">연결 가족</div>
            <div className="mt-1 text-xl font-extrabold text-sky-900">
              {impact.social.familiesConnected.toLocaleString("ko-KR")}
            </div>
          </div>
          <div className="rounded-xl bg-white border border-sky-200 p-3">
            <div className="text-[10px] font-bold uppercase text-sky-700">어린이</div>
            <div className="mt-1 text-xl font-extrabold text-sky-900">
              {impact.social.childrenParticipated.toLocaleString("ko-KR")}
            </div>
          </div>
          <div className="rounded-xl bg-white border border-sky-200 p-3">
            <div className="text-[10px] font-bold uppercase text-sky-700">협력 기관</div>
            <div className="mt-1 text-xl font-extrabold text-sky-900">
              {impact.social.schoolsSupported.toLocaleString("ko-KR")}
            </div>
          </div>
          <div className="rounded-xl bg-white border border-sky-200 p-3">
            <div className="text-[10px] font-bold uppercase text-sky-700">만족도</div>
            <div className="mt-1 text-xl font-extrabold text-sky-900">
              {impact.social.averageRating.toFixed(1)} / 5
            </div>
          </div>
        </div>
      </section>

      {/* Governance */}
      <section className="rounded-2xl border border-amber-200 bg-amber-50/50 p-5">
        <h2 className="font-extrabold text-amber-800 flex items-center gap-2">
          <span>⚖️</span>
          <span>거버넌스</span>
        </h2>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-xl bg-white border border-amber-200 p-3">
            <div className="text-[10px] font-bold uppercase text-amber-700">투명성</div>
            <div className="mt-1 text-xl font-extrabold text-amber-900">
              {impact.governance.transparencyScore}/100
            </div>
          </div>
          <div className="rounded-xl bg-white border border-amber-200 p-3">
            <div className="text-[10px] font-bold uppercase text-amber-700">지역 상공인</div>
            <div className="mt-1 text-xl font-extrabold text-amber-900">
              {impact.governance.localBusinessesEngaged.toLocaleString("ko-KR")}
            </div>
          </div>
          <div className="rounded-xl bg-white border border-amber-200 p-3">
            <div className="text-[10px] font-bold uppercase text-amber-700">파트너 프로그램</div>
            <div className="mt-1 text-xl font-extrabold text-amber-900">
              {impact.governance.partnerPrograms.toLocaleString("ko-KR")}
            </div>
          </div>
        </div>
      </section>

      {/* 공유 카드 */}
      <section className="rounded-2xl border-2 border-dashed border-[#D4E4BC] bg-[#FFF8F0] p-5">
        <h2 className="font-extrabold text-[#2D5A3D] flex items-center gap-2">
          <span>📤</span>
          <span>고객사 공유용 카드</span>
        </h2>
        <p className="mt-1 text-xs text-[#6B6560]">
          아래 카드를 이미지로 저장하거나 링크를 복사해 기업 담당자에게 전달하세요.
        </p>
        <div className="mt-4">
          <ESGShareCard
            eventName={event.name}
            companyName={companyName}
            eventDate={eventDate}
            totalScore={impact.totalScore}
            grade={grade}
            co2Saved={impact.environmental.co2Saved}
            treesPlanted={impact.environmental.treesPlanted}
            familiesConnected={impact.social.familiesConnected}
            averageRating={impact.social.averageRating}
          />
        </div>
      </section>

      {/* B2B CTA */}
      <section className="rounded-2xl bg-gradient-to-br from-[#2D5A3D] to-[#4A7C59] p-5 text-white">
        <h2 className="text-lg font-extrabold">📧 기업에 공식 리포트 보내기</h2>
        <p className="mt-1 text-xs opacity-90">
          PDF 공식 리포트 + 영업팀 전달 (담당 PM이 1~2일 내 연락)
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <a
            href={`mailto:enterprise@toriro.kr?subject=${encodeURIComponent(
              `[ESG 리포트 요청] ${event.name}`
            )}&body=${encodeURIComponent(
              `행사: ${event.name}\n고객사: ${companyName}\nESG 등급: ${grade} (${impact.totalScore}/100)\n\n공식 리포트를 요청합니다.`
            )}`}
            className="rounded-xl bg-white px-4 py-2 text-sm font-bold text-[#2D5A3D] hover:bg-[#FFF8F0]"
          >
            메일로 요청하기 →
          </a>
        </div>
      </section>
    </div>
  );
}

function ScoreBar({
  label,
  emoji,
  value,
  color,
}: {
  label: string;
  emoji: string;
  value: number;
  color: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between text-xs font-semibold mb-1">
        <span className="text-[#2C2C2C]">
          {emoji} {label}
        </span>
        <span className="text-[#2D5A3D]">{value}/100</span>
      </div>
      <div className="h-2 w-full rounded-full bg-neutral-100 overflow-hidden">
        <div
          className={`h-full rounded-full ${color}`}
          style={{ width: `${value}%` }}
          role="progressbar"
          aria-valuenow={value}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${label} 점수 ${value}점`}
        />
      </div>
    </div>
  );
}
