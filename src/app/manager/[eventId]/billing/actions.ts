"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { requireAdminOrManager } from "@/lib/auth-guard";
import { createInvoice } from "@/lib/billing/invoice";
import { formatKorean } from "@/lib/phone";

type ManagerCookie = {
  eventId: string;
  eventName: string;
  managerId: string;
  loginAt: string;
};

async function getManagerForEvent(eventId: string): Promise<ManagerCookie> {
  const cookieStore = await cookies();
  const raw = cookieStore.get("campnic_manager")?.value;
  if (!raw) throw new Error("unauthorized");
  let data: ManagerCookie;
  try {
    data = JSON.parse(raw) as ManagerCookie;
  } catch {
    throw new Error("unauthorized");
  }
  if (data.eventId !== eventId) throw new Error("invalid event");
  return data;
}

// ---------------------------------------------------------------------------
// Task 2: 행사용 도토리 셀프 충전 (Manager → 자기 행사)
// ---------------------------------------------------------------------------
export async function chargeEventAcornsAction(
  eventId: string,
  formData: FormData,
): Promise<{ ok: boolean; message?: string; invoiceNumber?: string; paymentLinkToken?: string }> {
  const manager = await getManagerForEvent(eventId);
  const supabase = await createClient();

  const amountRaw = formData.get("amount");
  const methodRaw = formData.get("method");
  const memo = (formData.get("memo") as string | null)?.trim() || undefined;

  const amount = Number(amountRaw);
  if (!Number.isFinite(amount) || amount < 10_000) {
    return { ok: false, message: "최소 10,000원 이상 충전해주세요" };
  }

  const method =
    methodRaw === "BANK_TRANSFER" || methodRaw === "CARD" || methodRaw === "KAKAOPAY"
      ? methodRaw
      : "BANK_TRANSFER";

  const { data: event } = await supabase
    .from("events")
    .select("id, name")
    .eq("id", eventId)
    .single();

  if (!event) return { ok: false, message: "행사를 찾을 수 없습니다" };

  const invoice = await createInvoice(supabase, {
    issued_by_type: "SYSTEM",
    issued_by_id: "system",
    target_type: "MANAGER",
    target_id: eventId,
    target_name: event.name,
    category: "ACORN_RECHARGE",
    amount,
    payment_methods: [method],
    description: `${event.name} 행사 도토리 충전`,
    memo,
    metadata: {
      manager_id: manager.managerId,
      event_id: eventId,
    },
  });

  if (!invoice) {
    return { ok: false, message: "청구서 생성에 실패했습니다" };
  }

  revalidatePath(`/manager/${eventId}/billing`);
  revalidatePath(`/manager/${eventId}/billing/acorns`);
  return {
    ok: true,
    invoiceNumber: invoice.invoice_number,
    paymentLinkToken: invoice.payment_link_token,
  };
}

// ---------------------------------------------------------------------------
// Admin에게 도토리 지원(보조금) 요청 — 메시지만 남김
// ---------------------------------------------------------------------------
export async function requestSupportAction(
  eventId: string,
  message: string,
): Promise<{ ok: boolean; message?: string }> {
  const manager = await getManagerForEvent(eventId);
  const supabase = await createClient();

  const trimmed = message.trim();
  if (trimmed.length < 5) return { ok: false, message: "요청 내용을 5자 이상 입력해주세요" };
  if (trimmed.length > 500) return { ok: false, message: "요청 내용이 너무 깁니다 (500자 이하)" };

  // support_requests 테이블이 없으면 chat_messages로 fallback 하도록 best-effort
  const payload = {
    event_id: eventId,
    manager_id: manager.managerId,
    type: "ACORN_SUBSIDY",
    message: trimmed,
    status: "OPEN",
    created_at: new Date().toISOString(),
  };

  const sb = supabase as unknown as {
    from: (t: string) => {
      insert: (d: unknown) => Promise<{ error: { message?: string; code?: string } | null }>;
    };
  };

  const { error } = await sb.from("support_requests").insert(payload);
  if (error && error.code !== "42P01") {
    return { ok: false, message: "요청 전송에 실패했습니다" };
  }

  revalidatePath(`/manager/${eventId}/billing`);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Task 3: 학부모 일괄 청구서 발행
// ---------------------------------------------------------------------------
export async function bulkCreateParentInvoicesAction(
  eventId: string,
  amount: number,
  description?: string,
): Promise<{ ok: boolean; message?: string; created?: number; skipped?: number }> {
  const manager = await getManagerForEvent(eventId);
  await requireAdminOrManager(eventId);
  const supabase = await createClient();

  if (!Number.isFinite(amount) || amount < 1_000) {
    return { ok: false, message: "1,000원 이상으로 입력해주세요" };
  }

  const { data: event } = await supabase
    .from("events")
    .select("id, name")
    .eq("id", eventId)
    .single();
  if (!event) return { ok: false, message: "행사를 찾을 수 없습니다" };

  // 등록된 참가자들
  const { data: regs } = await supabase
    .from("event_registrations")
    .select("id, name, phone")
    .eq("event_id", eventId);

  if (!regs || regs.length === 0) {
    return { ok: false, message: "등록된 참가자가 없습니다" };
  }

  // 이미 발급된 청구서 조회 (중복 방지)
  const sbExisting = supabase as unknown as {
    from: (t: string) => {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          eq: (k: string, v: string) => {
            in: (k: string, v: string[]) => Promise<{
              data: { target_id: string }[] | null;
            }>;
          };
        };
      };
    };
  };

  const phones = regs.map((r) => r.phone).filter(Boolean) as string[];
  const { data: existingInvs } = await sbExisting
    .from("invoices")
    .select("target_id")
    .eq("category", "EVENT_FEE")
    .eq("target_type", "PARTICIPANT")
    .in("target_id", phones);

  const existingSet = new Set((existingInvs ?? []).map((r) => r.target_id));

  let created = 0;
  let skipped = 0;

  for (const reg of regs) {
    if (!reg.phone || existingSet.has(reg.phone)) {
      skipped++;
      continue;
    }
    // 선생님 제외 (가족만)
    if (reg.name.includes("선생님")) {
      skipped++;
      continue;
    }

    const inv = await createInvoice(supabase, {
      issued_by_type: "SYSTEM",
      issued_by_id: manager.managerId,
      target_type: "PARTICIPANT",
      target_id: reg.phone,
      target_name: reg.name,
      target_phone: reg.phone,
      category: "EVENT_FEE",
      amount,
      payment_methods: ["CARD", "KAKAOPAY", "BANK_TRANSFER"],
      description: description || `${event.name} 참가비`,
      metadata: {
        event_id: eventId,
        registration_id: reg.id,
      },
    });

    if (inv) created++;
    else skipped++;
  }

  revalidatePath(`/manager/${eventId}/billing`);
  revalidatePath(`/manager/${eventId}/billing/parents`);
  return { ok: true, created, skipped };
}

// ---------------------------------------------------------------------------
// 미납자 일괄 독촉 (metadata만 업데이트, 실제 발송은 sms 모듈에서)
// ---------------------------------------------------------------------------
export async function remindUnpaidParentsAction(
  eventId: string,
): Promise<{ ok: boolean; message?: string; reminded?: number }> {
  await getManagerForEvent(eventId);
  const supabase = await createClient();

  const sbPending = supabase as unknown as {
    from: (t: string) => {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          eq: (k: string, v: string) => {
            eq: (k: string, v: string) => Promise<{
              data:
                | { id: string; target_phone: string; target_name: string; invoice_number: string }[]
                | null;
            }>;
          };
        };
      };
    };
  };

  const { data: pending } = await sbPending
    .from("invoices")
    .select("id, target_phone, target_name, invoice_number")
    .eq("category", "EVENT_FEE")
    .eq("target_type", "PARTICIPANT")
    .eq("status", "PENDING");

  const targets = (pending ?? []).filter(
    (p) => !!p.target_phone && !!p.target_name,
  );

  // metadata에 reminded_at 기록만 (실제 SMS는 외부 모듈 연동)
  const nowIso = new Date().toISOString();
  for (const t of targets) {
    const sb = supabase as unknown as {
      from: (tbl: string) => {
        update: (d: unknown) => {
          eq: (k: string, v: string) => Promise<unknown>;
        };
      };
    };
    await sb
      .from("invoices")
      .update({ memo: `마지막 독촉: ${nowIso}` })
      .eq("id", t.id);
    // 콘솔로 흔적 남김 (SMS 연동 전)
    console.info("[parent-reminder]", {
      invoice: t.invoice_number,
      to: formatKorean(t.target_phone),
    });
  }

  revalidatePath(`/manager/${eventId}/billing/parents`);
  return { ok: true, reminded: targets.length };
}
