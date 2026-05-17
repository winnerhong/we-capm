"use client";

// 가족 상세 — 우측 슬라이드 Drawer.
//   - 마운트 시 detailLoader 호출 → 자녀/제출/행사/도토리 풀 표시
//   - canImpersonate=true 면 admin 임퍼소네이트 링크 노출
//   - ESC 닫기, 백드롭 클릭 닫기

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { OrgMemberDetail } from "@/lib/org-members/queries";

type Props = {
  userId: string;
  basePath: string;
  canImpersonate: boolean;
  detailLoader: (
    userId: string
  ) => Promise<
    { ok: true; detail: OrgMemberDetail } | { ok: false; error: string }
  >;
  onClose: () => void;
};

function formatDate(iso: string | null): string {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  } catch {
    return "-";
  }
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleString("ko-KR", {
      year: "2-digit",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "-";
  }
}

function formatPhone(raw: string): string {
  const d = raw.replace(/\D/g, "");
  if (d.length === 11) return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
  return raw;
}

function calcAge(birthDate: string | null): string {
  if (!birthDate) return "";
  try {
    const b = new Date(birthDate);
    const now = new Date();
    let age = now.getFullYear() - b.getFullYear();
    const m = now.getMonth() - b.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age -= 1;
    return `만${age}세`;
  } catch {
    return "";
  }
}

const STATUS_BADGE: Record<string, { label: string; color: string }> = {
  SUBMITTED: { label: "검토 대기", color: "bg-amber-100 text-amber-800" },
  PENDING_REVIEW: { label: "검토 대기", color: "bg-amber-100 text-amber-800" },
  APPROVED: { label: "승인", color: "bg-emerald-100 text-emerald-800" },
  AUTO_APPROVED: { label: "자동 승인", color: "bg-emerald-100 text-emerald-800" },
  REJECTED: { label: "반려", color: "bg-rose-100 text-rose-800" },
  REVOKED: { label: "취소", color: "bg-stone-200 text-stone-700" },
};

export function MemberDetailDrawer({
  userId,
  basePath,
  canImpersonate,
  detailLoader,
  onClose,
}: Props) {
  const [detail, setDetail] = useState<OrgMemberDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setLoadError(null);
    setDetail(null);
    (async () => {
      const r = await detailLoader(userId);
      if (cancelled) return;
      if (r.ok) {
        setDetail(r.detail);
      } else {
        setLoadError(r.error);
      }
      setIsLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, detailLoader]);

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") handleClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="가족 상세"
      className="fixed inset-0 z-50 flex justify-end bg-black/40"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <aside className="h-full w-full max-w-md overflow-y-auto bg-[#FFF8F0] shadow-2xl">
        <header className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-[#D4E4BC] bg-[#F5F1E8] px-4 py-3">
          <h2 className="text-sm font-bold text-[#2D5A3D]">
            👨‍👩‍👧 가족 상세
          </h2>
          <button
            type="button"
            onClick={handleClose}
            aria-label="닫기"
            className="rounded-lg px-2 py-1 text-sm text-[#6B6560] transition hover:bg-white"
          >
            ✕
          </button>
        </header>

        <div className="p-4">
          {isLoading ? (
            <p className="py-10 text-center text-sm text-[#6B6560]">
              불러오는 중...
            </p>
          ) : loadError ? (
            <p className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
              ⚠ {loadError}
            </p>
          ) : !detail ? (
            <p className="py-10 text-center text-sm text-[#6B6560]">
              가족 정보를 찾을 수 없어요
            </p>
          ) : (
            <div className="space-y-4">
              {/* 보호자 */}
              <section className="rounded-2xl border border-[#D4E4BC] bg-white p-4">
                <p className="text-lg font-bold text-[#2D5A3D]">
                  {detail.parentName}
                </p>
                <p className="mt-0.5 font-mono text-xs text-[#6B6560]">
                  {formatPhone(detail.parentPhone)}
                </p>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-lg bg-[#F5F1E8] p-2">
                    <p className="text-[10px] text-[#6B6560]">가입</p>
                    <p className="text-[11px] font-bold text-[#3D3A36]">
                      {formatDate(detail.createdAt)}
                    </p>
                  </div>
                  <div className="rounded-lg bg-[#F5F1E8] p-2">
                    <p className="text-[10px] text-[#6B6560]">최근 로그인</p>
                    <p className="text-[11px] font-bold text-[#3D3A36]">
                      {formatDate(detail.lastLoginAt)}
                    </p>
                  </div>
                  <div className="rounded-lg bg-amber-50 p-2">
                    <p className="text-[10px] text-amber-700">도토리</p>
                    <p className="text-[11px] font-bold tabular-nums text-amber-800">
                      🌰 {detail.acornBalance.toLocaleString("ko-KR")}
                    </p>
                  </div>
                </div>

                {canImpersonate && (
                  <Link
                    href={`/api/admin/impersonate?role=user&id=${detail.userId}`}
                    className="mt-3 inline-flex w-full items-center justify-center gap-1 rounded-lg bg-[#2D5A3D] px-3 py-2 text-xs font-bold text-white transition hover:bg-[#3A7A52]"
                    title="이 보호자 계정으로 로그인 (관리자 임퍼소네이트)"
                  >
                    🔑 보호자 계정으로 보기
                  </Link>
                )}
              </section>

              {/* 자녀 */}
              <section className="rounded-2xl border border-[#D4E4BC] bg-white p-4">
                <h3 className="text-xs font-bold text-[#2D5A3D]">
                  🧒 자녀 ({detail.children.length}명)
                </h3>
                {detail.children.length === 0 ? (
                  <p className="mt-2 text-[11px] text-[#8B7F75]">
                    등록된 자녀가 없어요
                  </p>
                ) : (
                  <ul className="mt-2 space-y-1.5">
                    {detail.children.map((c) => (
                      <li
                        key={c.id}
                        className={`flex flex-wrap items-center gap-2 rounded-lg p-2 ${
                          c.isEnrolled
                            ? "border border-emerald-200 bg-emerald-50"
                            : "border border-[#D4E4BC] bg-[#F5F1E8]"
                        }`}
                      >
                        {c.className && (
                          <span className="rounded-full bg-white px-1.5 py-0.5 text-[10px] font-bold text-[#2D5A3D]">
                            {c.className}
                          </span>
                        )}
                        <span className="text-sm font-bold">{c.name}</span>
                        {c.birthDate && (
                          <span className="text-[11px] text-[#6B6560]">
                            {calcAge(c.birthDate)} · {formatDate(c.birthDate)}
                          </span>
                        )}
                        {c.isEnrolled && (
                          <span className="ml-auto rounded-full bg-emerald-200 px-1.5 py-0.5 text-[10px] font-bold text-emerald-900">
                            원생
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {/* 참여 행사 */}
              <section className="rounded-2xl border border-[#D4E4BC] bg-white p-4">
                <h3 className="text-xs font-bold text-[#2D5A3D]">
                  🎟 참여 행사 ({detail.participatedEvents.length}건)
                </h3>
                {detail.participatedEvents.length === 0 ? (
                  <p className="mt-2 text-[11px] text-[#8B7F75]">
                    참여한 행사가 없어요
                  </p>
                ) : (
                  <ul className="mt-2 space-y-1.5">
                    {detail.participatedEvents.map((e) => (
                      <li
                        key={e.id}
                        className="flex items-start justify-between gap-2 rounded-lg bg-[#F5F1E8] p-2"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-bold text-[#3D3A36]">
                            {e.name}
                          </p>
                          <p className="text-[10px] text-[#8B7F75]">
                            {formatDate(e.startsAt)}
                            {e.endsAt && ` ~ ${formatDate(e.endsAt)}`}
                          </p>
                        </div>
                        <span className="shrink-0 rounded-full bg-white px-1.5 py-0.5 text-[10px] font-bold text-[#2D5A3D]">
                          {e.status}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {/* 최근 미션 제출 */}
              <section className="rounded-2xl border border-[#D4E4BC] bg-white p-4">
                <h3 className="text-xs font-bold text-[#2D5A3D]">
                  📋 최근 미션 제출 ({detail.recentSubmissions.length}건)
                </h3>
                {detail.recentSubmissions.length === 0 ? (
                  <p className="mt-2 text-[11px] text-[#8B7F75]">
                    아직 제출 이력이 없어요
                  </p>
                ) : (
                  <ul className="mt-2 space-y-1.5">
                    {detail.recentSubmissions.map((s) => {
                      const badge = STATUS_BADGE[s.status] ?? {
                        label: s.status,
                        color: "bg-stone-200 text-stone-700",
                      };
                      return (
                        <li
                          key={s.id}
                          className="flex flex-wrap items-center gap-2 rounded-lg bg-[#F5F1E8] p-2"
                        >
                          <span aria-hidden>{s.missionIcon ?? "📋"}</span>
                          <span className="min-w-0 flex-1 truncate text-xs font-bold text-[#3D3A36]">
                            {s.missionTitle}
                          </span>
                          {s.awardedAcorns != null && s.awardedAcorns > 0 && (
                            <span className="text-[10px] font-bold text-amber-700">
                              +{s.awardedAcorns}🌰
                            </span>
                          )}
                          <span
                            className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${badge.color}`}
                          >
                            {badge.label}
                          </span>
                          <span className="text-[10px] text-[#8B7F75]">
                            {formatDateTime(s.submittedAt)}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>

              {/* 도토리 거래 */}
              <section className="rounded-2xl border border-[#D4E4BC] bg-white p-4">
                <h3 className="text-xs font-bold text-[#2D5A3D]">
                  🌰 도토리 거래 (최근 {detail.recentAcornTx.length}건)
                </h3>
                {detail.recentAcornTx.length === 0 ? (
                  <p className="mt-2 text-[11px] text-[#8B7F75]">
                    거래 이력이 없어요
                  </p>
                ) : (
                  <ul className="mt-2 space-y-1">
                    {detail.recentAcornTx.map((t) => {
                      const isPositive = t.amount >= 0;
                      return (
                        <li
                          key={t.id}
                          className="flex items-center justify-between gap-2 text-[11px]"
                        >
                          <span className="text-[#8B7F75]">
                            {formatDateTime(t.createdAt)}
                          </span>
                          <span className="font-semibold text-[#6B6560]">
                            {t.reason}
                          </span>
                          <span
                            className={`shrink-0 font-mono font-bold tabular-nums ${
                              isPositive ? "text-emerald-700" : "text-rose-700"
                            }`}
                          >
                            {isPositive ? "+" : ""}
                            {t.amount.toLocaleString("ko-KR")}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            </div>
          )}
        </div>

        <footer className="border-t border-[#D4E4BC] bg-white px-4 py-2 text-center text-[10px] text-[#8B7F75]">
          ESC · 백드롭 클릭으로 닫기 · 페이지 경로: {basePath}/members
        </footer>
      </aside>
    </div>
  );
}
