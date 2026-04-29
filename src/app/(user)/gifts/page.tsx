// 참가자 선물함 — SSR. user_gifts 를 그대로 보여주고, QR 보기는 클라이언트 모달이 담당.

import { requireAppUser } from "@/lib/user-auth-guard";
import { loadUserGifts } from "@/lib/gifts/queries";
import {
  GIFT_SOURCE_LABELS,
  isGiftEffectivelyExpired,
  type UserGiftRow,
} from "@/lib/gifts/types";
import { GiftCardClient } from "./GiftCardClient";

export const dynamic = "force-dynamic";

function formatGrantedDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}.${m}.${day}`;
}

function formatRedeemedAt(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("ko-KR", {
    year: "2-digit",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function daysUntilExpire(iso: string | null, now: Date = new Date()): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const diffMs = d.getTime() - now.getTime();
  if (diffMs <= 0) return 0;
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

export default async function UserGiftsPage() {
  const user = await requireAppUser();
  const gifts = await loadUserGifts(user.id);
  const now = new Date();

  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-[#2D5A3D]">
          <span aria-hidden>🎁</span> 선물함
        </h1>
        <span className="rounded-full border border-[#D4E4BC] bg-white px-3 py-1 text-xs font-bold text-[#2D5A3D]">
          {gifts.length}개
        </span>
      </header>

      {gifts.length === 0 ? (
        <EmptyState />
      ) : (
        <ul className="space-y-3">
          {gifts.map((gift) => {
            const effectivelyExpired = isGiftEffectivelyExpired(gift, now);
            const displayStatus: "pending" | "redeemed" | "expired" | "cancelled" =
              effectivelyExpired ? "expired" : gift.status;
            const daysLeft = daysUntilExpire(gift.expires_at, now);
            const showExpireWarning =
              displayStatus === "pending" &&
              daysLeft !== null &&
              daysLeft <= 7;

            return (
              <GiftCard
                key={gift.id}
                gift={gift}
                displayStatus={displayStatus}
                daysLeft={daysLeft}
                showExpireWarning={showExpireWarning}
              />
            );
          })}
        </ul>
      )}
    </div>
  );
}

function GiftCard({
  gift,
  displayStatus,
  daysLeft,
  showExpireWarning,
}: {
  gift: UserGiftRow;
  displayStatus: "pending" | "redeemed" | "expired" | "cancelled";
  daysLeft: number | null;
  showExpireWarning: boolean;
}) {
  const grantedFmt = formatGrantedDate(gift.granted_at);
  const sourceLabel = GIFT_SOURCE_LABELS[gift.source_type];

  return (
    <li>
      <article className="rounded-3xl border border-[#D4E4BC] bg-white p-4 shadow-sm">
        <div className="flex items-start gap-3">
          {/* 좌측 아이콘 */}
          <div
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-3xl"
            aria-hidden
          >
            🎁
          </div>

          {/* 본문 */}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-[#2D5A3D]">
              {gift.gift_label}
            </p>
            <p className="mt-0.5 truncate text-[11px] text-[#6B6560]">
              {sourceLabel} · {grantedFmt}
            </p>
            {gift.message ? (
              <p className="mt-1 line-clamp-2 text-[11px] text-[#8B7F75]">
                {gift.message}
              </p>
            ) : null}
            {showExpireWarning ? (
              <p className="mt-1 text-[11px] font-semibold text-rose-600">
                ⚠ {daysLeft === 0 ? "오늘" : `${daysLeft}일 후`} 만료
              </p>
            ) : null}
          </div>

          {/* 우측 상태/액션 */}
          <div className="flex shrink-0 flex-col items-end gap-1.5">
            <StatusBadge status={displayStatus} />
            {displayStatus === "pending" ? (
              <GiftCardClient gift={gift} userId={gift.user_id} />
            ) : displayStatus === "redeemed" ? (
              <span className="text-[10px] text-[#8B7F75]">
                {formatRedeemedAt(gift.redeemed_at)}
              </span>
            ) : null}
          </div>
        </div>
      </article>
    </li>
  );
}

function StatusBadge({
  status,
}: {
  status: "pending" | "redeemed" | "expired" | "cancelled";
}) {
  const map: Record<typeof status, { label: string; cls: string }> = {
    pending: {
      label: "수령 가능",
      cls: "bg-emerald-100 text-emerald-700 border-emerald-200",
    },
    redeemed: {
      label: "수령 완료",
      cls: "bg-gray-100 text-gray-600 border-gray-200",
    },
    expired: {
      label: "기간 만료",
      cls: "bg-rose-100 text-rose-700 border-rose-200",
    },
    cancelled: {
      label: "취소됨",
      cls: "bg-gray-100 text-gray-500 border-gray-200",
    },
  };
  const v = map[status];
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold ${v.cls}`}
    >
      {v.label}
    </span>
  );
}

function EmptyState() {
  return (
    <div className="rounded-3xl border border-dashed border-[#D4E4BC] bg-white/70 p-8 text-center">
      <div className="text-5xl" aria-hidden>
        🎁
      </div>
      <p className="mt-3 text-sm font-bold text-[#2D5A3D]">
        아직 받은 선물이 없어요
      </p>
      <p className="mt-1.5 text-xs leading-relaxed text-[#6B6560]">
        라이브 방송 가위바위보에서 우승하면
        <br />
        선물이 도착해요
      </p>
    </div>
  );
}
