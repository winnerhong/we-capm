// 스태프 스캔 결과 확인/확정 페이지
import Link from "next/link";
import { requireStaff } from "@/lib/staff-auth";
import { createClient } from "@/lib/supabase/server";
import { loadFinalRedemptionByToken } from "@/lib/missions/queries";
import { confirmRedemptionAction } from "../../actions";
import { AcornIcon } from "@/components/acorn-icon";

export const dynamic = "force-dynamic";

type SbRespOne<T> = { data: T | null; error: unknown };

async function loadUserAndOrg(userId: string): Promise<{
  parentName: string;
  orgName: string;
}> {
  const supabase = await createClient();

  const userResp = (await (
    supabase.from("app_users" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          maybeSingle: () => Promise<
            SbRespOne<{ parent_name: string | null; org_id: string | null }>
          >;
        };
      };
    }
  )
    .select("parent_name, org_id")
    .eq("id", userId)
    .maybeSingle()) as SbRespOne<{
    parent_name: string | null;
    org_id: string | null;
  }>;

  const parentName = userResp.data?.parent_name ?? "—";
  const orgId = userResp.data?.org_id ?? null;

  let orgName = "—";
  if (orgId) {
    const orgResp = (await (
      supabase.from("partner_orgs" as never) as unknown as {
        select: (c: string) => {
          eq: (k: string, v: string) => {
            maybeSingle: () => Promise<
              SbRespOne<{ org_name: string | null }>
            >;
          };
        };
      }
    )
      .select("org_name")
      .eq("id", orgId)
      .maybeSingle()) as SbRespOne<{ org_name: string | null }>;
    orgName = orgResp.data?.org_name ?? "—";
  }

  return { parentName, orgName };
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "-";
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

export default async function VerifyRedemptionPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const staff = await requireStaff();
  const { token: rawToken } = await params;
  const token = decodeURIComponent(rawToken ?? "").trim();

  const redemption = await loadFinalRedemptionByToken(token);

  // 1) 유효하지 않은 QR
  if (!redemption) {
    return (
      <div className="mx-auto max-w-xl space-y-4 p-4 pb-20">
        <header>
          <h1 className="text-xl font-extrabold text-[#2D5A3D]">
            🎁 보상 교환소
          </h1>
          <p className="mt-0.5 text-[11px] text-[#6B6560]">
            스태프: {staff.name}
          </p>
        </header>

        <section className="rounded-3xl border-2 border-rose-300 bg-rose-50 p-6 text-center shadow-sm">
          <p className="text-5xl" aria-hidden>
            ❌
          </p>
          <h2 className="mt-3 text-xl font-extrabold text-rose-900">
            유효하지 않은 QR
          </h2>
          <p className="mt-2 text-sm font-semibold text-rose-800">
            이 토큰에 해당하는 교환권을 찾을 수 없어요
          </p>
          <p className="mt-3 font-mono text-[11px] tracking-wider text-rose-700/80">
            {token || "(빈 토큰)"}
          </p>
        </section>

        <Link
          href="/staff/redeem"
          className="block min-h-[48px] w-full rounded-2xl bg-[#2D5A3D] px-4 py-3 text-center text-sm font-bold text-white shadow-sm transition hover:bg-[#3A7A52]"
        >
          ← 다시 스캔하기
        </Link>
      </div>
    );
  }

  const isExpired = new Date(redemption.expires_at) <= new Date();
  const isRedeemed = redemption.redeemed_at != null;
  const { parentName, orgName } = await loadUserAndOrg(redemption.user_id);

  // 서버 액션: form action 시그니처로 감싸기 (FormData → token 바인딩)
  async function confirmAction() {
    "use server";
    await confirmRedemptionAction(token);
  }

  return (
    <div className="mx-auto max-w-xl space-y-4 p-4 pb-20">
      <header>
        <h1 className="text-xl font-extrabold text-[#2D5A3D]">
          🎁 보상 교환소
        </h1>
        <p className="mt-0.5 text-[11px] text-[#6B6560]">
          스태프: <span className="font-semibold">{staff.name}</span>
        </p>
      </header>

      {/* 상태 배너 */}
      {isRedeemed && (
        <section className="rounded-3xl border-2 border-sky-300 bg-sky-50 p-5 text-center shadow-sm">
          <p className="text-4xl" aria-hidden>
            ✅
          </p>
          <h2 className="mt-2 text-lg font-extrabold text-sky-900">
            이미 교환된 QR이에요
          </h2>
          <p className="mt-2 text-sm text-sky-800">
            교환일:{" "}
            <strong>{formatDateTime(redemption.redeemed_at)}</strong>
          </p>
          <p className="mt-0.5 text-sm text-sky-800">
            담당: <strong>{redemption.redeemed_by ?? "—"}</strong>
          </p>
        </section>
      )}

      {!isRedeemed && isExpired && (
        <section className="rounded-3xl border-2 border-zinc-300 bg-zinc-50 p-5 text-center shadow-sm">
          <p className="text-4xl" aria-hidden>
            ⌛
          </p>
          <h2 className="mt-2 text-lg font-extrabold text-zinc-700">
            만료된 교환권이에요
          </h2>
          <p className="mt-2 text-sm text-zinc-700">
            만료일:{" "}
            <strong>{formatDateTime(redemption.expires_at)}</strong>
          </p>
        </section>
      )}

      {/* 교환권 상세 */}
      <section
        className={`overflow-hidden rounded-3xl border-2 p-5 shadow-sm ${
          isExpired || isRedeemed
            ? "border-zinc-300 bg-white"
            : "border-[#C4956A] bg-gradient-to-br from-[#FAE7D0] via-[#F5D493] to-[#E8B86D]"
        }`}
      >
        <p
          className={`text-[10px] font-bold uppercase tracking-widest ${
            isExpired || isRedeemed ? "text-zinc-500" : "text-[#6B4423]"
          }`}
        >
          보상 티어
        </p>
        <h2
          className={`mt-1 text-3xl font-extrabold ${
            isExpired || isRedeemed
              ? "bg-gradient-to-br from-zinc-600 to-zinc-500 bg-clip-text text-transparent"
              : "bg-gradient-to-br from-[#6B4423] via-[#8B5A2B] to-[#6B4423] bg-clip-text text-transparent"
          }`}
        >
          {redemption.tier_label}
        </h2>

        <dl className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="font-semibold text-[#6B4423]/80">참여자</dt>
            <dd className="font-bold text-[#3D3A36]">{parentName}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="font-semibold text-[#6B4423]/80">소속 기관</dt>
            <dd className="font-bold text-[#3D3A36]">{orgName}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="font-semibold text-[#6B4423]/80">누적 도토리</dt>
            <dd className="font-bold text-[#3D3A36] tabular-nums">
              <AcornIcon /> {redemption.total_acorns_at_issue}
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="font-semibold text-[#6B4423]/80">만료</dt>
            <dd className="font-bold text-[#3D3A36]">
              {formatDateTime(redemption.expires_at)}
            </dd>
          </div>
        </dl>

        <p className="mt-4 break-all font-mono text-[10px] tracking-wider text-[#6B4423]/70">
          {redemption.qr_token}
        </p>
      </section>

      {/* 확정 버튼 (아직 교환 전 & 만료 전) */}
      {!isRedeemed && !isExpired && (
        <form action={confirmAction} className="space-y-2">
          <button
            type="submit"
            className="min-h-[64px] w-full rounded-2xl bg-emerald-600 px-4 py-3 text-lg font-extrabold text-white shadow-md transition hover:bg-emerald-700 active:scale-[0.99] focus:outline-none focus:ring-4 focus:ring-emerald-500/30"
          >
            ✅ 교환 완료 확정
          </button>
          <p className="text-center text-[11px] text-[#6B6560]">
            한 번 확정하면 되돌릴 수 없어요
          </p>
        </form>
      )}

      <Link
        href="/staff/redeem"
        className="block min-h-[48px] w-full rounded-2xl border border-[#D4E4BC] bg-white px-4 py-3 text-center text-sm font-bold text-[#2D5A3D] shadow-sm transition hover:bg-[#F5F1E8]"
      >
        ← 다른 QR 스캔하기
      </Link>
    </div>
  );
}
