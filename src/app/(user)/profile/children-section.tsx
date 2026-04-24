"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addChildAction,
  removeChildAction,
  updateChildAction,
} from "./actions";

type Gender = "M" | "F" | "";

type ChildRow = {
  id: string;
  name: string;
  birth_date: string | null;
  gender: "M" | "F" | null;
  is_enrolled: boolean;
};

type Props = { children: ChildRow[] };

function initialOf(name: string): string {
  const t = (name ?? "").trim();
  return t ? t.charAt(0) : "🌱";
}

function formatBirthYYMMDD(raw: string | null): string {
  if (!raw) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
  if (!m) return raw;
  return `${m[1].slice(2)}${m[2]}${m[3]}`;
}

function genderLabel(g: "M" | "F" | null): string {
  if (g === "M") return "남아";
  if (g === "F") return "여아";
  return "";
}

export function ChildrenSection({ children }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  return (
    <section className="rounded-3xl border border-[#D4E4BC] bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-[#2D5A3D]">🪴 우리 아이들</h2>
        <span className="text-xs font-semibold text-[#6B6560]">
          {children.length}명
        </span>
      </div>

      {children.length === 0 ? (
        <p className="mt-3 rounded-2xl bg-[#F5F1E8] px-4 py-3 text-center text-xs text-[#6B6560]">
          아직 등록된 아이가 없어요
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {children.map((c) => (
            <li
              key={c.id}
              className="rounded-2xl border border-[#E8E0D0] bg-[#FFF8F0] px-4 py-3"
            >
              {editingId === c.id ? (
                <ChildForm
                  mode="edit"
                  childId={c.id}
                  initial={{
                    name: c.name,
                    birthYYMMDD: formatBirthYYMMDD(c.birth_date),
                    gender: c.gender ?? "",
                    isEnrolled: c.is_enrolled,
                  }}
                  onDone={() => setEditingId(null)}
                />
              ) : (
                <ChildRowView
                  child={c}
                  onEdit={() => setEditingId(c.id)}
                />
              )}
            </li>
          ))}
        </ul>
      )}

      {showAdd ? (
        <div className="mt-3 rounded-2xl border border-dashed border-[#D4E4BC] bg-[#F5F1E8] p-4">
          <ChildForm
            mode="add"
            initial={{ name: "", birthYYMMDD: "", gender: "", isEnrolled: true }}
            onDone={() => setShowAdd(false)}
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowAdd(true)}
          className="mt-3 w-full rounded-2xl border border-dashed border-[#D4E4BC] bg-[#F5F1E8] px-4 py-3 text-sm font-bold text-[#2D5A3D] transition hover:bg-[#E8F0E4]"
        >
          + 아이 추가하기
        </button>
      )}
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* 아이 행 (보기 전용)                                                        */
/* -------------------------------------------------------------------------- */

function ChildRowView({
  child,
  onEdit,
}: {
  child: ChildRow;
  onEdit: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const onDelete = () => {
    if (!confirm(`"${child.name}" 아이를 삭제할까요?`)) return;
    start(async () => {
      try {
        await removeChildAction(child.id);
        router.refresh();
      } catch (e) {
        alert(e instanceof Error ? e.message : "삭제 실패");
      }
    });
  };

  return (
    <div className="flex items-center gap-3">
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#D4E4BC] text-lg font-bold text-[#2D5A3D]"
        aria-hidden
      >
        {initialOf(child.name)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <p className="truncate text-sm font-bold text-[#2D5A3D]">
            {child.name}
          </p>
          {child.is_enrolled ? (
            <span className="shrink-0 rounded-full border border-emerald-300 bg-emerald-50 px-1.5 py-0.5 text-[9px] font-bold text-emerald-800">
              🏫 원생
            </span>
          ) : (
            <span className="shrink-0 rounded-full border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[9px] font-bold text-amber-800">
              👫 형제/자매
            </span>
          )}
        </div>
        <p className="truncate text-[11px] text-[#6B6560]">
          {[formatBirthYYMMDD(child.birth_date), genderLabel(child.gender)]
            .filter(Boolean)
            .join(" · ") || "정보 없음"}
        </p>
      </div>
      <div className="flex shrink-0 gap-1.5">
        <button
          type="button"
          onClick={onEdit}
          className="min-h-[36px] rounded-full border border-[#D4E4BC] bg-white px-3 py-1 text-[11px] font-semibold text-[#2D5A3D] transition hover:bg-[#E8F0E4]"
        >
          수정
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={pending}
          className="min-h-[36px] rounded-full border border-rose-200 bg-white px-3 py-1 text-[11px] font-semibold text-rose-700 transition hover:bg-rose-50 disabled:opacity-50"
        >
          삭제
        </button>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 아이 폼 (추가/수정 공용)                                                   */
/* -------------------------------------------------------------------------- */

function ChildForm({
  mode,
  childId,
  initial,
  onDone,
}: {
  mode: "add" | "edit";
  childId?: string;
  initial: {
    name: string;
    birthYYMMDD: string;
    gender: Gender;
    isEnrolled: boolean;
  };
  onDone: () => void;
}) {
  const router = useRouter();
  const [name, setName] = useState(initial.name);
  const [birth, setBirth] = useState(initial.birthYYMMDD);
  const [gender, setGender] = useState<Gender>(initial.gender);
  const [isEnrolled, setIsEnrolled] = useState(initial.isEnrolled);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    const trimmed = name.trim();
    if (!trimmed) {
      setError("아이 이름을 입력해 주세요");
      return;
    }
    const digits = birth.replace(/\D/g, "");
    if (digits && digits.length !== 6 && digits.length !== 8) {
      setError("생년월일은 6자리(YYMMDD)로 입력해 주세요");
      return;
    }

    const fd = new FormData();
    fd.set("name", trimmed);
    fd.set("birth_date", digits);
    fd.set("gender", gender);
    fd.set("is_enrolled", isEnrolled ? "1" : "0");

    start(async () => {
      try {
        if (mode === "edit" && childId) {
          await updateChildAction(childId, fd);
        } else {
          await addChildAction(fd);
        }
        router.refresh();
        onDone();
      } catch (e) {
        setError(e instanceof Error ? e.message : "저장 실패");
      }
    });
  };

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      {error && (
        <p
          role="alert"
          className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-800"
        >
          ⚠️ {error}
        </p>
      )}

      <div className="space-y-1">
        <label className="block text-xs font-semibold text-[#6B6560]">
          이름 <span className="text-rose-600">*</span>
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="예: 홍길동"
          required
          autoComplete="off"
          className={INPUT_CLS}
        />
      </div>

      <div>
        <label className="mb-1 block text-xs font-semibold text-[#6B6560]">
          생년월일 (YYMMDD)
        </label>
        <input
          type="text"
          inputMode="numeric"
          pattern="\d{6}"
          maxLength={6}
          value={birth}
          onChange={(e) =>
            setBirth(e.target.value.replace(/\D/g, "").slice(0, 6))
          }
          placeholder="예: 161001"
          className={`${INPUT_CLS} font-mono`}
        />
      </div>

      {/* 성별 토글 */}
      <div>
        <label className="mb-1 block text-xs font-semibold text-[#6B6560]">
          성별
        </label>
        <div
          className="grid grid-cols-3 gap-1 rounded-xl border border-[#D4E4BC] bg-white p-1"
          role="radiogroup"
        >
          <ToggleButton
            active={gender === ""}
            onClick={() => setGender("")}
            label="선택 안 함"
            activeCls="bg-[#E8E0D0] text-[#6B6560]"
          />
          <ToggleButton
            active={gender === "M"}
            onClick={() => setGender("M")}
            label="남아"
            activeCls="bg-sky-500 text-white"
          />
          <ToggleButton
            active={gender === "F"}
            onClick={() => setGender("F")}
            label="여아"
            activeCls="bg-rose-500 text-white"
          />
        </div>
      </div>

      {/* 원생/형제자매 토글 */}
      <div>
        <label className="mb-1 block text-xs font-semibold text-[#6B6560]">
          관계
        </label>
        <div
          className="grid grid-cols-2 gap-1 rounded-xl border border-[#D4E4BC] bg-white p-1"
          role="radiogroup"
        >
          <ToggleButton
            active={isEnrolled}
            onClick={() => setIsEnrolled(true)}
            label="🏫 원생"
            activeCls="bg-emerald-500 text-white"
          />
          <ToggleButton
            active={!isEnrolled}
            onClick={() => setIsEnrolled(false)}
            label="👫 형제/자매"
            activeCls="bg-amber-500 text-white"
          />
        </div>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onDone}
          disabled={pending}
          className="min-h-[44px] flex-1 rounded-2xl border border-[#D4E4BC] bg-white py-2.5 text-sm font-semibold text-[#6B6560] transition hover:bg-[#F5F1E8] disabled:opacity-50"
        >
          취소
        </button>
        <button
          type="submit"
          disabled={pending}
          className="min-h-[44px] flex-1 rounded-2xl bg-[#3A7A52] py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-[#2D5A3D] disabled:opacity-50"
        >
          {pending
            ? "저장 중..."
            : mode === "edit"
            ? "저장하기"
            : "아이 추가"}
        </button>
      </div>
    </form>
  );
}

function ToggleButton({
  active,
  onClick,
  label,
  activeCls,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  activeCls: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`h-9 rounded-lg px-2 text-[12px] font-bold transition ${
        active
          ? activeCls
          : "bg-transparent text-[#6B6560] hover:bg-[#F5F1E8]"
      }`}
    >
      {label}
    </button>
  );
}

const INPUT_CLS =
  "w-full rounded-xl border border-[#D4E4BC] bg-white px-3 py-2.5 text-sm text-[#2D5A3D] outline-none focus:border-[#3A7A52] focus:ring-2 focus:ring-[#3A7A52]/30";
