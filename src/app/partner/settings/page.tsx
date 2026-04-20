import Link from "next/link";
import { requirePartner } from "@/lib/auth-guard";
import { createClient } from "@/lib/supabase/server";
import {
  updatePartnerProfileAction,
  updatePartnerPasswordAction,
  closePartnerAccountAction,
} from "./actions";

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
        "id,name,username,business_name,email,phone,tier,created_at"
      )
      .eq("id", id)
      .maybeSingle();
    return data ?? null;
  } catch {
    return null;
  }
}

export default async function PartnerSettingsPage() {
  const session = await requirePartner();
  const partner = await loadPartnerDetail(session.id);

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav aria-label="breadcrumb" className="text-xs text-[#8B7F75]">
        <Link href="/partner/dashboard" className="hover:text-[#2D5A3D]">
          대시보드
        </Link>
        <span className="mx-2">/</span>
        <span className="font-semibold text-[#2D5A3D]">설정</span>
      </nav>

      {/* Header */}
      <header className="rounded-3xl border border-[#D4E4BC] bg-gradient-to-br from-[#E8F0E4] via-white to-[#FAE7D0] p-5 shadow-sm md:p-7">
        <div className="flex items-center gap-3">
          <span className="text-3xl" aria-hidden>
            ⚙️
          </span>
          <div>
            <h1 className="text-xl font-bold text-[#2D5A3D] md:text-2xl">
              계정 설정
            </h1>
            <p className="mt-1 text-xs text-[#6B6560] md:text-sm">
              프로필과 보안 설정을 관리해요
            </p>
          </div>
        </div>
      </header>

      {/* 1. 프로필 수정 */}
      <section className="rounded-2xl border border-[#D4E4BC] bg-white p-5 shadow-sm md:p-6">
        <h2 className="mb-4 flex items-center gap-2 text-base font-bold text-[#2D5A3D]">
          <span>🌿</span>
          <span>프로필 정보</span>
        </h2>
        <form action={updatePartnerProfileAction} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label
                htmlFor="name"
                className="mb-1 block text-xs font-semibold text-[#6B6560]"
              >
                이름 <span className="text-rose-500">*</span>
              </label>
              <input
                id="name"
                name="name"
                type="text"
                defaultValue={partner?.name ?? session.name}
                required
                autoComplete="name"
                className="w-full rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] px-3 py-2.5 text-sm text-[#2C2C2C] focus:border-[#2D5A3D] focus:outline-none focus:ring-2 focus:ring-[#3A7A52]/30"
              />
            </div>
            <div>
              <label
                htmlFor="business_name"
                className="mb-1 block text-xs font-semibold text-[#6B6560]"
              >
                사업자명 / 단체명
              </label>
              <input
                id="business_name"
                name="business_name"
                type="text"
                defaultValue={partner?.business_name ?? ""}
                autoComplete="organization"
                className="w-full rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] px-3 py-2.5 text-sm text-[#2C2C2C] focus:border-[#2D5A3D] focus:outline-none focus:ring-2 focus:ring-[#3A7A52]/30"
              />
            </div>
            <div>
              <label
                htmlFor="email"
                className="mb-1 block text-xs font-semibold text-[#6B6560]"
              >
                이메일
              </label>
              <input
                id="email"
                name="email"
                type="email"
                defaultValue={partner?.email ?? ""}
                autoComplete="email"
                inputMode="email"
                className="w-full rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] px-3 py-2.5 text-sm text-[#2C2C2C] focus:border-[#2D5A3D] focus:outline-none focus:ring-2 focus:ring-[#3A7A52]/30"
              />
            </div>
            <div>
              <label
                htmlFor="phone"
                className="mb-1 block text-xs font-semibold text-[#6B6560]"
              >
                전화번호
              </label>
              <input
                id="phone"
                name="phone"
                type="tel"
                defaultValue={partner?.phone ?? ""}
                autoComplete="tel"
                inputMode="tel"
                placeholder="010-0000-0000"
                className="w-full rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] px-3 py-2.5 text-sm text-[#2C2C2C] focus:border-[#2D5A3D] focus:outline-none focus:ring-2 focus:ring-[#3A7A52]/30"
              />
            </div>
          </div>

          <dl className="grid grid-cols-2 gap-3 rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] p-3 text-xs">
            <div>
              <dt className="font-semibold text-[#6B6560]">아이디</dt>
              <dd className="mt-0.5 font-mono text-[#2D5A3D]">
                {partner?.username ?? session.username}
              </dd>
            </div>
            <div>
              <dt className="font-semibold text-[#6B6560]">등급</dt>
              <dd className="mt-0.5 font-bold text-[#2D5A3D]">
                🌳 {partner?.tier ?? "SPROUT"}
              </dd>
            </div>
          </dl>

          <button
            type="submit"
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-[#2D5A3D] to-[#3A7A52] px-4 py-2.5 text-sm font-bold text-white shadow-md hover:from-[#234a30] hover:to-[#2D5A3D] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2D5A3D]/40 md:w-auto"
          >
            💾 프로필 저장
          </button>
        </form>
      </section>

      {/* 2. 비밀번호 변경 */}
      <section className="rounded-2xl border border-[#D4E4BC] bg-white p-5 shadow-sm md:p-6">
        <h2 className="mb-4 flex items-center gap-2 text-base font-bold text-[#2D5A3D]">
          <span>🔒</span>
          <span>비밀번호 변경</span>
        </h2>
        <form action={updatePartnerPasswordAction} className="space-y-3">
          <div>
            <label
              htmlFor="old_password"
              className="mb-1 block text-xs font-semibold text-[#6B6560]"
            >
              현재 비밀번호
            </label>
            <input
              id="old_password"
              name="old_password"
              type="password"
              required
              autoComplete="current-password"
              className="w-full rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] px-3 py-2.5 text-sm focus:border-[#2D5A3D] focus:outline-none focus:ring-2 focus:ring-[#3A7A52]/30"
            />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label
                htmlFor="new_password"
                className="mb-1 block text-xs font-semibold text-[#6B6560]"
              >
                새 비밀번호 (6자 이상)
              </label>
              <input
                id="new_password"
                name="new_password"
                type="password"
                required
                minLength={6}
                autoComplete="new-password"
                className="w-full rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] px-3 py-2.5 text-sm focus:border-[#2D5A3D] focus:outline-none focus:ring-2 focus:ring-[#3A7A52]/30"
              />
            </div>
            <div>
              <label
                htmlFor="confirm_password"
                className="mb-1 block text-xs font-semibold text-[#6B6560]"
              >
                새 비밀번호 확인
              </label>
              <input
                id="confirm_password"
                name="confirm_password"
                type="password"
                required
                minLength={6}
                autoComplete="new-password"
                className="w-full rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] px-3 py-2.5 text-sm focus:border-[#2D5A3D] focus:outline-none focus:ring-2 focus:ring-[#3A7A52]/30"
              />
            </div>
          </div>
          <button
            type="submit"
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-[#2D5A3D] bg-white px-4 py-2.5 text-sm font-bold text-[#2D5A3D] hover:bg-[#E8F0E4]"
          >
            🔐 비밀번호 변경
          </button>
        </form>
      </section>

      {/* 3. 로그아웃 */}
      <section className="rounded-2xl border border-[#D4E4BC] bg-white p-5 shadow-sm md:p-6">
        <h2 className="mb-3 flex items-center gap-2 text-base font-bold text-[#2D5A3D]">
          <span>🚪</span>
          <span>세션</span>
        </h2>
        <form action="/api/auth/partner-logout" method="post">
          <button
            type="submit"
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] px-4 py-2.5 text-sm font-semibold text-[#6B6560] hover:bg-[#F0EBE3]"
          >
            로그아웃
          </button>
        </form>
      </section>

      {/* 4. 계정 해지 */}
      <section className="rounded-2xl border border-rose-200 bg-rose-50 p-5 shadow-sm md:p-6">
        <h2 className="mb-2 flex items-center gap-2 text-base font-bold text-rose-800">
          <span>⚠️</span>
          <span>계정 해지</span>
        </h2>
        <p className="mb-4 text-xs leading-relaxed text-rose-700">
          계정을 해지하면 더 이상 숲지기 포털에 접속할 수 없고, 등록된 프로그램이
          모두 숨김 처리됩니다. 이 작업은 관리자 승인 없이 즉시 반영되며 되돌릴
          수 없어요.
        </p>
        <form action={closePartnerAccountAction} className="space-y-3">
          <div>
            <label
              htmlFor="confirm"
              className="mb-1 block text-xs font-semibold text-rose-700"
            >
              확인을 위해 <b>&quot;해지&quot;</b>라고 입력해 주세요
            </label>
            <input
              id="confirm"
              name="confirm"
              type="text"
              required
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
    </div>
  );
}
