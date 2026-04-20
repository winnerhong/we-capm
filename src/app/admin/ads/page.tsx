import Link from "next/link";

const stages = [
  {
    id: 1,
    icon: "🌱",
    label: "Stage 1",
    period: "0~6개월",
    status: "OFF",
    desc: "광고 완전 비활성화, 순수 유저 경험에 집중",
    active: true,
  },
  {
    id: 2,
    icon: "🌿",
    label: "Stage 2",
    period: "6~12개월",
    status: "내부 공지만",
    desc: "자체 이벤트·공지 배너만 노출",
    active: false,
  },
  {
    id: 3,
    icon: "🌳",
    label: "Stage 3",
    period: "12~18개월",
    status: "제휴 광고",
    desc: "엄선된 제휴사만 네이티브 광고로 노출",
    active: false,
  },
  {
    id: 4,
    icon: "🏞️",
    label: "Stage 4",
    period: "18개월+",
    status: "전면 실행",
    desc: "전체 광고 시스템 가동, 자동 매칭",
    active: false,
  },
];

export default function AdminAdsPage() {
  return (
    <div className="space-y-6">
      {/* 상단 네비 */}
      <div className="flex items-center justify-between">
        <Link href="/admin" className="text-sm text-[#2D5A3D] hover:underline font-medium">
          ← 대시보드
        </Link>
        <span className="rounded-full bg-[#E8F0E4] text-[#2D5A3D] px-2 py-0.5 text-[10px] font-semibold">
          준비 중
        </span>
      </div>

      {/* 헤더 */}
      <div>
        <h1 className="text-2xl font-extrabold text-[#2D5A3D] flex items-center gap-2">
          <span>📣</span>
          <span>숲속 정령 (광고 관리)</span>
        </h1>
        <p className="mt-1 text-sm text-[#6B6560]">
          단계별 광고 활성화 컨트롤
        </p>
      </div>

      {/* 현재 스테이지 */}
      <div className="rounded-2xl bg-gradient-to-br from-[#2D5A3D] to-[#4A7C59] text-white p-5 shadow-lg">
        <p className="text-[11px] tracking-[0.3em] opacity-70 font-light">CURRENT STAGE</p>
        <h2 className="text-2xl font-extrabold mt-1 flex items-center gap-2">
          <span>🌱</span>
          <span>Stage 1 · 광고 OFF</span>
        </h2>
        <p className="mt-2 text-sm opacity-80">
          아직 초기 단계예요. 사용자 경험에만 집중하고 있습니다.
        </p>
      </div>

      {/* 4단계 타임라인 */}
      <section>
        <h2 className="text-sm font-bold text-[#2D5A3D] mb-3">🗺️ 광고 로드맵</h2>
        <div className="space-y-3">
          {stages.map((s, idx) => (
            <div
              key={s.id}
              className={`rounded-2xl border p-5 relative ${
                s.active
                  ? "border-[#2D5A3D] bg-white shadow-md"
                  : "border-[#D4E4BC] bg-white/60"
              }`}
            >
              {s.active && (
                <div className="absolute top-3 right-3">
                  <span className="rounded-full bg-green-100 text-green-700 px-2.5 py-0.5 text-[11px] font-bold animate-pulse">
                    ● 현재 단계
                  </span>
                </div>
              )}
              <div className="flex items-start gap-4">
                <div className="text-4xl flex-shrink-0">{s.icon}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-bold ${s.active ? "text-[#2D5A3D]" : "text-[#6B6560]"}`}>
                      {s.label}
                    </span>
                    <span className="text-[10px] text-[#8B6F47]">· {s.period}</span>
                  </div>
                  <div className={`mt-1 text-base font-extrabold ${s.active ? "text-[#2D5A3D]" : "text-[#A0A0A0]"}`}>
                    {s.status}
                  </div>
                  <p className="mt-1 text-xs text-[#6B6560] leading-relaxed">{s.desc}</p>
                </div>
              </div>
              {idx < stages.length - 1 && (
                <div className="absolute left-9 -bottom-3 w-px h-3 bg-[#D4E4BC]" aria-hidden />
              )}
            </div>
          ))}
        </div>
      </section>

      {/* 현재 활성 캠페인 */}
      <section>
        <h2 className="text-sm font-bold text-[#2D5A3D] mb-3">🎯 현재 활성 캠페인</h2>
        <div className="rounded-2xl border border-[#D4E4BC] bg-white p-5">
          <div className="py-12 text-center">
            <span className="text-4xl">🧚</span>
            <p className="mt-3 text-sm font-semibold text-[#2D5A3D]">
              활성 캠페인이 없어요
            </p>
            <p className="mt-1 text-xs text-[#6B6560]">
              Stage 1에서는 광고가 비활성화 상태입니다
            </p>
          </div>
        </div>
      </section>

      {/* 자동 다운그레이드 정책 */}
      <section className="rounded-2xl border border-[#E5D3B8] bg-gradient-to-br from-[#FFF8F0] to-[#F5E6D3] p-5">
        <h3 className="text-sm font-bold text-[#6B4423] flex items-center gap-1.5">
          <span>⚠️</span>
          <span>자동 다운그레이드 정책</span>
        </h3>
        <p className="mt-2 text-xs text-[#8B6F47] leading-relaxed">
          사용자 불만 리포트·이탈률·NPS가 임계치를 넘으면 시스템이 <b>자동으로 이전 스테이지로 복귀</b>합니다.
          숲의 평화가 최우선이에요 🌲
        </p>
      </section>
    </div>
  );
}
