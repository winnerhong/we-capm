import Link from "next/link";
import { requirePartner } from "@/lib/auth-guard";
import { createClient } from "@/lib/supabase/server";
import { createExternalReviewAction } from "../actions";

export const dynamic = "force-dynamic";

type ProgramItem = { id: string; title: string };

async function loadPartnerPrograms(partnerId: string): Promise<ProgramItem[]> {
  const supabase = await createClient();
  try {
    const { data } = await (
      supabase.from("partner_programs") as unknown as {
        select: (c: string) => {
          eq: (k: string, v: string) => {
            order: (
              k: string,
              opts: { ascending: boolean }
            ) => Promise<{ data: ProgramItem[] | null }>;
          };
        };
      }
    )
      .select("id,title")
      .eq("partner_id", partnerId)
      .order("title", { ascending: true });
    return (data ?? []) as ProgramItem[];
  } catch {
    return [];
  }
}

const PLATFORM_OPTIONS = [
  { value: "NAVER", label: "네이버" },
  { value: "GOOGLE", label: "구글" },
  { value: "INSTAGRAM", label: "인스타그램" },
  { value: "BLOG", label: "블로그" },
  { value: "KAKAO", label: "카카오" },
  { value: "MANUAL", label: "수동 (기타)" },
];

export default async function NewExternalReviewPage() {
  const partner = await requirePartner();
  const programs = await loadPartnerPrograms(partner.id);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav aria-label="breadcrumb" className="text-xs text-[#8B7F75]">
        <Link href="/partner/dashboard" className="hover:text-[#2D5A3D]">
          대시보드
        </Link>
        <span className="mx-2">/</span>
        <Link href="/partner/analytics" className="hover:text-[#2D5A3D]">
          분석
        </Link>
        <span className="mx-2">/</span>
        <Link href="/partner/analytics/reviews" className="hover:text-[#2D5A3D]">
          리뷰 관리
        </Link>
        <span className="mx-2">/</span>
        <span className="font-semibold text-[#2D5A3D]">외부 리뷰 추가</span>
      </nav>

      <header className="rounded-3xl border border-[#D4E4BC] bg-gradient-to-br from-[#E8F0E4] via-white to-[#FFF8F0] p-5 shadow-sm md:p-7">
        <div className="flex items-center gap-3">
          <span className="text-3xl" aria-hidden>
            ➕
          </span>
          <div>
            <h1 className="text-xl font-bold text-[#2D5A3D] md:text-2xl">
              외부 리뷰 수동 추가
            </h1>
            <p className="mt-1 text-xs text-[#6B6560] md:text-sm">
              네이버·구글·블로그·인스타 등 외부 플랫폼에 올라온 리뷰를 기록해보세요.
            </p>
          </div>
        </div>
      </header>

      <form
        action={createExternalReviewAction}
        className="space-y-5 rounded-2xl border border-[#D4E4BC] bg-white p-5 shadow-sm md:p-7"
      >
        {/* 플랫폼 */}
        <div className="space-y-1.5">
          <label
            htmlFor="platform"
            className="block text-sm font-semibold text-[#2D5A3D]"
          >
            플랫폼 <span className="text-red-500">*</span>
          </label>
          <select
            id="platform"
            name="platform"
            required
            defaultValue="NAVER"
            className="w-full rounded-xl border border-[#D4E4BC] bg-white px-3 py-2.5 text-sm font-semibold text-[#2D5A3D] focus:border-[#2D5A3D] focus:outline-none focus:ring-2 focus:ring-[#2D5A3D]/20"
          >
            {PLATFORM_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <p className="text-[11px] text-[#8B7F75]">
            리뷰가 게재된 플랫폼을 선택해주세요.
          </p>
        </div>

        {/* 작성자 이름 */}
        <div className="space-y-1.5">
          <label
            htmlFor="author_name"
            className="block text-sm font-semibold text-[#2D5A3D]"
          >
            작성자 이름
          </label>
          <input
            id="author_name"
            name="author_name"
            type="text"
            inputMode="text"
            autoComplete="off"
            maxLength={80}
            placeholder="예: 숲길러버123"
            className="w-full rounded-xl border border-[#D4E4BC] bg-white px-3 py-2.5 text-sm focus:border-[#2D5A3D] focus:outline-none focus:ring-2 focus:ring-[#2D5A3D]/20"
          />
        </div>

        {/* 별점 (라디오 카드) */}
        <fieldset className="space-y-1.5">
          <legend className="block text-sm font-semibold text-[#2D5A3D]">
            별점 <span className="text-red-500">*</span>
          </legend>
          <div className="flex flex-wrap gap-2">
            {([5, 4, 3, 2, 1] as const).map((n) => (
              <label
                key={n}
                className="cursor-pointer"
                aria-label={`${n}점`}
              >
                <input
                  type="radio"
                  name="rating"
                  value={n}
                  required
                  defaultChecked={n === 5}
                  className="peer sr-only"
                />
                <span className="inline-flex items-center gap-1 rounded-xl border-2 border-[#D4E4BC] bg-white px-3 py-2 text-sm font-mono text-[#8B7F75] transition peer-checked:border-amber-500 peer-checked:bg-amber-50 peer-checked:text-amber-600 peer-focus:ring-2 peer-focus:ring-amber-500/30 hover:bg-[#F5F1E8]">
                  <span className="text-base">
                    {"★".repeat(n)}
                    <span className="text-[#E5DCD0]">{"★".repeat(5 - n)}</span>
                  </span>
                  <span className="text-xs text-[#6B6560]">{n}점</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        {/* 내용 */}
        <div className="space-y-1.5">
          <label
            htmlFor="content"
            className="block text-sm font-semibold text-[#2D5A3D]"
          >
            리뷰 내용
          </label>
          <textarea
            id="content"
            name="content"
            rows={5}
            maxLength={4000}
            placeholder="리뷰 본문을 그대로 복사해서 붙여넣어주세요."
            className="w-full resize-y rounded-xl border border-[#D4E4BC] bg-white p-3 text-sm focus:border-[#2D5A3D] focus:outline-none focus:ring-2 focus:ring-[#2D5A3D]/20"
          />
        </div>

        {/* 원본 URL */}
        <div className="space-y-1.5">
          <label
            htmlFor="source_url"
            className="block text-sm font-semibold text-[#2D5A3D]"
          >
            원본 URL
            <span className="ml-1 text-[11px] font-normal text-[#8B7F75]">
              (선택)
            </span>
          </label>
          <input
            id="source_url"
            name="source_url"
            type="url"
            inputMode="url"
            autoComplete="url"
            placeholder="https://blog.naver.com/..."
            className="w-full rounded-xl border border-[#D4E4BC] bg-white px-3 py-2.5 text-sm focus:border-[#2D5A3D] focus:outline-none focus:ring-2 focus:ring-[#2D5A3D]/20"
          />
        </div>

        {/* 작성일 */}
        <div className="space-y-1.5">
          <label
            htmlFor="published_at"
            className="block text-sm font-semibold text-[#2D5A3D]"
          >
            작성일 <span className="text-red-500">*</span>
          </label>
          <input
            id="published_at"
            name="published_at"
            type="date"
            required
            defaultValue={today}
            max={today}
            className="w-full rounded-xl border border-[#D4E4BC] bg-white px-3 py-2.5 text-sm focus:border-[#2D5A3D] focus:outline-none focus:ring-2 focus:ring-[#2D5A3D]/20"
          />
        </div>

        {/* 프로그램 연결 */}
        <div className="space-y-1.5">
          <label
            htmlFor="program_id"
            className="block text-sm font-semibold text-[#2D5A3D]"
          >
            연결할 프로그램
            <span className="ml-1 text-[11px] font-normal text-[#8B7F75]">
              (선택)
            </span>
          </label>
          <select
            id="program_id"
            name="program_id"
            defaultValue=""
            className="w-full rounded-xl border border-[#D4E4BC] bg-white px-3 py-2.5 text-sm font-semibold text-[#2D5A3D] focus:border-[#2D5A3D] focus:outline-none focus:ring-2 focus:ring-[#2D5A3D]/20"
          >
            <option value="">연결 안 함</option>
            {programs.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
          {programs.length === 0 && (
            <p className="text-[11px] text-[#8B7F75]">
              등록된 프로그램이 없어요.{" "}
              <Link
                href="/partner/programs/new"
                className="font-semibold text-[#2D5A3D] hover:underline"
              >
                프로그램 먼저 등록하기
              </Link>
            </p>
          )}
        </div>

        {/* 액션 버튼 */}
        <div className="flex flex-col-reverse items-center gap-2 border-t border-dashed border-[#EFE9E1] pt-5 md:flex-row md:justify-end">
          <Link
            href="/partner/analytics/reviews"
            className="w-full rounded-xl border border-[#D4E4BC] bg-white px-5 py-2.5 text-center text-sm font-semibold text-[#6B6560] hover:bg-[#F5F1E8] md:w-auto"
          >
            취소
          </Link>
          <button
            type="submit"
            className="w-full rounded-xl bg-[#2D5A3D] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#234a30] focus:outline-none focus:ring-2 focus:ring-[#2D5A3D]/40 md:w-auto"
          >
            ➕ 리뷰 추가하기
          </button>
        </div>
      </form>
    </div>
  );
}
