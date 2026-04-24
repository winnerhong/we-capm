// 보상 QR 티켓 화면
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import QRCode from "qrcode";
import { requireAppUser } from "@/lib/user-auth-guard";
import { createClient } from "@/lib/supabase/server";
import type { MissionFinalRedemptionRow } from "@/lib/missions/types";
import { AcornIcon } from "@/components/acorn-icon";

export const dynamic = "force-dynamic";

async function loadRedemption(
  id: string
): Promise<MissionFinalRedemptionRow | null> {
  if (!id) return null;
  const supabase = await createClient();
  const resp = (await (
    supabase.from("mission_final_redemptions" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          maybeSingle: () => Promise<{
            data: MissionFinalRedemptionRow | null;
          }>;
        };
      };
    }
  )
    .select("*")
    .eq("id", id)
    .maybeSingle()) as { data: MissionFinalRedemptionRow | null };
  return resp.data ?? null;
}

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString("ko-KR", {
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

function formatCountdown(expiresAt: string): string {
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (!Number.isFinite(ms) || ms <= 0) return "만료됨";
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  if (hours > 0) return `${hours}시간 ${minutes}분 남음`;
  return `${minutes}분 남음`;
}

export default async function RewardRedemptionPage({
  params,
}: {
  params: Promise<{ redemptionId: string }>;
}) {
  const user = await requireAppUser();
  const { redemptionId } = await params;

  const redemption = await loadRedemption(redemptionId);
  if (!redemption) notFound();
  if (redemption.user_id !== user.id) redirect("/home");

  const isExpired = new Date(redemption.expires_at) <= new Date();
  const isRedeemed = redemption.redeemed_at != null;

  // Generate QR (data URL)
  const qrDataUrl = await QRCode.toDataURL(redemption.qr_token, {
    width: 480,
    margin: 2,
    errorCorrectionLevel: "M",
  });

  return (
    <div className="space-y-4">
      <nav className="text-[11px] text-[#6B6560]">
        <Link href="/stampbook" className="hover:underline">
          ← 스탬프북으로
        </Link>
      </nav>

      {/* Ticket */}
      <section
        className={`overflow-hidden rounded-3xl border-2 p-5 shadow-lg ${
          isExpired
            ? "border-zinc-300 bg-zinc-50"
            : isRedeemed
              ? "border-sky-300 bg-gradient-to-br from-sky-50 to-white"
              : "border-[#C4956A] bg-gradient-to-br from-[#FAE7D0] via-[#F5D493] to-[#E8B86D]"
        }`}
      >
        <div className="text-center">
          <p className="text-5xl" aria-hidden>
            {isExpired ? "⌛" : isRedeemed ? "✅" : "🎁"}
          </p>
          <p
            className={`mt-2 text-xs font-bold uppercase tracking-widest ${
              isExpired
                ? "text-zinc-500"
                : isRedeemed
                  ? "text-sky-700"
                  : "text-[#6B4423]"
            }`}
          >
            {isExpired
              ? "만료된 교환권"
              : isRedeemed
                ? "사용 완료"
                : "보상 교환권"}
          </p>
          <h1
            className={`mt-1 text-2xl font-extrabold ${
              isExpired
                ? "text-zinc-600"
                : isRedeemed
                  ? "text-sky-900"
                  : "text-[#6B4423]"
            }`}
          >
            {redemption.tier_label}
          </h1>
          <p
            className={`mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/80 px-4 py-2 text-sm font-bold ${
              isExpired
                ? "text-zinc-600"
                : isRedeemed
                  ? "text-sky-800"
                  : "text-[#6B4423]"
            }`}
          >
            <AcornIcon size={18} />
            <span className="tabular-nums">
              {redemption.total_acorns_at_issue}
            </span>
            <span>도토리 달성</span>
          </p>
        </div>

        {/* QR */}
        <div className="mt-5 flex justify-center">
          <div
            className={`rounded-2xl border-4 bg-white p-3 shadow-md ${
              isExpired || isRedeemed
                ? "border-zinc-300 opacity-50 grayscale"
                : "border-[#2D5A3D]"
            }`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={qrDataUrl}
              alt={`보상 교환 QR: ${redemption.tier_label}`}
              className="h-64 w-64"
            />
          </div>
        </div>

        <p
          className={`mt-4 text-center font-mono text-xs tracking-wider ${
            isExpired ? "text-zinc-500" : "text-[#6B4423]/80"
          }`}
        >
          {redemption.qr_token}
        </p>
      </section>

      {/* 안내 */}
      {!isExpired && !isRedeemed && (
        <section className="rounded-3xl border border-[#D4E4BC] bg-white p-5 text-center shadow-sm">
          <p className="text-sm font-bold text-[#2D5A3D]">
            🏕️ 선물 교환소에 이 QR을 보여주세요
          </p>
          <p className="mt-1.5 text-[11px] text-[#6B6560]">
            진행 요원이 스캔하면 보상을 받을 수 있어요
          </p>
          <p className="mt-3 inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-bold text-amber-800">
            ⏰ {formatCountdown(redemption.expires_at)}
          </p>
        </section>
      )}

      {isRedeemed && redemption.redeemed_at && (
        <section className="rounded-3xl border border-sky-200 bg-sky-50 p-4 text-center">
          <p className="text-sm font-semibold text-sky-800">
            🎉 {formatDateTime(redemption.redeemed_at)}에 사용했어요
          </p>
        </section>
      )}

      {isExpired && !isRedeemed && (
        <section className="rounded-3xl border border-zinc-200 bg-zinc-50 p-4 text-center">
          <p className="text-sm font-semibold text-zinc-700">
            교환 기한이 지났어요
          </p>
          <p className="mt-1 text-[11px] text-zinc-600">
            만료: {formatDateTime(redemption.expires_at)}
          </p>
        </section>
      )}

      <Link
        href="/stampbook"
        className="block w-full rounded-2xl border border-[#D4E4BC] bg-white px-4 py-3 text-center text-sm font-bold text-[#2D5A3D] shadow-sm transition hover:bg-[#F5F1E8]"
      >
        ← 스탬프북으로 돌아가기
      </Link>
    </div>
  );
}
