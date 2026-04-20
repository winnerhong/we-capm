import { NextResponse } from "next/server";
import { getParticipant } from "@/lib/participant-session";
import { createClient } from "@/lib/supabase/server";
import { logAccess, getRequestMeta } from "@/lib/audit-log";

export const dynamic = "force-dynamic";

/**
 * PIPA 제35조 — 개인정보 열람권
 * 본인 데이터를 JSON 형식으로 내려받을 수 있도록 한다.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const eventId = url.searchParams.get("event_id");
  if (!eventId) {
    return NextResponse.json(
      { error: "event_id가 필요합니다" },
      { status: 400 }
    );
  }

  const p = await getParticipant(eventId);
  if (!p) {
    return NextResponse.json(
      { error: "로그인이 필요합니다" },
      { status: 401 }
    );
  }

  const supabase = await createClient();

  const { data: participant } = await (
    supabase.from("participants") as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          eq: (k: string, v: string) => {
            maybeSingle: () => Promise<{ data: Record<string, unknown> | null }>;
          };
        };
      };
    }
  )
    .select("*")
    .eq("event_id", eventId)
    .eq("phone", p.phone)
    .maybeSingle();

  const { data: registration } = await (
    supabase.from("event_registrations") as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          eq: (k: string, v: string) => {
            maybeSingle: () => Promise<{ data: Record<string, unknown> | null }>;
          };
        };
      };
    }
  )
    .select("*")
    .eq("event_id", eventId)
    .eq("phone", p.phone)
    .maybeSingle();

  const participantId = (participant as { id?: string } | null)?.id ?? "";

  const { data: submissions } = await (
    supabase.from("submissions") as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => Promise<{
          data: Record<string, unknown>[] | null;
        }>;
      };
    }
  )
    .select("*")
    .eq("participant_id", participantId);

  const { data: rewards } = await (
    supabase.from("reward_claims") as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => Promise<{
          data: Record<string, unknown>[] | null;
        }>;
      };
    }
  )
    .select("*")
    .eq("participant_id", participantId);

  const { data: reviews } = await (
    supabase.from("event_reviews") as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => Promise<{
          data: Record<string, unknown>[] | null;
        }>;
      };
    }
  )
    .select("*")
    .eq("participant_phone", p.phone);

  const myData = {
    exported_at: new Date().toISOString(),
    pipa_notice:
      "본 데이터는 개인정보보호법 제35조(열람권)에 따라 본인에게 제공됩니다. 타인에게 공유하지 마세요.",
    personal_info: {
      name: p.name,
      phone: p.phone,
    },
    event_participation: {
      event_id: eventId,
      participant_data: participant,
      registration_data: registration,
    },
    submissions: submissions ?? [],
    rewards: rewards ?? [],
    reviews: reviews ?? [],
  };

  // 열람 감사 로그
  const meta = getRequestMeta(request.headers);
  await logAccess(supabase, {
    user_type: "PARTICIPANT",
    user_id: participantId || undefined,
    user_identifier: p.phone,
    action: "EXPORT_MY_DATA",
    resource: `event:${eventId}`,
    status_code: 200,
    ...meta,
  });

  const datePart = new Date().toISOString().slice(0, 10);
  return new NextResponse(JSON.stringify(myData, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="toriro_my_data_${datePart}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
