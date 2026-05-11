"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  deleteMessageAction,
  deleteOrgMessageAction,
  editMessageAction,
  editOrgMessageAction,
  markRoomReadAction,
  sendMessageAction,
  sendOrgMessageAction,
} from "@/lib/toritalk/actions";
import type { ToritalkMessageWithSender } from "@/lib/toritalk/types";
import { fmtClockKstAlways } from "@/lib/datetime/kst";

type Mode = "user" | "admin";

interface Props {
  roomId: string;
  roomName: string;
  /** "user" = 보호자 채팅 / "admin" = 기관 관리자 공지 발신 */
  mode: Mode;
  /** mode=user 일 때 본인 식별 */
  meUserId?: string;
  meName?: string;
  /** 본인 아바타 fallback 글자 — 원생 첫 글자 우선, 없으면 부모 첫 글자 */
  meDisplayLetter?: string | null;
  /** mode=admin 일 때 기관 정보 */
  orgId?: string;
  orgName?: string;
  /** 뒤로가기 링크 — 모드별로 다름 */
  backHref?: string;
  initialMessages: ToritalkMessageWithSender[];
}

export function ChatRoomView({
  roomId,
  roomName,
  mode,
  meUserId,
  meName,
  meDisplayLetter,
  orgId,
  orgName,
  backHref,
  initialMessages,
}: Props) {
  const isAdmin = mode === "admin";
  const [messages, setMessages] = useState<ToritalkMessageWithSender[]>(
    initialMessages
  );
  const [input, setInput] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const senderProfileCache = useRef<
    Map<
      string,
      {
        name: string;
        photo: string | null;
        letter: string | null;
        childName: string | null;
      }
    >
  >(new Map());

  // 초기 메시지의 senders 캐시 채우기
  useEffect(() => {
    for (const m of initialMessages) {
      if (m.sender_user_id) {
        senderProfileCache.current.set(m.sender_user_id, {
          name: m.sender_name ?? "(알 수 없음)",
          photo: m.sender_photo_url,
          letter: m.sender_display_letter,
          childName: m.sender_child_name,
        });
      }
    }
  }, [initialMessages]);

  // 본인 정보 캐시 — user 모드에서만 (admin은 캐시 불필요)
  useEffect(() => {
    if (isAdmin || !meUserId) return;
    const existing = senderProfileCache.current.get(meUserId);
    senderProfileCache.current.set(meUserId, {
      name: meName ?? "",
      photo: existing?.photo ?? null,
      letter:
        meDisplayLetter ?? meName?.trim().charAt(0) ?? null,
      childName: existing?.childName ?? null,
    });
  }, [isAdmin, meUserId, meName, meDisplayLetter]);

  // Realtime 구독 — INSERT + UPDATE(수정/삭제 반영)
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`toritalk-room-${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "toritalk_messages",
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          const row = payload.new as {
            id: string;
            content: string;
            edited_at: string | null;
            deleted_at: string | null;
          };
          setMessages((prev) =>
            prev.map((m) =>
              m.id === row.id
                ? {
                    ...m,
                    content: row.content,
                    edited_at: row.edited_at,
                    deleted_at: row.deleted_at,
                  }
                : m
            )
          );
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "toritalk_messages",
          filter: `room_id=eq.${roomId}`,
        },
        async (payload) => {
          const row = payload.new as {
            id: string;
            room_id: string;
            sender_user_id: string | null;
            sender_org_id: string | null;
            content: string;
            created_at: string;
            edited_at: string | null;
            deleted_at: string | null;
          };

          // 발신자 프로필 로드 (캐시 활용) + 원생 첫 이름
          let senderName: string | null = null;
          let senderPhoto: string | null = null;
          let senderLetter: string | null = null;
          let senderChildName: string | null = null;
          let senderOrgName: string | null = null;

          if (row.sender_org_id) {
            // 기관 발신 — 기관명 조회
            try {
              const { data } = await supabase
                .from("partner_orgs")
                .select("org_name")
                .eq("id", row.sender_org_id)
                .maybeSingle();
              senderOrgName =
                (data as { org_name?: string } | null)?.org_name ?? null;
            } catch {
              /* ignore */
            }
          } else if (row.sender_user_id) {
            const cached = senderProfileCache.current.get(row.sender_user_id);
            if (cached) {
              senderName = cached.name;
              senderPhoto = cached.photo;
              senderLetter = cached.letter;
              senderChildName = cached.childName;
            } else {
              try {
                const [userResp, childResp] = await Promise.all([
                  supabase
                    .from("app_users")
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    .select("parent_name,profile_photo_url" as any)
                    .eq("id", row.sender_user_id)
                    .maybeSingle(),
                  supabase
                    .from("app_children")
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    .select("name,is_enrolled,created_at" as any)
                    .eq("user_id", row.sender_user_id),
                ]);
                const u = userResp.data as unknown as {
                  parent_name?: string;
                  profile_photo_url?: string | null;
                } | null;
                const kids =
                  (childResp.data as unknown as Array<{
                    name?: string;
                    is_enrolled?: boolean;
                    created_at?: string;
                  }>) ?? [];
                const sortedKids = kids
                  .filter((k) => k.name?.trim())
                  .sort((a, b) => {
                    if (!!a.is_enrolled !== !!b.is_enrolled)
                      return a.is_enrolled ? -1 : 1;
                    return (a.created_at ?? "").localeCompare(b.created_at ?? "");
                  });
                senderChildName = sortedKids[0]?.name?.trim() ?? null;
                if (u) {
                  senderName = String(u.parent_name ?? "");
                  senderPhoto = u.profile_photo_url ?? null;
                  senderLetter =
                    senderChildName?.charAt(0) ??
                    senderName.charAt(0) ??
                    null;
                  senderProfileCache.current.set(row.sender_user_id, {
                    name: senderName,
                    photo: senderPhoto,
                    letter: senderLetter,
                    childName: senderChildName,
                  });
                }
              } catch {
                /* ignore */
              }
            }
          }

          setMessages((prev) => {
            // 같은 id 가 이미 있으면 무시 (optimistic 직후 realtime 도착)
            if (prev.some((p) => p.id === row.id)) return prev;
            return [
              ...prev,
              {
                id: row.id,
                room_id: row.room_id,
                sender_user_id: row.sender_user_id,
                sender_org_id: row.sender_org_id,
                content: row.content,
                created_at: row.created_at,
                edited_at: row.edited_at,
                deleted_at: row.deleted_at,
                sender_name: senderName,
                sender_photo_url: senderPhoto,
                sender_child_name: senderChildName,
                sender_display_letter: senderLetter,
                sender_org_name: senderOrgName,
              },
            ];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId]);

  // 새 메시지 도착 시 자동 스크롤
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  // 입장 시 / 메시지 도착 시 last_read_at 갱신 (user 모드만)
  useEffect(() => {
    if (isAdmin) return;
    markRoomReadAction(roomId).catch(() => {});
  }, [isAdmin, roomId, messages.length]);

  const send = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;
    setError(null);
    setInput("");
    startTransition(async () => {
      try {
        if (isAdmin) {
          await sendOrgMessageAction(roomId, text);
        } else {
          await sendMessageAction(roomId, text);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "전송 실패");
        setInput(text);
      }
    });
  };

  const grouped = useMemo(() => groupByDay(messages), [messages]);

  return (
    // user 모드: 100dvh - 120 (상단 헤더 + 하단 탭바)
    // admin 모드: 탭바 없음 — 더 크게 (100dvh - 60)
    <div
      className={`flex flex-col bg-[#FFF8F0] ${
        isAdmin ? "h-[calc(100dvh-60px)]" : "h-[calc(100dvh-120px)]"
      }`}
    >
      {/* 헤더 */}
      <header
        className={`sticky top-0 z-10 flex items-center gap-2 border-b px-4 py-3 backdrop-blur ${
          isAdmin
            ? "border-[#D6CDE9] bg-[#F7F3FB]/95"
            : "border-[#D4E4BC] bg-white/95"
        }`}
      >
        <Link
          href={backHref ?? "/tori-talk"}
          aria-label="뒤로"
          className="rounded-full px-2 py-1 text-[#2D5A3D] hover:bg-[#F5F1E8]"
        >
          ←
        </Link>
        <h1 className="text-base font-bold text-[#2D5A3D]">💬 {roomName}</h1>
        {isAdmin && (
          <span className="ml-auto rounded-full bg-[#6B4FB2] px-2 py-0.5 text-[10px] font-bold text-white">
            📢 관제실 · 공지 모드
          </span>
        )}
      </header>

      {/* 메시지 영역 */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-4 space-y-4"
      >
        {messages.length === 0 ? (
          <div className="mt-12 text-center text-sm text-[#8B7F75]">
            {isAdmin
              ? "🌱 아직 대화가 없어요 — 첫 공지를 보내보세요"
              : "🌱 첫 메시지를 남겨보세요"}
          </div>
        ) : (
          grouped.map((g) => (
            <div key={g.dayKey} className="space-y-2">
              <div className="my-2 flex items-center gap-2">
                <span className="h-px flex-1 bg-[#D4E4BC]" />
                <span className="rounded-full bg-white px-3 py-0.5 text-[10px] font-bold text-[#8B7F75]">
                  {g.dayLabel}
                </span>
                <span className="h-px flex-1 bg-[#D4E4BC]" />
              </div>
              {g.messages.map((m) => {
                // admin 모드에서는 자기 메시지도 시스템처럼 가운데 (isMe=false)
                const isMe = !isAdmin && m.sender_user_id === meUserId;
                // 수정·삭제 권한 판정
                const canMutate =
                  !m.deleted_at &&
                  (isAdmin
                    ? // admin: 우리 기관 공지(sender_org_id===orgId)
                      Boolean(m.sender_org_id && m.sender_org_id === orgId)
                    : // user: 본인 메시지(sender_user_id===meUserId)
                      Boolean(
                        m.sender_user_id && m.sender_user_id === meUserId
                      ));
                return (
                  <MessageBubble
                    key={m.id}
                    message={m}
                    isMe={isMe}
                    canMutate={canMutate}
                    mode={mode}
                  />
                );
              })}
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* 입력창 */}
      <form
        onSubmit={send}
        className={`sticky bottom-0 z-10 border-t px-3 py-2 backdrop-blur ${
          isAdmin
            ? "border-[#D6CDE9] bg-[#F7F3FB]/95"
            : "border-[#D4E4BC] bg-white/95"
        }`}
      >
        {error && (
          <p className="mb-1 text-[11px] text-rose-700" role="alert">
            ⚠ {error}
          </p>
        )}
        {isAdmin && (
          <p className="mb-1 text-[10px] font-semibold text-[#6B4FB2]">
            📢 이 메시지는 <b>{orgName ?? "기관"}</b> 공지로 모든 멤버에게
            전달됩니다.
          </p>
        )}
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                (e.currentTarget.form as HTMLFormElement | null)?.requestSubmit();
              }
            }}
            placeholder={isAdmin ? "공지 내용 입력" : "메시지 입력"}
            rows={1}
            maxLength={2000}
            className={`flex-1 resize-none rounded-2xl border-2 px-3 py-2 text-sm leading-snug focus:outline-none ${
              isAdmin
                ? "border-[#D6CDE9] bg-white focus:border-[#6B4FB2]"
                : "border-[#D4E4BC] bg-[#FFF8F0] focus:border-[#2D5A3D]"
            }`}
            style={{ maxHeight: "120px" }}
          />
          <button
            type="submit"
            disabled={pending || input.trim().length === 0}
            className={`rounded-2xl px-4 py-2 text-sm font-bold text-white shadow-sm transition disabled:opacity-50 ${
              isAdmin
                ? "bg-[#6B4FB2] hover:bg-[#5a3fa1]"
                : "bg-[#2D5A3D] hover:bg-[#264C33]"
            }`}
          >
            {isAdmin ? "📢 공지 보내기" : "보내기"}
          </button>
        </div>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 메시지 버블
// ---------------------------------------------------------------------------
function MessageBubble({
  message,
  isMe,
  canMutate,
  mode,
}: {
  message: ToritalkMessageWithSender;
  isMe: boolean;
  canMutate: boolean;
  mode: Mode;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.content);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const isDeleted = Boolean(message.deleted_at);
  const isEdited = Boolean(message.edited_at);

  // 꾹 누르기(long-press) 감지용 ref
  const containerRef = useRef<HTMLDivElement>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pressStart = useRef<{ x: number; y: number } | null>(null);

  const cancelLongPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    pressStart.current = null;
  };

  const startLongPress = (x: number, y: number) => {
    if (!canMutate || editing || isDeleted) return;
    cancelLongPress();
    pressStart.current = { x, y };
    longPressTimer.current = setTimeout(() => {
      setMenuOpen(true);
      try {
        if (typeof navigator !== "undefined" && "vibrate" in navigator) {
          (navigator as Navigator & { vibrate?: (p: number) => boolean }).vibrate?.(15);
        }
      } catch {
        /* ignore */
      }
    }, 500);
  };

  // 메뉴 열린 상태에서 바깥 탭 → 닫기
  useEffect(() => {
    if (!menuOpen) return;
    const onDocDown = (e: PointerEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setMenuOpen(false);
      }
    };
    // 메뉴를 연 그 pointerdown 이 즉시 닫지 않도록 한 틱 미룸
    const tid = setTimeout(() => {
      document.addEventListener("pointerdown", onDocDown);
    }, 0);
    return () => {
      clearTimeout(tid);
      document.removeEventListener("pointerdown", onDocDown);
    };
  }, [menuOpen]);

  const longPressHandlers =
    canMutate && !editing && !isDeleted
      ? {
          onPointerDown: (e: React.PointerEvent) =>
            startLongPress(e.clientX, e.clientY),
          onPointerMove: (e: React.PointerEvent) => {
            if (!pressStart.current) return;
            const dx = Math.abs(e.clientX - pressStart.current.x);
            const dy = Math.abs(e.clientY - pressStart.current.y);
            if (dx > 8 || dy > 8) cancelLongPress();
          },
          onPointerUp: cancelLongPress,
          onPointerLeave: cancelLongPress,
          onPointerCancel: cancelLongPress,
          onContextMenu: (e: React.MouseEvent) => {
            // 모바일 길게 눌렀을 때 OS 컨텍스트 메뉴/선택 콜아웃 차단
            e.preventDefault();
          },
        }
      : {};

  const longPressStyle: React.CSSProperties =
    canMutate && !editing && !isDeleted
      ? {
          WebkitUserSelect: "none",
          userSelect: "none",
          WebkitTouchCallout: "none",
          touchAction: "manipulation",
        }
      : {};

  const onSaveEdit = () => {
    const text = draft.trim();
    if (!text) return;
    setError(null);
    startTransition(async () => {
      try {
        if (mode === "admin") {
          await editOrgMessageAction(message.id, text);
        } else {
          await editMessageAction(message.id, text);
        }
        setEditing(false);
        setMenuOpen(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "수정 실패");
      }
    });
  };

  const onDelete = () => {
    if (!confirm("이 메시지를 삭제할까요?")) return;
    setError(null);
    startTransition(async () => {
      try {
        if (mode === "admin") {
          await deleteOrgMessageAction(message.id);
        } else {
          await deleteMessageAction(message.id);
        }
        setMenuOpen(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "삭제 실패");
      }
    });
  };

  // 기관 admin 발신 메시지 — 가운데 정렬·보라색 시스템 버블
  if (message.sender_org_id) {
    return (
      <div className="flex justify-center">
        <div
          ref={containerRef}
          className="max-w-[85%] rounded-2xl border border-[#D6CDE9] bg-[#F7F3FB] px-4 py-2.5 shadow-sm"
        >
          <p className="mb-1 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-[#6B4FB2]">
            <span aria-hidden>📢</span>
            <span>{message.sender_org_name ?? "기관"} 공지</span>
            {isEdited && !isDeleted && (
              <span className="text-[9px] font-normal text-[#8B7F9F]">
                (수정됨)
              </span>
            )}
            <span className="ml-auto font-mono text-[10px] text-[#8B7F9F]">
              {fmtClockKstAlways(message.created_at)}
            </span>
          </p>
          {isDeleted ? (
            <p className="text-sm italic text-[#8B7F9F]">
              🗑 삭제된 공지예요
            </p>
          ) : editing ? (
            <InlineEdit
              draft={draft}
              setDraft={setDraft}
              onSave={onSaveEdit}
              onCancel={() => {
                setDraft(message.content);
                setEditing(false);
                setError(null);
              }}
              pending={pending}
              error={error}
              variant="org"
            />
          ) : (
            <>
              <p
                className={`whitespace-pre-wrap break-words text-sm text-[#2C2444] transition ${
                  menuOpen ? "ring-2 ring-[#6B4FB2]/40 rounded-md" : ""
                }`}
                style={longPressStyle}
                {...longPressHandlers}
              >
                {message.content}
              </p>
              {canMutate && menuOpen && (
                <div className="mt-1 flex justify-end gap-2 text-[10px] font-semibold">
                  <button
                    type="button"
                    onClick={() => {
                      setDraft(message.content);
                      setEditing(true);
                      setMenuOpen(false);
                    }}
                    disabled={pending}
                    className="rounded-md bg-white px-2 py-1 text-[#6B4FB2] shadow-sm hover:bg-[#F7F3FB] disabled:opacity-50"
                  >
                    ✏️ 수정
                  </button>
                  <button
                    type="button"
                    onClick={onDelete}
                    disabled={pending}
                    className="rounded-md bg-white px-2 py-1 text-rose-700 shadow-sm hover:bg-rose-50 disabled:opacity-50"
                  >
                    🗑 삭제
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    );
  }

  const displayLabel = message.sender_child_name
    ? `${message.sender_child_name} 학부모`
    : message.sender_name ?? "(알 수 없음)";
  return (
    <div
      className={`flex items-end gap-2 ${
        isMe ? "flex-row-reverse" : "flex-row"
      }`}
    >
      <Avatar
        letter={message.sender_display_letter ?? message.sender_name ?? ""}
        photoUrl={message.sender_photo_url}
      />
      <div
        ref={containerRef}
        className={`flex max-w-[75%] flex-col ${
          isMe ? "items-end" : "items-start"
        }`}
      >
        {!isMe && (
          <p className="mb-0.5 text-[11px] font-semibold text-[#6B6560]">
            {displayLabel}
          </p>
        )}

        {isDeleted ? (
          <div
            className={`flex items-end gap-1.5 ${
              isMe ? "flex-row-reverse" : "flex-row"
            }`}
          >
            <Time iso={message.created_at} />
            <p className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 px-3 py-2 text-sm italic text-zinc-500">
              🗑 삭제된 메시지예요
            </p>
          </div>
        ) : editing ? (
          <InlineEdit
            draft={draft}
            setDraft={setDraft}
            onSave={onSaveEdit}
            onCancel={() => {
              setDraft(message.content);
              setEditing(false);
              setError(null);
            }}
            pending={pending}
            error={error}
            variant={isMe ? "me" : "other"}
          />
        ) : (
          <>
            <div className="flex items-end gap-1.5">
              {isMe && <Time iso={message.created_at} />}
              <p
                className={`whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-sm shadow-sm transition ${
                  isMe
                    ? "bg-[#2D5A3D] text-white"
                    : "bg-white text-[#2C2C2C] border border-[#D4E4BC]"
                } ${menuOpen ? "ring-2 ring-offset-1 ring-[#2D5A3D]/50" : ""}`}
                style={longPressStyle}
                {...longPressHandlers}
              >
                {message.content}
              </p>
              {!isMe && <Time iso={message.created_at} />}
            </div>
            {(isEdited || (canMutate && menuOpen) || error) && (
              <div
                className={`mt-0.5 flex items-center gap-2 text-[10px] ${
                  isMe ? "justify-end" : "justify-start"
                }`}
              >
                {isEdited && (
                  <span className="text-[#8B7F75]">(수정됨)</span>
                )}
                {canMutate && menuOpen && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setDraft(message.content);
                        setEditing(true);
                        setError(null);
                        setMenuOpen(false);
                      }}
                      disabled={pending}
                      className="rounded-md bg-white px-2 py-1 font-semibold text-[#2D5A3D] shadow-sm hover:bg-[#F5F9EE] disabled:opacity-50"
                    >
                      ✏️ 수정
                    </button>
                    <button
                      type="button"
                      onClick={onDelete}
                      disabled={pending}
                      className="rounded-md bg-white px-2 py-1 font-semibold text-rose-700 shadow-sm hover:bg-rose-50 disabled:opacity-50"
                    >
                      🗑 삭제
                    </button>
                  </>
                )}
                {error && (
                  <span className="text-rose-700" role="alert">
                    ⚠ {error}
                  </span>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Time({ iso }: { iso: string }) {
  return (
    <span className="shrink-0 text-[10px] text-[#8B7F75] tabular-nums">
      {fmtClockKstAlways(iso)}
    </span>
  );
}

/**
 * 메시지 인라인 편집 — 텍스트영역 + 저장/취소.
 * variant: me=초록(본인 버블), other=흰(타인 버블 — 거의 안 쓰임), org=보라(기관 공지)
 */
function InlineEdit({
  draft,
  setDraft,
  onSave,
  onCancel,
  pending,
  error,
  variant,
}: {
  draft: string;
  setDraft: (v: string) => void;
  onSave: () => void;
  onCancel: () => void;
  pending: boolean;
  error: string | null;
  variant: "me" | "other" | "org";
}) {
  const isMe = variant === "me";
  const isOrg = variant === "org";
  return (
    <div
      className={`flex w-full flex-col gap-1 rounded-2xl border-2 p-2 shadow-sm ${
        isOrg
          ? "border-[#6B4FB2] bg-white"
          : isMe
          ? "border-[#2D5A3D] bg-white"
          : "border-[#D4E4BC] bg-white"
      }`}
    >
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (
            e.key === "Enter" &&
            (e.metaKey || e.ctrlKey) &&
            !e.nativeEvent.isComposing
          ) {
            e.preventDefault();
            onSave();
          } else if (e.key === "Escape") {
            e.preventDefault();
            onCancel();
          }
        }}
        rows={2}
        maxLength={2000}
        disabled={pending}
        autoFocus
        className="w-full resize-none rounded-lg bg-transparent px-2 py-1 text-sm focus:outline-none disabled:opacity-50"
        style={{ minWidth: "12rem" }}
      />
      <div className="flex items-center justify-end gap-1.5 text-[11px]">
        {error && (
          <span className="mr-auto text-rose-700" role="alert">
            ⚠ {error}
          </span>
        )}
        <button
          type="button"
          onClick={onCancel}
          disabled={pending}
          className="rounded-md border border-zinc-200 bg-white px-2 py-1 font-semibold text-zinc-600 hover:bg-zinc-50 disabled:opacity-50"
        >
          취소
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={pending || draft.trim().length === 0}
          className={`rounded-md px-2 py-1 font-bold text-white disabled:opacity-50 ${
            isOrg ? "bg-[#6B4FB2] hover:bg-[#5a3fa1]" : "bg-[#2D5A3D] hover:bg-[#264C33]"
          }`}
        >
          {pending ? "저장 중..." : "저장"}
        </button>
      </div>
    </div>
  );
}

function Avatar({
  letter,
  photoUrl,
}: {
  /** 표시할 글자 — 보통 원생 첫 글자(있으면), fallback 부모/이름. */
  letter: string;
  photoUrl: string | null;
}) {
  if (photoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={photoUrl}
        alt=""
        className="h-8 w-8 shrink-0 rounded-full border border-[#D4E4BC] object-cover"
      />
    );
  }
  const ch = (letter?.trim().charAt(0) || "🌱").slice(0, 1);
  return (
    <span
      aria-hidden
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#3A7A52] to-[#4A7C59] text-xs font-bold text-white"
    >
      {ch}
    </span>
  );
}

// ---------------------------------------------------------------------------
// 날짜별 그룹핑
// ---------------------------------------------------------------------------
function groupByDay(messages: ToritalkMessageWithSender[]) {
  const groups: Array<{
    dayKey: string;
    dayLabel: string;
    messages: ToritalkMessageWithSender[];
  }> = [];
  for (const m of messages) {
    const d = new Date(m.created_at);
    const dayKey = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    const dayLabel = d.toLocaleDateString("ko-KR", {
      timeZone: "Asia/Seoul",
      month: "long",
      day: "numeric",
      weekday: "short",
    });
    const last = groups[groups.length - 1];
    if (last && last.dayKey === dayKey) {
      last.messages.push(m);
    } else {
      groups.push({ dayKey, dayLabel, messages: [m] });
    }
  }
  return groups;
}
