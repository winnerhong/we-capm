import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getParticipant } from "@/lib/participant-session";
import ReviewForm, { type MissionOption, type ReviewFormValues } from "./review-form";

export const dynamic = "force-dynamic";

export default async function ReviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; edit?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;

  const session = await getParticipant(id);
  if (!session) redirect(`/join`);

  const supabase = await createClient();
  const [{ data: event }, { data: missions }, { data: existing }] = await Promise.all([
    supabase.from("events").select("id, name, status").eq("id", id).single(),
    supabase
      .from("missions")
      .select("id, title, order")
      .eq("event_id", id)
      .eq("is_active", true)
      .order("order", { ascending: true }),
    supabase
      .from("event_reviews")
      .select("rating, comment, mission_highlight, improvement, photo_consent, is_public, created_at")
      .eq("event_id", id)
      .eq("participant_phone", session.phone)
      .maybeSingle(),
  ]);

  if (!event) notFound();

  const missionOptions: MissionOption[] = (missions ?? []).map((m) => ({ id: m.id, title: m.title }));

  const justSubmitted = sp.ok === "1";
  const editMode = sp.edit === "1";
  const hasExisting = !!existing;

  // 제출 완료 페이지: 편집 모드가 아닌 경우만 감사 인사 표시
  if (justSubmitted && hasExisting && !editMode) {
    return (
      <main className="min-h-dvh bg-neutral-50 p-4 pb-24">
        <div className="mx-auto max-w-lg space-y-4">
          <Link href={`/event/${id}`} className="text-sm text-[#2D5A3D] hover:underline">
            ← 숲 홈으로
          </Link>
          <div className="rounded-2xl bg-gradient-to-br from-[#2D5A3D] via-[#3A7A52] to-[#4A7C59] p-8 text-center text-white shadow-lg">
            <div className="text-6xl">🌱</div>
            <h1 className="mt-4 text-2xl font-bold">감사합니다!</h1>
            <p className="mt-2 text-sm opacity-90">
              소중한 후기는 더 좋은 숲길을 만드는 데 쓰여요
            </p>
          </div>
          <ExistingReviewCard review={existing!} />
          <Link
            href={`/event/${id}/review?edit=1`}
            className="block rounded-2xl border border-[#D4E4BC] bg-white py-3 text-center text-sm font-semibold text-[#2D5A3D] hover:bg-[#FFF8F0]"
          >
            후기 수정하기
          </Link>
        </div>
      </main>
    );
  }

  // 이미 후기가 있고 편집 모드가 아님 -> 기존 후기 표시 + 수정 버튼
  if (hasExisting && !editMode) {
    return (
      <main className="min-h-dvh bg-neutral-50 p-4 pb-24">
        <div className="mx-auto max-w-lg space-y-4">
          <Link href={`/event/${id}`} className="text-sm text-[#2D5A3D] hover:underline">
            ← 숲 홈으로
          </Link>
          <header className="rounded-2xl bg-gradient-to-br from-[#2D5A3D] via-[#3A7A52] to-[#4A7C59] p-5 text-white shadow-lg">
            <div className="text-xs opacity-80">🌲 {event.name}</div>
            <h1 className="mt-1 text-xl font-bold">이미 후기를 남기셨어요 🙏</h1>
          </header>
          <ExistingReviewCard review={existing!} />
          <Link
            href={`/event/${id}/review?edit=1`}
            className="block rounded-2xl bg-violet-600 py-4 text-center text-base font-bold text-white hover:bg-violet-700"
          >
            후기 수정하기
          </Link>
        </div>
      </main>
    );
  }

  const initial: ReviewFormValues | null = existing
    ? {
        rating: existing.rating,
        comment: existing.comment,
        mission_highlight: existing.mission_highlight,
        improvement: existing.improvement,
        photo_consent: existing.photo_consent,
        is_public: existing.is_public,
      }
    : null;

  return (
    <main className="min-h-dvh bg-neutral-50 p-4 pb-24">
      <div className="mx-auto max-w-lg space-y-4">
        <Link href={`/event/${id}`} className="text-sm text-[#2D5A3D] hover:underline">
          ← 숲 홈으로
        </Link>

        <header className="rounded-2xl bg-gradient-to-br from-[#2D5A3D] via-[#3A7A52] to-[#4A7C59] p-5 text-white shadow-lg">
          <div className="text-xs opacity-80">🌲 {event.name}</div>
          <h1 className="mt-1 text-xl font-bold">
            {editMode ? "후기 수정하기" : "🌱 오늘의 숲길 후기"}
          </h1>
          <p className="mt-2 text-sm opacity-90">
            {editMode
              ? "내용을 편하게 수정해주세요"
              : "별점과 짧은 한마디가 다음 참가자들에게 큰 도움이 돼요"}
          </p>
        </header>

        <ReviewForm
          eventId={id}
          missions={missionOptions}
          initial={initial}
          mode={editMode ? "edit" : "create"}
        />
      </div>
    </main>
  );
}

function ExistingReviewCard({ review }: { review: ReviewFormValues & { created_at?: string } }) {
  return (
    <div className="rounded-2xl border border-[#D4E4BC] bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2">
        <StarDisplay value={review.rating} />
        <span className="text-sm font-semibold text-[#2D5A3D]">{review.rating}점</span>
      </div>
      {review.comment && (
        <p className="mt-3 whitespace-pre-wrap text-sm text-[#2C2C2C]">{review.comment}</p>
      )}
      {review.mission_highlight && (
        <div className="mt-3 rounded-xl bg-[#FFF8F0] p-3 text-sm">
          <span className="mr-2 text-xs font-semibold text-[#2D5A3D]">🌲 가장 좋았던 숲길</span>
          <span className="text-[#2C2C2C]">{review.mission_highlight}</span>
        </div>
      )}
      {review.improvement && (
        <div className="mt-2 rounded-xl bg-[#FFF8F0] p-3 text-sm">
          <span className="mr-2 text-xs font-semibold text-[#2D5A3D]">💭 개선 의견</span>
          <span className="text-[#2C2C2C]">{review.improvement}</span>
        </div>
      )}
      <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
        <span
          className={`rounded-full px-2 py-0.5 ${
            review.is_public ? "bg-violet-100 text-violet-700" : "bg-neutral-100 text-neutral-600"
          }`}
        >
          {review.is_public ? "공개 후기" : "비공개 후기"}
        </span>
        <span
          className={`rounded-full px-2 py-0.5 ${
            review.photo_consent ? "bg-emerald-100 text-emerald-700" : "bg-neutral-100 text-neutral-600"
          }`}
        >
          사진 공개 {review.photo_consent ? "동의" : "비동의"}
        </span>
      </div>
    </div>
  );
}

function StarDisplay({ value }: { value: number }) {
  return (
    <div className="flex gap-0.5" aria-label={`별점 ${value}점`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <svg
          key={n}
          viewBox="0 0 24 24"
          className={`h-5 w-5 ${n <= value ? "fill-[#F5C518] stroke-[#F5C518]" : "fill-transparent stroke-[#C9C3BA]"}`}
          strokeWidth={1.5}
          strokeLinejoin="round"
        >
          <path d="M12 2.5l2.95 5.98 6.6.96-4.78 4.66 1.13 6.58L12 17.58l-5.9 3.1 1.13-6.58L2.45 9.44l6.6-.96L12 2.5z" />
        </svg>
      ))}
    </div>
  );
}
