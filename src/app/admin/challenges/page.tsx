import Link from "next/link";

const pastChallenges = [
  { id: 1, title: "봄맞이 피크닉 챌린지", period: "2026.03.01 ~ 03.31", participants: 0, status: "완료" },
  { id: 2, title: "겨울 모닥불 인증", period: "2026.02.01 ~ 02.28", participants: 0, status: "완료" },
  { id: 3, title: "신년 첫 캠프", period: "2026.01.01 ~ 01.15", participants: 0, status: "완료" },
];

const currentChallenge = {
  id: 4,
  title: "4월 벚꽃 챌린지",
  period: "2026.04.01 ~ 04.30",
  participants: 0,
  status: "진행 중",
};

export default function AdminChallengesPage() {
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
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-[#2D5A3D] flex items-center gap-2">
            <span>🎯</span>
            <span>챌린지 관리</span>
          </h1>
          <p className="mt-1 text-sm text-[#6B6560]">
            주간·시즌 챌린지로 참여를 유도해요
          </p>
        </div>
        <Link
          href="#"
          className="rounded-xl bg-[#2D5A3D] text-white px-4 py-2 text-sm font-semibold hover:bg-[#3A7A52] transition-colors flex-shrink-0"
        >
          + 새 챌린지
        </Link>
      </div>

      {/* 진행 중 챌린지 */}
      <section>
        <h2 className="text-sm font-bold text-[#2D5A3D] mb-3">🌿 진행 중인 챌린지</h2>
        <div className="rounded-2xl border-2 border-[#2D5A3D] bg-white p-5 relative overflow-hidden">
          <div className="absolute top-3 right-3">
            <span className="rounded-full bg-green-100 text-green-700 px-2.5 py-0.5 text-[11px] font-bold animate-pulse">
              ● {currentChallenge.status}
            </span>
          </div>
          <h3 className="text-lg font-bold text-[#2D5A3D]">{currentChallenge.title}</h3>
          <p className="mt-1 text-xs text-[#6B6560]">📅 {currentChallenge.period}</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-[#E8F0E4] p-3">
              <div className="text-[10px] font-medium text-[#2D5A3D]">참가자</div>
              <div className="text-xl font-bold text-[#2D5A3D]">{currentChallenge.participants}명</div>
            </div>
            <div className="rounded-xl bg-[#FFF8F0] p-3">
              <div className="text-[10px] font-medium text-[#8B6F47]">남은 일수</div>
              <div className="text-xl font-bold text-[#6B4423]">10일</div>
            </div>
          </div>
        </div>
      </section>

      {/* 지난 챌린지 */}
      <section>
        <h2 className="text-sm font-bold text-[#2D5A3D] mb-3">📋 지난 챌린지</h2>
        <div className="space-y-2">
          {pastChallenges.map((c) => (
            <div
              key={c.id}
              className="rounded-2xl border border-[#D4E4BC] bg-white p-4 flex items-center justify-between gap-3"
            >
              <div className="min-w-0">
                <div className="font-semibold text-[#2C2C2C] truncate">{c.title}</div>
                <div className="text-xs text-[#6B6560] mt-0.5">📅 {c.period} · 👥 {c.participants}명</div>
              </div>
              <span className="rounded-full bg-neutral-100 text-neutral-600 px-2.5 py-0.5 text-[11px] font-semibold flex-shrink-0">
                {c.status}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* 빈 상태 안내 */}
      <div className="rounded-2xl border border-dashed border-[#D4E4BC] bg-[#FFF8F0] p-6 text-center">
        <p className="text-xs text-[#6B6560]">
          위 목록은 샘플입니다. 실제 챌린지 데이터가 없으면 빈 상태로 표시돼요 🌰
        </p>
      </div>
    </div>
  );
}
