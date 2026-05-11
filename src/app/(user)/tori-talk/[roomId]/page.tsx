import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireAppUser } from "@/lib/user-auth-guard";
import {
  isRoomMember,
  isToritalkEnabled,
  loadRoom,
  loadRoomMessages,
} from "@/lib/toritalk/queries";
import { loadChildrenForUser } from "@/lib/app-user/queries";
import { ChatRoomView } from "@/components/toritalk/chat-room-view";

export const dynamic = "force-dynamic";

export default async function ToriTalkRoomPage({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const { roomId } = await params;
  const user = await requireAppUser();

  const enabled = await isToritalkEnabled(user.orgId);
  if (!enabled) redirect("/tori-talk");

  const room = await loadRoom(roomId);
  if (!room || room.org_id !== user.orgId) notFound();

  const isMember = await isRoomMember(roomId, user.id);
  if (!isMember) {
    return (
      <div className="space-y-4">
        <section className="rounded-3xl border-2 border-dashed border-rose-200 bg-rose-50 p-8 text-center shadow-sm">
          <p className="text-4xl" aria-hidden>
            🚪
          </p>
          <p className="mt-3 text-base font-bold text-rose-800">
            이 방의 멤버가 아니에요
          </p>
          <p className="mt-2 text-xs text-rose-700">
            기관에서 방에 초대받으면 입장할 수 있어요.
          </p>
          <Link
            href="/tori-talk"
            className="mt-5 inline-flex rounded-xl bg-rose-700 px-4 py-2 text-sm font-bold text-white"
          >
            ← 토리톡으로
          </Link>
        </section>
      </div>
    );
  }

  const [initialMessages, kids] = await Promise.all([
    loadRoomMessages(roomId, 100),
    loadChildrenForUser(user.id),
  ]);

  // 본인 아바타 글자: 원생(is_enrolled=true) 첫 이름 첫 글자 우선, fallback parent
  const meDisplayLetter = (() => {
    const enrolled = kids.find((c) => c.is_enrolled && c.name?.trim());
    if (enrolled) return enrolled.name.trim().charAt(0);
    const anyChild = kids.find((c) => c.name?.trim());
    if (anyChild) return anyChild.name.trim().charAt(0);
    return user.parentName?.trim().charAt(0) ?? null;
  })();

  return (
    <div className="-mx-4 -my-4 -mb-24">
      <ChatRoomView
        roomId={roomId}
        roomName={room.name}
        mode="user"
        meUserId={user.id}
        meName={user.parentName}
        meDisplayLetter={meDisplayLetter}
        backHref="/tori-talk"
        initialMessages={initialMessages}
      />
    </div>
  );
}
