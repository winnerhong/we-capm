"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  addChildAction,
  deleteChildAction,
  toggleChildEnrolledAction,
  updateAppUserAction,
  updateChildBirthDateAction,
  type UserStatus,
} from "../../actions";

type ChildRow = {
  id: string;
  name: string;
  birth_date: string | null;
  is_enrolled: boolean;
};

const INPUT_CLS =
  "w-full rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] px-3 py-2.5 text-sm text-[#2C2C2C] focus:border-[#3A7A52] focus:outline-none focus:ring-2 focus:ring-[#3A7A52]/30";

const STATUS_OPTIONS: Array<{ value: UserStatus; label: string }> = [
  { value: "ACTIVE", label: "활성" },
  { value: "SUSPENDED", label: "정지" },
  { value: "CLOSED", label: "해지" },
];

function formatPhone(digits: string): string {
  const d = (digits ?? "").replace(/\D/g, "");
  if (d.length === 11) {
    return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
  }
  if (d.length === 10) {
    return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
  }
  return digits;
}

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

export function EditUserForm({
  orgId,
  userId,
  initialParentName,
  initialStatus,
  phone,
  children,
}: {
  orgId: string;
  userId: string;
  initialParentName: string;
  initialStatus: UserStatus;
  phone: string;
  children: ChildRow[];
}) {
  const router = useRouter();
  const [parentName, setParentName] = useState(initialParentName);
  const [status, setStatus] = useState<UserStatus>(initialStatus);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const [newChildName, setNewChildName] = useState("");
  const [newChildBirth, setNewChildBirth] = useState("");
  const [childError, setChildError] = useState<string | null>(null);
  const [childPending, startChildTransition] = useTransition();

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    const trimmed = parentName.trim();
    if (!trimmed) {
      setError("보호자 이름을 입력해 주세요");
      return;
    }

    const fd = new FormData();
    fd.set("parent_name", trimmed);
    fd.set("status", status);

    startTransition(async () => {
      try {
        await updateAppUserAction(userId, fd);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "저장 실패";
        if (msg.includes("NEXT_REDIRECT")) return;
        setError(msg);
      }
    });
  };

  const onAddChild = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setChildError(null);

    const trimmedName = newChildName.trim();
    if (!trimmedName) {
      setChildError("자녀 이름을 입력해 주세요");
      return;
    }

    const fd = new FormData();
    fd.set("child_name", trimmedName);
    fd.set("child_birth", newChildBirth);

    startChildTransition(async () => {
      try {
        await addChildAction(userId, fd);
        setNewChildName("");
        setNewChildBirth("");
        router.refresh();
      } catch (e) {
        setChildError(e instanceof Error ? e.message : "자녀 추가 실패");
      }
    });
  };

  const onDeleteChild = (childId: string, childName: string) => {
    if (!confirm(`"${childName}" 자녀를 삭제할까요?`)) return;
    setChildError(null);
    startChildTransition(async () => {
      try {
        await deleteChildAction(childId);
        router.refresh();
      } catch (e) {
        setChildError(e instanceof Error ? e.message : "자녀 삭제 실패");
      }
    });
  };

  const onToggleEnrolled = (childId: string, nextEnrolled: boolean) => {
    setChildError(null);
    startChildTransition(async () => {
      try {
        await toggleChildEnrolledAction(childId, nextEnrolled);
        router.refresh();
      } catch (e) {
        setChildError(e instanceof Error ? e.message : "원생 여부 변경 실패");
      }
    });
  };

  // 인라인 생년월일 편집 — 어떤 child 의 input 이 열려있는지 추적
  const [editingBirthId, setEditingBirthId] = useState<string | null>(null);
  const [birthDraft, setBirthDraft] = useState("");

  const onSaveBirth = (childId: string) => {
    setChildError(null);
    startChildTransition(async () => {
      try {
        await updateChildBirthDateAction(childId, birthDraft || null);
        setEditingBirthId(null);
        setBirthDraft("");
        router.refresh();
      } catch (e) {
        setChildError(
          e instanceof Error ? e.message : "생년월일 수정 실패"
        );
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* 기본 정보 편집 */}
      <form onSubmit={onSubmit} className="space-y-4">
        {error && (
          <div
            role="alert"
            className="rounded-xl border-2 border-rose-300 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800"
          >
            ⚠️ {error}
          </div>
        )}

        <section className="rounded-2xl border border-[#D4E4BC] bg-white p-5 shadow-sm md:p-6">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-bold text-[#2D5A3D]">
            <span aria-hidden>🙋</span>
            <span>보호자 정보</span>
          </h2>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label
                htmlFor="parent_name"
                className="mb-1 block text-xs font-semibold text-[#2D5A3D]"
              >
                보호자 이름 <span className="text-rose-600">*</span>
              </label>
              <input
                id="parent_name"
                type="text"
                value={parentName}
                onChange={(e) => setParentName(e.target.value)}
                placeholder="예) 김엄마"
                autoComplete="name"
                required
                className={INPUT_CLS}
              />
            </div>

            <div>
              <label
                htmlFor="phone"
                className="mb-1 block text-xs font-semibold text-[#2D5A3D]"
              >
                핸드폰 (로그인 아이디) — 수정 불가
              </label>
              <input
                id="phone"
                type="tel"
                value={formatPhone(phone)}
                readOnly
                disabled
                className={`${INPUT_CLS} cursor-not-allowed bg-[#F4EFE8] text-[#8B7F75]`}
              />
              <p className="mt-1 text-[11px] text-[#8B7F75]">
                🔑 핸드폰은 로그인 아이디라 변경할 수 없어요.
              </p>
            </div>

            <div className="md:col-span-2">
              <label
                htmlFor="status"
                className="mb-1 block text-xs font-semibold text-[#2D5A3D]"
              >
                상태 <span className="text-rose-600">*</span>
              </label>
              <select
                id="status"
                value={status}
                onChange={(e) => setStatus(e.target.value as UserStatus)}
                className={INPUT_CLS}
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[11px] text-[#8B7F75]">
                해지 상태의 참가자는 로그인이 차단돼요.
              </p>
            </div>
          </div>
        </section>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <Link
            href={`/org/${orgId}/users/${userId}`}
            className="rounded-xl border border-[#D4E4BC] bg-white px-4 py-2.5 text-sm font-semibold text-[#6B6560] hover:bg-[#FFF8F0]"
          >
            취소
          </Link>
          <button
            type="submit"
            disabled={isPending}
            className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#2D5A3D] to-[#3A7A52] px-5 py-2.5 text-sm font-bold text-white shadow-md hover:from-[#234a30] hover:to-[#2D5A3D] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2D5A3D]/40 disabled:opacity-60"
          >
            <span aria-hidden>{isPending ? "⏳" : "💾"}</span>
            <span>{isPending ? "저장 중..." : "저장"}</span>
          </button>
        </div>
      </form>

      {/* 자녀 관리 */}
      <section className="rounded-2xl border border-[#D4E4BC] bg-white p-5 shadow-sm md:p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-bold text-[#2D5A3D]">
            <span aria-hidden>🧒</span>
            <span>자녀 관리 ({children.length}명)</span>
          </h2>
        </div>

        {childError && (
          <div
            role="alert"
            className="mb-3 rounded-xl border-2 border-rose-300 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800"
          >
            ⚠️ {childError}
          </div>
        )}

        {children.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[#E5D3B8] bg-[#FFFDF8] p-6 text-center text-xs text-[#8B7F75]">
            등록된 자녀가 없어요. 아래에서 추가해 주세요.
          </div>
        ) : (
          <ul className="space-y-2">
            {children.map((c) => {
              const isEditingBirth = editingBirthId === c.id;
              return (
                <li
                  key={c.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#F0E8D8] bg-[#FFFDF8] px-4 py-3"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="text-lg" aria-hidden>
                      🧒
                    </span>
                    <div className="min-w-0">
                      <div className="font-semibold text-[#2D5A3D]">
                        {c.name}
                      </div>
                      {isEditingBirth ? (
                        <div className="mt-1 flex items-center gap-1.5">
                          <input
                            type="date"
                            value={birthDraft}
                            onChange={(e) => setBirthDraft(e.target.value)}
                            max={new Date().toISOString().slice(0, 10)}
                            disabled={childPending}
                            className="h-7 rounded-md border border-[#D4E4BC] bg-white px-2 text-[11px] text-[#2D5A3D] focus:border-[#2D5A3D] focus:outline-none focus:ring-1 focus:ring-[#2D5A3D]/40"
                          />
                          <button
                            type="button"
                            onClick={() => onSaveBirth(c.id)}
                            disabled={childPending}
                            className="h-7 rounded-md bg-[#2D5A3D] px-2 text-[10px] font-bold text-white hover:bg-[#234a30] disabled:opacity-50"
                          >
                            저장
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingBirthId(null);
                              setBirthDraft("");
                            }}
                            disabled={childPending}
                            className="h-7 rounded-md border border-[#E5D3B8] bg-white px-2 text-[10px] font-semibold text-[#6B4423] hover:bg-[#FFF8F0] disabled:opacity-50"
                          >
                            취소
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingBirthId(c.id);
                            setBirthDraft(c.birth_date ?? "");
                          }}
                          disabled={childPending}
                          title="클릭해서 생년월일 수정"
                          className="mt-0.5 inline-flex items-center gap-0.5 rounded-md px-1 text-[11px] text-[#6B6560] underline-offset-2 hover:bg-[#F5F1E8] hover:text-[#2D5A3D] hover:underline disabled:opacity-50"
                        >
                          <span aria-hidden>🎂</span>
                          <span>{formatDate(c.birth_date)}</span>
                          <span
                            aria-hidden
                            className="ml-0.5 text-[9px] text-[#8B7F75]"
                          >
                            ✏️
                          </span>
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => onToggleEnrolled(c.id, !c.is_enrolled)}
                      disabled={childPending}
                      aria-pressed={c.is_enrolled}
                      title={
                        c.is_enrolled
                          ? "원생이에요 — 클릭해서 형제/자매로 변경"
                          : "원생의 형제/자매예요 — 클릭해서 원생으로 변경"
                      }
                      className={`inline-flex h-7 items-center gap-1 rounded-md border px-2 text-[11px] font-bold transition disabled:opacity-50 ${
                        c.is_enrolled
                          ? "border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                          : "border-zinc-300 bg-white text-zinc-600 hover:bg-zinc-50"
                      }`}
                    >
                      {c.is_enrolled ? "🏫 원생" : "👫 형제/자매"}
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteChild(c.id, c.name)}
                      disabled={childPending}
                      className="inline-flex h-7 items-center rounded-md border border-red-200 bg-white px-2 text-[11px] font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                    >
                      삭제
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {/* 자녀 추가 폼 */}
        <form
          onSubmit={onAddChild}
          className="mt-4 rounded-xl border border-dashed border-[#2D5A3D] bg-[#F5F1E8] p-4"
        >
          <h3 className="mb-3 flex items-center gap-1 text-xs font-bold text-[#2D5A3D]">
            <span aria-hidden>+</span>
            <span>자녀 추가</span>
          </h3>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_1fr_auto]">
            <div>
              <label
                htmlFor="new_child_name"
                className="mb-1 block text-[11px] font-semibold text-[#2D5A3D]"
              >
                이름 <span className="text-rose-600">*</span>
              </label>
              <input
                id="new_child_name"
                type="text"
                value={newChildName}
                onChange={(e) => setNewChildName(e.target.value)}
                placeholder="예) 김도토리"
                autoComplete="off"
                className={INPUT_CLS}
              />
            </div>
            <div>
              <label
                htmlFor="new_child_birth"
                className="mb-1 block text-[11px] font-semibold text-[#2D5A3D]"
              >
                생년월일 (선택)
              </label>
              <input
                id="new_child_birth"
                type="date"
                value={newChildBirth}
                onChange={(e) => setNewChildBirth(e.target.value)}
                className={INPUT_CLS}
              />
            </div>
            <div className="flex items-end">
              <button
                type="submit"
                disabled={childPending}
                className="inline-flex h-[42px] w-full items-center justify-center gap-1 rounded-xl bg-[#2D5A3D] px-4 text-xs font-bold text-white hover:bg-[#234a30] disabled:opacity-60 md:w-auto"
              >
                <span aria-hidden>{childPending ? "⏳" : "➕"}</span>
                <span>{childPending ? "추가 중..." : "추가"}</span>
              </button>
            </div>
          </div>
        </form>
      </section>
    </div>
  );
}
