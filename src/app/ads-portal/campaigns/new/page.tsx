"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import {
  createCampaignAction,
  type CampaignPlacement,
  type CampaignPortal,
} from "../actions";

type Objective = "AWARENESS" | "TRAFFIC" | "CONVERSION" | "ENGAGEMENT";

type PortalDef = {
  value: CampaignPortal;
  icon: string;
  name: string;
  audience: string;
  reach: string;
  tone: string;
};

type PlacementDef = {
  value: CampaignPlacement;
  label: string;
  desc: string;
  icon: string;
};

const OBJECTIVES: {
  value: Objective;
  icon: string;
  label: string;
  desc: string;
}[] = [
  {
    value: "AWARENESS",
    icon: "🌟",
    label: "브랜드 인지",
    desc: "노출을 극대화해 브랜드를 널리 알려요",
  },
  {
    value: "TRAFFIC",
    icon: "🚶",
    label: "트래픽 유입",
    desc: "웹사이트·앱 방문자 수를 늘려요",
  },
  {
    value: "CONVERSION",
    icon: "🎯",
    label: "전환",
    desc: "구매·가입 등 실제 액션을 유도해요",
  },
  {
    value: "ENGAGEMENT",
    icon: "💬",
    label: "참여",
    desc: "댓글·공유·좋아요 참여를 이끌어내요",
  },
];

const PORTALS: PortalDef[] = [
  {
    value: "FAMILY",
    icon: "👨‍👩‍👧",
    name: "가족 앱",
    audience: "2030·3040 부모",
    reach: "일 2만+ 가족",
    tone: "from-rose-50 to-white border-rose-200",
  },
  {
    value: "ORG",
    icon: "🏫",
    name: "기관 포털",
    audience: "유치원·학교·교육기관",
    reach: "300+ 기관 운영진",
    tone: "from-sky-50 to-white border-sky-200",
  },
  {
    value: "PARTNER",
    icon: "🏡",
    name: "업체 앱",
    audience: "캠핑장·체험장 등 파트너",
    reach: "500+ 숲지기",
    tone: "from-amber-50 to-white border-amber-200",
  },
  {
    value: "TALK",
    icon: "🌲",
    name: "토리톡",
    audience: "전 사용자 채팅 진입점",
    reach: "전 사용자 공통",
    tone: "from-violet-50 to-white border-violet-200",
  },
];

const REGIONS = [
  "전국",
  "서울",
  "경기",
  "인천",
  "강원",
  "충청",
  "전라",
  "경상",
  "제주",
];

const AGE_GROUPS = [
  { value: "ALL", label: "전체" },
  { value: "2030", label: "2030" },
  { value: "3040", label: "3040" },
  { value: "4050", label: "4050" },
  { value: "5060+", label: "5060+" },
];

const PLACEMENTS: PlacementDef[] = [
  { value: "BANNER", label: "배너", desc: "상단/하단 가로형 배너", icon: "🟦" },
  { value: "CARD", label: "카드", desc: "피드 내 카드형 광고", icon: "🃏" },
  { value: "INLINE", label: "인라인", desc: "콘텐츠 사이 자연 노출", icon: "📄" },
  { value: "POPUP", label: "팝업", desc: "중요 고지·프로모션", icon: "💥" },
];

const STEP_LABELS = [
  "목적",
  "타겟 포털",
  "광고 소재",
  "타겟팅",
  "예산·기간",
  "확인 & 제출",
];

type FormState = {
  objective: Objective;
  target_portal: CampaignPortal | "";
  title: string;
  description: string;
  creative_url: string;
  cta_label: string;
  target_region: string;
  target_age_group: string;
  placement: CampaignPlacement;
  budget: string;
  start_date: string;
  end_date: string;
};

function isoLocalDate(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const DEFAULT_STATE: FormState = {
  objective: "AWARENESS",
  target_portal: "",
  title: "",
  description: "",
  creative_url: "",
  cta_label: "자세히 보기",
  target_region: "전국",
  target_age_group: "ALL",
  placement: "BANNER",
  budget: "1000000",
  start_date: isoLocalDate(1),
  end_date: isoLocalDate(15),
};

function daysBetween(start: string, end: string): number {
  if (!start || !end) return 0;
  const s = new Date(start);
  const e = new Date(end);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return 0;
  const ms = e.getTime() - s.getTime();
  return Math.max(0, Math.round(ms / (1000 * 60 * 60 * 24)) + 1);
}

function formatWon(n: number): string {
  return `${Math.round(n).toLocaleString("ko-KR")}원`;
}

export default function NewCampaignWizardPage() {
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5 | 6>(1);
  const [state, setState] = useState<FormState>(DEFAULT_STATE);
  const [isPending, startTransition] = useTransition();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const selectedPortal = useMemo(
    () => PORTALS.find((p) => p.value === state.target_portal),
    [state.target_portal]
  );

  const selectedObjective = useMemo(
    () => OBJECTIVES.find((o) => o.value === state.objective) ?? OBJECTIVES[0],
    [state.objective]
  );

  const budgetNum = Number(state.budget) || 0;
  const campaignDays = daysBetween(state.start_date, state.end_date);
  const dailyBudget = campaignDays > 0 ? budgetNum / campaignDays : 0;
  // Mock CPM = 5,000원 / 1,000 impressions, CTR 가정 1.2%
  const MOCK_CPM = 5000;
  const estImpressions =
    budgetNum > 0 ? Math.round((budgetNum / MOCK_CPM) * 1000) : 0;
  const estClicks = Math.round(estImpressions * 0.012);

  const canNext: boolean = (() => {
    if (step === 1) return Boolean(state.objective);
    if (step === 2) return Boolean(state.target_portal);
    if (step === 3) return state.title.trim().length > 0;
    if (step === 4) return Boolean(state.placement);
    if (step === 5) {
      return (
        budgetNum > 0 &&
        Boolean(state.start_date) &&
        Boolean(state.end_date) &&
        campaignDays > 0
      );
    }
    return true;
  })();

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setState((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit() {
    if (!state.target_portal) {
      setSubmitError("타겟 포털을 선택해 주세요");
      return;
    }
    setSubmitError(null);

    const fd = new FormData();
    fd.set("title", state.title);
    fd.set("description", state.description);
    fd.set("creative_url", state.creative_url);
    fd.set("target_portal", state.target_portal);
    fd.set("target_region", state.target_region);
    fd.set("target_age_group", state.target_age_group);
    fd.set("placement", state.placement);
    fd.set("budget", String(budgetNum));
    fd.set("start_date", state.start_date);
    fd.set("end_date", state.end_date);

    startTransition(async () => {
      try {
        await createCampaignAction(fd);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "제출 중 오류가 발생했어요";
        if (!/NEXT_REDIRECT/i.test(msg)) {
          setSubmitError(msg);
        } else {
          throw e;
        }
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav aria-label="breadcrumb" className="text-xs text-[#8B7F75]">
        <Link href="/ads-portal/dashboard" className="hover:text-[#2D5A3D]">
          대시보드
        </Link>
        <span className="mx-2">/</span>
        <Link href="/ads-portal/campaigns" className="hover:text-[#2D5A3D]">
          캠페인
        </Link>
        <span className="mx-2">/</span>
        <span className="font-semibold text-[#2D5A3D]">새 캠페인</span>
      </nav>

      {/* Header */}
      <header className="rounded-3xl border border-[#E8C9A0] bg-gradient-to-br from-[#FAE7D0] via-white to-[#E8F0E4] p-5 shadow-sm md:p-7">
        <div className="flex items-center gap-3">
          <span className="text-3xl" aria-hidden>
            ✨
          </span>
          <div>
            <h1 className="text-xl font-bold text-[#2D5A3D] md:text-2xl">
              새 캠페인 만들기
            </h1>
            <p className="mt-1 text-xs text-[#6B6560] md:text-sm">
              6단계로 쉽게 만들고, 관리자 승인 후 노출이 시작돼요.
            </p>
          </div>
        </div>
      </header>

      {/* Progress */}
      <div aria-label="진행 단계" className="space-y-3">
        <div className="flex items-center justify-between text-xs font-semibold text-[#6B6560]">
          <span>
            단계 <span className="text-[#2D5A3D]">{step}</span> / 6
          </span>
          <span className="text-[#8B5E3C]">{STEP_LABELS[step - 1]}</span>
        </div>
        <div
          className="flex gap-1.5"
          role="progressbar"
          aria-valuenow={step}
          aria-valuemin={1}
          aria-valuemax={6}
        >
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className={`h-2 flex-1 rounded-full transition-all ${
                i <= step
                  ? "bg-gradient-to-r from-[#C4956A] to-[#2D5A3D]"
                  : "bg-[#F1EDE7]"
              }`}
              aria-hidden
            />
          ))}
        </div>
        <ol className="grid grid-cols-6 gap-1 text-[9px] md:text-[11px]">
          {STEP_LABELS.map((label, idx) => (
            <li
              key={label}
              className={`text-center leading-tight ${
                idx + 1 === step
                  ? "font-bold text-[#2D5A3D]"
                  : idx + 1 < step
                    ? "font-semibold text-[#8B5E3C]"
                    : "text-[#B5AFA8]"
              }`}
            >
              {label}
            </li>
          ))}
        </ol>
      </div>

      {/* Step Panel */}
      <section className="rounded-3xl border border-[#E8C9A0] bg-white p-5 shadow-sm md:p-6">
        {/* Step 1 — 목적 */}
        {step === 1 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-base font-bold text-[#2D5A3D] md:text-lg">
                어떤 목표로 광고를 집행하시나요?
              </h2>
              <p className="mt-1 text-xs text-[#6B6560]">
                목적에 따라 최적화 방식이 달라져요.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {OBJECTIVES.map((o) => {
                const selected = state.objective === o.value;
                return (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => setField("objective", o.value)}
                    aria-pressed={selected}
                    className={`rounded-2xl border p-4 text-left transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2D5A3D]/40 ${
                      selected
                        ? "border-[#2D5A3D] bg-[#F5F9EF] shadow-md"
                        : "border-[#E5D3B8] bg-white hover:border-[#C4956A] hover:shadow-sm"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-3xl flex-shrink-0" aria-hidden>
                        {o.icon}
                      </span>
                      <div className="min-w-0">
                        <p
                          className={`text-sm font-bold ${
                            selected ? "text-[#2D5A3D]" : "text-[#6B4423]"
                          }`}
                        >
                          {o.label}
                        </p>
                        <p className="mt-1 text-xs text-[#6B6560] leading-relaxed">
                          {o.desc}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Step 2 — 타겟 포털 */}
        {step === 2 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-base font-bold text-[#2D5A3D] md:text-lg">
                어느 포털에 노출할까요?
              </h2>
              <p className="mt-1 text-xs text-[#6B6560]">
                숲속 4면 중 한 곳을 선택하세요. (복수 선택은 Stage 3에서 지원)
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {PORTALS.map((p) => {
                const selected = state.target_portal === p.value;
                return (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => setField("target_portal", p.value)}
                    aria-pressed={selected}
                    className={`rounded-2xl border bg-gradient-to-br ${p.tone} p-4 text-left transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2D5A3D]/40 ${
                      selected
                        ? "border-[#2D5A3D] shadow-md ring-2 ring-[#2D5A3D]/30"
                        : "hover:shadow-sm"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-3xl flex-shrink-0" aria-hidden>
                        {p.icon}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-[#2D5A3D]">
                          {p.name}
                        </p>
                        <p className="mt-0.5 text-xs text-[#6B6560]">
                          {p.audience}
                        </p>
                        <p className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-white/70 px-2 py-0.5 text-[10px] font-semibold text-[#8B5E3C] border border-[#E5D3B8]">
                          📊 {p.reach}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Step 3 — 광고 소재 */}
        {step === 3 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-base font-bold text-[#2D5A3D] md:text-lg">
                광고 소재를 입력하세요
              </h2>
              <p className="mt-1 text-xs text-[#6B6560]">
                사용자에게 보여질 문구와 이미지예요.
              </p>
            </div>
            <div className="space-y-3">
              <div>
                <label
                  htmlFor="campaign-title"
                  className="block text-xs font-semibold text-[#2D5A3D] mb-1"
                >
                  캠페인 제목 <span className="text-rose-600">*</span>
                </label>
                <input
                  id="campaign-title"
                  type="text"
                  value={state.title}
                  onChange={(e) => setField("title", e.target.value)}
                  maxLength={60}
                  required
                  autoComplete="off"
                  placeholder="예: 가족과 함께하는 숲속 캠핑"
                  className="w-full rounded-lg border border-[#E5D3B8] bg-[#FFF8F0] px-3 py-2.5 text-sm focus:border-[#C4956A] focus:outline-none focus:ring-2 focus:ring-[#C4956A]/30"
                />
                <p className="mt-1 text-[10px] text-[#8B6F47]">
                  {state.title.length}/60자
                </p>
              </div>
              <div>
                <label
                  htmlFor="campaign-desc"
                  className="block text-xs font-semibold text-[#2D5A3D] mb-1"
                >
                  설명
                </label>
                <textarea
                  id="campaign-desc"
                  value={state.description}
                  onChange={(e) => setField("description", e.target.value)}
                  maxLength={200}
                  rows={3}
                  placeholder="예: 도토리마켓과 함께 떠나는 2박 3일 패키지"
                  className="w-full resize-y rounded-lg border border-[#E5D3B8] bg-[#FFF8F0] px-3 py-2.5 text-sm focus:border-[#C4956A] focus:outline-none focus:ring-2 focus:ring-[#C4956A]/30"
                />
                <p className="mt-1 text-[10px] text-[#8B6F47]">
                  {state.description.length}/200자
                </p>
              </div>
              <div>
                <label
                  htmlFor="campaign-creative"
                  className="block text-xs font-semibold text-[#2D5A3D] mb-1"
                >
                  이미지/영상 URL
                </label>
                <input
                  id="campaign-creative"
                  type="url"
                  value={state.creative_url}
                  onChange={(e) => setField("creative_url", e.target.value)}
                  inputMode="url"
                  autoComplete="url"
                  placeholder="https://..."
                  className="w-full rounded-lg border border-[#E5D3B8] bg-[#FFF8F0] px-3 py-2.5 text-sm focus:border-[#C4956A] focus:outline-none focus:ring-2 focus:ring-[#C4956A]/30"
                />
              </div>
              <div>
                <label
                  htmlFor="campaign-cta"
                  className="block text-xs font-semibold text-[#2D5A3D] mb-1"
                >
                  CTA 버튼 문구
                </label>
                <input
                  id="campaign-cta"
                  type="text"
                  value={state.cta_label}
                  onChange={(e) => setField("cta_label", e.target.value)}
                  maxLength={20}
                  autoComplete="off"
                  placeholder="자세히 보기"
                  className="w-full rounded-lg border border-[#E5D3B8] bg-[#FFF8F0] px-3 py-2.5 text-sm focus:border-[#C4956A] focus:outline-none focus:ring-2 focus:ring-[#C4956A]/30"
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 4 — 타겟팅 */}
        {step === 4 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-base font-bold text-[#2D5A3D] md:text-lg">
                누구에게, 어디에 노출할까요?
              </h2>
              <p className="mt-1 text-xs text-[#6B6560]">
                지역·연령·노출 영역을 선택해 주세요.
              </p>
            </div>

            <div>
              <label
                htmlFor="target-region"
                className="block text-xs font-semibold text-[#2D5A3D] mb-1"
              >
                지역
              </label>
              <select
                id="target-region"
                value={state.target_region}
                onChange={(e) => setField("target_region", e.target.value)}
                className="w-full rounded-lg border border-[#E5D3B8] bg-[#FFF8F0] px-3 py-2.5 text-sm focus:border-[#C4956A] focus:outline-none focus:ring-2 focus:ring-[#C4956A]/30"
              >
                {REGIONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <span className="block text-xs font-semibold text-[#2D5A3D] mb-1.5">
                연령대
              </span>
              <div className="flex flex-wrap gap-2">
                {AGE_GROUPS.map((g) => {
                  const selected = state.target_age_group === g.value;
                  return (
                    <button
                      key={g.value}
                      type="button"
                      onClick={() => setField("target_age_group", g.value)}
                      aria-pressed={selected}
                      className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2D5A3D]/40 ${
                        selected
                          ? "border-[#2D5A3D] bg-[#2D5A3D] text-white"
                          : "border-[#E5D3B8] bg-white text-[#6B4423] hover:bg-[#FFF8F0]"
                      }`}
                    >
                      {g.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <span className="block text-xs font-semibold text-[#2D5A3D] mb-1.5">
                노출 영역 (Placement)
              </span>
              <div className="grid gap-2 sm:grid-cols-2">
                {PLACEMENTS.map((p) => {
                  const selected = state.placement === p.value;
                  return (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => setField("placement", p.value)}
                      aria-pressed={selected}
                      className={`rounded-xl border p-3 text-left transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2D5A3D]/40 ${
                        selected
                          ? "border-[#2D5A3D] bg-[#F5F9EF] shadow-sm"
                          : "border-[#E5D3B8] bg-white hover:border-[#C4956A]"
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <span className="text-xl" aria-hidden>
                          {p.icon}
                        </span>
                        <div>
                          <p className="text-sm font-bold text-[#6B4423]">
                            {p.label}
                          </p>
                          <p className="text-[10px] text-[#8B6F47]">{p.desc}</p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Step 5 — 예산 & 기간 */}
        {step === 5 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-base font-bold text-[#2D5A3D] md:text-lg">
                예산과 집행 기간을 설정하세요
              </h2>
              <p className="mt-1 text-xs text-[#6B6560]">
                일일 예산과 예상 노출/클릭을 자동으로 계산해드려요.
              </p>
            </div>

            <div>
              <label
                htmlFor="campaign-budget"
                className="block text-xs font-semibold text-[#2D5A3D] mb-1"
              >
                총 예산 (원) <span className="text-rose-600">*</span>
              </label>
              <input
                id="campaign-budget"
                type="number"
                value={state.budget}
                onChange={(e) => setField("budget", e.target.value)}
                min={10000}
                step={10000}
                inputMode="numeric"
                required
                className="w-full rounded-lg border border-[#E5D3B8] bg-[#FFF8F0] px-3 py-2.5 text-sm focus:border-[#C4956A] focus:outline-none focus:ring-2 focus:ring-[#C4956A]/30"
              />
              <p className="mt-1 text-[11px] text-[#8B6F47]">
                최소 10,000원 · 현재 {formatWon(budgetNum)}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="campaign-start"
                  className="block text-xs font-semibold text-[#2D5A3D] mb-1"
                >
                  시작일
                </label>
                <input
                  id="campaign-start"
                  type="date"
                  value={state.start_date}
                  onChange={(e) => setField("start_date", e.target.value)}
                  className="w-full rounded-lg border border-[#E5D3B8] bg-[#FFF8F0] px-3 py-2.5 text-sm focus:border-[#C4956A] focus:outline-none focus:ring-2 focus:ring-[#C4956A]/30"
                />
              </div>
              <div>
                <label
                  htmlFor="campaign-end"
                  className="block text-xs font-semibold text-[#2D5A3D] mb-1"
                >
                  종료일
                </label>
                <input
                  id="campaign-end"
                  type="date"
                  value={state.end_date}
                  onChange={(e) => setField("end_date", e.target.value)}
                  min={state.start_date}
                  className="w-full rounded-lg border border-[#E5D3B8] bg-[#FFF8F0] px-3 py-2.5 text-sm focus:border-[#C4956A] focus:outline-none focus:ring-2 focus:ring-[#C4956A]/30"
                />
              </div>
            </div>

            {/* 계산 미리보기 */}
            <div className="rounded-2xl border border-[#D4E4BC] bg-gradient-to-br from-[#F5F9EF] to-white p-4">
              <p className="text-xs font-bold text-[#2D5A3D] flex items-center gap-1.5">
                <span aria-hidden>📊</span>
                <span>예상 집행 요약</span>
              </p>
              <dl className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
                <div className="rounded-lg bg-white p-2 text-center border border-[#D4E4BC]">
                  <dt className="text-[10px] text-[#6B6560]">집행 기간</dt>
                  <dd className="mt-0.5 text-sm font-bold text-[#2D5A3D]">
                    {campaignDays}일
                  </dd>
                </div>
                <div className="rounded-lg bg-white p-2 text-center border border-[#D4E4BC]">
                  <dt className="text-[10px] text-[#6B6560]">일 예산</dt>
                  <dd className="mt-0.5 text-sm font-bold text-[#2D5A3D]">
                    {formatWon(dailyBudget)}
                  </dd>
                </div>
                <div className="rounded-lg bg-white p-2 text-center border border-[#D4E4BC]">
                  <dt className="text-[10px] text-[#6B6560]">예상 노출</dt>
                  <dd className="mt-0.5 text-sm font-bold text-[#2D5A3D]">
                    {estImpressions.toLocaleString("ko-KR")}
                  </dd>
                </div>
                <div className="rounded-lg bg-white p-2 text-center border border-[#D4E4BC]">
                  <dt className="text-[10px] text-[#6B6560]">예상 클릭</dt>
                  <dd className="mt-0.5 text-sm font-bold text-[#2D5A3D]">
                    {estClicks.toLocaleString("ko-KR")}
                  </dd>
                </div>
              </dl>
              <p className="mt-2 text-[10px] text-[#6B6560]">
                ※ CPM 5,000원 · CTR 1.2% 가정의 추정치예요 (실제와 다를 수
                있음).
              </p>
            </div>
          </div>
        )}

        {/* Step 6 — 확인 & 제출 */}
        {step === 6 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-base font-bold text-[#2D5A3D] md:text-lg">
                마지막 확인
              </h2>
              <p className="mt-1 text-xs text-[#6B6560]">
                미리보기를 확인한 후 승인 요청해 주세요.
              </p>
            </div>

            {/* Mock Ad Preview */}
            <div>
              <p className="text-xs font-bold text-[#2D5A3D] mb-2 flex items-center gap-1.5">
                <span aria-hidden>👀</span>
                <span>광고 미리보기 ({state.placement})</span>
              </p>
              <div className="rounded-2xl border-2 border-dashed border-[#C4956A] bg-[#FFF8F0] p-3">
                <div className="overflow-hidden rounded-xl border border-[#E5D3B8] bg-white shadow-sm">
                  {state.creative_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={state.creative_url}
                      alt={`${state.title} 미리보기 이미지`}
                      className="h-40 w-full object-cover bg-[#F1EDE7]"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                  ) : (
                    <div className="flex h-40 w-full items-center justify-center bg-gradient-to-br from-[#F5E6D3] to-[#E8F0E4] text-[#8B6F47]">
                      <span className="text-4xl" aria-hidden>
                        🖼️
                      </span>
                    </div>
                  )}
                  <div className="p-3">
                    <p className="text-[10px] font-semibold text-[#8B6F47] tracking-wide">
                      AD · {selectedPortal?.name ?? "-"}
                    </p>
                    <p className="mt-1 text-sm font-bold text-[#2D5A3D]">
                      {state.title || "캠페인 제목이 표시됩니다"}
                    </p>
                    {state.description ? (
                      <p className="mt-1 text-xs text-[#6B6560] line-clamp-2">
                        {state.description}
                      </p>
                    ) : null}
                    <button
                      type="button"
                      disabled
                      className="mt-2 w-full rounded-lg bg-[#2D5A3D] px-3 py-2 text-xs font-bold text-white opacity-90"
                    >
                      {state.cta_label || "자세히 보기"}
                    </button>
                  </div>
                </div>
                <p className="mt-2 text-center text-[10px] text-[#8B6F47]">
                  실제 노출은 Stage 2부터 가능합니다
                </p>
              </div>
            </div>

            {/* 요약 */}
            <dl className="grid gap-2 sm:grid-cols-2">
              <div className="rounded-xl border border-[#E5D3B8] bg-white p-3">
                <dt className="text-[10px] text-[#8B6F47]">목적</dt>
                <dd className="mt-0.5 text-sm font-bold text-[#6B4423]">
                  {selectedObjective.icon} {selectedObjective.label}
                </dd>
              </div>
              <div className="rounded-xl border border-[#E5D3B8] bg-white p-3">
                <dt className="text-[10px] text-[#8B6F47]">타겟 포털</dt>
                <dd className="mt-0.5 text-sm font-bold text-[#6B4423]">
                  {selectedPortal
                    ? `${selectedPortal.icon} ${selectedPortal.name}`
                    : "-"}
                </dd>
              </div>
              <div className="rounded-xl border border-[#E5D3B8] bg-white p-3">
                <dt className="text-[10px] text-[#8B6F47]">타겟팅</dt>
                <dd className="mt-0.5 text-sm font-bold text-[#6B4423]">
                  {state.target_region} ·{" "}
                  {AGE_GROUPS.find((g) => g.value === state.target_age_group)
                    ?.label ?? "전체"}{" "}
                  · {state.placement}
                </dd>
              </div>
              <div className="rounded-xl border border-[#E5D3B8] bg-white p-3">
                <dt className="text-[10px] text-[#8B6F47]">예산 / 기간</dt>
                <dd className="mt-0.5 text-sm font-bold text-[#6B4423]">
                  {formatWon(budgetNum)} · {campaignDays}일
                </dd>
              </div>
            </dl>

            {submitError ? (
              <div
                role="alert"
                className="rounded-xl border border-rose-300 bg-rose-50 p-3 text-xs text-rose-800"
              >
                {submitError}
              </div>
            ) : null}
          </div>
        )}
      </section>

      {/* Navigation */}
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setStep((s) => (s > 1 ? ((s - 1) as typeof step) : s))}
          disabled={step === 1 || isPending}
          className="rounded-xl border border-[#E5D3B8] bg-white px-4 py-2.5 text-sm font-semibold text-[#6B4423] hover:bg-[#FFF8F0] disabled:cursor-not-allowed disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C4956A]/40"
        >
          ← 이전
        </button>

        {step < 6 ? (
          <button
            type="button"
            onClick={() =>
              setStep((s) => (s < 6 ? ((s + 1) as typeof step) : s))
            }
            disabled={!canNext || isPending}
            className="rounded-xl bg-gradient-to-r from-[#C4956A] to-[#2D5A3D] px-5 py-2.5 text-sm font-bold text-white shadow-md hover:from-[#B0845A] hover:to-[#234a30] disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2D5A3D]/40"
          >
            다음 →
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isPending}
            className="rounded-xl bg-gradient-to-r from-[#2D5A3D] to-[#3A7A52] px-5 py-2.5 text-sm font-bold text-white shadow-md hover:from-[#234a30] hover:to-[#2D5A3D] disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2D5A3D]/40"
          >
            {isPending ? "제출 중..." : "✨ 승인 요청"}
          </button>
        )}
      </div>
    </div>
  );
}
