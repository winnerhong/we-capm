import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

interface ReviewRow {
  id: string;
  participant_phone: string;
  participant_name: string | null;
  rating: number;
  comment: string | null;
  mission_highlight: string | null;
  improvement: string | null;
  photo_consent: boolean;
  is_public: boolean;
  created_at: string;
}

export default async function AdminReviewsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: event } = await supabase.from("events").select("id, name").eq("id", id).single();
  if (!event) notFound();

  const [{ data: reviewsData }, { count: participantCount }] = await Promise.all([
    supabase
      .from("event_reviews")
      .select(
        "id, participant_phone, participant_name, rating, comment, mission_highlight, improvement, photo_consent, is_public, created_at"
      )
      .eq("event_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("participants")
      .select("*", { count: "exact", head: true })
      .eq("event_id", id),
  ]);

  const reviews: ReviewRow[] = reviewsData ?? [];
  const totalReviews = reviews.length;
  const totalParticipants = participantCount ?? 0;

  const avg = totalReviews
    ? Math.round((reviews.reduce((s, r) => s + r.rating, 0) / totalReviews) * 10) / 10
    : 0;
  const dist = [5, 4, 3, 2, 1].map((star) => ({
    star,
    count: reviews.filter((r) => r.rating === star).length,
    pct: totalReviews ? (reviews.filter((r) => r.rating === star).length / totalReviews) * 100 : 0,
  }));
  const responseRatePct = totalParticipants
    ? Math.round((totalReviews / totalParticipants) * 100)
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link href={`/admin/events/${id}`} className="text-sm text-[#2D5A3D] hover:underline">
          ← {event.name}
        </Link>
        <button
          type="button"
          disabled
          title="CSV 내보내기 (준비중)"
          className="rounded-lg border border-[#D4E4BC] px-3 py-1 text-sm text-[#6B6560] opacity-60"
        >
          📊 CSV 내보내기
        </button>
      </div>

      <header>
        <h1 className="text-2xl font-bold text-[#2D5A3D]">⭐ 행사 후기</h1>
        <p className="mt-1 text-sm text-[#6B6560]">참가자들이 남긴 소중한 피드백이에요</p>
      </header>

      {/* 요약 카드 */}
      <section className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-[#D4E4BC] bg-white p-5">
          <div className="text-xs text-[#6B6560]">평균 별점</div>
          <div className="mt-2 flex items-end gap-2">
            <div className="text-4xl font-bold text-[#2D5A3D]">{avg.toFixed(1)}</div>
            <div className="pb-1 text-sm text-[#6B6560]">/ 5.0</div>
          </div>
          <div className="mt-2">
            <StarRow value={Math.round(avg)} />
          </div>
        </div>

        <div className="rounded-2xl border border-[#D4E4BC] bg-white p-5">
          <div className="text-xs text-[#6B6560]">응답률</div>
          <div className="mt-2 flex items-end gap-2">
            <div className="text-4xl font-bold text-[#2D5A3D]">
              {totalReviews}
              <span className="text-base text-[#6B6560]">/{totalParticipants}</span>
            </div>
          </div>
          <div className="mt-2 text-sm text-[#6B6560]">{responseRatePct}% 참여</div>
        </div>

        <div className="rounded-2xl border border-[#D4E4BC] bg-white p-5">
          <div className="text-xs text-[#6B6560]">별점 분포</div>
          <ul className="mt-2 space-y-1">
            {dist.map((d) => (
              <li key={d.star} className="flex items-center gap-2 text-sm">
                <span className="w-6 text-[#2D5A3D]">{d.star}★</span>
                <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-[#F3F0E9]">
                  <div
                    className="absolute inset-y-0 left-0 rounded-full bg-violet-500"
                    style={{ width: `${d.pct}%` }}
                  />
                </div>
                <span className="w-8 text-right text-xs text-[#6B6560]">{d.count}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* 후기 리스트 */}
      <section>
        <h2 className="mb-3 text-lg font-bold text-[#2D5A3D]">💬 후기 {totalReviews}건</h2>
        {totalReviews === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#D4E4BC] bg-white p-10 text-center">
            <div className="text-4xl">🌱</div>
            <p className="mt-2 text-sm text-[#6B6560]">아직 남겨진 후기가 없어요</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {reviews.map((r) => (
              <li key={r.id} className="rounded-2xl border border-[#D4E4BC] bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="font-semibold text-[#2C2C2C]">{r.participant_name ?? "이름없음"}</div>
                    <div className="text-xs text-[#6B6560]">{formatPhone(r.participant_phone)}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <StarRow value={r.rating} />
                    <span className="text-sm font-semibold text-[#2D5A3D]">{r.rating}점</span>
                  </div>
                </div>
                {r.comment && (
                  <p className="mt-3 whitespace-pre-wrap text-sm text-[#2C2C2C]">{r.comment}</p>
                )}
                {r.mission_highlight && (
                  <div className="mt-3 rounded-xl bg-[#FFF8F0] p-3 text-sm">
                    <span className="mr-2 text-xs font-semibold text-[#2D5A3D]">🌲 좋았던 숲길</span>
                    <span className="text-[#2C2C2C]">{r.mission_highlight}</span>
                  </div>
                )}
                {r.improvement && (
                  <div className="mt-2 rounded-xl bg-[#FFF8F0] p-3 text-sm">
                    <span className="mr-2 text-xs font-semibold text-[#2D5A3D]">💭 개선 의견</span>
                    <span className="text-[#2C2C2C]">{r.improvement}</span>
                  </div>
                )}
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                  <div className="flex flex-wrap gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 ${
                        r.is_public
                          ? "bg-violet-100 text-violet-700"
                          : "bg-neutral-100 text-neutral-600"
                      }`}
                    >
                      {r.is_public ? "공개" : "비공개"}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 ${
                        r.photo_consent
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-neutral-100 text-neutral-600"
                      }`}
                    >
                      사진 {r.photo_consent ? "동의" : "비동의"}
                    </span>
                  </div>
                  <span className="text-[#6B6560]">
                    {new Date(r.created_at).toLocaleString("ko-KR")}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function StarRow({ value }: { value: number }) {
  return (
    <div className="flex gap-0.5" aria-label={`별점 ${value}점`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <svg
          key={n}
          viewBox="0 0 24 24"
          className={`h-4 w-4 ${
            n <= value ? "fill-[#F5C518] stroke-[#F5C518]" : "fill-transparent stroke-[#C9C3BA]"
          }`}
          strokeWidth={1.5}
          strokeLinejoin="round"
        >
          <path d="M12 2.5l2.95 5.98 6.6.96-4.78 4.66 1.13 6.58L12 17.58l-5.9 3.1 1.13-6.58L2.45 9.44l6.6-.96L12 2.5z" />
        </svg>
      ))}
    </div>
  );
}

function formatPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 11) return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  if (digits.length === 10) return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  return phone;
}
