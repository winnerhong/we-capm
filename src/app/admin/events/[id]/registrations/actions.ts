"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { formatKorean } from "@/lib/phone";

export async function addRegistrationAction(eventId: string, formData: FormData) {
  const supabase = await createClient();

  const name = String(formData.get("name") ?? "").trim();
  const phoneRaw = String(formData.get("phone") ?? "").replace(/\D/g, "");

  if (!name) throw new Error("이름을 입력해주세요");
  if (!phoneRaw || phoneRaw.length < 10) throw new Error("올바른 전화번호를 입력해주세요");

  const phone = phoneRaw.startsWith("0") ? phoneRaw : `0${phoneRaw}`;

  const { error } = await supabase.from("event_registrations").insert({
    event_id: eventId,
    phone: formatKorean(phone),
    name,
  });

  if (error) {
    if (error.message.includes("duplicate")) throw new Error("이미 등록된 번호입니다");
    throw new Error(error.message);
  }

  revalidatePath(`/admin/events/${eventId}/registrations`);
}

export async function deleteRegistrationAction(eventId: string, registrationId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("event_registrations").delete().eq("id", registrationId);
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/events/${eventId}/registrations`);
}

export async function updateRegistrationAction(
  eventId: string,
  registrationId: string,
  formData: FormData
) {
  const supabase = await createClient();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("이름을 입력해주세요");

  const { error } = await supabase
    .from("event_registrations")
    .update({ name })
    .eq("id", registrationId);
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/events/${eventId}/registrations`);
}

export async function uploadCsvAction(eventId: string, formData: FormData) {
  const supabase = await createClient();

  const csvText = String(formData.get("csv") ?? "");
  if (!csvText.trim()) throw new Error("CSV 내용이 비어있습니다");

  const lines = csvText
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("이름"));

  const rows: { name: string; phone: string }[] = [];
  for (const line of lines) {
    const parts = line.split(/[,\t]/).map((s) => s.trim());
    if (parts.length < 2) continue;
    const name = parts[0];
    const phoneRaw = parts[1].replace(/\D/g, "");
    if (!name || phoneRaw.length < 10) continue;
    const phone = phoneRaw.startsWith("0") ? phoneRaw : `0${phoneRaw}`;
    rows.push({ name, phone: formatKorean(phone) });
  }

  if (rows.length === 0) throw new Error("유효한 데이터가 없습니다");

  const checkOnly = String(formData.get("check_only") ?? "") === "true";

  const { data: existing } = await supabase
    .from("event_registrations")
    .select("phone")
    .eq("event_id", eventId);

  const existingPhones = new Set((existing ?? []).map((e) => e.phone));
  const duplicates = rows.filter((r) => existingPhones.has(r.phone));
  const newRows = rows.filter((r) => !existingPhones.has(r.phone));

  if (checkOnly) {
    return {
      count: rows.length,
      newCount: newRows.length,
      duplicateCount: duplicates.length,
      duplicateNames: duplicates.map((d) => d.name).slice(0, 10),
    };
  }

  if (newRows.length === 0) throw new Error("모두 이미 등록된 번호입니다");

  const inserts = newRows.map((r) => ({
    event_id: eventId,
    phone: r.phone,
    name: r.name,
  }));

  const { error } = await supabase.from("event_registrations").insert(inserts);
  if (error) throw new Error(error.message);

  revalidatePath(`/admin/events/${eventId}/registrations`);
  return { count: rows.length, newCount: newRows.length, duplicateCount: duplicates.length };
}
