"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth-guard";
import { createClient } from "@/lib/supabase/server";

type SbRespOne<T> = { data: T | null; error: { message: string } | null };

type AdminSession = { id?: string };

async function loadDocPartnerId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  documentId: string
): Promise<string | null> {
  const { data } = (await (
    supabase.from("partner_documents" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          maybeSingle: () => Promise<SbRespOne<{ partner_id: string }>>;
        };
      };
    }
  )
    .select("partner_id")
    .eq("id", documentId)
    .maybeSingle()) as SbRespOne<{ partner_id: string }>;

  return data?.partner_id ?? null;
}

/**
 * 서류 승인: status='APPROVED' + reviewed_at/by 기록
 * - 관리자만
 */
export async function approveDocumentAction(documentId: string) {
  const admin = (await requireAdmin()) as AdminSession;
  if (!documentId) throw new Error("서류 ID가 비어 있습니다");

  const supabase = await createClient();
  const partnerId = await loadDocPartnerId(supabase, documentId);
  if (!partnerId) throw new Error("서류를 찾을 수 없습니다");

  const { error } = (await (
    supabase.from("partner_documents" as never) as unknown as {
      update: (p: unknown) => {
        eq: (k: string, v: string) => Promise<{
          error: { message: string } | null;
        }>;
      };
    }
  )
    .update({
      status: "APPROVED",
      reviewed_at: new Date().toISOString(),
      reviewed_by: admin.id ?? null,
      reject_reason: null,
    } as never)
    .eq("id", documentId)) as { error: { message: string } | null };

  if (error) throw new Error(`승인 실패: ${error.message}`);

  revalidatePath(`/admin/partners/${partnerId}/documents`);
  revalidatePath("/admin/partners");
  revalidatePath("/admin/documents");
  revalidatePath("/admin");
}

/**
 * 서류 반려: status='REJECTED' + reject_reason 기록
 * - 관리자만
 */
export async function rejectDocumentAction(
  documentId: string,
  formData: FormData
) {
  const admin = (await requireAdmin()) as AdminSession;
  if (!documentId) throw new Error("서류 ID가 비어 있습니다");

  const reason = String(formData.get("reason") ?? "").trim();
  if (!reason) throw new Error("반려 사유를 입력해 주세요");

  const supabase = await createClient();
  const partnerId = await loadDocPartnerId(supabase, documentId);
  if (!partnerId) throw new Error("서류를 찾을 수 없습니다");

  const { error } = (await (
    supabase.from("partner_documents" as never) as unknown as {
      update: (p: unknown) => {
        eq: (k: string, v: string) => Promise<{
          error: { message: string } | null;
        }>;
      };
    }
  )
    .update({
      status: "REJECTED",
      reject_reason: reason,
      reviewed_at: new Date().toISOString(),
      reviewed_by: admin.id ?? null,
    } as never)
    .eq("id", documentId)) as { error: { message: string } | null };

  if (error) throw new Error(`반려 실패: ${error.message}`);

  revalidatePath(`/admin/partners/${partnerId}/documents`);
  revalidatePath("/admin/partners");
}
