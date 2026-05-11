"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  archiveRoomAction,
  deleteRoomAction,
  updateRoomAction,
} from "@/lib/toritalk/actions";

export function RoomEditForm({
  orgId,
  roomId,
  initialName,
  initialDescription,
  initialMaxMembers,
  initialIsListed,
  initialAllowSelfJoin,
  archived,
}: {
  orgId: string;
  roomId: string;
  initialName: string;
  initialDescription: string;
  initialMaxMembers: number;
  initialIsListed: boolean;
  initialAllowSelfJoin: boolean;
  archived: boolean;
}) {
  const router = useRouter();
  // 모든 controlled value 를 명시적으로 coerce — DB 컬럼이 누락된 경우(마이그레이션
  // 미실행 등)에 undefined 가 들어와 input 이 uncontrolled→controlled 로 바뀌는
  // React 경고 방지.
  const [name, setName] = useState(initialName ?? "");
  const [description, setDescription] = useState(initialDescription ?? "");
  const [maxMembers, setMaxMembers] = useState(
    Number.isFinite(initialMaxMembers) ? initialMaxMembers : 35
  );
  const [isListed, setIsListed] = useState(initialIsListed ?? true);
  const [allowSelfJoin, setAllowSelfJoin] = useState(
    initialAllowSelfJoin ?? false
  );
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(
    null
  );

  // 노출 안 하면 셀프 입장도 자동 해제 (의미 모순)
  const handleIsListedChange = (next: boolean) => {
    setIsListed(next);
    if (!next) setAllowSelfJoin(false);
  };

  const save = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setMsg(null);
    startTransition(async () => {
      try {
        const fd = new FormData();
        fd.set("name", name);
        fd.set("description", description);
        fd.set("max_members", String(maxMembers));
        if (isListed) fd.set("is_listed", "1");
        if (allowSelfJoin && isListed) fd.set("allow_self_join", "1");
        await updateRoomAction(roomId, fd);
        setMsg({ kind: "ok", text: "저장됐어요" });
      } catch (err) {
        setMsg({
          kind: "err",
          text: err instanceof Error ? err.message : "저장 실패",
        });
      }
    });
  };

  const toggleArchive = () => {
    setMsg(null);
    startTransition(async () => {
      try {
        await archiveRoomAction(roomId, !archived);
        router.refresh();
      } catch (err) {
        setMsg({
          kind: "err",
          text: err instanceof Error ? err.message : "변경 실패",
        });
      }
    });
  };

  const remove = () => {
    if (
      !confirm(
        "정말 이 방을 삭제할까요? 모든 메시지·멤버 정보가 함께 삭제됩니다."
      )
    )
      return;
    setMsg(null);
    startTransition(async () => {
      try {
        await deleteRoomAction(roomId);
        router.push(`/org/${orgId}/toritalk`);
      } catch (err) {
        setMsg({
          kind: "err",
          text: err instanceof Error ? err.message : "삭제 실패",
        });
      }
    });
  };

  return (
    <section className="rounded-2xl border-2 border-[#D4E4BC] bg-white p-5 shadow-sm">
      <h2 className="text-base font-bold text-[#2D5A3D]">방 설정</h2>
      <form onSubmit={save} className="mt-4 space-y-3">
        <div>
          <label className="block text-xs font-semibold text-[#6B6560]">
            방 이름
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={60}
            required
            className="mt-1 w-full rounded-xl border-2 border-[#D4E4BC] bg-[#FFF8F0] px-3 py-2 text-sm focus:border-[#2D5A3D] focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-[#6B6560]">
            설명 (선택)
          </label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={200}
            className="mt-1 w-full rounded-xl border-2 border-[#D4E4BC] bg-[#FFF8F0] px-3 py-2 text-sm focus:border-[#2D5A3D] focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-[#6B6560]">
            정원 (최대 200명)
          </label>
          <input
            type="number"
            value={maxMembers}
            onChange={(e) =>
              setMaxMembers(Number(e.target.value) || 35)
            }
            min={2}
            max={200}
            className="mt-1 w-32 rounded-xl border-2 border-[#D4E4BC] bg-[#FFF8F0] px-3 py-2 text-center text-sm tabular-nums focus:border-[#2D5A3D] focus:outline-none"
          />
          <p className="mt-1 text-[11px] text-[#8B7F75]">
            기본 35명. Supabase Realtime fanout 부담 때문에 너무 크게 하지
            않는 게 좋아요.
          </p>
        </div>

        {/* 공개 정책 ─ 두 토글 */}
        <div className="space-y-2 rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] p-3">
          <p className="text-xs font-bold text-[#2D5A3D]">🔧 공개 정책</p>

          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={isListed}
              onChange={(e) => handleIsListedChange(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-[#2D5A3D]"
            />
            <span className="flex-1">
              <span className="text-sm font-semibold text-[#2D5A3D]">
                🔍 다른 반에 노출
              </span>
              <span className="block text-[11px] text-[#6B6560]">
                꺼두면 멤버만 알고 있는 비공개 방. 다른 반 사용자의
                &quot;다른 방 둘러보기&quot;에 나타나지 않아요.
              </span>
            </span>
          </label>

          <label
            className={`flex items-start gap-3 ${
              isListed ? "cursor-pointer" : "cursor-not-allowed opacity-50"
            }`}
          >
            <input
              type="checkbox"
              checked={allowSelfJoin}
              disabled={!isListed}
              onChange={(e) => setAllowSelfJoin(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-[#2D5A3D]"
            />
            <span className="flex-1">
              <span className="text-sm font-semibold text-[#2D5A3D]">
                🚪 셀프 입장 허용
              </span>
              <span className="block text-[11px] text-[#6B6560]">
                켜면 누구나 목록에서 직접 입장할 수 있어요. 꺼두면 기관
                admin 초대만 가입 가능 (기본).
              </span>
            </span>
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-2">
          <button
            type="submit"
            disabled={pending}
            className="rounded-xl bg-[#2D5A3D] px-5 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-[#264C33] disabled:opacity-50"
          >
            {pending ? "저장 중..." : "💾 저장"}
          </button>
          <button
            type="button"
            onClick={toggleArchive}
            disabled={pending}
            className="rounded-xl border border-[#D4E4BC] bg-white px-4 py-2 text-sm font-semibold text-[#6B6560] transition hover:bg-[#FFF8F0] disabled:opacity-50"
          >
            {archived ? "📤 보관 해제" : "📦 보관"}
          </button>
          <button
            type="button"
            onClick={remove}
            disabled={pending}
            className="ml-auto rounded-xl border border-rose-300 bg-white px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-50 disabled:opacity-50"
          >
            🗑️ 삭제
          </button>
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
      </form>
    </section>
  );
}
