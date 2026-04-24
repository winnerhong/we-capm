// server-only: @/lib/supabase/server를 참조하므로 클라이언트 번들에 포함 불가
import { createClient } from "@/lib/supabase/server";
import type { TemplateJson } from "./template-json-schema";

export type TemplateFormat = "FILE" | "SECTIONS";

export interface CustomTemplate {
  id: string;
  doc_type: string;
  format: TemplateFormat; // 'FILE' | 'SECTIONS' (기존 row는 'FILE' 기본값)
  sections: TemplateJson | null; // SECTIONS 모드에서만
  file_url: string | null; // FILE 모드에서만
  file_name: string | null;
  file_size: number | null;
  mime_type: string | null;
  version: number;
  notes: string | null;
  uploaded_at: string;
}

type SbResp<T> = { data: T[] | null; error: unknown };
type SbRespOne<T> = { data: T | null; error: unknown };

/**
 * 지사의 전체 커스텀 템플릿 맵 (doc_type별)
 */
export async function loadPartnerCustomTemplates(
  partnerId: string
): Promise<Map<string, CustomTemplate>> {
  const map = new Map<string, CustomTemplate>();
  if (!partnerId) return map;

  const supabase = await createClient();
  const resp = (await (
    supabase.from("partner_doc_templates" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => Promise<SbResp<CustomTemplate>>;
      };
    }
  )
    .select("*")
    .eq("partner_id", partnerId)) as SbResp<CustomTemplate>;

  for (const row of resp.data ?? []) {
    map.set(row.doc_type, row);
  }
  return map;
}

/**
 * 특정 doc_type 조회 (없으면 null)
 */
export async function loadPartnerCustomTemplate(
  partnerId: string,
  docType: string
): Promise<CustomTemplate | null> {
  if (!partnerId || !docType) return null;

  const supabase = await createClient();
  const resp = (await (
    supabase.from("partner_doc_templates" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          eq: (k: string, v: string) => {
            maybeSingle: () => Promise<SbRespOne<CustomTemplate>>;
          };
        };
      };
    }
  )
    .select("*")
    .eq("partner_id", partnerId)
    .eq("doc_type", docType)
    .maybeSingle()) as SbRespOne<CustomTemplate>;

  return resp.data ?? null;
}

/**
 * orgId로 조회 (기관 측에서 쓸 때 편의)
 * partner_orgs → partner_id 조회 후 템플릿 조회
 */
export async function loadCustomTemplateForOrg(
  orgId: string,
  docType: string
): Promise<CustomTemplate | null> {
  if (!orgId || !docType) return null;

  const supabase = await createClient();
  const orgResp = (await (
    supabase.from("partner_orgs" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          maybeSingle: () => Promise<
            SbRespOne<{ partner_id: string | null }>
          >;
        };
      };
    }
  )
    .select("partner_id")
    .eq("id", orgId)
    .maybeSingle()) as SbRespOne<{ partner_id: string | null }>;

  const partnerId = orgResp.data?.partner_id;
  if (!partnerId) return null;

  return loadPartnerCustomTemplate(partnerId, docType);
}
