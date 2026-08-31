"use client";

// 접수 탭 — 개인정보 동의 문구 편집 카드.
//
// 바로 위 ApplicationSettings 는 **이 행사** 설정이지만 이 카드는 **기관 전체**다.
// 같은 자리에 두면서 범위가 다르므로 헤더에 그 사실을 못 박아 둔다. 여기서
// 한 번 고치면 이 기관의 모든 행사 신청서가 같은 문구를 쓴다.
//
// 이미 접수된 신청서는 영향을 받지 않는다 — 제출 시점 전문이 각 신청서 행에
// 복사돼 있고, 그게 이 기능의 핵심이다(무엇에 동의했는지를 나중에도 댈 수 있게).
//
// 타이핑 지연 방지: textarea 는 로컬 state 로 두고 onBlur 에 저장한다
// (application-settings.tsx 의 마감·정원 입력과 같은 규약).

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateOrgApplicationConsentAction } from "@/lib/org-events/application-actions";
import {
  DEFAULT_CONSENT_BODY,
  DEFAULT_CONSENT_OPTIONAL_BODY,
  MAX_CONSENT_BODY_LENGTH,
  CONSENT_ORG_TOKEN,
  renderConsentBody,
} from "@/lib/org-events/consent-core";
import { fmtDateTimeKst } from "@/lib/datetime/kst";

type Props = {
  orgId: string;
  /** {기관명} 치환 미리보기용. */
  orgName: string;
  /** DB 원본(치환 전). 기관이 정한 적 없으면 코드 기본 문구가 들어온다. */
  initialBody: string;
  initialOptionalBody: string;
  initialOptionalEnabled: boolean;
  /** 마지막 수정 시각 ISO. 기관이 손댄 적 없으면 null. */
  updatedAt: string | null;
};

const TEXTAREA_CLS =
  "w-full rounded-xl border border-[#D4E4BC] bg-white px-3 py-2.5 font-sans text-xs leading-relaxed text-[#2D5A3D] outline-none focus:border-[#3A7A52] disabled:opacity-50";

export function ConsentEditor({
  orgId,
  orgName,
  initialBody,
  initialOptionalBody,
  initialOptionalEnabled,
  updatedAt,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState(initialBody);
  const [optionalBody, setOptionalBody] = useState(initialOptionalBody);
  const [optionalEnabled, setOptionalEnabled] = useState(
    initialOptionalEnabled
  );
  const [preview, setPreview] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  function save(next: {
    body?: string;
    optionalBody?: string;
    optionalEnabled?: boolean;
  }) {
    const payload = {
      body: next.body ?? body,
      optionalBody: next.optionalBody ?? optionalBody,
      optionalEnabled: next.optionalEnabled ?? optionalEnabled,
    };
    // 안 바뀌었으면 저장하지 않는다 — 탭만 옮겨도 저장 메시지가 뜨지 않게.
    if (
      payload.body === initialBody &&
      payload.optionalBody === initialOptionalBody &&
      payload.optionalEnabled === initialOptionalEnabled
    ) {
      return;
    }

    setError(null);
    setSaved(false);
    startTransition(async () => {
      try {
        await updateOrgApplicationConsentAction(orgId, payload);
        setSaved(true);
        router.refresh();
      } catch (e) {
        // 실패 → 화면을 서버 값으로 되돌린다 (설정 카드와 같은 규약).
        setBody(initialBody);
        setOptionalBody(initialOptionalBody);
        setOptionalEnabled(initialOptionalEnabled);
        setError(e instanceof Error ? e.message : "저장에 실패했어요");
      }
    });
  }

  function resetToDefault() {
    if (
      !window.confirm(
        "동의 문구를 토리로 기본 문구로 되돌릴까요?\n지금 적어두신 내용은 사라집니다.\n(이미 접수된 신청서의 동의 기록은 그대로 남습니다)"
      )
    ) {
      return;
    }
    setBody(DEFAULT_CONSENT_BODY);
    setOptionalBody(DEFAULT_CONSENT_OPTIONAL_BODY);
    save({
      body: DEFAULT_CONSENT_BODY,
      optionalBody: DEFAULT_CONSENT_OPTIONAL_BODY,
    });
  }

  const customized =
    body !== DEFAULT_CONSENT_BODY ||
    optionalBody !== DEFAULT_CONSENT_OPTIONAL_BODY;

  return (
    <section className="rounded-2xl border border-[#D4E4BC] bg-white p-4 shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-start gap-3 text-left"
      >
        <span className="text-2xl" aria-hidden>
          📜
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="text-sm font-bold text-[#2D5A3D]">
              개인정보 동의 문구
            </span>
            <span className="rounded-full bg-[#E8F0E4] px-2 py-0.5 text-[10px] font-bold text-[#2D5A3D]">
              기관 전체
            </span>
            {customized && (
              <span className="rounded-full bg-[#FAE7D0] px-2 py-0.5 text-[10px] font-bold text-[#6B4423]">
                직접 수정함
              </span>
            )}
          </span>
          <span className="mt-0.5 block text-[11px] leading-relaxed text-[#6B6560]">
            신청서 아래에 뜨는 동의 문구예요.{" "}
            <b>이 기관의 모든 행사</b>에 함께 적용됩니다.
            {updatedAt && ` · 마지막 수정 ${fmtDateTimeKst(updatedAt)}`}
          </span>
        </span>
        <span className="shrink-0 text-xs font-bold text-[#8B7F75]">
          {open ? "접기" : "수정"}
        </span>
      </button>

      {open && (
        <div className="mt-4 space-y-4 border-t border-[#E8DDC8] pt-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] leading-relaxed text-[#6B6560]">
              <code className="rounded bg-[#F5F1E8] px-1 py-0.5 font-bold text-[#2D5A3D]">
                {CONSENT_ORG_TOKEN}
              </code>{" "}
              라고 적으면 신청서에서 <b>{orgName}</b> 으로 바뀌어 보여요.
            </p>
            <button
              type="button"
              onClick={() => setPreview((v) => !v)}
              className="shrink-0 rounded-lg border border-[#D4E4BC] px-2.5 py-1 text-[11px] font-bold text-[#2D5A3D] hover:bg-[#F5F1E8]"
            >
              {preview ? "✏️ 편집" : "👁 미리보기"}
            </button>
          </div>

          {/* 필수 */}
          <div>
            <label
              htmlFor="consent_body"
              className="mb-1 flex items-baseline justify-between gap-2"
            >
              <span className="text-[11px] font-bold text-[#6B4423]">
                [필수] 개인정보 수집·이용
              </span>
              <span className="text-[10px] tabular-nums text-[#6B6560]">
                {body.length} / {MAX_CONSENT_BODY_LENGTH}
              </span>
            </label>
            {preview ? (
              <pre className="max-h-64 overflow-y-auto whitespace-pre-wrap rounded-xl border border-[#E8DDC8] bg-[#FFFDF8] px-3 py-2.5 font-sans text-xs leading-relaxed text-[#4A4340]">
                {renderConsentBody(body, orgName)}
              </pre>
            ) : (
              <textarea
                id="consent_body"
                rows={12}
                value={body}
                disabled={pending}
                maxLength={MAX_CONSENT_BODY_LENGTH}
                onChange={(e) => setBody(e.target.value)}
                onBlur={() => save({ body })}
                className={TEXTAREA_CLS}
              />
            )}
            <p className="mt-1 text-[10px] leading-relaxed text-[#6B6560]">
              이 항목은 끌 수 없어요 — 동의 없이 개인정보를 받을 수 없습니다.
            </p>
          </div>

          {/* 선택 */}
          <div>
            <div className="mb-1 flex items-center justify-between gap-2">
              <label
                htmlFor="consent_optional_body"
                className="text-[11px] font-bold text-[#6B4423]"
              >
                [선택] 계열사 공동이용
              </label>
              <button
                type="button"
                role="switch"
                aria-checked={optionalEnabled}
                aria-label="선택 동의 항목 사용"
                disabled={pending}
                onClick={() => {
                  const next = !optionalEnabled;
                  setOptionalEnabled(next);
                  save({ optionalEnabled: next });
                }}
                className={`relative h-6 w-11 shrink-0 rounded-full transition disabled:opacity-50 ${
                  optionalEnabled ? "bg-emerald-500" : "bg-zinc-300"
                }`}
              >
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
                    optionalEnabled ? "left-[1.375rem]" : "left-0.5"
                  }`}
                />
              </button>
            </div>

            {optionalEnabled ? (
              <>
                {preview ? (
                  <pre className="max-h-64 overflow-y-auto whitespace-pre-wrap rounded-xl border border-[#E8DDC8] bg-[#FFFDF8] px-3 py-2.5 font-sans text-xs leading-relaxed text-[#4A4340]">
                    {renderConsentBody(optionalBody, orgName)}
                  </pre>
                ) : (
                  <textarea
                    id="consent_optional_body"
                    rows={12}
                    value={optionalBody}
                    disabled={pending}
                    maxLength={MAX_CONSENT_BODY_LENGTH}
                    onChange={(e) => setOptionalBody(e.target.value)}
                    onBlur={() => save({ optionalBody })}
                    className={TEXTAREA_CLS}
                  />
                )}
                <p className="mt-1 text-[10px] leading-relaxed text-[#6B6560]">
                  선택 항목이라 체크하지 않아도 참가 신청은 접수돼요. 참가 조건으로
                  걸 수 없습니다 (개인정보보호법 제22조 제5항).
                </p>
              </>
            ) : (
              <p className="rounded-xl border border-dashed border-[#E5D3B8] px-3 py-2.5 text-[11px] leading-relaxed text-[#8B7F75]">
                꺼져 있어요 — 신청서에 선택 동의 줄이 뜨지 않습니다. 다시 켜면
                적어두신 문구가 그대로 살아나요.
              </p>
            )}
          </div>

          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={resetToDefault}
              disabled={pending}
              className="rounded-lg px-2 py-1 text-[11px] font-semibold text-[#8B7F75] underline underline-offset-2 hover:text-[#2D5A3D] disabled:opacity-50"
            >
              기본 문구로 되돌리기
            </button>
            <span className="text-[10px] text-[#6B6560]">
              칸 밖을 누르면 저장돼요
            </span>
          </div>

          {error && (
            <p className="text-[11px] font-semibold text-rose-700">{error}</p>
          )}
          {saved && !error && (
            <p className="text-[11px] font-semibold text-emerald-700">
              저장했어요 — 이 기관의 모든 행사에 적용됩니다
            </p>
          )}
        </div>
      )}
    </section>
  );
}
