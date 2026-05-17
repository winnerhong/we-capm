"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { bulkManualGrantAction } from "@/lib/gifts/actions";

export type RecipientRow = {
  id: string;
  parentName: string;
  phone: string;
  childNames: string[];
  /** enrolled 자녀의 대표 반 이름. 없으면 null. */
  className: string | null;
};

type EventLite = {
  id: string;
  name: string;
  participantIds: string[];
};

type Mode = "all" | "event" | "manual";

type Props = {
  orgId: string;
  recipients: RecipientRow[];
  events: EventLite[];
};

export function GrantForm({ orgId, recipients, events }: Props) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("all");
  const [selectedEventId, setSelectedEventId] = useState<string>(
    events[0]?.id ?? ""
  );
  const [pickedIds, setPickedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [giftLabel, setGiftLabel] = useState("");
  const [message, setMessage] = useState("");
  const [days, setDays] = useState<number>(30);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<
    | { granted: number; failed: Array<{ userId: string; reason: string }> }
    | null
  >(null);

  const filteredRecipients = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return recipients;
    return recipients.filter((r) => {
      const hay = `${r.parentName} ${r.phone} ${r.childNames.join(" ")} ${r.className ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [recipients, search]);

  const targetIds = useMemo<string[]>(() => {
    if (mode === "all") return recipients.map((r) => r.id);
    if (mode === "event") {
      const ev = events.find((e) => e.id === selectedEventId);
      return ev ? ev.participantIds : [];
    }
    return Array.from(pickedIds);
  }, [mode, recipients, events, selectedEventId, pickedIds]);

  function togglePicked(id: string) {
    setPickedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAll() {
    setPickedIds(new Set(filteredRecipients.map((r) => r.id)));
  }
  function clearAll() {
    setPickedIds(new Set());
  }

  const canSubmit =
    !isPending &&
    giftLabel.trim().length > 0 &&
    targetIds.length > 0 &&
    days >= 1 &&
    days <= 365;

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);
    setResult(null);
    if (
      !window.confirm(
        `${targetIds.length}명에게 "${giftLabel}" 을(를) 발급할까요?`
      )
    )
      return;

    startTransition(async () => {
      try {
        const r = await bulkManualGrantAction({
          userIds: targetIds,
          giftLabel: giftLabel.trim(),
          message: message.trim() || null,
          expiresInDays: days,
        });
        setResult(r);
        if (r.failed.length === 0) {
          window.alert(`${r.granted}건 발급 완료`);
          router.push(`/org/${orgId}/gifts`);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "발급 실패");
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      {/* Step 1 — 대상 선택 모드 */}
      <section className="rounded-3xl border border-[#D4E4BC] bg-white p-5 shadow-sm">
        <h2 className="text-sm font-bold text-[#2D5A3D]">
          1️⃣ 누구에게 발급할까요?
        </h2>
        <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-3">
          <ModeCard
            active={mode === "all"}
            onClick={() => setMode("all")}
            icon="👨‍👩‍👧"
            label="전체 학부모"
            hint={`${recipients.length}명`}
          />
          <ModeCard
            active={mode === "event"}
            onClick={() => setMode("event")}
            icon="🎪"
            label="행사 참가자"
            hint={
              events.length === 0
                ? "행사 없음"
                : `${events.length}개 행사`
            }
            disabled={events.length === 0}
          />
          <ModeCard
            active={mode === "manual"}
            onClick={() => setMode("manual")}
            icon="✏️"
            label="직접 선택"
            hint="체크박스로 고르기"
          />
        </div>

        {mode === "event" && events.length > 0 && (
          <label className="mt-3 flex flex-col gap-1 text-xs font-semibold text-[#6B6560]">
            행사 선택
            <select
              value={selectedEventId}
              onChange={(e) => setSelectedEventId(e.target.value)}
              className="rounded-lg border border-[#D4E4BC] bg-white px-3 py-2 text-sm"
            >
              {events.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name} · {e.participantIds.length}명
                </option>
              ))}
            </select>
          </label>
        )}

        {mode === "manual" && (
          <div className="mt-3 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="이름·연락처·자녀 검색"
                className="flex-1 min-w-[180px] rounded-lg border border-[#D4E4BC] bg-white px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={selectAll}
                className="rounded-lg border border-[#D4E4BC] bg-white px-3 py-2 text-xs font-semibold text-[#2D5A3D] hover:bg-[#F5F1E8]"
              >
                전체 선택 (검색결과)
              </button>
              <button
                type="button"
                onClick={clearAll}
                className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100"
              >
                해제
              </button>
            </div>
            <div className="max-h-72 overflow-y-auto rounded-xl border border-[#F0EBE3]">
              {filteredRecipients.length === 0 ? (
                <p className="px-4 py-8 text-center text-xs text-[#6B6560]">
                  조건에 맞는 학부모가 없어요
                </p>
              ) : (
                <ul className="divide-y divide-[#F0EBE3]">
                  {filteredRecipients.map((r) => {
                    const checked = pickedIds.has(r.id);
                    const phoneTail = r.phone.slice(-4);
                    return (
                      <li key={r.id}>
                        <label className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-[#F5F1E8]">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => togglePicked(r.id)}
                            className="h-4 w-4"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-bold text-[#2D5A3D]">
                              {r.className && (
                                <span className="mr-1 text-[11px] font-semibold text-[#8B6F47]">
                                  {r.className}
                                </span>
                              )}
                              {(() => {
                                if (r.childNames.length > 0) {
                                  return `${r.childNames.join("·")} 가족`;
                                }
                                const isAutoName = /^학부모_\d+$/.test(
                                  r.parentName ?? ""
                                );
                                if (r.parentName && !isAutoName) {
                                  return `${r.parentName} 가족`;
                                }
                                return phoneTail
                                  ? `010-…-${phoneTail} 가족`
                                  : "참가자";
                              })()}
                            </p>
                            {phoneTail && (
                              <p className="text-[11px] text-[#8B7F75]">
                                010-…-{phoneTail}
                              </p>
                            )}
                          </div>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
            <p className="text-[11px] font-semibold text-[#2D5A3D]">
              선택됨: {pickedIds.size}명
            </p>
          </div>
        )}

        <p className="mt-3 rounded-xl bg-[#F5F1E8] px-3 py-2 text-[11px] font-semibold text-[#2D5A3D]">
          📦 발급 대상 합계: <b>{targetIds.length}명</b>
        </p>
      </section>

      {/* Step 2 — 선물 정보 */}
      <section className="rounded-3xl border border-[#D4E4BC] bg-white p-5 shadow-sm">
        <h2 className="text-sm font-bold text-[#2D5A3D]">
          2️⃣ 어떤 선물인가요?
        </h2>
        <div className="mt-3 space-y-3">
          <label className="flex flex-col gap-1 text-xs font-semibold text-[#6B6560]">
            선물명 <span className="text-rose-600">*</span>
            <input
              type="text"
              value={giftLabel}
              onChange={(e) => setGiftLabel(e.target.value)}
              placeholder="예: 도토리 음료 쿠폰"
              maxLength={60}
              required
              className="rounded-lg border border-[#D4E4BC] bg-white px-3 py-2 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold text-[#6B6560]">
            메시지 (선택)
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="예: 행사 참여 감사합니다 🌲"
              maxLength={200}
              rows={2}
              className="rounded-lg border border-[#D4E4BC] bg-white px-3 py-2 text-sm"
            />
          </label>
          <label className="flex max-w-[200px] flex-col gap-1 text-xs font-semibold text-[#6B6560]">
            만료 일수 (1~365)
            <input
              type="number"
              min={1}
              max={365}
              value={days}
              onChange={(e) => setDays(Number(e.target.value) || 30)}
              className="rounded-lg border border-[#D4E4BC] bg-white px-3 py-2 text-sm"
            />
          </label>
        </div>
      </section>

      {/* Submit */}
      <section className="flex flex-wrap items-center justify-end gap-2">
        {error && (
          <p className="mr-auto rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
            ⚠️ {error}
          </p>
        )}
        <button
          type="submit"
          disabled={!canSubmit}
          className="inline-flex items-center gap-1 rounded-2xl bg-gradient-to-r from-[#2D5A3D] to-[#3A7A52] px-5 py-3 text-sm font-bold text-white shadow-md transition hover:from-[#234a30] disabled:opacity-50"
        >
          {isPending ? "발급 중…" : `🚀 ${targetIds.length}명 발급`}
        </button>
      </section>

      {/* 부분 실패 결과 */}
      {result && result.failed.length > 0 && (
        <section className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-xs">
          <p className="font-bold text-amber-900">
            ✅ 성공 {result.granted}건 / ⚠️ 실패 {result.failed.length}건
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-amber-800">
            {result.failed.slice(0, 10).map((f) => (
              <li key={f.userId}>
                {f.userId.slice(0, 8)}… — {f.reason}
              </li>
            ))}
            {result.failed.length > 10 && (
              <li>외 {result.failed.length - 10}건</li>
            )}
          </ul>
        </section>
      )}
    </form>
  );
}

function ModeCard({
  active,
  onClick,
  icon,
  label,
  hint,
  disabled,
}: {
  active: boolean;
  onClick: () => void;
  icon: string;
  label: string;
  hint: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-2xl border p-4 text-left transition disabled:opacity-50 ${
        active
          ? "border-[#2D5A3D] bg-[#E8F0E4] ring-2 ring-[#2D5A3D]/30"
          : "border-[#D4E4BC] bg-white hover:border-[#2D5A3D]"
      }`}
    >
      <p className="text-2xl" aria-hidden>
        {icon}
      </p>
      <p className="mt-1 text-sm font-bold text-[#2D5A3D]">{label}</p>
      <p className="text-[11px] text-[#6B6560]">{hint}</p>
    </button>
  );
}
