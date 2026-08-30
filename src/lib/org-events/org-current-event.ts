// server-only: 기관별 "지금 대표 행사" — 숲지기 화면의 기관 한 줄에 붙일 값.
//
// 왜 필요한가:
//   숲지기 대시보드의 기관 목록은 이름과 ACTIVE/SUSPENDED 만 보여줬다. 계정이
//   살아 있다는 사실은 알겠는데 **그 기관이 지금 뭘 하고 있는지**는 알 수 없었다.
//   숲지기가 알고 싶은 건 "다음 주에 행사가 있나", "지난달에 끝났나" 쪽이다.
//
// 고르는 규칙은 참가자 홈 정렬과 같다(pickRepresentativeEvent). 두 화면이 서로
// 다른 행사를 대표로 뽑으면 "어느 게 맞는 거지" 가 된다.

import "server-only";
import { createClient } from "@/lib/supabase/server";
import {
  pickRepresentativeEvent,
  resolveEventAccess,
} from "./event-access";
import { fmtCompactDateKst } from "@/lib/datetime/kst";
import {
  describeEventStatus,
  type EventStatusTone,
} from "./event-status-label";

/**
 * 한 번에 읽는 행사 수 상한. 기관 100곳 × 행사 몇 개를 넉넉히 덮는다.
 * 넘치면 최근 행사부터 채워지므로 오래된 것만 빠진다 — 대표를 고르는 데는
 * 오래된 행사가 필요 없다.
 */
const MAX_ROWS = 2000;

export type OrgCurrentEvent = {
  /** 행사 이름 — 한 줄에 다 못 넣어 title 로 붙인다. */
  name: string;
  emoji: string;
  /** "9/12(토) 예정" · "진행중" · "5/16(토) 종료" · "보관중" */
  label: string;
  tone: EventStatusTone;
};

type Row = {
  id: string;
  org_id: string;
  name: string | null;
  status: string | null;
  starts_at: string | null;
  ends_at: string | null;
};

/**
 * 기관 id → 대표 행사. 행사가 없는 기관은 Map 에 아예 없다(호출부가 그 자리를
 * 통째로 비운다 — "행사 없음" 이라고 적으면 목록이 그 말로 도배된다).
 *
 * 실패해도 빈 Map. 이건 곁들이는 정보라, 이것 때문에 대시보드가 통째로 안 뜨면
 * 그게 더 큰 사고다.
 */
export async function loadCurrentEventByOrg(
  orgIds: string[]
): Promise<Map<string, OrgCurrentEvent>> {
  const out = new Map<string, OrgCurrentEvent>();
  const ids = Array.from(new Set(orgIds.filter(Boolean)));
  if (ids.length === 0) return out;

  try {
    const supabase = await createClient();
    const resp = (await (
      supabase.from("org_events" as never) as unknown as {
        select: (c: string) => {
          in: (
            k: string,
            v: string[]
          ) => {
            order: (
              c: string,
              o: { ascending: boolean }
            ) => {
              limit: (n: number) => Promise<{ data: Row[] | null }>;
            };
          };
        };
      }
    )
      .select("id, org_id, name, status, starts_at, ends_at")
      .in("org_id", ids)
      .order("starts_at", { ascending: false })
      .limit(MAX_ROWS)) as { data: Row[] | null };

    const byOrg = new Map<string, Row[]>();
    for (const r of resp.data ?? []) {
      const list = byOrg.get(r.org_id);
      if (list) list.push(r);
      else byOrg.set(r.org_id, [r]);
    }

    for (const [orgId, rows] of byOrg) {
      const pick = pickRepresentativeEvent(rows);
      if (!pick) continue;
      const desc = describeEventStatus({
        status: pick.status,
        startsAt: pick.starts_at,
        endsAt: pick.ends_at,
      });

      // "진행중" 인데 날짜는 두 달 전인 행사가 흔하다 — 아무도 🏁 종료를 누르지
      // 않았기 때문이다. 상태만 적으면 숲지기 화면이 "진행중" 으로 도배되고
      // 아무 정보도 못 준다. 날짜를 나란히 붙여 어긋남이 보이게 한다.
      //   🟢 진행중 · 8/11(화)  →  "아, 이 기관 아직 안 끝냈네"
      const access = resolveEventAccess({
        status: pick.status,
        startsAt: pick.starts_at,
        endsAt: pick.ends_at,
      });
      const stale =
        access.phase === "past" ? fmtCompactDateKst(pick.starts_at) : "";

      out.set(orgId, {
        name: pick.name || "(이름 없음)",
        emoji: desc.emoji,
        label: stale ? `${desc.label} · ${stale}` : desc.label,
        tone: desc.tone,
      });
    }
  } catch (e) {
    console.error("[org-events/loadCurrentEventByOrg]", e);
  }

  return out;
}
