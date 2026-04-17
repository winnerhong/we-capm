"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { enterChatByNameAction } from "./actions";

export function NameEntryForm({ eventId, eventName }: { eventId: string; eventName: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [phoneLast4, setPhoneLast4] = useState("");
  const [needPhone, setNeedPhone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await enterChatByNameAction(eventId, name, needPhone ? phoneLast4 : undefined);
      if (!result.ok) {
        if (result.needPhone) {
          setNeedPhone(true);
          setError(null);
          return;
        }
        setError(result.message ?? "입장 실패");
        return;
      }
      router.refresh();
    });
  };

  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-6">
        <div className="space-y-2 text-center">
          <p className="text-sm">채팅 입장</p>
          <h1 className="text-2xl font-bold">{eventName}</h1>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">이름</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="등록된 이름을 입력하세요"
            className="w-full rounded-2xl border px-4 py-3 text-base outline-none focus:ring-2 focus:ring-violet-500"
            autoFocus
            required
          />
        </div>

        {needPhone && (
          <div className="space-y-2">
            <label className="text-sm font-medium">전화번호 뒷 4자리</label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={4}
              value={phoneLast4}
              onChange={(e) => setPhoneLast4(e.target.value.replace(/\D/g, ""))}
              placeholder="0000"
              className="w-full rounded-2xl border px-4 py-3 text-center text-2xl tracking-widest outline-none focus:ring-2 focus:ring-violet-500"
              autoFocus
              required
            />
            <p className="text-xs text-center">같은 이름이 있어 본인 확인이 필요합니다</p>
          </div>
        )}

        {error && <p className="text-sm text-center text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-2xl bg-violet-600 py-3 font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
        >
          {pending ? "확인 중..." : "입장하기"}
        </button>
      </form>
    </main>
  );
}
