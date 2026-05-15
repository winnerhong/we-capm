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

async function safeQuery<T>(
  label: string,
  fn: () => Promise<T>,
  fallback: T
): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    console.error(`[org-toritalk-chat/${label}] threw`, e);
    return fallback;
  }
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

  const room = await safeQuery("loadRoom", () => loadRoom(roomId), null);
  if (!room || room.org_id !== orgId) notFound();

  const [initialMessages, orgName] = await Promise.all([
    safeQuery("loadRoomMessages", () => loadRoomMessages(roomId, 200), []),
    safeQuery("loadOrgName", () => loadOrgName(orgId), "기관"),
  ]);

  return (
    <ChatRoomView
      roomId={roomId}
      roomName={room.name}
      mode="admin"
      orgId={orgId}
      orgName={orgName}
      backHref={`/org/${orgId}/toritalk/${roomId}`}
      initialMessages={initialMessages}
    />
  );
}
