import Link from "next/link";
import { requirePartner } from "@/lib/auth-guard";
import { createClient } from "@/lib/supabase/server";
import { createTrailAction } from "../actions";
import { ImageUploader } from "@/components/image-uploader";
import { MultiImageUploader } from "@/components/multi-image-uploader";
import {
  DifficultyPicker,
  type CustomDifficulty,
} from "../difficulty-picker";

async function loadCustomDifficulties(
  partnerId: string
): Promise<CustomDifficulty[]> {
  const supabase = await createClient();
  const sb = supabase as unknown as {
    from: (t: string) => {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          order: (
            c: string,
            o: { ascending: boolean }
          ) => Promise<{ data: CustomDifficulty[] | null }>;
        };
      };
    };
  };
  const { data } = await sb
    .from("partner_trail_difficulties")
    .select("id,key,label,icon,description")
    .eq("partner_id", partnerId)
    .order("display_order", { ascending: true });
  return data ?? [];
}

export const dynamic = "force-dynamic";

export default async function NewTrailPage() {
  const partner = await requirePartner();
  const customDifficulties = await loadCustomDifficulties(partner.id);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <nav className="text-xs text-[#6B6560]">
        <Link href="/partner/dashboard" className="hover:underline">
          대시보드
        </Link>
        <span className="mx-1">›</span>
        <Link href="/partner/trails" className="hover:underline">
          나만의 숲길
        </Link>
        <span className="mx-1">›</span>
        <span className="font-semibold text-[#2D5A3D]">새 숲길</span>
      </nav>

      <section className="overflow-hidden rounded-2xl bg-gradient-to-br from-[#2D5A3D] via-[#4A7C59] to-[#2D5A3D] p-6 text-white shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wider text-[#D4E4BC]">
          New Trail
        </p>
        <h1 className="mt-2 flex items-center gap-2 text-2xl font-bold">
          <span>🗺️</span>
          <span>새 숲길 만들기</span>
        </h1>
        <p className="mt-1 text-sm text-[#D4E4BC]">
          이름과 난이도만 정하면 시작할 수 있어요. 지점은 나중에 추가하세요.
        </p>
      </section>

      <form
        action={createTrailAction}
        className="space-y-5 rounded-2xl border border-[#D4E4BC] bg-white p-5 shadow-sm md:p-6"
      >
        <div>
          <label
            htmlFor="name"
            className="text-xs font-semibold text-[#2D5A3D]"
          >
            숲길 이름 *
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            maxLength={60}
            placeholder="예) 토리숲 비밀의 오솔길"
            className="mt-1 w-full rounded-lg border border-[#D4E4BC] bg-white px-3 py-2 text-sm focus:border-[#2D5A3D] focus:outline-none focus:ring-2 focus:ring-[#2D5A3D]/20"
          />
        </div>

        <div>
          <label
            htmlFor="description"
            className="text-xs font-semibold text-[#2D5A3D]"
          >
            설명
          </label>
          <textarea
            id="description"
            name="description"
            rows={3}
            placeholder="숲길의 테마와 포인트를 한두 줄로 소개해 주세요."
            className="mt-1 w-full rounded-lg border border-[#D4E4BC] bg-white px-3 py-2 text-sm focus:border-[#2D5A3D] focus:outline-none focus:ring-2 focus:ring-[#2D5A3D]/20"
          />
        </div>

        <DifficultyPicker
          name="difficulty"
          defaultValue="EASY"
          customDifficulties={customDifficulties}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="estimated_minutes"
              className="text-xs font-semibold text-[#2D5A3D]"
            >
              예상 소요 시간 (분)
            </label>
            <input
              id="estimated_minutes"
              name="estimated_minutes"
              type="number"
              min={0}
              step={5}
              inputMode="numeric"
              placeholder="예) 60"
              className="mt-1 w-full rounded-lg border border-[#D4E4BC] bg-white px-3 py-2 text-sm focus:border-[#2D5A3D] focus:outline-none focus:ring-2 focus:ring-[#2D5A3D]/20"
            />
          </div>
          <div>
            <label
              htmlFor="distance_km"
              className="text-xs font-semibold text-[#2D5A3D]"
            >
              총 거리 (km)
            </label>
            <input
              id="distance_km"
              name="distance_km"
              type="number"
              min={0}
              step={0.1}
              inputMode="decimal"
              placeholder="예) 2.5"
              className="mt-1 w-full rounded-lg border border-[#D4E4BC] bg-white px-3 py-2 text-sm focus:border-[#2D5A3D] focus:outline-none focus:ring-2 focus:ring-[#2D5A3D]/20"
            />
          </div>
        </div>

        {/* 커버 + 추가 이미지 (반반 배치) */}
        <div className="grid gap-4 md:grid-cols-2">
          <ImageUploader
            name="cover_image_url"
            label="커버 이미지"
            folder="trails"
            maxKb={500}
            hint="클릭 / 드래그 / Ctrl+V로 붙여넣기 가능"
          />
          <MultiImageUploader
            name="images"
            label="추가 이미지"
            folder="trails/gallery"
            maxKb={500}
            maxImages={10}
            hint="폴더에서 여러 장 한번에 선택 가능"
          />
        </div>

        {/* 장소·주소·링크·비고 */}
        <div className="rounded-2xl border border-[#D4E4BC] bg-white p-4 space-y-3">
          <p className="text-xs font-semibold text-[#2D5A3D]">📍 장소 & 추가 정보</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="venue_name" className="text-xs font-semibold text-[#2D5A3D]">
                장소명
              </label>
              <input
                id="venue_name"
                name="venue_name"
                type="text"
                maxLength={80}
                placeholder="예) 가평 자라섬 숲길"
                className="mt-1 w-full rounded-lg border border-[#D4E4BC] bg-white px-3 py-2 text-sm focus:border-[#2D5A3D] focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="venue_address" className="text-xs font-semibold text-[#2D5A3D]">
                주소
              </label>
              <input
                id="venue_address"
                name="venue_address"
                type="text"
                maxLength={120}
                placeholder="예) 경기도 가평군 자라섬"
                className="mt-1 w-full rounded-lg border border-[#D4E4BC] bg-white px-3 py-2 text-sm focus:border-[#2D5A3D] focus:outline-none"
              />
            </div>
          </div>
          <div>
            <label htmlFor="external_link" className="text-xs font-semibold text-[#2D5A3D]">
              링크
            </label>
            <input
              id="external_link"
              name="external_link"
              type="url"
              inputMode="url"
              maxLength={300}
              placeholder="https://..."
              className="mt-1 w-full rounded-lg border border-[#D4E4BC] bg-white px-3 py-2 text-sm focus:border-[#2D5A3D] focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="notes" className="text-xs font-semibold text-[#2D5A3D]">
              비고
            </label>
            <textarea
              id="notes"
              name="notes"
              rows={2}
              maxLength={500}
              placeholder="운영 시 참고사항 (내부 메모)"
              className="mt-1 w-full rounded-lg border border-[#D4E4BC] bg-white px-3 py-2 text-sm focus:border-[#2D5A3D] focus:outline-none"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Link
            href="/partner/trails"
            className="rounded-xl border border-[#D4E4BC] bg-white px-4 py-2 text-sm font-semibold text-[#2D5A3D] transition hover:bg-[#F5F1E8]"
          >
            취소
          </Link>
          <button
            type="submit"
            className="rounded-xl bg-[#2D5A3D] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#4A7C59]"
          >
            🌱 숲길 만들기
          </button>
        </div>
      </form>
    </div>
  );
}
