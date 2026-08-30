"use client";

// 초대장 폰 미리보기 — 편집 폼 **왼쪽**에 붙어서 참가자가 보는 화면을 그대로 띄운다.
//
// 왜 iframe 인가:
//   미리보기를 새로 그리면 초대장 화면이 바뀔 때마다 미리보기가 거짓말을 하기
//   시작한다. 게다가 초대장은 히어로가 min-h-[24vh], 본문이 sm: 분기라
//   **뷰포트가 진짜여야** 제대로 나온다. 컴포넌트를 다시 그리거나 화면을
//   scale 로 줄이면 데스크톱 뷰포트를 따라가서 실제 폰과 다르게 나온다.
//   iframe 안쪽은 진짜 390px 짜리 화면이다. 줄이지 않고 실제 크기로 그린다
//   (이유는 아래 PHONE_W 주석).
//
// 반영 시점:
//   글자(행사명·인사말·안내문·준비물·장소·주소)는 타이핑 즉시. 나머지(사진·
//   주차장·입장시간·주최/주관)는 구조가 바뀌는 값이라 저장 후 새로고침.

import { useEffect, useRef, useState } from "react";
import {
  INVITATION_PREVIEW_MESSAGE,
  INVITATION_PREVIEW_READY,
  type InvitationPreviewFields,
} from "@/lib/org-events/invitation-copy";

/**
 * 폰 화면 크기 — 흔한 폰 한 대(390×844)에서 주소창 몫을 뺀 값. 실제 크기 그대로
 * 그린다.
 *
 * 예전엔 transform: scale 로 줄여 넣었는데 두 가지가 깨졌다:
 *   1) 둥근 모서리가 안 잘렸다. overflow:hidden + border-radius 는 transform 이
 *      걸린 자식을 제대로 못 자른다 — 커버 사진 모서리가 틀 밖으로 각지게 튀어나왔다.
 *   2) 글자가 0.8배로 흐려졌다. 글이 어떻게 보이는지 보려고 만든 화면인데.
 * 줄이지 않으면 둘 다 없던 일이 된다. 게다가 진짜 크기라 더 정확하다.
 */
const PHONE_W = 390;
/**
 * 폰 높이 — 680 을 넘지 않되 **창 높이를 넘지도 않는다**.
 *
 * 680 으로 고정했더니 화면이 짧은 노트북에서 폰 아래쪽이 잘렸고, 그걸 패널
 * 스크롤로 막았더니 스크롤 막대가 폰 옆에 하나 더 생겼다. 안쪽에서 이미
 * 스크롤되는 화면 옆에 막대를 하나 더 두는 건 군더더기다.
 * 짧은 창에서는 폰이 조금 낮아지는 쪽이 낫다.
 */
const PHONE_H = "min(680px, calc(100dvh - 11rem))";
/** 테두리 두께 — 바깥 반경에서 이만큼 뺀 값이 안쪽 반경이다. */
const BEZEL = 6;

export function InvitationPhonePreview({
  eventId,
  fields,
  reloadKey = 0,
}: {
  eventId: string;
  fields: InvitationPreviewFields;
  /** 값이 바뀌면 폰을 다시 불러온다 — 저장 직후 사진·주차장을 반영하는 용도. */
  reloadKey?: number;
}) {
  const [wide, setWide] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  // 자리는 CSS 가 정하고(hidden / xl:block), **iframe 을 실제로 띄울지만**
  // 이 값이 정한다.
  //
  //   자리까지 이 값으로 정하면 서버는 늘 좁은 화면(버튼)을 그리고, 데스크톱에서
  //   화면이 뜬 직후 버튼이 폰으로 바뀌면서 폼이 통째로 밀린다.
  //   반대로 iframe 까지 CSS 로만 숨기면, 폰으로 폼을 채울 때 아무도 안 보는
  //   초대장을 서버에서 그려 받는다.
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1280px)");
    const sync = () => setWide(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  // 시트가 열려 있는 동안 뒤쪽 폼이 같이 스크롤되지 않게.
  useEffect(() => {
    if (!sheetOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [sheetOpen]);

  return (
    <>
      {/* 왼쪽에 선다 — order 를 주지 않으면 DOM 순서(미리보기 → 폼) 그대로다.
          예전엔 order-2 로 오른쪽에 뒀는데, 초대장 작업에서 눈이 먼저 가야 하는
          것은 **결과물**이지 입력칸이 아니다. 왼쪽이 먼저 읽히는 자리다.
          sticky 라 폼을 아무리 내려도 폰은 그 자리에 남는다. */}
      <aside className="sticky top-16 hidden w-[402px] shrink-0 xl:block">
        <Frame
          eventId={eventId}
          fields={fields}
          reloadKey={reloadKey}
          live={wide}
        />
      </aside>

      <button
        type="button"
        onClick={() => setSheetOpen(true)}
        className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-[#D4E4BC] bg-white px-4 py-2.5 text-sm font-bold text-[#2D5A3D] shadow-sm transition hover:bg-[#F5F1E8] xl:hidden"
      >
        <span aria-hidden>📱</span>
        <span>참가자가 보는 화면 미리보기</span>
      </button>

      {sheetOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="초대장 미리보기"
          className="fixed inset-0 z-50 flex flex-col bg-[#2C2C2C]/70 backdrop-blur-sm"
        >
          <div className="flex items-center justify-between gap-2 px-4 py-3">
            <p className="text-sm font-bold text-white">
              <span aria-hidden className="mr-1.5">
                📱
              </span>
              참가자가 보는 화면
            </p>
            <button
              type="button"
              onClick={() => setSheetOpen(false)}
              className="rounded-xl bg-white/15 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-white/25"
            >
              닫기
            </button>
          </div>
          {/* 폰으로 보고 있다면 이 화면 자체가 이미 폰이다 — 틀을 또 그리지
              않는다. 화면을 다 쓰는 쪽이 실제에 더 가깝다. */}
          <div className="mx-auto w-full max-w-[420px] flex-1 overflow-hidden bg-white">
            <Live
              key={reloadKey}
              eventId={eventId}
              fields={fields}
              className="h-full w-full"
            />
          </div>
        </div>
      )}
    </>
  );
}

/* ─────────────────────────── 폰 틀 ─────────────────────────── */

function Frame({
  eventId,
  fields,
  reloadKey,
  live,
}: {
  eventId: string;
  fields: InvitationPreviewFields;
  reloadKey: number;
  /** 틀은 늘 그리되, 실제 화면은 이 창이 넓을 때만 불러온다. */
  live: boolean;
}) {
  const [nonce, setNonce] = useState(0);

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-xs font-bold text-[#2D5A3D]">
          <span aria-hidden className="mr-1">
            📱
          </span>
          참가자가 보는 화면
        </p>
        <button
          type="button"
          onClick={() => setNonce((v) => v + 1)}
          title="사진·주차장처럼 저장해야 반영되는 항목을 다시 불러옵니다"
          className="rounded-lg px-2 py-1 text-[11px] font-bold text-[#8B7F75] transition hover:bg-[#F5F1E8] hover:text-[#2D5A3D]"
        >
          🔄 새로고침
        </button>
      </div>

      <div
        className="bg-[#2C2C2C] shadow-xl"
        style={{ borderRadius: 32, padding: BEZEL }}
      >
        <div
          className="overflow-hidden bg-white"
          style={{
            width: PHONE_W,
            height: PHONE_H,
            // 바깥 32 − 테두리 6. 안 맞추면 모서리에 검은 초승달이 남는다.
            borderRadius: 32 - BEZEL,
          }}
        >
          {live && (
            <Live
              key={`${reloadKey}-${nonce}`}
              eventId={eventId}
              fields={fields}
              style={{ width: PHONE_W, height: "100%" }}
            />
          )}
        </div>
      </div>

      <p className="mt-2 text-[11px] leading-relaxed text-[#8B7F75]">
        글자는 타이핑하면 바로 반영돼요. 사진·주차장은 저장하면 반영돼요.
      </p>
    </div>
  );
}

/* ───────────────── 진짜 초대장 + 글자 실시간 전달 ───────────────── */

function Live({
  eventId,
  fields,
  className,
  style,
}: {
  eventId: string;
  fields: InvitationPreviewFields;
  className?: string;
  style?: React.CSSProperties;
}) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [ready, setReady] = useState(false);

  // iframe 안쪽이 "받을 준비 됐다" 고 알려주면 그때부터 보낸다. onLoad 만 믿으면
  // 리스너가 붙기 전에 쏴서 첫 글자가 반영되지 않는 경우가 생긴다.
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      if ((e.data as { type?: string })?.type !== INVITATION_PREVIEW_READY)
        return;
      if (e.source !== ref.current?.contentWindow) return;
      setReady(true);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  const { name, message, body, dress, location, address } = fields;
  useEffect(() => {
    if (!ready) return;
    ref.current?.contentWindow?.postMessage(
      {
        type: INVITATION_PREVIEW_MESSAGE,
        fields: { name, message, body, dress, location, address },
      },
      window.location.origin
    );
  }, [ready, name, message, body, dress, location, address]);

  return (
    <iframe
      ref={ref}
      src={`/invitation/${eventId}?preview=1`}
      title="초대장 미리보기"
      loading="lazy"
      // iframe 은 기본이 inline 이라 글자 기준선 몫만큼 아래에 흰 틈이 생긴다.
      className={`block ${className ?? ""}`}
      style={style}
    />
  );
}
