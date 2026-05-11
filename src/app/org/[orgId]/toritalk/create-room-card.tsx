"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createRoomAction } from "@/lib/toritalk/actions";

export function CreateRoomCard({ orgId }: { orgId: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [maxMembers, setMaxMembers] = useState(35);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("방 이름을 입력해 주세요");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        const fd = new FormData();
        fd.set("name", name);
        fd.set("description", description);
        fd.set("max_members", String(maxMembers));
        const roomId = await createRoomAction(fd);
        setName("");
        setDescription("");
        setMaxMembers(35);
        router.push(`/org/${orgId}/toritalk/${roomId}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "방 생성 실패");
      }
    });
  };

  return (
    <section className="rounded-2xl border-2 border-[#D4E4BC] bg-white p-5 shadow-sm">
      <h2 className="text-base font-bold text-[#2D5A3D]">새 방 만들기</h2>
      <p className="mt-1 text-xs text-[#6B6560]">
        예: &quot;토끼반&quot;, &quot;곰반&quot; — 보통 자녀의 반 단위로 만들어요
      </p>
      <form onSubmit={submit} className="mt-4 grid gap-3 md:grid-cols-[1fr,1fr,auto,auto]">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="방 이름 (예: 토끼반)"
          maxLength={60}
          required
          className="rounded-xl border-2 border-[#D4E4BC] bg-[#FFF8F0] px-3 py-2 text-sm text-[#2C2C2C] focus:border-[#2D5A3D] focus:outline-none"
        />
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="설명 (선택)"
          maxLength={200}
          className="rounded-xl border-2 border-[#D4E4BC] bg-[#FFF8F0] px-3 py-2 text-sm text-[#2C2C2C] focus:border-[#2D5A3D] focus:outline-none"
        />
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-[#6B6560]">정원</label>
          <input
            type="number"
            value={maxMembers}
            onChange={(e) => setMaxMembers(Number(e.target.value) || 35)}
            min={2}
            max={200}
            className="w-20 rounded-xl border-2 border-[#D4E4BC] bg-[#FFF8F0] px-2 py-2 text-center text-sm tabular-nums focus:border-[#2D5A3D] focus:outline-none"
          />
        </div>
        <button
          type="submit"
          disabled={pending}
          className="rounded-xl bg-[#2D5A3D] px-5 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-[#264C33] disabled:opacity-50"
        >
          {pending ? "생성 중..." : "+ 방 만들기"}
        </button>
      </form>
      {error && (
        <p className="mt-3 text-xs text-rose-700" role="alert">
          ⚠ {error}
        </p>
      )}
    </section>
  );
}
