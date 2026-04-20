import Link from "next/link";
import { createPartnerAction } from "../actions";

export const dynamic = "force-dynamic";

export default function NewPartnerPage() {
  return (
    <div className="mx-auto max-w-lg space-y-4">
      <div className="flex items-center justify-between">
        <Link href="/admin/partners" className="text-sm font-medium text-[#2D5A3D] hover:underline">
          ← 숲지기 목록
        </Link>
      </div>

      <div className="rounded-2xl bg-gradient-to-br from-[#2D5A3D] via-[#3A7A52] to-[#4A7C59] p-6 text-white shadow-sm">
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <span>🏡</span>
          <span>새 숲지기 등록</span>
        </h1>
        <p className="mt-1 text-sm text-white/80">
          토리로의 숲길을 함께 가꿀 새 파트너를 등록합니다
        </p>
      </div>

      <form
        action={createPartnerAction}
        className="space-y-4 rounded-2xl border border-[#D4E4BC] bg-white p-6"
      >
        <div>
          <label htmlFor="name" className="mb-1 block text-sm font-semibold text-[#2D5A3D]">
            🏷️ 상호 <span className="text-red-500">*</span>
          </label>
          <input
            id="name"
            name="name"
            required
            autoComplete="organization"
            placeholder="예) 자라섬 글램핑"
            className="w-full rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] px-4 py-2.5 text-sm text-[#2C2C2C] placeholder:text-[#B5AFA8] focus:border-[#3A7A52] focus:outline-none focus:ring-2 focus:ring-[#3A7A52]/30"
          />
        </div>

        <div>
          <label htmlFor="business_name" className="mb-1 block text-sm font-semibold text-[#2D5A3D]">
            🏢 사업자명
          </label>
          <input
            id="business_name"
            name="business_name"
            autoComplete="organization"
            placeholder="예) (주)자라섬레저"
            className="w-full rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] px-4 py-2.5 text-sm text-[#2C2C2C] placeholder:text-[#B5AFA8] focus:border-[#3A7A52] focus:outline-none focus:ring-2 focus:ring-[#3A7A52]/30"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label htmlFor="username" className="mb-1 block text-sm font-semibold text-[#2D5A3D]">
              👤 아이디 <span className="text-red-500">*</span>
            </label>
            <input
              id="username"
              name="username"
              required
              autoComplete="username"
              inputMode="text"
              placeholder="로그인 아이디"
              className="w-full rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] px-4 py-2.5 text-sm text-[#2C2C2C] placeholder:text-[#B5AFA8] focus:border-[#3A7A52] focus:outline-none focus:ring-2 focus:ring-[#3A7A52]/30"
            />
          </div>
          <div>
            <label htmlFor="password" className="mb-1 block text-sm font-semibold text-[#2D5A3D]">
              🔒 비밀번호 <span className="text-red-500">*</span>
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="new-password"
              placeholder="6자 이상"
              minLength={4}
              className="w-full rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] px-4 py-2.5 text-sm text-[#2C2C2C] placeholder:text-[#B5AFA8] focus:border-[#3A7A52] focus:outline-none focus:ring-2 focus:ring-[#3A7A52]/30"
            />
          </div>
        </div>

        <div>
          <label htmlFor="email" className="mb-1 block text-sm font-semibold text-[#2D5A3D]">
            ✉️ 이메일
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            placeholder="owner@example.com"
            className="w-full rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] px-4 py-2.5 text-sm text-[#2C2C2C] placeholder:text-[#B5AFA8] focus:border-[#3A7A52] focus:outline-none focus:ring-2 focus:ring-[#3A7A52]/30"
          />
        </div>

        <div>
          <label htmlFor="phone" className="mb-1 block text-sm font-semibold text-[#2D5A3D]">
            📞 연락처
          </label>
          <input
            id="phone"
            name="phone"
            type="tel"
            autoComplete="tel"
            inputMode="tel"
            placeholder="010-1234-5678"
            pattern="[0-9\-]*"
            className="w-full rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] px-4 py-2.5 text-sm text-[#2C2C2C] placeholder:text-[#B5AFA8] focus:border-[#3A7A52] focus:outline-none focus:ring-2 focus:ring-[#3A7A52]/30"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label htmlFor="tier" className="mb-1 block text-sm font-semibold text-[#2D5A3D]">
              🌱 등급
            </label>
            <select
              id="tier"
              name="tier"
              defaultValue="SPROUT"
              className="w-full rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] px-4 py-2.5 text-sm text-[#2C2C2C] focus:border-[#3A7A52] focus:outline-none focus:ring-2 focus:ring-[#3A7A52]/30"
            >
              <option value="SPROUT">🌱 새싹</option>
              <option value="EXPLORER">🌿 탐험가</option>
              <option value="TREE">🌳 나무</option>
              <option value="FOREST">🏞️ 숲</option>
              <option value="LEGEND">🌟 레전드</option>
            </select>
          </div>
          <div>
            <label htmlFor="commission_rate" className="mb-1 block text-sm font-semibold text-[#2D5A3D]">
              💰 커미션율 (%)
            </label>
            <input
              id="commission_rate"
              name="commission_rate"
              type="number"
              min={0}
              max={100}
              step={0.1}
              defaultValue={20}
              inputMode="decimal"
              className="w-full rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] px-4 py-2.5 text-sm text-[#2C2C2C] focus:border-[#3A7A52] focus:outline-none focus:ring-2 focus:ring-[#3A7A52]/30"
            />
          </div>
        </div>

        <input type="hidden" name="status" value="ACTIVE" />

        <div className="flex items-center gap-2 pt-2">
          <button
            type="submit"
            className="flex-1 rounded-xl bg-[#2D5A3D] px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#3A7A52] focus:outline-none focus:ring-2 focus:ring-[#3A7A52]/50"
          >
            🌲 숲지기 등록
          </button>
          <Link
            href="/admin/partners"
            className="rounded-xl border border-[#D4E4BC] bg-white px-4 py-3 text-sm font-semibold text-[#6B6560] hover:bg-[#FFF8F0]"
          >
            취소
          </Link>
        </div>

        <p className="text-xs text-[#8B6F47]">
          💡 관리자가 직접 등록하면 상태가 <b>활성</b>으로 바로 저장돼요.
          자가 신청(숲지기 되기)은 <b>대기중</b> 상태로 접수된 뒤 승인이 필요합니다.
        </p>
      </form>
    </div>
  );
}
