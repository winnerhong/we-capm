"use client";

// 매장 카운터 QR 스캐너.
//  - html5-qrcode 로 후면 카메라 자동 시작 (사용자 권한 요청)
//  - 디코드 성공 → normalizeCouponCode → redeemGiftAction 호출
//  - 결과 카드 / 토스트 / 수동 입력 폴백
//  - cleanup 에서 scanner.stop() 필수 (카메라 누수 방지)

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { redeemGiftAction } from "@/lib/gifts/actions";
import {
  GIFT_SOURCE_LABELS,
  formatCouponCode,
  normalizeCouponCode,
  type UserGiftRow,
} from "@/lib/gifts/types";

type Phase = "idle" | "scanning" | "processing" | "success" | "error";

const SCANNER_ELEMENT_ID = "gift-redeem-qr-region";

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("ko-KR", {
    year: "2-digit",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

/** 짧은 success 비프 — Web Audio API. 실패해도 무음으로 fallback. */
function playSuccessBeep() {
  try {
    type WebkitWindow = Window & {
      webkitAudioContext?: typeof AudioContext;
    };
    const w = window as WebkitWindow;
    const Ctx: typeof AudioContext | undefined =
      window.AudioContext ?? w.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(880, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.12);
    g.gain.setValueAtTime(0.001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.28);
    o.onended = () => ctx.close().catch(() => {});
  } catch {
    // 무음 fallback
  }
}

export function RedeemScanner() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string>("");
  const [gift, setGift] = useState<UserGiftRow | null>(null);
  const [showManual, setShowManual] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [pending, startTransition] = useTransition();

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const recentlyScannedRef = useRef<{ code: string; at: number } | null>(null);

  /** 스캐너 정지 — cleanup / 결과 표시 시. 안전하게 swallow. */
  const stopScanner = useCallback(async () => {
    const s = scannerRef.current;
    if (!s) return;
    try {
      await s.stop();
    } catch {
      // 이미 정지된 경우 무시
    }
    try {
      s.clear();
    } catch {
      // 무시
    }
    scannerRef.current = null;
  }, []);

  /** 코드 처리 — 서버 액션 호출 + 결과 표시. */
  const handleCode = useCallback(
    (rawCode: string) => {
      const code = normalizeCouponCode(rawCode);
      if (!code) {
        setError("쿠폰 코드를 인식하지 못했어요");
        setPhase("error");
        return;
      }
      // 동일 코드 1.5초 내 중복 호출 차단 (스캐너가 같은 프레임 여러 번 디코드)
      const now = Date.now();
      const recent = recentlyScannedRef.current;
      if (recent && recent.code === code && now - recent.at < 1500) {
        return;
      }
      recentlyScannedRef.current = { code, at: now };

      setPhase("processing");
      setError("");
      void stopScanner();

      startTransition(() => {
        (async () => {
          try {
            const result = await redeemGiftAction({ couponCode: code });
            setGift(result.gift);
            setPhase("success");
            playSuccessBeep();
          } catch (e) {
            const msg =
              e instanceof Error ? e.message : "수령 처리에 실패했어요";
            setError(msg);
            setPhase("error");
          }
        })();
      });
    },
    [stopScanner]
  );

  /** 카메라 시작. */
  const startScanner = useCallback(async () => {
    if (typeof window === "undefined") return;
    if (scannerRef.current) return; // 이미 실행 중

    setError("");
    setPhase("scanning");
    setGift(null);

    try {
      const el = document.getElementById(SCANNER_ELEMENT_ID);
      if (!el) {
        setError("스캐너 영역을 찾지 못했어요");
        setPhase("error");
        return;
      }
      const scanner = new Html5Qrcode(SCANNER_ELEMENT_ID);
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: (vw, vh) => {
            const min = Math.min(vw, vh);
            const size = Math.floor(min * 0.7);
            return { width: size, height: size };
          },
          aspectRatio: 1.0,
        },
        (decoded) => {
          handleCode(decoded);
        },
        () => {
          // per-frame decode failure — 무시 (정상 흐름)
        }
      );
    } catch (e) {
      const msg =
        e instanceof Error
          ? e.message
          : "카메라를 시작할 수 없어요. 권한을 확인해 주세요";
      setError(msg);
      setPhase("error");
      setShowManual(true); // 카메라 실패시 수동 입력 자동 노출
      scannerRef.current = null;
    }
  }, [handleCode]);

  // 초기 마운트 — 카메라 자동 시작
  useEffect(() => {
    void startScanner();
    return () => {
      void stopScanner();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** [다음 QR 스캔] — 결과 초기화 + 카메라 재시작. */
  const handleNext = useCallback(() => {
    setGift(null);
    setError("");
    setManualCode("");
    recentlyScannedRef.current = null;
    void startScanner();
  }, [startScanner]);

  /** 수동 입력 제출. */
  const handleManualSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (pending) return;
      if (!manualCode.trim()) return;
      handleCode(manualCode);
    },
    [manualCode, pending, handleCode]
  );

  return (
    <div className="space-y-4">
      {/* 결과 영역 */}
      {phase === "success" && gift ? (
        <SuccessCard gift={gift} onNext={handleNext} />
      ) : (
        <>
          {/* 카메라 뷰파인더 */}
          <div className="relative mx-auto aspect-square w-full max-w-[420px] overflow-hidden rounded-3xl border-2 border-dashed border-[#D4E4BC] bg-black">
            <div
              id={SCANNER_ELEMENT_ID}
              className="h-full w-full"
              aria-label="QR 스캐너 카메라"
            />

            {/* 상태 오버레이 */}
            {phase === "processing" || pending ? (
              <div className="absolute inset-0 flex items-center justify-center bg-black/55">
                <div className="flex flex-col items-center gap-2 text-white">
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-white/30 border-t-white" />
                  <p className="text-sm font-bold">처리 중…</p>
                </div>
              </div>
            ) : null}

            {/* 가이드 프레임 */}
            {phase === "scanning" ? (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="h-[70%] w-[70%] rounded-2xl border-2 border-emerald-300/70 shadow-[0_0_0_9999px_rgba(0,0,0,0.25)]" />
              </div>
            ) : null}
          </div>

          {/* 에러 토스트 */}
          {phase === "error" && error ? (
            <div
              role="alert"
              className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700"
            >
              <p className="flex items-center gap-2">
                <span aria-hidden>⚠</span>
                <span>{error}</span>
              </p>
              <button
                type="button"
                onClick={handleNext}
                className="mt-2 inline-flex min-h-[40px] items-center gap-1 rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-rose-700 active:scale-95"
              >
                🔄 다시 스캔
              </button>
            </div>
          ) : null}

          {/* 수동 입력 폴백 */}
          <div className="rounded-2xl border border-[#D4E4BC] bg-white p-4 shadow-sm">
            <button
              type="button"
              onClick={() => setShowManual((v) => !v)}
              className="flex w-full items-center justify-between text-left"
              aria-expanded={showManual}
            >
              <span className="text-sm font-bold text-[#2D5A3D]">
                카메라가 안 되시나요? 8자리 코드 직접 입력
              </span>
              <span
                aria-hidden
                className={`text-[10px] text-[#8B7F75] transition-transform ${
                  showManual ? "rotate-180" : ""
                }`}
              >
                ▼
              </span>
            </button>

            {showManual ? (
              <form onSubmit={handleManualSubmit} className="mt-3 space-y-2">
                <label
                  htmlFor="manual-code"
                  className="block text-[11px] font-bold text-[#6B6560]"
                >
                  쿠폰 코드 (예: K7M3-A29R)
                </label>
                <input
                  id="manual-code"
                  type="text"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value.toUpperCase())}
                  inputMode="text"
                  autoComplete="off"
                  autoCapitalize="characters"
                  placeholder="K7M3-A29R"
                  className="w-full rounded-xl border border-[#D4E4BC] bg-white px-3 py-3 font-mono text-base font-bold tracking-[0.15em] text-[#2D5A3D] focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                />
                <button
                  type="submit"
                  disabled={!manualCode.trim() || pending}
                  className="min-h-[44px] w-full rounded-xl bg-violet-600 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-violet-700 active:scale-[0.99] disabled:opacity-50"
                >
                  {pending ? "처리 중…" : "수령 처리"}
                </button>
              </form>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 수령 성공 결과 카드                                                          */
/* -------------------------------------------------------------------------- */

function SuccessCard({
  gift,
  onNext,
}: {
  gift: UserGiftRow;
  onNext: () => void;
}) {
  return (
    <div className="rounded-3xl border-2 border-emerald-300 bg-gradient-to-br from-emerald-50 to-white p-5 shadow-lg">
      <div className="flex items-center gap-3">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-3xl">
          🎉
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-widest text-emerald-700">
            수령 완료
          </p>
          <p className="truncate text-lg font-extrabold text-[#2D5A3D]">
            {gift.gift_label}
          </p>
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-2 text-[12px]">
        <Field label="받는 분" value={gift.display_name} />
        <Field label="출처" value={GIFT_SOURCE_LABELS[gift.source_type]} />
        <Field label="발급일" value={formatDate(gift.granted_at)} />
        <Field
          label="만료일"
          value={gift.expires_at ? formatDate(gift.expires_at) : "기한 없음"}
        />
        <Field
          label="쿠폰 코드"
          value={formatCouponCode(gift.coupon_code)}
          mono
        />
        <Field label="처리 시각" value={formatDateTime(gift.redeemed_at)} />
      </dl>

      <button
        type="button"
        onClick={onNext}
        className="mt-5 min-h-[48px] w-full rounded-2xl bg-violet-600 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-violet-700 active:scale-[0.99]"
      >
        ✅ 다음 QR 스캔
      </button>
    </div>
  );
}

function Field({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="rounded-xl border border-[#E8E0D0] bg-white px-3 py-2">
      <dt className="text-[10px] font-bold text-[#8B7F75]">{label}</dt>
      <dd
        className={`mt-0.5 truncate font-semibold text-[#2D5A3D] ${
          mono ? "font-mono tracking-wider" : ""
        }`}
      >
        {value}
      </dd>
    </div>
  );
}
