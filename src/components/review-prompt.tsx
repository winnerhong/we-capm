import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getParticipant } from "@/lib/participant-session";

type EventStatusLike = string | null | undefined;

interface Props {
  eventId: string;
  eventStatus: EventStatusLike;
}

/**
 * 행사 종료 후에만 표시되는 후기 유도 카드.
 * - status가 ENDED / CONFIRMED 가 아니면 null
 * - 참가자 세션이 없으면 null
 * - 이미 후기를 남겼으면 null
 *
 * 호출부에서 직접 `<ReviewPrompt eventId={id} eventStatus={event.status} />`
 * 형태로 사용할 수 있게 만들었지만, event/[id]/page.tsx 에는
 * 자동 삽입하지 않는다 (복잡/고트래픽 페이지라 팀 확인 후 삽입).
 */
export async function ReviewPrompt({ eventId, eventStatus }: Props) {
  if (eventStatus !== "ENDED" && eventStatus !== "CONFIRMED") return null;

  const session = await getParticipant(eventId);
  if (!session?.phone) return null;

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("event_reviews")
    .select("id")
    .eq("event_id", eventId)
    .eq("participant_phone", session.phone)
    .maybeSingle();

  if (existing) return null;

  return (
    <Link
      href={`/event/${eventId}/review`}
      className="block rounded-2xl border-2 border-violet-200 bg-gradient-to-br from-violet-50 to-[#FFF8F0] p-5 shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="flex items-center gap-3">
        <div className="text-4xl" aria-hidden>
          🌱
        </div>
        <div className="flex-1">
          <div className="text-xs font-semibold text-violet-700">오늘의 숲길 후기</div>
          <h3 className="mt-0.5 font-bold text-[#2D5A3D]">소중한 후기를 남겨주세요</h3>
          <p className="mt-1 text-xs text-[#6B6560]">별점 한 번이면 충분해요 (30초 소요)</p>
        </div>
        <div className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-bold text-white">
          후기 쓰기 →
        </div>
      </div>
    </Link>
  );
}

export default ReviewPrompt;
