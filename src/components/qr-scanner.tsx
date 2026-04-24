"use client";

// html5-qrcode는 브라우저 전용 (document, navigator.mediaDevices 사용) — SSR에서 import 금지.
// 이 파일은 "use client" 이므로 서버 컴포넌트에서 직접 참조해도 클라이언트 번들로 떨어진다.
import { useEffect, useId, useRef, useState } from "react";
import type { Html5Qrcode as Html5QrcodeType } from "html5-qrcode";

interface Props {
  onScan: (text: string) => void;
  onError?: (err: string) => void;
  expectPrefix?: string;
  buttonLabel?: string;
  className?: string;
}

type ScannerState = "idle" | "requesting" | "scanning" | "error";

export function QrScanner({
  onScan,
  onError,
  expectPrefix,
  buttonLabel = "📷 QR 스캔 시작",
  className,
}: Props) {
  const elementId = useId().replace(/:/g, "_") + "_qr";
  const [state, setState] = useState<ScannerState>("idle");
  const [localError, setLocalError] = useState<string | null>(null);
  const scannerRef = useRef<Html5QrcodeType | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      // 언마운트 시 카메라 확실히 해제
      const inst = scannerRef.current;
      if (inst && inst.isScanning) {
        inst.stop().catch(() => {});
      }
      scannerRef.current = null;
    };
  }, []);

  async function stopScanner() {
    const inst = scannerRef.current;
    if (inst && inst.isScanning) {
      try {
        await inst.stop();
      } catch {
        // ignore
      }
    }
    scannerRef.current = null;
    if (mountedRef.current) setState("idle");
  }

  async function startScanner() {
    setLocalError(null);
    setState("requesting");

    // 동적 import — SSR 번들 오염 방지
    let Html5Qrcode: typeof Html5QrcodeType;
    try {
      const mod = await import("html5-qrcode");
      Html5Qrcode = mod.Html5Qrcode;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "스캐너 로딩 실패";
      setLocalError(msg);
      setState("error");
      onError?.(msg);
      return;
    }

    // DOM element 가 렌더되기까지 다음 tick 대기
    await new Promise((r) => setTimeout(r, 0));
    if (!mountedRef.current) return;

    let inst: Html5QrcodeType;
    try {
      inst = new Html5Qrcode(elementId);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "스캐너 초기화 실패";
      setLocalError(msg);
      setState("error");
      onError?.(msg);
      return;
    }
    scannerRef.current = inst;

    try {
      await inst.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 240, height: 240 },
          aspectRatio: 1.0,
        },
        (decoded) => {
          // 성공 — 접두사 검증
          const text = String(decoded ?? "").trim();
          if (!text) return;
          if (expectPrefix && !text.startsWith(expectPrefix)) {
            // 스캔은 계속하되 경고
            const msg =
              expectPrefix === "mq_"
                ? "이 QR은 미션용이 아니에요"
                : expectPrefix === "fr_"
                  ? "이 QR은 보상 교환권이 아니에요"
                  : "올바른 QR이 아니에요";
            onError?.(msg);
            return;
          }
          // 정상 스캔 — 정지 후 콜백
          stopScanner().finally(() => {
            onScan(text);
          });
        },
        () => {
          // 프레임별 디코드 실패는 무시 (정상 동작)
        }
      );
      if (mountedRef.current) setState("scanning");
    } catch (e) {
      const raw = e instanceof Error ? e.message : String(e);
      const msg = /permission|denied|NotAllowed/i.test(raw)
        ? "카메라 권한이 거부되었어요. 브라우저 설정에서 카메라를 허용해 주세요"
        : /NotFound|no camera/i.test(raw)
          ? "사용 가능한 카메라를 찾을 수 없어요"
          : `카메라를 열 수 없어요: ${raw}`;
      setLocalError(msg);
      setState("error");
      onError?.(msg);
      scannerRef.current = null;
    }
  }

  const isActive = state === "scanning" || state === "requesting";

  return (
    <div className={className}>
      {!isActive ? (
        <button
          type="button"
          onClick={startScanner}
          className="flex min-h-[56px] w-full items-center justify-center gap-2 rounded-2xl border-2 border-[#2D5A3D] bg-[#2D5A3D] px-4 py-3 text-base font-bold text-white shadow-sm transition hover:bg-[#3A7A52] active:scale-[0.99] focus:outline-none focus:ring-4 focus:ring-[#2D5A3D]/30"
          aria-label={buttonLabel}
        >
          {buttonLabel}
        </button>
      ) : (
        <div className="rounded-2xl border border-[#D4E4BC] bg-[#FFF8F0] p-3 shadow-sm">
          <div className="mx-auto aspect-square w-full max-w-[320px] overflow-hidden rounded-xl bg-black">
            <div
              id={elementId}
              className="h-full w-full"
              aria-label="QR 스캐너 영상"
            />
          </div>
          <p className="mt-2 text-center text-[11px] text-[#6B6560]">
            {state === "requesting"
              ? "카메라를 준비하고 있어요…"
              : "QR 코드를 카메라 중앙에 맞춰 주세요"}
          </p>
          <button
            type="button"
            onClick={stopScanner}
            className="mt-2 min-h-[44px] w-full rounded-xl border border-[#D4E4BC] bg-white px-4 py-2 text-sm font-bold text-[#2D5A3D] transition hover:bg-[#F5F1E8] focus:outline-none focus:ring-2 focus:ring-[#2D5A3D]/30"
            aria-label="스캔 취소"
          >
            ❌ 취소
          </button>
        </div>
      )}

      {localError && state === "error" && (
        <div
          role="alert"
          className="mt-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-[12px] font-semibold text-rose-800"
        >
          ⚠️ {localError}
          <p className="mt-1 text-[11px] font-normal text-rose-700/80">
            아래 입력란에 QR 코드 문자를 직접 입력해도 돼요.
          </p>
        </div>
      )}
    </div>
  );
}
