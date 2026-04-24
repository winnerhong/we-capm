"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  MISSION_KIND_META,
  type ApprovalMode,
  type OrgMissionRow,
  type PhotoApprovalMissionConfig,
  type UnlockRule,
} from "@/lib/missions/types";
import {
  removeMissionFromPackAction,
  updateOrgMissionAction,
} from "../../../actions";
import { DeployFields, Field, inputCls, toLocalInput } from "./common-fields";
import { AcornIcon } from "@/components/acorn-icon";

type Props = {
  mission: OrgMissionRow;
  siblings: OrgMissionRow[];
};

const DEFAULT_REJECT_REASONS: string[] = [
  "사진이 흐려요",
  "미션과 관련이 없어요",
  "안전하지 않은 장면이에요",
];

function parsePhotoApprovalConfig(
  raw: Record<string, unknown>
): PhotoApprovalMissionConfig {
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

export function PhotoApprovalOrgMissionEditor({ mission, siblings }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const kindMeta = MISSION_KIND_META[mission.kind];

  const initialConfig = useMemo(
    () =>
      parsePhotoApprovalConfig(
        (mission.config_json ?? {}) as Record<string, unknown>
      ),
    [mission.config_json]
  );

  // 기본정보
  const [title, setTitle] = useState(mission.title);
  const [description, setDescription] = useState(mission.description ?? "");
  const [icon, setIcon] = useState(mission.icon ?? kindMeta.icon);
  const [acorns, setAcorns] = useState(String(mission.acorns ?? 0));

  // Config
  const [prompt, setPrompt] = useState(initialConfig.prompt);
  const [minPhotos, setMinPhotos] = useState(
    String(initialConfig.min_photos)
  );
  const [slaHours, setSlaHours] = useState(String(initialConfig.sla_hours));
  const [rejectReasons, setRejectReasons] = useState<string[]>(
    initialConfig.reject_reasons
  );
  const [newReason, setNewReason] = useState("");

  // 공통 배포 필드
  const [unlockRule, setUnlockRule] = useState<UnlockRule>(mission.unlock_rule);
  const [unlockThreshold, setUnlockThreshold] = useState(
    mission.unlock_threshold != null ? String(mission.unlock_threshold) : "10"
  );
  const [unlockPreviousId, setUnlockPreviousId] = useState(
    mission.unlock_previous_id ?? ""
  );
  const [approvalMode, setApprovalMode] = useState<ApprovalMode>(
    mission.approval_mode ?? "MANUAL_TEACHER"
  );
  const [startsAt, setStartsAt] = useState(toLocalInput(mission.starts_at));
  const [endsAt, setEndsAt] = useState(toLocalInput(mission.ends_at));
  const [isActive, setIsActive] = useState(mission.is_active);

  const [dirty, setDirty] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(
    null
  );

  function markDirty() {
    setDirty(true);
    setMsg(null);
  }

  function addReason() {
    const t = newReason.trim();
    if (!t) return;
    if (rejectReasons.includes(t)) {
      setNewReason("");
      return;
    }
    setRejectReasons([...rejectReasons, t]);
    setNewReason("");
    markDirty();
  }

  function removeReason(t: string) {
    setRejectReasons(rejectReasons.filter((r) => r !== t));
    markDirty();
  }

  function buildConfig(): Record<string, unknown> {
    return {
      prompt: prompt.trim(),
      min_photos: Math.min(5, Math.max(1, parseInt(minPhotos, 10) || 1)),
      sla_hours: Math.min(72, Math.max(1, parseInt(slaHours, 10) || 24)),
      reject_reasons: rejectReasons.map((r) => r.trim()).filter(Boolean),
    };
  }

  function validate(): string | null {
    if (!title.trim()) return "제목을 입력해 주세요";
    const n = parseInt(acorns, 10);
    if (Number.isNaN(n) || n < 0 || n > 100) {
      return "도토리는 0~100 사이 숫자여야 해요";
    }
    if (!prompt.trim()) return "미션 안내 문구를 입력해 주세요";
    if (rejectReasons.length === 0) {
      return "반려 사유를 최소 1개 이상 등록해 주세요";
    }
    if (unlockRule === "SEQUENTIAL" && !unlockPreviousId) {
      return "순차 해금에는 선행 미션을 지정해 주세요";
    }
    return null;
  }

  function onSave() {
    const err = validate();
    if (err) {
      setMsg({ kind: "error", text: err });
      return;
    }
    const fd = new FormData();
    fd.set("title", title.trim());
    fd.set("description", description.trim());
    fd.set("icon", icon.trim());
    fd.set("acorns", acorns);
    fd.set("config_json", JSON.stringify(buildConfig()));
    fd.set("unlock_rule", unlockRule);
    if (unlockRule === "TIER_GATE") fd.set("unlock_threshold", unlockThreshold);
    if (unlockRule === "SEQUENTIAL")
      fd.set("unlock_previous_id", unlockPreviousId);
    fd.set("approval_mode", approvalMode);
    fd.set("starts_at", startsAt);
    fd.set("ends_at", endsAt);
    fd.set("is_active", isActive ? "true" : "false");

    startTransition(async () => {
      try {
        await updateOrgMissionAction(mission.id, fd);
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

  function onRemove() {
    if (
      !window.confirm(
        "이 미션을 스탬프북에서 제거할까요? 편집 내용도 모두 사라집니다."
      )
    )
      return;
    startTransition(async () => {
      try {
        await removeMissionFromPackAction(mission.id);
      } catch (e) {
        setMsg({
          kind: "error",
          text: e instanceof Error ? e.message : "삭제 실패",
        });
      }
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(300px,360px)]">
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

        {/* 기본정보 */}
        <section className="rounded-2xl border border-[#D4E4BC] bg-white p-5 shadow-sm">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-[#2D5A3D]">
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
                className={inputCls}
                autoComplete="off"
                required
              />
            </Field>
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
              />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="아이콘" htmlFor="icon">
                <input
                  id="icon"
                  type="text"
                  value={icon}
                  onChange={(e) => {
                    setIcon(e.target.value);
                    markDirty();
                  }}
                  maxLength={4}
                  className={inputCls}
                />
              </Field>
              <Field label="도토리 (0~100)" htmlFor="acorns">
                <input
                  id="acorns"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={100}
                  value={acorns}
                  onChange={(e) => {
                    setAcorns(e.target.value);
                    markDirty();
                  }}
                  className={inputCls}
                />
              </Field>
            </div>
          </div>
        </section>

        {/* 승인형 사진 미션 설정 */}
        <section className="rounded-2xl border border-[#D4E4BC] bg-white p-5 shadow-sm">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-[#2D5A3D]">
            <span aria-hidden>🍃</span>
            <span>자연물 찾기 설정</span>
          </h2>
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
                placeholder="예) 가을 단풍잎을 찾아 사진을 찍어 주세요"
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
              <Field label="검토 기한 (시간, 1~72)" htmlFor="sla_hours">
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
              </Field>
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold text-[#2D5A3D]">
                반려 사유 (칩으로 관리)
              </p>
              <ul
                className="flex flex-wrap gap-2"
                aria-label="반려 사유 목록"
              >
                {rejectReasons.length === 0 && (
                  <li className="text-[11px] text-[#8B7F75]">
                    아직 등록된 사유가 없어요
                  </li>
                )}
                {rejectReasons.map((r) => (
                  <li key={r}>
                    <span className="inline-flex items-center gap-1 rounded-full border border-[#D4E4BC] bg-[#F5F1E8] px-2 py-1 text-[11px] font-semibold text-[#2D5A3D]">
                      {r}
                      <button
                        type="button"
                        onClick={() => removeReason(r)}
                        aria-label={`${r} 삭제`}
                        className="ml-1 flex h-4 w-4 items-center justify-center rounded-full bg-white text-[10px] text-rose-700 hover:bg-rose-50"
                      >
                        ×
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
              <div className="mt-2 flex gap-2">
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
                  placeholder="새 반려 사유 입력 후 Enter"
                  aria-label="새 반려 사유"
                  className={inputCls}
                />
                <button
                  type="button"
                  onClick={addReason}
                  disabled={!newReason.trim()}
                  className="shrink-0 rounded-xl border border-[#2D5A3D] bg-white px-3 py-2 text-xs font-bold text-[#2D5A3D] transition hover:bg-[#F5F1E8] disabled:opacity-40"
                >
                  + 추가
                </button>
              </div>
              <p className="mt-1 text-[11px] text-[#8B7F75]">
                승인 대기 화면에서 이 사유들을 선택해 반려할 수 있어요.
              </p>
            </div>
          </div>
        </section>

        {/* 배포 필드 공통 */}
        <DeployFields
          unlockRule={unlockRule}
          setUnlockRule={setUnlockRule}
          unlockThreshold={unlockThreshold}
          setUnlockThreshold={setUnlockThreshold}
          unlockPreviousId={unlockPreviousId}
          setUnlockPreviousId={setUnlockPreviousId}
          approvalMode={approvalMode}
          setApprovalMode={setApprovalMode}
          startsAt={startsAt}
          setStartsAt={setStartsAt}
          endsAt={endsAt}
          setEndsAt={setEndsAt}
          isActive={isActive}
          setIsActive={setIsActive}
          siblings={siblings}
          missionId={mission.id}
          markDirty={markDirty}
        />

        <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-[11px] text-amber-900">
          💡 승인형 사진 미션은 <b>선생님 검토</b> 방식을 권장해요. 자동 승인을
          고르면 제출 즉시 도토리가 지급되지만, 내용 검토는 할 수 없어요.
        </p>
      </div>

      {/* Right: 프리뷰 + 액션 */}
      <aside className="space-y-4">
        <div className="sticky top-4 space-y-4">
          <section className="rounded-2xl border border-[#D4E4BC] bg-[#FFF8F0] p-4 shadow-sm">
            <p className="text-[11px] font-semibold text-[#8B6F47]">
              👀 참가자에게는 이렇게 보여요
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
                    🍃 자연물 찾기 · <AcornIcon size={12} /> +{acorns || 0}
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
                <li>· 검토 기한 {slaHours || 24}시간</li>
                <li>· 선생님이 확인 후 도토리 지급</li>
              </ul>
            </div>
          </section>

          <section className="rounded-2xl border border-[#D4E4BC] bg-white/95 p-4 shadow-sm backdrop-blur">
            <button
              type="button"
              onClick={onSave}
              disabled={isPending}
              className="w-full rounded-xl bg-gradient-to-r from-[#2D5A3D] to-[#3A7A52] px-4 py-2.5 text-sm font-bold text-white shadow-md transition hover:from-[#234a30] hover:to-[#2D5A3D] disabled:opacity-50"
            >
              💾 저장
            </button>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled
                title="Phase 4에서 활성화"
                className="rounded-xl border border-[#D4E4BC] bg-white px-3 py-2 text-xs font-semibold text-[#6B6560] opacity-60"
              >
                💌 개선 제안
              </button>
              <button
                type="button"
                onClick={onRemove}
                disabled={isPending}
                className="rounded-xl border border-rose-200 bg-white px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-50 disabled:opacity-50"
              >
                🗑 제거
              </button>
            </div>
          </section>
        </div>
      </aside>
    </div>
  );
}
