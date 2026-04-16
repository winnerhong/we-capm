"use client";

export default function OfflinePage() {
  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-4 text-center">
        <div className="text-5xl">📶</div>
        <h1 className="text-xl font-bold">인터넷 연결 없음</h1>
        <p className="text-sm">
          네트워크에 다시 연결되면 자동으로 복구됩니다.
          <br />
          캠핑장 Wi-Fi를 확인해보세요.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="w-full rounded-lg bg-violet-600 py-3 font-semibold text-white hover:bg-violet-700"
        >
          다시 시도
        </button>
      </div>
    </main>
  );
}
