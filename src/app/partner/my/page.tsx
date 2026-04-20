import Link from "next/link";
import { requirePartner } from "@/lib/auth-guard";
import { createClient } from "@/lib/supabase/server";
import { closePartnerAccountAction } from "./actions";

export const dynamic = "force-dynamic";

type PartnerDetail = {
  id: string;
  name: string;
  username: string;
  business_name: string | null;
  email: string | null;
  phone: string | null;
  tier: string;
  created_at: string;
  status?: string | null;
};

type ProgramStat = {
  id: string;
  is_published: boolean;
  rating_avg: number | null;
  rating_count: number;
  booking_count: number;
  price_per_person: number;
};

async function loadPartnerDetail(id: string): Promise<PartnerDetail | null> {
  const supabase = await createClient();
  try {
    const { data } = await (
      supabase.from("partners") as unknown as {
        select: (c: string) => {
          eq: (k: string, v: string) => {
            maybeSingle: () => Promise<{ data: PartnerDetail | null }>;
          };
        };
      }
    )
      .select(
        "id,name,username,business_name,email,phone,tier,created_at,status"
      )
      .eq("id", id)
      .maybeSingle();
    return data ?? null;
  } catch {
    return null;
  }
}

async function loadProgramStats(partnerId: string) {
  const supabase = await createClient();
  try {
    const { data } = await (
      supabase.from("partner_programs") as unknown as {
        select: (c: string) => {
          eq: (k: string, v: string) => Promise<{ data: ProgramStat[] | null }>;
        };
      }
    )
      .select(
        "id,is_published,rating_avg,rating_count,booking_count,price_per_person"
      )
      .eq("partner_id", partnerId);

    const list = data ?? [];
    const totalPrograms = list.length;
    const activePrograms = list.filter((p) => p.is_published).length;
    const totalSales = list.reduce(
      (s, p) => s + (p.booking_count ?? 0) * (p.price_per_person ?? 0),
      0
    );
    const rated = list.filter(
      (p) => (p.rating_count ?? 0) > 0 && p.rating_avg != null
    );
    const avgRating =
      rated.length > 0
        ? rated.reduce((s, p) => s + (p.rating_avg ?? 0), 0) / rated.length
        : null;

    return { totalPrograms, activePrograms, totalSales, avgRating };
  } catch {
    return {
      totalPrograms: 0,
      activePrograms: 0,
      totalSales: 0,
      avgRating: null as number | null,
    };
  }
}

function formatWon(n: number): string {
  return `${Math.round(n).toLocaleString("ko-KR")}원`;
}

export default async function PartnerMyPage() {
  const session = await requirePartner();
  const [detail, stats] = await Promise.all([
    loadPartnerDetail(session.id),
    loadProgramStats(session.id),
  ]);

  return (
    <div className="space-y-6">
      <nav aria-label="breadcrumb" className="text-xs text-[#8B7F75]">
        <Link href="/partner/dashboard" className="hover:text-[#2D5A3D]">
          대시보드
        </Link>
        <span className="mx-2">/</span>
        <span className="font-semibold text-[#2D5A3D]">내 정보</span>
      </nav>

      {/* Header */}
      <header className="rounded-3xl border border-[#D4E4BC] bg-gradient-to-br from-[#E8F0E4] via-white to-[#FAE7D0] p-5 shadow-sm md:p-7">
        <div className="flex items-center gap-3">
          <span className="text-3xl" aria-hidden>
            🏡
          </span>
          <div>
            <h1 className="text-xl font-bold text-[#2D5A3D] md:text-2xl">
              숲지기 내 정보
            </h1>
            <p className="mt-1 text-xs text-[#6B6560] md:text-sm">
              개인정보 열람 · 정정 · 계약 해지
            </p>
          </div>
          <span className="ml-auto rounded-full bg-[#D4E4BC] px-2.5 py-1 text-[10px] font-semibold text-[#2D5A3D]">
            🛡️ 개인정보보호법 제35~37조
          </span>
        </div>
      </header>

      {/* 1. 사업자 정보 */}
      <section className="rounded-2xl border border-[#D4E4BC] bg-white p-5 shadow-sm md:p-6">
        <h2 className="mb-3 flex items-center gap-2 text-base font-bold text-[#2D5A3D]">
          <span>🌿</span>
          <span>사업자 정보</span>
          <span className="ml-auto rounded-full bg-[#D4E4BC] px-2 py-0.5 text-[10px] font-semibold text-[#2D5A3D]">
            열람권
          </span>
        </h2>
        <dl className="grid grid-cols-1 gap-2.5 text-sm md:grid-cols-2">
          <InfoRow label="대표자명" value={detail?.name ?? session.name} />
          <InfoRow
            label="사업자명"
            value={detail?.business_name ?? "-"}
          />
          <InfoRow label="아이디" value={detail?.username ?? session.username} mono />
          <InfoRow label="등급" value={`🌳 ${detail?.tier ?? "SPROUT"}`} />
          <InfoRow label="이메일" value={detail?.email ?? "-"} />
          <InfoRow label="전화번호" value={detail?.phone ?? "-"} />
          <InfoRow
            label="가입일"
            value={
              detail?.created_at
                ? new Date(detail.created_at).toLocaleString("ko-KR")
                : "-"
            }
          />
          <InfoRow
            label="상태"
            value={
              detail?.status === "CLOSED"
                ? "해지됨"
                : detail?.status ?? "활성"
            }
          />
        </dl>
      </section>

      {/* 2. 활동 통계 */}
      <section className="rounded-2xl border border-[#D4E4BC] bg-white p-5 shadow-sm md:p-6">
        <h2 className="mb-3 flex items-center gap-2 text-base font-bold text-[#2D5A3D]">
          <span>📊</span>
          <span>활동 통계</span>
        </h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatBox
            icon="💰"
            label="누적 매출"
            value={formatWon(stats.totalSales)}
          />
          <StatBox
            icon="🌿"
            label="활성 프로그램"
            value={`${stats.activePrograms}개`}
          />
          <StatBox
            icon="📦"
            label="등록 프로그램"
            value={`${stats.totalPrograms}개`}
          />
          <StatBox
            icon="⭐"
            label="평균 평점"
            value={
              stats.avgRating != null ? stats.avgRating.toFixed(2) : "-"
            }
          />
        </div>
      </section>

      {/* 3. 개인정보 관리 */}
      <section className="rounded-2xl border border-[#D4E4BC] bg-white p-5 shadow-sm md:p-6">
        <h2 className="mb-3 flex items-center gap-2 text-base font-bold text-[#2D5A3D]">
          <span>🛠️</span>
          <span>개인정보 관리</span>
          <span className="ml-auto rounded-full bg-[#D4E4BC] px-2 py-0.5 text-[10px] font-semibold text-[#2D5A3D]">
            정정·삭제권
          </span>
        </h2>
        <div className="grid gap-2 md:grid-cols-2">
          <Link
            href="/partner/settings"
            className="flex items-center justify-between rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] px-4 py-3 text-sm font-semibold text-[#2D5A3D] hover:bg-[#E8F0E4]"
          >
            <span className="flex items-center gap-2">
              <span>✏️</span>
              <span>프로필 · 비밀번호 수정</span>
            </span>
            <span aria-hidden>→</span>
          </Link>
          <a
            href="/api/partner-data"
            className="flex items-center justify-between rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] px-4 py-3 text-sm font-semibold text-[#2D5A3D] hover:bg-[#E8F0E4]"
          >
            <span className="flex items-center gap-2">
              <span>📥</span>
              <span>내 데이터 다운로드 (JSON)</span>
            </span>
            <span aria-hidden>↓</span>
          </a>
        </div>
      </section>

      {/* 4. 계정 해지 */}
      <section className="rounded-2xl border border-rose-200 bg-rose-50 p-5 shadow-sm md:p-6">
        <h2 className="mb-2 flex items-center gap-2 text-base font-bold text-rose-800">
          <span>⚠️</span>
          <span>계정 해지</span>
        </h2>
        <ul className="mb-4 list-disc space-y-1 pl-5 text-xs leading-relaxed text-rose-700">
          <li>해지 후에는 숲지기 포털에 접속할 수 없어요.</li>
          <li>등록된 프로그램이 모두 숨김 처리됩니다.</li>
          <li>정산 · 세금 이력은 법정 보존 기간 동안 보관돼요.</li>
          <li>이 작업은 즉시 반영되며 되돌릴 수 없어요.</li>
        </ul>
        <form action={closePartnerAccountAction} className="space-y-3">
          <div>
            <label
              htmlFor="reason"
              className="mb-1 block text-xs font-semibold text-rose-700"
            >
              해지 사유 (선택)
            </label>
            <select
              id="reason"
              name="reason"
              defaultValue=""
              className="w-full rounded-xl border border-rose-300 bg-white px-3 py-2.5 text-sm text-rose-900 focus:border-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-400/30"
            >
              <option value="">선택 안 함</option>
              <option value="NOT_USING">잘 사용하지 않아요</option>
              <option value="FEE">수수료 정책 불만</option>
              <option value="FEATURE">기능 부족</option>
              <option value="OTHER">기타</option>
            </select>
          </div>
          <div>
            <label
              htmlFor="confirm"
              className="mb-1 block text-xs font-semibold text-rose-700"
            >
              확인을 위해 <b>&quot;해지합니다&quot;</b>라고 입력해 주세요
            </label>
            <input
              id="confirm"
              name="confirm"
              type="text"
              required
              autoComplete="off"
              className="w-full rounded-xl border border-rose-300 bg-white px-3 py-2.5 text-sm text-rose-900 focus:border-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-400/30"
            />
          </div>
          <button
            type="submit"
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-rose-700"
          >
            계정 해지하기
          </button>
        </form>
      </section>

      {/* Footer */}
      <div className="rounded-2xl bg-[#FFF8F0] p-4 text-[11px] leading-relaxed text-[#6B6560]">
        <p className="font-semibold text-[#2D5A3D]">🛡️ 개인정보 보호 안내</p>
        <p className="mt-1">
          토리로는 개인정보보호법 제35조(열람권) · 제36조(정정·삭제권) ·
          제37조(처리 정지권)을 보장해요. 정산 및 세무 관련 기록은 관련
          법령(전자상거래법 · 국세기본법)에 따라 최소 5년간 보존될 수 있어요.
        </p>
      </div>
    </div>
  );
}

function InfoRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] px-3 py-2.5">
      <dt className="text-xs font-semibold text-[#6B6560]">{label}</dt>
      <dd
        className={`text-right text-sm font-medium text-[#2C2C2C] ${
          mono ? "font-mono" : ""
        }`}
      >
        {value}
      </dd>
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
      <div className="mt-1 truncate text-base font-bold text-[#2D5A3D]">
        {value}
      </div>
      <div className="text-[10px] text-[#6B6560]">{label}</div>
    </div>
  );
}
