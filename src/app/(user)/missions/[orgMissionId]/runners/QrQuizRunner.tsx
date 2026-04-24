"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type {
  OrgMissionRow,
  QrQuizMissionConfig,
} from "@/lib/missions/types";
import { QrScanner } from "@/components/qr-scanner";
import { submitMissionAction } from "../../actions";
import { AcornIcon } from "@/components/acorn-icon";

interface Props {
  mission: OrgMissionRow;
  config: QrQuizMissionConfig;
}

export function QrQuizRunner({ mission, config }: Props) {
  const router = useRouter();
  const [qrCode, setQrCode] = useState("");
  const [answer, setAnswer] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [scanToast, setScanToast] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const hasQuiz = config.quiz_type && config.quiz_type !== "NONE";

  const handleSubmit = () => {
    if (qrCode.trim().length === 0) {
      setErrorMsg("QR 코드를 입력해 주세요");
      return;
    }
    if (hasQuiz && answer.trim().length === 0) {
      setErrorMsg("퀴즈 정답을 선택하거나 입력해 주세요");
      return;
    }
    setErrorMsg(null);
    startTransition(async () => {
      try {
        const result = await submitMissionAction(mission.id, {
          qr_scanned_token: qrCode.trim(),
          quiz_answer: answer.trim() || undefined,
        });
        if (result.redirectTo) {
          router.push(result.redirectTo);
          router.refresh();
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setErrorMsg(msg);
      }
    });
  };

  return (
    <div className="space-y-4">
      {/* QR 입력 */}
      <section className="rounded-3xl border border-[#D4E4BC] bg-white p-5 shadow-sm">
        <h2 className="flex items-center gap-2 text-base font-bold text-[#2D5A3D]">
          <span aria-hidden>🔲</span>
          QR 코드 입력
        </h2>
        <p className="mt-1.5 text-[11px] text-[#6B6560]">
          숲길에 설치된 QR 코드 아래의 문자를 그대로 입력해 주세요
        </p>

        {/* 카메라 스캐너 */}
        <div className="mt-3">
          <QrScanner
            expectPrefix="mq_"
            buttonLabel="📷 카메라로 QR 스캔"
            onScan={(text) => {
              setQrCode(text);
              setErrorMsg(null);
              setScanToast("QR 인식 완료! 정답을 입력하고 제출해 주세요");
              // 퀴즈가 없다면 바로 토스트만 남기고 사용자가 제출 버튼을 누르게 유도
              setTimeout(() => setScanToast(null), 3500);
            }}
            onError={(msg) => {
              setScanToast(null);
              setErrorMsg(msg);
            }}
          />
        </div>

        {scanToast && (
          <p
            role="status"
            className="mt-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-[12px] font-semibold text-emerald-800"
          >
            ✅ {scanToast}
          </p>
        )}

        <label
          htmlFor="mission-qr"
          className="mt-4 block text-sm font-bold text-[#2D5A3D]"
        >
          또는 직접 입력
        </label>
        <input
          id="mission-qr"
          type="text"
          value={qrCode}
          onChange={(e) => setQrCode(e.target.value)}
          placeholder="예: TREE-ASH-01"
          inputMode="text"
          autoCapitalize="characters"
          autoComplete="off"
          className="mt-2 min-h-[48px] w-full rounded-2xl border border-[#D4E4BC] bg-[#FFF8F0] px-4 py-3 text-base font-mono tracking-wider text-[#3D3A36] outline-none focus:border-[#2D5A3D] focus:ring-2 focus:ring-[#2D5A3D]/20"
        />
        {config.hint && (
          <p className="mt-2 text-[11px] text-[#6B6560]">💡 {config.hint}</p>
        )}
      </section>

      {/* Quiz */}
      {hasQuiz && (
        <section className="rounded-3xl border border-[#D4E4BC] bg-white p-5 shadow-sm">
          <h2 className="flex items-center gap-2 text-base font-bold text-[#2D5A3D]">
            <span aria-hidden>🤔</span>
            미니 퀴즈
          </h2>
          {config.quiz_text && (
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-[#3D3A36]">
              {config.quiz_text}
            </p>
          )}

          {config.quiz_type === "MCQ" && Array.isArray(config.quiz_choices) ? (
            <fieldset className="mt-3 space-y-2">
              <legend className="sr-only">정답을 선택해 주세요</legend>
              {config.quiz_choices.map((choice) => (
                <label
                  key={choice.id}
                  className={`flex min-h-[48px] cursor-pointer items-center gap-3 rounded-2xl border-2 px-4 py-3 text-sm font-semibold transition ${
                    answer === choice.id
                      ? "border-[#2D5A3D] bg-[#E8F0E4] text-[#2D5A3D]"
                      : "border-[#D4E4BC] bg-[#FFF8F0] text-[#3D3A36] hover:bg-[#F5F1E8]"
                  }`}
                >
                  <input
                    type="radio"
                    name="quiz_answer"
                    value={choice.id}
                    checked={answer === choice.id}
                    onChange={(e) => setAnswer(e.target.value)}
                    className="h-4 w-4 accent-[#2D5A3D]"
                  />
                  <span>{choice.label}</span>
                </label>
              ))}
            </fieldset>
          ) : (
            <div className="mt-3">
              <label
                htmlFor="quiz-short"
                className="block text-sm font-bold text-[#2D5A3D]"
              >
                정답 입력
              </label>
              <input
                id="quiz-short"
                type="text"
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder="정답을 입력해 주세요"
                inputMode="text"
                autoComplete="off"
                className="mt-2 min-h-[48px] w-full rounded-2xl border border-[#D4E4BC] bg-[#FFF8F0] px-4 py-3 text-sm text-[#3D3A36] outline-none focus:border-[#2D5A3D] focus:ring-2 focus:ring-[#2D5A3D]/20"
              />
            </div>
          )}
        </section>
      )}

      {errorMsg && (
        <div
          role="alert"
          className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800"
        >
          ⚠️ {errorMsg}
        </div>
      )}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={isPending}
        className="min-h-[56px] w-full rounded-2xl bg-[#2D5A3D] px-4 py-3 text-base font-bold text-white shadow-sm transition hover:bg-[#3A7A52] active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-[#B8C7B0]"
      >
        {isPending
          ? "제출 중..."
          : <><AcornIcon /> +{mission.acorns} 도토리 받기 · 제출하기</>}
      </button>
    </div>
  );
}
