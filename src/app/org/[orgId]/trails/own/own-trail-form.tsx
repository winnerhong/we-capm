"use client";

// 기관 자체 코스 신규 등록 / 편집 공용 폼.
// 간단 버전 — 이름, 설명, 커버 이미지만.

import { useState, useTransition } from "react";
import Link from "next/link";
import { CoverImagePicker } from "@/components/cover-image-picker";
import {
  createOrgTrailAction,
  deleteOrgTrailAction,
  updateOrgTrailAction,
} from "../actions";

type Props = {
  orgId: string;
  /** 편집 모드면 trail 정보. 신규면 undefined. */
  trail?: {
    id: string;
    name: string;
    description: string | null;
    cover_image_url: string | null;
  };
};

const INPUT_CLS =
  "w-full rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] px-3 py-2.5 text-sm text-[#2C2C2C] focus:border-[#3A7A52] focus:outline-none focus:ring-2 focus:ring-[#3A7A52]/30";

export function OwnTrailForm({ orgId, trail }: Props) {
  const isEdit = !!trail;
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState(trail?.name ?? "");
  const [description, setDescription] = useState(trail?.description ?? "");
  const [coverUrl, setCoverUrl] = useState(trail?.cover_image_url ?? "");

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError("코스 이름을 입력해 주세요");
      return;
    }

    const fd = new FormData();
    fd.set("name", name.trim());
    fd.set("description", description.trim());
    fd.set("cover_image_url", coverUrl.trim());

    startTransition(async () => {
      try {
        if (isEdit && trail) {
          await updateOrgTrailAction(trail.id, fd);
        } else {
          await createOrgTrailAction(fd);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "저장 실패";
        if (msg.includes("NEXT_REDIRECT")) return;
        setError(msg);
      }
    });
  }

  function handleDelete() {
    if (!trail) return;
    if (
      !window.confirm(
        `"${trail.name}" 코스를 삭제할까요? 이 작업은 되돌릴 수 없습니다.`
      )
    ) {
      return;
    }
    startTransition(async () => {
      try {
        await deleteOrgTrailAction(trail.id);
        // delete 후 list 페이지로
        window.location.href = `/org/${orgId}/trails`;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "삭제 실패";
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
          <span aria-hidden>🗺️</span>
          <span>코스 정보</span>
        </h2>

        <div className="space-y-4">
          <div>
            <label
              htmlFor="name"
              className="mb-1 block text-xs font-semibold text-[#2D5A3D]"
            >
              코스 이름 <span className="text-rose-600">*</span>
            </label>
            <input
              id="name"
              type="text"
              maxLength={100}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예) 침산공원 둘레길 — 우리 어린이집 코스"
              className={INPUT_CLS}
              autoComplete="off"
              required
            />
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
              rows={4}
              maxLength={500}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={
                "예)\n어린이집 친구들이 함께 걷는 1km 짧은 산책 코스예요.\n계단 없는 평지라 부담 없어요."
              }
              className={INPUT_CLS}
            />
            <p className="mt-1 text-[10px] text-[#8B7F75]">
              💡 줄바꿈 그대로 표시됩니다.
            </p>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-[#2D5A3D]">
              🖼 커버 이미지 (선택)
            </label>
            <CoverImagePicker
              value={coverUrl}
              onChange={(url) => setCoverUrl(url)}
              pathPrefix="org-trails"
            />
            <p className="mt-1 text-[10px] text-[#8B7F75]">
              💡 코스 안내도/지도/사진 등을 올리면 카드에 표시됩니다.
            </p>
          </div>
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-end gap-2">
        {isEdit && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={isPending}
            className="mr-auto rounded-xl border border-rose-200 bg-white px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-50 disabled:opacity-50"
          >
            🗑 코스 삭제
          </button>
        )}
        <Link
          href={`/org/${orgId}/trails`}
          className="rounded-xl border border-[#D4E4BC] bg-white px-4 py-2.5 text-sm font-semibold text-[#6B6560] hover:bg-[#FFF8F0]"
        >
          취소
        </Link>
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#2D5A3D] to-[#3A7A52] px-5 py-2.5 text-sm font-bold text-white shadow-md hover:from-[#234a30] hover:to-[#2D5A3D] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2D5A3D]/40 disabled:opacity-60"
        >
          💾 {isEdit ? "수정 저장" : "코스 등록"}
        </button>
      </div>
    </form>
  );
}
