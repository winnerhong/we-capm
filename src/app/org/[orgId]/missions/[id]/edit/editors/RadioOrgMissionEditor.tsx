"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  MISSION_KIND_META,
  type ApprovalMode,
  type OrgMissionRow,
  type RadioMissionConfig,
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

function parseRadioConfig(raw: Record<string, unknown>): RadioMissionConfig {
  const prompt_song =
    typeof raw.prompt_song === "string"
      ? raw.prompt_song
      : "";
  const prompt_story =
    typeof raw.prompt_story === "string"
      ? raw.prompt_story
      : "";
  const max_length =
    typeof raw.max_length === "number" && raw.max_length > 0
      ? Math.min(2000, Math.max(50, Math.floor(raw.max_length)))
      : 300;
  return { prompt_song, prompt_story, max_length };
}

export function RadioOrgMissionEditor({ mission, siblings }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const kindMeta = MISSION_KIND_META[mission.kind];

  const initialConfig = useMemo(
    () =>
      parseRadioConfig(
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
  const [promptSong, setPromptSong] = useState(initialConfig.prompt_song);
  const [promptStory, setPromptStory] = useState(initialConfig.prompt_story);
  const [maxLength, setMaxLength] = useState(String(initialConfig.max_length));

  // 공통 배포 필드
  const [unlockRule, setUnlockRule] = useState<UnlockRule>(mission.unlock_rule);
  const [unlockThreshold, setUnlockThreshold] = useState(
    mission.unlock_threshold != null ? String(mission.unlock_threshold) : "10"
  );
  const [unlockPreviousId, setUnlockPreviousId] = useState(
    mission.unlock_previous_id ?? ""
  );
  const [approvalMode, setApprovalMode] = useState<ApprovalMode>(
    mission.approval_mode
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

  function buildConfig(): Record<string, unknown> {
    return {
      prompt_song: promptSong.trim(),
      prompt_story: promptStory.trim(),
      max_length: Math.min(2000, Math.max(50, parseInt(maxLength, 10) || 300)),
    };
  }

  function validate(): string | null {
    if (!title.trim()) return "제목을 입력해 주세요";
    const n = parseInt(acorns, 10);
    if (Number.isNaN(n) || n < 0 || n > 100) {
      return "도토리는 0~100 사이 숫자여야 해요";
    }
    if (!promptSong.trim()) return "신청곡 안내 문구를 입력해 주세요";
    if (!promptStory.trim()) return "사연 안내 문구를 입력해 주세요";
    const len = parseInt(maxLength, 10);
    if (!Number.isFinite(len) || len < 50 || len > 2000) {
      return "사연 최대 글자 수는 50~2000 사이여야 해요";
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

        {/* Radio config */}
        <section className="rounded-2xl border border-[#D4E4BC] bg-white p-5 shadow-sm">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-[#2D5A3D]">
            <span aria-hidden>🎙</span>
            <span>신청곡 &amp; 사연 설정</span>
          </h2>
          <div className="space-y-4">
            <Field label="신청곡 안내 문구" htmlFor="prompt_song" required>
              <textarea
                id="prompt_song"
                rows={2}
                value={promptSong}
                onChange={(e) => {
                  setPromptSong(e.target.value);
                  markDirty();
                }}
                placeholder="예) 아이가 듣고 싶은 곡을 알려주세요"
                className={inputCls}
              />
            </Field>

            <Field label="사연 안내 문구" htmlFor="prompt_story" required>
              <textarea
                id="prompt_story"
                rows={3}
                value={promptStory}
                onChange={(e) => {
                  setPromptStory(e.target.value);
                  markDirty();
                }}
                placeholder="예) 오늘 숲에서 느낀 점을 짧게 적어주세요"
                className={inputCls}
              />
            </Field>

            <Field
              label="사연 최대 글자 수 (50~2000)"
              htmlFor="max_length"
            >
              <input
                id="max_length"
                type="number"
                inputMode="numeric"
                min={50}
                max={2000}
                value={maxLength}
                onChange={(e) => {
                  setMaxLength(e.target.value);
                  markDirty();
                }}
                className={inputCls}
              />
            </Field>
          </div>
        </section>

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
          💡 제출된 사연은 <b>토리FM 모더레이션 큐</b>에서 검토·승인 후 방송
          세션에 편성할 수 있어요.
        </p>
      </div>

      {/* Right */}
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
                    🎵 신청곡 &amp; 사연 · <AcornIcon size={12} /> +{acorns || 0}
                  </p>
                </div>
              </div>
              {promptSong && (
                <p className="mt-3 rounded-lg bg-[#F5F1E8] p-2 text-xs text-[#2C2C2C]">
                  🎙 {promptSong}
                </p>
              )}
              {promptStory && (
                <p className="mt-2 rounded-lg bg-[#FFF8F0] border border-[#D4E4BC] p-2 text-xs text-[#2C2C2C]">
                  ✏️ {promptStory}
                </p>
              )}
              <p className="mt-2 text-[10px] text-[#8B7F75]">
                최대 {maxLength || 300}자
              </p>
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
