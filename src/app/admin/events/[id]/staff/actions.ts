"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { formatKorean } from "@/lib/phone";

export async function addTeacherAction(eventId: string, formData: FormData) {
  const supabase = await createClient();
  const className = String(formData.get("class_name") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const phoneRaw = String(formData.get("phone") ?? "").replace(/\D/g, "");

  if (!name) throw new Error("이름을 입력해주세요");
  if (phoneRaw.length < 10) throw new Error("올바른 전화번호를 입력해주세요");

  const phone = phoneRaw.startsWith("0") ? phoneRaw : `0${phoneRaw}`;
  const label = className ? `[선생님/${className}]` : "[선생님]";

  const { error } = await supabase.from("event_registrations").upsert({
    event_id: eventId,
    phone: formatKorean(phone),
    name: `${label} ${name}`,
    status: "REGISTERED",
  }, { onConflict: "event_id,phone" });

  if (error) throw new Error(error.message);
  revalidatePath(`/admin/events/${eventId}/staff`);
}

export async function uploadTeacherCsvAction(eventId: string, formData: FormData) {
  const supabase = await createClient();
  const csvText = String(formData.get("csv") ?? "");
  if (!csvText.trim()) throw new Error("내용이 비어있습니다");

  const lines = csvText.split("\n").map((l) => l.trim())
    .filter((l) => l && !l.startsWith("이름") && !l.startsWith("선생님") && !l.startsWith("담당"));

  const rows: { name: string; phone: string; className: string }[] = [];
  for (const line of lines) {
    const parts = line.split(/[,\t]/).map((s) => s.trim());
    let className = "", name = "", phoneRaw = "";
    if (parts.length >= 3) {
      className = parts[0]; name = parts[1]; phoneRaw = parts[2].replace(/\D/g, "");
    } else if (parts.length === 2) {
      name = parts[0]; phoneRaw = parts[1].replace(/\D/g, "");
    } else continue;
    if (!name || phoneRaw.length < 10) continue;
    const phone = phoneRaw.startsWith("0") ? phoneRaw : `0${phoneRaw}`;
    rows.push({ name, phone: formatKorean(phone), className });
  }

  if (rows.length === 0) throw new Error("유효한 데이터가 없습니다");

  const inserts = rows.map((r) => ({
    event_id: eventId,
    phone: r.phone,
    name: r.className ? `[선생님/${r.className}] ${r.name}` : `[선생님] ${r.name}`,
    status: "REGISTERED" as const,
  }));

  const { error } = await supabase.from("event_registrations").upsert(inserts, {
    onConflict: "event_id,phone",
    ignoreDuplicates: true,
  });

  if (error) throw new Error(error.message);
  revalidatePath(`/admin/events/${eventId}/staff`);
  return { count: rows.length };
}

export async function removeTeacherAction(eventId: string, registrationId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("event_registrations").delete().eq("id", registrationId);
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/events/${eventId}/staff`);
}
