"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  updateQuestPackAction,
  publishQuestPackAction,
  endQuestPackAction,
  archiveQuestPackAction,
  deleteQuestPackAction,
} from "../../../missions/actions";
import {
  QUEST_PACK_STATUS_META,
  type LayoutMode,
  type OrgQuestPackRow,
  type StampIconSet,
} from "@/lib/missions/types";

type Props = {
  pack: OrgQuestPackRow;
  missionCount: number;
};

const LAYOUT_OPTIONS: Array<{
  value: LayoutMode;
  label: string;
  icon: string;
}> = [
  { value: "GRID", label: "격자형", icon: "▦" },
  { value: "LIST", label: "목록형", icon: "☰" },
  { value: "TRAIL_MAP", label: "숲길 지도", icon: "🗺" },
];

const ICON_SET_OPTIONS: Array<{
  value: StampIconSet;
  label: string;
  sample: string;
}> = [
  { value: "FOREST", label: "숲", sample: "🌲" },
  { value: "ANIMAL", label: "동물", sample: "🐿️" },
  { value: "SEASON", label: "사계절", sample: "🌸" },
];

function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${y}-${m}-${dd}T${hh}:${mm}`;
  } catch {
    return "";
  }
}

export function PackInfoEditor({ pack, missionCount }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [name, setName] = useState(pack.name);
  const [description, setDescription] = useState(pack.description ?? "");
  const [startsAt, setStartsAt] = useState(toLocalInput(pack.starts_at));
  const [endsAt, setEndsAt] = useState(toLocalInput(pack.ends_at));
  const [layoutMode, setLayoutMode] = useState<LayoutMode>(pack.layout_mode);
  const [iconSet, setIconSet] = useState<StampIconSet>(pack.stamp_icon_set);
  const [coverUrl, setCoverUrl] = useState(pack.cover_image_url ?? "");

  const [dirty, setDirty] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(
    null
  );

  const statusMeta = QUEST_PACK_STATUS_META[pack.status];

  function markDirty() {
    setDirty(true);
    setMsg(null);
  }

  function buildFormData(): FormData {
    const fd = new FormData();
    fd.set("name", name.trim());
    fd.set("description", description.trim());
    fd.set("starts_at", startsAt);
    fd.set("ends_at", endsAt);
    fd.set("layout_mode", layoutMode);
    fd.set("stamp_icon_set", iconSet);
    fd.set("cover_image_url", coverUrl.trim());
    return fd;
  }

  function onSave() {
    if (!name.trim()) {
      setMsg({ kind: "error", text: "이름을 입력해 주세요" });
      return;
    }
    startTransition(async () => {
      try {
        await updateQuestPackAction(pack.id, buildFormData());
        setMsg({ kind: "ok", text: "저장했어요." });
        setDirty(false);
        router.refresh();
      } catch (e) {
        setMsg({
          kind: "error",
          text: e instanceof Error ? e.message : "저장 실패",
        });
      }
    });
  }

  async function runStatus(
    action: (id: string) => Promise<void>,
    confirmText?: string,
    successText?: string
  ) {
    if (confirmText && !window.confirm(confirmText)) return;
    startTransition(async () => {
      try {
        await action(pack.id);
        if (successText) {
          setMsg({ kind: "ok", text: successText });
        }
        router.refresh();
      } catch (e) {
        setMsg({
          kind: "error",
          text: e instanceof Error ? e.message : "상태 변경 실패",
        });
      }
    });
  }

  function onPublish() {
    if (missionCount < 1) {
      setMsg({
        kind: "error",
        text: "공개하려면 미션을 1개 이상 담아야 해요",
      });
      return;
    }
    runStatus(
      publishQuestPackAction,
      "이 스탬프북을 공개할까요? 아이들이 볼 수 있게 됩니다.",
      "공개했어요! 아이들에게 나눠주세요."
    );
  }

  function onEnd() {
    runStatus(
      endQuestPackAction,
      "이 스탬프북을 종료할까요? 더 이상 스탬프를 찍을 수 없게 됩니다.",
      "종료했어요."
    );
  }

  function onArchive() {
    runStatus(
      archiveQuestPackAction,
      "이 스탬프북을 보관할까요? 목록에서 숨김 처리됩니다.",
      "보관했어요."
    );
  }

  function onDelete() {
    if (pack.status === "LIVE") {
      setMsg({
        kind: "error",
        text: "공개중인 스탬프북은 바로 삭제할 수 없어요. 먼저 '종료' 또는 '보관'을 눌러 주세요.",
      });
      return;
    }
    const ok = window.confirm(
      `정말로 "${pack.name || "(이름 없음)"}" 스탬프북을 삭제할까요?\n담긴 미션은 삭제되지 않고 '미션 카탈로그'로 돌아갑니다.`
    );
    if (!ok) return;
    startTransition(async () => {
      try {
        await deleteQuestPackAction(pack.id);
        router.push(`/org/${pack.org_id}/quest-packs`);
      } catch (e) {
        setMsg({
          kind: "error",
          text: e instanceof Error ? e.message : "삭제 실패",
        });
      }
    });
  }

  return (
    <div className="space-y-4">
      {/* 헤더: name 인라인 편집 + 상태 + status 전환 */}
      <section className="rounded-2xl border border-[#D4E4BC] bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span
                className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${statusMeta.color}`}
              >
                {statusMeta.label}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-[#D4E4BC] bg-[#F5F1E8] px-2 py-0.5 text-[10px] font-semibold text-[#2D5A3D]">
                <span aria-hidden>🎯</span>
                <span>{missionCount}개 미션</span>
              </span>
            </div>
            <label htmlFor="pack-name" className="sr-only">
              스탬프북 이름
            </label>
            <input
              id="pack-name"
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                markDirty();
              }}
              placeholder="스탬프북 이름"
              className="mt-2 w-full border-0 border-b-2 border-transparent bg-transparent text-xl font-bold text-[#2D5A3D] focus:border-[#2D5A3D] focus:outline-none md:text-2xl"
            />
          </div>

          {/* 상태 전환 */}
          <div className="flex flex-wrap gap-2">
            {pack.status === "DRAFT" && (
              <button
                type="button"
                onClick={onPublish}
                disabled={isPending}
                className="inline-flex items-center gap-1 rounded-xl bg-gradient-to-r from-[#2D5A3D] to-[#3A7A52] px-3 py-2 text-xs font-bold text-white shadow-sm transition hover:from-[#234a30] hover:to-[#2D5A3D] disabled:opacity-50"
              >
                <span aria-hidden>🌲</span>
                <span>공개하기</span>
              </button>
            )}
            {pack.status === "LIVE" && (
              <button
                type="button"
                onClick={onEnd}
                disabled={isPending}
                className="inline-flex items-center gap-1 rounded-xl border border-[#D4E4BC] bg-white px-3 py-2 text-xs font-bold text-[#2D5A3D] transition hover:bg-[#F5F1E8] disabled:opacity-50"
              >
                <span aria-hidden>🏁</span>
                <span>종료</span>
              </button>
            )}
            {(pack.status === "DRAFT" ||
              pack.status === "LIVE" ||
              pack.status === "ENDED") && (
              <button
                type="button"
                onClick={onArchive}
                disabled={isPending}
                className="inline-flex items-center gap-1 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-600 transition hover:bg-zinc-50 disabled:opacity-50"
              >
                <span aria-hidden>📦</span>
                <span>보관</span>
              </button>
            )}
            <button
              type="button"
              onClick={onDelete}
              disabled={isPending || pack.status === "LIVE"}
              title={
                pack.status === "LIVE"
                  ? "공개중인 스탬프북은 바로 삭제할 수 없어요"
                  : "스탬프북 삭제"
              }
              className="inline-flex items-center gap-1 rounded-xl border border-rose-200 bg-white px-3 py-2 text-xs font-bold text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span aria-hidden>🗑️</span>
              <span>삭제</span>
            </button>
          </div>
        </div>
      </section>

      {(dirty || msg) && (
        <div
          role="status"
          className={`rounded-xl border px-3 py-2 text-xs font-semibold ${
            msg?.kind === "error"
              ? "border-rose-200 bg-rose-50 text-rose-800"
              : msg?.kind === "ok"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-amber-200 bg-amber-50 text-amber-800"
          }`}
        >
          {msg ? msg.text : "* 변경사항이 있어요. 저장을 눌러주세요."}
        </div>
      )}

      <section className="rounded-2xl border border-[#D4E4BC] bg-white p-5 shadow-sm">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-[#2D5A3D]">
          <span aria-hidden>📝</span>
          <span>기본 정보</span>
        </h2>
        <div className="space-y-4">
          <Field label="설명" htmlFor="description">
            <textarea
              id="description"
              rows={3}
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                markDirty();
              }}
              className={inputCls}
              placeholder="아이들에게 보여줄 소개 문구"
            />
          </Field>

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="시작 일시" htmlFor="starts_at">
              <input
                id="starts_at"
                type="datetime-local"
                value={startsAt}
                onChange={(e) => {
                  setStartsAt(e.target.value);
                  markDirty();
                }}
                className={inputCls}
              />
            </Field>
            <Field label="종료 일시" htmlFor="ends_at">
              <input
                id="ends_at"
                type="datetime-local"
                value={endsAt}
                onChange={(e) => {
                  setEndsAt(e.target.value);
                  markDirty();
                }}
                className={inputCls}
              />
            </Field>
          </div>

          <Field label="레이아웃" htmlFor="layout_mode">
            <div className="flex flex-wrap gap-2">
              {LAYOUT_OPTIONS.map((o) => (
                <label
                  key={o.value}
                  className={`cursor-pointer rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                    layoutMode === o.value
                      ? "border-[#2D5A3D] bg-[#2D5A3D] text-white"
                      : "border-[#D4E4BC] bg-white text-[#2D5A3D] hover:bg-[#F5F1E8]"
                  }`}
                >
                  <input
                    type="radio"
                    name="layout_mode"
                    value={o.value}
                    checked={layoutMode === o.value}
                    onChange={() => {
                      setLayoutMode(o.value);
                      markDirty();
                    }}
                    className="sr-only"
                  />
                  <span className="mr-1" aria-hidden>
                    {o.icon}
                  </span>
                  <span>{o.label}</span>
                </label>
              ))}
            </div>
          </Field>

          <Field label="스탬프 아이콘 세트" htmlFor="stamp_icon_set">
            <div className="flex flex-wrap gap-2">
              {ICON_SET_OPTIONS.map((o) => (
                <label
                  key={o.value}
                  className={`cursor-pointer rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                    iconSet === o.value
                      ? "border-[#2D5A3D] bg-[#2D5A3D] text-white"
                      : "border-[#D4E4BC] bg-white text-[#2D5A3D] hover:bg-[#F5F1E8]"
                  }`}
                >
                  <input
                    type="radio"
                    name="stamp_icon_set"
                    value={o.value}
                    checked={iconSet === o.value}
                    onChange={() => {
                      setIconSet(o.value);
                      markDirty();
                    }}
                    className="sr-only"
                  />
                  <span className="mr-1" aria-hidden>
                    {o.sample}
                  </span>
                  <span>{o.label}</span>
                </label>
              ))}
            </div>
          </Field>

          <Field label="커버 이미지 URL (선택)" htmlFor="cover_image_url">
            <input
              id="cover_image_url"
              type="url"
              value={coverUrl}
              onChange={(e) => {
                setCoverUrl(e.target.value);
                markDirty();
              }}
              placeholder="https://..."
              className={inputCls}
              autoComplete="off"
              inputMode="url"
            />
          </Field>

          <div className="pt-1">
            <button
              type="button"
              onClick={onSave}
              disabled={isPending}
              className="inline-flex items-center gap-1 rounded-xl border border-[#D4E4BC] bg-white px-4 py-2.5 text-sm font-bold text-[#2D5A3D] transition hover:bg-[#F5F1E8] disabled:opacity-50"
            >
              <span aria-hidden>💾</span>
              <span>저장</span>
            </button>
          </div>
        </div>
      </section>
    </div>
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
