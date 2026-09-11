"use client";

// 행사 상세 개요의 「당일 입장 링크」 카드 — 초대장 바로 아래.
//
// 초대장과 무엇이 다른가:
//   초대장(/invitation/{id})  — 행사 **전에** 돌린다. 읽는 글이다.
//   당일 입장(/join/event/{id}) — 행사 **당일** 문 앞에 붙인다. 연락처만
//                                 넣으면 바로 이 행사 참가자가 된다.
// 지금까지 기관이 손에 쥘 수 있는 건 초대장 링크뿐이라, 당일 현장에서
// "이거 어디로 들어오라고 하죠" 가 나왔다. 기관 공통 로그인 링크
// (/user-login?org=)는 참가자 목록 화면에 따로 있지만 그건 행사와 무관해서,
// 들어와도 행사를 또 골라야 한다.
//
// 이 카드는 발행 토글이 없다. 초대장은 "보여줄지" 를 기관이 정하지만, 입장은
// 행사 상태와 접수 설정이 이미 정하고 있다. 스위치를 하나 더 두면 "발행은
// 했는데 왜 안 들어와지지" 가 늘어날 뿐이다. 대신 지금 이 링크로 **누가
// 들어올 수 있는지**를 카드 안에서 그대로 말해 준다.

import { InvitationQrButton } from "@/components/invitation-qr-button";
import { ShareLinkRow } from "@/components/share/share-link-row";
import { useAbsoluteUrl } from "@/lib/use-origin";
import type { OrgEventStatus } from "@/lib/org-events/types";

type Props = {
  eventId: string;
  eventName: string;
  status: OrgEventStatus;
  /** 접수·승인제. 켜져 있으면 승인된 사람만 이 링크로 통과한다. */
  applicationsEnabled: boolean;
  /**
   * 그 접수가 이미 닫혔는가. 서버에서 계산해 내려온다 — 여기서 현재 시각을
   * 보면 서버·클라이언트 렌더가 갈려 하이드레이션이 깨진다.
   */
  applicationsClosed: boolean;
  /** 명단에 없는 번호도 그 자리에서 참가자가 될 수 있나. */
  allowSelfRegister: boolean;
};

/**
 * 지금 이 링크로 들어오면 실제로 어떻게 되는지 한 줄.
 *
 * 화면에 "당일 입장 링크" 라고만 적어 두고 정작 문이 잠겨 있으면, 현장에서
 * QR 을 찍은 20명이 동시에 막힌다. 막히는 조건은 전부 여기서 미리 말한다.
 */
function gateNotice({
  status,
  applicationsEnabled,
  applicationsClosed,
  allowSelfRegister,
}: Pick<
  Props,
  "status" | "applicationsEnabled" | "applicationsClosed" | "allowSelfRegister"
>):
  | { tone: "warn" | "info"; text: string }
  | null {
  if (status === "ARCHIVED") {
    return {
      tone: "warn",
      text: "보관된 행사예요. 이 링크로는 아무도 들어올 수 없어요.",
    };
  }
  if (status === "ENDED") {
    return {
      tone: "warn",
      text: "종료된 행사예요. 이미 참가한 가족만 들어올 수 있어요.",
    };
  }
  if (applicationsEnabled && applicationsClosed) {
    return {
      tone: "warn",
      text: "접수가 이미 마감돼서, 승인받은 분만 이 링크로 들어와요. 현장에서 새로 받으시려면 접수 탭에서 접수를 꺼 주세요.",
    };
  }
  if (applicationsEnabled) {
    return {
      tone: "warn",
      text: "접수·승인제라 승인된 분만 통과해요. 현장에서 바로 받으시려면 접수 탭에서 접수를 꺼 주세요.",
    };
  }
  if (!allowSelfRegister) {
    return {
      tone: "warn",
      text: "지금은 명단에 있는 번호만 들어올 수 있어요. 현장 등록을 받으시려면 참가자 탭에서 셀프 등록을 켜 주세요.",
    };
  }
  if (status === "DRAFT") {
    return {
      tone: "info",
      text: "이 링크는 지금도 열려 있어요. 행사는 시작 시각이 되면 저절로 열리고, 미리 열어 보시려면 상태를 「진행중」 으로 바꾸면 돼요.",
    };
  }
  return null;
}

export function EventLoginShare({
  eventId,
  eventName,
  status,
  applicationsEnabled,
  applicationsClosed,
  allowSelfRegister,
}: Props) {
  const url = useAbsoluteUrl(`/join/event/${eventId}`);
  const notice = gateNotice({
    status,
    applicationsEnabled,
    applicationsClosed,
    allowSelfRegister,
  });

  function onShare() {
    if (!navigator.share) return;
    navigator
      .share({
        title: `${eventName} — 입장하기`,
        text: `${eventName} 입장 링크예요. 연락처만 넣으면 바로 참가돼요 🚪`,
        url,
      })
      .catch(() => {
        /* 사용자 취소 무시 */
      });
  }

  return (
    <section className="rounded-2xl border border-[#E8DDC8] bg-gradient-to-br from-[#FFF8F0] via-white to-[#FFF8F0] p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-bold text-[#6B4423]">
          <span aria-hidden>🚪</span>
          <span>당일 입장 링크</span>
        </h3>
        <p className="text-[11px] text-[#8B6F47]">
          연락처만 넣으면 <b className="font-semibold">이 행사</b> 참가자가 돼요
        </p>
      </div>

      <ShareLinkRow
        className="mt-3"
        url={url}
        onShare={onShare}
        qr={
          <InvitationQrButton
            url={url}
            eventName={eventName}
            kindLabel="입장"
          />
        }
      />

      {notice && (
        <p
          className={`mt-2 rounded-xl px-3 py-2 text-[11px] leading-relaxed ${
            notice.tone === "warn"
              ? "border border-amber-300 bg-amber-50 font-semibold text-amber-900"
              : "text-[#8B6F47]"
          }`}
        >
          {notice.tone === "warn" && <span aria-hidden>⚠️ </span>}
          {notice.text}
        </p>
      )}

      <p className="mt-2 text-[11px] leading-relaxed text-[#8B6F47]">
        💡 QR 을 뽑아 접수대·현관에 붙여 두세요. 초대장과 달리 읽을 것이 없고
        바로 입장으로 이어져요.
      </p>
    </section>
  );
}
