"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { updateOrgEventAction } from "@/lib/org-events/actions";
import {
  ORG_EVENT_STATUSES,
  ORG_EVENT_STATUS_META,
  type OrgEventStatus,
} from "@/lib/org-events/types";

const INPUT_CLS =
  "w-full rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] px-3 py-2.5 text-sm text-[#2C2C2C] focus:border-[#3A7A52] focus:outline-none focus:ring-2 focus:ring-[#3A7A52]/30";

/**
 * ISO → YYYY-MM-DD (input[type=date] 용).
 */
function toDateInputValue(iso: string | null): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  } catch {
    return "";
  }
}

export function EditEventForm({
  orgId,
  eventId,
  initial,
}: {
  orgId: string;
  eventId: string;
  initial: {
    name: string;
    description: string;
    starts_at: string | null;
    ends_at: string | null;
    cover_image_url: string;
    status: OrgEventStatus;
    allow_self_register: boolean;
  };
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState(initial.name);
  const [description, setDescription] = useState(initial.description);
  const [startsAt, setStartsAt] = useState(toDateInputValue(initial.starts_at));
  const [endsAt, setEndsAt] = useState(toDateInputValue(initial.ends_at));
  const [coverUrl, setCoverUrl] = useState(initial.cover_image_url);
  const [status, setStatus] = useState<OrgEventStatus>(initial.status);
  const [allowSelfRegister, setAllowSelfRegister] = useState<boolean>(
    initial.allow_self_register
  );

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const trimmed = name.trim();
    if (!trimmed) {
      setError("행사 이름을 입력해 주세요");
      return;
    }
    if (trimmed.length > 100) {
      setError("이름은 100자 이내로 입력해 주세요");
      return;
    }
    if (startsAt && endsAt && new Date(startsAt) > new Date(endsAt)) {
      setError("시작일이 종료일보다 늦어요");
      return;
    }

    const fd = new FormData();
    fd.set("name", trimmed);
    fd.set("description", description.trim());
    fd.set("starts_at", startsAt);
    fd.set("ends_at", endsAt);
    fd.set("cover_image_url", coverUrl.trim());
    fd.set("status", status);
    // 체크박스 전용: backend 가 "on" / 미전송으로 true/false 판단하는 관례와 동일.
    if (allowSelfRegister) fd.set("allow_self_register", "on");

    startTransition(async () => {
      try {
        await updateOrgEventAction(eventId, fd);
        router.push(`/org/${orgId}/events/${eventId}?saved=1`);
        router.refresh();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "저장 실패";
        if (msg.includes("NEXT_REDIRECT")) return;
        setError(msg);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      {error && (
        <div
          role="alert"
          className="rounded-xl border-2 border-rose-300 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800"
        >
          ⚠️ {error}
        </div>
      )}

      <section className="rounded-2xl border border-[#D4E4BC] bg-white p-5 shadow-sm">
        <h2 className="mb-4 flex items-center gap-2 text-sm font-bold text-[#2D5A3D]">
          <span aria-hidden>📝</span>
          <span>기본 정보</span>
        </h2>

        <div className="space-y-4">
          <div>
            <label
              htmlFor="name"
              className="mb-1 block text-xs font-semibold text-[#2D5A3D]"
            >
              행사 이름 <span className="text-rose-600">*</span>
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예) 2026 봄 숲 캠프"
              maxLength={100}
              autoComplete="off"
              required
              className={INPUT_CLS}
            />
            <p className="mt-1 text-[11px] text-[#8B7F75]">
              {name.length} / 100자
            </p>
          </div>

          <div>
            <label
              htmlFor="description"
              className="mb-1 block text-xs font-semibold text-[#2D5A3D]"
            >
              설명 (선택)
            </label>
            <textarea
              id="description"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="행사 소개 문구"
              className={INPUT_CLS}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label
                htmlFor="starts_at"
                className="mb-1 block text-xs font-semibold text-[#2D5A3D]"
              >
                시작일
              </label>
              <input
                id="starts_at"
                type="date"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
                className={INPUT_CLS}
              />
            </div>
            <div>
              <label
                htmlFor="ends_at"
                className="mb-1 block text-xs font-semibold text-[#2D5A3D]"
              >
                종료일
              </label>
              <input
                id="ends_at"
                type="date"
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
                className={INPUT_CLS}
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="cover_image_url"
              className="mb-1 block text-xs font-semibold text-[#2D5A3D]"
            >
              커버 이미지 URL
            </label>
            <input
              id="cover_image_url"
              type="url"
              value={coverUrl}
              onChange={(e) => setCoverUrl(e.target.value)}
              placeholder="https://..."
              autoComplete="off"
              inputMode="url"
              className={INPUT_CLS}
            />
          </div>

          <div>
            <label
              htmlFor="status"
              className="mb-1 block text-xs font-semibold text-[#2D5A3D]"
            >
              상태 <span className="text-rose-600">*</span>
            </label>
            <select
              id="status"
              value={status}
              onChange={(e) => setStatus(e.target.value as OrgEventStatus)}
              className={INPUT_CLS}
            >
              {ORG_EVENT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {ORG_EVENT_STATUS_META[s].label} ({s})
                </option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-[#8B7F75]">
              상태는 상세 페이지의 빠른 전환 버튼으로도 바꿀 수 있어요.
            </p>
          </div>

          {/* 자체 가입 허용 토글 — 초대링크를 받은 미등록 번호의 신규 가입 허용 */}
          <div>
            <label
              className="flex cursor-pointer items-start gap-3 rounded-xl border border-[#D4E4BC] bg-white p-4 transition has-[:checked]:border-[#2D5A3D] has-[:checked]:bg-[#E8F0E4]"
            >
              <input
                type="checkbox"
                name="allow_self_register"
                checked={allowSelfRegister}
                onChange={(e) => setAllowSelfRegister(e.target.checked)}
                className="mt-0.5 h-4 w-4 flex-shrink-0 accent-[#2D5A3D]"
              />
              <div className="min-w-0">
                <p className="text-sm font-bold text-[#2D5A3D]">
                  🌐 초대링크 자체 가입 허용
                </p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-[#6B6560]">
                  켜면 사전 등록되지 않은 참가자도 초대링크를 받으면 이름만 입력해 바로 참여할 수 있어요.
                  끄면 기관에서 사전 등록된 전화번호만 참여 가능해요.
                </p>
              </div>
            </label>
          </div>
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-end gap-2">
        <Link
          href={`/org/${orgId}/events/${eventId}`}
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
  );
}
