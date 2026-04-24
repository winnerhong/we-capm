// 행사장 스태프용 — 보상 QR 스캔 페이지
import Link from "next/link";
import { requireStaff } from "@/lib/staff-auth";
import { createClient } from "@/lib/supabase/server";
import type { MissionFinalRedemptionRow } from "@/lib/missions/types";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { lookupRedemptionAction } from "./actions";
import { StaffRedeemScanner } from "./_ui/StaffRedeemScanner";

export const dynamic = "force-dynamic";

type SbResp<T> = { data: T[] | null; error: unknown };

async function loadRecentRedemptions(
  limit = 10
): Promise<MissionFinalRedemptionRow[]> {
  const supabase = await createClient();
  const sinceIso = new Date(
    Date.now() - 24 * 60 * 60 * 1000
  ).toISOString();

  const resp = (await (
    supabase.from("mission_final_redemptions" as never) as unknown as {
      select: (c: string) => {
        not: (k: string, op: string, v: null) => {
          gte: (k: string, v: string) => {
            order: (
              c: string,
              o: { ascending: boolean }
            ) => {
              limit: (
                n: number
              ) => Promise<SbResp<MissionFinalRedemptionRow>>;
            };
          };
        };
      };
    }
  )
    .select("*")
    .not("redeemed_at", "is", null)
    .gte("redeemed_at", sinceIso)
    .order("redeemed_at", { ascending: false })
    .limit(limit)) as SbResp<MissionFinalRedemptionRow>;

  return resp.data ?? [];
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleString("ko-KR", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export default async function StaffRedeemPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; err?: string }>;
}) {
  const staff = await requireStaff();
  const sp = await searchParams;
  const recent = await loadRecentRedemptions();

  return (
    <div className="mx-auto max-w-xl space-y-4 p-4 pb-20">
      {/* 헤더 */}
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold text-[#2D5A3D]">
            🎁 보상 교환소
          </h1>
          <p className="mt-0.5 text-[11px] text-[#6B6560]">
            {staff.type === "PARTNER" ? "파트너 스태프" : "기관 스태프"} ·{" "}
            <span className="font-semibold text-[#3D3A36]">{staff.name}</span>
          </p>
        </div>
        <form
          action={async () => {
            "use server";
            const c = await cookies();
            c.delete("campnic_partner");
            c.delete("campnic_org");
            redirect("/partner");
          }}
        >
          <button
            type="submit"
            className="rounded-full border border-[#D4E4BC] bg-white px-3 py-1.5 text-[11px] font-bold text-[#6B6560] transition hover:bg-[#F5F1E8]"
          >
            로그아웃
          </button>
        </form>
      </header>

      {/* 피드백 배너 */}
      {sp.ok === "1" && (
        <div
          role="status"
          className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800"
        >
          ✅ 교환 완료 처리했어요!
        </div>
      )}
      {sp.err === "empty" && (
        <div
          role="alert"
          className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-800"
        >
          ⚠️ QR 또는 토큰을 입력해 주세요
        </div>
      )}

      {/* 스캐너 + 수동 입력 */}
      <section className="rounded-3xl border border-[#D4E4BC] bg-white p-5 shadow-sm">
        <h2 className="flex items-center gap-2 text-base font-bold text-[#2D5A3D]">
          <span aria-hidden>📷</span>
          QR 스캔
        </h2>
        <p className="mt-1 text-[11px] text-[#6B6560]">
          참가자가 보여주는 보상 QR을 카메라로 비춰 주세요
        </p>

        <div className="mt-3">
          <StaffRedeemScanner />
        </div>

        {/* 수동 입력 폼 */}
        <form
          action={async (formData: FormData) => {
            "use server";
            const raw = String(formData.get("token") ?? "");
            await lookupRedemptionAction(raw);
          }}
          className="mt-5 space-y-2 border-t border-dashed border-[#D4E4BC] pt-4"
        >
          <label
            htmlFor="token"
            className="block text-sm font-bold text-[#2D5A3D]"
          >
            또는 토큰 직접 입력
          </label>
          <input
            id="token"
            name="token"
            type="text"
            placeholder="예: fr_abcdef0123456789"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            className="min-h-[48px] w-full rounded-2xl border border-[#D4E4BC] bg-[#FFF8F0] px-4 py-3 font-mono text-sm tracking-wider text-[#3D3A36] outline-none focus:border-[#2D5A3D] focus:ring-2 focus:ring-[#2D5A3D]/20"
          />
          <button
            type="submit"
            className="min-h-[48px] w-full rounded-2xl border-2 border-[#2D5A3D] bg-white px-4 py-2 text-sm font-bold text-[#2D5A3D] shadow-sm transition hover:bg-[#F5F1E8]"
          >
            조회하기
          </button>
        </form>
      </section>

      {/* 최근 교환 내역 */}
      <section className="rounded-3xl border border-[#D4E4BC] bg-white p-5 shadow-sm">
        <h2 className="flex items-center gap-2 text-base font-bold text-[#2D5A3D]">
          <span aria-hidden>🕒</span>
          최근 교환 (24시간)
        </h2>
        {recent.length === 0 ? (
          <p className="mt-3 text-[12px] text-[#6B6560]">
            아직 교환된 내역이 없어요
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-[#D4E4BC]/60">
            {recent.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between py-2.5"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-[#3D3A36]">
                    🎁 {r.tier_label}
                  </p>
                  <p className="truncate text-[11px] text-[#6B6560]">
                    {r.redeemed_by ?? "—"}
                  </p>
                </div>
                <time className="ml-3 shrink-0 text-[11px] font-semibold text-[#6B6560]">
                  {formatDateTime(r.redeemed_at)}
                </time>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="text-center">
        <Link
          href="/partner"
          className="text-[11px] font-semibold text-[#6B6560] hover:underline"
        >
          ← 파트너 홈으로
        </Link>
      </div>
    </div>
  );
}
