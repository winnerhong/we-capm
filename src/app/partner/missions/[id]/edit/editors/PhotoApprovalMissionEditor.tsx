"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  MISSION_KIND_META,
  type PartnerMissionRow,
  type PhotoApprovalMissionConfig,
  type MissionVisibility,
} from "@/lib/missions/types";
import {
  updatePartnerMissionAction,
  publishMissionAction,
  archiveMissionAction,
  deleteMissionAction,
} from "../../../actions";
import { AcornIcon } from "@/components/acorn-icon";

type Props = {
  mission: PartnerMissionRow;
};

const VISIBILITY_OPTIONS: Array<{
  value: MissionVisibility;
  label: string;
  hint: string;
}> = [
  {
    value: "DRAFT",
    label: "🔒 비공개 (초안)",
    hint: "지사 내부에서만 보입니다.",
  },
  {
    value: "ALL",
    label: "🌍 전체 공개",
    hint: "모든 기관이 미션 풀에서 볼 수 있어요.",
  },
  {
    value: "SELECTED",
    label: "🎯 선택 공개",
    hint: "지정한 기관에게만 노출됩니다.",
  },
  { value: "ARCHIVED", label: "📦 보관", hint: "목록에서 숨김 처리됩니다." },
];

const DEFAULT_REJECT_REASONS = [
  "사진이 선명하지 않아요",
  "해당 식물이 아니에요",
  "다시 찾아보세요",
];

function parseConfig(raw: Record<string, unknown>): PhotoApprovalMissionConfig {
  const prompt = typeof raw.prompt === "string" ? raw.prompt : "";
  const min_photos =
    typeof raw.min_photos === "number" && raw.min_photos > 0
      ? Math.min(5, Math.max(1, Math.floor(raw.min_photos)))
      : 1;
  const sla_hours =
    typeof raw.sla_hours === "number" && raw.sla_hours > 0
      ? Math.min(72, Math.max(1, Math.floor(raw.sla_hours)))
      : 24;
  let reject_reasons: string[] = [];
  if (Array.isArray(raw.reject_reasons)) {
    reject_reasons = raw.reject_reasons.flatMap((r) =>
      typeof r === "string" && r.trim() ? [r] : []
    );
  }
  if (reject_reasons.length === 0) {
    reject_reasons = [...DEFAULT_REJECT_REASONS];
  }
  return { prompt, min_photos, sla_hours, reject_reasons };
}

export function PhotoApprovalMissionEditor({ mission }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const kindMeta = MISSION_KIND_META[mission.kind];

  const initialConfig = useMemo(
    () => parseConfig((mission.config_json ?? {}) as Record<string, unknown>),
    [mission.config_json]
  );

  const [title, setTitle] = useState(mission.title);
  const [description, setDescription] = useState(mission.description ?? "");
  const [icon, setIcon] = useState(mission.icon ?? kindMeta.icon);
  const [defaultAcorns, setDefaultAcorns] = useState(
    String(mission.default_acorns ?? 0)
  );
  const [visibility, setVisibility] = useState<MissionVisibility>(
    mission.visibility
  );

  const [prompt, setPrompt] = useState(initialConfig.prompt);
  const [minPhotos, setMinPhotos] = useState(String(initialConfig.min_photos));
  const [slaHours, setSlaHours] = useState(String(initialConfig.sla_hours));
  const [rejectReasons, setRejectReasons] = useState<string[]>(
    initialConfig.reject_reasons
  );
  const [newReason, setNewReason] = useState("");

  const [dirty, setDirty] = useState(false);
  const [msg, setMsg] = useState<{
    kind: "ok" | "error";
    text: string;
  } | null>(null);

  function markDirty() {
    setDirty(true);
    setMsg(null);
  }

  function addReason() {
    const v = newReason.trim();
    if (!v) return;
    if (rejectReasons.includes(v)) {
      setNewReason("");
      return;
    }
    setRejectReasons([...rejectReasons, v]);
    setNewReason("");
    markDirty();
  }

  function removeReason(idx: number) {
    setRejectReasons(rejectReasons.filter((_, i) => i !== idx));
    markDirty();
  }

  function buildConfig(): Record<string, unknown> {
    const cfg: Record<string, unknown> = {
      prompt: prompt.trim(),
      min_photos: Math.min(5, Math.max(1, parseInt(minPhotos, 10) || 1)),
      sla_hours: Math.min(72, Math.max(1, parseInt(slaHours, 10) || 24)),
      reject_reasons: rejectReasons
        .map((r) => r.trim())
        .filter((r) => r.length > 0),
    };
    return cfg;
  }

  function validate(): string | null {
    if (!title.trim()) return "제목을 입력해 주세요";
    const acornsNum = parseInt(defaultAcorns, 10);
    if (Number.isNaN(acornsNum) || acornsNum < 0 || acornsNum > 20) {
      return "기본 도토리는 0~20 사이 숫자여야 해요";
    }
    if (!prompt.trim()) return "미션 안내 문구를 입력해 주세요";
    const mp = parseInt(minPhotos, 10);
    if (!Number.isFinite(mp) || mp < 1 || mp > 5) {
      return "최소 사진 장수는 1~5 사이여야 해요";
    }
    const sla = parseInt(slaHours, 10);
    if (!Number.isFinite(sla) || sla < 1 || sla > 72) {
      return "자동 승인 시한은 1~72시간 사이여야 해요";
    }
    return null;
  }

  function onSave(publish = false) {
    const err = validate();
    if (err) {
      setMsg({ kind: "error", text: err });
      return;
    }
    const fd = new FormData();
    fd.set("title", title.trim());
    fd.set("description", description.trim());
    fd.set("icon", icon.trim());
    fd.set("default_acorns", defaultAcorns);
    fd.set("visibility", visibility);
    fd.set("config_json", JSON.stringify(buildConfig()));

    startTransition(async () => {
      try {
        await updatePartnerMissionAction(mission.id, fd);
        if (publish) {
          await publishMissionAction(mission.id);
          setMsg({ kind: "ok", text: "게시했어요! 기관에서 바로 볼 수 있어요." });
        } else {
          setMsg({ kind: "ok", text: "저장했어요." });
        }
        setDirty(false);
        router.refresh();
      } catch (e) {
        const text = e instanceof Error ? e.message : "저장 실패";
        setMsg({ kind: "error", text });
      }
    });
  }

  function onArchive() {
    if (!window.confirm("이 미션을 보관할까요? 목록에서 숨김 처리됩니다.")) return;
    startTransition(async () => {
      try {
        await archiveMissionAction(mission.id);
        setMsg({ kind: "ok", text: "보관했어요." });
        router.refresh();
      } catch (e) {
        setMsg({
          kind: "error",
          text: e instanceof Error ? e.message : "보관 실패",
        });
      }
    });
  }

  function onDelete() {
    if (
      !window.confirm(
        "정말 삭제할까요? 사용 중인 미션은 삭제할 수 없고, 대신 보관됩니다."
      )
    )
      return;
    startTransition(async () => {
      try {
        await deleteMissionAction(mission.id);
      } catch (e) {
        setMsg({
          kind: "error",
          text: e instanceof Error ? e.message : "삭제 실패",
        });
      }
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,400px)]">
      <div className="space-y-6">
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

        {/* 기본 정보 */}
        <section className="rounded-2xl border border-[#D4E4BC] bg-white p-5 shadow-sm">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-bold text-[#2D5A3D]">
            <span aria-hidden>📝</span>
            <span>기본 정보</span>
          </h2>
          <div className="space-y-4">
            <Field label="제목" htmlFor="title" required>
              <input
                id="title"
                type="text"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  markDirty();
                }}
                placeholder="예) 단풍잎 찾기"
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
                onChange={(e) => {
                  setDescription(e.target.value);
                  markDirty();
                }}
                placeholder="어떤 미션인지 기관 담당자에게 알려주세요"
                className={inputCls}
              />
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label="아이콘 (이모지)" htmlFor="icon">
                <input
                  id="icon"
                  type="text"
                  value={icon}
                  onChange={(e) => {
                    setIcon(e.target.value);
                    markDirty();
                  }}
                  placeholder="🍃"
                  maxLength={4}
                  className={inputCls}
                />
              </Field>
              <Field label="기본 도토리 (0~20)" htmlFor="default_acorns">
                <input
                  id="default_acorns"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={20}
                  value={defaultAcorns}
                  onChange={(e) => {
                    setDefaultAcorns(e.target.value);
                    markDirty();
                  }}
                  className={inputCls}
                />
              </Field>
            </div>

            <Field label="공개 범위" htmlFor="visibility">
              <select
                id="visibility"
                value={visibility}
                onChange={(e) => {
                  setVisibility(e.target.value as MissionVisibility);
                  markDirty();
                }}
                className={inputCls}
              >
                {VISIBILITY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[11px] text-[#8B7F75]">
                {VISIBILITY_OPTIONS.find((o) => o.value === visibility)?.hint}
              </p>
            </Field>
          </div>
        </section>

        {/* 자연물 찾기 설정 */}
        <section className="rounded-2xl border border-[#D4E4BC] bg-white p-5 shadow-sm">
          <h2 className="mb-2 flex items-center gap-2 text-sm font-bold text-[#2D5A3D]">
            <span aria-hidden>🍃</span>
            <span>자연물 찾기 설정</span>
          </h2>
          <p className="mb-4 rounded-lg bg-[#F5F1E8] px-3 py-2 text-[11px] text-[#6B6560]">
            승인은 기관 선생님이 진행해요. SLA를 넘어가면 자동 승인됩니다.
          </p>

          <div className="space-y-4">
            <Field label="안내 문구" htmlFor="prompt" required>
              <textarea
                id="prompt"
                rows={3}
                value={prompt}
                onChange={(e) => {
                  setPrompt(e.target.value);
                  markDirty();
                }}
                placeholder="예) 숲에서 '단풍잎'을 찾아 사진 찍어올려주세요 🍃"
                className={inputCls}
              />
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label="최소 사진 장수 (1~5)" htmlFor="min_photos">
                <input
                  id="min_photos"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={5}
                  value={minPhotos}
                  onChange={(e) => {
                    setMinPhotos(e.target.value);
                    markDirty();
                  }}
                  className={inputCls}
                />
              </Field>
              <Field label="자동 승인 시한 (1~72시간)" htmlFor="sla_hours">
                <input
                  id="sla_hours"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={72}
                  value={slaHours}
                  onChange={(e) => {
                    setSlaHours(e.target.value);
                    markDirty();
                  }}
                  className={inputCls}
                />
                <p className="mt-1 text-[11px] text-[#8B7F75]">
                  이 시간 안에 검토되지 않으면 자동 승인돼요. 기본 24시간.
                </p>
              </Field>
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold text-[#2D5A3D]">
                반려 사유 프리셋
              </p>
              <p className="mb-2 text-[11px] text-[#8B7F75]">
                선생님이 반려할 때 빠르게 선택할 수 있는 사유 목록이에요.
              </p>
              {rejectReasons.length === 0 ? (
                <p className="rounded-lg bg-[#F5F1E8] p-3 text-[11px] text-[#8B7F75]">
                  아직 반려 사유가 없어요.
                </p>
              ) : (
                <ul className="flex flex-wrap gap-2">
                  {rejectReasons.map((r, idx) => (
                    <li
                      key={`${r}-${idx}`}
                      className="inline-flex items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-800"
                    >
                      <span>{r}</span>
                      <button
                        type="button"
                        onClick={() => removeReason(idx)}
                        aria-label={`"${r}" 삭제`}
                        className="flex h-5 w-5 items-center justify-center rounded-full text-rose-700 transition hover:bg-rose-100"
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              <div className="mt-3 flex flex-wrap gap-2">
                <input
                  type="text"
                  value={newReason}
                  onChange={(e) => setNewReason(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addReason();
                    }
                  }}
                  placeholder="반려 사유 입력"
                  aria-label="새 반려 사유"
                  className="min-w-0 flex-1 rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] px-3 py-2 text-sm text-[#2C2C2C] focus:border-[#3A7A52] focus:outline-none focus:ring-2 focus:ring-[#3A7A52]/30"
                />
                <button
                  type="button"
                  onClick={addReason}
                  disabled={!newReason.trim()}
                  className="rounded-xl border border-dashed border-[#2D5A3D] bg-white px-3 py-2 text-xs font-semibold text-[#2D5A3D] transition hover:bg-[#F5F1E8] disabled:opacity-40"
                >
                  + 추가
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Right */}
      <aside className="space-y-4">
        <div className="sticky top-4 space-y-4">
          <section className="rounded-2xl border border-[#D4E4BC] bg-[#FFF8F0] p-4 shadow-sm">
            <p className="text-[11px] font-semibold text-[#8B6F47]">
              👀 기관이 복사해 쓸 때 이렇게 보여요
            </p>
            <div className="mt-3 rounded-xl border border-[#D4E4BC] bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2">
                <span className="text-2xl" aria-hidden>
                  {icon || kindMeta.icon}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-[#2C2C2C]">
                    {title || "(제목 없음)"}
                  </p>
                  <p className="text-[10px] text-[#6B6560]">
                    🍃 자연물 찾기 · <AcornIcon size={12} /> +{defaultAcorns || 0}
                  </p>
                </div>
              </div>
              {prompt && (
                <p className="mt-3 rounded-lg bg-[#F5F1E8] p-2 text-xs text-[#2C2C2C]">
                  {prompt}
                </p>
              )}
              <ul className="mt-2 space-y-0.5 text-[11px] text-[#6B6560]">
                <li>· 사진 최소 {minPhotos || 1}장</li>
                <li>· 선생님 승인 · {slaHours || 24}시간 내 자동 승인</li>
                {rejectReasons.length > 0 && (
                  <li>· 반려 사유 {rejectReasons.length}종</li>
                )}
              </ul>
            </div>
          </section>

          <section className="sticky top-4 rounded-2xl border border-[#D4E4BC] bg-white/95 p-4 shadow-sm backdrop-blur">
            {msg && (
              <div
                role="status"
                className={`mb-3 rounded-xl border-2 px-3 py-2.5 text-center text-sm font-bold ${
                  msg.kind === "error"
                    ? "border-rose-400 bg-rose-50 text-rose-800"
                    : "border-emerald-400 bg-emerald-50 text-emerald-800"
                }`}
              >
                {msg.kind === "ok" ? "✅ " : "⚠️ "}
                {msg.text}
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => onSave(false)}
                disabled={isPending}
                className="rounded-xl border border-[#D4E4BC] bg-white px-4 py-2.5 text-sm font-bold text-[#2D5A3D] transition hover:bg-[#F5F1E8] disabled:opacity-50"
              >
                {isPending ? "💾 저장 중..." : "💾 저장(초안)"}
              </button>
              <button
                type="button"
                onClick={() => onSave(true)}
                disabled={isPending}
                className="rounded-xl bg-gradient-to-r from-[#2D5A3D] to-[#3A7A52] px-4 py-2.5 text-sm font-bold text-white shadow-md transition hover:from-[#234a30] hover:to-[#2D5A3D] disabled:opacity-50"
              >
                {isPending ? "🚀 게시 중..." : "🚀 저장 & 게시"}
              </button>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={onArchive}
                disabled={isPending}
                className="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-xs font-semibold text-zinc-600 transition hover:bg-zinc-50 disabled:opacity-50"
              >
                📦 보관
              </button>
              <button
                type="button"
                onClick={onDelete}
                disabled={isPending}
                className="rounded-xl border border-rose-200 bg-white px-4 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-50 disabled:opacity-50"
              >
                🗑 삭제
              </button>
            </div>
          </section>
        </div>
      </aside>
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
