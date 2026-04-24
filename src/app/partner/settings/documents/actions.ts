"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePartnerWithRole } from "@/lib/auth-guard";
import { createClient } from "@/lib/supabase/server";
import { DOC_TYPE_KEYS, type DocType } from "@/lib/documents/types";

type SbRespOne<T> = { data: T | null; error: { message: string } | null };

function isValidDocType(v: string): v is DocType {
  return (DOC_TYPE_KEYS as string[]).includes(v);
}

/**
 * 서류 제출: doc_type별 최신 버전을 조회해 version+1로 새 row를 insert.
 * 이전 버전들은 DB에 남김 (히스토리). 최신만 현재로 취급.
 * - OWNER / FINANCE만 가능
 */
export async function submitDocumentAction(formData: FormData) {
  const partner = await requirePartnerWithRole(["OWNER", "FINANCE"]);

  const docTypeRaw = String(formData.get("doc_type") ?? "").trim();
  if (!isValidDocType(docTypeRaw)) {
    throw new Error("유효하지 않은 서류 종류입니다");
  }
  const doc_type: DocType = docTypeRaw;

  const file_url = String(formData.get("file_url") ?? "").trim();
  if (!file_url) throw new Error("파일이 업로드되지 않았습니다");

  const file_name = String(formData.get("file_name") ?? "").trim() || null;
  const fileSizeRaw = formData.get("file_size");
  const file_size =
    fileSizeRaw !== null && fileSizeRaw !== ""
      ? Number(fileSizeRaw)
      : null;
  if (file_size !== null && (Number.isNaN(file_size) || file_size < 0)) {
    throw new Error("파일 크기가 올바르지 않습니다");
  }
  const mime_type = String(formData.get("mime_type") ?? "").trim() || null;
  const expiresAtRaw = String(formData.get("expires_at") ?? "").trim();
  const expires_at = expiresAtRaw ? expiresAtRaw : null;
  const notes = String(formData.get("notes") ?? "").trim() || null;

  const supabase = await createClient();

  // 기존 최신 버전 조회
  const { data: prev } = (await (
    supabase.from("partner_documents" as never) as unknown as {
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
    .eq("partner_id", partner.id)
    .eq("doc_type", doc_type)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle()) as SbRespOne<{ version: number }>;

  const nextVersion = (prev?.version ?? 0) + 1;

  const { error } = (await (
    supabase.from("partner_documents" as never) as unknown as {
      insert: (p: unknown) => Promise<{ error: { message: string } | null }>;
    }
  ).insert({
    partner_id: partner.id,
    doc_type,
    file_url,
    file_name,
    file_size,
    mime_type,
    status: "PENDING",
    expires_at,
    version: nextVersion,
    notes,
  } as never)) as { error: { message: string } | null };

  if (error) throw new Error(`서류 제출 실패: ${error.message}`);

  revalidatePath("/partner/settings/documents");
  redirect(`/partner/settings/documents?submitted=${doc_type}`);
}

/**
 * 서류 삭제: hard delete (DB row 삭제) + Storage 파일 삭제 시도 (실패 무시)
 * - OWNER만 가능
 * - 소유권 확인 (해당 partner_id 일치)
 */
export async function deleteDocumentAction(id: string) {
  const partner = await requirePartnerWithRole(["OWNER"]);
  if (!id) throw new Error("서류 ID가 비어 있습니다");

  const supabase = await createClient();

  // 소유권 확인
  const { data: row } = (await (
    supabase.from("partner_documents" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          maybeSingle: () => Promise<
            SbRespOne<{ id: string; partner_id: string; file_url: string }>
          >;
        };
      };
    }
  )
    .select("id,partner_id,file_url")
    .eq("id", id)
    .maybeSingle()) as SbRespOne<{
    id: string;
    partner_id: string;
    file_url: string;
  }>;

  if (!row) throw new Error("서류를 찾을 수 없습니다");
  if (row.partner_id !== partner.id) {
    throw new Error("이 서류를 삭제할 권한이 없습니다");
  }

  // DB row 삭제
  const { error } = (await (
    supabase.from("partner_documents" as never) as unknown as {
      delete: () => {
        eq: (k: string, v: string) => Promise<{
          error: { message: string } | null;
        }>;
      };
    }
  )
    .delete()
    .eq("id", id)) as { error: { message: string } | null };

  if (error) throw new Error(`서류 삭제 실패: ${error.message}`);

  // Storage 파일 삭제 시도 (실패는 무시)
  try {
    const url = row.file_url;
    // public/signed URL 양쪽 모두에서 object path 추출 시도
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

  revalidatePath("/partner/settings/documents");
}
