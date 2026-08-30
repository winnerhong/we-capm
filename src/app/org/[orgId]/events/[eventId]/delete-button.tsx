"use client";

import { useState } from "react";

/**
 * 서버 폼 안에 두고 confirm 으로 한 번 더 묻는 삭제 버튼.
 * 사용자가 확인을 눌러야만 submit 이 실제 실행됨.
 */
export function DeleteEventButton({ eventName }: { eventName: string }) {
  const [loading, setLoading] = useState(false);

  return (
    <button
      type="submit"
      disabled={loading}
      onClick={(e) => {
        // 결과를 여기서 다 말한다 — 화면의 빨간 상자에는 같은 문장을 두지 않는다.
        // 결정하는 순간에 한 번만 읽히면 되고, 평소엔 자리만 차지한다.
        const ok = confirm(
          `"${eventName}" 행사를 정말 삭제할까요?\n\n연결된 스탬프북·참가자 관계가 모두 풀리고 되돌릴 수 없어요.\n(스탬프북·참가자 자체는 기관에 남습니다)`
        );
        if (!ok) {
          e.preventDefault();
          return;
        }
        setLoading(true);
      }}
      className="inline-flex items-center gap-1.5 rounded-xl border border-rose-300 bg-white px-4 py-2 text-xs font-bold text-rose-700 shadow-sm hover:bg-rose-100 disabled:opacity-60"
    >
      <span aria-hidden>🗑</span>
      <span>{loading ? "삭제 중..." : "이 행사 삭제"}</span>
    </button>
  );
}
