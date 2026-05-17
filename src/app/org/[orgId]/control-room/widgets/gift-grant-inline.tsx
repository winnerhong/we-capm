"use client";

// 관제실 가족 미리보기 패널 안에서 선물 1건을 즉시 발급.
// 기존 bulkManualGrantAction(userIds=[1개]) 을 재사용 — auth/검증 로직 중복 없음.
//   ✓ org 검증 + user.org_id 매칭 (다른 기관 거부)
//   ✓ source_type='manual_grant' + source_id=null (명시적 중복 허용)

import { useState, useTransition } from "react";
import { bulkManualGrantAction } from "@/lib/gifts/actions";

export type GiftTemplateOption = {
  id: string;
  label: string;
  message: string | null;
  giftUrl: string | null;
  defaultExpiresDays: number;
};

interface Props {
  userId: string;
  /** 표시용 — 받는 사람 이름. UX 안내에만 사용 (실제 발급 표시명은 서버가 결정). */
  displayName: string;
  /** 미리 저장한 쿠폰 템플릿 — 셀렉터에서 골라 폼 자동 채움. */
  templates?: GiftTemplateOption[];
}

const DEFAULT_EXPIRES_DAYS = 30;

export function GiftGrantInline({
  userId,
  displayName,
  templates = [],
}: Props) {
  const [open, setOpen] = useState(false);
  const [giftLabel, setGiftLabel] = useState("");
  const [message, setMessage] = useState("");
  const [days, setDays] = useState<number>(DEFAULT_EXPIRES_DAYS);
  const [result, setResult] = useState<{
    kind: "ok" | "err";
    text: string;
  } | null>(null);
  const [pending, startTransition] = useTransition();

  const reset = () => {
    setGiftLabel("");
    setMessage("");
    setDays(DEFAULT_EXPIRES_DAYS);
    setResult(null);
  };

  const handleSubmit = () => {
    const label = giftLabel.trim();
    if (!label) {
      setResult({ kind: "err", text: "선물 이름을 입력해 주세요" });
      return;
    }
    setResult(null);
    startTransition(async () => {
      try {
        const res = await bulkManualGrantAction({
          userIds: [userId],
          giftLabel: label,
          message: message.trim() || null,
          expiresInDays: days,
        });
        if (res.granted >= 1) {
          setResult({
            kind: "ok",
            text: `✓ ${displayName} 선물함에 발급됐어요`,
          });
          // 폼은 유지하지 않고 접고 비워서 중복 발급 방지 (필요하면 다시 열기).
          setOpen(false);
          reset();
        } else {
          const reason = res.failed[0]?.reason ?? "알 수 없는 오류";
          setResult({ kind: "err", text: `발급 실패: ${reason}` });
        }
      } catch (err) {
        setResult({
          kind: "err",
          text: err instanceof Error ? err.message : "발급 실패",
        });
      }
    });
  };

  if (!open) {
    return (
      <div className="mt-3 space-y-1.5">
        <button
          type="button"
          onClick={() => {
            setOpen(true);
            setResult(null);
          }}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-amber-400/40 bg-amber-500/15 px-3 py-2 text-[11px] font-bold text-amber-200 transition hover:bg-amber-500/25 hover:text-amber-100"
        >
          🎁 선물 증정
        </button>
        {result && (
          <p
            role="status"
            className={`text-center text-[10px] font-semibold ${
              result.kind === "ok" ? "text-emerald-300" : "text-rose-300"
            }`}
          >
            {result.text}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="mt-3 space-y-2 rounded-lg border border-amber-400/40 bg-amber-500/[0.06] p-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-bold text-amber-200">
          🎁 {displayName} 에게 선물
        </span>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            reset();
          }}
          aria-label="닫기"
          className="rounded p-0.5 text-[11px] text-[#a8b8d0] hover:bg-white/10 hover:text-white"
        >
          ✕
        </button>
      </div>

      {templates.length > 0 && (
        <label className="block">
          <span className="block text-[10px] font-semibold text-amber-200/80">
            🎟️ 저장된 쿠폰 불러오기
          </span>
          <select
            onChange={(e) => {
              const id = e.target.value;
              if (!id) return;
              const t = templates.find((x) => x.id === id);
              if (!t) return;
              setGiftLabel(t.label);
              if (t.message) setMessage(t.message);
              setDays(t.defaultExpiresDays || DEFAULT_EXPIRES_DAYS);
              e.target.value = "";
            }}
            defaultValue=""
            disabled={pending}
            className="mt-0.5 w-full rounded border border-amber-400/40 bg-[#0d1530] px-2 py-1 text-[11px] text-white outline-none focus:border-amber-400"
          >
            <option value="">— 골라서 폼 자동 채우기 —</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
      )}

      <label className="block">
        <span className="block text-[10px] font-semibold text-[#a8b8d0]">
          선물 이름 *
        </span>
        <input
          type="text"
          value={giftLabel}
          onChange={(e) => setGiftLabel(e.target.value)}
          placeholder="GS25 5천원 상품권"
          maxLength={120}
          autoFocus
          disabled={pending}
          className="mt-0.5 w-full rounded border border-[#243366] bg-[#0d1530] px-2 py-1 text-[11px] text-white placeholder:text-[#6b7c98] outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400/40"
        />
      </label>

      <label className="block">
        <span className="block text-[10px] font-semibold text-[#a8b8d0]">
          메시지 (선택)
        </span>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="가족 사진 미션 완료 축하 🎉"
          maxLength={200}
          rows={2}
          disabled={pending}
          className="mt-0.5 w-full resize-none rounded border border-[#243366] bg-[#0d1530] px-2 py-1 text-[11px] text-white placeholder:text-[#6b7c98] outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400/40"
        />
      </label>

      <label className="flex items-center gap-2">
        <span className="text-[10px] font-semibold text-[#a8b8d0]">
          만료
        </span>
        <input
          type="number"
          min={0}
          max={365}
          value={days}
          onChange={(e) =>
            setDays(Math.max(0, Math.min(365, Number(e.target.value) || 0)))
          }
          disabled={pending}
          className="w-14 rounded border border-[#243366] bg-[#0d1530] px-1.5 py-1 text-center text-[11px] text-white outline-none focus:border-amber-400"
        />
        <span className="text-[10px] text-[#7a8aa8]">
          일 (0 = 만료 없음)
        </span>
      </label>

      {result && (
        <p
          role="status"
          className={`text-[10px] font-semibold ${
            result.kind === "ok" ? "text-emerald-300" : "text-rose-300"
          }`}
        >
          {result.text}
        </p>
      )}

      <div className="flex gap-1.5">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={pending || !giftLabel.trim()}
          className="flex-1 rounded-md bg-amber-400 px-2 py-1.5 text-[11px] font-bold text-[#0B1538] transition hover:bg-amber-300 disabled:opacity-40"
        >
          {pending ? "발급 중..." : "선물함에 발급"}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            reset();
          }}
          disabled={pending}
          className="rounded-md border border-white/15 bg-white/[0.05] px-2 py-1.5 text-[11px] font-bold text-white/70 transition hover:bg-white/10 disabled:opacity-40"
        >
          취소
        </button>
      </div>
    </div>
  );
}
