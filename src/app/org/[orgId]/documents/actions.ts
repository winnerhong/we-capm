"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOrg } from "@/lib/org-auth-guard";
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
 * 기관 측 서류 제출.
 * - requireOrg() 세션 확인
 * - orgId 파라미터 === 세션 orgId (orgId 일치 검증)
 * - partner_orgs에서 partner_id 조회해 함께 기록
 * - 기존 doc_type 최신 version+1 로 새 row insert
 * - uploaded_by = 'ORG', uploaded_by_id = session.managerId (uuid가 아닐 수 있어 null 처리)
 * - status = 'PENDING'
 */
export async function submitOrgDocumentAction(
  orgId: string,
  formData: FormData
) {
  const session = await requireOrg();
  if (!orgId || orgId !== session.orgId) {
    throw new Error("이 기관의 서류를 제출할 권한이 없습니다");
  }

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

  const supabase = await createClient();

  // 기관 소유 지사(partner_id) 조회
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

  // managerId가 uuid가 아닐 수 있음 → uuid 패턴만 저장, 아니면 null
  const uuidRegex =
    /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
  const uploaded_by_id = uuidRegex.test(session.managerId)
    ? session.managerId
    : null;

  const { error } = (await (
    supabase.from("org_documents" as never) as unknown as {
      insert: (p: unknown) => Promise<{ error: { message: string } | null }>;
    }
  ).insert({
    org_id: orgId,
    partner_id: org.partner_id,
    doc_type,
    file_url,
    file_name,
    file_size,
    mime_type,
    status: "PENDING",
    uploaded_by: "ORG",
    uploaded_by_id,
    expires_at,
    version: nextVersion,
    notes,
  } as never)) as { error: { message: string } | null };

  if (error) throw new Error(`서류 제출 실패: ${error.message}`);

  revalidatePath(`/org/${orgId}/documents`);
  redirect(`/org/${orgId}/documents?submitted=${doc_type}`);
}

/**
 * 기관 측 서류 삭제.
 * - orgId 일치 + 소유권 확인
 * - uploaded_by='ORG' AND status='PENDING' 만 삭제 가능
 *   (APPROVED는 지사만 삭제)
 */
export async function deleteOrgDocumentAction(
  orgId: string,
  documentId: string
) {
  const session = await requireOrg();
  if (!orgId || orgId !== session.orgId) {
    throw new Error("이 기관의 서류를 삭제할 권한이 없습니다");
  }
  if (!documentId) throw new Error("서류 ID가 비어 있습니다");

  const supabase = await createClient();

  const { data: row } = (await (
    supabase.from("org_documents" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          maybeSingle: () => Promise<
            SbRespOne<{
              id: string;
              org_id: string;
              uploaded_by: string;
              status: string;
              file_url: string;
            }>
          >;
        };
      };
    }
  )
    .select("id,org_id,uploaded_by,status,file_url")
    .eq("id", documentId)
    .maybeSingle()) as SbRespOne<{
    id: string;
    org_id: string;
    uploaded_by: string;
    status: string;
    file_url: string;
  }>;

  if (!row) throw new Error("서류를 찾을 수 없습니다");
  if (row.org_id !== orgId) {
    throw new Error("이 서류를 삭제할 권한이 없습니다");
  }
  if (row.uploaded_by !== "ORG") {
    throw new Error("지사가 업로드한 서류는 기관이 삭제할 수 없습니다");
  }
  if (row.status !== "PENDING") {
    throw new Error("검토중 상태의 서류만 삭제할 수 있습니다");
  }

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

  revalidatePath(`/org/${orgId}/documents`);
}
