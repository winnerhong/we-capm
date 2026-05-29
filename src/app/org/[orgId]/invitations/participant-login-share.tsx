"use client";

// 기관 단위 "참가자 로그인 공유" 카드 — /user-login?org=<orgId> 링크를 복사/공유.
//   초대장과 달리 발행 토글이 없고, 항상 활성. 로그인 페이지가 이 기관의
//   LIVE 행사만 노출하므로 다른 기관 행사는 새지 않는다.

import { useEffect, useState } from "react";
import { InvitationQrButton } from "@/components/invitation-qr-button";

type Props = {
  orgId: string;
  orgName: string;
};

export function ParticipantLoginShare({ orgId, orgName }: Props) {
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const url = origin
    ? `${origin}/user-login?org=${orgId}`
    : `/user-login?org=${orgId}`;

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

  function onShare() {
    if (!navigator.share) {
      onCopy();
      return;
    }
    navigator
      .share({
        title: `${orgName} — 참가자 로그인`,
        text: `${orgName} 행사에 참여하시려면 로그인해 주세요 📲`,
        url,
      })
      .catch(() => {});
  }

  return (
    <section className="rounded-3xl border-2 border-sky-200 bg-gradient-to-br from-sky-50/50 via-white to-[#E8F0E4]/40 p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="flex items-center gap-2 text-sm font-bold text-[#2D5A3D]">
            <span aria-hidden>📲</span>
            <span>참가자 로그인 공유</span>
            <span className="inline-flex items-center gap-1 rounded-full border border-sky-300 bg-sky-50 px-2 py-0.5 text-[10px] font-bold text-sky-800">
              🏫 {orgName}
            </span>
          </h3>
          <p className="mt-1 text-[11px] text-[#6B6560]">
            받은 사람이 클릭 → 로그인 → 이 기관에서 <b>진행 중인 행사</b>만
            보여요. 다른 기관 행사는 노출되지 않습니다.
          </p>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        <div className="flex items-stretch gap-2">
          <input
            readOnly
            value={url}
            onFocus={(e) => e.currentTarget.select()}
            className="flex-1 rounded-lg border border-[#D4E4BC] bg-[#FFF8F0] px-3 py-2 text-xs text-[#2D5A3D] focus:border-[#2D5A3D] focus:outline-none"
          />
          <button
            type="button"
            onClick={onCopy}
            className="shrink-0 rounded-lg bg-[#2D5A3D] px-3 py-2 text-xs font-bold text-white hover:bg-[#234a30]"
          >
            {copied ? "✓ 복사됨" : "📋 복사"}
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onShare}
            className="inline-flex items-center gap-1.5 rounded-xl bg-yellow-400 px-3 py-2 text-xs font-bold text-yellow-900 shadow-sm hover:bg-yellow-500"
          >
            <span aria-hidden>💬</span>
            <span>카톡으로 공유</span>
          </button>
          <InvitationQrButton url={url} eventName={`${orgName}_참가자로그인`} />
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-xl border border-[#D4E4BC] bg-white px-3 py-2 text-xs font-bold text-[#2D5A3D] hover:bg-[#F5F1E8]"
          >
            <span aria-hidden>🔗</span>
            <span>새 탭에서 미리보기</span>
          </a>
        </div>
      </div>
    </section>
  );
}
