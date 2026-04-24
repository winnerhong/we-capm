import type { ReactNode } from "react";
import { requireAppUser } from "@/lib/user-auth-guard";
import {
  getAcornBalance,
  loadRecentAcornTransactions,
  type AcornReason,
  type AcornTransactionRow,
} from "@/lib/app-user/queries";
import { AcornIcon } from "@/components/acorn-icon";

export const dynamic = "force-dynamic";

const REASON_META: Record<AcornReason, { label: string; icon: ReactNode }> = {
  STAMP_SLOT: { label: "스탬프 적립", icon: <AcornIcon size={20} /> },
  STAMPBOOK_COMPLETE: { label: "스탬프북 완성 보너스", icon: "🏁" },
  CHALLENGE: { label: "챌린지 보상", icon: "🎯" },
  ATTENDANCE: { label: "출석 보상", icon: "🌿" },
  SPEND_COUPON: { label: "쿠폰 사용", icon: "🎫" },
  SPEND_DECORATION: { label: "꾸미기 사용", icon: "🎨" },
  ADMIN_GRANT: { label: "관리자 지급", icon: "🎁" },
  ADMIN_DEDUCT: { label: "관리자 차감", icon: "📉" },
  OTHER: { label: "기타", icon: "✨" },
};

function formatWhen(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export default async function AcornsPage() {
  const user = await requireAppUser();
  const [balance, txs] = await Promise.all([
    getAcornBalance(user.id),
    loadRecentAcornTransactions(user.id, 20),
  ]);

  return (
    <div className="space-y-4">
      {/* Hero */}
      <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-[#2D5A3D] via-[#3A7A52] to-[#4A7C59] px-6 py-8 text-center shadow-lg">
        <p className="text-xs font-semibold uppercase tracking-widest text-[#D4E4BC]">
          도토리 잔액
        </p>
        <p className="mt-3 flex items-center justify-center gap-2 text-5xl font-black text-white">
          <AcornIcon size={48} />
          <span className="tabular-nums">{balance}</span>
        </p>
        <p className="mt-2 text-xs text-[#D4E4BC]">도토리</p>
      </section>

      {/* Info card */}
      <section className="rounded-3xl border border-[#D4E4BC] bg-[#FAE7D0]/50 p-5 shadow-sm">
        <p className="text-sm font-bold text-[#6B4423]"><AcornIcon className="text-[#6B4423]" /> 도토리가 뭐예요?</p>
        <p className="mt-1.5 text-xs leading-relaxed text-[#6B4423]/90">
          도토리는 스탬프를 찍을 때마다 쌓여요. 숲길을 완주하면 보너스 도토리를
          받아요!
        </p>
      </section>

      {/* Transactions */}
      <section className="rounded-3xl border border-[#D4E4BC] bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-[#2D5A3D]">최근 내역</h2>
          <span className="text-[11px] text-[#6B6560]">
            최근 {txs.length}건
          </span>
        </div>

        {txs.length === 0 ? (
          <div className="mt-4 rounded-2xl bg-[#F5F1E8] px-4 py-6 text-center">
            <p className="text-3xl" aria-hidden>
              🐿️
            </p>
            <p className="mt-2 text-sm font-bold text-[#6B6560]">
              아직 쌓인 도토리 없음
            </p>
            <p className="mt-0.5 text-[11px] text-[#8B7F75]">
              스탬프를 찍으면 여기에 기록돼요
            </p>
          </div>
        ) : (
          <ul className="mt-3 space-y-2">
            {txs.map((tx) => (
              <TxRow key={tx.id} tx={tx} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function TxRow({ tx }: { tx: AcornTransactionRow }) {
  const meta = REASON_META[tx.reason] ?? REASON_META.OTHER;
  const positive = tx.amount > 0;
  return (
    <li className="flex items-center gap-3 rounded-2xl border border-[#E8E0D0] bg-[#FFF8F0] px-4 py-3">
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg ${
          positive ? "bg-[#D4E4BC]" : "bg-[#FAE7D0]"
        }`}
        aria-hidden
      >
        {meta.icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-[#2D5A3D]">
          {meta.label}
        </p>
        <p className="truncate text-[11px] text-[#8B7F75]">
          {tx.memo ? `${tx.memo} · ` : ""}
          {formatWhen(tx.created_at)}
        </p>
      </div>
      <p
        className={`shrink-0 font-mono text-sm font-bold tabular-nums ${
          positive ? "text-[#2D5A3D]" : "text-rose-700"
        }`}
      >
        {positive ? "+" : ""}
        {tx.amount} <AcornIcon />
      </p>
    </li>
  );
}
