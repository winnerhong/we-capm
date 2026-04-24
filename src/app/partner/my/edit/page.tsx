import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePartner } from "@/lib/auth-guard";
import { createClient } from "@/lib/supabase/server";
import { updatePartnerProfileAction } from "../actions";

export const dynamic = "force-dynamic";

type PartnerDetail = {
  id: string;
  name: string;
  business_name: string | null;
  representative_name: string | null;
  business_number: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  bank_name: string | null;
  account_number: string | null;
  account_holder: string | null;
};

async function loadPartner(id: string): Promise<PartnerDetail | null> {
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
        "id,name,business_name,representative_name,business_number,phone,email,address,bank_name,account_number,account_holder"
      )
      .eq("id", id)
      .maybeSingle();
    return data ?? null;
  } catch {
    return null;
  }
}

const INPUT =
  "mt-1 w-full rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] px-3 py-2.5 text-sm text-[#2C2C2C] focus:border-[#3A7A52] focus:outline-none focus:ring-2 focus:ring-[#3A7A52]/30";
const LABEL = "text-xs font-semibold text-[#2D5A3D]";

const KOREAN_BANKS = [
  "국민은행",
  "신한은행",
  "우리은행",
  "하나은행",
  "NH농협은행",
  "IBK기업은행",
  "SC제일은행",
  "씨티은행",
  "대구은행",
  "부산은행",
  "경남은행",
  "광주은행",
  "전북은행",
  "제주은행",
  "산업은행",
  "수협은행",
  "새마을금고",
  "신협",
  "우체국",
  "카카오뱅크",
  "케이뱅크",
  "토스뱅크",
];

export default async function EditPartnerProfilePage() {
  const session = await requirePartner();
  const partner = await loadPartner(session.id);
  if (!partner) notFound();

  return (
    <div className="mx-auto max-w-2xl space-y-4 pb-6">
      <nav aria-label="breadcrumb" className="text-xs text-[#8B7F75]">
        <Link href="/partner/dashboard" className="hover:text-[#2D5A3D]">
          대시보드
        </Link>
        <span className="mx-2">/</span>
        <Link href="/partner/my" className="hover:text-[#2D5A3D]">
          내 정보
        </Link>
        <span className="mx-2">/</span>
        <span className="font-semibold text-[#2D5A3D]">수정</span>
      </nav>

      <header className="overflow-hidden rounded-3xl bg-gradient-to-br from-[#2D5A3D] via-[#3A7A52] to-[#4A7C59] p-5 shadow-lg">
        <h1 className="text-xl font-bold text-white md:text-2xl">
          ✏️ 내 정보 수정
        </h1>
        <p className="mt-1 text-sm text-[#D4E4BC]">
          회사 정보와 정산 계좌를 관리하세요
        </p>
      </header>

      <form action={updatePartnerProfileAction} className="space-y-4">
        {/* 회사 정보 */}
        <section className="rounded-2xl border border-[#D4E4BC] bg-white p-5 shadow-sm">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-bold text-[#2D5A3D]">
            <span>🏢</span>
            <span>회사 정보</span>
          </h2>
          <div className="space-y-3">
            <div>
              <label htmlFor="business_name" className={LABEL}>
                회사명
              </label>
              <input
                id="business_name"
                name="business_name"
                type="text"
                defaultValue={partner.business_name ?? ""}
                className={INPUT}
                placeholder="예) 위너키즈스포츠"
              />
            </div>
            <div>
              <label htmlFor="representative_name" className={LABEL}>
                대표자
              </label>
              <input
                id="representative_name"
                name="representative_name"
                type="text"
                defaultValue={partner.representative_name ?? partner.name ?? ""}
                className={INPUT}
                placeholder="예) 홍길동"
              />
            </div>
            <div>
              <label htmlFor="business_number" className={LABEL}>
                사업자번호
              </label>
              <input
                id="business_number"
                name="business_number"
                type="text"
                inputMode="numeric"
                defaultValue={partner.business_number ?? ""}
                className={INPUT}
                placeholder="123-45-67890"
              />
            </div>
            <div>
              <label htmlFor="phone" className={LABEL}>
                연락처
              </label>
              <input
                id="phone"
                name="phone"
                type="tel"
                inputMode="tel"
                defaultValue={partner.phone ?? ""}
                className={INPUT}
                placeholder="010-0000-0000"
              />
            </div>
            <div>
              <label htmlFor="email" className={LABEL}>
                이메일
              </label>
              <input
                id="email"
                name="email"
                type="email"
                inputMode="email"
                defaultValue={partner.email ?? ""}
                className={INPUT}
                placeholder="partner@toriro.com"
              />
            </div>
            <div>
              <label htmlFor="address" className={LABEL}>
                주소
              </label>
              <textarea
                id="address"
                name="address"
                rows={2}
                defaultValue={partner.address ?? ""}
                className={INPUT}
                placeholder="예) 대구시 북구 침산로 168 엠브로타워 6층"
              />
            </div>
          </div>
        </section>

        {/* 정산 계좌 */}
        <section id="bank" className="rounded-2xl border border-[#D4E4BC] bg-white p-5 shadow-sm">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-bold text-[#2D5A3D]">
            <span>💳</span>
            <span>정산 계좌</span>
          </h2>
          <div className="space-y-3">
            <div>
              <label htmlFor="bank_name" className={LABEL}>
                은행
              </label>
              <select
                id="bank_name"
                name="bank_name"
                defaultValue={partner.bank_name ?? ""}
                className={INPUT}
              >
                <option value="">선택하세요</option>
                {KOREAN_BANKS.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="account_number" className={LABEL}>
                계좌번호
              </label>
              <input
                id="account_number"
                name="account_number"
                type="text"
                inputMode="numeric"
                defaultValue={partner.account_number ?? ""}
                className={INPUT}
                placeholder="123-45-6789012"
              />
            </div>
            <div>
              <label htmlFor="account_holder" className={LABEL}>
                예금주
              </label>
              <input
                id="account_holder"
                name="account_holder"
                type="text"
                defaultValue={partner.account_holder ?? ""}
                className={INPUT}
                placeholder="예) 홍길동"
              />
            </div>
          </div>
        </section>

        {/* Actions */}
        <div className="flex gap-2">
          <Link
            href="/partner/my"
            className="flex-1 rounded-2xl border border-[#D4E4BC] bg-white px-4 py-3 text-center text-sm font-semibold text-[#6B6560] hover:bg-[#F5F1E8]"
          >
            취소
          </Link>
          <button
            type="submit"
            className="flex-[2] rounded-2xl bg-gradient-to-r from-[#2D5A3D] to-[#3A7A52] px-4 py-3 text-sm font-bold text-white shadow-md hover:from-[#234a30] hover:to-[#2D5A3D]"
          >
            💾 저장하기
          </button>
        </div>
      </form>
    </div>
  );
}
