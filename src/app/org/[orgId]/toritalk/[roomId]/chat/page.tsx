import { notFound, redirect } from "next/navigation";
import { requireOrg } from "@/lib/org-auth-guard";
import { loadRoom, loadRoomMessages } from "@/lib/toritalk/queries";
import { createClient } from "@/lib/supabase/server";
import { ChatRoomView } from "@/components/toritalk/chat-room-view";

export const dynamic = "force-dynamic";

async function loadOrgName(orgId: string): Promise<string> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("partner_orgs")
    .select("org_name")
    .eq("id", orgId)
    .maybeSingle();
  return (data as { org_name?: string } | null)?.org_name ?? "기관";
}

export default async function OrgToritalkAdminChatPage({
  params,
}: {
  params: Promise<{ orgId: string; roomId: string }>;
}) {
  const { orgId, roomId } = await params;
  const org = await requireOrg();
  if (org.orgId !== orgId)
    redirect(`/org/${org.orgId}/toritalk/${roomId}/chat`);

  const room = await loadRoom(roomId);
  if (!room || room.org_id !== orgId) notFound();

  const [initialMessages, orgName] = await Promise.all([
    loadRoomMessages(roomId, 200),
    loadOrgName(orgId),
  ]);

  return (
    <div className="-mx-4 -my-4">
      <ChatRoomView
        roomId={roomId}
        roomName={room.name}
        mode="admin"
        orgId={orgId}
        orgName={orgName}
        backHref={`/org/${orgId}/toritalk/${roomId}`}
        initialMessages={initialMessages}
      />
    </div>
  );
}
