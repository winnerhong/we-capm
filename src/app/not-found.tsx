import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-[#FFF8F0] p-6">
      <div className="text-center space-y-4 max-w-md">
        <div className="text-8xl" aria-hidden="true">
          🌲
        </div>
        <h1 className="text-3xl font-bold text-[#2D5A3D]">길을 잃으셨나요?</h1>
        <p className="text-sm text-[#6B6560]">찾으시는 숲길이 없네요</p>
        <Link
          href="/"
          className="inline-block rounded-xl bg-[#2D5A3D] text-white px-6 py-3 font-semibold hover:bg-[#1F4229] focus:outline-none focus:ring-2 focus:ring-[#2D5A3D] focus:ring-offset-2"
        >
          🏠 홈으로 돌아가기
        </Link>
      </div>
    </main>
  );
}
