import Link from "next/link";
import type { ReactNode } from "react";
import { requireEventContext } from "@/lib/event-context";
import { EventLocked } from "@/components/event-locked";
import { F } from "@/lib/features/codes";
import { loadEventsForUser } from "@/lib/org-events/queries";
import {
  getEventAcornBalance,
  loadEventAcornTransactions,
} from "@/lib/app-user/event-acorns";
import {
  type AcornReason,
  type AcornTransactionRow,
} from "@/lib/app-user/queries";
import { AcornIcon } from "@/components/acorn-icon";
import { fmtDateTimeKst } from "@/lib/datetime/kst";

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
    return fmtDateTimeKst(iso);
  } catch {
    return iso;
  }
}

export default async function AcornsPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const ctx = await requireEventContext(eventId);

  // 기관이 안 쓰는 기능. 메뉴·탭에서는 이미 빠져 있지만 북마크·옛 링크로
  // 직접 들어올 수 있다 — 빈 화면 대신 사실을 말하고 돌려보낸다.
  if (!ctx.hasFeature(F.ACORN)) {
    return (
      <EventLocked
        icon="🌰"
        title="도토리"
        notice="이 행사에서는 사용하지 않는 기능이에요"
        homeHref={ctx.href()}
      />
    );
  }

  const user = ctx.user;
  // 행사 시작 전에는 도토리 내역이 의미가 없다. 끝난 뒤에는 남는다.
  /* 말없이 행사홈으로 되돌리지 않는다 — 하단 탭이 늘 다섯 칸이라, 되돌리기만 하면
     참가자에겐 '눌러도 아무 일 없는 탭' 이 된다. 왜 못 쓰는지 말하고 돌아갈 길을 준다. */
  if (ctx.access.phase === "upcoming") {
    return (
      <EventLocked
        icon={"🌰"}
        title="도토리"
        notice={ctx.access.notice ?? "행사가 시작되면 열려요"}
        homeHref={ctx.href()}
      />
    );
  }
  const [balance, txs, myEvents] = await Promise.all([
    getEventAcornBalance(user.id, eventId),
    loadEventAcornTransactions(user.id, eventId, 20),
    loadEventsForUser(user.id).catch(() => []),
  ]);

  // 도토리가 행사별로 나뉘면서, 여러 행사에 다니는 가족은 "내 도토리가
  // 줄었나?" 로 읽을 수 있다. 다른 행사가 있을 때만 짚어 준다.
  const hasOtherEvents = myEvents.some((e) => e.id !== eventId);

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
        <p className="mt-2 text-xs text-[#D4E4BC]">
          {ctx.event.name} 에서 모은 도토리
        </p>
      </section>

      {hasOtherEvents && (
        <section className="rounded-2xl border border-[#D4E4BC] bg-white/80 px-4 py-3 shadow-sm">
          <p className="text-[11px] leading-relaxed text-[#6B6560]">
            🌰 도토리는 <b className="text-[#2D5A3D]">행사마다 따로</b> 모여요.
            다른 행사에서 모은 도토리는 그 행사 화면에서 볼 수 있어요.
          </p>
          <Link
            href="/home"
            className="mt-2 inline-flex text-[11px] font-bold text-[#3A7A52] hover:underline"
          >
            내 행사 전체 보기 →
          </Link>
        </section>
      )}

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
