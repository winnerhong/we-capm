"use client";

// 초대장 상태 카드의 [참가 취소].
//
// 상태 카드는 서버 컴포넌트라 여기만 클라이언트로 뗀다.
//
// 실수 클릭을 막으려고 두 단계로 둔다:
//   1) 텍스트 링크 톤의 "참가 취소" — 눈에 띄되 손이 먼저 가지 않게
//   2) 펼쳐지는 확인 영역 + 사유 한 줄(선택) → [취소하기]
// window.confirm 을 쓰지 않는 이유: 사유를 같이 받아야 하고, 승인 취소는
// 결과가 무거워서 무엇이 일어나는지 문장으로 보여주는 편이 낫다.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cancelMyApplicationAction } from "@/lib/org-events/application-actions";

export function CancelApplicationButton({
  eventId,
  /** 승인된 참가인지 — 문구가 달라진다. */
  approved,
}: {
  eventId: string;
  approved: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await cancelMyApplicationAction(eventId, reason);
      if (!res.ok) {
        setError(res.message);
        return;
      }
      // 서버가 그린 상태 카드를 다시 받아야 "취소됨" 으로 바뀐다.
      router.refresh();
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-4 w-full text-center text-[11px] font-semibold text-[#8B7F75] underline underline-offset-2 transition hover:text-rose-700"
      >
        참가 취소
      </button>
    );
  }

  return (
    <div className="mt-4 rounded-2xl border border-rose-200 bg-white/80 p-4 text-left">
      <p className="text-sm font-bold text-rose-800">참가를 취소할까요?</p>
      <p className="mt-1 text-xs leading-relaxed text-[#6B6560]">
        {approved
          ? "승인된 참가가 취소되고 참가자 명단에서 빠집니다."
          : "신청이 취소됩니다."}{" "}
        다시 오시려면 신청서를 새로 내시면 돼요.
      </p>

      <input
        type="text"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="사유를 적어주시면 준비에 도움이 돼요 (선택)"
        maxLength={200}
        disabled={pending}
        aria-label="취소 사유 (선택)"
        className="mt-3 w-full rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] px-3 py-2.5 text-sm text-[#2D5A3D] outline-none placeholder:text-[#8B7F75] focus:border-[#3A7A52] disabled:opacity-50"
      />

      {error && (
        <p
          role="alert"
          className="mt-2 text-xs font-semibold leading-relaxed text-rose-700"
        >
          {error}
        </p>
      )}

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={pending}
          className="min-h-[44px] flex-1 rounded-xl bg-rose-600 text-sm font-bold text-white transition hover:bg-rose-700 disabled:opacity-60"
        >
          {pending ? "처리 중..." : "네, 취소할게요"}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setError(null);
          }}
          disabled={pending}
          className="min-h-[44px] flex-1 rounded-xl border border-[#D4E4BC] bg-white text-sm font-bold text-[#2D5A3D] transition hover:bg-[#F5F1E8] disabled:opacity-60"
        >
          아니요
        </button>
      </div>
    </div>
  );
}
