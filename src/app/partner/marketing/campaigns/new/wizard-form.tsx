"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  GOAL_OPTIONS,
  CHANNEL_OPTIONS,
  type CampaignChannel,
  type CampaignGoal,
  type ScheduleType,
  type SegmentOption,
} from "../types";
import { createCampaignAction } from "../actions";

type TargetMode = "ALL" | "SEGMENT" | "FILTER";

type WizardState = {
  name: string;
  goal: CampaignGoal | "";
  targetMode: TargetMode;
  targetSegmentId: string;
  channels: CampaignChannel[];
  messageTitle: string;
  messageBody: string;
  messageCtaUrl: string;
  scheduleType: ScheduleType;
  scheduledAt: string;
  recurringFreq: "WEEKLY" | "MONTHLY";
};

const STEP_LABELS = [
  "목표",
  "타겟",
  "채널",
  "메시지",
  "시점",
  "검토",
];

export function WizardForm({ segments }: { segments: SegmentOption[] }) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [state, setState] = useState<WizardState>({
    name: "",
    goal: "",
    targetMode: "ALL",
    targetSegmentId: "",
    channels: [],
    messageTitle: "",
    messageBody: "",
    messageCtaUrl: "",
    scheduleType: "IMMEDIATE",
    scheduledAt: "",
    recurringFreq: "WEEKLY",
  });

  const update = <K extends keyof WizardState>(k: K, v: WizardState[K]) =>
    setState((prev) => ({ ...prev, [k]: v }));

  const toggleChannel = (ch: CampaignChannel) => {
    setState((prev) => ({
      ...prev,
      channels: prev.channels.includes(ch)
        ? prev.channels.filter((c) => c !== ch)
        : [...prev.channels, ch],
    }));
  };

  const targetSegment = useMemo(
    () => segments.find((s) => s.id === state.targetSegmentId) ?? null,
    [segments, state.targetSegmentId]
  );

  // 단계별 검증
  const canNext = useMemo(() => {
    if (step === 1) return state.goal !== "";
    if (step === 2) {
      if (state.targetMode === "SEGMENT") return !!state.targetSegmentId;
      return true;
    }
    if (step === 3) return state.channels.length > 0;
    if (step === 4)
      return state.messageTitle.trim() !== "" && state.messageBody.trim() !== "";
    if (step === 5) {
      if (state.scheduleType === "SCHEDULED") return !!state.scheduledAt;
      return state.scheduleType !== "RECURRING"; // 정기는 준비중이라 진행 불가
    }
    return true;
  }, [step, state]);

  const buildFormData = (statusHint: "DRAFT" | "SUBMIT"): FormData => {
    const fd = new FormData();
    // 이름: 미입력 시 메시지 제목 사용, 그것도 비면 목표+날짜
    const autoName =
      state.name.trim() ||
      state.messageTitle.trim() ||
      `${state.goal || "CAMPAIGN"} - ${new Date().toLocaleDateString("ko-KR")}`;
    fd.append("name", autoName);
    fd.append("goal", state.goal);
    if (state.targetMode === "SEGMENT" && state.targetSegmentId) {
      fd.append("target_segment_id", state.targetSegmentId);
    }
    for (const ch of state.channels) fd.append("channels", ch);
    fd.append("message_title", state.messageTitle);
    fd.append("message_body", state.messageBody);
    if (state.messageCtaUrl) fd.append("message_cta_url", state.messageCtaUrl);
    fd.append("schedule_type", state.scheduleType);
    if (state.scheduleType === "SCHEDULED" && state.scheduledAt) {
      fd.append("scheduled_at", state.scheduledAt);
    }
    // statusHint는 추후 확장용 (create는 항상 DRAFT, 상세에서 send/schedule)
    void statusHint;
    return fd;
  };

  const submit = (mode: "DRAFT" | "SUBMIT") => {
    setError(null);
    const fd = buildFormData(mode);
    startTransition(async () => {
      try {
        await createCampaignAction(fd);
        // redirect는 서버에서 처리되어 예외처럼 throw됨
      } catch (err: unknown) {
        // Next의 redirect는 NEXT_REDIRECT 에러로 전달됨 — 그 경우는 무시
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("NEXT_REDIRECT")) {
          return;
        }
        setError(msg || "알 수 없는 오류가 발생했어요");
      }
    });
  };

  const goNext = () => {
    if (!canNext) return;
    if (step < 6) setStep(step + 1);
  };
  const goPrev = () => {
    if (step > 1) setStep(step - 1);
  };

  // 미리보기용 변수 치환 (간이)
  const previewBody = state.messageBody
    .replace(/\{이름\}/g, "홍길동")
    .replace(/\{회사명\}/g, "토리로 숲");

  const channelCostHint = useMemo(() => {
    const pricePerUnit: Record<CampaignChannel, number> = {
      SMS: 20,
      KAKAO: 15,
      EMAIL: 3,
      PUSH: 0,
    };
    const count =
      state.targetMode === "SEGMENT"
        ? targetSegment?.member_count ?? 0
        : 0; // 전체 타겟은 서버 집계
    const totalPerMsg = state.channels.reduce(
      (sum, ch) => sum + pricePerUnit[ch],
      0
    );
    return {
      perMsg: totalPerMsg,
      estimated: totalPerMsg * count,
      count,
    };
  }, [state.channels, state.targetMode, targetSegment]);

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      {/* Progress bar */}
      <div className="rounded-2xl border border-[#D4E4BC] bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-1">
          {STEP_LABELS.map((label, idx) => {
            const n = idx + 1;
            const active = n === step;
            const done = n < step;
            return (
              <div
                key={label}
                className="flex flex-1 flex-col items-center gap-1"
              >
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition ${
                    active
                      ? "bg-[#2D5A3D] text-white shadow"
                      : done
                      ? "bg-[#4A7C59] text-white"
                      : "bg-[#D4E4BC] text-[#6B6560]"
                  }`}
                  aria-current={active ? "step" : undefined}
                >
                  {done ? "✓" : n}
                </div>
                <div
                  className={`text-[10px] font-semibold ${
                    active ? "text-[#2D5A3D]" : "text-[#6B6560]"
                  }`}
                >
                  {label}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700"
        >
          ⚠️ {error}
        </div>
      )}

      {/* STEP 1: 목표 */}
      {step === 1 && (
        <div className="space-y-4 rounded-2xl border border-[#D4E4BC] bg-white p-6 shadow-sm">
          <div>
            <h2 className="text-lg font-bold text-[#2D5A3D]">
              🎯 캠페인 목표를 정해주세요
            </h2>
            <p className="mt-1 text-xs text-[#6B6560]">
              목표에 맞춰 다음 단계가 자동으로 추천됩니다.
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {GOAL_OPTIONS.map((opt) => {
              const active = state.goal === opt.key;
              return (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => update("goal", opt.key as CampaignGoal)}
                  className={`rounded-2xl border p-4 text-left transition ${
                    active
                      ? "border-[#2D5A3D] bg-[#F5F1E8] ring-2 ring-[#2D5A3D]/30"
                      : "border-[#D4E4BC] bg-white hover:border-[#4A7C59]"
                  }`}
                  aria-pressed={active}
                >
                  <div className="text-base font-bold text-[#2C2C2C]">
                    {opt.label}
                  </div>
                  <div className="mt-1 text-xs text-[#6B6560]">{opt.desc}</div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* STEP 2: 타겟 */}
      {step === 2 && (
        <div className="space-y-4 rounded-2xl border border-[#D4E4BC] bg-white p-6 shadow-sm">
          <div>
            <h2 className="text-lg font-bold text-[#2D5A3D]">
              👥 누구에게 보낼까요?
            </h2>
            <p className="mt-1 text-xs text-[#6B6560]">
              세그먼트를 사용하면 더 정확한 타겟팅이 가능해요.
            </p>
          </div>

          <div className="space-y-2">
            <label
              className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition ${
                state.targetMode === "ALL"
                  ? "border-[#2D5A3D] bg-[#F5F1E8]"
                  : "border-[#D4E4BC] bg-white hover:border-[#4A7C59]"
              }`}
            >
              <input
                type="radio"
                name="targetMode"
                value="ALL"
                checked={state.targetMode === "ALL"}
                onChange={() => update("targetMode", "ALL")}
                className="mt-1"
              />
              <div>
                <div className="text-sm font-bold text-[#2C2C2C]">
                  🌍 전체 고객
                </div>
                <div className="text-xs text-[#6B6560]">
                  등록된 모든 고객에게 발송
                </div>
              </div>
            </label>

            <label
              className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition ${
                state.targetMode === "SEGMENT"
                  ? "border-[#2D5A3D] bg-[#F5F1E8]"
                  : "border-[#D4E4BC] bg-white hover:border-[#4A7C59]"
              }`}
            >
              <input
                type="radio"
                name="targetMode"
                value="SEGMENT"
                checked={state.targetMode === "SEGMENT"}
                onChange={() => update("targetMode", "SEGMENT")}
                className="mt-1"
              />
              <div className="flex-1">
                <div className="text-sm font-bold text-[#2C2C2C]">
                  🎯 세그먼트 선택
                </div>
                <div className="text-xs text-[#6B6560]">
                  미리 만들어 둔 세그먼트로 타겟팅
                </div>

                {state.targetMode === "SEGMENT" && (
                  <div className="mt-3">
                    {segments.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-[#D4E4BC] bg-[#FFF8F0] p-3 text-center text-xs text-[#6B6560]">
                        아직 세그먼트가 없어요.{" "}
                        <Link
                          href="/partner/customers/segments/new"
                          className="font-semibold text-[#2D5A3D] hover:underline"
                        >
                          만들러 가기 →
                        </Link>
                      </div>
                    ) : (
                      <select
                        value={state.targetSegmentId}
                        onChange={(e) =>
                          update("targetSegmentId", e.target.value)
                        }
                        className="w-full rounded-lg border border-[#D4E4BC] bg-white px-3 py-2 text-sm focus:border-[#2D5A3D] focus:outline-none focus:ring-2 focus:ring-[#2D5A3D]/20"
                        aria-label="세그먼트 선택"
                      >
                        <option value="">세그먼트를 선택하세요</option>
                        {segments.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.icon ?? "🎯"} {s.name} ({s.member_count ?? 0}명)
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                )}
              </div>
            </label>

            <label
              className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition ${
                state.targetMode === "FILTER"
                  ? "border-[#2D5A3D] bg-[#F5F1E8]"
                  : "border-[#D4E4BC] bg-white hover:border-[#4A7C59]"
              }`}
            >
              <input
                type="radio"
                name="targetMode"
                value="FILTER"
                checked={state.targetMode === "FILTER"}
                onChange={() => update("targetMode", "FILTER")}
                className="mt-1"
              />
              <div>
                <div className="text-sm font-bold text-[#2C2C2C]">
                  🛠️ 즉석 필터
                </div>
                <div className="text-xs text-[#6B6560]">
                  준비 중 — 곧 추가될 기능이에요
                </div>
              </div>
            </label>
          </div>
        </div>
      )}

      {/* STEP 3: 채널 */}
      {step === 3 && (
        <div className="space-y-4 rounded-2xl border border-[#D4E4BC] bg-white p-6 shadow-sm">
          <div>
            <h2 className="text-lg font-bold text-[#2D5A3D]">
              📡 어떤 채널로 보낼까요?
            </h2>
            <p className="mt-1 text-xs text-[#6B6560]">
              여러 채널을 선택하면 도달률이 올라가지만 비용도 늘어요.
            </p>
          </div>

          <div className="grid gap-2 md:grid-cols-2">
            {CHANNEL_OPTIONS.map((opt) => {
              const active = state.channels.includes(
                opt.key as CampaignChannel
              );
              return (
                <label
                  key={opt.key}
                  className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition ${
                    active
                      ? "border-[#2D5A3D] bg-[#F5F1E8]"
                      : "border-[#D4E4BC] bg-white hover:border-[#4A7C59]"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={active}
                    onChange={() =>
                      toggleChannel(opt.key as CampaignChannel)
                    }
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-1.5 text-sm font-bold text-[#2C2C2C]">
                      <span className="text-base">{opt.icon}</span>
                      <span>{opt.label}</span>
                    </div>
                    <div className="mt-0.5 text-xs text-[#6B6560]">
                      요금: {opt.cost}
                    </div>
                  </div>
                </label>
              );
            })}
          </div>

          {state.channels.length > 0 && (
            <div className="rounded-xl bg-[#FFF8F0] p-3 text-xs text-[#6B6560]">
              💡 선택한 채널 합산 건당 비용:{" "}
              <span className="font-bold text-[#2D5A3D]">
                {channelCostHint.perMsg}원
              </span>
              {channelCostHint.count > 0 && (
                <>
                  {" · "}
                  예상 총액:{" "}
                  <span className="font-bold text-[#2D5A3D]">
                    {channelCostHint.estimated.toLocaleString("ko-KR")}원
                  </span>{" "}
                  ({channelCostHint.count}명)
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* STEP 4: 메시지 */}
      {step === 4 && (
        <div className="space-y-4 rounded-2xl border border-[#D4E4BC] bg-white p-6 shadow-sm">
          <div>
            <h2 className="text-lg font-bold text-[#2D5A3D]">
              💬 메시지를 작성해주세요
            </h2>
            <p className="mt-1 text-xs text-[#6B6560]">
              변수: <code className="rounded bg-[#F5F1E8] px-1">{`{이름}`}</code>,{" "}
              <code className="rounded bg-[#F5F1E8] px-1">{`{회사명}`}</code>
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-3">
              <div>
                <label
                  htmlFor="campaign_name"
                  className="text-xs font-semibold text-[#2D5A3D]"
                >
                  캠페인 이름 (선택)
                </label>
                <input
                  id="campaign_name"
                  type="text"
                  value={state.name}
                  onChange={(e) => update("name", e.target.value)}
                  placeholder="비우면 자동 생성돼요"
                  className="mt-1 w-full rounded-lg border border-[#D4E4BC] bg-white px-3 py-2 text-sm focus:border-[#2D5A3D] focus:outline-none focus:ring-2 focus:ring-[#2D5A3D]/20"
                />
              </div>
              <div>
                <label
                  htmlFor="msg_title"
                  className="text-xs font-semibold text-[#2D5A3D]"
                >
                  제목 *
                </label>
                <input
                  id="msg_title"
                  type="text"
                  value={state.messageTitle}
                  onChange={(e) => update("messageTitle", e.target.value)}
                  placeholder="🌲 이번 주말 숲체험 오픈!"
                  required
                  className="mt-1 w-full rounded-lg border border-[#D4E4BC] bg-white px-3 py-2 text-sm focus:border-[#2D5A3D] focus:outline-none focus:ring-2 focus:ring-[#2D5A3D]/20"
                />
              </div>
              <div>
                <label
                  htmlFor="msg_body"
                  className="text-xs font-semibold text-[#2D5A3D]"
                >
                  본문 *
                </label>
                <textarea
                  id="msg_body"
                  value={state.messageBody}
                  onChange={(e) => update("messageBody", e.target.value)}
                  rows={6}
                  placeholder={"안녕하세요 {이름}님! 토리로 숲에서 새로운 프로그램이 오픈됐어요. 지금 확인해보세요 🌿"}
                  required
                  className="mt-1 w-full rounded-lg border border-[#D4E4BC] bg-white px-3 py-2 text-sm focus:border-[#2D5A3D] focus:outline-none focus:ring-2 focus:ring-[#2D5A3D]/20"
                />
              </div>
              <div>
                <label
                  htmlFor="msg_cta"
                  className="text-xs font-semibold text-[#2D5A3D]"
                >
                  CTA URL (선택)
                </label>
                <input
                  id="msg_cta"
                  type="url"
                  inputMode="url"
                  value={state.messageCtaUrl}
                  onChange={(e) => update("messageCtaUrl", e.target.value)}
                  placeholder="https://..."
                  className="mt-1 w-full rounded-lg border border-[#D4E4BC] bg-white px-3 py-2 text-sm focus:border-[#2D5A3D] focus:outline-none focus:ring-2 focus:ring-[#2D5A3D]/20"
                />
              </div>
            </div>

            {/* 미리보기 */}
            <div className="rounded-xl border border-[#D4E4BC] bg-[#F5F1E8] p-4">
              <div className="mb-2 text-[10px] font-bold uppercase tracking-wide text-[#6B6560]">
                📱 미리보기
              </div>
              <div className="rounded-xl border border-[#D4E4BC] bg-white p-3 shadow-sm">
                <div className="text-sm font-bold text-[#2C2C2C]">
                  {state.messageTitle || "제목을 입력하세요"}
                </div>
                <div className="mt-2 whitespace-pre-wrap text-xs text-[#2C2C2C]">
                  {previewBody || "본문을 입력하세요..."}
                </div>
                {state.messageCtaUrl && (
                  <button
                    type="button"
                    disabled
                    className="mt-3 w-full rounded-lg bg-[#2D5A3D] px-3 py-2 text-xs font-bold text-white opacity-80"
                  >
                    자세히 보기 →
                  </button>
                )}
              </div>
              <p className="mt-3 text-[10px] text-[#6B6560]">
                * 변수 {`{이름}`}은 홍길동으로 샘플 표시됩니다
              </p>
            </div>
          </div>
        </div>
      )}

      {/* STEP 5: 시점 */}
      {step === 5 && (
        <div className="space-y-4 rounded-2xl border border-[#D4E4BC] bg-white p-6 shadow-sm">
          <div>
            <h2 className="text-lg font-bold text-[#2D5A3D]">
              ⏰ 언제 보낼까요?
            </h2>
            <p className="mt-1 text-xs text-[#6B6560]">
              즉시 또는 원하는 시간에 예약할 수 있어요.
            </p>
          </div>

          <div className="space-y-2">
            <label
              className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition ${
                state.scheduleType === "IMMEDIATE"
                  ? "border-[#2D5A3D] bg-[#F5F1E8]"
                  : "border-[#D4E4BC] bg-white hover:border-[#4A7C59]"
              }`}
            >
              <input
                type="radio"
                name="scheduleType"
                checked={state.scheduleType === "IMMEDIATE"}
                onChange={() => update("scheduleType", "IMMEDIATE")}
                className="mt-1"
              />
              <div>
                <div className="text-sm font-bold text-[#2C2C2C]">
                  🚀 즉시 발송
                </div>
                <div className="text-xs text-[#6B6560]">
                  지금 바로 보냅니다
                </div>
              </div>
            </label>

            <label
              className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition ${
                state.scheduleType === "SCHEDULED"
                  ? "border-[#2D5A3D] bg-[#F5F1E8]"
                  : "border-[#D4E4BC] bg-white hover:border-[#4A7C59]"
              }`}
            >
              <input
                type="radio"
                name="scheduleType"
                checked={state.scheduleType === "SCHEDULED"}
                onChange={() => update("scheduleType", "SCHEDULED")}
                className="mt-1"
              />
              <div className="flex-1">
                <div className="text-sm font-bold text-[#2C2C2C]">
                  📅 예약 발송
                </div>
                <div className="text-xs text-[#6B6560]">
                  원하는 시간에 자동 발송
                </div>
                {state.scheduleType === "SCHEDULED" && (
                  <input
                    type="datetime-local"
                    value={state.scheduledAt}
                    onChange={(e) => update("scheduledAt", e.target.value)}
                    className="mt-2 w-full rounded-lg border border-[#D4E4BC] bg-white px-3 py-2 text-sm focus:border-[#2D5A3D] focus:outline-none focus:ring-2 focus:ring-[#2D5A3D]/20"
                    aria-label="예약 시각"
                  />
                )}
              </div>
            </label>

            <label
              className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 opacity-60 transition`}
            >
              <input
                type="radio"
                name="scheduleType"
                checked={state.scheduleType === "RECURRING"}
                onChange={() => update("scheduleType", "RECURRING")}
                className="mt-1"
                disabled
              />
              <div>
                <div className="text-sm font-bold text-[#2C2C2C]">
                  🔄 정기 발송
                </div>
                <div className="text-xs text-[#6B6560]">
                  주간/월간 자동 발송 · 준비 중
                </div>
              </div>
            </label>
          </div>
        </div>
      )}

      {/* STEP 6: 검토 */}
      {step === 6 && (
        <div className="space-y-4 rounded-2xl border border-[#D4E4BC] bg-white p-6 shadow-sm">
          <div>
            <h2 className="text-lg font-bold text-[#2D5A3D]">
              📝 마지막으로 확인해주세요
            </h2>
            <p className="mt-1 text-xs text-[#6B6560]">
              모든 항목이 맞다면 발송 또는 예약하세요.
            </p>
          </div>

          <dl className="divide-y divide-[#D4E4BC] rounded-xl border border-[#D4E4BC] bg-[#FFF8F0]">
            <Row label="🎯 목표">
              {GOAL_OPTIONS.find((g) => g.key === state.goal)?.label ?? "-"}
            </Row>
            <Row label="👥 타겟">
              {state.targetMode === "ALL"
                ? "🌍 전체 고객"
                : state.targetMode === "SEGMENT"
                ? `🎯 ${targetSegment?.name ?? "-"} (${
                    targetSegment?.member_count ?? 0
                  }명)`
                : "🛠️ 즉석 필터"}
            </Row>
            <Row label="📡 채널">
              {state.channels.length > 0
                ? state.channels.join(", ")
                : "선택 안됨"}
            </Row>
            <Row label="💬 제목">{state.messageTitle || "-"}</Row>
            <Row label="📄 본문">
              <span className="line-clamp-3 whitespace-pre-wrap">
                {state.messageBody || "-"}
              </span>
            </Row>
            {state.messageCtaUrl && (
              <Row label="🔗 CTA">{state.messageCtaUrl}</Row>
            )}
            <Row label="⏰ 시점">
              {state.scheduleType === "IMMEDIATE"
                ? "🚀 즉시 발송"
                : state.scheduleType === "SCHEDULED"
                ? `📅 ${state.scheduledAt || "-"}`
                : "🔄 정기 발송"}
            </Row>
          </dl>

          <div className="flex flex-col gap-2 pt-2 sm:flex-row">
            <button
              type="button"
              onClick={() => submit("SUBMIT")}
              disabled={isPending}
              className="flex-1 rounded-xl bg-[#2D5A3D] px-4 py-3 text-base font-bold text-white shadow transition hover:bg-[#4A7C59] disabled:opacity-60"
            >
              {isPending ? "저장 중..." : "💌 캠페인 저장하기"}
            </button>
          </div>
          <p className="text-center text-[10px] text-[#6B6560]">
            * 초안으로 저장되며, 상세 화면에서 발송 또는 예약할 수 있어요.
          </p>
        </div>
      )}

      {/* 네비 */}
      {step < 6 && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={goPrev}
            disabled={step === 1}
            className="rounded-xl border border-[#D4E4BC] bg-white px-4 py-2 text-sm font-semibold text-[#6B6560] transition hover:border-[#2D5A3D] hover:text-[#2D5A3D] disabled:opacity-40"
          >
            ← 이전
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => submit("DRAFT")}
              disabled={isPending}
              className="rounded-xl border border-[#D4E4BC] bg-white px-4 py-2 text-sm font-semibold text-[#6B6560] transition hover:border-[#2D5A3D] hover:text-[#2D5A3D] disabled:opacity-60"
            >
              {isPending ? "..." : "📄 초안 저장"}
            </button>
            <button
              type="button"
              onClick={goNext}
              disabled={!canNext}
              className="rounded-xl bg-[#2D5A3D] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#4A7C59] disabled:opacity-40"
            >
              다음 →
            </button>
          </div>
        </div>
      )}

      {step === 6 && (
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={goPrev}
            className="rounded-xl border border-[#D4E4BC] bg-white px-4 py-2 text-sm font-semibold text-[#6B6560] transition hover:border-[#2D5A3D] hover:text-[#2D5A3D]"
          >
            ← 이전
          </button>
          <button
            type="button"
            onClick={() => router.push("/partner/marketing/campaigns")}
            className="rounded-xl border border-[#D4E4BC] bg-white px-4 py-2 text-sm font-semibold text-[#6B6560] transition hover:border-rose-400 hover:text-rose-600"
          >
            취소
          </button>
        </div>
      )}
    </div>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1 p-3 text-sm sm:flex-row sm:items-start sm:gap-4">
      <dt className="min-w-24 font-semibold text-[#6B6560]">{label}</dt>
      <dd className="flex-1 text-[#2C2C2C]">{children}</dd>
    </div>
  );
}
