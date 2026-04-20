"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { endChallengeAction, deleteChallengeAction } from "./actions";

export type ChallengeRow = {
  id: string;
  event_id: string | null;
  title: string;
  description: string | null;
  icon: string | null;
  goal_type: string | null;
  goal_value: number | null;
  reward_acorns: number | null;
  reward_badge: string | null;
  starts_at: string | null;
  ends_at: string | null;
  status: string | null;
  event_name?: string | null;
};

const GOAL_TYPE_LABEL: Record<string, string> = {
  MISSION_COUNT: "미션 개수",
  ACORN_COUNT: "도토리 개수",
  STAMP_COUNT: "스탬프 개수",
  ATTENDANCE: "출석 일수",
};

const GOAL_TYPE_UNIT: Record<string, string> = {
  MISSION_COUNT: "개",
  ACORN_COUNT: "개",
  STAMP_COUNT: "개",
  ATTENDANCE: "일",
};

function statusBadge(status: string | null) {
  switch (status) {
    case "ACTIVE":
      return { label: "진행 중", className: "bg-green-100 text-green-700" };
    case "ENDED":
      return { label: "종료", className: "bg-neutral-100 text-neutral-600" };
    case "ARCHIVED":
      return { label: "보관됨", className: "bg-amber-100 text-amber-700" };
    default:
      return { label: status ?? "-", className: "bg-neutral-100 text-neutral-600" };
  }
}

function formatDate(iso: string | null) {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function ChallengeListClient({
  challenges,
  activeCount,
  endedCount,
  totalAcorns,
  tableReady,
}: {
  challenges: ChallengeRow[];
  activeCount: number;
  endedCount: number;
  totalAcorns: number;
  tableReady: boolean;
}) {
  const [tab, setTab] = useState<"ALL" | "ACTIVE" | "ENDED">("ALL");
  const [isPending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (tab === "ALL") return challenges;
    return challenges.filter((c) => (c.status ?? "ACTIVE") === tab);
  }, [challenges, tab]);

  const handleEnd = (id: string, title: string) => {
    if (!confirm(`"${title}" 챌린지를 종료할까요?`)) return;
    setBusyId(id);
    startTransition(async () => {
      try {
        await endChallengeAction(id);
      } catch (e) {
        alert(e instanceof Error ? e.message : "종료 실패");
      } finally {
        setBusyId(null);
      }
    });
  };

  const handleDelete = (id: string, title: string) => {
    if (!confirm(`"${title}" 챌린지를 삭제할까요? 되돌릴 수 없어요.`)) return;
    setBusyId(id);
    startTransition(async () => {
      try {
        await deleteChallengeAction(id);
      } catch (e) {
        alert(e instanceof Error ? e.message : "삭제 실패");
      } finally {
        setBusyId(null);
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* 상단 네비 */}
      <div className="flex items-center justify-between">
        <Link href="/admin" className="text-sm text-[#2D5A3D] hover:underline font-medium">
          ← 대시보드
        </Link>
      </div>

      {/* 포레스트 헤더 */}
      <div className="rounded-2xl bg-gradient-to-br from-[#2D5A3D] via-[#3A7A52] to-[#4A7C59] p-6 text-white shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold">
              <span>🎯</span>
              <span>챌린지 관리</span>
            </h1>
            <p className="mt-1 text-sm text-white/80">
              주간·시즌 챌린지로 참여를 유도하고 도토리를 나눠줘요
            </p>
          </div>
          <Link
            href="/admin/challenges/new"
            className="flex-shrink-0 rounded-xl bg-white text-[#2D5A3D] px-4 py-2 text-sm font-bold hover:bg-[#FFF8F0] transition-colors"
          >
            + 새 챌린지 만들기
          </Link>
        </div>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="rounded-2xl border border-[#D4E4BC] bg-white p-4">
          <div className="text-xs font-medium text-[#6B6560]">🌿 진행 중</div>
          <div className="mt-1 text-2xl font-extrabold text-[#2D5A3D]">{activeCount}개</div>
        </div>
        <div className="rounded-2xl border border-[#D4E4BC] bg-white p-4">
          <div className="text-xs font-medium text-[#6B6560]">📋 종료됨</div>
          <div className="mt-1 text-2xl font-extrabold text-[#6B6560]">{endedCount}개</div>
        </div>
        <div className="rounded-2xl border border-[#D4E4BC] bg-[#FFF8F0] p-4">
          <div className="text-xs font-medium text-[#8B6F47]">🌰 총 발급 도토리</div>
          <div className="mt-1 text-2xl font-extrabold text-[#6B4423]">
            {totalAcorns.toLocaleString("ko-KR")}개
          </div>
        </div>
      </div>

      {/* 탭 필터 */}
      <div className="flex items-center gap-2 border-b border-[#D4E4BC]">
        {[
          { key: "ALL", label: "전체" },
          { key: "ACTIVE", label: "진행 중" },
          { key: "ENDED", label: "종료" },
        ].map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key as typeof tab)}
            className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${
              tab === t.key
                ? "border-[#2D5A3D] text-[#2D5A3D]"
                : "border-transparent text-[#6B6560] hover:text-[#2D5A3D]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* 챌린지 그리드 */}
      {!tableReady ? (
        <div className="rounded-2xl border border-dashed border-[#D4E4BC] bg-[#FFF8F0] p-8 text-center">
          <div className="text-3xl">🌱</div>
          <p className="mt-2 text-sm font-semibold text-[#2D5A3D]">
            챌린지 테이블이 아직 준비되지 않았어요
          </p>
          <p className="mt-1 text-xs text-[#6B6560]">
            DB 마이그레이션이 적용되면 자동으로 보여드릴게요
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#D4E4BC] bg-[#FFF8F0] p-8 text-center">
          <div className="text-3xl">🌰</div>
          <p className="mt-2 text-sm font-semibold text-[#2D5A3D]">
            아직 챌린지가 없어요
          </p>
          <p className="mt-1 text-xs text-[#6B6560]">
            상단의 &quot;+ 새 챌린지 만들기&quot; 버튼을 눌러 시작해보세요
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filtered.map((c) => {
            const badge = statusBadge(c.status);
            const unit = GOAL_TYPE_UNIT[c.goal_type ?? ""] ?? "개";
            const goalLabel = GOAL_TYPE_LABEL[c.goal_type ?? ""] ?? c.goal_type ?? "-";
            const disabled = isPending && busyId === c.id;
            return (
              <div
                key={c.id}
                className="rounded-2xl border border-[#D4E4BC] bg-white p-5 flex flex-col gap-3 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="text-3xl flex-shrink-0">{c.icon ?? "🎯"}</div>
                    <div className="min-w-0">
                      <h3 className="font-bold text-[#2C2C2C] truncate">{c.title}</h3>
                      {c.description && (
                        <p className="mt-0.5 text-xs text-[#6B6560] line-clamp-2">
                          {c.description}
                        </p>
                      )}
                    </div>
                  </div>
                  <span
                    className={`flex-shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${badge.className}`}
                  >
                    {badge.label}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-xl bg-[#E8F0E4] p-2.5">
                    <div className="text-[10px] font-medium text-[#2D5A3D]">🎯 목표</div>
                    <div className="mt-0.5 font-semibold text-[#2D5A3D]">
                      {goalLabel} {c.goal_value ?? 0}{unit}
                    </div>
                  </div>
                  <div className="rounded-xl bg-[#FFF8F0] p-2.5">
                    <div className="text-[10px] font-medium text-[#8B6F47]">🌰 보상</div>
                    <div className="mt-0.5 font-semibold text-[#6B4423]">
                      도토리 {c.reward_acorns ?? 0}개
                      {c.reward_badge ? ` + ${c.reward_badge}` : ""}
                    </div>
                  </div>
                </div>

                <div className="text-[11px] text-[#6B6560]">
                  📅 {formatDate(c.starts_at)} ~ {formatDate(c.ends_at)}
                  {c.event_name && (
                    <span className="ml-2 inline-block rounded-full bg-[#E8F0E4] px-2 py-0.5 text-[10px] text-[#2D5A3D]">
                      {c.event_name}
                    </span>
                  )}
                  {!c.event_id && !c.event_name && (
                    <span className="ml-2 inline-block rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] text-[#6B6560]">
                      전체 행사
                    </span>
                  )}
                </div>

                <div className="mt-auto flex items-center gap-2 pt-2 border-t border-[#F0E8DC]">
                  <Link
                    href={`/admin/challenges/${c.id}/edit`}
                    className="flex-1 rounded-lg border border-[#D4E4BC] px-3 py-1.5 text-center text-xs font-semibold text-[#2D5A3D] hover:bg-[#E8F0E4]"
                  >
                    편집
                  </Link>
                  <button
                    type="button"
                    disabled={disabled || c.status === "ENDED"}
                    onClick={() => handleEnd(c.id, c.title)}
                    className="flex-1 rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-100 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    종료
                  </button>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => handleDelete(c.id, c.title)}
                    className="flex-1 rounded-lg border border-red-300 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    삭제
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
