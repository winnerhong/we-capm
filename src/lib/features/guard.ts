/**
 * 기능(capability) 보유 여부 체크 헬퍼.
 * - 서버 컴포넌트 / server action 에서 호출
 * - DB: partner_feature_grants (status='ACTIVE' AND expires_at IS NULL OR > now())
 * - 캐시 없음 (단순 select). 추후 결제 도입 시 short-TTL 메모리 캐시 추가 검토.
 */
import { createClient } from "@/lib/supabase/server";

export type FeatureCheckResult = {
  hasIt: boolean;
  expiresAt: string | null;
  source: string | null;
};

export async function hasFeature(
  partnerId: string,
  code: string
): Promise<boolean> {
  const r = await getFeatureGrant(partnerId, code);
  return r.hasIt;
}

export async function getFeatureGrant(
  partnerId: string,
  code: string
): Promise<FeatureCheckResult> {
  if (!partnerId || !code) {
    return { hasIt: false, expiresAt: null, source: null };
  }
  const supabase = await createClient();
  const { data } = await (
    supabase.from("partner_feature_grants" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          eq: (k: string, v: string) => {
            eq: (k: string, v: string) => {
              maybeSingle: () => Promise<{
                data: {
                  expires_at: string | null;
                  source: string;
                } | null;
                error: unknown;
              }>;
            };
          };
        };
      };
    }
  )
    .select("expires_at,source")
    .eq("partner_id", partnerId)
    .eq("feature_code", code)
    .eq("status", "ACTIVE")
    .maybeSingle();

  if (!data) return { hasIt: false, expiresAt: null, source: null };

  // expires_at NULL = 영구
  if (data.expires_at) {
    if (new Date(data.expires_at).getTime() < Date.now()) {
      return { hasIt: false, expiresAt: data.expires_at, source: data.source };
    }
  }
  return { hasIt: true, expiresAt: data.expires_at, source: data.source };
}

/**
 * 한 번에 여러 기능을 체크. 메뉴 자물쇠 표시에 사용.
 * 반환: { [featureCode]: boolean }
 */
export async function getFeatureMap(
  partnerId: string,
  codes: string[]
): Promise<Record<string, boolean>> {
  const result: Record<string, boolean> = {};
  for (const c of codes) result[c] = false;

  if (!partnerId || codes.length === 0) return result;

  const supabase = await createClient();
  const { data } = await (
    supabase.from("partner_feature_grants" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          eq: (k: string, v: string) => {
            in: (k: string, v: string[]) => Promise<{
              data:
                | {
                    feature_code: string;
                    expires_at: string | null;
                  }[]
                | null;
              error: unknown;
            }>;
          };
        };
      };
    }
  )
    .select("feature_code,expires_at")
    .eq("partner_id", partnerId)
    .eq("status", "ACTIVE")
    .in("feature_code", codes);

  const now = Date.now();
  for (const row of data ?? []) {
    if (row.expires_at && new Date(row.expires_at).getTime() < now) continue;
    result[row.feature_code] = true;
  }
  return result;
}

export class MissingFeatureError extends Error {
  featureCode: string;
  constructor(code: string) {
    super(`기능이 부여되지 않았습니다: ${code}`);
    this.name = "MissingFeatureError";
    this.featureCode = code;
  }
}

export async function requireFeature(
  partnerId: string,
  code: string
): Promise<void> {
  const ok = await hasFeature(partnerId, code);
  if (!ok) throw new MissingFeatureError(code);
}
