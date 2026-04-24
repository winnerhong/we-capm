import Link from "next/link";
import { requirePartner } from "@/lib/auth-guard";
import { createClient } from "@/lib/supabase/server";
import { requestReviewAction } from "../actions";

export const dynamic = "force-dynamic";

type RegistrationRow = {
  id: string;
  name: string | null;
  phone: string | null;
  status: string | null;
  entered_at: string | null;
  created_at: string | null;
  review_requested_at: string | null;
  event_id: string | null;
};

function formatPhone(phone: string | null): string {
  if (!phone) return "-";
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 11) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  }
  return phone;
}

function formatDate(iso: string | null): string {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleDateString("ko-KR", {
      month: "short",
      day: "numeric",
    });
  } catch {
    return "-";
  }
}

function maskName(name: string | null): string {
  if (!name) return "이름 없음";
  const trimmed = name.trim();
  if (trimmed.length <= 1) return trimmed;
  if (trimmed.length === 2) return `${trimmed[0]}*`;
  return `${trimmed[0]}${"*".repeat(trimmed.length - 2)}${trimmed.slice(-1)}`;
}

async function loadAttendedRegistrations(partnerId: string): Promise<RegistrationRow[]> {
  const supabase = await createClient();
  const thirtyDaysAgo = new Date(
    Date.now() - 30 * 24 * 60 * 60 * 1000
  ).toISOString();

  try {
    const { data } = await (supabase.from("event_registrations" as never) as any)
      .select(
        "id,name,phone,status,entered_at,created_at,review_requested_at,event_id,partner_id"
      )
      .eq("partner_id", partnerId)
      .eq("status", "ATTENDED")
      .gte("entered_at", thirtyDaysAgo)
      .order("entered_at", { ascending: false })
      .limit(50);
    return (data ?? []) as RegistrationRow[];
  } catch {
    // partner_id 컬럼이 없거나 review_requested_at 컬럼 없을 수 있음 → fallback
    try {
      const { data } = await (
        supabase.from("event_registrations" as never) as any
      )
        .select("id,name,phone,status,entered_at,created_at,event_id")
        .eq("status", "ATTENDED")
        .gte("entered_at", thirtyDaysAgo)
        .order("entered_at", { ascending: false })
        .limit(50);
      return (data ?? []) as RegistrationRow[];
    } catch {
      return [];
    }
  }
}

export default async function ReviewRequestPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string }>;
}) {
  const params = await searchParams;
  const partner = await requirePartner();
  const registrations = await loadAttendedRegistrations(partner.id);

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 space-y-6">
      {/* Breadcrumb */}
      <nav aria-label="breadcrumb" className="text-xs text-[#8B7F75]">
        <Link href="/partner/dashboard" className="hover:text-[#2D5A3D]">
          대시보드
        </Link>
        <span className="mx-2">/</span>
        <Link href="/partner/marketing" className="hover:text-[#2D5A3D]">
          마케팅
        </Link>
        <span className="mx-2">/</span>
        <Link href="/partner/marketing/reviews" className="hover:text-[#2D5A3D]">
          리뷰 관리
        </Link>
        <span className="mx-2">/</span>
        <span className="font-semibold text-[#2D5A3D]">리뷰 요청</span>
      </nav>

      {/* 헤더 */}
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-[#2D5A3D] md:text-3xl">
          <span>📤</span>
          <span>리뷰 요청 보내기</span>
        </h1>
        <p className="mt-1 text-sm text-[#6B6560]">
          최근 30일 안에 숲에 다녀간 가족에게 후기를 요청해요
        </p>
      </header>

      {params.ok ? (
        <div className="rounded-2xl border border-[#D4E4BC] bg-[#F8FBF5] p-4 text-sm font-semibold text-[#2D5A3D]">
          ✅ 리뷰 요청 문자를 예약했어요! 잠시 후 고객에게 발송됩니다.
        </div>
      ) : null}

      {/* 안내 박스 */}
      <section className="rounded-2xl border border-[#E5D3B8] bg-gradient-to-br from-[#FFF8F0] to-[#FAE7D0] p-5">
        <h2 className="flex items-center gap-2 text-sm font-bold text-[#6B4423]">
          <span>💡</span>
          <span>발송 예시 문구</span>
        </h2>
        <blockquote className="mt-2 rounded-xl border border-[#E5D3B8] bg-white/80 p-3 text-xs text-[#6B4423]">
          [토리로] {partner.name} 숲 방문 감사드려요 🌳 소중한 후기를 남겨주시면
          다음 방문 때 사용할 수 있는 쿠폰을 드려요. [링크]
        </blockquote>
      </section>

      {/* 목록 */}
      {registrations.length === 0 ? (
        <section className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#D4E4BC] bg-[#FFF8F0] px-4 py-16 text-center">
          <div className="text-4xl">🌲</div>
          <p className="mt-3 text-base font-semibold text-[#2D5A3D]">
            최근 방문 완료 고객이 없어요
          </p>
          <p className="mt-1 text-xs text-[#6B6560]">
            고객이 체크인 완료되면 이곳에 자동으로 뜹니다.
          </p>
          <Link
            href="/partner/marketing/reviews"
            className="mt-4 inline-flex items-center rounded-xl border border-[#D4E4BC] bg-white px-4 py-2 text-xs font-semibold text-[#6B6560] hover:bg-[#FFF8F0]"
          >
            ← 리뷰 관리로 돌아가기
          </Link>
        </section>
      ) : (
        <section className="overflow-hidden rounded-2xl border border-[#D4E4BC] bg-white shadow-sm">
          <div className="border-b border-[#D4E4BC] bg-[#FFF8F0] px-5 py-3 text-xs font-semibold text-[#6B6560]">
            최근 30일 방문 완료 고객 · 총{" "}
            <b className="text-[#2D5A3D]">
              {registrations.length.toLocaleString("ko-KR")}
            </b>
            명
          </div>
          <ul className="divide-y divide-[#F0EBE3]">
            {registrations.map((reg) => {
              const alreadyRequested = Boolean(reg.review_requested_at);
              return (
                <li
                  key={reg.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <div
                        aria-hidden
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#E8F0E4] text-sm font-bold text-[#2D5A3D]"
                      >
                        {(reg.name ?? "?").charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-bold text-[#2D5A3D]">
                          {maskName(reg.name)}
                        </div>
                        <div className="truncate text-[11px] text-[#6B6560]">
                          {formatPhone(reg.phone)} · 방문{" "}
                          {formatDate(reg.entered_at ?? reg.created_at)}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {alreadyRequested ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-[#E8F0E4] px-3 py-1 text-[11px] font-semibold text-[#2D5A3D]">
                        ✅ 요청 완료
                      </span>
                    ) : (
                      <form
                        action={async () => {
                          "use server";
                          await requestReviewAction(reg.id);
                        }}
                      >
                        <button
                          type="submit"
                          className="inline-flex items-center gap-1.5 rounded-xl bg-[#2D5A3D] px-3 py-1.5 text-xs font-bold text-white transition hover:bg-[#3A7A52]"
                        >
                          <span>📤</span>
                          <span>리뷰 요청 보내기</span>
                        </button>
                      </form>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
