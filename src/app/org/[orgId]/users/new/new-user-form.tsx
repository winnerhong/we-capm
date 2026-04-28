"use client";

import { useState, useTransition } from "react";
import { createSingleAppUserAction } from "./actions";

type Sibling = { id: string; name: string };

function newChildId(): string {
  return Math.random().toString(36).slice(2, 8);
}

interface Props {
  orgId: string;
  /**
   * 폼 제출 시 호출될 server action — partial-applied 형태(`(fd) => Promise<void>`).
   * 미전달 시 기본 createSingleAppUserAction(orgId, fd) 으로 fallback.
   * 행사별 등록 페이지에서는 `createSingleEventParticipantAction.bind(null, orgId, eventId)` 같이 미리 binding.
   */
  action?: (formData: FormData) => Promise<void>;
  /** 제출 버튼 라벨 (기본 "🌱 참가자 등록") */
  submitLabel?: string;
}

export function NewUserForm({
  orgId,
  action,
  submitLabel = "🌱 참가자 등록",
}: Props) {
  const [enrolledName, setEnrolledName] = useState("");
  const [phone, setPhone] = useState("");
  const [siblings, setSiblings] = useState<Sibling[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function addSibling() {
    if (siblings.length >= 9) return;
    setSiblings([...siblings, { id: newChildId(), name: "" }]);
  }

  function removeSibling(id: string) {
    setSiblings(siblings.filter((s) => s.id !== id));
  }

  function updateSibling(id: string, name: string) {
    setSiblings(siblings.map((s) => (s.id === id ? { ...s, name } : s)));
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const trimmedEnrolled = enrolledName.trim();
    const phoneDigits = phone.replace(/\D/g, "");
    const validSiblings = siblings.filter((s) => s.name.trim().length > 0);

    if (!trimmedEnrolled) {
      setError("원생 이름을 입력해 주세요");
      return;
    }
    if (phoneDigits.length < 10 || phoneDigits.length > 11) {
      setError("부모님 연락처를 10~11자리 숫자로 입력해 주세요");
      return;
    }

    const fd = new FormData();
    fd.set("phone", phoneDigits);
    // parent_name 비우면 서버에서 "학부모_{뒷4자리}" 자동 생성
    fd.set("parent_name", "");

    // 첫 아이 = 원생 (is_enrolled=true)
    fd.append("child_name", trimmedEnrolled);
    fd.append("child_birth", "");
    fd.append("child_enrolled", "1");

    // 형제/자매 (is_enrolled=false)
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
        // Server action에서 redirect하므로 여기 도달 안 함.
      } catch (e) {
        const msg = e instanceof Error ? e.message : "등록에 실패했어요";
        if (msg.includes("NEXT_REDIRECT")) return;
        setError(msg);
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {error && (
        <div
          role="alert"
          className="rounded-xl border-2 border-rose-300 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800"
        >
          ⚠️ {error}
        </div>
      )}

      {/* 원생 정보 (주) */}
      <section className="rounded-2xl border border-[#D4E4BC] bg-white p-5 shadow-sm md:p-6">
        <h2 className="mb-4 flex items-center gap-2 text-sm font-bold text-[#2D5A3D]">
          <span aria-hidden>🎒</span>
          <span>원생 정보</span>
        </h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label
              htmlFor="enrolled_name"
              className="mb-1 block text-xs font-semibold text-[#2D5A3D]"
            >
              원생 이름 <span className="text-rose-600">*</span>
            </label>
            <input
              id="enrolled_name"
              type="text"
              value={enrolledName}
              onChange={(e) => setEnrolledName(e.target.value)}
              placeholder="예) 홍길순"
              autoComplete="off"
              required
              className={INPUT_CLS}
            />
          </div>
          <div>
            <label
              htmlFor="phone"
              className="mb-1 block text-xs font-semibold text-[#2D5A3D]"
            >
              부모님 연락처 <span className="text-rose-600">*</span>
            </label>
            <input
              id="phone"
              type="tel"
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="010-2222-3333"
              autoComplete="tel"
              required
              className={INPUT_CLS}
            />
            <p className="mt-1 text-[11px] text-[#8B7F75]">
              🔑 이 연락처로 참가자 앱에 바로 입장해요 (비밀번호 없음)
            </p>
          </div>
        </div>
      </section>

      {/* 형제/자매 (선택) */}
      <section className="rounded-2xl border border-[#D4E4BC] bg-white p-5 shadow-sm md:p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-bold text-[#2D5A3D]">
            <span aria-hidden>👫</span>
            <span>형제/자매 (선택)</span>
          </h2>
          <span className="text-[11px] text-[#8B7F75]">
            {siblings.length}명 (최대 9명)
          </span>
        </div>

        {siblings.length === 0 ? (
          <p className="rounded-xl border border-dashed border-[#E5D3B8] bg-[#FFFDF8] px-4 py-3 text-center text-[11px] text-[#8B7F75]">
            같이 참여할 형제·자매가 있으면 아래 버튼으로 추가하세요
          </p>
        ) : (
          <ul className="space-y-2">
            {siblings.map((s, idx) => (
              <li
                key={s.id}
                className="flex items-center gap-2 rounded-xl border border-[#F0E8D8] bg-[#FFFDF8] p-2"
              >
                <span className="inline-flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-[#E8F0E4] text-[11px] font-bold text-[#2D5A3D]">
                  {idx + 1}
                </span>
                <input
                  type="text"
                  value={s.name}
                  onChange={(e) => updateSibling(s.id, e.target.value)}
                  placeholder="형제/자매 이름"
                  autoComplete="off"
                  className={`${INPUT_CLS} !py-2`}
                />
                <button
                  type="button"
                  onClick={() => removeSibling(s.id)}
                  className="shrink-0 rounded-md border border-rose-200 bg-white px-2 py-1 text-[11px] font-semibold text-rose-700 hover:bg-rose-50"
                  aria-label="삭제"
                >
                  − 삭제
                </button>
              </li>
            ))}
          </ul>
        )}

        {siblings.length < 9 && (
          <button
            type="button"
            onClick={addSibling}
            className="mt-3 inline-flex items-center gap-1 rounded-xl border border-dashed border-[#2D5A3D] bg-white px-3 py-2 text-xs font-semibold text-[#2D5A3D] transition hover:bg-[#F5F1E8]"
          >
            + 자녀 추가
          </button>
        )}

        <p className="mt-3 rounded-lg bg-[#F5F1E8] px-3 py-2 text-[10px] leading-relaxed text-[#6B6560]">
          💡 생년월일·성별은{" "}
          <b className="text-[#2D5A3D]">참가자 포털의 내 정보</b>에서
          부모님이 직접 입력할 수 있어요.
        </p>
      </section>

      <div className="flex flex-wrap items-center justify-end gap-2">
        <a
          href={`/org/${orgId}/users`}
          className="rounded-xl border border-[#D4E4BC] bg-white px-4 py-2.5 text-sm font-semibold text-[#6B6560] hover:bg-[#FFF8F0]"
        >
          취소
        </a>
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#2D5A3D] to-[#3A7A52] px-5 py-2.5 text-sm font-bold text-white shadow-md hover:from-[#234a30] hover:to-[#2D5A3D] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2D5A3D]/40 disabled:opacity-60"
        >
          <span aria-hidden>{isPending ? "⏳" : "🌱"}</span>
          <span>
            {isPending
              ? "등록 중..."
              : submitLabel.replace(/^🌱\s*/, "")}
          </span>
        </button>
      </div>
    </form>
  );
}

const INPUT_CLS =
  "w-full rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] px-3 py-2.5 text-sm text-[#2C2C2C] focus:border-[#3A7A52] focus:outline-none focus:ring-2 focus:ring-[#3A7A52]/30";
