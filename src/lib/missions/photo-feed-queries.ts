// server-only: 참가자용 사진 피드 조회.
//
// 관제실의 loadPhotoWall(control-room/queries.ts)과 비슷한 일을 하지만 그쪽을
// 고쳐 쓰지 않는다. 관제실은 **검토 대기까지 전부** 봐야 하고 여기는 **확인이
// 끝난 것만** 봐야 한다. 한 함수에 두 정책을 넣으면 조건이 엇갈렸을 때 검토 중인
// 사진이 참가자 화면으로 새 나간다 — 되돌릴 수 없는 종류의 사고다.
//
// 실패 정책: throw 하지 않고 빈 배열 (missions/queries.ts 와 동일).

import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { loadLiveQuestPacksForEvent } from "@/lib/org-events/queries";
import { loadOrgQuestPacks } from "./queries";
import { resignSubmissionPhotoUrls } from "./resign-photos";
import {
  formatFamilyName,
  formatFeedMeta,
  resolvePhotoVisibility,
} from "./photo-feed-core";

type SbResp<T> = { data: T[] | null; error: unknown };

/** 사진이 담기는 미션 종류 — payload 키가 kind 마다 다르다. */
const PHOTO_KINDS = ["PHOTO", "PHOTO_APPROVAL"] as const;

export type FeedPhoto = {
  submissionId: string;
  missionId: string;
  missionTitle: string;
  missionIcon: string | null;
  url: string;
  userId: string;
/**
   * 캡션에 걸 가족 이름 — 아이 이름 우선("이지안"), 없으면 보호자 이름.
   * 둘 다 못 쓰면 빈 문자열이고 캡션은 시각만 남는다(formatFamilyName 참고).
   */
  userName: string;
  submittedAt: string;
  /**
   * "홍길동 가족 · 3분 전" — **서버에서 만들어 보낸다.**
   * 렌더 중 Date.now() 를 부르면 react-hooks/purity 에 걸리고, 클라이언트에서
   * 계산하면 SSR 과 글자가 달라져 하이드레이션 경고가 난다. 조회는 렌더가
   * 아니므로 여기서 한 번 굳히는 게 맞다(실시간 갱신 때 다시 계산된다).
   */
  meta: string;
  /** 이 사진이 받은 좋아요 수. */
  likeCount: number;
  /** 내가 이미 눌렀는가 — 하트를 채워 그릴지, 누르면 취소일지. */
  likedByMe: boolean;
};

/**
 * 이 행사에서 **공개된** 미션 사진들(기관 스위치 ON + 확인 끝난 것). 최신순.
 *
 * @param missionId 주면 그 미션 사진만 (미션 화면 하단용).
 * @param excludeUserId 주면 그 사람 사진은 뺀다 (내 사진은 위에 이미 있다).
 * @param viewerId 하트를 채워 그릴 기준. 대개 excludeUserId 와 같지만, 내 사진까지
 *   보여주는 행사 사진 탭에서는 exclude 없이 보는 사람만 필요하다.
 */
/**
 * 행사 한 건 — org_id 와 사진 스위치. **요청 안에서 한 번만** 읽는다.
 *
 * 한 화면이 사진 카드·도토리 안내·피드를 같이 그리면서 같은 행사 행을 세 번씩
 * 읽고 있었다. 왕복 한 번이 27ms 라 눈에 띄는 낭비다. React cache 는 같은 요청
 * 안에서만 기억하므로 데이터가 묵을 걱정은 없다.
 */
const loadEventCore = cache(
  async (eventId: string): Promise<EventRow | null> => {
    if (!eventId) return null;
    try {
      const supabase = await createClient();
      const resp = (await (
        supabase.from("org_events" as never) as unknown as {
          select: (c: string) => {
            eq: (
              k: string,
              v: string
            ) => {
              maybeSingle: () => Promise<{ data: EventRow | null }>;
            };
          };
        }
      )
        .select("id, org_id, photo_feed_enabled")
        .eq("id", eventId)
        .maybeSingle()) as { data: EventRow | null };
      return resp.data ?? null;
    } catch {
      // 컬럼 미적용 배포 창 포함 — 모르면 꺼진 것으로 본다(공개는 기본값이 잠김).
      return null;
    }
  }
);

/** 이 행사 스탬프북의 미션 전부. 사진 피드와 도토리 안내가 같이 쓴다. */
const loadPackMissions = cache(async (packIdsKey: string) => {
  const packIds = packIdsKey ? packIdsKey.split(",") : [];
  if (packIds.length === 0) return [] as PackMissionRow[];
  const supabase = await createClient();
  const resp = (await (
    supabase.from("org_missions" as never) as unknown as {
      select: (c: string) => {
        in: (k: string, v: string[]) => Promise<SbResp<PackMissionRow>>;
      };
    }
  )
    .select("id, title, icon, kind, acorns, quest_pack_id, config_json")
    .in("quest_pack_id", packIds)) as SbResp<PackMissionRow>;
  return resp.data ?? [];
});

export type PackMissionRow = {
  id: string;
  title: string;
  icon: string | null;
  kind: string;
  acorns: number | null;
  quest_pack_id: string;
  config_json: Record<string, unknown> | null;
};

/** 이 행사 스탬프북의 미션 — 외부(도토리 안내)에서도 같은 캐시를 탄다. */
export async function loadEventMissions(
  eventId: string,
  orgId: string | null
): Promise<PackMissionRow[]> {
  const packIds = await resolveEventPackIds(eventId, orgId);
  return loadPackMissions(packIds.join(","));
}

export async function loadEventPhotoFeed(args: {
  eventId: string;
  missionId?: string;
  excludeUserId?: string;
  viewerId?: string;
  limit?: number;
}): Promise<FeedPhoto[]> {
  const { eventId, missionId, excludeUserId } = args;
  const limit = args.limit ?? 60;
  if (!eventId) return [];

  try {
    const supabase = await createClient();

    // 1) 기관 스위치 — 꺼져 있으면 여기서 끝. 아래 조회를 아예 하지 않는다.
    const event = await loadEventCore(eventId);
    const feedEnabled = event?.photo_feed_enabled === true;
    if (!feedEnabled) return [];
    const orgId = event?.org_id ?? "";

    // 2) 행사 → 스탬프북 → 사진 미션
    const packIds = await resolveEventPackIds(eventId, orgId);
    if (packIds.length === 0) return [];

    const all = await loadPackMissions(packIds.join(","));
    let missions = all.filter((m) =>
      (PHOTO_KINDS as readonly string[]).includes(m.kind)
    );
    if (missionId) missions = missions.filter((m) => m.id === missionId);
    if (missions.length === 0) return [];

    const missionMap = new Map(missions.map((m) => [m.id, m]));

    // 3) 확인이 끝난 제출물만. 상태 필터는 SQL 로 한 번, 아래에서 순수 함수로 또 한 번.
    const subResp = (await (
      supabase.from("mission_submissions" as never) as unknown as {
        select: (c: string) => {
          in: (
            k: string,
            v: string[]
          ) => {
            in: (
              k: string,
              v: string[]
            ) => {
              order: (
                c: string,
                o: { ascending: boolean }
              ) => {
                limit: (n: number) => Promise<SbResp<SubRow>>;
              };
            };
          };
        };
      }
    )
      .select(
        "id, org_mission_id, user_id, status, payload_json, submitted_at, like_count"
      )
      .in("org_mission_id", [...missionMap.keys()])
      .in("status", ["AUTO_APPROVED", "APPROVED"])
      .order("submitted_at", { ascending: false })
      // 한 제출물에 사진이 여러 장일 수 있어 넉넉히 받고 아래에서 자른다.
      .limit(limit)) as SbResp<SubRow>;

    if (subResp.error) {
      console.error("[photo-feed] submissions", subResp.error);
      return [];
    }
    const subs = (subResp.data ?? []).filter(
      (s) => !excludeUserId || s.user_id !== excludeUserId
    );
    if (subs.length === 0) return [];

    // 4) 캡션에 걸 이름 — 아이 이름이 먼저다(loadFamilyNames).
    const userIds = Array.from(new Set(subs.map((s) => s.user_id)));
    const nameMap = await loadFamilyNames(userIds, eventId);

    // 5) 내가 이미 누른 사진 — 하트를 채워 그리려면 필요하다.
    //    좋아요 기능 이전(테이블 미적용) 배포에서도 피드는 떠야 하므로 실패는 삼킨다.
    const likedByMe = new Set<string>();
    const viewerId = args.viewerId ?? excludeUserId;
    if (viewerId) {
      try {
        const likeResp = (await (
          supabase.from("mission_photo_likes" as never) as unknown as {
            select: (c: string) => {
              eq: (
                k: string,
                v: string
              ) => {
                in: (
                  k: string,
                  v: string[]
                ) => Promise<SbResp<{ submission_id: string }>>;
              };
            };
          }
        )
          .select("submission_id")
          .eq("from_user_id", viewerId)
          .in(
            "submission_id",
            subs.map((s) => s.id)
          )) as SbResp<{ submission_id: string }>;
        for (const r of likeResp.data ?? []) likedByMe.add(r.submission_id);
      } catch (e) {
        console.error("[photo-feed] likes", e);
      }
    }

    // 6) 사진 펼치기 — 마지막으로 순수 함수를 한 번 더 통과시킨다.
    const nowMs = Date.now();
    const items: FeedPhoto[] = [];
    for (const s of subs) {
      const mission = missionMap.get(s.org_mission_id);
      if (!mission) continue;

      const gate = resolvePhotoVisibility({ feedEnabled, status: s.status });
      if (!gate.visible) continue;

      const payload = (s.payload_json ?? {}) as { photo_urls?: unknown };
      const urls = Array.isArray(payload.photo_urls)
        ? payload.photo_urls.filter(
            (u): u is string => typeof u === "string" && u.length > 0
          )
        : [];

      for (const url of urls) {
        items.push({
          submissionId: s.id,
          missionId: mission.id,
          missionTitle: mission.title,
          missionIcon: mission.icon,
          url,
          userId: s.user_id,
          userName: nameMap.get(s.user_id) ?? "",
          submittedAt: s.submitted_at,
          meta: formatFeedMeta(nameMap.get(s.user_id), s.submitted_at, nowMs),
          likeCount: s.like_count ?? 0,
          likedByMe: likedByMe.has(s.id),
        });
        if (items.length >= limit) break;
      }
      if (items.length >= limit) break;
    }

    if (items.length === 0) return [];

    // 7) signed URL 재서명 — 사설 버킷이라 24시간이면 만료된다. 배치 1회.
    try {
      const fresh = await resignSubmissionPhotoUrls(items.map((i) => i.url));
      for (let i = 0; i < items.length; i++) items[i].url = fresh[i] ?? items[i].url;
    } catch (e) {
      console.error("[photo-feed] resign", e);
    }

    return items;
  } catch (e) {
    console.error("[photo-feed] threw", e);
    return [];
  }
}

type EventRow = {
  id: string;
  org_id: string | null;
  photo_feed_enabled: boolean | null;
};

type SubRow = {
  id: string;
  org_mission_id: string;
  user_id: string;
  status: string;
  payload_json: Record<string, unknown> | null;
  submitted_at: string;
  /** 컬럼이 아직 없는 배포 창에서는 undefined — 0 으로 읽는다. */
  like_count?: number | null;
};

/**
 * 이 행사에서 쓰는 스탬프북 id 들.
 *
 * 행사홈(pickPrimaryLivePackForEvent)과 **같은 규칙**이어야 한다. 행사에 스탬프북을
 * 따로 연결하지 않은 기관이 많고, 그런 행사에서 행사홈은 기관의 LIVE 스탬프북을
 * 대신 보여준다. 한쪽만 연결 테이블을 고집하면 참가자가 방금 찍은 그 미션인데도
 * 사진 피드는 영원히 비고, 도토리 안내는 아무것도 못 적는다.
 */
export const resolveEventPackIds = cache(
  async (eventId: string, orgId: string | null): Promise<string[]> => {
    let packs = await loadLiveQuestPacksForEvent(eventId);
    if (packs.length === 0 && orgId) {
      packs = (await loadOrgQuestPacks(orgId)).filter(
        (p) => p.status === "LIVE"
      );
    }
    return packs.map((p) => p.id).filter(Boolean);
  }
);

/**
 * 화면에 걸 가족 이름 — userId → "햇살반 홍길동".
 *
 * 피드 캡션과 좋아요 명단이 같은 사람을 다르게 부르면 누가 누른 건지 알 수 없다.
 * 규칙(아이 이름 우선 → 자동 생성 보호자 이름 배제 → 반 접두)은 formatFamilyName
 * 한 곳에 있고, **어디서 부르든 이 함수를 통한다**.
 *
 * 실패해도 빈 맵 — 이름은 곁들이는 정보다. 사진과 하트는 그대로 보여야 한다.
 */
export async function loadFamilyNames(
  userIds: string[],
  eventId: string
): Promise<Map<string, string>> {
  const nameMap = new Map<string, string>();
  if (userIds.length === 0) return nameMap;
  try {
    const supabase = await createClient();

    // 세 번 나눠 읽던 것을 세 갈래 **한 번씩**으로. 예전에는 자녀 이름·대표 반·
    // 행사 참가 아동을 각각 부르느라 app_children 을 세 번 훑었다 — 같은 행들을.
    const [uResp, cResp, linkResp] = await Promise.all([
      (
        supabase.from("app_users" as never) as unknown as {
          select: (c: string) => {
            in: (
              k: string,
              v: string[]
            ) => Promise<SbResp<{ id: string; parent_name: string }>>;
          };
        }
      )
        .select("id, parent_name")
        .in("id", userIds) as Promise<
        SbResp<{ id: string; parent_name: string }>
      >,
      (
        supabase.from("app_children" as never) as unknown as {
          select: (c: string) => {
            in: (k: string, v: string[]) => Promise<SbResp<ChildRow>>;
          };
        }
      )
        .select("id, user_id, name, class_name, is_enrolled, created_at")
        .in("user_id", userIds) as Promise<SbResp<ChildRow>>,
      eventId
        ? ((
            supabase.from("org_event_participant_children" as never) as unknown as {
              select: (c: string) => {
                eq: (
                  k: string,
                  v: string
                ) => {
                  in: (
                    k: string,
                    v: string[]
                  ) => Promise<SbResp<{ user_id: string; child_id: string }>>;
                };
              };
            }
          )
            .select("user_id, child_id")
            .eq("event_id", eventId)
            .in("user_id", userIds) as Promise<
            SbResp<{ user_id: string; child_id: string }>
          >)
        : Promise.resolve({ data: [], error: null } as SbResp<{
            user_id: string;
            child_id: string;
          }>),
    ]);

    const parentNames = new Map<string, string>();
    for (const u of uResp.data ?? []) parentNames.set(u.id, u.parent_name);

    const childrenByUser = new Map<string, ChildRow[]>();
    for (const c of (cResp.data ?? []).slice().sort((a, b) =>
      (a.created_at ?? "").localeCompare(b.created_at ?? "")
    )) {
      if (!c.name?.trim()) continue;
      childrenByUser.set(c.user_id, [
        ...(childrenByUser.get(c.user_id) ?? []),
        c,
      ]);
    }

    // 이 행사에 참가하기로 지정된 아이 id — 없으면(미지정 기관) 전체로 폴백한다.
    const pickedByUser = new Map<string, Set<string>>();
    for (const l of linkResp.data ?? []) {
      const set = pickedByUser.get(l.user_id) ?? new Set<string>();
      set.add(l.child_id);
      pickedByUser.set(l.user_id, set);
    }

    for (const uid of userIds) {
      const all = childrenByUser.get(uid) ?? [];
      const picked = pickedByUser.get(uid);
      // 형제 중 이 행사에 온 아이만. 지정이 없으면 등록(원생) 자녀 우선, 그마저
      // 없으면 전체 — loadChildNamesByUserIds 가 쓰던 규칙 그대로다.
      const scoped =
        picked && picked.size > 0 ? all.filter((c) => picked.has(c.id)) : [];
      const enrolled = all.filter((c) => c.is_enrolled);
      const shown =
        scoped.length > 0 ? scoped : enrolled.length > 0 ? enrolled : all;

      // 반은 보여줄 아이 것을 먼저, 없으면 계정의 대표 반(등록 자녀 → 그 외 순).
      const className =
        shown.find((c) => c.class_name?.trim())?.class_name ??
        enrolled.find((c) => c.class_name?.trim())?.class_name ??
        all.find((c) => c.class_name?.trim())?.class_name;

      nameMap.set(
        uid,
        formatFamilyName({
          childNames: shown.map((c) => c.name),
          className,
          parentName: parentNames.get(uid),
        })
      );
    }
  } catch (e) {
    console.error("[photo-feed] names", e);
  }
  return nameMap;
}

type ChildRow = {
  id: string;
  user_id: string;
  name: string;
  class_name: string | null;
  is_enrolled: boolean | null;
  created_at: string | null;
};

export type PhotoLiker = { userId: string; name: string; likedAt: string };

/**
 * 이 사진에 좋아요를 누른 가족들 — 최근 순.
 *
 * 누가 눌렀는지 보여주는 이유: 하트 숫자만 있으면 "몇 명이 봤나" 로 끝나지만,
 * 이름이 있으면 다음에 만났을 때 "사진 좋아요 눌러주셨죠?" 가 된다. 같은 행사에
 * 온 가족들끼리라 이름은 이미 서로 아는 범위다.
 *
 * 이름을 못 지은 계정(자녀·보호자 이름이 모두 비어 있음)은 "어느 가족" 으로 적는다.
 */
export async function loadSubmissionLikers(
  submissionId: string,
  eventId: string
): Promise<PhotoLiker[]> {
  if (!submissionId) return [];
  try {
    const supabase = await createClient();
    const resp = (await (
      supabase.from("mission_photo_likes" as never) as unknown as {
        select: (c: string) => {
          eq: (
            k: string,
            v: string
          ) => {
            order: (
              c: string,
              o: { ascending: boolean }
            ) => Promise<SbResp<{ from_user_id: string; created_at: string }>>;
          };
        };
      }
    )
      .select("from_user_id, created_at")
      .eq("submission_id", submissionId)
      .order("created_at", { ascending: false })) as SbResp<{
      from_user_id: string;
      created_at: string;
    }>;

    const rows = resp.data ?? [];
    if (rows.length === 0) return [];

    const names = await loadFamilyNames(
      Array.from(new Set(rows.map((r) => r.from_user_id))),
      eventId
    );
    return rows.map((r) => ({
      userId: r.from_user_id,
      name: names.get(r.from_user_id) || "어느",
      likedAt: r.created_at,
    }));
  } catch (e) {
    // 테이블 미적용 배포 창 포함 — 명단을 못 읽어도 하트 숫자는 남는다.
    console.error("[photo-feed] likers", e);
    return [];
  }
}

/**
 * 내가 미션별로 좋아요를 몇 개 썼는지 — missionId → 개수.
 *
 * 행사 사진 탭에는 여러 미션 사진이 섞여 있고 좋아요는 **미션마다** 3개다.
 * 화면이 "남은 개수" 를 사진마다 다르게 보여주려면 미션 단위로 세야 한다.
 *
 * 실패해도 빈 맵 — 남은 개수 표시가 틀릴 뿐이고, 진짜 판정은 DB 함수가 한다.
 */
export async function loadMyLikeCountsByMission(
  userId: string,
  missionIds: string[]
): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  if (!userId || missionIds.length === 0) return out;
  try {
    const supabase = await createClient();
    const resp = (await (
      supabase.from("mission_photo_likes" as never) as unknown as {
        select: (c: string) => {
          eq: (
            k: string,
            v: string
          ) => {
            in: (
              k: string,
              v: string[]
            ) => Promise<SbResp<{ org_mission_id: string }>>;
          };
        };
      }
    )
      .select("org_mission_id")
      .eq("from_user_id", userId)
      .in("org_mission_id", missionIds)) as SbResp<{ org_mission_id: string }>;

    for (const r of resp.data ?? []) {
      out[r.org_mission_id] = (out[r.org_mission_id] ?? 0) + 1;
    }
  } catch (e) {
    // 테이블 미적용 배포 창 포함 — 못 세면 0 으로 본다.
    console.error("[photo-feed] my likes", e);
  }
  return out;
}

/** 이 행사가 사진 나눠보기를 켰는지. 탭·안내문 노출 판단용(가벼운 단건 조회). */
export async function isPhotoFeedEnabled(eventId: string): Promise<boolean> {
  const event = await loadEventCore(eventId);
  return event?.photo_feed_enabled === true;
}

/** 행사의 org_id — 도토리 안내처럼 팩을 찾아야 하는 곳에서 쓴다(같은 캐시). */
export async function loadEventOrgId(eventId: string): Promise<string | null> {
  const event = await loadEventCore(eventId);
  return event?.org_id ?? null;
}
