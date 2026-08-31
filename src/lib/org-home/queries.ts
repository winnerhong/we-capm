// server-only: @/lib/supabase/server 참조 → 클라이언트 번들 금지.
// 기관 포털 홈(`/org/[orgId]`) 대시보드 스냅샷 로더.
//
// 설계 원칙:
//   - 기존 로더 최대 재활용 (control-room snapshot 은 1회만 호출, 결과를 여러 필드가 공유).
//   - 각 서브쿼리는 try/catch 로 실패 격리 — 어느 하나가 터져도 나머지는 정상값 유지.
//   - 새 migration / view 절대 금지. 기존 스키마에서만 집계.

import { createClient } from "@/lib/supabase/server";
import { startOfTodayKstIso } from "@/lib/time/kst";
import { loadOrgEventIds } from "@/lib/org-events/org-event-ids";
import {
  loadControlRoomHomePreview,
  type ControlRoomHomePreview,
} from "@/lib/control-room/queries";
import { loadOrgEvents } from "@/lib/org-events/queries";
import { loadOrgQuestPacks } from "@/lib/missions/queries";
import { loadTrailsAssignedToOrg } from "@/lib/trails/queries";
import { loadOrgProfileSnapshot } from "@/lib/profile-completeness/queries";
import { buildOrgProfileSchema } from "@/lib/profile-completeness/schemas/org";
import { calcCompleteness } from "@/lib/profile-completeness/calculator";
import { loadOrgDocumentsRaw } from "@/lib/org-documents/queries";
import type { ProfileGroupSummary } from "./onboarding";
import {
  loadPartnerDisplayNameForOrg,
  loadPartnerIdForOrg,
} from "@/lib/org-partner";
import type {
  NextActionKind,
  OrgHomeDashboard,
  OrgHomeNextAction,
} from "./types";

type SbResp<T> = { data: T[] | null; error: unknown };
type SbRespOne<T> = { data: T | null; error: unknown };

/* -------------------------------------------------------------------------- */
/* 시간 경계 헬퍼                                                              */
/*   - "오늘 00:00" 같은 절대 기준점은 정확한 KST 자정을 쓴다 (@/lib/time/kst).  */
/*   - "7일 전" 같은 상대 기준은 now - 7d 가 그대로 정확하므로 유지.            */
/* -------------------------------------------------------------------------- */

function sevenDaysAgoIso(): string {
  return new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
}

/* -------------------------------------------------------------------------- */
/* 빈 기본값 (에러 fallback)                                                  */
/* -------------------------------------------------------------------------- */

function emptyDashboard(orgName: string, managerName: string): OrgHomeDashboard {
  return {
    orgName,
    managerName,
    todayStats: {
      participantsTotal: 0,
      participantsAddedToday: 0,
      stampsToday: 0,
      pendingReview: 0,
    },
    profileCompleteness: { percent: 0, done: 0, total: 0, groups: [] },
    eventCount: 0,
    nextAction: null,
    controlRoomPreview: { fmLive: false, todayActive: 0, todayStamps: 0 },
    resources: {
      stampbooks: { total: 0, live: 0, draft: 0 },
      programs: { total: 0, active: 0 },
      trails: 0,
      partnerMissionCatalog: { total: 0, newThisWeek: 0 },
    },
    fm: {
      mode: "NONE",
      sessionName: null,
      scheduledStart: null,
      scheduledEnd: null,
    },
    partnerNew: {
      partnerName: "지사",
      newPresetsThisWeek: 0,
      newMissionsThisWeek: 0,
    },
    documents: { submitted: 0, required: 5, overdue: 5 },
  };
}

/* -------------------------------------------------------------------------- */
/* 메인 로더                                                                  */
/* -------------------------------------------------------------------------- */

export async function loadOrgHomeDashboard(
  orgId: string,
  orgName: string,
  managerId: string
): Promise<OrgHomeDashboard> {
  if (!orgId) return emptyDashboard(orgName, "운영자");

  // 화면 한 장을 그리는 데 필요한 것을 **한 번에** 출발시킨다.
  //
  // 관제실은 **미리보기만** 부른다. 예전엔 스냅샷을 통째로 불렀는데, 스냅샷의
  // 서브로더 16개 중 홈이 꺼내 쓰는 건 다섯 값뿐이었다 — 리더보드·도토리·채팅·
  // 협동·히트맵·사진벽·참가자 명단을 다 조회해 놓고 그대로 버렸다.
  // (관제실 화면은 그대로 스냅샷 전체를 쓴다.)
  //
  // 예전엔 물결이 셋이었다:
  //   ① 관제실 스냅샷 하나만 await  ② 나머지 10개  ③ partner_id 가 나온 뒤 2개
  // ①이 끝나기 전엔 ②가 한 줄도 시작하지 않았다. 계측해 보니 기관 홈 한 장이
  // 질의 79건을 3.7초에 걸쳐 열 겹 넘는 물결로 흘려보내고 있었고, 개별 질의는
  // 20~350ms 라 **기다림이 대부분**이었다.
  //
  // 스냅샷은 아래 어느 것도 필요로 하지 않고, ③은 partner_id 하나만 있으면 된다.
  // 그래서 partner_id 는 프라미스로 두고 .then 으로 이어 붙여 전부 한 물결에 넣는다.
  const partnerIdP = loadPartnerIdForOrg(orgId);

  const [
    snapshot,
    managerName,
    partnerName,
    events,
    profileResult,
    questPacks,
    programResources,
    trails,
    participantsAddedToday,
    documentsInfo,
    catalogCounts,
    presetCounts,
  ] = await Promise.all([
    // 미리보기가 터져도 홈 전체가 빈 화면이 되면 안 된다 — null 로 떨어뜨린다.
    loadControlRoomHomePreview(orgId).catch((e) => {
      console.error("[org-home/loadOrgHomeDashboard] preview throw", e);
      return null;
    }),
    loadManagerName(managerId),
    loadPartnerDisplayNameForOrg(orgId).catch(() => "지사"),
    loadOrgEvents(orgId).catch(() => []),
    loadProfileCompleteness(orgId),
    loadOrgQuestPacks(orgId).catch(() => []),
    loadProgramCounts(orgId),
    loadTrailsAssignedToOrg(orgId).catch(() => []),
    loadParticipantsAddedToday(orgId),
    loadDocumentsInfo(orgId),
    partnerIdP.then((id) => loadPartnerMissionCatalogCounts(id, orgId)),
    partnerIdP.then((id) => loadPartnerPresetCounts(id)),
  ]);

  // 4) stampbook 집계.
  const stampbooks = reduceStampbookCounts(questPacks);

  // 6) FM 요약.
  const fm = buildFmSummary(snapshot);

  // 7) Today stats.
  const pendingReview = snapshot?.pending.total ?? 0;
  const stampsToday = snapshot?.stamps.submissionsToday ?? 0;

  // 8) nextAction 우선순위.
  const nextAction = buildNextAction({
    orgId,
    pendingCount: pendingReview,
    pendingOldestWaitingMinutes: snapshot?.pending.oldestWaitingMinutes ?? null,
    draftEvents: events.filter((e) => e.status === "DRAFT"),
    totalParticipants: snapshot?.totalParticipants ?? 0,
    documentsOverdue: documentsInfo.overdue,
  });

  return {
    orgName,
    managerName,
    todayStats: {
      participantsTotal: snapshot?.totalParticipants ?? 0,
      participantsAddedToday,
      stampsToday,
      pendingReview,
    },
    profileCompleteness: {
      percent: profileResult.percent,
      done: profileResult.done,
      total: profileResult.total,
      groups: profileResult.groups,
    },
    eventCount: events.length,
    nextAction,
    controlRoomPreview: {
      fmLive: snapshot?.fm.session?.isLive === true,
      todayActive: snapshot?.todayActiveParticipants ?? 0,
      todayStamps: stampsToday,
    },
    resources: {
      stampbooks,
      programs: programResources,
      trails: trails.length,
      partnerMissionCatalog: catalogCounts,
    },
    fm,
    partnerNew: {
      partnerName,
      newPresetsThisWeek: presetCounts.newThisWeek,
      newMissionsThisWeek: catalogCounts.newThisWeek,
    },
    documents: documentsInfo,
  };
}

/* -------------------------------------------------------------------------- */
/* managerName — partner_orgs.representative_name                             */
/*   managerId 는 partner_orgs.auto_username (text), uuid 아님.                */
/* -------------------------------------------------------------------------- */

async function loadManagerName(managerId: string): Promise<string> {
  if (!managerId) return "운영자";
  try {
    const supabase = await createClient();
    const resp = (await (
      supabase.from("partner_orgs" as never) as unknown as {
        select: (c: string) => {
          eq: (k: string, v: string) => {
            maybeSingle: () => Promise<
              SbRespOne<{ representative_name: string | null }>
            >;
          };
        };
      }
    )
      .select("representative_name")
      .eq("auto_username", managerId)
      .maybeSingle()) as SbRespOne<{ representative_name: string | null }>;

    if (resp.error) {
      // Supabase 에러는 non-enumerable 이라 그대로 찍으면 {} 로만 보임 → 명시 추출
      const err = resp.error as {
        message?: string;
        code?: string;
        details?: string;
        hint?: string;
      };
      console.error("[org-home/loadManagerName] error", {
        message: err?.message,
        code: err?.code,
        details: err?.details,
        hint: err?.hint,
      });
      return "운영자";
    }
    return resp.data?.representative_name?.trim() || "운영자";
  } catch (e) {
    console.error(
      "[org-home/loadManagerName] throw",
      e instanceof Error ? e.message : e
    );
    return "운영자";
  }
}

/* partner_orgs.partner_id 는 lib/org-partner.ts 가 갖는다.
   여기 같은 함수를 또 두었더니 loadPartnerDisplayNameForOrg 와 나란히 돌면서
   같은 행을 두 번 읽었다. 정의가 둘이면 조회도 둘이 된다. */

/* -------------------------------------------------------------------------- */
/* 프로필 완성도                                                              */
/* -------------------------------------------------------------------------- */

async function loadProfileCompleteness(orgId: string): Promise<{
  percent: number;
  done: number;
  total: number;
  groups: ProfileGroupSummary[];
}> {
  try {
    const snap = await loadOrgProfileSnapshot(orgId);
    const schema = buildOrgProfileSchema(orgId);
    const result = calcCompleteness(schema, snap);
    return {
      percent: result.percent,
      done: result.completedCount,
      total: result.totalCount,
      // 여기서 버리던 것 — 무엇이 남았는지는 이 안에만 있다.
      groups: result.groups,
    };
  } catch (e) {
    console.error("[org-home/loadProfileCompleteness] throw", e);
    return { percent: 0, done: 0, total: 0, groups: [] };
  }
}

/* -------------------------------------------------------------------------- */
/* 스탬프북 상태 카운트                                                        */
/* -------------------------------------------------------------------------- */

function reduceStampbookCounts(
  packs: Array<{ status: string }>
): { total: number; live: number; draft: number } {
  let live = 0;
  let draft = 0;
  for (const p of packs) {
    if (p.status === "LIVE") live += 1;
    else if (p.status === "DRAFT") draft += 1;
  }
  return { total: packs.length, live, draft };
}

/* -------------------------------------------------------------------------- */
/* 프로그램 카운트 — total + (status != ARCHIVED) count                        */
/* -------------------------------------------------------------------------- */

async function loadProgramCounts(
  orgId: string
): Promise<{ total: number; active: number }> {
  try {
    const supabase = await createClient();
    const resp = (await (
      supabase.from("org_programs" as never) as unknown as {
        select: (c: string) => {
          eq: (k: string, v: string) => Promise<SbResp<{ status: string }>>;
        };
      }
    )
      .select("status")
      .eq("org_id", orgId)) as SbResp<{ status: string }>;

    if (resp.error) {
      console.error("[org-home/loadProgramCounts] error", resp.error);
      return { total: 0, active: 0 };
    }
    const rows = resp.data ?? [];
    const active = rows.filter((r) => r.status !== "ARCHIVED").length;
    return { total: rows.length, active };
  } catch (e) {
    console.error("[org-home/loadProgramCounts] throw", e);
    return { total: 0, active: 0 };
  }
}

/* -------------------------------------------------------------------------- */
/* 오늘 가입한 가족 수                                                          */
/*                                                                            */
/*   예전에는 "최근 5명" 목록까지 같이 만들었다. 그 목록을 쓰던 홈 카드를 뺐는데도  */
/*   이름을 붙이려고 app_users·app_children 을 매번 더 읽고 있었다 — 아무도       */
/*   보지 않는 값에 왕복 두 번. 숫자만 남긴다.                                   */
/* -------------------------------------------------------------------------- */

async function loadParticipantsAddedToday(orgId: string): Promise<number> {
  try {
    const supabase = await createClient();

    // 1) org 의 event_id 목록 — 요청당 한 번만 읽힌다.
    const eventIds = await loadOrgEventIds(orgId);
    if (eventIds.length === 0) return 0;

    // 정확한 KST 자정 — 새벽 구간에도 "오늘 가입자" 판정이 정확.
    const todayIso = startOfTodayKstIso();

    // 2) 오늘 가입한 참가자만. 한 사람이 여러 행사에 들어왔을 수 있어
    //    user_id 로 접는다(중복 계산 방지).
    const partResp = (await (
      supabase.from("org_event_participants" as never) as unknown as {
        select: (c: string) => {
          in: (
            k: string,
            v: string[]
          ) => {
            gte: (
              k: string,
              v: string
            ) => Promise<SbResp<{ user_id: string }>>;
          };
        };
      }
    )
      .select("user_id")
      .in("event_id", eventIds)
      .gte("joined_at", todayIso)) as SbResp<{ user_id: string }>;

    if (partResp.error) {
      console.error("[org-home/addedToday] parts error", partResp.error);
      return 0;
    }

    return new Set(
      (partResp.data ?? []).map((r) => r.user_id).filter(Boolean)
    ).size;
  } catch (e) {
    console.error("[org-home/addedToday] throw", e);
    return 0;
  }
}


/* -------------------------------------------------------------------------- */
/* 파트너 미션 카탈로그 카운트 — visibility=ALL OR (SELECTED+assigned to org)  */
/*   둘 다 status='PUBLISHED' 기준. newThisWeek: created_at >= 7일전.           */
/* -------------------------------------------------------------------------- */

async function loadPartnerMissionCatalogCounts(
  partnerId: string | null,
  orgId: string
): Promise<{ total: number; newThisWeek: number }> {
  if (!partnerId) return { total: 0, newThisWeek: 0 };

  try {
    const supabase = await createClient();

    // 1) ALL visibility
    const allResp = (await (
      supabase.from("partner_missions" as never) as unknown as {
        select: (c: string) => {
          eq: (k: string, v: string) => {
            eq: (k: string, v: string) => {
              eq: (
                k: string,
                v: string
              ) => Promise<
                SbResp<{ id: string; created_at: string }>
              >;
            };
          };
        };
      }
    )
      .select("id, created_at")
      .eq("partner_id", partnerId)
      .eq("status", "PUBLISHED")
      .eq("visibility", "ALL")) as SbResp<{
      id: string;
      created_at: string;
    }>;

    if (allResp.error) {
      console.error(
        "[org-home/loadCatalog] all visibility error",
        allResp.error
      );
    }
    const allRows = allResp.data ?? [];

    // 2) SELECTED visibility — 이 org 에 할당된 mission_id
    const assignResp = (await (
      supabase.from("partner_mission_assignments" as never) as unknown as {
        select: (c: string) => {
          eq: (k: string, v: string) => Promise<
            SbResp<{ mission_id: string }>
          >;
        };
      }
    )
      .select("mission_id")
      .eq("org_id", orgId)) as SbResp<{ mission_id: string }>;

    let selectedRows: Array<{ id: string; created_at: string }> = [];
    if (!assignResp.error) {
      const assignedIds = (assignResp.data ?? [])
        .map((r) => r.mission_id)
        .filter(Boolean);
      if (assignedIds.length > 0) {
        const selResp = (await (
          supabase.from("partner_missions" as never) as unknown as {
            select: (c: string) => {
              eq: (k: string, v: string) => {
                eq: (k: string, v: string) => {
                  eq: (k: string, v: string) => {
                    in: (
                      k: string,
                      v: string[]
                    ) => Promise<
                      SbResp<{ id: string; created_at: string }>
                    >;
                  };
                };
              };
            };
          }
        )
          .select("id, created_at")
          .eq("partner_id", partnerId)
          .eq("status", "PUBLISHED")
          .eq("visibility", "SELECTED")
          .in("id", assignedIds)) as SbResp<{
          id: string;
          created_at: string;
        }>;

        if (selResp.error) {
          console.error(
            "[org-home/loadCatalog] selected error",
            selResp.error
          );
        } else {
          selectedRows = selResp.data ?? [];
        }
      }
    } else {
      console.error("[org-home/loadCatalog] assign error", assignResp.error);
    }

    // 3) 머지 + dedupe (id 단위)
    const idMap = new Map<string, string>(); // id → created_at
    for (const r of allRows) idMap.set(r.id, r.created_at);
    for (const r of selectedRows) idMap.set(r.id, r.created_at);

    const sevenDays = sevenDaysAgoIso();
    let newThisWeek = 0;
    for (const createdAt of idMap.values()) {
      if (createdAt && createdAt >= sevenDays) newThisWeek += 1;
    }

    return { total: idMap.size, newThisWeek };
  } catch (e) {
    console.error("[org-home/loadCatalog] throw", e);
    return { total: 0, newThisWeek: 0 };
  }
}

/* -------------------------------------------------------------------------- */
/* 파트너 프리셋 신규 (근사치)                                                 */
/*   정확한 조건: visibility ∈ (ALL_ORGS, SELECTED_ORGS) AND                  */
/*   (visibility=ALL_ORGS OR grants 에 이 org 존재). 구현 복잡도 감안,         */
/*   MVP 는 partner_id + is_published=true + 7일 내 created_at 로 근사.         */
/*   (공개 의도가 있는 프리셋 범주로 약한 상한.)                                */
/* -------------------------------------------------------------------------- */

async function loadPartnerPresetCounts(
  partnerId: string | null
): Promise<{ newThisWeek: number }> {
  if (!partnerId) return { newThisWeek: 0 };
  try {
    const supabase = await createClient();
    const sevenDays = sevenDaysAgoIso();

    const resp = (await (
      supabase.from("partner_stampbook_presets" as never) as unknown as {
        select: (c: string) => {
          eq: (k: string, v: string) => {
            eq: (k: string, v: boolean) => {
              gte: (
                k: string,
                v: string
              ) => Promise<SbResp<{ id: string }>>;
            };
          };
        };
      }
    )
      .select("id")
      .eq("partner_id", partnerId)
      .eq("is_published", true)
      .gte("created_at", sevenDays)) as SbResp<{ id: string }>;

    if (resp.error) {
      console.error("[org-home/loadPresetCounts] error", resp.error);
      return { newThisWeek: 0 };
    }
    return { newThisWeek: (resp.data ?? []).length };
  } catch (e) {
    console.error("[org-home/loadPresetCounts] throw", e);
    return { newThisWeek: 0 };
  }
}

/* -------------------------------------------------------------------------- */
/* 서류 집계                                                                   */
/*   required=5: 기관 프로필 필수 서류 5종 (profile-completeness/schemas/org).  */
/*   submitted: org_documents 에서 status ∈ (APPROVED, PENDING) 인 distinct     */
/*              doc_type 개수 (어떤 상태든 "제출"은 된 상태).                    */
/*   overdue: required - submitted (하한 0).                                   */
/* -------------------------------------------------------------------------- */

async function loadDocumentsInfo(
  orgId: string
): Promise<{ submitted: number; required: number; overdue: number }> {
  const REQUIRED = 5;
  try {
    // 목록은 레이아웃 배지가 이미 요청당 한 번 읽어 뒀다(cache()). 예전엔 여기서
    // 같은 표를 좁은 컬럼으로 한 번 더 물었다 — 한 화면에서 두 왕복이었다.
    // 가공 전 행을 쓰는 이유는 위 로더 주석에 적어 뒀다(만료 자동 계산).
    const rows = await loadOrgDocumentsRaw(orgId);

    const types = new Set<string>();
    for (const row of rows) {
      if (row.status !== "APPROVED" && row.status !== "PENDING") continue;
      if (row.doc_type) types.add(row.doc_type);
    }
    const submitted = types.size;
    const overdue = Math.max(0, REQUIRED - submitted);
    return { submitted, required: REQUIRED, overdue };
  } catch (e) {
    console.error("[org-home/loadDocumentsInfo] throw", e);
    return { submitted: 0, required: REQUIRED, overdue: REQUIRED };
  }
}


/* -------------------------------------------------------------------------- */
/* FM 요약 — snapshot.fm 재사용                                                */
/* -------------------------------------------------------------------------- */

function buildFmSummary(
  snapshot: ControlRoomHomePreview | null
): OrgHomeDashboard["fm"] {
  const session = snapshot?.fm.session ?? null;
  if (!session) {
    return {
      mode: "NONE",
      sessionName: null,
      scheduledStart: null,
      scheduledEnd: null,
    };
  }
  const mode: "LIVE" | "UPCOMING" = session.isLive ? "LIVE" : "UPCOMING";
  return {
    mode,
    sessionName: session.name,
    scheduledStart: session.scheduledStart,
    scheduledEnd: session.scheduledEnd,
  };
}

/* -------------------------------------------------------------------------- */
/* nextAction 우선순위 로직                                                    */
/*   1) PENDING_OLD — 검토 대기 > 0 AND oldest >= 10분                          */
/*   2) DRAFT_EVENT — DRAFT 행사 1건 이상                                       */
/*   3) NO_PARTICIPANTS — 전체 참가자 0                                         */
/*   4) DOCUMENTS — overdue > 0                                                */
/*   5) else null                                                              */
/*                                                                             */
/*   PROFILE(완성도 < 80)은 여기서 뺐다. 온보딩 카드가 같은 말을 더 잘 한다 —   */
/*   이쪽은 "42%" 하고 /settings 로 보내기만 했고, 저쪽은 남은 항목을 각자의    */
/*   주소로 보낸다. 완성도가 100 이 아닌 동안 온보딩 카드는 **항상** 떠 있으니  */
/*   (80 미만은 그 안에 들어간다) 이 분기가 맡던 자리는 비지 않는다.            */
/*   (BROADCAST_READY 는 MVP 에서 생략 — NextActionKind 에만 유지.)             */
/* -------------------------------------------------------------------------- */

function buildNextAction(ctx: {
  orgId: string;
  pendingCount: number;
  pendingOldestWaitingMinutes: number | null;
  draftEvents: Array<{ id: string; name: string }>;
  totalParticipants: number;
  documentsOverdue: number;
}): OrgHomeNextAction | null {
  const base = `/org/${ctx.orgId}`;

  if (
    ctx.pendingCount > 0 &&
    ctx.pendingOldestWaitingMinutes !== null &&
    ctx.pendingOldestWaitingMinutes >= 10
  ) {
    return {
      kind: "PENDING_OLD" as NextActionKind,
      title: `검토 대기 ${ctx.pendingCount}건`,
      description: `가장 오래된 건 ${ctx.pendingOldestWaitingMinutes}분째 기다리는 중`,
      ctaLabel: "검토하기",
      ctaHref: `${base}/missions/review`,
      accent: "amber",
    };
  }

  if (ctx.draftEvents.length > 0) {
    const first = ctx.draftEvents[0];
    return {
      kind: "DRAFT_EVENT" as NextActionKind,
      title: `'${first.name}' 시작 준비 완료`,
      description: "체크리스트를 확인하고 공개해 보세요",
      ctaLabel: "행사 관리",
      ctaHref: `${base}/events/${first.id}`,
      accent: "green",
    };
  }

  if (ctx.totalParticipants === 0) {
    return {
      kind: "NO_PARTICIPANTS" as NextActionKind,
      title: "첫 참가자 초대하기",
      description: "링크만 공유하면 바로 참여할 수 있어요",
      ctaLabel: "참가자 관리",
      ctaHref: `${base}/users`,
      accent: "violet",
    };
  }

  if (ctx.documentsOverdue > 0) {
    return {
      kind: "DOCUMENTS" as NextActionKind,
      title: `제출 안 한 서류 ${ctx.documentsOverdue}건`,
      description: "지사 요구 서류가 남아있어요",
      ctaLabel: "서류함",
      ctaHref: `${base}/documents`,
      accent: "zinc",
    };
  }

  return null;
}
