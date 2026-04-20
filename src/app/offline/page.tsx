"use client";

export default function OfflinePage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-[#FFF8F0] p-6">
      <div className="w-full max-w-sm space-y-6 text-center">
        <div className="flex justify-center gap-1 text-6xl" aria-hidden>
          <span>🌲</span>
          <span className="translate-y-2">🌳</span>
          <span>🌲</span>
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-[#2D5A3D]">
            📡 인터넷 연결 없음
          </h1>
          <p className="text-sm text-neutral-700">
            네트워크가 복구되면 자동으로 연결돼요.
            <br />
            캠핑장 Wi-Fi를 확인해보세요.
          </p>
        </div>

        <button
          type="button"
          onClick={() => window.location.reload()}
          className="w-full rounded-xl bg-[#2D5A3D] py-3 font-semibold text-white shadow-lg transition hover:bg-[#244a31] focus:outline-none focus:ring-2 focus:ring-[#2D5A3D]/40"
        >
          다시 시도
        </button>

        <section
          className="rounded-2xl border border-[#2D5A3D]/10 bg-white/70 p-4 text-left"
          aria-label="오프라인에서 볼 수 있는 페이지"
        >
          <p className="text-xs font-semibold text-[#2D5A3D]">
            🌰 오프라인에서도 볼 수 있어요
          </p>
          <ul className="mt-2 space-y-1 text-xs text-neutral-600">
            <li>• 최근에 본 숲길 정보</li>
            <li>• 저장된 스탬프 기록</li>
            <li>• 설치된 토리로 앱 홈 화면</li>
          </ul>
          <p className="mt-2 text-[10px] text-neutral-400">
            * 캐시된 페이지 목록은 곧 제공됩니다.
          </p>
        </section>
      </div>
    </main>
  );
}
