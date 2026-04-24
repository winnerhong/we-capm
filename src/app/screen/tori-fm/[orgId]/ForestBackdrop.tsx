// 서버 컴포넌트 — 전광판 하단 숲 실루엣 SVG.
// 애니메이션 없음 (순수 장식). CSS 클래스만으로 살짝 흔들리는 효과도 가능하지만
// 성능·단순성 위해 정적 SVG로 유지.

export function ForestBackdrop() {
  return (
    <>
      {/* 하단 숲 실루엣 */}
      <svg
        aria-hidden
        viewBox="0 0 1440 320"
        preserveAspectRatio="none"
        className="pointer-events-none fixed inset-x-0 bottom-0 h-48 w-full opacity-70 md:h-64"
      >
        <defs>
          <linearGradient id="forest-gradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1a1410" stopOpacity="0" />
            <stop offset="40%" stopColor="#1a1410" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#000" stopOpacity="1" />
          </linearGradient>
        </defs>

        {/* 뒷줄 희미한 나무들 */}
        <path
          d="M0,280 L40,200 L80,240 L120,180 L160,230 L200,170 L240,220
             L280,150 L320,210 L360,190 L400,230 L440,160 L480,210 L520,180
             L560,220 L600,170 L640,230 L680,200 L720,180 L760,240 L800,170
             L840,210 L880,190 L920,240 L960,180 L1000,220 L1040,200 L1080,240
             L1120,170 L1160,220 L1200,200 L1240,240 L1280,190 L1320,220
             L1360,240 L1400,180 L1440,220 L1440,320 L0,320 Z"
          fill="#0a0605"
          opacity="0.8"
        />

        {/* 앞줄 진한 나무들 */}
        <path
          d="M0,320 L0,240 L30,200 L50,270 L80,220 L110,280 L140,230 L170,290
             L200,240 L230,290 L260,250 L290,290 L320,220 L350,280 L380,240
             L410,290 L440,250 L470,290 L500,240 L530,280 L560,250 L590,290
             L620,240 L650,280 L680,250 L710,290 L740,240 L770,280 L800,250
             L830,290 L860,230 L890,280 L920,250 L950,290 L980,240 L1010,280
             L1040,250 L1070,290 L1100,240 L1130,280 L1160,250 L1190,290
             L1220,240 L1250,280 L1280,250 L1310,290 L1340,240 L1370,280
             L1400,250 L1440,290 L1440,320 Z"
          fill="#000"
          opacity="0.95"
        />

        {/* 그라데이션 페이드 */}
        <rect
          x="0"
          y="0"
          width="1440"
          height="320"
          fill="url(#forest-gradient)"
        />
      </svg>

      {/* 상단 은은한 스튜디오 조명 (ambient glow) */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 top-0 h-64 opacity-30"
        style={{
          background:
            "radial-gradient(ellipse at 30% 0%, #C4956A 0%, transparent 60%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 top-0 h-72 opacity-20"
        style={{
          background:
            "radial-gradient(ellipse at 75% 10%, #E5B88A 0%, transparent 55%)",
        }}
      />
    </>
  );
}
