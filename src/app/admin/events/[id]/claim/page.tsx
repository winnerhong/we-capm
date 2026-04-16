"use client";

import { useState, useTransition, use } from "react";
import Link from "next/link";
import { claimRewardAction } from "./actions";

export default function ClaimPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: eventId } = use(params);
  const [participantPhone, setParticipantPhone] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [claims, setClaims] = useState<{ rewardName: string; status: string }[]>([]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setResult(null);
    setClaims([]);

    startTransition(async () => {
      try {
        const res = await claimRewardAction(eventId, participantPhone.replace(/\D/g, ""), "search");
        if (!res.ok) {
          setError(res.message ?? "검색 실패");
          return;
        }
        setClaims(res.claims ?? []);
        setResult(res.participantName ?? "참가자");
      } catch (err) {
        setError(err instanceof Error ? err.message : "오류");
      }
    });
  };

  const handleClaim = (rewardName: string) => {
    startTransition(async () => {
      try {
        const res = await claimRewardAction(eventId, participantPhone.replace(/\D/g, ""), "claim");
        if (!res.ok) {
          setError(res.message ?? "수령 처리 실패");
          return;
        }
        setResult(`${rewardName} 수령 완료`);
        setClaims((prev) =>
          prev.map((c) => (c.rewardName === rewardName ? { ...c, status: "CLAIMED" } : c))
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "오류");
      }
    });
  };

  return (
    <div className="mx-auto max-w-lg space-y-4 p-4">
      <Link href={`/admin/events/${eventId}`} className="text-sm hover:underline">← 행사 상세</Link>
      <h1 className="text-2xl font-bold">보상 수령 처리</h1>
      <p className="text-sm">참가자 전화번호를 입력하면 획득한 보상 목록이 표시됩니다.</p>

      <form onSubmit={handleSearch} className="flex gap-2">
        <input
          type="tel"
          value={participantPhone}
          onChange={(e) => setParticipantPhone(e.target.value)}
          placeholder="참가자 전화번호"
          className="flex-1 rounded-lg border px-3 py-2"
          required
        />
        <button type="submit" disabled={pending}
          className="rounded-lg bg-violet-600 px-4 py-2 font-semibold text-white hover:bg-violet-700 disabled:opacity-50">
          검색
        </button>
      </form>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {result && (
        <div className="rounded-lg border bg-white p-4">
          <div className="mb-3 font-semibold">{result}님의 보상</div>
          {claims.length > 0 ? (
            <ul className="space-y-2">
              {claims.map((c, i) => (
                <li key={i} className="flex items-center justify-between rounded border p-3">
                  <span>{c.rewardName}</span>
                  {c.status === "CLAIMED" ? (
                    <span className="rounded-full bg-neutral-200 px-2 py-0.5 text-xs">수령 완료</span>
                  ) : (
                    <button
                      onClick={() => handleClaim(c.rewardName)}
                      disabled={pending}
                      className="rounded-lg bg-green-600 px-3 py-1 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                    >
                      수령 처리
                    </button>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm">획득한 보상이 없습니다</p>
          )}
        </div>
      )}
    </div>
  );
}
