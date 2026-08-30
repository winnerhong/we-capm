"use client";

// 링크 한 줄 — 초대장·참가자 로그인·설문이 같이 쓴다.
//
// 예전에는 두 곳이 각자 <input readOnly> 로 URL 전체를 띄우고 그 아래 버튼 네
// 개를 늘어놓았다. 한 행사 카드에 그게 두 벌씩 들어가니 화면이 링크 텍스트로
// 가득 찼다.
//
// 링크는 **읽으라고 있는 게 아니라 복사하라고 있다.** 그래서 앞부분만 보여주고
// (어느 링크인지 알아볼 정도), 누르면 바로 복사한다.
//
// variant 로 결을 나눈다. 이 화면의 주인공은 행사별 초대장이고, 기관 로그인 링크는
// 곁들이는 것이다. 둘이 똑같이 생기면 "이 링크가 그 링크인가" 로 헷갈린다 —
// 노란 공유 버튼은 초대장에만 준다.

import { useState, useSyncExternalStore } from "react";

/** 구독할 것이 없다 — navigator.share 지원 여부는 런타임에 바뀌지 않는다. */
const subscribeNever = () => () => {};

export function ShareLinkRow({
  url,
  onShare,
  qr,
  variant = "primary",
  className = "",
}: {
  url: string;
  /** 공유 시트가 없는 브라우저(PC)에서는 버튼을 감춘다 — 눌러도 아무 일 없으면 더 나쁘다. */
  onShare: () => void;
  qr: React.ReactNode;
  /** primary = 행사 초대장(이 화면의 주인공) · muted = 곁들이는 기관 링크 */
  variant?: "primary" | "muted";
  className?: string;
}) {
  const muted = variant === "muted";
  const [copied, setCopied] = useState(false);

  /* 공유 시트 지원 여부 — 서버와 클라이언트가 다르게 보는 값이라 useSyncExternalStore 로 읽는다.
     렌더 도중에 navigator 를 그냥 보면 서버(navigator 없음 → 버튼 없음)와 클라이언트 첫 렌더
     (모바일 → 버튼 있음)가 갈려 하이드레이션이 깨진다. 실제로 깨졌다 — 서버가 QR 버튼을 그린
     자리에 클라이언트가 공유 버튼을 놓아 "server rendered text didn't match" 가 떴다.

     세 번째 인자(서버 스냅샷)를 false 로 주면 **하이드레이션 첫 렌더까지** false 로 그린다.
     서버 HTML 과 정확히 같아진 뒤, 하이드레이션이 끝나고 나서 실제 값으로 바뀐다.
     (useEffect + setState 로도 되지만 그건 '렌더 → 커밋 → 다시 렌더' 라 한 프레임 더 돈다) */
  const canShare = useSyncExternalStore(
    subscribeNever,
    () => typeof navigator !== "undefined" && typeof navigator.share === "function",
    () => false
  );

  function onCopy() {
    navigator.clipboard
      .writeText(url)
      .then(() => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1500);
      })
      .catch(() => {
        window.prompt("아래 링크를 복사하세요", url);
      });
  }

  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${className}`}>
      {/* 링크 자체가 복사 버튼 — 인풋을 두면 "고쳐도 되나" 로 읽힌다. */}
      <button
        type="button"
        onClick={onCopy}
        title={url}
        className={`inline-flex min-w-0 flex-1 items-center gap-2 rounded-xl border text-left transition ${
          muted
            ? "border-[#E8DDC8] bg-white/60 px-2.5 py-1.5 hover:border-[#8B7F75]"
            : "border-[#D4E4BC] bg-white px-3 py-2 hover:border-[#2D5A3D]"
        }`}
      >
        <span
          className={`min-w-0 flex-1 truncate font-mono ${
            muted ? "text-[10px] text-[#8B7F75]" : "text-[11px] text-[#6B6560]"
          }`}
        >
          {display(url)}
        </span>
        <span
          className={`shrink-0 font-bold ${muted ? "text-[10px]" : "text-[11px]"} ${
            copied
              ? "text-emerald-600"
              : muted
                ? "text-[#6B6560]"
                : "text-[#2D5A3D]"
          }`}
        >
          {copied ? "✓ 복사됨" : "복사"}
        </span>
      </button>

      {/* 노란 공유 버튼은 초대장에만 — 이 화면에서 눌러야 할 것은 초대장이다. */}
      {canShare && !muted && (
        <button
          type="button"
          onClick={onShare}
          className="inline-flex shrink-0 items-center gap-1 rounded-xl bg-yellow-400 px-3 py-2 text-xs font-bold text-yellow-900 transition hover:bg-yellow-500"
        >
          <span aria-hidden>💬</span>
          공유
        </button>
      )}
      {canShare && muted && (
        <button
          type="button"
          onClick={onShare}
          title="공유"
          aria-label="공유"
          className="inline-flex shrink-0 items-center rounded-xl border border-[#E8DDC8] bg-white/60 px-2 py-1.5 text-[11px] text-[#8B7F75] transition hover:text-[#2D5A3D]"
        >
          <span aria-hidden>💬</span>
        </button>
      )}
      {qr}
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        title="새 탭에서 미리보기"
        aria-label="새 탭에서 미리보기"
        className={`inline-flex shrink-0 items-center rounded-xl border transition ${
          muted
            ? "border-[#E8DDC8] bg-white/60 px-2 py-1.5 text-[11px] text-[#8B7F75] hover:text-[#2D5A3D]"
            : "border-[#D4E4BC] bg-white px-2.5 py-2 text-xs font-bold text-[#6B6560] hover:bg-[#F5F1E8] hover:text-[#2D5A3D]"
        }`}
      >
        <span aria-hidden>🔗</span>
      </a>
    </div>
  );
}

/** "toriro.app/invitation/3d1d9ea8…" — 어느 링크인지 알아볼 만큼만. */
function display(url: string): string {
  try {
    const u = new URL(url);
    const path = u.pathname + u.search;
    const short = path.length > 34 ? `${path.slice(0, 33)}…` : path;
    return `${u.host}${short}`;
  } catch {
    return url;
  }
}
