import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  calculateESGImpact,
  calculateYeouidoEquivalent,
  getESGGrade,
  getESGGradeColor,
  getMonthlyESGTrend,
} from "@/lib/esg-metrics";
import { AcornIcon } from "@/components/acorn-icon";

export const dynamic = "force-dynamic";

export default async function AdminESGPage() {
  const supabase = await createClient();
  const impact = await calculateESGImpact(supabase);
  const trend = await getMonthlyESGTrend(supabase, 6);
  const grade = getESGGrade(impact.totalScore);
  const gradeColor = getESGGradeColor(grade);
  const yeouidoEq = calculateYeouidoEquivalent(impact.environmental.treesPlanted);

  // E/S/G 세부 점수 (내부 계산과 동기화)
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

  const maxParticipants = Math.max(...trend.map((t) => t.participants), 1);

  return (
    <div className="space-y-6">
      {/* Top bar */}
      <div className="flex items-center justify-between">
        <Link href="/admin" className="text-sm text-[#2D5A3D] hover:underline">
          ← 대시보드
        </Link>
        <div className="flex gap-2">
          <button
            type="button"
            className="rounded-lg border border-[#D4E4BC] px-3 py-1.5 text-xs font-medium text-[#2C2C2C] hover:bg-[#FFF8F0]"
            disabled
            title="PDF 리포트 다운로드 (준비중)"
          >
            📄 PDF 다운로드
          </button>
        </div>
      </div>

      {/* 헤더 */}
      <header className="rounded-2xl bg-gradient-to-br from-[#1F3D2B] via-[#2D5A3D] to-[#4A7C59] p-6 text-white shadow-lg relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 opacity-20">
          <div className="absolute right-4 top-4 text-6xl">🌿</div>
          <div className="absolute right-16 bottom-2 text-4xl">🍃</div>
        </div>
        <div className="relative z-10">
          <p className="text-[11px] tracking-[0.4em] opacity-70 font-light">ESG IMPACT REPORT</p>
          <h1 className="text-2xl font-extrabold mt-1 flex items-center gap-2">
            <span>🌱</span>
            <span>ESG 임팩트 리포트</span>
          </h1>
          <p className="mt-2 text-sm opacity-85">토리로가 만들어가는 지속가능한 변화</p>
        </div>
      </header>

      {/* 총 임팩트 카드 */}
      <section
        className={`rounded-2xl border-2 ${gradeColor.border} bg-white p-6 shadow-sm`}
        aria-label="ESG 총점"
      >
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold tracking-widest text-[#6B6560]">TOTAL ESG SCORE</p>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-6xl font-extrabold text-[#2D5A3D]">{impact.totalScore}</span>
              <span className="text-xl font-bold text-[#6B6560]">/100</span>
            </div>
            <p className="mt-1 text-xs text-[#6B6560]">전체 가중 평균 점수</p>
          </div>
          <div
            className={`rounded-2xl border-2 ${gradeColor.border} ${gradeColor.bg} px-5 py-4 text-center shadow-sm`}
          >
            <div className={`text-4xl font-extrabold ${gradeColor.text}`}>{grade}</div>
            <div className={`mt-1 text-[10px] font-bold ${gradeColor.text} tracking-widest`}>GRADE</div>
          </div>
        </div>

        {/* E/S/G Bars */}
        <div className="mt-6 space-y-3">
          <ScoreBar label="Environmental" emoji="🌳" value={envScore} color="bg-green-500" />
          <ScoreBar label="Social" emoji="🤝" value={socialScore} color="bg-sky-500" />
          <ScoreBar label="Governance" emoji="⚖️" value={govScore} color="bg-amber-500" />
        </div>
      </section>

      {/* Environmental */}
      <section className="rounded-2xl border border-green-200 bg-green-50/50 p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-extrabold text-green-800 flex items-center gap-2">
            <span>🌳</span>
            <span>환경 (Environmental)</span>
          </h2>
          <span className="text-xs font-bold text-green-700">{envScore}/100</span>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <MetricCard
            label="CO2 절감량"
            value={`${impact.environmental.co2Saved.toLocaleString("ko-KR")} kg`}
            caption="실내 활동 대비 숲 체험"
            color="green"
          />
          <MetricCard
            label="가상 나무"
            value={`${impact.environmental.treesPlanted.toLocaleString("ko-KR")} 그루`}
            caption="도토리 10개당 1그루"
            color="green"
          />
          <MetricCard
            label="친환경 활동"
            value={`${impact.environmental.greenActivitiesHours.toLocaleString("ko-KR")} 시간`}
            caption="누적 참여 시간"
            color="green"
          />
        </div>
        <p className="mt-4 rounded-xl bg-white border border-green-200 p-3 text-xs text-green-800">
          <strong>이퀄리턴:</strong> 여의도 공원 약{" "}
          <strong>{yeouidoEq.toLocaleString("ko-KR")}개 면적</strong>에 해당하는 녹지 효과
        </p>
      </section>

      {/* Social */}
      <section className="rounded-2xl border border-sky-200 bg-sky-50/50 p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-extrabold text-sky-800 flex items-center gap-2">
            <span>🤝</span>
            <span>사회 (Social)</span>
          </h2>
          <span className="text-xs font-bold text-sky-700">{socialScore}/100</span>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          <MetricCard
            label="연결된 가족"
            value={`${impact.social.familiesConnected.toLocaleString("ko-KR")}`}
            caption="가족 단위"
            color="sky"
          />
          <MetricCard
            label="참여 어린이"
            value={`${impact.social.childrenParticipated.toLocaleString("ko-KR")}`}
            caption="명 (추정)"
            color="sky"
          />
          <MetricCard
            label="협력 기관"
            value={`${impact.social.schoolsSupported.toLocaleString("ko-KR")}`}
            caption="학교/단체"
            color="sky"
          />
          <MetricCard
            label="평균 만족도"
            value={`${impact.social.averageRating.toFixed(1)} / 5`}
            caption="참가자 별점"
            color="sky"
          />
        </div>
      </section>

      {/* Governance */}
      <section className="rounded-2xl border border-amber-200 bg-amber-50/50 p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-extrabold text-amber-800 flex items-center gap-2">
            <span>⚖️</span>
            <span>거버넌스 (Governance)</span>
          </h2>
          <span className="text-xs font-bold text-amber-700">{govScore}/100</span>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <MetricCard
            label="투명성 점수"
            value={`${impact.governance.transparencyScore}`}
            caption="리뷰 기반 투명도"
            color="amber"
          />
          <MetricCard
            label="지역 상공인"
            value={`${impact.governance.localBusinessesEngaged.toLocaleString("ko-KR")}`}
            caption="연계 파트너 수"
            color="amber"
          />
          <MetricCard
            label="파트너 프로그램"
            value={`${impact.governance.partnerPrograms.toLocaleString("ko-KR")}`}
            caption="협력 프로그램"
            color="amber"
          />
        </div>
      </section>

      {/* 월별 트렌드 */}
      <section className="rounded-2xl border border-[#D4E4BC] bg-white p-5">
        <h2 className="font-extrabold text-[#2D5A3D] flex items-center gap-2">
          <span>📊</span>
          <span>월별 임팩트 트렌드</span>
        </h2>
        <p className="mt-1 text-xs text-[#6B6560]">최근 6개월 누적 참여자 및 CO2 절감량</p>
        <div className="mt-5 flex items-end justify-between gap-2 h-40">
          {trend.map((t) => {
            const heightPct = (t.participants / maxParticipants) * 100;
            return (
              <div key={t.month} className="flex flex-1 flex-col items-center gap-1.5">
                <div className="text-[10px] font-semibold text-[#2D5A3D]">{t.participants}</div>
                <div
                  className="w-full rounded-t-lg bg-gradient-to-t from-[#2D5A3D] to-[#4A7C59] transition-all"
                  style={{ height: `${Math.max(4, heightPct)}%` }}
                  aria-label={`${t.month} 참가자 ${t.participants}명`}
                />
                <div className="text-[10px] text-[#6B6560]">{t.month}</div>
              </div>
            );
          })}
        </div>
        <div className="mt-3 flex justify-between text-[10px] text-[#6B6560] border-t border-[#E8F0E4] pt-2">
          <span>월별 참여자 수 기준 (바 높이)</span>
          <span>
            CO2 총 {trend.reduce((s, t) => s + t.co2Saved, 0).toFixed(1)} kg 절감
          </span>
        </div>
      </section>

      {/* 다운로드 / 공유 */}
      <section className="rounded-2xl border border-[#D4E4BC] bg-gradient-to-br from-[#FFF8F0] to-[#F5E6D3] p-5">
        <h2 className="font-extrabold text-[#6B4423]">📤 리포트 공유</h2>
        <p className="mt-1 text-xs text-[#8B6F47]">
          이해관계자·투자자에게 보낼 수 있는 공식 리포트를 다운로드하거나 공유하세요.
        </p>
        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <button
            type="button"
            className="rounded-xl border-2 border-[#2D5A3D] bg-[#2D5A3D] px-4 py-3 text-sm font-bold text-white hover:bg-[#3A7A52] disabled:opacity-60"
            disabled
          >
            📄 PDF 리포트 다운로드 <span className="text-[10px] opacity-70">(준비중)</span>
          </button>
          <button
            type="button"
            className="rounded-xl border-2 border-[#B8860B] bg-white px-4 py-3 text-sm font-bold text-[#B8860B] hover:bg-[#FFF8F0] disabled:opacity-60"
            disabled
          >
            🖼️ 이미지로 공유 <span className="text-[10px] opacity-70">(준비중)</span>
          </button>
        </div>
      </section>

      <p className="flex items-center justify-center gap-1 text-center text-[10px] text-[#8B6F47] py-4">
        <span>본 리포트는 토리로 플랫폼 데이터를 기반으로 자동 생성되었습니다.</span> <AcornIcon />
      </p>
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
      <div className="h-2.5 w-full rounded-full bg-neutral-100 overflow-hidden">
        <div
          className={`h-full rounded-full ${color} transition-all`}
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

type MetricColor = "green" | "sky" | "amber";
const METRIC_THEME: Record<MetricColor, { label: string; value: string; caption: string; bg: string }> = {
  green: { label: "text-green-700", value: "text-green-900", caption: "text-green-700", bg: "bg-white border-green-200" },
  sky: { label: "text-sky-700", value: "text-sky-900", caption: "text-sky-700", bg: "bg-white border-sky-200" },
  amber: { label: "text-amber-700", value: "text-amber-900", caption: "text-amber-700", bg: "bg-white border-amber-200" },
};

function MetricCard({
  label,
  value,
  caption,
  color,
}: {
  label: string;
  value: string;
  caption: string;
  color: MetricColor;
}) {
  const t = METRIC_THEME[color];
  return (
    <div className={`rounded-xl border ${t.bg} p-4`}>
      <div className={`text-[10px] font-bold tracking-wider uppercase ${t.label}`}>{label}</div>
      <div className={`mt-1.5 text-xl font-extrabold ${t.value}`}>{value}</div>
      <div className={`mt-0.5 text-[10px] ${t.caption} opacity-80`}>{caption}</div>
    </div>
  );
}
