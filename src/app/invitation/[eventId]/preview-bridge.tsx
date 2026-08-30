"use client";

// 미리보기 모드에서만 붙는 조각 — 편집 폼이 보낸 글자를 화면에 바로 반영한다.
//
// 참가자가 여는 진짜 초대장에는 이 컴포넌트가 아예 렌더되지 않는다(서버에서
// preview 일 때만 붙인다). 즉 이 JS 는 참가자에게 안 실린다.
//
// 왜 DOM 을 직접 만지나:
//   초대장 본문은 서버 컴포넌트다. 그 안의 글자를 React 상태로 바꾸려면 본문
//   전체를 클라이언트 컴포넌트로 바꾸거나 레이아웃을 한 벌 더 만들어야 하고,
//   그 순간부터 "미리보기랑 실제가 다른데요" 가 시작된다. 진짜 화면을 그대로
//   띄우고 글자만 갈아끼우는 쪽이 어긋날 자리가 없다.
//   서버 컴포넌트라 하이드레이션 이후 React 가 이 영역을 다시 그리지 않는다 —
//   덮어써질 걱정이 없다.
//
// 두 가지 표시를 읽는다:
//   data-inv="body"          → 이 요소의 글자를 갈아끼운다
//   data-inv-if="location|address"  → 값이 하나라도 차 있으면 보이고, 다 비면 숨긴다
//
// 숨기는 데 style.display 를 쓰는 이유: hidden 속성이나 .hidden 클래스는
// .inline-flex 같은 유틸리티와 명시도가 같아서 순서에 따라 진다. 인라인 스타일은
// 항상 이긴다.

import { useEffect } from "react";
import {
  INVITATION_PREVIEW_FIELDS,
  INVITATION_PREVIEW_MESSAGE,
  INVITATION_PREVIEW_READY,
  isPreviewBlockVisible,
} from "@/lib/org-events/invitation-copy";

export function InvitationPreviewBridge() {
  useEffect(() => {
    const origin = window.location.origin;

    const apply = (fields: Record<string, unknown>) => {
      for (const key of INVITATION_PREVIEW_FIELDS) {
        const value = fields[key];
        if (typeof value !== "string") continue;
        document
          .querySelectorAll(`[data-inv="${key}"]`)
          .forEach((el) => {
            el.textContent = value;
          });
      }

      // 값이 비면 그 덩어리째 사라져야 한다 — 빈 "안내문" 카드가 남아 있으면
      // 실제 초대장에는 없는 것을 보여주는 셈이다.
      document
        .querySelectorAll<HTMLElement>("[data-inv-if]")
        .forEach((el) => {
          const on = isPreviewBlockVisible(el.dataset.invIf ?? "", fields);
          el.style.display = on ? "" : "none";
        });
    };

    const onMessage = (e: MessageEvent) => {
      if (e.origin !== origin) return;
      const data = e.data as { type?: string; fields?: Record<string, unknown> };
      if (data?.type !== INVITATION_PREVIEW_MESSAGE) return;
      if (!data.fields || typeof data.fields !== "object") return;
      apply(data.fields);
    };

    // 미리보기 안에서는 아무 데도 못 간다.
    //
    // 여긴 진짜 초대장이라 신청 버튼도 지도 링크도 전부 진짜다. 기관이 글을
    // 보다가 무심코 눌러 **실제 신청이 접수되면** 그건 사고다. 캡처 단계에서
    // 클릭과 제출을 통째로 막는다 — 개별 버튼을 하나씩 막다 보면 언젠가
    // 새로 생긴 버튼 하나가 빠진다.
    const block = (e: Event) => {
      const el = e.target as Element | null;
      if (e.type === "submit" || el?.closest?.("a, button, [role='button']")) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    document.addEventListener("click", block, true);
    document.addEventListener("submit", block, true);

    window.addEventListener("message", onMessage);
    // 부모가 iframe 로드 시점을 정확히 못 잡아도 첫 그림이 맞도록 이쪽에서 알린다.
    window.parent?.postMessage({ type: INVITATION_PREVIEW_READY }, origin);

    return () => {
      window.removeEventListener("message", onMessage);
      document.removeEventListener("click", block, true);
      document.removeEventListener("submit", block, true);
    };
  }, []);

  return null;
}
