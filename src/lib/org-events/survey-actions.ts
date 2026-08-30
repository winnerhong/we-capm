"use server";

// 행사 설문 — 참가자 응답 저장 / 기관 스위치.
//
// 판단(켜졌는지·시작했는지·이미 냈는지)은 survey-core 한 곳에 있고 여기서는
// 그 함수를 부른다. 화면이 버튼을 감추는 것만 믿지 않는다 — 링크를 직접 열거나
// 기관이 방금 껐을 수도 있다.

import { revalidatePath } from "next/cache";
import { assertEventFeature } from "@/lib/org-events/event-open-guard";
import { F } from "@/lib/features/codes";
import { createClient } from "@/lib/supabase/server";
import { requireAppUser } from "@/lib/user-auth-guard";
import { requireOrg } from "@/lib/org-auth-guard";
import {
  normalizeComment,
  normalizeRating,
  parseSurveyLeadInput,
  resolveSurveyGate,
} from "./survey-core";

type Row = Record<string, unknown>;

/**
 * 게이트 판정에 필요한 최소 컬럼.
 *
 * survey_open_lead_min 이 optional 인 이유: 컬럼 미적용 배포 창에서는 select 가
 * 이 키를 안 돌려준다. undefined 는 "기본 30분" 으로 폴백되고(null 과 다르다),
 * 그래야 마이그레이션 전후로 화면이 뒤집히지 않는다.
 */
type EventGateRow = {
  status: string;
  survey_enabled: boolean | null;
  ends_at: string | null;
  survey_open_lead_min?: number | null;
};
type SbErr = { message?: string; code?: string } | null;

export type SubmitSurveyResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * 설문 응답 저장. 이미 냈으면 덮어쓴다(고칠 수 있어야 한다).
 */
export async function submitSurveyAction(
  eventId: string,
  input: { rating: unknown; bestMissionId?: string | null; comment?: unknown }
): Promise<SubmitSurveyResult> {
  try {
    const user = await requireAppUser();
    if (!eventId) return { ok: false, error: "행사를 찾을 수 없어요" };

    // 설문은 행사가 끝난 뒤에 하는 것이라 openness 는 보지 않는다. 기능만 본다.
    const featureGate = await assertEventFeature(eventId, F.SURVEY);
    if (!featureGate.ok) return { ok: false, error: featureGate.error };

    const rating = normalizeRating(input?.rating);
    if (rating == null) {
      return { ok: false, error: "별점을 골라주세요" };
    }

    const supabase = await createClient();

    // 행사 상태·스위치를 서버에서 다시 본다.
    const evResp = (await (
      supabase.from("org_events" as never) as unknown as {
        select: (c: string) => {
          eq: (
            k: string,
            v: string
          ) => {
            maybeSingle: () => Promise<{ data: EventGateRow | null }>;
          };
        };
      }
    )
      // "*" 인 이유: survey_open_lead_min 은 나중에 실행될 마이그레이션
      // 컬럼이라, 이름을 적어 넣으면 SQL 적용 전 배포 창에서 PostgREST 가
      // "그런 컬럼 없음" 으로 통째로 거절한다 — 설문 제출이 다 막힌다.
      // "*" 는 컬럼이 없으면 그냥 키가 안 올 뿐이고, undefined 는 기본 30분으로
      // 폴백된다(null 과 구분하는 이유가 이것이다).
      .select("*")
      .eq("id", eventId)
      .maybeSingle()) as {
      data: EventGateRow | null;
    };

    if (!evResp.data) return { ok: false, error: "행사를 찾을 수 없어요" };

    const gate = resolveSurveyGate({
      surveyEnabled: evResp.data.survey_enabled === true,
      eventStatus: evResp.data.status,
      alreadyAnswered: false,
      endsAt: evResp.data.ends_at ?? null,
      openLeadMin: evResp.data.survey_open_lead_min,
    });
    if (!gate.canAnswer) return { ok: false, error: gate.reason };

    const payload: Row = {
      event_id: eventId,
      user_id: user.id,
      rating,
      best_mission_id: input?.bestMissionId || null,
      comment: normalizeComment(input?.comment),
      updated_at: new Date().toISOString(),
    };

    const { error } = (await (
      supabase.from("event_survey_responses" as never) as unknown as {
        upsert: (
          r: Row,
          o: { onConflict: string }
        ) => Promise<{ error: SbErr }>;
      }
    ).upsert(payload, { onConflict: "event_id,user_id" })) as {
      error: SbErr;
    };

    if (error) {
      console.error("[survey/submit]", error);
      return { ok: false, error: "설문 저장에 실패했어요" };
    }

    revalidatePath("/e/[eventId]/survey", "page");
    revalidatePath("/e/[eventId]", "page");
    return { ok: true };
  } catch (e) {
    console.error("[survey/submit] threw", e);
    return {
      ok: false,
      error: e instanceof Error ? e.message : "설문 저장에 실패했어요",
    };
  }
}

/**
 * 기관이 설문 받기를 켜고 끈다.
 *
 * 끈다고 응답을 지우지 않는다 — 받은 답은 남는다. 참가자 화면에서 카드만 사라진다.
 */
export async function setSurveyEnabledAction(
  eventId: string,
  enabled: boolean
): Promise<void> {
  const org = await requireOrg();
  if (!eventId) throw new Error("행사를 찾을 수 없어요");

  const supabase = await createClient();
  const { error } = (await (
    supabase.from("org_events" as never) as unknown as {
      update: (p: Row) => {
        eq: (k: string, v: string) => {
          eq: (k: string, v: string) => Promise<{ error: SbErr }>;
        };
      };
    }
  )
    .update({ survey_enabled: enabled })
    .eq("id", eventId)
    // 남의 기관 행사를 건드리지 못하게 org_id 까지 조건에 건다.
    .eq("org_id", org.orgId)) as { error: SbErr };

  if (error) {
    console.error("[survey/toggle]", error);
    throw new Error("설문 설정 변경에 실패했어요");
  }

  revalidatePath("/org/[orgId]/events/[eventId]", "page");
}

/**
 * 설문이 열리는 시각 — 행사 종료 몇 분 전부터.
 *
 * 빈 값·0 은 "자동으로 열지 않음" 이다. 그 행사는 기관이 🏁 종료를 눌러야 열린다.
 */
export async function setSurveyLeadAction(
  eventId: string,
  raw: string
): Promise<{ ok: true; leadMin: number | null } | { ok: false; error: string }> {
  try {
    const org = await requireOrg();
    if (!eventId) return { ok: false, error: "행사를 찾을 수 없어요" };

    const leadMin = parseSurveyLeadInput(raw);
    const supabase = await createClient();
    const { error } = (await (
      supabase.from("org_events" as never) as unknown as {
        update: (p: Row) => {
          eq: (k: string, v: string) => {
            eq: (k: string, v: string) => Promise<{ error: SbErr }>;
          };
        };
      }
    )
      .update({ survey_open_lead_min: leadMin })
      .eq("id", eventId)
      .eq("org_id", org.orgId)) as { error: SbErr };

    if (error) {
      console.error("[survey/lead]", error);
      return { ok: false, error: "저장에 실패했어요" };
    }

    revalidatePath("/org/[orgId]/events/[eventId]", "page");
    return { ok: true, leadMin };
  } catch (e) {
    console.error("[survey/lead] threw", e);
    return { ok: false, error: "저장에 실패했어요" };
  }
}
