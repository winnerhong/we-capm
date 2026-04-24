"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  MISSION_KIND_META,
  type ApprovalMode,
  type FinalRewardMissionConfig,
  type OrgMissionRow,
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

type TierDraft = {
  _uid: string;
  label: string;
  threshold: string;
  reward_desc: string;
  icon: string;
};

function newUid(): string {
  return Math.random().toString(36).slice(2, 8);
}

function parseConfig(raw: Record<string, unknown>): FinalRewardMissionConfig {
  let tiers: FinalRewardMissionConfig["tiers"] = [];
  if (Array.isArray(raw.tiers)) {
    tiers = raw.tiers.flatMap((t) => {
      if (!t || typeof t !== "object") return [];
      const o = t as Record<string, unknown>;
      if (
        typeof o.label !== "string" ||
        typeof o.reward_desc !== "string" ||
        typeof o.threshold !== "number"
      )
        return [];
      return [
        {
          label: o.label,
          reward_desc: o.reward_desc,
          threshold: o.threshold,
          icon: typeof o.icon === "string" ? o.icon : undefined,
        },
      ];
    });
  }
  const redemption_ttl_hours =
    typeof raw.redemption_ttl_hours === "number"
      ? raw.redemption_ttl_hours
      : 24;
  const scopeRaw = typeof raw.scope === "string" ? raw.scope : "QUEST_PACK";
  const scope: "QUEST_PACK" | "ALL_PACKS" =
    scopeRaw === "ALL_PACKS" ? "ALL_PACKS" : "QUEST_PACK";
  return { tiers, redemption_ttl_hours, scope };
}

export function FinalRewardOrgMissionEditor({ mission, siblings }: Props) {
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

  const [tiers, setTiers] = useState<TierDraft[]>(
    initialConfig.tiers.length > 0
      ? initialConfig.tiers.map((t) => ({
          _uid: newUid(),
          label: t.label,
          threshold: String(t.threshold),
          reward_desc: t.reward_desc,
          icon: t.icon ?? "",
        }))
      : [
          {
            _uid: newUid(),
            label: "🥉 브론즈",
            threshold: "10",
            reward_desc: "",
            icon: "🥉",
          },
        ]
  );
  const [ttlHours, setTtlHours] = useState(
    String(initialConfig.redemption_ttl_hours ?? 24)
  );
  const [scope, setScope] = useState<"QUEST_PACK" | "ALL_PACKS">(
    initialConfig.scope ?? "QUEST_PACK"
  );

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

  function addTier() {
    setTiers([
      ...tiers,
      { _uid: newUid(), label: "", threshold: "0", reward_desc: "", icon: "" },
    ]);
    markDirty();
  }
  function removeTier(uid: string) {
    if (tiers.length <= 1) return;
    setTiers(tiers.filter((t) => t._uid !== uid));
    markDirty();
  }
  function updateTier(uid: string, patch: Partial<TierDraft>) {
    setTiers(tiers.map((t) => (t._uid === uid ? { ...t, ...patch } : t)));
    markDirty();
  }

  function buildConfig(): Record<string, unknown> {
    const cleanTiers = tiers
      .map((t) => ({
        label: t.label.trim(),
        threshold: parseInt(t.threshold, 10) || 0,
        reward_desc: t.reward_desc.trim(),
        icon: t.icon.trim() || undefined,
      }))
      .filter((t) => t.label.length > 0 && t.reward_desc.length > 0)
      .sort((a, b) => a.threshold - b.threshold);

    return {
      tiers: cleanTiers,
      redemption_ttl_hours: Math.max(1, parseInt(ttlHours, 10) || 24),
      scope,
    };
  }

  function validate(): string | null {
    if (!title.trim()) return "제목을 입력해 주세요";
    const filled = tiers.filter(
      (t) => t.label.trim() && t.reward_desc.trim()
    );
    if (filled.length === 0) {
      return "최소 1개의 보상 티어를 입력해 주세요 (이름 + 설명)";
    }
    const ttl = parseInt(ttlHours, 10);
    if (!Number.isFinite(ttl) || ttl <= 0) {
      return "교환권 유효시간을 올바르게 입력해 주세요";
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
    fd.set("acorns", "0"); // 최종 보상은 0 고정
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
    if (!window.confirm("이 미션을 스탬프북에서 제거할까요?")) return;
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

  const previewTiers = [...tiers]
    .filter((t) => t.label.trim())
    .sort(
      (a, b) =>
        (parseInt(a.threshold, 10) || 0) - (parseInt(b.threshold, 10) || 0)
    );

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
            <p className="text-[11px] text-[#8B7F75]">
              최종 보상은 도토리를 지급하지 않아요. 누적 도토리로 티어
              교환권을 발급합니다.
            </p>
          </div>
        </section>

        {/* Tiers */}
        <section className="rounded-2xl border border-[#D4E4BC] bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-bold text-[#2D5A3D]">
              <span aria-hidden>🎁</span>
              <span>보상 티어</span>
            </h2>
            <button
              type="button"
              onClick={addTier}
              className="inline-flex items-center gap-1 rounded-xl border border-[#2D5A3D] bg-white px-3 py-1.5 text-xs font-bold text-[#2D5A3D] transition hover:bg-[#F5F1E8]"
            >
              + 티어 추가
            </button>
          </div>
          <ul className="space-y-3">
            {tiers.map((t, idx) => (
              <li
                key={t._uid}
                className="rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] font-semibold text-[#8B6F47]">
                    티어 {idx + 1}
                  </p>
                  <button
                    type="button"
                    onClick={() => removeTier(t._uid)}
                    disabled={tiers.length <= 1}
                    aria-label="티어 삭제"
                    className="rounded-lg border border-rose-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-rose-700 transition hover:bg-rose-50 disabled:opacity-30"
                  >
                    삭제
                  </button>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-4">
                  <Field label="아이콘" htmlFor={`icon-${t._uid}`}>
                    <input
                      id={`icon-${t._uid}`}
                      type="text"
                      value={t.icon}
                      onChange={(e) =>
                        updateTier(t._uid, { icon: e.target.value })
                      }
                      placeholder="🥇"
                      maxLength={4}
                      className={inputCls}
                    />
                  </Field>
                  <Field label="티어 이름" htmlFor={`label-${t._uid}`}>
                    <input
                      id={`label-${t._uid}`}
                      type="text"
                      value={t.label}
                      onChange={(e) =>
                        updateTier(t._uid, { label: e.target.value })
                      }
                      placeholder="골드"
                      className={inputCls}
                    />
                  </Field>
                  <Field label="달성 도토리" htmlFor={`threshold-${t._uid}`}>
                    <input
                      id={`threshold-${t._uid}`}
                      type="number"
                      inputMode="numeric"
                      min={0}
                      value={t.threshold}
                      onChange={(e) =>
                        updateTier(t._uid, { threshold: e.target.value })
                      }
                      className={inputCls}
                    />
                  </Field>
                  <Field label="보상 설명" htmlFor={`desc-${t._uid}`}>
                    <input
                      id={`desc-${t._uid}`}
                      type="text"
                      value={t.reward_desc}
                      onChange={(e) =>
                        updateTier(t._uid, { reward_desc: e.target.value })
                      }
                      placeholder="예) 간식 교환권"
                      className={inputCls}
                    />
                  </Field>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* TTL + scope */}
        <section className="rounded-2xl border border-[#D4E4BC] bg-white p-5 shadow-sm">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-[#2D5A3D]">
            <span aria-hidden>⏳</span>
            <span>교환권 옵션</span>
          </h2>
          <div className="space-y-4">
            <Field label="교환권 유효시간 (시간)" htmlFor="ttl_hours">
              <input
                id="ttl_hours"
                type="number"
                inputMode="numeric"
                min={1}
                value={ttlHours}
                onChange={(e) => {
                  setTtlHours(e.target.value);
                  markDirty();
                }}
                className={inputCls}
              />
            </Field>

            <fieldset>
              <legend className="mb-2 text-xs font-semibold text-[#2D5A3D]">
                누적 범위
              </legend>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                {(
                  [
                    {
                      value: "QUEST_PACK" as const,
                      label: "🎒 스탬프북 단위",
                      hint: "이 팩 안에서만 누적된 도토리로 판정",
                    },
                    {
                      value: "ALL_PACKS" as const,
                      label: "🌍 전체 팩 통합",
                      hint: "행사 전체 누적 도토리로 판정",
                    },
                  ]
                ).map((o) => (
                  <label
                    key={o.value}
                    className={`cursor-pointer rounded-xl border p-3 transition ${
                      scope === o.value
                        ? "border-[#2D5A3D] bg-[#E8F0E4]"
                        : "border-[#D4E4BC] bg-white hover:border-[#2D5A3D]"
                    }`}
                  >
                    <input
                      type="radio"
                      name="scope"
                      value={o.value}
                      checked={scope === o.value}
                      onChange={() => {
                        setScope(o.value);
                        markDirty();
                      }}
                      className="sr-only"
                    />
                    <p className="text-sm font-bold text-[#2D5A3D]">
                      {o.label}
                    </p>
                    <p className="text-[11px] text-[#6B6560]">{o.hint}</p>
                  </label>
                ))}
              </div>
            </fieldset>
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
                    🎁 최종 보상 ·{" "}
                    {scope === "QUEST_PACK" ? "팩 단위" : "전체 팩"}
                  </p>
                </div>
              </div>
              <ol className="mt-3 space-y-1.5">
                {previewTiers.length === 0 ? (
                  <li className="rounded-lg bg-[#F5F1E8] p-2 text-[11px] text-[#8B7F75]">
                    아직 티어가 없어요
                  </li>
                ) : (
                  previewTiers.map((t) => (
                    <li
                      key={t._uid}
                      className="flex items-center justify-between rounded-lg border border-[#D4E4BC] bg-[#FFF8F0] px-2 py-1.5"
                    >
                      <span className="flex items-center gap-1.5 text-xs font-semibold text-[#2D5A3D]">
                        <span aria-hidden>{t.icon || "🏅"}</span>
                        <span>{t.label}</span>
                      </span>
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-800">
                        <AcornIcon size={12} />
                        <span>{t.threshold}+</span>
                      </span>
                    </li>
                  ))
                )}
              </ol>
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
