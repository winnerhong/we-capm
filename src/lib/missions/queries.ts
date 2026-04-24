// server-only: @/lib/supabase/server를 참조하므로 클라이언트 번들에 포함 불가
import { createClient } from "@/lib/supabase/server";
import type {
  PartnerMissionRow,
  OrgQuestPackRow,
  OrgMissionRow,
  MissionSubmissionRow,
  MissionFinalRedemptionRow,
  PartnerMissionAssignmentRow,
  SubmissionStatus,
  MissionTreasureProgressRow,
  MissionRadioQueueRow,
  RadioModerationStatus,
  ToriFmSessionRow,
  MissionCoopSessionRow,
  MissionBroadcastRow,
  MissionContributionRow,
  ContributionStatus,
  PlatformAcornGuidelinesRow,
  OrgDailyAcornCapRow,
  PartnerStampbookPresetRow,
  ViewMissionSubmissionStatsRow,
  ViewPartnerMissionUsageStatsRow,
} from "@/lib/missions/types";

type SbResp<T> = { data: T[] | null; error: unknown };
type SbRespOne<T> = { data: T | null; error: unknown };

const APPROVED_STATUSES: SubmissionStatus[] = ["AUTO_APPROVED", "APPROVED"];

/* -------------------------------------------------------------------------- */
/* Partner missions                                                           */
/* -------------------------------------------------------------------------- */

/**
 * 파트너(지사)의 모든 미션 — updated_at DESC
 */
export async function loadPartnerMissions(
  partnerId: string
): Promise<PartnerMissionRow[]> {
  if (!partnerId) return [];
  const supabase = await createClient();

  const resp = (await (
    supabase.from("partner_missions" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          order: (
            c: string,
            o: { ascending: boolean }
          ) => Promise<SbResp<PartnerMissionRow>>;
        };
      };
    }
  )
    .select("*")
    .eq("partner_id", partnerId)
    .order("updated_at", {
      ascending: false,
    })) as SbResp<PartnerMissionRow>;

  return resp.data ?? [];
}

export async function loadPartnerMissionById(
  id: string
): Promise<PartnerMissionRow | null> {
  if (!id) return null;
  const supabase = await createClient();

  const resp = (await (
    supabase.from("partner_missions" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          maybeSingle: () => Promise<SbRespOne<PartnerMissionRow>>;
        };
      };
    }
  )
    .select("*")
    .eq("id", id)
    .maybeSingle()) as SbRespOne<PartnerMissionRow>;

  return resp.data ?? null;
}

/**
 * 기관(org)이 선택 가능한 미션 풀.
 *  - status = 'PUBLISHED'
 *  - visibility = 'ALL' OR (visibility = 'SELECTED' AND org_id 배정됨)
 */
export async function loadAvailableMissionsForOrg(
  orgId: string
): Promise<PartnerMissionRow[]> {
  if (!orgId) return [];
  const supabase = await createClient();

  // 1) visibility = 'ALL' && status = 'PUBLISHED'
  const allResp = (await (
    supabase.from("partner_missions" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          eq: (k: string, v: string) => {
            order: (
              c: string,
              o: { ascending: boolean }
            ) => Promise<SbResp<PartnerMissionRow>>;
          };
        };
      };
    }
  )
    .select("*")
    .eq("status", "PUBLISHED")
    .eq("visibility", "ALL")
    .order("updated_at", {
      ascending: false,
    })) as SbResp<PartnerMissionRow>;

  // 2) visibility = 'SELECTED' 중 이 org에 assigned 된 mission_id 목록
  const assignResp = (await (
    supabase.from("partner_mission_assignments" as never) as unknown as {
      select: (c: string) => {
        eq: (
          k: string,
          v: string
        ) => Promise<SbResp<PartnerMissionAssignmentRow>>;
      };
    }
  )
    .select("*")
    .eq("org_id", orgId)) as SbResp<PartnerMissionAssignmentRow>;

  const assignedIds = Array.from(
    new Set((assignResp.data ?? []).map((a) => a.mission_id))
  );

  let selectedRows: PartnerMissionRow[] = [];
  if (assignedIds.length > 0) {
    const selResp = (await (
      supabase.from("partner_missions" as never) as unknown as {
        select: (c: string) => {
          eq: (k: string, v: string) => {
            eq: (k: string, v: string) => {
              in: (
                k: string,
                v: string[]
              ) => Promise<SbResp<PartnerMissionRow>>;
            };
          };
        };
      }
    )
      .select("*")
      .eq("status", "PUBLISHED")
      .eq("visibility", "SELECTED")
      .in("id", assignedIds)) as SbResp<PartnerMissionRow>;
    selectedRows = selResp.data ?? [];
  }

  // merge + dedupe, sort updated_at DESC
  const map = new Map<string, PartnerMissionRow>();
  for (const r of allResp.data ?? []) map.set(r.id, r);
  for (const r of selectedRows) map.set(r.id, r);
  const merged = Array.from(map.values());
  merged.sort((a, b) => {
    const at = new Date(a.updated_at).getTime();
    const bt = new Date(b.updated_at).getTime();
    return bt - at;
  });
  return merged;
}

/* -------------------------------------------------------------------------- */
/* Org quest packs                                                            */
/* -------------------------------------------------------------------------- */

export async function loadOrgQuestPacks(
  orgId: string
): Promise<OrgQuestPackRow[]> {
  if (!orgId) return [];
  const supabase = await createClient();

  const resp = (await (
    supabase.from("org_quest_packs" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          order: (
            c: string,
            o: { ascending: boolean }
          ) => Promise<SbResp<OrgQuestPackRow>>;
        };
      };
    }
  )
    .select("*")
    .eq("org_id", orgId)
    .order("updated_at", { ascending: false })) as SbResp<OrgQuestPackRow>;

  return resp.data ?? [];
}

export async function loadOrgQuestPackById(
  id: string
): Promise<OrgQuestPackRow | null> {
  if (!id) return null;
  const supabase = await createClient();

  const resp = (await (
    supabase.from("org_quest_packs" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          maybeSingle: () => Promise<SbRespOne<OrgQuestPackRow>>;
        };
      };
    }
  )
    .select("*")
    .eq("id", id)
    .maybeSingle()) as SbRespOne<OrgQuestPackRow>;

  return resp.data ?? null;
}

/* -------------------------------------------------------------------------- */
/* Org missions (slots inside a quest pack)                                   */
/* -------------------------------------------------------------------------- */

export async function loadOrgMissionsByQuestPack(
  packId: string
): Promise<OrgMissionRow[]> {
  if (!packId) return [];
  const supabase = await createClient();

  const resp = (await (
    supabase.from("org_missions" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          order: (
            c: string,
            o: { ascending: boolean }
          ) => Promise<SbResp<OrgMissionRow>>;
        };
      };
    }
  )
    .select("*")
    .eq("quest_pack_id", packId)
    .order("display_order", { ascending: true })) as SbResp<OrgMissionRow>;

  return resp.data ?? [];
}

/**
 * 특정 org의 특정 kind 미션 중 활성화된 것 하나 로드.
 * 참가자가 /tori-fm에서 바로 RADIO 미션에 신청곡을 보낼 때 사용.
 * is_active=true + quest_pack.status='LIVE' 를 만족하는 미션 중 최신.
 */
export async function loadFirstActiveOrgMissionByKind(
  orgId: string,
  kind: string
): Promise<OrgMissionRow | null> {
  if (!orgId || !kind) return null;
  const supabase = await createClient();

  // 1) LIVE 팩의 id 목록 확보
  const packsResp = (await (
    supabase.from("org_quest_packs" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          eq: (
            k: string,
            v: string
          ) => Promise<SbResp<{ id: string }>>;
        };
      };
    }
  )
    .select("id")
    .eq("org_id", orgId)
    .eq("status", "LIVE")) as SbResp<{ id: string }>;

  const packIds = (packsResp.data ?? []).map((p) => p.id);
  if (packIds.length === 0) return null;

  // 2) 해당 kind + 활성 미션 중 가장 최근
  const resp = (await (
    supabase.from("org_missions" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          eq: (k: string, v: string) => {
            in: (k: string, v: string[]) => {
              order: (
                c: string,
                o: { ascending: boolean }
              ) => {
                limit: (n: number) => Promise<SbResp<OrgMissionRow>>;
              };
            };
          };
        };
      };
    }
  )
    .select("*")
    .eq("kind", kind)
    .eq("is_active", "true" as unknown as string)
    .in("quest_pack_id", packIds)
    .order("updated_at", { ascending: false })
    .limit(1)) as SbResp<OrgMissionRow>;

  return resp.data?.[0] ?? null;
}

export async function loadOrgMissionById(
  id: string
): Promise<OrgMissionRow | null> {
  if (!id) return null;
  const supabase = await createClient();

  const resp = (await (
    supabase.from("org_missions" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          maybeSingle: () => Promise<SbRespOne<OrgMissionRow>>;
        };
      };
    }
  )
    .select("*")
    .eq("id", id)
    .maybeSingle()) as SbRespOne<OrgMissionRow>;

  return resp.data ?? null;
}

/* -------------------------------------------------------------------------- */
/* Submissions                                                                */
/* -------------------------------------------------------------------------- */

export interface LoadUserSubmissionsOpts {
  packId?: string;
  limit?: number;
  status?: SubmissionStatus | SubmissionStatus[];
}

/**
 * 유저의 제출 이력 로드. packId/status/limit 옵션.
 * 기본 order: submitted_at DESC.
 *
 * 주의: mission_submissions 에는 quest_pack_id 가 없으므로
 * packId 필터는 org_missions 를 통해 먼저 mission id 목록을 조회한 뒤 in() 로 적용.
 */
export async function loadUserSubmissions(
  userId: string,
  opts: LoadUserSubmissionsOpts = {}
): Promise<MissionSubmissionRow[]> {
  if (!userId) return [];
  const supabase = await createClient();

  // packId 필터가 있으면 해당 팩의 org_mission id 목록 먼저 확보
  let missionIdsFilter: string[] | null = null;
  if (opts.packId) {
    const packMissionsResp = (await (
      supabase.from("org_missions" as never) as unknown as {
        select: (c: string) => {
          eq: (
            k: string,
            v: string
          ) => Promise<SbResp<{ id: string }>>;
        };
      }
    )
      .select("id")
      .eq("quest_pack_id", opts.packId)) as SbResp<{ id: string }>;

    missionIdsFilter = (packMissionsResp.data ?? []).map((r) => r.id);
    if (missionIdsFilter.length === 0) return [];
  }

  // Builder is dynamic (optional filters) → loose typing via any-equivalent shape
  let query = (
    supabase.from("mission_submissions" as never) as unknown as {
      select: (c: string) => unknown;
    }
  ).select("*") as unknown as {
    eq: (k: string, v: string) => typeof query;
    in: (k: string, v: string[]) => typeof query;
    order: (c: string, o: { ascending: boolean }) => typeof query;
    limit: (n: number) => typeof query;
  };

  query = query.eq("user_id", userId);

  if (missionIdsFilter) {
    query = query.in("org_mission_id", missionIdsFilter);
  }

  if (opts.status) {
    if (Array.isArray(opts.status)) {
      query = query.in("status", opts.status);
    } else {
      query = query.eq("status", opts.status);
    }
  }

  query = query.order("submitted_at", { ascending: false });

  if (opts.limit && opts.limit > 0) {
    query = query.limit(opts.limit);
  }

  const resp = (await (query as unknown as Promise<
    SbResp<MissionSubmissionRow>
  >)) as SbResp<MissionSubmissionRow>;

  return resp.data ?? [];
}

/**
 * 특정 org_mission에 대한 유저의 "가장 최근 non-revoked" 제출 1건.
 */
export async function loadUserSubmissionForMission(
  userId: string,
  orgMissionId: string
): Promise<MissionSubmissionRow | null> {
  if (!userId || !orgMissionId) return null;
  const supabase = await createClient();

  const resp = (await (
    supabase.from("mission_submissions" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          eq: (k: string, v: string) => {
            neq: (k: string, v: string) => {
              order: (
                c: string,
                o: { ascending: boolean }
              ) => {
                limit: (
                  n: number
                ) => Promise<SbResp<MissionSubmissionRow>>;
              };
            };
          };
        };
      };
    }
  )
    .select("*")
    .eq("user_id", userId)
    .eq("org_mission_id", orgMissionId)
    .neq("status", "REVOKED")
    .order("submitted_at", { ascending: false })
    .limit(1)) as SbResp<MissionSubmissionRow>;

  const rows = resp.data ?? [];
  return rows[0] ?? null;
}

/**
 * 승인 완료된(APPROVED/AUTO_APPROVED) 제출 수 — 진척도 막대에 쓰임.
 * packId 주면 해당 팩 내 제출만 카운트.
 */
export async function countApprovedSubmissions(
  userId: string,
  packId?: string
): Promise<number> {
  if (!userId) return 0;
  const rows = await loadUserSubmissions(userId, {
    packId,
    status: APPROVED_STATUSES,
  });
  return rows.length;
}

/**
 * 팩 내 누적 도토리 — APPROVED/AUTO_APPROVED의 awarded_acorns 합.
 * (quest_pack_id가 submissions row에 있으므로 org_missions 조인 불필요.)
 */
export async function sumAcornsForPack(
  userId: string,
  packId: string
): Promise<number> {
  if (!userId || !packId) return 0;
  const rows = await loadUserSubmissions(userId, {
    packId,
    status: APPROVED_STATUSES,
  });
  let sum = 0;
  for (const r of rows) sum += r.awarded_acorns ?? 0;
  return sum;
}

/* -------------------------------------------------------------------------- */
/* Final redemptions                                                          */
/* -------------------------------------------------------------------------- */

export async function loadFinalRedemptions(
  userId: string
): Promise<MissionFinalRedemptionRow[]> {
  if (!userId) return [];
  const supabase = await createClient();

  const resp = (await (
    supabase.from("mission_final_redemptions" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          order: (
            c: string,
            o: { ascending: boolean }
          ) => Promise<SbResp<MissionFinalRedemptionRow>>;
        };
      };
    }
  )
    .select("*")
    .eq("user_id", userId)
    .order("created_at", {
      ascending: false,
    })) as SbResp<MissionFinalRedemptionRow>;

  return resp.data ?? [];
}

/**
 * QR 토큰으로 교환권 조회 — 스태프 스캔 화면에서 사용.
 */
export async function loadFinalRedemptionByToken(
  qrToken: string
): Promise<MissionFinalRedemptionRow | null> {
  if (!qrToken) return null;
  const supabase = await createClient();

  const resp = (await (
    supabase.from("mission_final_redemptions" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          maybeSingle: () => Promise<SbRespOne<MissionFinalRedemptionRow>>;
        };
      };
    }
  )
    .select("*")
    .eq("qr_token", qrToken)
    .maybeSingle()) as SbRespOne<MissionFinalRedemptionRow>;

  return resp.data ?? null;
}

/* -------------------------------------------------------------------------- */
/* Phase 2: Treasure progress                                                 */
/* -------------------------------------------------------------------------- */

/**
 * 특정 유저가 특정 보물찾기 미션에서 언락한 단계 이력 — step_order ASC
 */
export async function loadTreasureProgress(
  userId: string,
  orgMissionId: string
): Promise<MissionTreasureProgressRow[]> {
  if (!userId || !orgMissionId) return [];
  const supabase = await createClient();

  const resp = (await (
    supabase.from("mission_treasure_progress" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          eq: (k: string, v: string) => {
            order: (
              c: string,
              o: { ascending: boolean }
            ) => Promise<SbResp<MissionTreasureProgressRow>>;
          };
        };
      };
    }
  )
    .select("*")
    .eq("user_id", userId)
    .eq("org_mission_id", orgMissionId)
    .order("step_order", {
      ascending: true,
    })) as SbResp<MissionTreasureProgressRow>;

  return resp.data ?? [];
}

/* -------------------------------------------------------------------------- */
/* Phase 2: Radio queue                                                       */
/* -------------------------------------------------------------------------- */

/**
 * 기관 단위 라디오 큐 로드. moderation 필터 옵션.
 * 기본 order: created_at DESC (운영자 리뷰 화면).
 */
export async function loadRadioQueueByOrg(
  orgId: string,
  opts?: { moderation?: RadioModerationStatus | RadioModerationStatus[] }
): Promise<MissionRadioQueueRow[]> {
  if (!orgId) return [];
  const supabase = await createClient();

  // 동적 필터 — builder 타입을 느슨하게 캐스팅
  let query = (
    supabase.from("mission_radio_queue" as never) as unknown as {
      select: (c: string) => unknown;
    }
  ).select("*") as unknown as {
    eq: (k: string, v: string) => typeof query;
    in: (k: string, v: string[]) => typeof query;
    order: (c: string, o: { ascending: boolean }) => typeof query;
  };

  query = query.eq("org_id", orgId);

  if (opts?.moderation) {
    if (Array.isArray(opts.moderation)) {
      query = query.in("moderation", opts.moderation);
    } else {
      query = query.eq("moderation", opts.moderation);
    }
  }

  query = query.order("created_at", { ascending: false });

  const resp = (await (query as unknown as Promise<
    SbResp<MissionRadioQueueRow>
  >)) as SbResp<MissionRadioQueueRow>;

  return resp.data ?? [];
}

/**
 * 모더레이션 큐 화면용 enrichment.
 * queue row + 연결된 submission payload + 제출자 부모 이름을 한 번에 로드.
 * 기본 order: created_at DESC.
 */
export async function loadRadioQueueDetailed(
  orgId: string,
  moderation?: RadioModerationStatus | RadioModerationStatus[]
): Promise<
  Array<
    MissionRadioQueueRow & {
      submission_payload: Record<string, unknown>;
      submission_submitted_at: string;
      user_parent_name: string;
    }
  >
> {
  if (!orgId) return [];
  const queue = await loadRadioQueueByOrg(orgId, { moderation });
  if (queue.length === 0) return [];

  const supabase = await createClient();

  const subIds = Array.from(new Set(queue.map((q) => q.submission_id)));
  const subResp = (await (
    supabase.from("mission_submissions" as never) as unknown as {
      select: (c: string) => {
        in: (
          k: string,
          v: string[]
        ) => Promise<SbResp<MissionSubmissionRow>>;
      };
    }
  )
    .select("*")
    .in("id", subIds)) as SbResp<MissionSubmissionRow>;

  const submissions = subResp.data ?? [];
  const subMap = new Map<string, MissionSubmissionRow>();
  for (const s of submissions) subMap.set(s.id, s);

  const userIds = Array.from(new Set(submissions.map((s) => s.user_id)));
  let nameMap = new Map<string, string>();
  if (userIds.length > 0) {
    const usersResp = (await (
      supabase.from("app_user" as never) as unknown as {
        select: (c: string) => {
          in: (
            k: string,
            v: string[]
          ) => Promise<SbResp<{ id: string; parent_name: string }>>;
        };
      }
    )
      .select("id, parent_name")
      .in("id", userIds)) as SbResp<{ id: string; parent_name: string }>;

    nameMap = new Map<string, string>();
    for (const u of usersResp.data ?? []) nameMap.set(u.id, u.parent_name);
  }

  return queue.map((q) => {
    const sub = subMap.get(q.submission_id);
    return {
      ...q,
      submission_payload: (sub?.payload_json ?? {}) as Record<string, unknown>,
      submission_submitted_at: sub?.submitted_at ?? q.created_at,
      user_parent_name: sub ? (nameMap.get(sub.user_id) ?? "") : "",
    };
  });
}

/**
 * 특정 FM 세션에 편성된 라디오 큐 — position ASC, created_at ASC
 */
export async function loadRadioQueueBySession(
  sessionId: string
): Promise<MissionRadioQueueRow[]> {
  if (!sessionId) return [];
  const supabase = await createClient();

  const resp = (await (
    supabase.from("mission_radio_queue" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          order: (
            c: string,
            o: { ascending: boolean }
          ) => {
            order: (
              c: string,
              o: { ascending: boolean }
            ) => Promise<SbResp<MissionRadioQueueRow>>;
          };
        };
      };
    }
  )
    .select("*")
    .eq("fm_session_id", sessionId)
    .order("position", { ascending: true })
    .order("created_at", {
      ascending: true,
    })) as SbResp<MissionRadioQueueRow>;

  return resp.data ?? [];
}

/**
 * 라디오 큐 단건 + 연결된 submission + 제출자 부모 이름(마스킹 용도).
 * 방송 상세 화면/모더레이션 화면에서 사용.
 */
export async function loadRadioQueueItemWithSubmission(
  queueId: string
): Promise<{
  queue: MissionRadioQueueRow;
  submission: MissionSubmissionRow;
  user: { id: string; parent_name: string } | null;
} | null> {
  if (!queueId) return null;
  const supabase = await createClient();

  const queueResp = (await (
    supabase.from("mission_radio_queue" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          maybeSingle: () => Promise<SbRespOne<MissionRadioQueueRow>>;
        };
      };
    }
  )
    .select("*")
    .eq("id", queueId)
    .maybeSingle()) as SbRespOne<MissionRadioQueueRow>;

  const queue = queueResp.data;
  if (!queue) return null;

  const subResp = (await (
    supabase.from("mission_submissions" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          maybeSingle: () => Promise<SbRespOne<MissionSubmissionRow>>;
        };
      };
    }
  )
    .select("*")
    .eq("id", queue.submission_id)
    .maybeSingle()) as SbRespOne<MissionSubmissionRow>;

  const submission = subResp.data;
  if (!submission) return null;

  const userResp = (await (
    supabase.from("app_user" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          maybeSingle: () => Promise<
            SbRespOne<{ id: string; parent_name: string }>
          >;
        };
      };
    }
  )
    .select("id, parent_name")
    .eq("id", submission.user_id)
    .maybeSingle()) as SbRespOne<{ id: string; parent_name: string }>;

  return {
    queue,
    submission,
    user: userResp.data ?? null,
  };
}

/* -------------------------------------------------------------------------- */
/* Phase 2: 토리FM sessions                                                    */
/* -------------------------------------------------------------------------- */

/**
 * 기관에서 현재 LIVE 중인 FM 세션 — 여러 개면 가장 최근 started_at 1건.
 */
export async function loadLiveFmSessionForOrg(
  orgId: string
): Promise<ToriFmSessionRow | null> {
  if (!orgId) return null;
  const supabase = await createClient();

  const resp = (await (
    supabase.from("tori_fm_sessions" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          eq: (k: string, v: boolean) => {
            order: (
              c: string,
              o: { ascending: boolean; nullsFirst?: boolean }
            ) => {
              limit: (n: number) => Promise<SbResp<ToriFmSessionRow>>;
            };
          };
        };
      };
    }
  )
    .select("*")
    .eq("org_id", orgId)
    .eq("is_live", true)
    .order("started_at", { ascending: false, nullsFirst: false })
    .limit(1)) as SbResp<ToriFmSessionRow>;

  const rows = resp.data ?? [];
  return rows[0] ?? null;
}

/**
 * 기관의 모든 FM 세션 — scheduled_start DESC
 */
export async function loadFmSessionsByOrg(
  orgId: string
): Promise<ToriFmSessionRow[]> {
  if (!orgId) return [];
  const supabase = await createClient();

  const resp = (await (
    supabase.from("tori_fm_sessions" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          order: (
            c: string,
            o: { ascending: boolean }
          ) => Promise<SbResp<ToriFmSessionRow>>;
        };
      };
    }
  )
    .select("*")
    .eq("org_id", orgId)
    .order("scheduled_start", {
      ascending: false,
    })) as SbResp<ToriFmSessionRow>;

  return resp.data ?? [];
}

export async function loadFmSessionById(
  id: string
): Promise<ToriFmSessionRow | null> {
  if (!id) return null;
  const supabase = await createClient();

  const resp = (await (
    supabase.from("tori_fm_sessions" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          maybeSingle: () => Promise<SbRespOne<ToriFmSessionRow>>;
        };
      };
    }
  )
    .select("*")
    .eq("id", id)
    .maybeSingle()) as SbRespOne<ToriFmSessionRow>;

  return resp.data ?? null;
}

/* -------------------------------------------------------------------------- */
/* Phase 2: 승인 대기 큐 (PHOTO_APPROVAL 등)                                   */
/* -------------------------------------------------------------------------- */

/**
 * 기관 내 PENDING_REVIEW 제출 목록.
 * mission title + 제출자 부모 이름 enrichment 포함.
 *  1) org_missions 중 org_id 일치 목록 확보
 *  2) mission_submissions 중 status=PENDING_REVIEW AND org_mission_id in (...) 조회
 *  3) title/parent_name lookup 맵 만들어 합치기
 */
export async function loadPendingApprovalsForOrg(
  orgId: string
): Promise<
  Array<
    MissionSubmissionRow & {
      org_mission_title: string;
      user_parent_name: string;
    }
  >
> {
  if (!orgId) return [];
  const supabase = await createClient();

  const missionsResp = (await (
    supabase.from("org_missions" as never) as unknown as {
      select: (c: string) => {
        eq: (
          k: string,
          v: string
        ) => Promise<SbResp<{ id: string; title: string }>>;
      };
    }
  )
    .select("id, title")
    .eq("org_id", orgId)) as SbResp<{ id: string; title: string }>;

  const missions = missionsResp.data ?? [];
  if (missions.length === 0) return [];

  const missionIds = missions.map((m) => m.id);
  const titleMap = new Map<string, string>();
  for (const m of missions) titleMap.set(m.id, m.title);

  const subResp = (await (
    supabase.from("mission_submissions" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          in: (k: string, v: string[]) => {
            order: (
              c: string,
              o: { ascending: boolean }
            ) => Promise<SbResp<MissionSubmissionRow>>;
          };
        };
      };
    }
  )
    .select("*")
    .eq("status", "PENDING_REVIEW")
    .in("org_mission_id", missionIds)
    .order("submitted_at", {
      ascending: true,
    })) as SbResp<MissionSubmissionRow>;

  const submissions = subResp.data ?? [];
  if (submissions.length === 0) return [];

  // 제출자 이름 lookup — 중복 user_id 제거
  const userIds = Array.from(new Set(submissions.map((s) => s.user_id)));
  const usersResp = (await (
    supabase.from("app_user" as never) as unknown as {
      select: (c: string) => {
        in: (
          k: string,
          v: string[]
        ) => Promise<SbResp<{ id: string; parent_name: string }>>;
      };
    }
  )
    .select("id, parent_name")
    .in("id", userIds)) as SbResp<{ id: string; parent_name: string }>;

  const nameMap = new Map<string, string>();
  for (const u of usersResp.data ?? []) nameMap.set(u.id, u.parent_name);

  return submissions.map((s) => ({
    ...s,
    org_mission_title: titleMap.get(s.org_mission_id) ?? "(삭제된 미션)",
    user_parent_name: nameMap.get(s.user_id) ?? "",
  }));
}

/* -------------------------------------------------------------------------- */
/* Phase 3: Coop sessions                                                     */
/* -------------------------------------------------------------------------- */

/**
 * pair_code 로 coop 세션 1건 조회 — 짝꿍이 코드 입력 시 사용.
 */
export async function loadCoopSessionByPairCode(
  code: string
): Promise<MissionCoopSessionRow | null> {
  if (!code) return null;
  const supabase = await createClient();

  const resp = (await (
    supabase.from("mission_coop_sessions" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          maybeSingle: () => Promise<SbRespOne<MissionCoopSessionRow>>;
        };
      };
    }
  )
    .select("*")
    .eq("pair_code", code)
    .maybeSingle()) as SbRespOne<MissionCoopSessionRow>;

  return resp.data ?? null;
}

/**
 * id 로 coop 세션 1건 조회.
 */
export async function loadCoopSessionById(
  id: string
): Promise<MissionCoopSessionRow | null> {
  if (!id) return null;
  const supabase = await createClient();

  const resp = (await (
    supabase.from("mission_coop_sessions" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          maybeSingle: () => Promise<SbRespOne<MissionCoopSessionRow>>;
        };
      };
    }
  )
    .select("*")
    .eq("id", id)
    .maybeSingle()) as SbRespOne<MissionCoopSessionRow>;

  return resp.data ?? null;
}

/**
 * 특정 유저가 특정 org_mission에서 현재 진행 중인 coop 세션 1건.
 * state IN ('WAITING','PAIRED','A_DONE','B_DONE'), created_at DESC LIMIT 1.
 * initiator 또는 partner 어느 쪽이든 포함.
 */
export async function loadActiveCoopSessionForUser(
  userId: string,
  orgMissionId: string
): Promise<MissionCoopSessionRow | null> {
  if (!userId || !orgMissionId) return null;
  const supabase = await createClient();

  const activeStates = ["WAITING", "PAIRED", "A_DONE", "B_DONE"];

  const resp = (await (
    supabase.from("mission_coop_sessions" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          or: (expr: string) => {
            in: (k: string, v: string[]) => {
              order: (
                c: string,
                o: { ascending: boolean }
              ) => {
                limit: (
                  n: number
                ) => Promise<SbResp<MissionCoopSessionRow>>;
              };
            };
          };
        };
      };
    }
  )
    .select("*")
    .eq("org_mission_id", orgMissionId)
    .or(`initiator_user_id.eq.${userId},partner_user_id.eq.${userId}`)
    .in("state", activeStates)
    .order("created_at", { ascending: false })
    .limit(1)) as SbResp<MissionCoopSessionRow>;

  const rows = resp.data ?? [];
  return rows[0] ?? null;
}

/* -------------------------------------------------------------------------- */
/* Phase 3: Broadcasts                                                        */
/* -------------------------------------------------------------------------- */

/**
 * 기관 기준 현재 LIVE 상태인 돌발 미션 — cancelled_at IS NULL AND expires_at > now().
 * fires_at DESC.
 */
export async function loadLiveBroadcastsForOrg(
  orgId: string
): Promise<MissionBroadcastRow[]> {
  if (!orgId) return [];
  const supabase = await createClient();

  const nowIso = new Date().toISOString();

  const resp = (await (
    supabase.from("mission_broadcasts" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          is: (k: string, v: null) => {
            gt: (k: string, v: string) => {
              order: (
                c: string,
                o: { ascending: boolean }
              ) => Promise<SbResp<MissionBroadcastRow>>;
            };
          };
        };
      };
    }
  )
    .select("*")
    .eq("triggered_by_org_id", orgId)
    .is("cancelled_at", null)
    .gt("expires_at", nowIso)
    .order("fires_at", {
      ascending: false,
    })) as SbResp<MissionBroadcastRow>;

  return resp.data ?? [];
}

/**
 * 기관의 최근 돌발 미션 전체 이력 — cancelled/expired 포함.
 * fires_at DESC, default limit 20.
 */
export async function loadRecentBroadcastsForOrg(
  orgId: string,
  limit: number = 20
): Promise<MissionBroadcastRow[]> {
  if (!orgId) return [];
  const supabase = await createClient();

  const resp = (await (
    supabase.from("mission_broadcasts" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          order: (
            c: string,
            o: { ascending: boolean }
          ) => {
            limit: (n: number) => Promise<SbResp<MissionBroadcastRow>>;
          };
        };
      };
    }
  )
    .select("*")
    .eq("triggered_by_org_id", orgId)
    .order("fires_at", { ascending: false })
    .limit(limit)) as SbResp<MissionBroadcastRow>;

  return resp.data ?? [];
}

/**
 * 돌발 미션별 참여자 수 집계.
 * mission_submissions.payload_json->>broadcast_id 로 매핑된 제출만 카운트.
 * broadcastIds 가 빈 배열이면 빈 Map 반환.
 */
export async function loadBroadcastParticipationCounts(
  broadcastIds: string[]
): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  if (broadcastIds.length === 0) return result;

  const supabase = await createClient();

  // payload_json->>broadcast_id IN (...) 쿼리. Supabase JS 에서 JSON accessor 는
  // 각 id 마다 개별 쿼리를 돌리는 게 타입 안전. 병렬로.
  const perBroadcast = await Promise.all(
    broadcastIds.map(async (bid) => {
      const resp = (await (
        supabase.from("mission_submissions" as never) as unknown as {
          select: (
            c: string,
            opt?: { count?: "exact"; head?: boolean }
          ) => {
            eq: (
              k: string,
              v: string
            ) => Promise<{ count: number | null }>;
          };
        }
      )
        .select("id", { count: "exact", head: true })
        .eq("payload_json->>broadcast_id", bid)) as { count: number | null };
      return [bid, resp.count ?? 0] as const;
    })
  );

  for (const [bid, cnt] of perBroadcast) {
    result.set(bid, cnt);
  }
  return result;
}

export async function loadBroadcastById(
  id: string
): Promise<MissionBroadcastRow | null> {
  if (!id) return null;
  const supabase = await createClient();

  const resp = (await (
    supabase.from("mission_broadcasts" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          maybeSingle: () => Promise<SbRespOne<MissionBroadcastRow>>;
        };
      };
    }
  )
    .select("*")
    .eq("id", id)
    .maybeSingle()) as SbRespOne<MissionBroadcastRow>;

  return resp.data ?? null;
}

/* -------------------------------------------------------------------------- */
/* Phase 4: Contributions                                                     */
/* -------------------------------------------------------------------------- */

/**
 * 지사(partner)가 받은 역반영 제안 목록.
 * 2-step: partner_missions ids 확보 → mission_contributions.in()
 * opts.status 지정 시 필터링.
 */
export async function loadContributionsByPartner(
  partnerId: string,
  opts?: { status?: ContributionStatus }
): Promise<MissionContributionRow[]> {
  if (!partnerId) return [];
  const supabase = await createClient();

  const pmResp = (await (
    supabase.from("partner_missions" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => Promise<SbResp<{ id: string }>>;
      };
    }
  )
    .select("id")
    .eq("partner_id", partnerId)) as SbResp<{ id: string }>;

  const missionIds = (pmResp.data ?? []).map((r) => r.id);
  if (missionIds.length === 0) return [];

  let query = (
    supabase.from("mission_contributions" as never) as unknown as {
      select: (c: string) => unknown;
    }
  ).select("*") as unknown as {
    in: (k: string, v: string[]) => typeof query;
    eq: (k: string, v: string) => typeof query;
    order: (c: string, o: { ascending: boolean }) => typeof query;
  };

  query = query.in("target_partner_mission_id", missionIds);

  if (opts?.status) {
    query = query.eq("status", opts.status);
  }

  query = query.order("created_at", { ascending: false });

  const resp = (await (query as unknown as Promise<
    SbResp<MissionContributionRow>
  >)) as SbResp<MissionContributionRow>;

  return resp.data ?? [];
}

/**
 * 기관(org)이 제안한 역반영 목록.
 */
export async function loadContributionsByOrg(
  orgId: string
): Promise<MissionContributionRow[]> {
  if (!orgId) return [];
  const supabase = await createClient();

  const resp = (await (
    supabase.from("mission_contributions" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          order: (
            c: string,
            o: { ascending: boolean }
          ) => Promise<SbResp<MissionContributionRow>>;
        };
      };
    }
  )
    .select("*")
    .eq("proposed_by_org_id", orgId)
    .order("created_at", {
      ascending: false,
    })) as SbResp<MissionContributionRow>;

  return resp.data ?? [];
}

export async function loadContributionById(
  id: string
): Promise<MissionContributionRow | null> {
  if (!id) return null;
  const supabase = await createClient();

  const resp = (await (
    supabase.from("mission_contributions" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          maybeSingle: () => Promise<SbRespOne<MissionContributionRow>>;
        };
      };
    }
  )
    .select("*")
    .eq("id", id)
    .maybeSingle()) as SbRespOne<MissionContributionRow>;

  return resp.data ?? null;
}

/**
 * 지사 nav 배지용: 검토 대기(PROPOSED) 개수.
 */
export async function countPendingContributionsForPartner(
  partnerId: string
): Promise<number> {
  if (!partnerId) return 0;
  const rows = await loadContributionsByPartner(partnerId, {
    status: "PROPOSED",
  });
  return rows.length;
}

/* -------------------------------------------------------------------------- */
/* Phase 4: Acorn policy                                                      */
/* -------------------------------------------------------------------------- */

/**
 * 플랫폼 전역 도토리 정책 (싱글톤 id=1).
 */
export async function loadPlatformAcornGuidelines(): Promise<PlatformAcornGuidelinesRow | null> {
  const supabase = await createClient();

  const resp = (await (
    supabase.from("platform_acorn_guidelines" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: number) => {
          maybeSingle: () => Promise<SbRespOne<PlatformAcornGuidelinesRow>>;
        };
      };
    }
  )
    .select("*")
    .eq("id", 1)
    .maybeSingle()) as SbRespOne<PlatformAcornGuidelinesRow>;

  return resp.data ?? null;
}

/**
 * 기관별 일일 상한 1건.
 */
export async function loadOrgDailyAcornCap(
  orgId: string
): Promise<OrgDailyAcornCapRow | null> {
  if (!orgId) return null;
  const supabase = await createClient();

  const resp = (await (
    supabase.from("org_daily_acorn_caps" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          maybeSingle: () => Promise<SbRespOne<OrgDailyAcornCapRow>>;
        };
      };
    }
  )
    .select("*")
    .eq("org_id", orgId)
    .maybeSingle()) as SbRespOne<OrgDailyAcornCapRow>;

  return resp.data ?? null;
}

/**
 * 오늘(로컬 00:00부터) 유저가 받은 도토리 합계 (amount > 0).
 * daily_cap enforcement 용도.
 * orgId 는 컨텍스트 제한 예약 파라미터(현재 테이블에 org_id 컬럼 없어 미사용).
 */
export async function sumUserAcornsToday(
  userId: string,
  orgId: string
): Promise<number> {
  if (!userId || !orgId) return 0;
  const supabase = await createClient();

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const startIso = startOfDay.toISOString();

  const resp = (await (
    supabase.from("user_acorn_transactions" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          gt: (k: string, v: number) => {
            gte: (
              k: string,
              v: string
            ) => Promise<SbResp<{ amount: number }>>;
          };
        };
      };
    }
  )
    .select("amount")
    .eq("user_id", userId)
    .gt("amount", 0)
    .gte("created_at", startIso)) as SbResp<{ amount: number }>;

  let sum = 0;
  for (const r of resp.data ?? []) sum += r.amount ?? 0;
  return sum;
}

/* -------------------------------------------------------------------------- */
/* Phase 4: Stampbook presets                                                 */
/* -------------------------------------------------------------------------- */

/**
 * 지사의 스탬프북 프리셋 전체 — updated_at DESC.
 * opts.publishedOnly 시 is_published=true 만.
 */
export async function loadStampbookPresetsByPartner(
  partnerId: string,
  opts?: { publishedOnly?: boolean }
): Promise<PartnerStampbookPresetRow[]> {
  if (!partnerId) return [];
  const supabase = await createClient();

  let query = (
    supabase.from("partner_stampbook_presets" as never) as unknown as {
      select: (c: string) => unknown;
    }
  ).select("*") as unknown as {
    eq: (k: string, v: string | boolean) => typeof query;
    order: (c: string, o: { ascending: boolean }) => typeof query;
  };

  query = query.eq("partner_id", partnerId);

  if (opts?.publishedOnly) {
    query = query.eq("is_published", true);
  }

  query = query.order("updated_at", { ascending: false });

  const resp = (await (query as unknown as Promise<
    SbResp<PartnerStampbookPresetRow>
  >)) as SbResp<PartnerStampbookPresetRow>;

  return resp.data ?? [];
}

/**
 * 기관 카탈로그용: 게시된(is_published=true) 프리셋 전체.
 * partnerIds 주면 해당 지사로 한정.
 */
export async function loadPublishedStampbookPresets(
  partnerIds?: string[]
): Promise<PartnerStampbookPresetRow[]> {
  const supabase = await createClient();

  let query = (
    supabase.from("partner_stampbook_presets" as never) as unknown as {
      select: (c: string) => unknown;
    }
  ).select("*") as unknown as {
    eq: (k: string, v: boolean) => typeof query;
    in: (k: string, v: string[]) => typeof query;
    order: (c: string, o: { ascending: boolean }) => typeof query;
  };

  query = query.eq("is_published", true);

  if (partnerIds && partnerIds.length > 0) {
    query = query.in("partner_id", partnerIds);
  }

  query = query.order("updated_at", { ascending: false });

  const resp = (await (query as unknown as Promise<
    SbResp<PartnerStampbookPresetRow>
  >)) as SbResp<PartnerStampbookPresetRow>;

  return resp.data ?? [];
}

/**
 * 특정 프리셋에 grant 된 기관 ID 목록.
 * (지사가 편집 화면에서 체크박스 기본값을 구성할 때 사용)
 */
export async function loadPresetGrantedOrgIds(
  presetId: string
): Promise<string[]> {
  if (!presetId) return [];
  const supabase = await createClient();

  const resp = (await (
    supabase.from(
      "partner_stampbook_preset_org_grants" as never
    ) as unknown as {
      select: (c: string) => {
        eq: (
          k: string,
          v: string
        ) => Promise<SbResp<{ org_id: string }>>;
      };
    }
  )
    .select("org_id")
    .eq("preset_id", presetId)) as SbResp<{ org_id: string }>;

  return (resp.data ?? []).map((r) => r.org_id);
}

/**
 * 기관이 접근 가능한 프리셋 목록.
 * 조건:
 *   - preset.partner_id = {기관이 속한 partner}
 *   - is_published = true
 *   - visibility = 'ALL_ORGS' OR (visibility = 'SELECTED_ORGS' AND grant 존재)
 *
 * orgId 로 org 의 partner_id 를 먼저 조회한 뒤 프리셋을 가져옵니다.
 */
export async function loadAccessiblePresetsForOrg(
  orgId: string
): Promise<PartnerStampbookPresetRow[]> {
  if (!orgId) return [];
  const supabase = await createClient();

  // 1) org 의 partner_id
  const orgResp = (await (
    supabase.from("partner_orgs" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          maybeSingle: () => Promise<
            SbRespOne<{ partner_id: string }>
          >;
        };
      };
    }
  )
    .select("partner_id")
    .eq("id", orgId)
    .maybeSingle()) as SbRespOne<{ partner_id: string }>;

  const partnerId = orgResp.data?.partner_id;
  if (!partnerId) return [];

  // 2) 해당 partner 의 published + visibility != PRIVATE 프리셋
  const presetsResp = (await (
    supabase.from("partner_stampbook_presets" as never) as unknown as {
      select: (c: string) => {
        eq: (
          k: string,
          v: string | boolean
        ) => {
          eq: (
            k: string,
            v: boolean
          ) => {
            neq: (
              k: string,
              v: string
            ) => {
              order: (
                c: string,
                o: { ascending: boolean }
              ) => Promise<SbResp<PartnerStampbookPresetRow>>;
            };
          };
        };
      };
    }
  )
    .select("*")
    .eq("partner_id", partnerId)
    .eq("is_published", true)
    .neq("visibility", "PRIVATE")
    .order("updated_at", {
      ascending: false,
    })) as SbResp<PartnerStampbookPresetRow>;

  const allPublic = presetsResp.data ?? [];
  if (allPublic.length === 0) return [];

  // 3) SELECTED_ORGS 프리셋은 grants 체크
  const selectedPresetIds = allPublic
    .filter((p) => p.visibility === "SELECTED_ORGS")
    .map((p) => p.id);

  let grantedPresetIds = new Set<string>();
  if (selectedPresetIds.length > 0) {
    const grantsResp = (await (
      supabase.from(
        "partner_stampbook_preset_org_grants" as never
      ) as unknown as {
        select: (c: string) => {
          eq: (
            k: string,
            v: string
          ) => {
            in: (
              k: string,
              v: string[]
            ) => Promise<SbResp<{ preset_id: string }>>;
          };
        };
      }
    )
      .select("preset_id")
      .eq("org_id", orgId)
      .in("preset_id", selectedPresetIds)) as SbResp<{ preset_id: string }>;

    grantedPresetIds = new Set(
      (grantsResp.data ?? []).map((r) => r.preset_id)
    );
  }

  // 4) 필터링
  return allPublic.filter((p) => {
    if (p.visibility === "ALL_ORGS") return true;
    if (p.visibility === "SELECTED_ORGS") return grantedPresetIds.has(p.id);
    return false;
  });
}

/**
 * 프리셋 하나가 특정 org 에 접근 가능한지 검증 — 복제 서버액션 권한 체크용.
 * 반환: { ok: boolean; reason?: string }
 */
export async function checkPresetAccessibleByOrg(
  presetId: string,
  orgId: string
): Promise<{ ok: boolean; reason?: string }> {
  if (!presetId || !orgId) return { ok: false, reason: "invalid args" };

  const [preset, org] = await Promise.all([
    loadStampbookPresetById(presetId),
    (async () => {
      const supabase = await createClient();
      const resp = (await (
        supabase.from("partner_orgs" as never) as unknown as {
          select: (c: string) => {
            eq: (k: string, v: string) => {
              maybeSingle: () => Promise<
                SbRespOne<{ partner_id: string }>
              >;
            };
          };
        }
      )
        .select("partner_id")
        .eq("id", orgId)
        .maybeSingle()) as SbRespOne<{ partner_id: string }>;
      return resp.data ?? null;
    })(),
  ]);

  if (!preset) return { ok: false, reason: "프리셋을 찾을 수 없어요" };
  if (!org) return { ok: false, reason: "기관 정보를 찾을 수 없어요" };
  if (preset.partner_id !== org.partner_id) {
    return { ok: false, reason: "다른 지사의 프리셋은 사용할 수 없어요" };
  }
  if (!preset.is_published) {
    return { ok: false, reason: "아직 공개되지 않은 프리셋이에요" };
  }
  if (preset.visibility === "PRIVATE") {
    return { ok: false, reason: "이 프리셋은 비공개 상태예요" };
  }
  if (preset.visibility === "ALL_ORGS") return { ok: true };

  // SELECTED_ORGS: grant 확인
  const supabase = await createClient();
  const grantResp = (await (
    supabase.from(
      "partner_stampbook_preset_org_grants" as never
    ) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          eq: (k: string, v: string) => {
            maybeSingle: () => Promise<
              SbRespOne<{ preset_id: string }>
            >;
          };
        };
      };
    }
  )
    .select("preset_id")
    .eq("preset_id", presetId)
    .eq("org_id", orgId)
    .maybeSingle()) as SbRespOne<{ preset_id: string }>;

  if (!grantResp.data) {
    return { ok: false, reason: "이 기관에는 공유되지 않은 프리셋이에요" };
  }
  return { ok: true };
}

export async function loadStampbookPresetById(
  id: string
): Promise<PartnerStampbookPresetRow | null> {
  if (!id) return null;
  const supabase = await createClient();

  const resp = (await (
    supabase.from("partner_stampbook_presets" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          maybeSingle: () => Promise<SbRespOne<PartnerStampbookPresetRow>>;
        };
      };
    }
  )
    .select("*")
    .eq("id", id)
    .maybeSingle()) as SbRespOne<PartnerStampbookPresetRow>;

  return resp.data ?? null;
}

/* -------------------------------------------------------------------------- */
/* Phase 4: Stats views                                                       */
/* -------------------------------------------------------------------------- */

/**
 * 기관 미션별 제출 통계 (view_mission_submission_stats).
 */
export async function loadSubmissionStatsByOrg(
  orgId: string
): Promise<ViewMissionSubmissionStatsRow[]> {
  if (!orgId) return [];
  const supabase = await createClient();

  const resp = (await (
    supabase.from("view_mission_submission_stats" as never) as unknown as {
      select: (c: string) => {
        eq: (
          k: string,
          v: string
        ) => Promise<SbResp<ViewMissionSubmissionStatsRow>>;
      };
    }
  )
    .select("*")
    .eq(
      "org_id",
      orgId
    )) as SbResp<ViewMissionSubmissionStatsRow>;

  return resp.data ?? [];
}

/**
 * 지사 미션별 사용 통계 (view_partner_mission_usage_stats).
 */
export async function loadPartnerMissionUsageStats(
  partnerId: string
): Promise<ViewPartnerMissionUsageStatsRow[]> {
  if (!partnerId) return [];
  const supabase = await createClient();

  const resp = (await (
    supabase.from("view_partner_mission_usage_stats" as never) as unknown as {
      select: (c: string) => {
        eq: (
          k: string,
          v: string
        ) => Promise<SbResp<ViewPartnerMissionUsageStatsRow>>;
      };
    }
  )
    .select("*")
    .eq(
      "partner_id",
      partnerId
    )) as SbResp<ViewPartnerMissionUsageStatsRow>;

  return resp.data ?? [];
}
