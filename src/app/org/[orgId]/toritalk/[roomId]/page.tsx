import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireOrg } from "@/lib/org-auth-guard";
import {
  loadOrgAppUsers,
  loadRoom,
  loadRoomMembersWithProfile,
  loadRoomMessages,
} from "@/lib/toritalk/queries";
import { loadOrgNameById } from "@/lib/org-partner";
import { fmtFullDateKst } from "@/lib/datetime/kst";
import { ChatRoomView } from "@/components/toritalk/chat-room-view";
import { RoomEditForm } from "./room-edit-form";
import { RoomMembersPanel } from "./room-members-panel";

export const dynamic = "force-dynamic";

export default async function OrgToritalkRoomDetailPage({
  params,
}: {
  params: Promise<{ orgId: string; roomId: string }>;
}) {
  const { orgId, roomId } = await params;
  const org = await requireOrg();
  if (org.orgId !== orgId) redirect(`/org/${org.orgId}/toritalk`);

  const room = await loadRoom(roomId);
  if (!room || room.org_id !== orgId) notFound();

  const [members, allOrgUsers, initialMessages, orgName] = await Promise.all([
    loadRoomMembersWithProfile(roomId),
    loadOrgAppUsers(orgId),
    loadRoomMessages(roomId, 200),
    loadOrgNameById(orgId, "기관"),
  ]);

  const memberIdSet = new Set(members.map((m) => m.user_id));
  const candidates = allOrgUsers.filter((u) => !memberIdSet.has(u.id));

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6">
      <nav className="flex items-center gap-2 text-xs text-[#6B6560]">
        <Link href={`/org/${orgId}/toritalk`} className="hover:underline">
          토리톡 관리
        </Link>
        <span>›</span>
        <span className="font-semibold text-[#2D5A3D]">{room.name}</span>
      </nav>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-[#2D5A3D]">💬 {room.name}</h1>
          <p className="mt-1 text-xs text-[#8B7F75]">
            생성: {fmtFullDateKst(room.created_at)} · 정원 {room.max_members}명 ·
            현재 {members.length}명
          </p>
          {/* 정책 칩 (undefined → default true/false) */}
          <div className="mt-2 flex flex-wrap gap-1">
            {(room.is_listed ?? true) ? (
              <span className="rounded-full bg-[#E8F0E4] px-2 py-0.5 text-[10px] font-bold text-[#2D5A3D]">
                🔍 노출
              </span>
            ) : (
              <span className="rounded-full bg-[#FFF8F0] px-2 py-0.5 text-[10px] font-bold text-[#8B7F75]">
                🔒 비공개
              </span>
            )}
            {(room.allow_self_join ?? false) ? (
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                🚪 셀프 입장 OK
              </span>
            ) : (
              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                🔑 초대 전용
              </span>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {room.archived && (
            <span className="rounded-full bg-[#FFF8F0] px-3 py-1 text-xs font-bold text-[#8B7F75]">
              보관 중
            </span>
          )}
          {!room.archived && (
            <Link
              href={`/org/${orgId}/toritalk/${room.id}/chat`}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#6B4FB2] bg-white px-3 py-2 text-xs font-bold text-[#6B4FB2] shadow-sm transition hover:bg-[#F7F3FB]"
              title="채팅창만 풀스크린으로 보기"
            >
              <span aria-hidden>↗</span>
              <span>풀스크린</span>
            </Link>
          )}
        </div>
      </header>

      {/* 편집 + 보관/삭제 — 정책 컬럼이 마이그레이션 전이면 default 적용 */}
      <RoomEditForm
        orgId={orgId}
        roomId={room.id}
        initialName={room.name}
        initialDescription={room.description ?? ""}
        initialMaxMembers={room.max_members ?? 35}
        initialIsListed={room.is_listed ?? true}
        initialAllowSelfJoin={room.allow_self_join ?? false}
        archived={room.archived}
      />

      {/* 멤버 관리 */}
      <RoomMembersPanel
        orgId={orgId}
        roomId={room.id}
        maxMembers={room.max_members}
        members={members}
        candidates={candidates}
      />

      {/* 채팅창 — 페이지 하단에 임베드 (별도 클릭 없이 바로 보임) */}
      {!room.archived && (
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-[#6B4FB2]">
              📢 채팅·공지 보내기
            </h2>
            <span className="text-[10px] text-[#8B7F75]">
              메시지는 모든 멤버에게 실시간 전달돼요
            </span>
          </div>
          <ChatRoomView
            roomId={room.id}
            roomName={room.name}
            mode="admin"
            orgId={orgId}
            orgName={orgName}
            initialMessages={initialMessages}
            embedded
          />
        </section>
      )}
    </div>
  );
}
