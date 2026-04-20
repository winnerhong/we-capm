"use client";

interface Challenge {
  title: string;
  description: string;
  icon: string;
  progress: number;
  goal: number;
  reward: string;
}

const THIS_WEEK: Challenge = {
  title: "이번주 숲길 챌린지",
  description: "숲길 3개 완주하고 🌰 10개 받기",
  icon: "🎯",
  progress: 0,
  goal: 3,
  reward: "🌰 10",
};

export function ChallengeCard({ completedMissions = 0 }: { completedMissions?: number }) {
  const progress = Math.min(THIS_WEEK.goal, completedMissions);
  const percent = Math.round((progress / THIS_WEEK.goal) * 100);
  const done = progress >= THIS_WEEK.goal;

  return (
    <div className="rounded-2xl border-2 border-dashed border-[#C4956A]/40 bg-gradient-to-br from-[#FFF8F0] to-[#F5E6D3] p-5">
      <div className="flex items-start justify-between mb-2">
        <div>
          <p className="text-[10px] font-bold text-[#C4956A] tracking-wide">THIS WEEK CHALLENGE</p>
          <h3 className="text-base font-bold text-[#2D5A3D] mt-1">{THIS_WEEK.icon} {THIS_WEEK.title}</h3>
          <p className="text-xs text-[#6B6560] mt-1">{THIS_WEEK.description}</p>
        </div>
        <span className="text-xs font-bold rounded-full bg-[#C4956A] text-white px-2.5 py-1">
          {THIS_WEEK.reward}
        </span>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <div className="flex-1 h-2 overflow-hidden rounded-full bg-white/60">
          <div className={`h-full rounded-full transition-all ${done ? "bg-[#2D5A3D]" : "bg-[#C4956A]"}`} style={{ width: `${percent}%` }} />
        </div>
        <span className="text-xs font-bold text-[#2D5A3D]">{progress}/{THIS_WEEK.goal}</span>
      </div>
      {done && <p className="mt-2 text-xs text-center text-[#2D5A3D] font-semibold">🎉 완료! 토리가 도토리를 드려요</p>}
    </div>
  );
}
