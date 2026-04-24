import Link from "next/link";
import { requirePartnerWithRole } from "@/lib/auth-guard";
import { ROLE_META, ROLE_OPTIONS } from "@/lib/team/types";
import { inviteTeamMemberAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function InviteTeamMemberPage() {
  try {
    await requirePartnerWithRole(["OWNER"]);
  } catch {
    return (
      <div className="rounded-3xl border border-rose-200 bg-rose-50 p-6 text-center shadow-sm">
        <div className="mb-2 text-3xl" aria-hidden>
          🔒
        </div>
        <h1 className="text-lg font-bold text-rose-900">
          이 페이지는 OWNER만 접근할 수 있어요
        </h1>
        <p className="mt-1 text-sm text-rose-700">
          팀원 초대 권한은 오너에게만 있어요.
        </p>
        <Link
          href="/partner/dashboard"
          className="mt-4 inline-flex items-center justify-center gap-1.5 rounded-xl border border-rose-300 bg-white px-4 py-2 text-sm font-semibold text-rose-800 hover:bg-rose-100"
        >
          대시보드로 돌아가기
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav aria-label="breadcrumb" className="text-xs text-[#8B7F75]">
        <Link href="/partner/dashboard" className="hover:text-[#2D5A3D]">
          대시보드
        </Link>
        <span className="mx-2">/</span>
        <Link href="/partner/settings" className="hover:text-[#2D5A3D]">
          설정
        </Link>
        <span className="mx-2">/</span>
        <Link
          href="/partner/settings/team"
          className="hover:text-[#2D5A3D]"
        >
          팀 관리
        </Link>
        <span className="mx-2">/</span>
        <span className="font-semibold text-[#2D5A3D]">팀원 초대</span>
      </nav>

      {/* 헤더 */}
      <header className="rounded-3xl border border-[#D4E4BC] bg-gradient-to-br from-[#E8F0E4] via-white to-[#FAE7D0] p-5 shadow-sm md:p-7">
        <div className="flex items-center gap-3">
          <span className="text-3xl" aria-hidden>
            ➕
          </span>
          <div>
            <h1 className="text-xl font-bold text-[#2D5A3D] md:text-2xl">
              팀원 초대
            </h1>
            <p className="mt-1 text-xs text-[#6B6560] md:text-sm">
              새 팀원의 정보와 권한을 입력해 주세요. 초대 후 임시 비밀번호가
              발급돼요.
            </p>
          </div>
        </div>
      </header>

      {/* 폼 */}
      <form
        action={inviteTeamMemberAction}
        className="space-y-5 rounded-2xl border border-[#D4E4BC] bg-white p-5 shadow-sm md:p-6"
      >
        {/* 기본 정보 */}
        <section className="space-y-4">
          <h2 className="flex items-center gap-2 text-base font-bold text-[#2D5A3D]">
            <span aria-hidden>🌿</span>
            <span>기본 정보</span>
          </h2>

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
                required
                autoComplete="name"
                placeholder="예: 김매니저"
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
                autoComplete="email"
                inputMode="email"
                placeholder="name@example.com"
                className="w-full rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] px-3 py-2.5 text-sm text-[#2C2C2C] focus:border-[#2D5A3D] focus:outline-none focus:ring-2 focus:ring-[#3A7A52]/30"
              />
            </div>

            <div>
              <label
                htmlFor="phone"
                className="mb-1 block text-xs font-semibold text-[#6B6560]"
              >
                핸드폰번호 <span className="text-rose-600">*</span>
              </label>
              <input
                id="phone"
                name="phone"
                type="tel"
                required
                autoComplete="tel"
                inputMode="tel"
                placeholder="01012345678"
                pattern="[0-9\-]*"
                className="w-full rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] px-3 py-2.5 text-sm text-[#2C2C2C] focus:border-[#2D5A3D] focus:outline-none focus:ring-2 focus:ring-[#3A7A52]/30"
              />
              <p className="mt-1 text-[11px] text-[#8B7F75]">
                🔑 기본적으로 이 번호가 아이디로 사용되고 뒷 4자리가 초기 비밀번호예요 (아래에서 수정 가능)
              </p>
            </div>
          </div>
        </section>

        {/* 🔐 로그인 계정 */}
        <section className="space-y-3 rounded-2xl border border-[#D4A15A] bg-[#FFF8F0] p-4">
          <h2 className="flex items-center gap-2 text-base font-bold text-[#8B6B3F]">
            <span aria-hidden>🔐</span>
            <span>로그인 계정</span>
          </h2>
          <p className="text-xs text-[#8B7F75]">
            비워두면 핸드폰번호를 아이디로, 뒷 4자리를 초기 비밀번호로 사용합니다.
            원하는 값으로 바꿔도 돼요.
          </p>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <label
                htmlFor="username"
                className="mb-1 block text-xs font-semibold text-[#6B6560]"
              >
                아이디 (선택)
              </label>
              <input
                id="username"
                name="username"
                type="text"
                autoComplete="off"
                placeholder="비워두면 핸드폰번호 사용"
                className="w-full rounded-xl border border-[#D4A15A] bg-white px-3 py-2.5 font-mono text-sm text-[#2C2C2C] focus:border-[#2D5A3D] focus:outline-none focus:ring-2 focus:ring-[#3A7A52]/30"
              />
              <p className="mt-1 text-[11px] text-[#8B7F75]">
                4~30자 · 숫자·영문 권장
              </p>
            </div>
            <div>
              <label
                htmlFor="initial_password"
                className="mb-1 block text-xs font-semibold text-[#6B6560]"
              >
                비밀번호 (선택)
              </label>
              <input
                id="initial_password"
                name="initial_password"
                type="text"
                autoComplete="new-password"
                placeholder="비워두면 뒷 4자리 자동"
                className="w-full rounded-xl border border-[#D4A15A] bg-white px-3 py-2.5 font-mono text-sm text-[#2C2C2C] focus:border-[#2D5A3D] focus:outline-none focus:ring-2 focus:ring-[#3A7A52]/30"
              />
              <p className="mt-1 text-[11px] text-[#8B7F75]">
                4자 이상 · 팀원이 첫 로그인 후 변경 권장
              </p>
            </div>
          </div>
        </section>

        {/* 역할 */}
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-base font-bold text-[#2D5A3D]">
            <span aria-hidden>🎯</span>
            <span>
              역할 <span className="text-rose-500">*</span>
            </span>
          </h2>
          <p className="text-xs text-[#8B7F75]">
            역할에 따라 접근 가능한 메뉴가 달라져요. 오너(OWNER) 권한은
            이전만 가능해요.
          </p>

          <fieldset
            className="grid gap-3 md:grid-cols-2"
            aria-label="역할 선택"
          >
            {ROLE_OPTIONS.map((role, idx) => {
              const meta = ROLE_META[role];
              return (
                <label
                  key={role}
                  className="group cursor-pointer rounded-2xl border border-[#D4E4BC] bg-white p-4 shadow-sm transition-all has-[:checked]:border-violet-400 has-[:checked]:bg-violet-50 has-[:checked]:ring-2 has-[:checked]:ring-violet-300/50 hover:border-[#4A7C59]"
                >
                  <input
                    type="radio"
                    name="role"
                    value={role}
                    defaultChecked={idx === 0}
                    required
                    className="sr-only"
                  />
                  <div className="flex items-start gap-3">
                    <span aria-hidden className="text-2xl">
                      {meta.icon}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-[#2D5A3D]">
                          {meta.label}
                        </span>
                        <span
                          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${meta.color}`}
                        >
                          {role}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-[#6B6560]">
                        {meta.desc}
                      </p>
                    </div>
                    <span
                      aria-hidden
                      className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2 border-[#D4E4BC] bg-white text-[11px] text-transparent transition-colors group-has-[:checked]:border-violet-600 group-has-[:checked]:bg-violet-600 group-has-[:checked]:text-white"
                    >
                      ✓
                    </span>
                  </div>
                </label>
              );
            })}
          </fieldset>
        </section>

        {/* 메모 */}
        <section className="space-y-2">
          <label
            htmlFor="memo"
            className="flex items-center gap-2 text-base font-bold text-[#2D5A3D]"
          >
            <span aria-hidden>📝</span>
            <span>메모 (선택)</span>
          </label>
          <textarea
            id="memo"
            name="memo"
            rows={3}
            placeholder="이 팀원에 대한 메모를 남겨 주세요 (예: 강원 지사 담당, 평일 오전 근무)"
            className="w-full rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] px-3 py-2.5 text-sm text-[#2C2C2C] focus:border-[#2D5A3D] focus:outline-none focus:ring-2 focus:ring-[#3A7A52]/30"
          />
        </section>

        {/* 안내 */}
        <div className="flex items-start gap-2 rounded-xl border border-sky-200 bg-sky-50 p-3 text-xs text-sky-900">
          <span aria-hidden className="text-base">
            💡
          </span>
          <p>
            초대 후 표시되는{" "}
            <b className="font-bold">임시 비밀번호</b>를 팀원에게 전달하세요.
            페이지를 떠나면 비밀번호를 다시 볼 수 없으니 꼭 복사해 두세요.
          </p>
        </div>

        {/* 액션 */}
        <div className="flex flex-col gap-2 md:flex-row md:justify-end">
          <Link
            href="/partner/settings/team"
            className="inline-flex items-center justify-center gap-1 rounded-xl border border-[#D4E4BC] bg-white px-4 py-2.5 text-sm font-semibold text-[#6B6560] hover:bg-[#FFF8F0]"
          >
            취소
          </Link>
          <button
            type="submit"
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-bold text-white shadow-md hover:bg-violet-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/60"
          >
            ✉️ 초대하기
          </button>
        </div>
      </form>
    </div>
  );
}
