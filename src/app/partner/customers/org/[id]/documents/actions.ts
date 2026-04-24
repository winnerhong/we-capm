"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePartnerWithRole } from "@/lib/auth-guard";
import { createClient } from "@/lib/supabase/server";
import {
  ORG_DOC_TYPE_KEYS,
  type OrgDocType,
} from "@/lib/org-documents/types";

type SbRespOne<T> = { data: T | null; error: { message: string } | null };

function isValidOrgDocType(v: string): v is OrgDocType {
  return (ORG_DOC_TYPE_KEYS as string[]).includes(v);
}

/**
 * 지사가 기관 소속인지 확인. 결과로 partner_id를 반환.
 * 실패 시 throw.
 */
async function assertPartnerOwnsOrg(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orgId: string,
  partnerId: string
): Promise<{ partner_id: string }> {
  const { data: org } = (await (
    supabase.from("partner_orgs" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          maybeSingle: () => Promise<
            SbRespOne<{ id: string; partner_id: string | null }>
          >;
        };
      };
    }
  )
    .select("id, partner_id")
    .eq("id", orgId)
    .maybeSingle()) as SbRespOne<{ id: string; partner_id: string | null }>;

  if (!org) throw new Error("기관을 찾을 수 없습니다");
  if (!org.partner_id || org.partner_id !== partnerId) {
    throw new Error("이 기관의 서류를 관리할 권한이 없습니다");
  }
  return { partner_id: org.partner_id };
}

/**
 * 지사가 기관 대신 업로드.
 * - OWNER / FINANCE 만
 * - 기관 소유권 검증 (partner_orgs.partner_id === session.id)
 * - uploaded_by='PARTNER', uploaded_by_id=session.id
 * - status='PENDING', version = prev+1
 */
export async function uploadOnBehalfAction(
  orgId: string,
  formData: FormData
) {
  const partner = await requirePartnerWithRole(["OWNER", "FINANCE"]);
  if (!orgId) throw new Error("기관 ID가 비어 있습니다");

  const supabase = await createClient();
  const { partner_id } = await assertPartnerOwnsOrg(
    supabase,
    orgId,
    partner.id
  );

  const docTypeRaw = String(formData.get("doc_type") ?? "").trim();
  if (!isValidOrgDocType(docTypeRaw)) {
    throw new Error("유효하지 않은 서류 종류입니다");
  }
  const doc_type: OrgDocType = docTypeRaw;

  const file_url = String(formData.get("file_url") ?? "").trim();
  if (!file_url) throw new Error("파일이 업로드되지 않았습니다");

  const file_name = String(formData.get("file_name") ?? "").trim() || null;
  const fileSizeRaw = formData.get("file_size");
  const file_size =
    fileSizeRaw !== null && fileSizeRaw !== "" ? Number(fileSizeRaw) : null;
  if (file_size !== null && (Number.isNaN(file_size) || file_size < 0)) {
    throw new Error("파일 크기가 올바르지 않습니다");
  }
  const mime_type = String(formData.get("mime_type") ?? "").trim() || null;
  const expiresAtRaw = String(formData.get("expires_at") ?? "").trim();
  const expires_at = expiresAtRaw ? expiresAtRaw : null;
  const notes = String(formData.get("notes") ?? "").trim() || null;

  // 기존 최신 버전 조회 → version+1
  const { data: prev } = (await (
    supabase.from("org_documents" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          eq: (k: string, v: string) => {
            order: (
              c: string,
              o: { ascending: boolean }
            ) => {
              limit: (n: number) => {
                maybeSingle: () => Promise<SbRespOne<{ version: number }>>;
              };
            };
          };
        };
      };
    }
  )
    .select("version")
    .eq("org_id", orgId)
    .eq("doc_type", doc_type)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle()) as SbRespOne<{ version: number }>;

  const nextVersion = (prev?.version ?? 0) + 1;

  const { error } = (await (
    supabase.from("org_documents" as never) as unknown as {
      insert: (p: unknown) => Promise<{ error: { message: string } | null }>;
    }
  ).insert({
    org_id: orgId,
    partner_id,
    doc_type,
    file_url,
    file_name,
    file_size,
    mime_type,
    status: "PENDING",
    uploaded_by: "PARTNER",
    uploaded_by_id: partner.id,
    expires_at,
    version: nextVersion,
    notes,
  } as never)) as { error: { message: string } | null };

  if (error) throw new Error(`서류 업로드 실패: ${error.message}`);

  revalidatePath(`/partner/customers/org/${orgId}`);
  revalidatePath(`/partner/customers/org/${orgId}/documents`);
  redirect(`/partner/customers/org/${orgId}?docs=uploaded`);
}

/**
 * 지사가 서류 승인.
 * - 기관 소유권 확인
 * - status='APPROVED', reviewed_at, reviewed_by=session.id
 */
export async function approveOrgDocumentAction(
  orgId: string,
  documentId: string
) {
  const partner = await requirePartnerWithRole(["OWNER", "FINANCE"]);
  if (!orgId || !documentId) throw new Error("필수 정보가 누락되었습니다");

  const supabase = await createClient();
  await assertPartnerOwnsOrg(supabase, orgId, partner.id);

  // 서류가 해당 기관 소속인지 확인
  const { data: doc } = (await (
    supabase.from("org_documents" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          maybeSingle: () => Promise<
            SbRespOne<{ id: string; org_id: string }>
          >;
        };
      };
    }
  )
    .select("id, org_id")
    .eq("id", documentId)
    .maybeSingle()) as SbRespOne<{ id: string; org_id: string }>;

  if (!doc) throw new Error("서류를 찾을 수 없습니다");
  if (doc.org_id !== orgId) throw new Error("서류가 이 기관 소속이 아닙니다");

  const { error } = (await (
    supabase.from("org_documents" as never) as unknown as {
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
      reviewed_by: partner.id,
      reject_reason: null,
    })
    .eq("id", documentId)) as { error: { message: string } | null };

  if (error) throw new Error(`승인 실패: ${error.message}`);

  revalidatePath(`/partner/customers/org/${orgId}`);
  revalidatePath(`/partner/customers/org/${orgId}/documents`);
  revalidatePath(`/org/${orgId}/documents`);
}

/**
 * 지사가 서류 반려.
 * - reason (required)
 * - status='REJECTED', reject_reason, reviewed_at, reviewed_by
 */
export async function rejectOrgDocumentAction(
  orgId: string,
  documentId: string,
  formData: FormData
) {
  const partner = await requirePartnerWithRole(["OWNER", "FINANCE"]);
  if (!orgId || !documentId) throw new Error("필수 정보가 누락되었습니다");

  const reason = String(formData.get("reason") ?? "").trim();
  if (!reason) throw new Error("반려 사유를 입력하세요");

  const supabase = await createClient();
  await assertPartnerOwnsOrg(supabase, orgId, partner.id);

  const { data: doc } = (await (
    supabase.from("org_documents" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          maybeSingle: () => Promise<
            SbRespOne<{ id: string; org_id: string }>
          >;
        };
      };
    }
  )
    .select("id, org_id")
    .eq("id", documentId)
    .maybeSingle()) as SbRespOne<{ id: string; org_id: string }>;

  if (!doc) throw new Error("서류를 찾을 수 없습니다");
  if (doc.org_id !== orgId) throw new Error("서류가 이 기관 소속이 아닙니다");

  const { error } = (await (
    supabase.from("org_documents" as never) as unknown as {
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
      reviewed_by: partner.id,
    })
    .eq("id", documentId)) as { error: { message: string } | null };

  if (error) throw new Error(`반려 실패: ${error.message}`);

  revalidatePath(`/partner/customers/org/${orgId}`);
  revalidatePath(`/partner/customers/org/${orgId}/documents`);
  revalidatePath(`/org/${orgId}/documents`);
}

/**
 * 지사 측 삭제 — 상태 무관, 소유권만 확인.
 * Storage 파일 삭제 시도 포함 (실패 무시).
 */
export async function deleteOrgDocumentByPartnerAction(
  orgId: string,
  documentId: string
) {
  const partner = await requirePartnerWithRole(["OWNER", "FINANCE"]);
  if (!orgId || !documentId) throw new Error("필수 정보가 누락되었습니다");

  const supabase = await createClient();
  await assertPartnerOwnsOrg(supabase, orgId, partner.id);

  const { data: row } = (await (
    supabase.from("org_documents" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          maybeSingle: () => Promise<
            SbRespOne<{
              id: string;
              org_id: string;
              file_url: string;
            }>
          >;
        };
      };
    }
  )
    .select("id, org_id, file_url")
    .eq("id", documentId)
    .maybeSingle()) as SbRespOne<{
    id: string;
    org_id: string;
    file_url: string;
  }>;

  if (!row) throw new Error("서류를 찾을 수 없습니다");
  if (row.org_id !== orgId) throw new Error("서류가 이 기관 소속이 아닙니다");

  const { error } = (await (
    supabase.from("org_documents" as never) as unknown as {
      delete: () => {
        eq: (k: string, v: string) => Promise<{
          error: { message: string } | null;
        }>;
      };
    }
  )
    .delete()
    .eq("id", documentId)) as { error: { message: string } | null };

  if (error) throw new Error(`서류 삭제 실패: ${error.message}`);

  // Storage 파일 삭제 시도 (실패 무시)
  try {
    const url = row.file_url;
    const marker = "/partner-documents/";
    const idx = url.indexOf(marker);
    if (idx >= 0) {
      const pathPart = url.substring(idx + marker.length).split("?")[0];
      if (pathPart) {
        await supabase.storage.from("partner-documents").remove([pathPart]);
      }
    }
  } catch {
    // 무시
  }

  revalidatePath(`/partner/customers/org/${orgId}`);
  revalidatePath(`/partner/customers/org/${orgId}/documents`);
  revalidatePath(`/org/${orgId}/documents`);
}
