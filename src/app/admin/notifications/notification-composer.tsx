"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { sendBroadcastAction, type BroadcastResult } from "./actions";
import { AcornIcon } from "@/components/acorn-icon";

type TemplateKey =
  | "EVENT_START"
  | "MISSION_REMINDER"
  | "REWARD_READY"
  | "REVIEW_REQUEST"
  | "CUSTOM";

const TEMPLATES: Record<TemplateKey, { label: string; subject: string; body: string }> = {
  EVENT_START: {
    label: "행사 시작 안내",
    subject: "[토리로] 행사 시작 안내",
    body: "{name}님, {event_name}이 곧 시작됩니다! 지금 입장해주세요 🌿\n→ {link}",
  },
  MISSION_REMINDER: {
    label: "숲길 리마인더",
    subject: "[토리로] 숲길 리마인더",
    body: "{name}님, 아직 완료하지 못한 숲길이 있어요 🌿 도토리 모으러 가볼까요?",
  },
  REWARD_READY: {
    label: "보상 수령 안내",
    subject: "[토리로] 보상이 도착했어요",
    body: "🎉 {name}님, 보상을 받으세요! 스태프에게 QR을 보여주시면 돼요.",
  },
  REVIEW_REQUEST: {
    label: "후기 요청",
    subject: "[토리로] 오늘 숲길은 어떠셨나요?",
    body: "{name}님, 오늘 {event_name}에서의 시간은 어떠셨나요? 소중한 후기를 남겨주세요 🌱",
  },
  CUSTOM: {
    label: "커스텀 메시지",
    subject: "",
    body: "",
  },
};

type TargetKey = "ALL" | "EVENT" | "MANAGER" | "CUSTOM";
type MessageType = "SMS" | "ALIMTALK" | "PUSH";

const SAMPLE = {
  name: "김토리",
  event_name: "가을 숲속 캠핑",
  date: "2026-04-25",
  link: "https://toriro.app/join/ABCD",
};

function substitute(template: string) {
  return template
    .replace(/\{name\}/g, SAMPLE.name)
    .replace(/\{event_name\}/g, SAMPLE.event_name)
    .replace(/\{date\}/g, SAMPLE.date)
    .replace(/\{link\}/g, SAMPLE.link);
}

const RECENT_MOCK = [
  {
    sentAt: "2026-04-19 14:20",
    target: "가을 캠핑 참가자",
    preview: "내일 오전 9시에 뵙겠습니다. 준비물 확인 부탁...",
    sent: 48,
    failed: 2,
  },
  {
    sentAt: "2026-04-15 10:05",
    target: "전체 참가자",
    preview: "[토리로] 이번주 챌린지가 열렸어요! 도토리 모으러 ...",
    sent: 312,
    failed: 0,
  },
  {
    sentAt: "2026-04-10 18:30",
    target: "선생님/기관",
    preview: "기관 담당자 대상 주간 리포트가 준비되었습니다...",
    sent: 12,
    failed: 1,
  },
];

export default function NotificationComposer({
  events,
}: {
  events: { id: string; name: string }[];
}) {
  const [target, setTarget] = useState<TargetKey>("ALL");
  const [eventId, setEventId] = useState(events[0]?.id ?? "");
  const [customPhones, setCustomPhones] = useState("");
  const [messageType, setMessageType] = useState<MessageType>("SMS");
  const [templateKey, setTemplateKey] = useState<TemplateKey>("EVENT_START");
  const [subject, setSubject] = useState(TEMPLATES.EVENT_START.subject);
  const [body, setBody] = useState(TEMPLATES.EVENT_START.body);
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<BroadcastResult | null>(null);
  const bodyRef = useRef<HTMLTextAreaElement | null>(null);

  const charLimit = messageType === "SMS" ? 70 : messageType === "ALIMTALK" ? 500 : 200;
  const charCount = body.length;
  const nearLimit = charCount > charLimit * 0.85;
  const overLimit = charCount > charLimit;

  // Rough recipient estimate (for cost display)
  const estimatedCount = useMemo(() => {
    if (target === "ALL") return 320; // mock baseline
    if (target === "EVENT") return 48; // mock baseline
    if (target === "MANAGER") return 12;
    if (target === "CUSTOM") {
      return customPhones
        .split(/[,\n]/)
        .map((p) => p.trim())
        .filter(Boolean).length;
    }
    return 0;
  }, [target, customPhones]);

  const unitCost = messageType === "SMS" ? 20 : messageType === "ALIMTALK" ? 9 : 0;
  const estimatedCost = estimatedCount * unitCost;

  const preview = useMemo(() => substitute(body), [body]);
  const previewSubject = useMemo(() => substitute(subject), [subject]);

  function applyTemplate(key: TemplateKey) {
    setTemplateKey(key);
    const tpl = TEMPLATES[key];
    setSubject(tpl.subject);
    setBody(tpl.body);
  }

  function insertVariable(variable: string) {
    const ta = bodyRef.current;
    if (!ta) {
      setBody((b) => b + variable);
      return;
    }
    const start = ta.selectionStart ?? body.length;
    const end = ta.selectionEnd ?? body.length;
    const next = body.slice(0, start) + variable + body.slice(end);
    setBody(next);
    // restore caret after state update
    requestAnimationFrame(() => {
      ta.focus();
      const pos = start + variable.length;
      ta.setSelectionRange(pos, pos);
    });
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (overLimit) return;
    const formEl = e.currentTarget;
    const confirmMsg =
      target === "CUSTOM"
        ? `입력한 ${estimatedCount}명에게 발송할까요?`
        : `${estimatedCount}명에게 발송할까요? (예상 비용 ₩${estimatedCost.toLocaleString("ko-KR")})`;
    if (!window.confirm(confirmMsg)) return;

    const fd = new FormData(formEl);
    startTransition(async () => {
      const res = await sendBroadcastAction(fd);
      setResult(res);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Target selector */}
      <section className="rounded-2xl border border-[#D4E4BC] bg-white p-5">
        <h2 className="text-sm font-bold text-[#2D5A3D] mb-3">🎯 수신 대상</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {[
            { key: "ALL" as TargetKey, label: "전체 참가자", desc: "모든 활성 참가자" },
            { key: "EVENT" as TargetKey, label: "특정 행사 참가자", desc: "행사 선택" },
            { key: "MANAGER" as TargetKey, label: "선생님/기관", desc: "모든 매니저" },
            { key: "CUSTOM" as TargetKey, label: "특정 전화번호", desc: "직접 입력" },
          ].map((opt) => (
            <label
              key={opt.key}
              className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-all ${
                target === opt.key
                  ? "border-[#2D5A3D] bg-[#E8F0E4]"
                  : "border-[#E5D3B8] bg-white hover:bg-[#FFF8F0]"
              }`}
            >
              <input
                type="radio"
                name="target"
                value={opt.key}
                checked={target === opt.key}
                onChange={() => setTarget(opt.key)}
                className="mt-0.5 accent-[#2D5A3D]"
              />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-[#2C2C2C]">{opt.label}</div>
                <div className="text-[11px] text-[#6B6560] mt-0.5">{opt.desc}</div>
              </div>
            </label>
          ))}
        </div>

        {target === "EVENT" && (
          <div className="mt-3">
            <label htmlFor="event_id" className="block text-xs font-medium text-[#6B6560] mb-1">
              행사 선택
            </label>
            <select
              id="event_id"
              name="event_id"
              value={eventId}
              onChange={(e) => setEventId(e.target.value)}
              className="w-full rounded-xl border border-[#D4E4BC] bg-white px-3 py-2 text-sm focus:border-[#2D5A3D] focus:ring-2 focus:ring-[#E8F0E4] focus:outline-none"
            >
              {events.length === 0 && <option value="">행사 없음</option>}
              {events.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {target === "CUSTOM" && (
          <div className="mt-3">
            <label htmlFor="custom_phones" className="block text-xs font-medium text-[#6B6560] mb-1">
              전화번호 (쉼표 또는 줄바꿈 구분)
            </label>
            <textarea
              id="custom_phones"
              name="custom_phones"
              value={customPhones}
              onChange={(e) => setCustomPhones(e.target.value)}
              inputMode="tel"
              rows={3}
              placeholder="010-1234-5678, 010-9876-5432"
              className="w-full rounded-xl border border-[#D4E4BC] bg-white px-3 py-2 text-sm font-mono focus:border-[#2D5A3D] focus:ring-2 focus:ring-[#E8F0E4] focus:outline-none"
            />
            <p className="mt-1 text-[11px] text-[#8B6F47]">
              입력한 번호 수: {estimatedCount}개
            </p>
          </div>
        )}
      </section>

      {/* Message Type */}
      <section className="rounded-2xl border border-[#D4E4BC] bg-white p-5">
        <h2 className="text-sm font-bold text-[#2D5A3D] mb-3">💌 메시지 타입</h2>
        <div className="grid grid-cols-3 gap-2">
          {[
            { key: "SMS" as MessageType, icon: "📱", label: "SMS", limit: "70자" },
            { key: "ALIMTALK" as MessageType, icon: "💬", label: "알림톡", limit: "500자" },
            { key: "PUSH" as MessageType, icon: "🔔", label: "앱 푸시", limit: "200자" },
          ].map((mt) => (
            <button
              type="button"
              key={mt.key}
              onClick={() => setMessageType(mt.key)}
              className={`rounded-xl border p-3 text-center transition-all ${
                messageType === mt.key
                  ? "border-[#2D5A3D] bg-[#E8F0E4]"
                  : "border-[#E5D3B8] bg-white hover:bg-[#FFF8F0]"
              }`}
            >
              <div className="text-xl">{mt.icon}</div>
              <div className="text-sm font-semibold text-[#2C2C2C] mt-1">{mt.label}</div>
              <div className="text-[10px] text-[#6B6560] mt-0.5">{mt.limit}</div>
            </button>
          ))}
        </div>
        <input type="hidden" name="message_type" value={messageType} />
      </section>

      {/* Template picker */}
      <section className="rounded-2xl border border-[#D4E4BC] bg-white p-5">
        <h2 className="text-sm font-bold text-[#2D5A3D] mb-3">📋 템플릿</h2>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {(Object.keys(TEMPLATES) as TemplateKey[]).map((key) => (
            <button
              type="button"
              key={key}
              onClick={() => applyTemplate(key)}
              className={`rounded-xl border p-3 text-xs font-semibold transition-all ${
                templateKey === key
                  ? "border-[#2D5A3D] bg-[#E8F0E4] text-[#2D5A3D]"
                  : "border-[#E5D3B8] bg-white text-[#6B6560] hover:bg-[#FFF8F0]"
              }`}
            >
              {TEMPLATES[key].label}
            </button>
          ))}
        </div>
      </section>

      {/* Content editor */}
      <section className="rounded-2xl border border-[#D4E4BC] bg-white p-5 space-y-4">
        <h2 className="text-sm font-bold text-[#2D5A3D]">✏️ 내용 작성</h2>

        {messageType === "ALIMTALK" && (
          <div>
            <label htmlFor="subject" className="block text-xs font-medium text-[#6B6560] mb-1">
              제목 (알림톡)
            </label>
            <input
              id="subject"
              name="subject"
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              autoComplete="off"
              className="w-full rounded-xl border border-[#D4E4BC] bg-white px-3 py-2 text-sm focus:border-[#2D5A3D] focus:ring-2 focus:ring-[#E8F0E4] focus:outline-none"
            />
          </div>
        )}
        {messageType !== "ALIMTALK" && <input type="hidden" name="subject" value={subject} />}

        <div>
          <label htmlFor="body" className="block text-xs font-medium text-[#6B6560] mb-1">
            본문
          </label>
          <textarea
            id="body"
            name="body"
            ref={bodyRef}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={6}
            className="w-full rounded-xl border border-[#D4E4BC] bg-white px-3 py-2 text-sm focus:border-[#2D5A3D] focus:ring-2 focus:ring-[#E8F0E4] focus:outline-none"
          />
          <div className="mt-1 flex items-center justify-between text-[11px]">
            <span className="text-[#8B6F47]">
              변수를 클릭하면 커서 위치에 삽입돼요
            </span>
            <span
              className={`font-semibold tabular-nums ${
                overLimit ? "text-red-600" : nearLimit ? "text-orange-500" : "text-[#6B6560]"
              }`}
            >
              {charCount} / {charLimit}자
            </span>
          </div>
        </div>

        {/* Variable chips */}
        <div>
          <div className="text-[11px] font-medium text-[#6B6560] mb-1.5">변수 삽입</div>
          <div className="flex flex-wrap gap-1.5">
            {["{name}", "{event_name}", "{date}", "{link}"].map((v) => (
              <button
                type="button"
                key={v}
                onClick={() => insertVariable(v)}
                className="rounded-full border border-[#D4E4BC] bg-[#E8F0E4] px-3 py-1 text-xs font-semibold text-[#2D5A3D] hover:bg-[#D4E4BC] hover:shadow-sm transition-all"
              >
                {v}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Preview (phone mockup) */}
      <section className="rounded-2xl border border-[#D4E4BC] bg-white p-5">
        <h2 className="text-sm font-bold text-[#2D5A3D] mb-3">👀 미리보기</h2>
        <div className="flex justify-center">
          <div className="w-full max-w-[320px] rounded-[2rem] border-[6px] border-neutral-800 bg-neutral-800 p-2 shadow-xl">
            <div className="rounded-[1.5rem] bg-[#F5F5F7] overflow-hidden">
              <div className="bg-neutral-800 text-white text-center text-[10px] py-1">
                ● ● ●
              </div>
              <div className="p-3 min-h-[220px] text-left">
                {messageType === "SMS" && (
                  <div className="rounded-2xl bg-white border border-neutral-200 p-3 shadow-sm">
                    <div className="text-[10px] text-neutral-500 mb-1">SMS · 토리로</div>
                    <pre className="text-[13px] text-neutral-800 whitespace-pre-wrap font-sans leading-relaxed">
                      {preview || "메시지를 입력하세요..."}
                    </pre>
                  </div>
                )}
                {messageType === "ALIMTALK" && (
                  <div className="rounded-2xl bg-[#FEE500] p-3 shadow-sm">
                    <div className="flex items-center gap-1.5 mb-2">
                      <span className="text-base">💬</span>
                      <span className="text-[10px] font-bold text-neutral-800">카카오 알림톡</span>
                    </div>
                    <div className="rounded-xl bg-white p-3">
                      {previewSubject && (
                        <div className="text-[12px] font-bold text-neutral-800 mb-1.5 pb-1.5 border-b border-neutral-100">
                          {previewSubject}
                        </div>
                      )}
                      <pre className="text-[13px] text-neutral-800 whitespace-pre-wrap font-sans leading-relaxed">
                        {preview || "메시지를 입력하세요..."}
                      </pre>
                    </div>
                  </div>
                )}
                {messageType === "PUSH" && (
                  <div className="rounded-2xl bg-neutral-100 border border-neutral-200 p-3 shadow-sm">
                    <div className="flex items-start gap-2">
                      <div className="h-8 w-8 flex-shrink-0 rounded-lg bg-[#2D5A3D] flex items-center justify-center text-white">
                        <AcornIcon size={18} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-neutral-800">토리로</span>
                          <span className="text-[9px] text-neutral-500">지금</span>
                        </div>
                        {previewSubject && (
                          <div className="text-[12px] font-semibold text-neutral-800 mt-0.5 truncate">
                            {previewSubject}
                          </div>
                        )}
                        <div className="text-[11px] text-neutral-700 mt-0.5 line-clamp-3 whitespace-pre-wrap">
                          {preview || "메시지를 입력하세요..."}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
        <p className="mt-3 text-center text-[11px] text-[#8B6F47]">
          예시 값: {SAMPLE.name} · {SAMPLE.event_name} · {SAMPLE.date}
        </p>
      </section>

      {/* Cost estimate + submit */}
      <section className="rounded-2xl border-2 border-[#2D5A3D] bg-gradient-to-br from-[#E8F0E4] to-white p-5">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div>
            <div className="text-xs font-medium text-[#6B4423]">예상 발송 수</div>
            <div className="text-2xl font-extrabold text-[#2D5A3D]">
              {estimatedCount.toLocaleString("ko-KR")}
              <span className="text-sm font-medium ml-1">건</span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs font-medium text-[#6B4423]">예상 비용</div>
            <div className="text-2xl font-extrabold text-[#6B4423]">
              ₩{estimatedCost.toLocaleString("ko-KR")}
            </div>
            <div className="text-[10px] text-[#8B6F47]">
              단가 ₩{unitCost} × {estimatedCount}건
            </div>
          </div>
        </div>

        {result && (
          <div
            className={`mb-3 rounded-xl p-3 text-sm ${
              result.ok
                ? "bg-green-50 border border-green-200 text-green-800"
                : "bg-red-50 border border-red-200 text-red-800"
            }`}
            role="status"
          >
            {result.ok ? "✅" : "⚠️"} {result.message ?? (result.ok ? "발송 완료" : "발송 실패")}
            {result.ok && ` · 성공 ${result.sent}건 / 실패 ${result.failed}건`}
          </div>
        )}

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={isPending || overLimit || !body.trim()}
            className="flex-1 rounded-xl bg-[#2D5A3D] px-4 py-3 text-sm font-bold text-white shadow-sm hover:bg-[#3A7A52] disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-[#2D5A3D] focus:ring-offset-2 transition-all"
          >
            {isPending ? "발송 중..." : "📤 발송하기"}
          </button>
          <button
            type="button"
            onClick={() => window.alert("초안이 저장되었습니다 (MOCK)")}
            className="rounded-xl border border-[#D4E4BC] bg-white px-4 py-3 text-sm font-semibold text-[#2D5A3D] hover:bg-[#FFF8F0] focus:outline-none focus:ring-2 focus:ring-[#2D5A3D] focus:ring-offset-2 transition-all"
          >
            💾 초안 저장
          </button>
        </div>
        {overLimit && (
          <p className="mt-2 text-xs text-red-600">
            글자 수가 한도를 초과했어요. 본문을 줄여주세요.
          </p>
        )}
      </section>

      {/* Recent broadcasts */}
      <section className="rounded-2xl border border-[#D4E4BC] bg-white p-5">
        <h2 className="text-sm font-bold text-[#2D5A3D] mb-3">📜 최근 발송 이력</h2>
        <div className="space-y-2">
          {RECENT_MOCK.map((r, i) => (
            <div
              key={i}
              className="rounded-xl border border-[#E5D3B8] bg-[#FFF8F0] p-3"
            >
              <div className="flex items-center justify-between flex-wrap gap-1">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="rounded-full bg-white border border-[#D4E4BC] px-2 py-0.5 text-[10px] font-semibold text-[#2D5A3D]">
                    {r.target}
                  </span>
                  <span className="text-[11px] text-[#8B6F47] tabular-nums">{r.sentAt}</span>
                </div>
                <div className="flex items-center gap-2 text-[11px]">
                  <span className="text-green-700 font-semibold">성공 {r.sent}</span>
                  <span className="text-neutral-400">/</span>
                  <span className="text-red-600 font-semibold">실패 {r.failed}</span>
                </div>
              </div>
              <p className="mt-1.5 text-xs text-[#6B6560] truncate">{r.preview}</p>
            </div>
          ))}
        </div>
      </section>
    </form>
  );
}
