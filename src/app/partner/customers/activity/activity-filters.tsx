"use client";

import Link from "next/link";
import { useState, useMemo, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";

type ActorType = "ORG" | "CUSTOMER" | "COMPANY" | "SYSTEM";
type ActionType = "REGISTER" | "BOOKING" | "PAYMENT" | "REFUND" | "INQUIRY";

type Event = {
  id: string;
  timestamp: string;
  actorType: ActorType;
  actorName: string;
  action: ActionType;
  target: string;
  href: string | null;
  amount?: number | null;
  timeLabel: string;
  fullTime: string;
  actionLabel: string;
  actionIcon: string;
  actionColor: string;
  actorIcon: string;
  actorLabel: string;
  amountLabel: string | null;
};

const ACTOR_FILTERS: { value: ActorType | "ALL"; label: string }[] = [
  { value: "ALL", label: "전체" },
  { value: "ORG", label: "🏫 기관" },
  { value: "CUSTOMER", label: "👨‍👩‍👧 개인" },
  { value: "COMPANY", label: "🏢 기업" },
];

const ACTION_FILTERS: { value: ActionType | "ALL"; label: string }[] = [
  { value: "ALL", label: "전체 액션" },
  { value: "REGISTER", label: "🌱 등록" },
  { value: "BOOKING", label: "📅 예약" },
  { value: "PAYMENT", label: "💰 결제" },
  { value: "REFUND", label: "↩️ 환불" },
  { value: "INQUIRY", label: "💬 문의" },
];

export function ActivityFilters({ events }: { events: Event[] }) {
  const [actorFilter, setActorFilter] = useState<ActorType | "ALL">("ALL");
  const [actionFilter, setActionFilter] = useState<ActionType | "ALL">("ALL");
  const [autoRefresh, setAutoRefresh] = useState(true);
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    return events.filter((e) => {
      if (actorFilter !== "ALL" && e.actorType !== actorFilter) return false;
      if (actionFilter !== "ALL" && e.action !== actionFilter) return false;
      return true;
    });
  }, [events, actorFilter, actionFilter]);

  // Auto-refresh 폴링 (60초마다 router.refresh)
  useEffect(() => {
    if (!autoRefresh) return;
    const timer = setInterval(() => {
      startTransition(() => {
        router.refresh();
      });
    }, 60_000);
    return () => clearInterval(timer);
  }, [autoRefresh, router]);

  return (
    <>
      {/* 필터 바 */}
      <section className="sticky top-[57px] z-20 -mx-4 border-b border-[#D4E4BC] bg-white/95 px-4 py-3 backdrop-blur md:top-[57px]">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-semibold text-[#6B6560]">유형:</span>
            {ACTOR_FILTERS.map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={() => setActorFilter(f.value)}
                aria-pressed={actorFilter === f.value}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                  actorFilter === f.value
                    ? "bg-emerald-700 text-white shadow-sm"
                    : "border border-[#D4E4BC] bg-white text-[#6B6560] hover:bg-[#FFF8F0]"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-semibold text-[#6B6560]">액션:</span>
            {ACTION_FILTERS.map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={() => setActionFilter(f.value)}
                aria-pressed={actionFilter === f.value}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                  actionFilter === f.value
                    ? "bg-violet-600 text-white shadow-sm"
                    : "border border-[#D4E4BC] bg-white text-[#6B6560] hover:bg-[#FFF8F0]"
                }`}
              >
                {f.label}
              </button>
            ))}
            <div className="ml-auto flex items-center gap-2">
              <label className="flex items-center gap-1.5 text-xs text-[#6B6560]">
                <input
                  type="checkbox"
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-[#D4E4BC] text-emerald-600 focus:ring-emerald-500"
                />
                자동 갱신 (60초)
              </label>
              <button
                type="button"
                onClick={() => startTransition(() => router.refresh())}
                disabled={isPending}
                className="rounded-lg border border-[#D4E4BC] bg-white px-2.5 py-1 text-xs font-semibold text-[#2D5A3D] hover:bg-[#FFF8F0] disabled:opacity-50"
              >
                {isPending ? "갱신..." : "🔄 새로고침"}
              </button>
            </div>
          </div>
          <div className="text-[11px] text-[#6B6560]">
            총 {filtered.length.toLocaleString("ko-KR")}건 표시 (전체 {events.length}건)
          </div>
        </div>
      </section>

      {/* 타임라인 */}
      <section className="rounded-2xl border border-[#D4E4BC] bg-white p-5 shadow-sm">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[#D4E4BC] bg-[#FFF8F0] p-10 text-center">
            <div className="text-4xl">🌱</div>
            <p className="mt-3 text-sm font-semibold text-[#2D5A3D]">
              표시할 활동이 없어요
            </p>
            <p className="mt-1 text-xs text-[#6B6560]">
              필터를 조정하거나 고객을 등록해 보세요.
            </p>
          </div>
        ) : (
          <ol className="relative ml-4 space-y-4 border-l-2 border-[#E8F0E4] pl-5">
            {filtered.map((e) => {
              const body = (
                <>
                  <span className="absolute -left-[35px] flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-white shadow-sm ring-2 ring-[#D4E4BC]">
                    <span className="text-sm">{e.actionIcon}</span>
                  </span>
                  <div className="flex flex-wrap items-baseline gap-1.5 text-sm">
                    <span className="text-lg leading-none">{e.actorIcon}</span>
                    <span className="font-bold text-[#2C2C2C]">{e.actorName}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${e.actionColor}`}
                    >
                      {e.actionLabel}
                    </span>
                    <span className="text-[#6B6560]">{e.target}</span>
                    {e.amountLabel && (
                      <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[11px] font-bold text-amber-700 ring-1 ring-amber-200">
                        {e.amountLabel}
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 text-[11px] text-[#6B6560]">
                    <span title={e.fullTime}>{e.timeLabel}</span>
                    <span>·</span>
                    <span>{e.actorLabel}</span>
                    {e.href && (
                      <>
                        <span>·</span>
                        <span className="text-violet-600 group-hover:underline">
                          상세 보기 →
                        </span>
                      </>
                    )}
                  </div>
                </>
              );
              return (
                <li key={e.id} className="relative">
                  {e.href ? (
                    <Link
                      href={e.href}
                      className="group block rounded-xl border border-transparent bg-[#FFF8F0] p-3 transition hover:border-[#D4E4BC] hover:bg-white"
                    >
                      {body}
                    </Link>
                  ) : (
                    <div className="rounded-xl bg-[#FFF8F0] p-3">{body}</div>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </>
  );
}
