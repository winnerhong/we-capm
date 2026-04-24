"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePartnerWithRole } from "@/lib/auth-guard";
import { createClient } from "@/lib/supabase/server";
import type { TemplateJson } from "@/lib/org-documents/template-json-schema";

type SbRespOne<T> = { data: T | null; error: { message: string } | null };

const TEMPLATED_DOC_TYPES = [
  "TAX_CONTRACT",
  "FACILITY_CONSENT",
  "PRIVACY_CONSENT",
] as const;

type TemplatedDocType = (typeof TEMPLATED_DOC_TYPES)[number];

function isValidDocType(v: string): v is TemplatedDocType {
  return (TEMPLATED_DOC_TYPES as readonly string[]).includes(v);
}

/* ---------- SECTIONS(온라인 편집) 액션 ---------- */

function validateSections(json: unknown): TemplateJson {
  if (!json || typeof json !== "object") {
    throw new Error("섹션 데이터가 유효하지 않습니다");
  }
  const o = json as Record<string, unknown>;
  const title = String(o.title ?? "").trim();
  const intro = String(o.intro ?? "");
  const closing = String(o.closing ?? "");
  const arr = Array.isArray(o.articles) ? o.articles : [];
  if (!title) throw new Error("문서 제목을 입력해 주세요");
  if (arr.length > 50) throw new Error("조문은 최대 50개까지 가능합니다");

  const articles = arr.map((raw, i) => {
    if (!raw || typeof raw !== "object") {
      throw new Error(`${i + 1}번째 조문이 유효하지 않습니다`);
    }
    const a = raw as Record<string, unknown>;
    const id = String(a.id ?? "").trim() || `art-${i}-${Date.now()}`;
    const no = String(a.no ?? "").trim();
    const aTitle = String(a.title ?? "").trim();
    const body = String(a.body ?? "");
    if (body.length > 5000) {
      throw new Error(`${i + 1}번째 조문 본문이 너무 깁니다 (5000자 이하)`);
    }
    return { id, no, title: aTitle, body };
  });

  return { title, intro, closing, articles };
}

/**
 * 섹션 JSON 저장 (OWNER만)
 * - format='SECTIONS' 으로 upsert
 * - 기존 FILE 업로드가 있어도 덮어씀 (format 전환)
 */
export async function saveTemplateSectionsAction(
  docTypeRaw: string,
  jsonRaw: unknown
) {
  const partner = await requirePartnerWithRole(["OWNER"]);

  if (!isValidDocType(docTypeRaw)) {
    throw new Error("유효하지 않은 서류 종류입니다");
  }
  const doc_type: TemplatedDocType = docTypeRaw;
  const tmpl = validateSections(jsonRaw);

  const supabase = await createClient();

  const { data: prev } = (await (
    supabase.from("partner_doc_templates" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          eq: (k: string, v: string) => {
            maybeSingle: () => Promise<
              SbRespOne<{ id: string; version: number }>
            >;
          };
        };
      };
    }
  )
    .select("id,version")
    .eq("partner_id", partner.id)
    .eq("doc_type", doc_type)
    .maybeSingle()) as SbRespOne<{ id: string; version: number }>;

  if (prev) {
    const { error } = (await (
      supabase.from("partner_doc_templates" as never) as unknown as {
        update: (p: unknown) => {
          eq: (k: string, v: string) => Promise<{
            error: { message: string } | null;
          }>;
        };
      }
    )
      .update({
        format: "SECTIONS",
        sections: tmpl,
        file_url: null,
        file_name: null,
        file_size: null,
        mime_type: null,
        version: (prev.version ?? 1) + 1,
        uploaded_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as never)
      .eq("id", prev.id)) as { error: { message: string } | null };

    if (error) throw new Error(`섹션 저장 실패: ${error.message}`);
  } else {
    const { error } = (await (
      supabase.from("partner_doc_templates" as never) as unknown as {
        insert: (p: unknown) => Promise<{
          error: { message: string } | null;
        }>;
      }
    ).insert({
      partner_id: partner.id,
      doc_type,
      format: "SECTIONS",
      sections: tmpl,
      version: 1,
    } as never)) as { error: { message: string } | null };

    if (error) throw new Error(`섹션 저장 실패: ${error.message}`);
  }

  revalidatePath("/partner/settings/doc-templates");
  revalidatePath(`/partner/settings/doc-templates/${doc_type}/edit`);
}

/**
 * 섹션 저장본 삭제 → 토리로 기본 양식으로 복귀 (OWNER만)
 */
export async function resetTemplateSectionsAction(docTypeRaw: string) {
  const partner = await requirePartnerWithRole(["OWNER"]);

  if (!isValidDocType(docTypeRaw)) {
    throw new Error("유효하지 않은 서류 종류입니다");
  }
  const doc_type: TemplatedDocType = docTypeRaw;

  const supabase = await createClient();

  const { error } = (await (
    supabase.from("partner_doc_templates" as never) as unknown as {
      delete: () => {
        eq: (k: string, v: string) => {
          eq: (k: string, v: string) => {
            eq: (k: string, v: string) => Promise<{
              error: { message: string } | null;
            }>;
          };
        };
      };
    }
  )
    .delete()
    .eq("partner_id", partner.id)
    .eq("doc_type", doc_type)
    .eq("format", "SECTIONS")) as { error: { message: string } | null };

  if (error) throw new Error(`섹션 초기화 실패: ${error.message}`);

  revalidatePath("/partner/settings/doc-templates");
}

/**
 * 커스텀 템플릿 업로드 (OWNER만)
 * - 같은 (partner_id, doc_type) 있으면 UPSERT (덮어쓰기)
 * - version+1 관리는 Phase 1 스킵 → 단순 UPSERT
 */
export async function uploadCustomTemplateAction(formData: FormData) {
  const partner = await requirePartnerWithRole(["OWNER"]);

  const docTypeRaw = String(formData.get("doc_type") ?? "").trim();
  if (!isValidDocType(docTypeRaw)) {
    throw new Error("유효하지 않은 서류 종류입니다");
  }
  const doc_type: TemplatedDocType = docTypeRaw;

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
  const notes = String(formData.get("notes") ?? "").trim() || null;

  const supabase = await createClient();

  // 기존 row 조회 (있으면 UPDATE, 없으면 INSERT)
  const { data: prev } = (await (
    supabase.from("partner_doc_templates" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          eq: (k: string, v: string) => {
            maybeSingle: () => Promise<
              SbRespOne<{ id: string; version: number }>
            >;
          };
        };
      };
    }
  )
    .select("id,version")
    .eq("partner_id", partner.id)
    .eq("doc_type", doc_type)
    .maybeSingle()) as SbRespOne<{ id: string; version: number }>;

  if (prev) {
    // UPDATE (덮어쓰기)
    const { error } = (await (
      supabase.from("partner_doc_templates" as never) as unknown as {
        update: (p: unknown) => {
          eq: (k: string, v: string) => Promise<{
            error: { message: string } | null;
          }>;
        };
      }
    )
      .update({
        file_url,
        file_name,
        file_size,
        mime_type,
        notes,
        version: (prev.version ?? 1) + 1,
        uploaded_at: new Date().toISOString(),
      } as never)
      .eq("id", prev.id)) as { error: { message: string } | null };

    if (error) throw new Error(`템플릿 업데이트 실패: ${error.message}`);
  } else {
    // INSERT
    const { error } = (await (
      supabase.from("partner_doc_templates" as never) as unknown as {
        insert: (p: unknown) => Promise<{
          error: { message: string } | null;
        }>;
      }
    ).insert({
      partner_id: partner.id,
      doc_type,
      file_url,
      file_name,
      file_size,
      mime_type,
      notes,
      version: 1,
    } as never)) as { error: { message: string } | null };

    if (error) throw new Error(`템플릿 등록 실패: ${error.message}`);
  }

  revalidatePath("/partner/settings/doc-templates");
  redirect(`/partner/settings/doc-templates?uploaded=${doc_type}`);
}

/**
 * 커스텀 템플릿 삭제 (OWNER만)
 * - 소유권 검증
 * - DB row 삭제 + Storage 파일 삭제 시도 (실패 무시)
 */
export async function deleteCustomTemplateAction(templateId: string) {
  const partner = await requirePartnerWithRole(["OWNER"]);
  if (!templateId) throw new Error("템플릿 ID가 비어 있습니다");

  const supabase = await createClient();

  // 소유권 확인
  const { data: row } = (await (
    supabase.from("partner_doc_templates" as never) as unknown as {
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
    .eq("id", templateId)
    .maybeSingle()) as SbRespOne<{
    id: string;
    partner_id: string;
    file_url: string;
  }>;

  if (!row) throw new Error("템플릿을 찾을 수 없습니다");
  if (row.partner_id !== partner.id) {
    throw new Error("이 템플릿을 삭제할 권한이 없습니다");
  }

  // DB row 삭제
  const { error } = (await (
    supabase.from("partner_doc_templates" as never) as unknown as {
      delete: () => {
        eq: (k: string, v: string) => Promise<{
          error: { message: string } | null;
        }>;
      };
    }
  )
    .delete()
    .eq("id", templateId)) as { error: { message: string } | null };

  if (error) throw new Error(`템플릿 삭제 실패: ${error.message}`);

  // Storage 파일 삭제 시도 (실패 무시)
  try {
    const path = row.file_url;
    if (path && !/^https?:\/\//i.test(path)) {
      await supabase.storage.from("partner-documents").remove([path]);
    } else if (path) {
      const marker = "/partner-documents/";
      const idx = path.indexOf(marker);
      if (idx >= 0) {
        const pathPart = path.substring(idx + marker.length).split("?")[0];
        if (pathPart) {
          await supabase.storage
            .from("partner-documents")
            .remove([pathPart]);
        }
      }
    }
  } catch {
    // 무시
  }

  revalidatePath("/partner/settings/doc-templates");
}
