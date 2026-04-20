import { createClient } from "@/lib/supabase/server";
import { ChallengeListClient, type ChallengeRow } from "./challenge-list-client";

export const dynamic = "force-dynamic";

type EventLite = { id: string; name: string };

export default async function AdminChallengesPage() {
  const supabase = await createClient();

  // challenges 테이블이 아직 준비되지 않았을 수 있어서 방어적으로 읽어온다.
  let challenges: ChallengeRow[] = [];
  let tableReady = true;
  try {
    const { data, error } = await (
      supabase as unknown as {
        from: (t: string) => {
          select: (cols: string) => {
            order: (col: string, opts: { ascending: boolean }) => Promise<{
              data: ChallengeRow[] | null;
              error: { message: string; code?: string } | null;
            }>;
          };
        };
      }
    )
      .from("challenges")
      .select(
        "id, event_id, title, description, icon, goal_type, goal_value, reward_acorns, reward_badge, starts_at, ends_at, status"
      )
      .order("starts_at", { ascending: false });

    if (error) {
      // 테이블이 아직 없는 경우(42P01) 또는 권한/기타 오류 → 빈 상태로 표시
      tableReady = false;
    } else {
      challenges = data ?? [];
    }
  } catch {
    tableReady = false;
  }

  // 연결된 행사명 붙이기 (존재하는 event_id만)
  const eventIds = Array.from(
    new Set(challenges.map((c) => c.event_id).filter((v): v is string => !!v))
  );
  const eventNameMap = new Map<string, string>();
  if (eventIds.length > 0) {
    const { data: events } = await supabase
      .from("events")
      .select("id, name")
      .in("id", eventIds);
    (events ?? []).forEach((e: EventLite) => eventNameMap.set(e.id, e.name));
  }
  const enriched = challenges.map((c) => ({
    ...c,
    event_name: c.event_id ? eventNameMap.get(c.event_id) ?? null : null,
  }));

  const activeCount = enriched.filter((c) => (c.status ?? "ACTIVE") === "ACTIVE").length;
  const endedCount = enriched.filter((c) => c.status === "ENDED").length;
  const totalAcorns = enriched.reduce((sum, c) => sum + (c.reward_acorns ?? 0), 0);

  return (
    <ChallengeListClient
      challenges={enriched}
      activeCount={activeCount}
      endedCount={endedCount}
      totalAcorns={totalAcorns}
      tableReady={tableReady}
    />
  );
}
