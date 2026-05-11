"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addRoomMembersAction,
  removeRoomMemberAction,
} from "@/lib/toritalk/actions";

type Member = {
  user_id: string;
  parent_name: string;
  profile_photo_url: string | null;
  enrolled_child_name?: string | null;
};

type Candidate = {
  id: string;
  parent_name: string;
  phone: string;
  profile_photo_url: string | null;
  enrolled_child_name?: string | null;
};

export function RoomMembersPanel({
  roomId,
  maxMembers,
  members,
  candidates,
}: {
  orgId: string;
  roomId: string;
  maxMembers: number;
  members: Array<Member & { joined_at?: string }>;
  candidates: Candidate[];
}) {
  const router = useRouter();
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [keyword, setKeyword] = useState("");
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(
    null
  );

  const slotsLeft = Math.max(0, maxMembers - members.length);

  const filtered = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    if (!kw) return candidates;
    return candidates.filter(
      (c) =>
        c.parent_name.toLowerCase().includes(kw) ||
        c.phone.toLowerCase().includes(kw)
    );
  }, [keyword, candidates]);

  const togglePick = (id: string) => {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const addPicked = () => {
    if (picked.size === 0) return;
    setMsg(null);
    startTransition(async () => {
      try {
        const ids = Array.from(picked);
        const r = await addRoomMembersAction(roomId, ids);
        setPicked(new Set());
        const parts: string[] = [];
        if (r.added) parts.push(`${r.added}명 추가`);
        if (r.skipped) parts.push(`${r.skipped}명 이미 있음`);
        if (r.overflowed) parts.push(`${r.overflowed}명 정원 초과로 제외`);
        setMsg({ kind: "ok", text: parts.join(" · ") || "변경 없음" });
        router.refresh();
      } catch (err) {
        setMsg({
          kind: "err",
          text: err instanceof Error ? err.message : "추가 실패",
        });
      }
    });
  };

  const remove = (userId: string, name: string) => {
    if (!confirm(`${name} 님을 방에서 내보낼까요?`)) return;
    setMsg(null);
    startTransition(async () => {
      try {
        await removeRoomMemberAction(roomId, userId);
        router.refresh();
      } catch (err) {
        setMsg({
          kind: "err",
          text: err instanceof Error ? err.message : "내보내기 실패",
        });
      }
    });
  };

  return (
    <section className="space-y-4 rounded-2xl border-2 border-[#D4E4BC] bg-white p-5 shadow-sm">
      <h2 className="text-base font-bold text-[#2D5A3D]">
        멤버 ({members.length}/{maxMembers}명)
      </h2>

      {/* 현재 멤버 */}
      {members.length === 0 ? (
        <p className="rounded-xl bg-[#FFF8F0] px-3 py-3 text-xs text-[#6B6560]">
          아직 멤버가 없어요. 아래에서 참가자를 선택해 추가하세요.
        </p>
      ) : (
        <ul className="grid gap-2 md:grid-cols-2">
          {members.map((m) => (
            <li
              key={m.user_id}
              className="flex items-center gap-3 rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] px-3 py-2"
            >
              <Avatar
                letter={m.enrolled_child_name ?? m.parent_name}
                photoUrl={m.profile_photo_url}
              />
              <span className="flex-1 truncate text-sm font-semibold text-[#2D5A3D]">
                {m.enrolled_child_name
                  ? `${m.enrolled_child_name} 학부모`
                  : m.parent_name}
              </span>
              <button
                type="button"
                onClick={() => remove(m.user_id, m.parent_name)}
                disabled={pending}
                className="rounded-lg border border-rose-200 bg-white px-2 py-1 text-[11px] font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50"
              >
                내보내기
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* 멤버 추가 */}
      <div className="space-y-3 border-t border-[#D4E4BC] pt-4">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-bold text-[#2D5A3D]">
            참가자 추가 (정원 남은 자리 {slotsLeft})
          </h3>
          <input
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="이름·전화 검색"
            className="ml-auto w-44 rounded-xl border-2 border-[#D4E4BC] bg-[#FFF8F0] px-3 py-1.5 text-xs focus:border-[#2D5A3D] focus:outline-none"
          />
        </div>

        {candidates.length === 0 ? (
          <p className="rounded-xl bg-[#FFF8F0] px-3 py-3 text-xs text-[#6B6560]">
            추가할 수 있는 참가자가 없어요 (모두 이 방에 있거나 가입자가 없음).
          </p>
        ) : (
          <>
            <ul className="max-h-72 overflow-y-auto rounded-xl border border-[#D4E4BC] bg-[#FFF8F0]">
              {filtered.length === 0 ? (
                <li className="px-3 py-3 text-xs text-[#6B6560]">
                  검색 결과 없음
                </li>
              ) : (
                filtered.map((c) => {
                  const checked = picked.has(c.id);
                  return (
                    <li key={c.id}>
                      <label
                        className={`flex cursor-pointer items-center gap-3 border-b border-[#D4E4BC]/60 px-3 py-2 last:border-b-0 ${
                          checked ? "bg-[#E8F0E4]" : "hover:bg-white"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => togglePick(c.id)}
                          className="h-4 w-4 accent-[#2D5A3D]"
                        />
                        <Avatar
                          letter={c.enrolled_child_name ?? c.parent_name}
                          photoUrl={c.profile_photo_url}
                        />
                        <span className="flex-1 truncate text-sm font-semibold text-[#2C2C2C]">
                          {c.enrolled_child_name
                            ? `${c.enrolled_child_name} 학부모`
                            : c.parent_name}
                        </span>
                        <span className="text-[11px] text-[#8B7F75]">
                          {c.phone}
                        </span>
                      </label>
                    </li>
                  );
                })
              )}
            </ul>
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-[#6B6560]">
                선택: <b className="text-[#2D5A3D]">{picked.size}</b>명
                {picked.size > slotsLeft && (
                  <span className="ml-2 text-rose-700">
                    ⚠ 정원 초과 {picked.size - slotsLeft}명은 추가되지 않아요
                  </span>
                )}
              </p>
              <button
                type="button"
                onClick={addPicked}
                disabled={pending || picked.size === 0}
                className="rounded-xl bg-[#2D5A3D] px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-[#264C33] disabled:opacity-50"
              >
                {pending
                  ? "추가 중..."
                  : `${picked.size}명 추가`}
              </button>
            </div>
          </>
        )}
      </div>

      {msg && (
        <p
          className={`text-xs ${
            msg.kind === "ok" ? "text-emerald-700" : "text-rose-700"
          }`}
          role={msg.kind === "err" ? "alert" : "status"}
        >
          {msg.kind === "ok" ? "✅" : "⚠"} {msg.text}
        </p>
      )}
    </section>
  );
}

function Avatar({
  letter,
  photoUrl,
}: {
  /** 표시할 글자 — 원생 이름 우선, fallback parent 이름. */
  letter: string;
  photoUrl: string | null;
}) {
  if (photoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={photoUrl}
        alt=""
        className="h-8 w-8 shrink-0 rounded-full object-cover"
      />
    );
  }
  const ch = (letter?.trim().charAt(0) || "🌱").slice(0, 1);
  return (
    <span
      aria-hidden
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#3A7A52] to-[#4A7C59] text-xs font-bold text-white"
    >
      {ch}
    </span>
  );
}
