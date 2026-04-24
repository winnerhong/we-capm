"use client";

import { useState, useTransition } from "react";
import { createQuestPackAction } from "../../missions/actions";
import type { LayoutMode, StampIconSet } from "@/lib/missions/types";

type Props = {
  orgId: string;
};

const LAYOUT_OPTIONS: Array<{
  value: LayoutMode;
  label: string;
  hint: string;
  icon: string;
}> = [
  {
    value: "GRID",
    label: "격자형",
    hint: "미션을 N×5 격자로 한눈에",
    icon: "▦",
  },
  {
    value: "LIST",
    label: "목록형",
    hint: "세로 스크롤 리스트",
    icon: "☰",
  },
  {
    value: "TRAIL_MAP",
    label: "숲길 지도",
    hint: "점선으로 이어진 여정",
    icon: "🗺",
  },
];

const ICON_SET_OPTIONS: Array<{
  value: StampIconSet;
  label: string;
  sample: string;
}> = [
  { value: "FOREST", label: "숲 테마", sample: "🌲🍂🌻🍄🌿" },
  { value: "ANIMAL", label: "동물 친구", sample: "🐿️🦊🐻🦉🐸" },
  { value: "SEASON", label: "사계절", sample: "🌸☀️🍁❄️🌻" },
];

export function CreateQuestPackForm({ orgId }: Props) {
  const [isPending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [layoutMode, setLayoutMode] = useState<LayoutMode>("GRID");
  const [iconSet, setIconSet] = useState<StampIconSet>("FOREST");
  const [coverUrl, setCoverUrl] = useState("");

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr(null);

    if (!name.trim()) {
      setErr("스탬프북 이름을 입력해 주세요");
      return;
    }
    if (startsAt && endsAt && new Date(startsAt) > new Date(endsAt)) {
      setErr("시작 일시가 종료 일시보다 늦어요");
      return;
    }

    const fd = new FormData();
    fd.set("name", name.trim());
    fd.set("description", description.trim());
    fd.set("starts_at", startsAt);
    fd.set("ends_at", endsAt);
    fd.set("layout_mode", layoutMode);
    fd.set("stamp_icon_set", iconSet);
    fd.set("cover_image_url", coverUrl.trim());

    startTransition(async () => {
      try {
        await createQuestPackAction(orgId, fd);
      } catch (e) {
        setErr(e instanceof Error ? e.message : "생성 실패");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      {err && (
        <div
          role="alert"
          className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-800"
        >
          {err}
        </div>
      )}

      <section className="rounded-2xl border border-[#D4E4BC] bg-white p-5 shadow-sm">
        <h2 className="mb-4 flex items-center gap-2 text-sm font-bold text-[#2D5A3D]">
          <span aria-hidden>📝</span>
          <span>기본 정보</span>
        </h2>
        <div className="space-y-4">
          <Field label="이름" htmlFor="name" required>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예) 봄 숲 탐험 스탬프북"
              className={inputCls}
              autoComplete="off"
              required
            />
          </Field>

          <Field label="설명 (선택)" htmlFor="description">
            <textarea
              id="description"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="아이들에게 보여줄 소개 문구를 적어주세요"
              className={inputCls}
            />
          </Field>

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="시작 일시" htmlFor="starts_at">
              <input
                id="starts_at"
                type="datetime-local"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label="종료 일시" htmlFor="ends_at">
              <input
                id="ends_at"
                type="datetime-local"
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
                className={inputCls}
              />
            </Field>
          </div>

          <Field label="커버 이미지 URL (선택)" htmlFor="cover_image_url">
            <input
              id="cover_image_url"
              type="url"
              value={coverUrl}
              onChange={(e) => setCoverUrl(e.target.value)}
              placeholder="https://..."
              className={inputCls}
              autoComplete="off"
              inputMode="url"
            />
            <p className="mt-1 text-[11px] text-[#8B7F75]">
              Phase 1은 URL 붙여넣기만 지원해요. 파일 업로드는 Phase 2에서!
            </p>
          </Field>
        </div>
      </section>

      <section className="rounded-2xl border border-[#D4E4BC] bg-white p-5 shadow-sm">
        <h2 className="mb-4 flex items-center gap-2 text-sm font-bold text-[#2D5A3D]">
          <span aria-hidden>🎨</span>
          <span>레이아웃</span>
        </h2>
        <fieldset>
          <legend className="sr-only">레이아웃 모드</legend>
          <div className="grid gap-2 md:grid-cols-3">
            {LAYOUT_OPTIONS.map((o) => (
              <label
                key={o.value}
                className={`cursor-pointer rounded-xl border p-3 transition ${
                  layoutMode === o.value
                    ? "border-[#2D5A3D] bg-[#E8F0E4]"
                    : "border-[#D4E4BC] bg-white hover:border-[#2D5A3D]"
                }`}
              >
                <input
                  type="radio"
                  name="layout_mode"
                  value={o.value}
                  checked={layoutMode === o.value}
                  onChange={() => setLayoutMode(o.value)}
                  className="sr-only"
                />
                <p className="text-2xl" aria-hidden>
                  {o.icon}
                </p>
                <p className="mt-1 text-sm font-bold text-[#2D5A3D]">
                  {o.label}
                </p>
                <p className="text-[11px] text-[#6B6560]">{o.hint}</p>
              </label>
            ))}
          </div>
        </fieldset>
      </section>

      <section className="rounded-2xl border border-[#D4E4BC] bg-white p-5 shadow-sm">
        <h2 className="mb-4 flex items-center gap-2 text-sm font-bold text-[#2D5A3D]">
          <span aria-hidden>🎴</span>
          <span>스탬프 아이콘 세트</span>
        </h2>
        <fieldset>
          <legend className="sr-only">스탬프 아이콘 세트</legend>
          <div className="grid gap-2 md:grid-cols-3">
            {ICON_SET_OPTIONS.map((o) => (
              <label
                key={o.value}
                className={`cursor-pointer rounded-xl border p-3 transition ${
                  iconSet === o.value
                    ? "border-[#2D5A3D] bg-[#E8F0E4]"
                    : "border-[#D4E4BC] bg-white hover:border-[#2D5A3D]"
                }`}
              >
                <input
                  type="radio"
                  name="stamp_icon_set"
                  value={o.value}
                  checked={iconSet === o.value}
                  onChange={() => setIconSet(o.value)}
                  className="sr-only"
                />
                <p className="text-lg" aria-hidden>
                  {o.sample}
                </p>
                <p className="mt-1 text-sm font-bold text-[#2D5A3D]">
                  {o.label}
                </p>
              </label>
            ))}
          </div>
        </fieldset>
      </section>

      <div className="sticky bottom-4 rounded-2xl border border-[#D4E4BC] bg-white/95 p-3 shadow-sm backdrop-blur">
        <button
          type="submit"
          disabled={isPending}
          className="w-full rounded-xl bg-gradient-to-r from-[#2D5A3D] to-[#3A7A52] px-4 py-3 text-sm font-bold text-white shadow-md transition hover:from-[#234a30] hover:to-[#2D5A3D] disabled:opacity-50"
        >
          {isPending ? "생성 중..." : "🌲 초안으로 만들기"}
        </button>
        <p className="mt-2 text-center text-[11px] text-[#8B7F75]">
          만들면 편집 화면으로 이동해요. 미션을 담고 공개할 수 있어요.
        </p>
      </div>
    </form>
  );
}

const inputCls =
  "w-full rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] px-3 py-2.5 text-sm text-[#2C2C2C] focus:border-[#3A7A52] focus:outline-none focus:ring-2 focus:ring-[#3A7A52]/30";

function Field({
  label,
  htmlFor,
  required,
  children,
}: {
  label: string;
  htmlFor: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        htmlFor={htmlFor}
        className="mb-1 block text-xs font-semibold text-[#2D5A3D]"
      >
        {label} {required && <span className="text-rose-600">*</span>}
      </label>
      {children}
    </div>
  );
}
