"use client";

import { useState, useTransition } from "react";
import {
  stampParticipantAction,
  searchParticipantStampsAction,
  updateCongestionAction,
} from "./actions";

interface SlotInfo {
  id: string;
  name: string;
  icon: string | null;
  order: number;
  congestionStatus: "GREEN" | "YELLOW" | "RED";
  type: string;
  staffName: string | null;
  locationHint: string | null;
}

interface HistoryItem {
  id: string;
  participantName: string;
  slotName: string;
  stampedAt: string;
  stampedBy: string | null;
}

interface ParticipantSlot {
  slotId: string;
  slotName: string;
  slotIcon: string | null;
  stamped: boolean;
  stampedAt: string | null;
}

interface FoundParticipant {
  name: string;
  phone: string;
  stampCount: number;
  currentTier: { tier: string; label: string; emoji: string } | null;
  slots: ParticipantSlot[];
}

interface Props {
  eventId: string;
  eventName: string;
  boardId: string;
  boardName: string;
  slots: SlotInfo[];
  recentHistory: HistoryItem[];
}

const CONGESTION_COLORS = {
  GREEN: { bg: "bg-green-100", text: "text-green-700", border: "border-green-300", icon: "🟢", label: "여유" },
  YELLOW: { bg: "bg-yellow-100", text: "text-yellow-700", border: "border-yellow-300", icon: "🟡", label: "보통" },
  RED: { bg: "bg-red-100", text: "text-red-700", border: "border-red-300", icon: "🔴", label: "혼잡" },
} as const;

export function StampScanner({ eventId, eventName, boardId, boardName, slots, recentHistory }: Props) {
  const [phone, setPhone] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [foundParticipant, setFoundParticipant] = useState<FoundParticipant | null>(null);
  const [history, setHistory] = useState(recentHistory);
  const [confirmSlot, setConfirmSlot] = useState<{ slotId: string; slotName: string } | null>(null);
  const [congestionSlots, setCongestionSlots] = useState<Record<string, "GREEN" | "YELLOW" | "RED">>(
    Object.fromEntries(slots.map((s) => [s.id, s.congestionStatus]))
  );

  function formatPhoneInput(value: string) {
    const digits = value.replace(/\D/g, "");
    if (digits.length <= 3) return digits;
    if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7, 11)}`;
  }

  function handleSearch() {
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 4) {
      setError("전화번호를 입력해주세요");
      return;
    }
    setError("");
    setSuccess("");
    setFoundParticipant(null);

    startTransition(async () => {
      const result = await searchParticipantStampsAction(eventId, digits);
      if (!result.ok) {
        setError(result.message ?? "검색 실패");
        return;
      }
      if (result.participant) {
        setFoundParticipant(result.participant);
      }
    });
  }

  function handleStamp(slotId: string, slotName: string) {
    setConfirmSlot({ slotId, slotName });
  }

  function confirmStamp() {
    if (!confirmSlot || !foundParticipant) return;
    setError("");
    setSuccess("");

    startTransition(async () => {
      const result = await stampParticipantAction(eventId, confirmSlot.slotId, foundParticipant.phone);
      setConfirmSlot(null);

      if (!result.ok) {
        setError(result.message ?? "도장 찍기 실패");
        return;
      }

      const tierMsg = result.newTier ? ` (새 등급 달성!)` : "";
      setSuccess(`${result.participantName}님에게 도장을 찍었습니다! (${result.stampCount}개)${tierMsg}`);

      // Update local state
      if (foundParticipant) {
        setFoundParticipant({
          ...foundParticipant,
          stampCount: result.stampCount ?? foundParticipant.stampCount + 1,
          slots: foundParticipant.slots.map((s) =>
            s.slotId === confirmSlot.slotId
              ? { ...s, stamped: true, stampedAt: new Date().toISOString() }
              : s
          ),
        });
      }

      // Add to history
      setHistory((prev) => [
        {
          id: `new-${Date.now()}`,
          participantName: result.participantName ?? foundParticipant.name,
          slotName: confirmSlot.slotName,
          stampedAt: new Date().toISOString(),
          stampedBy: null,
        },
        ...prev,
      ]);
    });
  }

  function handleCongestionChange(slotId: string, status: "GREEN" | "YELLOW" | "RED") {
    setCongestionSlots((prev) => ({ ...prev, [slotId]: status }));
    startTransition(async () => {
      await updateCongestionAction(eventId, slotId, status);
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">🎫 도장 찍기</h1>
        <p className="text-sm text-neutral-500">{eventName} - {boardName}</p>
      </div>

      {/* Phone search */}
      <div className="rounded-2xl border-2 border-violet-200 bg-violet-50 p-5">
        <label htmlFor="phone-search" className="block text-sm font-bold text-violet-800 mb-2">
          참가자 전화번호 검색
        </label>
        <div className="flex gap-2">
          <input
            id="phone-search"
            type="tel"
            inputMode="numeric"
            autoComplete="tel"
            value={phone}
            onChange={(e) => setPhone(formatPhoneInput(e.target.value))}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="010-0000-0000"
            className="flex-1 rounded-xl border-2 border-violet-200 bg-white px-4 py-3 text-lg focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-200"
          />
          <button
            onClick={handleSearch}
            disabled={isPending}
            className="rounded-xl bg-violet-600 px-6 py-3 font-bold text-white hover:bg-violet-700 disabled:opacity-50 transition-colors"
          >
            {isPending ? "..." : "검색"}
          </button>
        </div>
      </div>

      {/* Error / Success messages */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-700">
          {success}
        </div>
      )}

      {/* Found participant */}
      {foundParticipant && (
        <div className="rounded-2xl border-2 border-violet-300 bg-white p-5 space-y-4">
          {/* Participant info header */}
          <div className="flex items-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-100 text-2xl">
              {foundParticipant.currentTier?.emoji ?? "🌰"}
            </div>
            <div>
              <h3 className="text-lg font-bold">{foundParticipant.name}</h3>
              <p className="text-sm text-neutral-500">{foundParticipant.phone}</p>
            </div>
            <div className="ml-auto text-right">
              <div className="text-2xl font-bold text-violet-700">{foundParticipant.stampCount}</div>
              <div className="text-xs text-neutral-500">/{foundParticipant.slots.length} 도장</div>
            </div>
          </div>

          {/* Stamp slots grid */}
          <div className="grid grid-cols-3 gap-2">
            {foundParticipant.slots.map((slot) => (
              <button
                key={slot.slotId}
                onClick={() => !slot.stamped && handleStamp(slot.slotId, slot.slotName)}
                disabled={slot.stamped || isPending}
                className={`rounded-xl border-2 p-3 text-center transition-all ${
                  slot.stamped
                    ? "border-green-200 bg-green-50 cursor-default"
                    : "border-violet-200 bg-white hover:border-violet-400 hover:bg-violet-50 active:scale-95"
                }`}
              >
                <div className="text-xl">{slot.slotIcon || "📍"}</div>
                <div className="text-xs font-medium mt-1 truncate">{slot.slotName}</div>
                <div className={`text-lg mt-1 ${slot.stamped ? "text-green-500" : "text-neutral-300"}`}>
                  {slot.stamped ? "\u2705" : "\u25CB"}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Confirm dialog */}
      {confirmSlot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-xs rounded-2xl bg-white p-6 text-center">
            <div className="text-4xl mb-3">🎫</div>
            <h3 className="text-lg font-bold">도장을 찍으시겠어요?</h3>
            <p className="mt-2 text-sm text-neutral-600">
              <span className="font-semibold text-violet-700">{foundParticipant?.name}</span>님의
              <br />
              <span className="font-semibold">{confirmSlot.slotName}</span> 스테이션
            </p>
            <div className="mt-5 flex gap-2">
              <button
                onClick={() => setConfirmSlot(null)}
                className="flex-1 rounded-xl border-2 py-3 font-semibold text-neutral-600 hover:bg-neutral-50"
              >
                취소
              </button>
              <button
                onClick={confirmStamp}
                disabled={isPending}
                className="flex-1 rounded-xl bg-violet-600 py-3 font-bold text-white hover:bg-violet-700 disabled:opacity-50"
              >
                {isPending ? "처리 중..." : "찍기!"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Congestion control */}
      <div className="rounded-2xl border bg-white p-5">
        <h2 className="font-bold mb-3">혼잡도 관리</h2>
        <div className="space-y-2">
          {slots.filter((s) => s.type === "MANUAL").map((slot) => {
            const current = congestionSlots[slot.id] ?? "GREEN";
            return (
              <div key={slot.id} className="flex items-center gap-3 rounded-lg bg-neutral-50 p-3">
                <span className="text-lg">{slot.icon || "📍"}</span>
                <span className="flex-1 text-sm font-medium">{slot.name}</span>
                <div className="flex gap-1">
                  {(["GREEN", "YELLOW", "RED"] as const).map((status) => {
                    const c = CONGESTION_COLORS[status];
                    const isActive = current === status;
                    return (
                      <button
                        key={status}
                        onClick={() => handleCongestionChange(slot.id, status)}
                        disabled={isPending}
                        className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all ${
                          isActive
                            ? `${c.bg} ${c.text} ${c.border} border-2`
                            : "border border-neutral-200 bg-white text-neutral-400 hover:bg-neutral-100"
                        }`}
                        aria-label={`${slot.name} 혼잡도 ${c.label}`}
                      >
                        {c.icon}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recent stamp history */}
      <div className="rounded-2xl border bg-white p-5">
        <h2 className="font-bold mb-3">최근 도장 기록</h2>
        {history.length === 0 ? (
          <p className="text-sm text-neutral-400 text-center py-6">아직 기록이 없습니다</p>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {history.map((item) => (
              <div key={item.id} className="flex items-center gap-3 rounded-lg bg-neutral-50 p-3">
                <span className="text-green-500">✅</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{item.participantName}</div>
                  <div className="text-xs text-neutral-400">{item.slotName}</div>
                </div>
                <div className="text-[11px] text-neutral-400 whitespace-nowrap">
                  {new Date(item.stampedAt).toLocaleTimeString("ko-KR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
