// server-only: 도토리 원장 기록 — 단일 창구.
//
// 왜 모았나:
//   1) 도토리가 행사 단위로 집계되면서 모든 지급·차감이 event_id 를 남겨야 한다.
//      한 군데라도 빠지면 그 도토리는 어느 행사에도 안 잡히고 사라진 것처럼 보인다.
//   2) event_id 컬럼이 아직 없는 배포 창에서도 지급이 실패하면 안 된다.
//      컬럼 미존재면 event_id 를 빼고 한 번 더 시도한다(= 예전 동작).
//
// 행사 해석 헬퍼도 여기 둔다. 미션은 스탬프북을 거쳐, FM 은 세션을 거쳐 행사에 닿는다.

import "server-only";
import type { createClient } from "@/lib/supabase/server";

type Supa = Awaited<ReturnType<typeof createClient>>;
type SbErr = { message?: string; code?: string } | null;

export interface AcornTxInput {
  user_id: string;
  amount: number;
  reason: string;
  source_type?: string | null;
  source_id?: string | null;
  memo?: string | null;
  /** 이 도토리가 오간 행사. 모르면 null — 나중에 소급 귀속된다. */
  event_id?: string | null;
}

function isMissingEventIdColumn(e: SbErr): boolean {
  if (!e) return false;
  if (e.code === "42703" || e.code === "PGRST204") return true;
  return typeof e.message === "string" && e.message.includes("event_id");
}

/**
 * 원장 1건 기록. 반환값은 supabase 응답과 같은 모양이라 기존 호출부의
 * 23505(멱등) 처리 로직을 그대로 쓸 수 있다.
 */
export async function insertAcornTx(
  supabase: Supa,
  input: AcornTxInput
): Promise<{ error: SbErr }> {
  const table = () =>
    supabase.from("user_acorn_transactions" as never) as unknown as {
      insert: (r: unknown) => Promise<{ error: SbErr }>;
    };

  const base = {
    user_id: input.user_id,
    amount: input.amount,
    reason: input.reason,
    source_type: input.source_type ?? null,
    source_id: input.source_id ?? null,
    memo: input.memo ?? null,
  };

  const first = (await table().insert({
    ...base,
    event_id: input.event_id ?? null,
  })) as { error: SbErr };

  if (first.error && isMissingEventIdColumn(first.error)) {
    // 마이그레이션 미적용 창 — event_id 없이 예전 방식으로.
    return (await table().insert(base)) as { error: SbErr };
  }
  return first;
}

/**
 * 스탬프북이 연결된 행사. 여러 행사에 연결돼 있으면 첫 번째.
 * 연결이 없으면 null — 그 도토리는 미귀속으로 남고 나중에 소급 처리된다.
 */
export async function eventIdForQuestPack(
  supabase: Supa,
  questPackId: string | null | undefined
): Promise<string | null> {
  if (!questPackId) return null;
  try {
    const resp = (await (
      supabase.from("org_event_quest_packs" as never) as unknown as {
        select: (c: string) => {
          eq: (
            k: string,
            v: string
          ) => {
            limit: (n: number) => Promise<{ data: { event_id: string }[] | null }>;
          };
        };
      }
    )
      .select("event_id")
      .eq("quest_pack_id", questPackId)
      .limit(1)) as { data: { event_id: string }[] | null };
    if (resp.data?.[0]?.event_id) return resp.data[0].event_id;

    // 폴백 — 행사에 연결 안 된 LIVE 팩.
    // 참가자 화면(resolveEventPackIds)은 행사에 팩이 없으면 기관의 LIVE 팩을
    // 대신 보여준다. 그 경로로 미션을 하면 여기 링크 조회가 비어서 도토리가
    // **어느 행사에도 귀속되지 않았고**, 헤더의 행사 잔액이 획득보다 작게
    // 보였다. 같은 규칙을 거꾸로 적용한다: 이 팩 기관의 LIVE 행사가 딱
    // 하나면 그 행사로 귀속. 둘 이상이면 어느 쪽인지 알 수 없으니 null.
    const pack = (await (
      supabase.from("org_quest_packs" as never) as unknown as {
        select: (c: string) => {
          eq: (
            k: string,
            v: string
          ) => {
            maybeSingle: () => Promise<{
              data: { org_id: string; status: string } | null;
            }>;
          };
        };
      }
    )
      .select("org_id, status")
      .eq("id", questPackId)
      .maybeSingle()) as { data: { org_id: string; status: string } | null };
    if (!pack.data || pack.data.status !== "LIVE") return null;

    const events = (await (
      supabase.from("org_events" as never) as unknown as {
        select: (c: string) => {
          eq: (k: string, v: string) => {
            eq: (k: string, v: string) => {
              limit: (n: number) => Promise<{ data: { id: string }[] | null }>;
            };
          };
        };
      }
    )
      .select("id")
      .eq("org_id", pack.data.org_id)
      .eq("status", "LIVE")
      .limit(2)) as { data: { id: string }[] | null };
    return events.data?.length === 1 ? events.data[0].id : null;
  } catch {
    return null;
  }
}

/**
 * 제출 건이 속한 행사 — submission → 미션 → 스탬프북 → 행사.
 *
 * 지급 지점마다 questPackId 를 인자로 끌고 다니는 대신 submissionId 하나로
 * 역추적한다. 미션·협동미션·검수 승인이 전부 이 경로를 공유한다.
 */
export async function eventIdForSubmission(
  supabase: Supa,
  submissionId: string | null | undefined
): Promise<string | null> {
  if (!submissionId) return null;
  try {
    const sub = (await (
      supabase.from("mission_submissions" as never) as unknown as {
        select: (c: string) => {
          eq: (
            k: string,
            v: string
          ) => {
            maybeSingle: () => Promise<{
              data: { org_mission_id: string } | null;
            }>;
          };
        };
      }
    )
      .select("org_mission_id")
      .eq("id", submissionId)
      .maybeSingle()) as { data: { org_mission_id: string } | null };
    const missionId = sub.data?.org_mission_id;
    if (!missionId) return null;

    const mission = (await (
      supabase.from("org_missions" as never) as unknown as {
        select: (c: string) => {
          eq: (
            k: string,
            v: string
          ) => {
            maybeSingle: () => Promise<{
              data: { quest_pack_id: string | null } | null;
            }>;
          };
        };
      }
    )
      .select("quest_pack_id")
      .eq("id", missionId)
      .maybeSingle()) as { data: { quest_pack_id: string | null } | null };

    return eventIdForQuestPack(supabase, mission.data?.quest_pack_id ?? null);
  } catch {
    return null;
  }
}

/** 토리FM 세션이 속한 행사. */
export async function eventIdForFmSession(
  supabase: Supa,
  sessionId: string | null | undefined
): Promise<string | null> {
  if (!sessionId) return null;
  try {
    const resp = (await (
      supabase.from("tori_fm_sessions" as never) as unknown as {
        select: (c: string) => {
          eq: (
            k: string,
            v: string
          ) => {
            maybeSingle: () => Promise<{
              data: { event_id: string | null } | null;
            }>;
          };
        };
      }
    )
      .select("event_id")
      .eq("id", sessionId)
      .maybeSingle()) as { data: { event_id: string | null } | null };
    return resp.data?.event_id ?? null;
  } catch {
    return null;
  }
}
