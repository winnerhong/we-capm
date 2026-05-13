"use server";

// 기관 자체 코스 (org_trails) CRUD 서버 액션.
// 권한: requireOrg 로 세션의 orgId 확인 후, 해당 행이 같은 org_id 인지 검사.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireOrg } from "@/lib/org-auth-guard";
import { loadOrgTrailById } from "@/lib/trails/queries";
import { generateQrCode } from "@/lib/trails/qr-code";

type Row = Record<string, unknown>;

function str(v: FormDataEntryValue | null): string {
  return String(v ?? "").trim();
}

function strOrNull(v: FormDataEntryValue | null): string | null {
  const s = str(v);
  return s === "" ? null : s;
}

/* -------------------------------------------------------------------------- */
/* Create                                                                     */
/* -------------------------------------------------------------------------- */

export async function createOrgTrailAction(formData: FormData): Promise<void> {
  const session = await requireOrg();

  const name = str(formData.get("name"));
  if (!name) throw new Error("코스 이름을 입력해 주세요");
  const description = strOrNull(formData.get("description"));
  const cover_image_url = strOrNull(formData.get("cover_image_url"));

  const supabase = await createClient();
  const resp = (await (
    supabase.from("org_trails" as never) as unknown as {
      insert: (r: Row) => {
        select: (c: string) => {
          maybeSingle: () => Promise<{
            data: { id: string } | null;
            error: { message: string } | null;
          }>;
        };
      };
    }
  )
    .insert({
      org_id: session.orgId,
      name,
      description,
      cover_image_url,
      qr_code: generateQrCode(),
    })
    .select("id")
    .maybeSingle()) as {
    data: { id: string } | null;
    error: { message: string } | null;
  };

  if (resp.error || !resp.data?.id) {
    throw new Error(`코스 등록 실패: ${resp.error?.message ?? "unknown"}`);
  }

  revalidatePath(`/org/${session.orgId}/trails`);
  redirect(`/org/${session.orgId}/trails`);
}

/* -------------------------------------------------------------------------- */
/* Ensure QR code (기존 행에 qr_code 가 없으면 발급)                            */
/* -------------------------------------------------------------------------- */

export async function ensureOrgTrailQrCodeAction(id: string): Promise<string> {
  const session = await requireOrg();
  const existing = await loadOrgTrailById(id);
  if (!existing) throw new Error("코스를 찾을 수 없어요");
  if (existing.org_id !== session.orgId) throw new Error("권한이 없어요");

  if (existing.qr_code) return existing.qr_code;

  const supabase = await createClient();
  const qr_code = generateQrCode();
  const { error } = await (
    supabase.from("org_trails" as never) as unknown as {
      update: (r: Row) => {
        eq: (
          k: string,
          v: string
        ) => Promise<{ error: { message: string } | null }>;
      };
    }
  )
    .update({ qr_code })
    .eq("id", id);
  if (error) throw new Error(`QR 발급 실패: ${error.message}`);
  return qr_code;
}

/* -------------------------------------------------------------------------- */
/* Update                                                                     */
/* -------------------------------------------------------------------------- */

export async function updateOrgTrailAction(
  id: string,
  formData: FormData
): Promise<void> {
  const session = await requireOrg();
  if (!id) throw new Error("코스를 찾을 수 없어요");

  const existing = await loadOrgTrailById(id);
  if (!existing) throw new Error("코스를 찾을 수 없어요");
  if (existing.org_id !== session.orgId) {
    throw new Error("권한이 없어요");
  }

  const name = str(formData.get("name"));
  if (!name) throw new Error("코스 이름을 입력해 주세요");
  const description = strOrNull(formData.get("description"));
  const cover_image_url = strOrNull(formData.get("cover_image_url"));

  const supabase = await createClient();
  const { error } = await (
    supabase.from("org_trails" as never) as unknown as {
      update: (r: Row) => {
        eq: (
          k: string,
          v: string
        ) => Promise<{ error: { message: string } | null }>;
      };
    }
  )
    .update({ name, description, cover_image_url })
    .eq("id", id);

  if (error) throw new Error(`코스 수정 실패: ${error.message}`);

  revalidatePath(`/org/${session.orgId}/trails`);
  revalidatePath(`/org/${session.orgId}/trails/own/${id}/edit`);
  redirect(`/org/${session.orgId}/trails`);
}

/* -------------------------------------------------------------------------- */
/* Delete                                                                     */
/* -------------------------------------------------------------------------- */

export async function deleteOrgTrailAction(id: string): Promise<void> {
  const session = await requireOrg();
  if (!id) throw new Error("코스를 찾을 수 없어요");

  const existing = await loadOrgTrailById(id);
  if (!existing) throw new Error("코스를 찾을 수 없어요");
  if (existing.org_id !== session.orgId) {
    throw new Error("권한이 없어요");
  }

  const supabase = await createClient();
  const { error } = await (
    supabase.from("org_trails" as never) as unknown as {
      delete: () => {
        eq: (
          k: string,
          v: string
        ) => Promise<{ error: { message: string } | null }>;
      };
    }
  )
    .delete()
    .eq("id", id);

  if (error) throw new Error(`코스 삭제 실패: ${error.message}`);

  revalidatePath(`/org/${session.orgId}/trails`);
}
