import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getParticipant } from "@/lib/participant-session";
import { MarketingTogglesCard } from "./marketing-toggles";

export const dynamic = "force-dynamic";

export default async function MyPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ updated?: string }>;
}) {
  const { id } = await params;
  const { updated } = await searchParams;

  const session = await getParticipant(id);
  if (!session) redirect("/join");

  const supabase = await createClient();

  // 기본 정보
  const { data: participant } = await (
    supabase.from("participants") as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          eq: (k: string, v: string) => {
            maybeSingle: () => Promise<{
              data: { id: string; total_score: number; joined_at: string } | null;
            }>;
          };
        };
      };
    }
  )
    .select("id,total_score,joined_at")
    .eq("event_id", id)
    .eq("phone", session.phone)
    .maybeSingle();

  const { data: registration } = await (
    supabase.from("event_registrations") as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          eq: (k: string, v: string) => {
            maybeSingle: () => Promise<{
              data: {
                id: string;
                name: string;
                phone: string;
                created_at: string;
                status: string;
              } | null;
            }>;
          };
        };
      };
    }
  )
    .select("id,name,phone,created_at,status")
    .eq("event_id", id)
    .eq("phone", session.phone)
    .maybeSingle();

  // 활동 통계
  let submissionsCount = 0;
  let rewardsCount = 0;
  let completedMissionsCount = 0;
  if (participant) {
    const { count: subCnt } = await (
      supabase.from("submissions") as unknown as {
        select: (c: string, opts: { count: "exact"; head: true }) => {
          eq: (k: string, v: string) => Promise<{ count: number | null }>;
        };
      }
    )
      .select("id", { count: "exact", head: true })
      .eq("participant_id", participant.id);
    submissionsCount = subCnt ?? 0;

    const { count: approvedCnt } = await (
      supabase.from("submissions") as unknown as {
        select: (c: string, opts: { count: "exact"; head: true }) => {
          eq: (k: string, v: string) => {
            in: (k: string, v: string[]) => Promise<{ count: number | null }>;
          };
        };
      }
    )
      .select("id", { count: "exact", head: true })
      .eq("participant_id", participant.id)
      .in("status", ["APPROVED", "AUTO_APPROVED"]);
    completedMissionsCount = approvedCnt ?? 0;

    const { count: rewCnt } = await (
      supabase.from("reward_claims") as unknown as {
        select: (c: string, opts: { count: "exact"; head: true }) => {
          eq: (k: string, v: string) => Promise<{ count: number | null }>;
        };
      }
    )
      .select("id", { count: "exact", head: true })
      .eq("participant_id", participant.id);
    rewardsCount = rewCnt ?? 0;
  }

  // 작성 후기 수 (phone 기반)
  const { count: reviewsCnt } = await (
    supabase.from("event_reviews") as unknown as {
      select: (c: string, opts: { count: "exact"; head: true }) => {
        eq: (k: string, v: string) => Promise<{ count: number | null }>;
      };
    }
  )
    .select("id", { count: "exact", head: true })
    .eq("participant_phone", session.phone);

  // 총 참여 행사 수
  const { count: eventsCnt } = await (
    supabase.from("event_registrations") as unknown as {
      select: (c: string, opts: { count: "exact"; head: true }) => {
        eq: (k: string, v: string) => Promise<{ count: number | null }>;
      };
    }
  )
    .select("id", { count: "exact", head: true })
    .eq("phone", session.phone);

  // 누적 결제액 (PAID + CONFIRMED 인보이스)
  let totalSpent = 0;
  {
    const { data: paidInvoices } = await supabase
      .from("invoices")
      .select("total_amount, status")
      .eq("target_type", "PARTICIPANT")
      .eq("target_phone", session.phone)
      .in("status", ["PAID", "CONFIRMED"]);
    totalSpent = (paidInvoices ?? []).reduce(
      (sum, inv) => sum + (inv.total_amount ?? 0),
      0
    );
  }

  const joinedDate = participant?.joined_at ?? registration?.created_at ?? null;

  return (
    <main className="min-h-dvh bg-neutral-50 p-4 pb-28">
      <div className="mx-auto max-w-lg space-y-4">
        {/* Header */}
        <div className="rounded-2xl bg-gradient-to-br from-[#2D5A3D] via-[#3A7A52] to-[#4A7C59] p-5 text-white shadow-lg">
          <div className="flex items-center gap-3">
            <div className="text-3xl">🌲</div>
            <div>
              <h1 className="text-xl font-bold">나의 숲 기록</h1>
              <p className="mt-0.5 text-xs opacity-90">개인정보 열람 및 설정</p>
            </div>
          </div>
          <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-[11px] font-semibold">
            <span>🛡️</span>
            <span>개인정보보호법 제35~37조 보장</span>
          </div>
        </div>

        {updated && (
          <div
            role="status"
            aria-live="polite"
            className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
          >
            ✅ 정보가 업데이트되었어요.
          </div>
        )}

        {/* 1. 기본 정보 */}
        <section className="rounded-2xl border border-[#D4E4BC] bg-white p-5 shadow-sm">
          <h2 className="mb-3 flex items-center gap-2 text-base font-bold text-[#2D5A3D]">
            <span>🌿</span>
            <span>기본 정보</span>
            <span className="ml-auto rounded-full bg-[#D4E4BC] px-2 py-0.5 text-[10px] font-semibold text-[#2D5A3D]">
              열람권 (제35조)
            </span>
          </h2>
          <dl className="space-y-2.5 text-sm">
            <InfoRow label="이름" value={session.name} />
            <InfoRow label="전화번호" value={formatPhone(session.phone)} />
            <InfoRow
              label="가입일"
              value={joinedDate ? new Date(joinedDate).toLocaleString("ko-KR") : "-"}
            />
            <InfoRow
              label="상태"
              value={registration?.status === "CHECKED_IN" ? "입장 완료" : "등록 완료"}
            />
          </dl>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <StatBox
              icon="🌰"
              label="도토리 잔액"
              value={`${participant?.total_score ?? 0}개`}
            />
            <StatBox
              icon="🐾"
              label="완료 숲길"
              value={`${completedMissionsCount}개`}
            />
          </div>
        </section>

        {/* 2. 내 활동 기록 */}
        <section className="rounded-2xl border border-[#D4E4BC] bg-white p-5 shadow-sm">
          <h2 className="mb-3 flex items-center gap-2 text-base font-bold text-[#2D5A3D]">
            <span>📚</span>
            <span>내 활동 기록</span>
          </h2>
          <div className="grid grid-cols-3 gap-2">
            <StatBox icon="🎪" label="참여 행사" value={`${eventsCnt ?? 0}`} />
            <StatBox icon="🎁" label="보상" value={`${rewardsCount}`} />
            <StatBox icon="📝" label="후기" value={`${reviewsCnt ?? 0}`} />
          </div>
          <div className="mt-2 grid grid-cols-1 gap-2">
            <StatBox
              icon="💳"
              label="누적 결제액"
              value={`${totalSpent.toLocaleString("ko-KR")}원`}
            />
          </div>
          <p className="mt-3 text-[11px] text-[#8B7F75]">
            총 제출 수: {submissionsCount}건 (승인/대기 포함)
          </p>
        </section>

        {/* 3. 개인정보 관리 */}
        <section className="rounded-2xl border border-[#D4E4BC] bg-white p-5 shadow-sm">
          <h2 className="mb-3 flex items-center gap-2 text-base font-bold text-[#2D5A3D]">
            <span>🛠️</span>
            <span>개인정보 관리</span>
            <span className="ml-auto rounded-full bg-[#D4E4BC] px-2 py-0.5 text-[10px] font-semibold text-[#2D5A3D]">
              정정·삭제권 (제36조)
            </span>
          </h2>
          <div className="space-y-2">
            <Link
              href={`/event/${id}/my/edit`}
              className="flex items-center justify-between rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] px-4 py-3 text-sm font-semibold text-[#2D5A3D] hover:bg-[#E8F0E4]"
            >
              <span className="flex items-center gap-2">
                <span>✏️</span>
                <span>내 정보 수정</span>
              </span>
              <span aria-hidden>→</span>
            </Link>
            <Link
              href={`/event/${id}/my/payments`}
              className="flex items-center justify-between rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] px-4 py-3 text-sm font-semibold text-[#2D5A3D] hover:bg-[#E8F0E4]"
            >
              <span className="flex items-center gap-2">
                <span>💳</span>
                <span>결제 이력</span>
              </span>
              <span aria-hidden>→</span>
            </Link>
            <a
              href={`/api/my-data?event_id=${encodeURIComponent(id)}`}
              className="flex items-center justify-between rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] px-4 py-3 text-sm font-semibold text-[#2D5A3D] hover:bg-[#E8F0E4]"
            >
              <span className="flex items-center gap-2">
                <span>📥</span>
                <span>내 데이터 다운로드 (JSON)</span>
              </span>
              <span aria-hidden>↓</span>
            </a>
            <Link
              href={`/event/${id}/my/withdraw`}
              className="flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 hover:bg-rose-100"
            >
              <span className="flex items-center gap-2">
                <span>⚠️</span>
                <span>회원 탈퇴</span>
              </span>
              <span aria-hidden>→</span>
            </Link>
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-[#8B7F75]">
            언제든 재가입이 가능해요. 탈퇴 시 도토리·보상·참여 이력이 즉시
            삭제되며 복구할 수 없어요.
          </p>
        </section>

        {/* 4. 마케팅 수신 설정 */}
        <MarketingTogglesCard />

        {/* Footer */}
        <div className="rounded-2xl bg-[#FFF8F0] p-4 text-[11px] leading-relaxed text-[#6B6560]">
          <p className="font-semibold text-[#2D5A3D]">🛡️ 개인정보 보호 안내</p>
          <p className="mt-1">
            토리로는 개인정보보호법 제35조(열람권) · 제36조(정정·삭제권) ·
            제37조(처리 정지권)에 따라 본인의 정보를 직접 열람하고 수정·삭제할
            수 있는 권리를 보장합니다.
          </p>
          <p className="mt-1">
            문의: <Link href="/privacy" className="underline">개인정보처리방침</Link>
          </p>
        </div>
      </div>
    </main>
  );
}

function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 11) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  }
  return phone;
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-[#F0EBE3] pb-2 last:border-none last:pb-0">
      <dt className="text-xs font-semibold text-[#6B6560]">{label}</dt>
      <dd className="text-right text-sm font-medium text-[#2C2C2C]">{value}</dd>
    </div>
  );
}

function StatBox({
  icon,
  label,
  value,
}: {
  icon: string;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] p-3 text-center">
      <div className="text-xl">{icon}</div>
      <div className="mt-1 text-lg font-bold text-[#2D5A3D]">{value}</div>
      <div className="text-[10px] text-[#6B6560]">{label}</div>
    </div>
  );
}
