"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createSingleAppUserAction } from "./new/actions";

type Sibling = { id: string; name: string };

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
}: {
  orgId: string;
  action?: (formData: FormData) => Promise<void>;
  successHint?: string;
}) {
  const router = useRouter();
  const [enrolledName, setEnrolledName] = useState("");
  const [phone, setPhone] = useState("");
  const [siblings, setSiblings] = useState<Sibling[]>([]);
  const [msg, setMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(
    null
  );
  const [isPending, startTransition] = useTransition();

  function reset() {
    setEnrolledName("");
    setPhone("");
    setSiblings([]);
  }

  function addSibling() {
    if (siblings.length >= 9) return;
    setSiblings([...siblings, { id: newSiblingId(), name: "" }]);
  }

  function removeSibling(id: string) {
    setSiblings(siblings.filter((s) => s.id !== id));
  }

  function updateSibling(id: string, name: string) {
    setSiblings(siblings.map((s) => (s.id === id ? { ...s, name } : s)));
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

    // 형제/자매
    for (const s of validSiblings) {
      fd.append("child_name", s.name.trim());
      fd.append("child_birth", "");
      fd.append("child_enrolled", "0");
    }

    startTransition(async () => {
      try {
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

      <form onSubmit={onSubmit} className="space-y-2">
        <div className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_1fr_auto]">
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

        {/* 형제/자매 입력 영역 */}
        {siblings.length > 0 && (
          <ul className="space-y-1.5 rounded-xl border border-[#F0E8D8] bg-[#FFFDF8] p-2">
            {siblings.map((s, idx) => (
              <li key={s.id} className="flex items-center gap-1.5">
                <span className="inline-flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-[#FAE7D0] text-[10px] font-bold text-[#6B4423]">
                  👫 {idx + 1}
                </span>
                <input
                  type="text"
                  value={s.name}
                  onChange={(e) => updateSibling(s.id, e.target.value)}
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

      <p className="mt-2 text-[10px] leading-relaxed text-[#8B7F75]">
        🔑 로그인 아이디 = 부모님 연락처. 비밀번호는 없어요. 생년월일·성별은
        부모님이 앱에서 직접 입력해요.
      </p>
    </section>
  );
}

const INPUT_CLS =
  "h-9 w-full rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] px-3 text-xs text-[#2C2C2C] focus:border-[#3A7A52] focus:outline-none focus:ring-2 focus:ring-[#3A7A52]/30 disabled:opacity-50";
