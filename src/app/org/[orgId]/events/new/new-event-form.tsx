"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createOrgEventAction } from "@/lib/org-events/actions";

const INPUT_CLS =
  "w-full rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] px-3 py-2.5 text-sm text-[#2C2C2C] focus:border-[#3A7A52] focus:outline-none focus:ring-2 focus:ring-[#3A7A52]/30";

export function NewEventForm({ orgId }: { orgId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [coverUrl, setCoverUrl] = useState("");

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

    startTransition(async () => {
      try {
        const res = await createOrgEventAction(fd);
        if (res.ok) {
          router.push(`/org/${orgId}/events/${res.eventId}`);
          router.refresh();
        } else {
          setError(res.message);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "생성 실패";
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
              placeholder="행사 소개 문구를 적어주세요"
              className={INPUT_CLS}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label
                htmlFor="starts_at"
                className="mb-1 block text-xs font-semibold text-[#2D5A3D]"
              >
                시작일 (선택)
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
                종료일 (선택)
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
              커버 이미지 URL (선택)
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
            <p className="mt-1 text-[11px] text-[#8B7F75]">
              비워두면 🎪 이모지 플레이스홀더로 표시돼요.
            </p>
          </div>
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-end gap-2">
        <Link
          href={`/org/${orgId}/events`}
          className="rounded-xl border border-[#D4E4BC] bg-white px-4 py-2.5 text-sm font-semibold text-[#6B6560] hover:bg-[#FFF8F0]"
        >
          취소
        </Link>
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#2D5A3D] to-[#3A7A52] px-5 py-2.5 text-sm font-bold text-white shadow-md hover:from-[#234a30] hover:to-[#2D5A3D] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2D5A3D]/40 disabled:opacity-60"
        >
          <span aria-hidden>{isPending ? "⏳" : "🎪"}</span>
          <span>{isPending ? "생성 중..." : "초안으로 만들기"}</span>
        </button>
      </div>
    </form>
  );
}
