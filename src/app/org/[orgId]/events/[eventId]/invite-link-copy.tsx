"use client";

import { useEffect, useState } from "react";

type Props = {
  eventId: string;
  eventName: string;
};

export function InviteLinkCopy({ eventId, eventName }: Props) {
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const url = origin
    ? `${origin}/invitation/${eventId}`
    : `/invitation/${eventId}`;

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      window.prompt("아래 링크를 복사하세요", url);
    }
  }

  async function onShare() {
    if (!navigator.share) {
      onCopy();
      return;
    }
    try {
      await navigator.share({
        title: `${eventName} 초대`,
        text: `${eventName} 행사에 참여해 주세요 🌲`,
        url,
      });
    } catch {
      // 사용자 취소는 무시
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-stretch gap-2">
        <div className="min-w-0 flex-1 truncate rounded-xl border border-[#D4E4BC] bg-white px-3 py-2 text-xs text-[#6B6560]">
          {url}
        </div>
        <button
          type="button"
          onClick={onCopy}
          className="shrink-0 rounded-xl bg-[#2D5A3D] px-3 py-2 text-xs font-bold text-white transition hover:bg-[#234a30]"
          aria-label="참가자 초대 링크 복사"
        >
          <span aria-hidden>{copied ? "✅" : "📋"}</span>
          <span className="ml-1">{copied ? "복사됨" : "복사"}</span>
        </button>
        <button
          type="button"
          onClick={onShare}
          className="shrink-0 rounded-xl border border-[#D4E4BC] bg-white px-3 py-2 text-xs font-bold text-[#2D5A3D] transition hover:bg-[#F5F1E8]"
          aria-label="참가자 초대 링크 공유"
        >
          <span aria-hidden>📤</span>
          <span className="ml-1">공유</span>
        </button>
      </div>
      <p className="text-[11px] text-[#6B6560]">
        💌 참가자가 받은 링크 → 로그인 → 본인 이름이 들어간 초대장 카드를
        받아요. (📨 초대장 공유와 같은 링크)
      </p>
    </div>
  );
}
