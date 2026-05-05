"use client";

// 라이브 채팅 스트림 — "보이는 라디오" 안에서 메시지가 흘러가지 않고 화면에 머무름.
//   - Realtime 으로 새 메시지 INSERT/UPDATE 를 리스트에 반영
//   - 최신 N개만 유지 (스크롤해서 옛 메시지 볼 수 있음)
//   - 본인 메시지 (currentUserId 매칭) 에 수정/삭제 버튼 노출
//   - 메시지 우측에 작성 시각(HH:MM) 표시
//   - DriftUpChat (VFX) 와 별도 — DriftUpChat 은 시각적 효과, 이건 가독용 텍스트

import { useEffect, useRef, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  deleteOwnChatMessageAction,
  editOwnChatMessageAction,
} from "@/lib/tori-fm/actions";
import type { FmChatMessageRow } from "@/lib/tori-fm/types";

const MAX_VISIBLE = 30; // 메모리 상한 — 스크롤로 과거 메시지 접근

interface Props {
  sessionId: string;
  initialMessages?: FmChatMessageRow[];
  /** 현재 로그인 유저 — 본인 메시지 우측 배치(카톡 스타일) + 수정/삭제 노출. */
  currentUserId?: string | null;
  /**
   * 뷰어 역할 — 호스트(DJ) 가 콘솔에서 보면 자기가 보낸 DJ 메시지가
   * 우측으로 가도록 분기. 기본 'USER' (참가자 뷰).
   *  - 'USER': sender_type='USER' && user_id===currentUserId 가 본인 메시지
   *  - 'DJ'  : sender_type='DJ' 가 본인 메시지 (수정/삭제 액션은 user_id 없으므로 비노출)
   */
  viewerRole?: "USER" | "DJ";
}

/** 작성 시각 — 24시간 HH:MM. iso 가 잘못되면 빈 문자열. */
function fmtTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const hh = d.getHours().toString().padStart(2, "0");
  const mm = d.getMinutes().toString().padStart(2, "0");
  return `${hh}:${mm}`;
}

export function LiveChatStream({
  sessionId,
  initialMessages = [],
  currentUserId = null,
  viewerRole = "USER",
}: Props) {
  const [messages, setMessages] = useState<FmChatMessageRow[]>(
    initialMessages.slice(-MAX_VISIBLE)
  );
  const listRef = useRef<HTMLDivElement | null>(null);

  // 수정 모드 — 한 번에 하나의 메시지만 수정 중
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // Realtime 구독 — INSERT/UPDATE 모두 처리 (UPDATE 는 is_deleted/edit 반영용)
  useEffect(() => {
    if (!sessionId) return;
    const supa = createClient();

    type Payload = {
      eventType?: "INSERT" | "UPDATE" | "DELETE";
      new?: FmChatMessageRow;
      old?: FmChatMessageRow;
    };

    const handle = (payload: Payload) => {
      const row = payload.new;
      if (!row || !row.id) return;
      setMessages((prev) => {
        const idx = prev.findIndex((m) => m.id === row.id);
        if (payload.eventType === "INSERT" || idx === -1) {
          if (row.is_deleted) return prev;
          const next = [...prev, row];
          return next.length > MAX_VISIBLE
            ? next.slice(next.length - MAX_VISIBLE)
            : next;
        }
        // UPDATE — 교체
        const copy = prev.slice();
        copy[idx] = row;
        return copy;
      });
    };

    const channel = supa
      .channel(`fm-stream-${sessionId}`)
      .on(
        "postgres_changes" as never,
        {
          event: "*",
          schema: "public",
          table: "tori_fm_chat_messages",
          filter: `session_id=eq.${sessionId}`,
        } as never,
        handle as never
      )
      .subscribe();

    return () => {
      void supa.removeChannel(channel);
    };
  }, [sessionId]);

  // 새 메시지 들어오면 자동 스크롤 (가장 아래)
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages]);

  /* ---------------- 액션 핸들러 ---------------- */

  const beginEdit = (m: FmChatMessageRow) => {
    setEditingId(m.id);
    setEditingText(m.message);
  };
  const cancelEdit = () => {
    setEditingId(null);
    setEditingText("");
  };

  const submitEdit = (id: string) => {
    const next = editingText.trim();
    if (!next) return;
    setBusyId(id);
    startTransition(async () => {
      try {
        await editOwnChatMessageAction(id, next);
        // 낙관적 업데이트 — Realtime UPDATE 가 들어오면 다시 sync
        setMessages((prev) =>
          prev.map((m) => (m.id === id ? { ...m, message: next } : m))
        );
        cancelEdit();
      } catch (e) {
        alert(e instanceof Error ? e.message : "수정에 실패했어요");
      } finally {
        setBusyId(null);
      }
    });
  };

  const handleDelete = (id: string) => {
    if (!window.confirm("이 메시지를 삭제할까요?")) return;
    setBusyId(id);
    startTransition(async () => {
      try {
        await deleteOwnChatMessageAction(id);
        setMessages((prev) =>
          prev.map((m) => (m.id === id ? { ...m, is_deleted: true } : m))
        );
      } catch (e) {
        alert(e instanceof Error ? e.message : "삭제에 실패했어요");
      } finally {
        setBusyId(null);
      }
    });
  };

  const visible = messages.filter((m) => !m.is_deleted);

  if (visible.length === 0) {
    return (
      <div className="pointer-events-none rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-3 backdrop-blur-md">
        <p className="text-center text-[11px] text-white/55">
          💬 첫 인사를 남겨 보세요
        </p>
      </div>
    );
  }

  return (
    <div
      ref={listRef}
      style={{
        // Firefox 스크롤바
        scrollbarWidth: "thin",
        scrollbarColor: "rgba(255,255,255,0.2) transparent",
      }}
      className="pointer-events-auto max-h-56 overflow-y-auto rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 backdrop-blur-md sm:max-h-72
        [&::-webkit-scrollbar]:w-1.5
        [&::-webkit-scrollbar-track]:bg-transparent
        [&::-webkit-scrollbar-thumb]:rounded-full
        [&::-webkit-scrollbar-thumb]:bg-white/20
        hover:[&::-webkit-scrollbar-thumb]:bg-white/30"
      role="log"
      aria-live="polite"
      aria-label="실시간 청취자 채팅"
    >
      <ul className="space-y-0.5">
        {visible.map((m) => {
          const isDj = m.sender_type === "DJ";
          const isSystem = m.sender_type === "SYSTEM";
          // 본인 메시지 판정 — 뷰어 역할에 따라 분기.
          //  - DJ 뷰어(호스트 콘솔): DJ 메시지가 본인
          //  - USER 뷰어(참가자): user_id 매칭 + sender_type='USER' 가 본인
          const isMine =
            viewerRole === "DJ"
              ? isDj
              : !!currentUserId &&
                m.user_id === currentUserId &&
                !isDj &&
                !isSystem;
          // 본인 메시지 수정/삭제는 USER 역할일 때만 (DJ 메시지는 user_id null 이라
          // editOwnChatMessageAction 검증이 통과 안 됨 — 호스트용 액션은 별도 필요).
          const canModifyMine = isMine && viewerRole === "USER";
          const isEditing = editingId === m.id;
          const isBusy = busyId === m.id;
          const time = fmtTime(m.created_at);

          if (isSystem) {
            return (
              <li
                key={m.id}
                className="flex justify-center py-0.5 text-[11px] text-sky-300/85"
              >
                <span className="rounded-full bg-sky-500/15 px-2.5 py-0.5 ring-1 ring-sky-400/25">
                  📢 {m.message}
                </span>
              </li>
            );
          }

          // 본인 메시지 — 우측 정렬, 본인 식별색.
          // DJ 본인(viewerRole='DJ') 은 rose, 참가자 본인은 emerald.
          // 수정/삭제는 USER 역할일 때만 (canModifyMine) — DJ 액션은 별도 미구현.
          if (isMine) {
            const ownColor = isDj ? "text-rose-300" : "text-emerald-200";
            if (isEditing && canModifyMine) {
              return (
                <li
                  key={m.id}
                  className="flex flex-wrap items-center justify-end gap-1 text-[13px]"
                >
                  <input
                    type="text"
                    value={editingText}
                    onChange={(e) =>
                      setEditingText(e.target.value.slice(0, 300))
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !isBusy && editingText.trim()) {
                        e.preventDefault();
                        submitEdit(m.id);
                      } else if (e.key === "Escape") {
                        cancelEdit();
                      }
                    }}
                    autoFocus
                    maxLength={300}
                    aria-label="메시지 수정"
                    className="min-w-0 flex-1 rounded-md border border-emerald-300/40 bg-white/[0.06] px-2 py-1 text-[13px] font-bold text-emerald-100 placeholder:text-emerald-300/40 focus:border-emerald-300 focus:outline-none"
                  />
                  <button
                    type="button"
                    disabled={isBusy || !editingText.trim()}
                    onClick={() => submitEdit(m.id)}
                    className="shrink-0 rounded-md bg-emerald-400 px-2 py-1 text-[10px] font-bold text-emerald-950 transition hover:bg-emerald-300 disabled:opacity-40"
                  >
                    저장
                  </button>
                  <button
                    type="button"
                    onClick={cancelEdit}
                    className="shrink-0 rounded-md border border-white/15 bg-white/[0.05] px-2 py-1 text-[10px] font-bold text-white/70 transition hover:bg-white/10"
                  >
                    취소
                  </button>
                </li>
              );
            }
            return (
              <li
                key={m.id}
                className="flex flex-wrap items-baseline justify-end gap-1.5 break-words text-right text-[13px] leading-relaxed"
              >
                <span className={`font-bold ${ownColor}`}>{m.message}</span>
                <span
                  className="font-mono text-[10px] tabular-nums text-white/40"
                  suppressHydrationWarning
                >
                  {time}
                </span>
                {canModifyMine && (
                  <>
                    <button
                      type="button"
                      onClick={() => beginEdit(m)}
                      disabled={isBusy}
                      aria-label="메시지 수정"
                      title="수정"
                      className="rounded p-0.5 text-[11px] text-white/40 transition hover:bg-white/10 hover:text-emerald-200 disabled:opacity-40"
                    >
                      ✏
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(m.id)}
                      disabled={isBusy}
                      aria-label="메시지 삭제"
                      title="삭제"
                      className="rounded p-0.5 text-[11px] text-white/40 transition hover:bg-rose-500/15 hover:text-rose-300 disabled:opacity-40"
                    >
                      🗑
                    </button>
                  </>
                )}
              </li>
            );
          }

          // 다른 사람 메시지 — 좌측 정렬, [이름][메시지][시간]
          const senderColor = isDj ? "text-rose-300" : "text-amber-200";
          const senderPrefix = isDj ? "🎙 " : "";

          return (
            <li
              key={m.id}
              className="flex flex-wrap items-baseline gap-1.5 break-words text-[13px] leading-relaxed"
            >
              <span className={`font-bold ${senderColor}`}>
                {senderPrefix}
                {m.sender_name}
              </span>
              <span className="text-white/95">{m.message}</span>
              <span
                className="font-mono text-[10px] tabular-nums text-white/40"
                suppressHydrationWarning
              >
                {time}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
