"use server";

import { requireAdmin } from "@/lib/auth-guard";
import { createClient } from "@/lib/supabase/server";

interface Recipient {
  name: string;
  phone: string;
  eventName?: string;
}

export type BroadcastResult = {
  ok: boolean;
  sent: number;
  failed: number;
  message?: string;
};

export async function sendBroadcastAction(formData: FormData): Promise<BroadcastResult> {
  await requireAdmin();
  const supabase = await createClient();

  const target = String(formData.get("target") ?? "ALL");
  const eventId = String(formData.get("event_id") ?? "");
  const customPhones = String(formData.get("custom_phones") ?? "");
  const messageType = String(formData.get("message_type") ?? "SMS");
  const subject = String(formData.get("subject") ?? "");
  const body = String(formData.get("body") ?? "");

  // Validate
  if (!body.trim()) {
    return { ok: false, sent: 0, failed: 0, message: "메시지 본문을 입력해주세요" };
  }

  // Resolve recipients
  const recipients: Recipient[] = [];

  if (target === "ALL") {
    const { data } = await supabase.from("participants").select("phone");
    if (data) {
      recipients.push(
        ...data
          .map((d) => ({ name: "참가자", phone: d.phone ?? "" }))
          .filter((r) => r.phone)
      );
    }
  } else if (target === "EVENT" && eventId) {
    const { data: event } = await supabase
      .from("events")
      .select("name")
      .eq("id", eventId)
      .single();
    const { data: parts } = await supabase
      .from("participants")
      .select("phone")
      .eq("event_id", eventId);
    if (parts) {
      recipients.push(
        ...parts
          .map((d) => ({
            name: "참가자",
            phone: d.phone ?? "",
            eventName: event?.name,
          }))
          .filter((r) => r.phone)
      );
    }
  } else if (target === "MANAGER") {
    // Managers are in the events table as manager_id (username), no phone column.
    // For MVP: log an empty run — real impl would have a managers table with phone.
    // Stub: no recipients for now.
  } else if (target === "CUSTOM") {
    const phones = customPhones
      .split(/[,\n]/)
      .map((p) => p.trim())
      .filter(Boolean);
    recipients.push(...phones.map((p) => ({ name: "수신자", phone: p })));
  }

  // MOCK: log instead of actually sending
  console.log(
    `[BROADCAST] type=${messageType} target=${target} recipients=${recipients.length} subject="${subject}" body="${body.slice(0, 80)}..."`
  );

  // In real impl: iterate recipients and call sendOtpSms-style helper per user.
  // For now: pretend all succeeded.
  return {
    ok: true,
    sent: recipients.length,
    failed: 0,
    message:
      recipients.length === 0
        ? "수신자가 없습니다. 대상을 확인해주세요."
        : `${recipients.length}건 발송 완료 (MOCK)`,
  };
}
