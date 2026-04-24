import { createClient } from "@/lib/supabase/server";

const BUCKET = "partner-documents";

/**
 * partner-documents 버킷의 signed URL을 생성합니다.
 * 경로가 전체 URL인 경우 그대로 반환합니다 (하위 호환).
 *
 * @param path storage path (ex. "{partnerId}/{docType}/{ts}-{rand}.pdf")
 * @param expiresInSec 기본 1시간
 */
export async function signedDocUrl(
  path: string | null | undefined,
  expiresInSec = 3600
): Promise<string | null> {
  if (!path) return null;
  // 이미 완전 URL이면 그대로
  if (/^https?:\/\//i.test(path)) return path;

  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, expiresInSec);

  if (error) {
    console.error("[signedDocUrl] failed", path, error);
    return null;
  }
  return data?.signedUrl ?? null;
}

/**
 * 여러 path를 한 번에 signed URL로 변환합니다.
 * 실패 항목은 null로 유지됩니다.
 */
export async function signedDocUrls(
  paths: Array<string | null | undefined>,
  expiresInSec = 3600
): Promise<Array<string | null>> {
  return Promise.all(paths.map((p) => signedDocUrl(p, expiresInSec)));
}
