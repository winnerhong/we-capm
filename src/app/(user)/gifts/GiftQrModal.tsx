"use client";

// 선물 QR 모달.
//  - qrcode 로 coupon_code 를 raw 인코딩 (URL 아님 — 외부 유출 방지)
//  - Supabase Realtime 으로 user_gifts row UPDATE 구독 → status='redeemed' 시 자동 갱신
//  - 큰 백업 코드 (formatCouponCode) + 만료/출처/발급일 + 선택적 외부 기프티콘 링크

import { useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import { createClient } from "@/lib/supabase/client";
import {
  GIFT_SOURCE_LABELS,
  formatCouponCode,
  type UserGiftRow,
} from "@/lib/gifts/types";

interface Props {
  gift: UserGiftRow;
  userId: string;
  onClose: () => void;
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("ko-KR", {
    year: "numeric",
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

export function GiftQrModal({ gift, userId, onClose }: Props) {
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [current, setCurrent] = useState<UserGiftRow>(gift);
  const closingRef = useRef(false);

  // Body scroll lock
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // ESC 닫기
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  // QR 생성 (coupon_code 만 — raw)
  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(current.coupon_code, {
      width: 280,
      margin: 1,
      errorCorrectionLevel: "M",
      color: { dark: "#2D5A3D", light: "#FFFFFF" },
    })
      .then((url) => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setQrDataUrl("");
      });
    return () => {
      cancelled = true;
    };
  }, [current.coupon_code]);

  // Realtime 구독 — 이 사용자의 user_gifts row UPDATE
  useEffect(() => {
    if (current.status !== "pending") return;
    const supabase = createClient();
    const channel = supabase
      .channel(`user_gifts:${userId}:${current.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "user_gifts",
          filter: `id=eq.${current.id}`,
        } as never,
        (payload: { new: UserGiftRow }) => {
          if (payload?.new) setCurrent(payload.new);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, current.id, current.status]);

  // 수령 완료시 3초 후 자동 닫힘
  useEffect(() => {
    if (current.status === "redeemed" && !closingRef.current) {
      closingRef.current = true;
      const t = setTimeout(() => onClose(), 3000);
      return () => clearTimeout(t);
    }
  }, [current.status, onClose]);

  const formattedCode = useMemo(
    () => formatCouponCode(current.coupon_code),
    [current.coupon_code]
  );

  const isRedeemed = current.status === "redeemed";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="gift-qr-title"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 px-3 pb-3 pt-12 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="relative max-h-[92vh] w-full max-w-md overflow-y-auto rounded-3xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 닫기 */}
        <button
          type="button"
          onClick={onClose}
          aria-label="닫기"
          className="absolute right-3 top-3 z-10 inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-lg font-bold text-[#6B6560] shadow-sm transition hover:bg-rose-50 hover:text-rose-700"
        >
          ×
        </button>

        {/* 헤더 */}
        <div className="rounded-t-3xl bg-gradient-to-br from-[#2D5A3D] via-[#3A7A52] to-[#4A7C59] px-5 pb-5 pt-6 text-center">
          <p className="text-[11px] font-bold uppercase tracking-widest text-[#D4E4BC]">
            {GIFT_SOURCE_LABELS[current.source_type]}
          </p>
          <h2
            id="gift-qr-title"
            className="mt-1.5 break-words text-lg font-extrabold text-white"
          >
            🎁 {current.gift_label}
          </h2>
          <p className="mt-1 text-[11px] text-[#D4E4BC]">
            {current.display_name}
          </p>
        </div>

        {/* 본문 */}
        <div className="px-5 py-5">
          {isRedeemed ? (
            <RedeemedBlock redeemedAt={current.redeemed_at} />
          ) : (
            <PendingBlock
              qrDataUrl={qrDataUrl}
              formattedCode={formattedCode}
              expiresAt={current.expires_at}
              grantedAt={current.granted_at}
            />
          )}

          {/* 메시지 */}
          {current.message ? (
            <blockquote className="mt-4 rounded-2xl border-l-4 border-amber-300 bg-amber-50 px-4 py-3 text-[12px] italic leading-relaxed text-[#6B4423]">
              {current.message}
            </blockquote>
          ) : null}

          {/* 외부 기프티콘 링크 */}
          {current.gift_url ? (
            <a
              href={current.gift_url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-2xl border border-[#D4E4BC] bg-white py-3 text-sm font-bold text-[#2D5A3D] shadow-sm transition hover:bg-[#F5F1E8] active:scale-[0.99]"
            >
              <span aria-hidden>🔗</span>
              <span>기프티콘 링크 열기</span>
            </a>
          ) : null}

          {/* 닫기 (모바일 터치 보조) */}
          <button
            type="button"
            onClick={onClose}
            className="mt-3 min-h-[44px] w-full rounded-2xl bg-[#F5F1E8] py-3 text-sm font-bold text-[#6B6560] transition hover:bg-[#E8F0E4] active:scale-[0.99]"
          >
            닫기
          </button>
        </div>
      </div>

      {/* 폭죽 애니메이션 (수령 완료 시) */}
      {isRedeemed ? <ConfettiBurst /> : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Pending 상태 본문 — QR + 백업 코드 + 메타                                   */
/* -------------------------------------------------------------------------- */

function PendingBlock({
  qrDataUrl,
  formattedCode,
  expiresAt,
  grantedAt,
}: {
  qrDataUrl: string;
  formattedCode: string;
  expiresAt: string | null;
  grantedAt: string;
}) {
  return (
    <>
      {/* QR */}
      <div className="flex justify-center">
        <div className="rounded-3xl border border-[#D4E4BC] bg-white p-4 shadow-sm">
          {qrDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={qrDataUrl}
              alt="선물 QR 코드"
              width={280}
              height={280}
              className="block h-[280px] w-[280px]"
            />
          ) : (
            <div className="flex h-[280px] w-[280px] items-center justify-center text-xs text-[#8B7F75]">
              QR 생성 중…
            </div>
          )}
        </div>
      </div>

      {/* 백업 코드 */}
      <div className="mt-4 rounded-2xl border border-dashed border-[#D4E4BC] bg-[#FFF8F0] px-4 py-3 text-center">
        <p className="text-[10px] font-bold uppercase tracking-widest text-[#6B6560]">
          백업 쿠폰 코드
        </p>
        <p className="mt-1 select-all font-mono text-2xl font-black tracking-[0.15em] text-[#2D5A3D]">
          {formattedCode}
        </p>
      </div>

      {/* 안내 */}
      <p className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-center text-[11px] font-semibold text-emerald-800">
        상품 수령처에서 QR을 스캔하면 자동으로 수령 처리됩니다
      </p>

      {/* 메타 */}
      <dl className="mt-4 grid grid-cols-2 gap-2 text-[11px]">
        <MetaItem label="발급일" value={formatDate(grantedAt)} />
        <MetaItem
          label="만료일"
          value={expiresAt ? formatDate(expiresAt) : "기한 없음"}
          tone={expiresAt ? "warn" : "default"}
        />
      </dl>
    </>
  );
}

function MetaItem({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "warn";
}) {
  return (
    <div className="rounded-xl border border-[#E8E0D0] bg-white px-3 py-2">
      <dt className="text-[10px] font-bold text-[#8B7F75]">{label}</dt>
      <dd
        className={`mt-0.5 font-semibold ${
          tone === "warn" ? "text-rose-600" : "text-[#2D5A3D]"
        }`}
      >
        {value}
      </dd>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Redeemed 상태 본문                                                          */
/* -------------------------------------------------------------------------- */

function RedeemedBlock({ redeemedAt }: { redeemedAt: string | null }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <div className="flex h-24 w-24 items-center justify-center rounded-full bg-emerald-100 text-5xl shadow-inner">
        ✓
      </div>
      <p className="mt-4 text-2xl font-extrabold text-emerald-700">
        수령 완료!
      </p>
      <p className="mt-1.5 text-[12px] text-[#6B6560]">
        {formatDateTime(redeemedAt)}
      </p>
      <p className="mt-3 text-[11px] text-[#8B7F75]">
        잠시 후 자동으로 닫힙니다…
      </p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 폭죽 애니메이션 — 작은 CSS-only 효과 (수령 완료 시 1회)                      */
/* -------------------------------------------------------------------------- */

function ConfettiBurst() {
  // 화면 중앙에서 사방으로 튀어나가는 작은 점들
  const pieces = Array.from({ length: 18 }, (_, i) => i);
  return (
    <div className="pointer-events-none fixed inset-0 z-[60] overflow-hidden">
      {pieces.map((i) => {
        const angle = (i / pieces.length) * 360;
        const dist = 120 + (i % 3) * 30;
        const dx = Math.cos((angle * Math.PI) / 180) * dist;
        const dy = Math.sin((angle * Math.PI) / 180) * dist;
        const colors = ["#FFB35E", "#5EE9F0", "#A8D89A", "#F0A8C5", "#FFE066"];
        const color = colors[i % colors.length];
        return (
          <span
            key={i}
            className="absolute left-1/2 top-1/2 h-2 w-2 rounded-full"
            style={{
              backgroundColor: color,
              animation: "gift-confetti 900ms ease-out forwards",
              ["--dx" as string]: `${dx}px`,
              ["--dy" as string]: `${dy}px`,
            }}
          />
        );
      })}
      <style>{`
        @keyframes gift-confetti {
          0%   { transform: translate(-50%, -50%) scale(0.4); opacity: 1; }
          100% { transform: translate(calc(-50% + var(--dx)), calc(-50% + var(--dy))) scale(1); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
