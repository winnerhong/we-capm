import { describe, expect, it } from "vitest";
import {
  EVENT_STEPS,
  resolveStep,
  resolveStepStatuses,
  stepHref,
} from "./event-steps";

const BASE = "/org/o1/events/e1";

describe("resolveStep", () => {
  it("step 만 있으면 그 단계의 첫 하위탭", () => {
    expect(resolveStep({ step: "people" })).toEqual({
      step: "people",
      sub: "applications",
    });
  });

  it("step + sub 를 그대로 쓴다", () => {
    expect(resolveStep({ step: "run", sub: "fm" })).toEqual({
      step: "run",
      sub: "fm",
    });
  });

  it("그 단계에 없는 sub 는 첫 하위탭으로 — 빈 화면 대신", () => {
    expect(resolveStep({ step: "run", sub: "survey" })).toEqual({
      step: "run",
      sub: "questpacks",
    });
  });

  it("예전 ?tab= 링크가 살아 있어야 한다 — 카톡으로 돌아다니는 주소들", () => {
    expect(resolveStep({ tab: "participants" })).toEqual({
      step: "people",
      sub: "roster",
    });
    expect(resolveStep({ tab: "analytics" })).toEqual({
      step: "result",
      sub: "analytics",
    });
    expect(resolveStep({ tab: "questpacks" })).toEqual({
      step: "run",
      sub: "questpacks",
    });
  });

  it("step 이 있으면 예전 tab 보다 우선", () => {
    expect(resolveStep({ step: "invite", tab: "analytics" }).step).toBe(
      "invite"
    );
  });

  it("모르는 값·빈 값은 첫 단계", () => {
    expect(resolveStep({})).toEqual({ step: "event", sub: "overview" });
    expect(resolveStep({ step: "nope", tab: "nope" })).toEqual({
      step: "event",
      sub: "overview",
    });
  });
});

describe("stepHref", () => {
  it("첫 단계·첫 하위탭은 쿼리 없이", () => {
    expect(stepHref(BASE, "event")).toBe(BASE);
    expect(stepHref(BASE, "event", "overview")).toBe(BASE);
  });

  it("단계만 다르면 step 만", () => {
    expect(stepHref(BASE, "people")).toBe(`${BASE}?step=people`);
  });

  it("하위탭이 첫 번째가 아니면 sub 까지", () => {
    expect(stepHref(BASE, "people", "roster")).toBe(
      `${BASE}?step=people&sub=roster`
    );
  });

  it("모르는 하위탭은 첫 번째로 떨어진다", () => {
    expect(stepHref(BASE, "invite", "nope")).toBe(`${BASE}?step=invite`);
  });

  it("만든 링크는 다시 파싱했을 때 같은 자리로 돌아온다", () => {
    for (const step of EVENT_STEPS) {
      for (const sub of step.subs) {
        const href = stepHref(BASE, step.key, sub.key);
        const q = href.includes("?") ? href.slice(href.indexOf("?") + 1) : "";
        const p = new URLSearchParams(q);
        expect(
          resolveStep({ step: p.get("step"), sub: p.get("sub") })
        ).toEqual({ step: step.key, sub: sub.key });
      }
    }
  });
});

describe("resolveStepStatuses", () => {
  const base = {
    hasName: true,
    hasSchedule: true,
    invitationReady: true,
    invitationPublished: true,
    pendingApplications: 0,
    participantCount: 12,
    questPackCount: 1,
    surveyResponseCount: 0,
    eventEnded: false,
  };

  it("다 갖춰지면 앞 네 단계가 끝난 상태", () => {
    const s = resolveStepStatuses(base);
    expect(s.event.state).toBe("done");
    expect(s.invite.state).toBe("done");
    expect(s.people.state).toBe("done");
    expect(s.run.state).toBe("done");
  });

  it("날짜가 없으면 할 일을 짚어준다", () => {
    const s = resolveStepStatuses({ ...base, hasSchedule: false });
    expect(s.event.state).toBe("todo");
    expect(s.event.hint).toContain("날짜");
  });

  it("초대장 — 내용만 있고 발행 전이면 '발행 전'", () => {
    const s = resolveStepStatuses({ ...base, invitationPublished: false });
    expect(s.invite.state).toBe("current");
    expect(s.invite.hint).toBe("발행 전");
  });

  it("초대장 — 내용이 비었으면 그렇게 말한다", () => {
    const s = resolveStepStatuses({
      ...base,
      invitationPublished: false,
      invitationReady: false,
    });
    expect(s.invite.hint).toContain("비어");
  });

  it("승인 대기가 있으면 참가자 단계에 그 숫자를 건다 — 놓치면 참가자가 안 는다", () => {
    const s = resolveStepStatuses({ ...base, pendingApplications: 3 });
    expect(s.people.hint).toBe("3명 대기");
  });

  it("스탬프북이 없으면 진행 준비가 안 된 것", () => {
    const s = resolveStepStatuses({ ...base, questPackCount: 0 });
    expect(s.run.state).toBe("todo");
    expect(s.run.hint).toContain("없음");
  });

  it("행사가 끝나면 결과 단계가 켜진다", () => {
    expect(resolveStepStatuses({ ...base, eventEnded: true }).result.state).toBe(
      "current"
    );
  });

  it("설문 응답이 있으면 개수를 적는다", () => {
    const s = resolveStepStatuses({
      ...base,
      eventEnded: true,
      surveyResponseCount: 9,
    });
    expect(s.result.hint).toBe("설문 9");
  });
});
