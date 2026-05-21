"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createSingleAppUserAction } from "./new/actions";

type Sibling = { id: string; name: string; className: string };

/** 전화번호 조회 결과 — events/[eventId]/users/actions 의 ParticipantLookupResult 와 호환. */
type LookupFound = {
  found: true;
  userId: string;
  parentName: string;
  homeOrgName: string;
  isSameOrg: boolean;
  childNames: string[];
};
type LookupResult = { found: false } | LookupFound;

type EventOption = { id: string; name: string; status: string };

function newSiblingId(): string {
  return Math.random().toString(36).slice(2, 8);
}

/**
 * 목록 페이지 상단의 원클릭 원생 추가 카드.
 * - 원생명 + 부모님 연락처 2칸만 입력하면 등록
 * - 아이디는 보호자 연락처 자동 사용 (비밀번호 없음)
 * - + 형제/자매 추가 버튼으로 추가 자녀(이름만) 함께 등록 가능
 *
 * @param action 폼 제출 시 호출될 server action — partial-applied 형태.
 *   미전달 시 createSingleAppUserAction(orgId, fd) 로 fallback (기관 전체 등록).
 *   행사 페이지에서는 createSingleEventParticipantAction.bind(null, orgId, eventId) 같이
 *   미리 binding 해서 전달.
 */
export function QuickAddUser({
  orgId,
  action,
  successHint,
  classSuggestions = [],
  lookupAction,
  linkAction,
  events = [],
  currentEventId,
}: {
  orgId: string;
  action?: (formData: FormData) => Promise<void>;
  successHint?: string;
  /** 자동완성 후보 — 이미 사용된 반명 목록 */
  classSuggestions?: string[];
  /** 연락처로 기존 참가자 조회 — 전달 시 제출 전 중복 감지 패널 동작. */
  lookupAction?: (phone: string) => Promise<LookupResult>;
  /** 기존 참가자를 선택한 행사들에 연결. */
  linkAction?: (
    userId: string,
    eventIds: string[]
  ) => Promise<{ ok: boolean; linked?: number; message?: string }>;
  /** 중복 패널에서 선택할 수 있는 행사 목록 (행사 페이지에서만 전달). */
  events?: EventOption[];
  /** 현재 보고 있는 행사 — 중복 패널에서 기본 선택. */
  currentEventId?: string;
}) {
  const router = useRouter();
  const [enrolledName, setEnrolledName] = useState("");
  const [phone, setPhone] = useState("");
  const [className, setClassName] = useState("");
  const [siblings, setSiblings] = useState<Sibling[]>([]);
  const [msg, setMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(
    null
  );
  const [isPending, startTransition] = useTransition();

  // 중복 감지 — 이미 등록된 참가자면 폼 대신 "행사 연결" 패널 노출.
  const [duplicate, setDuplicate] = useState<LookupFound | null>(null);
  const [selectedEventIds, setSelectedEventIds] = useState<Set<string>>(
    new Set()
  );

  function reset() {
    setEnrolledName("");
    setPhone("");
    setClassName("");
    setSiblings([]);
  }

  function toggleEvent(id: string) {
    setSelectedEventIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function onConfirmLink() {
    if (!linkAction || !duplicate) return;
    if (selectedEventIds.size === 0) {
      setMsg({ kind: "error", text: "연결할 행사를 선택해 주세요" });
      return;
    }
    setMsg(null);
    startTransition(async () => {
      try {
        const res = await linkAction(
          duplicate.userId,
          Array.from(selectedEventIds)
        );
        if (res.ok) {
          setMsg({
            kind: "ok",
            text: `✅ ${duplicate.parentName}님을 행사 ${
              res.linked ?? selectedEventIds.size
            }개에 연결했어요`,
          });
          setDuplicate(null);
          reset();
          router.refresh();
        } else {
          setMsg({ kind: "error", text: res.message ?? "연결에 실패했어요" });
        }
      } catch (e) {
        setMsg({
          kind: "error",
          text: e instanceof Error ? e.message : "연결에 실패했어요",
        });
      }
    });
  }

  function addSibling() {
    if (siblings.length >= 9) return;
    setSiblings([
      ...siblings,
      { id: newSiblingId(), name: "", className: "" },
    ]);
  }

  function removeSibling(id: string) {
    setSiblings(siblings.filter((s) => s.id !== id));
  }

  function updateSibling(
    id: string,
    field: "name" | "className",
    value: string
  ) {
    setSiblings(
      siblings.map((s) => (s.id === id ? { ...s, [field]: value } : s))
    );
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMsg(null);

    const trimmed = enrolledName.trim();
    const phoneDigits = phone.replace(/\D/g, "");
    const validSiblings = siblings.filter((s) => s.name.trim().length > 0);

    if (!trimmed) {
      setMsg({ kind: "error", text: "원생명을 입력해 주세요" });
      return;
    }
    if (phoneDigits.length < 10 || phoneDigits.length > 11) {
      setMsg({
        kind: "error",
        text: "부모님 연락처를 10~11자리 숫자로 입력해 주세요",
      });
      return;
    }

    const fd = new FormData();
    fd.set("phone", phoneDigits);
    fd.set("parent_name", ""); // 서버에서 "학부모_{뒷4자리}" 자동 생성

    // 첫 번째 = 원생
    fd.append("child_name", trimmed);
    fd.append("child_birth", "");
    fd.append("child_enrolled", "1");
    fd.append("child_class", className.trim());

    // 형제/자매
    for (const s of validSiblings) {
      fd.append("child_name", s.name.trim());
      fd.append("child_birth", "");
      fd.append("child_enrolled", "0");
      fd.append("child_class", s.className.trim());
    }

    startTransition(async () => {
      try {
        // 행사 컨텍스트 — 제출 전 연락처 중복 확인. 이미 있으면 패널로 전환.
        if (lookupAction) {
          const result = await lookupAction(phoneDigits);
          if (result.found) {
            setDuplicate(result);
            const init = new Set<string>();
            if (currentEventId) init.add(currentEventId);
            setSelectedEventIds(init);
            return;
          }
        }
        if (action) {
          await action(fd);
        } else {
          await createSingleAppUserAction(orgId, fd);
        }
        // redirect 발생하지 않는 케이스 대비 (이 플로우는 redirect 함)
      } catch (e) {
        const errMsg = e instanceof Error ? e.message : "등록에 실패했어요";
        if (errMsg.includes("NEXT_REDIRECT")) {
          // 서버액션이 redirect 했음 — 정상 완료
          const extra =
            validSiblings.length > 0
              ? ` (+형제/자매 ${validSiblings.length}명)`
              : "";
          const tail = successHint ? ` ${successHint}` : "";
          setMsg({
            kind: "ok",
            text: `✅ "${trimmed}"${extra} 등록 완료!${tail}`,
          });
          reset();
          router.refresh();
          return;
        }
        setMsg({ kind: "error", text: errMsg });
      }
    });
  }

  return (
    <section className="rounded-2xl border-2 border-dashed border-[#2D5A3D]/30 bg-white p-4 shadow-sm">
      <div className="mb-3">
        <h2 className="flex items-center gap-1.5 text-sm font-bold text-[#2D5A3D]">
          <span aria-hidden>⚡</span>
          <span>빠른 원생 추가</span>
        </h2>
        <p className="mt-0.5 text-[11px] text-[#6B6560]">
          원생명과 부모님 연락처만 있으면 바로 등록돼요
        </p>
      </div>

      {msg && (
        <div
          role={msg.kind === "error" ? "alert" : "status"}
          className={`mb-2 rounded-lg border px-3 py-2 text-[11px] font-semibold ${
            msg.kind === "error"
              ? "border-rose-200 bg-rose-50 text-rose-800"
              : "border-emerald-200 bg-emerald-50 text-emerald-800"
          }`}
        >
          {msg.text}
        </div>
      )}

      {duplicate ? (
        <div className="space-y-3 rounded-xl border border-amber-300 bg-amber-50/60 p-3">
          <div>
            <p className="text-sm font-bold text-[#2D5A3D]">
              🔎 이미 등록된 참가자예요
            </p>
            <p className="mt-1 text-[12px] leading-relaxed text-[#6B6560]">
              이 연락처는{" "}
              <b className="text-[#2D5A3D]">{duplicate.parentName}</b>님으로
              이미 등록돼 있어요.
              {!duplicate.isSameOrg && (
                <span className="ml-1 inline-flex items-center rounded-full bg-white px-1.5 py-0.5 text-[10px] font-bold text-[#8B6F47] ring-1 ring-[#E5D3B8]">
                  🏫 {duplicate.homeOrgName}
                </span>
              )}
            </p>
            {duplicate.childNames.length > 0 && (
              <p className="mt-0.5 text-[11px] text-[#8B7F75]">
                자녀: {duplicate.childNames.join(", ")}
              </p>
            )}
            <p className="mt-1 text-[11px] text-[#6B6560]">
              새 계정을 만들지 않고, 이 분을 선택한 행사에 그대로 연결할게요.
            </p>
          </div>

          {events.length > 0 ? (
            <div className="space-y-1.5">
              <p className="text-[11px] font-bold text-[#2D5A3D]">
                연결할 행사 선택
              </p>
              <ul className="space-y-1">
                {events.map((ev) => (
                  <li key={ev.id}>
                    <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-[#E5D3B8] bg-white px-2.5 py-1.5">
                      <input
                        type="checkbox"
                        checked={selectedEventIds.has(ev.id)}
                        onChange={() => toggleEvent(ev.id)}
                        disabled={isPending}
                        className="h-4 w-4 rounded border-[#D4E4BC] text-emerald-600 focus:ring-emerald-500"
                      />
                      <span className="flex-1 truncate text-xs font-semibold text-[#2D5A3D]">
                        {ev.name || "(이름 없음)"}
                        {ev.id === currentEventId && (
                          <span className="ml-1 text-[10px] font-bold text-emerald-700">
                            (현재 행사)
                          </span>
                        )}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-[11px] text-[#8B7F75]">연결할 행사가 없어요.</p>
          )}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setDuplicate(null)}
              disabled={isPending}
              className="rounded-lg border border-[#D4E4BC] bg-white px-3 py-1.5 text-xs font-bold text-[#6B6560] hover:bg-[#F5F1E8] disabled:opacity-50"
            >
              취소
            </button>
            <button
              type="button"
              onClick={onConfirmLink}
              disabled={isPending || selectedEventIds.size === 0}
              className="rounded-lg bg-gradient-to-r from-[#2D5A3D] to-[#3A7A52] px-4 py-1.5 text-xs font-bold text-white shadow-sm transition hover:from-[#234a30] disabled:opacity-50"
            >
              {isPending ? "연결 중..." : "선택한 행사에 연결"}
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-2">
        <div className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_1.2fr_1.2fr_auto]">
          <div>
            <label htmlFor="qa-class" className="sr-only">
              반명
            </label>
            <input
              id="qa-class"
              type="text"
              value={className}
              onChange={(e) => setClassName(e.target.value)}
              placeholder="🐰 반 (예: 토끼반)"
              autoComplete="off"
              disabled={isPending}
              list="qa-class-suggestions"
              maxLength={40}
              className={INPUT_CLS}
            />
            {classSuggestions.length > 0 && (
              <datalist id="qa-class-suggestions">
                {classSuggestions.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            )}
          </div>
          <div>
            <label htmlFor="qa-name" className="sr-only">
              원생명
            </label>
            <input
              id="qa-name"
              type="text"
              value={enrolledName}
              onChange={(e) => setEnrolledName(e.target.value)}
              placeholder="🎒 원생명 (예: 홍길동)"
              autoComplete="off"
              required
              disabled={isPending}
              className={INPUT_CLS}
            />
          </div>
          <div>
            <label htmlFor="qa-phone" className="sr-only">
              부모님 연락처
            </label>
            <input
              id="qa-phone"
              type="tel"
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="📞 부모님 연락처 (010-0000-0000)"
              autoComplete="off"
              required
              disabled={isPending}
              className={INPUT_CLS}
            />
          </div>
          <button
            type="submit"
            disabled={isPending}
            className="inline-flex h-9 items-center justify-center gap-1 rounded-xl bg-gradient-to-r from-[#2D5A3D] to-[#3A7A52] px-4 text-xs font-bold text-white shadow-sm transition hover:from-[#234a30] hover:to-[#2D5A3D] disabled:opacity-50 md:h-auto"
          >
            {isPending ? "등록 중..." : "🌱 추가"}
          </button>
        </div>

        {/* 형제/자매 입력 영역 — 반명도 자녀별 입력 */}
        {siblings.length > 0 && (
          <ul className="space-y-1.5 rounded-xl border border-[#F0E8D8] bg-[#FFFDF8] p-2">
            {siblings.map((s, idx) => (
              <li
                key={s.id}
                className="flex items-center gap-1.5"
              >
                <span className="inline-flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-[#FAE7D0] text-[10px] font-bold text-[#6B4423]">
                  👫 {idx + 1}
                </span>
                <input
                  type="text"
                  value={s.className}
                  onChange={(e) =>
                    updateSibling(s.id, "className", e.target.value)
                  }
                  placeholder="반 (선택)"
                  autoComplete="off"
                  list="qa-class-suggestions"
                  maxLength={40}
                  disabled={isPending}
                  className={`${INPUT_CLS} max-w-[8rem]`}
                />
                <input
                  type="text"
                  value={s.name}
                  onChange={(e) =>
                    updateSibling(s.id, "name", e.target.value)
                  }
                  placeholder={`형제/자매 ${idx + 1} 이름`}
                  autoComplete="off"
                  disabled={isPending}
                  className={INPUT_CLS}
                />
                <button
                  type="button"
                  onClick={() => removeSibling(s.id)}
                  disabled={isPending}
                  aria-label="삭제"
                  className="h-7 shrink-0 rounded-md border border-rose-200 bg-white px-2 text-[10px] font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                >
                  −
                </button>
              </li>
            ))}
          </ul>
        )}

        {siblings.length < 9 && (
          <button
            type="button"
            onClick={addSibling}
            disabled={isPending}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-[#6B4423] bg-white px-4 py-2 text-xs font-semibold text-[#6B4423] transition hover:bg-[#FFF8F0] disabled:opacity-50"
          >
            <span aria-hidden>👫</span>
            <span>+ 형제/자매 추가</span>
          </button>
        )}
        </form>
      )}

      <p className="mt-2 text-[10px] leading-relaxed text-[#8B7F75]">
        🔑 로그인 아이디 = 부모님 연락처. 비밀번호는 없어요. 생년월일·성별은
        부모님이 앱에서 직접 입력해요.{" "}
        <span className="text-[#6B4423]">
          반명 입력 시 토리톡 활성화된 기관은 자동으로 반 채팅방에 참여돼요.
        </span>
      </p>
    </section>
  );
}

const INPUT_CLS =
  "h-9 w-full rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] px-3 text-xs text-[#2C2C2C] focus:border-[#3A7A52] focus:outline-none focus:ring-2 focus:ring-[#3A7A52]/30 disabled:opacity-50";
