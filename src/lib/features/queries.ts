import { createClient } from "@/lib/supabase/server";
import type {
  PlatformFeature,
  PartnerFeatureGrant,
  PackTier,
  FeatureStatus,
} from "./types";

type SupabaseLooseTable = {
  select: (cols: string) => {
    eq: (k: string, v: string) => SupabaseLooseTable;
    in: (k: string, v: string[]) => SupabaseLooseTable;
    order: (
      col: string,
      opts?: { ascending: boolean }
    ) => SupabaseLooseTable & {
      then: Promise<{ data: unknown; error: unknown }>["then"];
    };
    maybeSingle: () => Promise<{ data: unknown; error: unknown }>;
    single: () => Promise<{ data: unknown; error: unknown }>;
  };
};

function loose(t: ReturnType<typeof getFrom>): SupabaseLooseTable {
  return t as unknown as SupabaseLooseTable;
}

function getFrom(supabase: Awaited<ReturnType<typeof createClient>>, table: string) {
  return (
    supabase as unknown as {
      from: (t: string) => unknown;
    }
  ).from(table);
}

// ---------------------------------------------------------------------------
// platform_features
// ---------------------------------------------------------------------------

export async function listAllFeatures(): Promise<PlatformFeature[]> {
  const supabase = await createClient();
  const { data, error } = await (
    loose(getFrom(supabase, "platform_features")) as unknown as {
      select: (c: string) => {
        order: (
          c: string,
          o: { ascending: boolean }
        ) => Promise<{ data: PlatformFeature[] | null; error: unknown }>;
      };
    }
  )
    .select("*")
    .order("sort_order", { ascending: true });
  if (error) {
    console.error("[features] listAllFeatures failed", error);
    return [];
  }
  return data ?? [];
}

export async function getFeatureByCode(
  code: string
): Promise<PlatformFeature | null> {
  const supabase = await createClient();
  const { data, error } = await (
    loose(getFrom(supabase, "platform_features")) as unknown as {
      select: (c: string) => {
        eq: (
          c: string,
          v: string
        ) => {
          maybeSingle: () => Promise<{
            data: PlatformFeature | null;
            error: unknown;
          }>;
        };
      };
    }
  )
    .select("*")
    .eq("code", code)
    .maybeSingle();
  if (error) {
    console.error("[features] getFeatureByCode failed", error);
    return null;
  }
  return data;
}

// ---------------------------------------------------------------------------
// partner_feature_grants — 통계용 카운트
// ---------------------------------------------------------------------------

export type FeatureWithStats = PlatformFeature & {
  active_grant_count: number;
};

export async function listAllFeaturesWithStats(): Promise<FeatureWithStats[]> {
  const supabase = await createClient();
  const features = await listAllFeatures();
  if (features.length === 0) return [];

  const { data, error } = await (
    loose(getFrom(supabase, "partner_feature_grants")) as unknown as {
      select: (c: string) => {
        eq: (
          c: string,
          v: string
        ) => Promise<{
          data: { feature_code: string }[] | null;
          error: unknown;
        }>;
      };
    }
  )
    .select("feature_code")
    .eq("status", "ACTIVE");

  if (error) {
    console.error("[features] grants count failed", error);
    return features.map((f) => ({ ...f, active_grant_count: 0 }));
  }

  const counts = new Map<string, number>();
  for (const row of data ?? []) {
    counts.set(row.feature_code, (counts.get(row.feature_code) ?? 0) + 1);
  }

  return features.map((f) => ({
    ...f,
    active_grant_count: counts.get(f.code) ?? 0,
  }));
}

// ---------------------------------------------------------------------------
// 입력 검증
// ---------------------------------------------------------------------------

export function isValidPackTier(v: unknown): v is PackTier {
  return v === "BASIC" || v === "OPTIONAL" || v === "HIDDEN";
}

export function isValidFeatureStatus(v: unknown): v is FeatureStatus {
  return v === "DRAFT" || v === "BETA" || v === "GA" || v === "DEPRECATED";
}

// 추후 phase 에서 가져갈 grant 조회 함수 — 지금은 admin 만 사용
export async function listGrantsForFeature(
  featureCode: string
): Promise<PartnerFeatureGrant[]> {
  const supabase = await createClient();
  const { data, error } = await (
    loose(getFrom(supabase, "partner_feature_grants")) as unknown as {
      select: (c: string) => {
        eq: (
          c: string,
          v: string
        ) => {
          eq: (
            c: string,
            v: string
          ) => {
            order: (
              c: string,
              o: { ascending: boolean }
            ) => Promise<{
              data: PartnerFeatureGrant[] | null;
              error: unknown;
            }>;
          };
        };
      };
    }
  )
    .select("*")
    .eq("feature_code", featureCode)
    .eq("status", "ACTIVE")
    .order("granted_at", { ascending: false });
  if (error) {
    console.error("[features] listGrantsForFeature failed", error);
    return [];
  }
  return data ?? [];
}

export async function listGrantsForPartner(
  partnerId: string
): Promise<PartnerFeatureGrant[]> {
  const supabase = await createClient();
  const { data, error } = await (
    loose(getFrom(supabase, "partner_feature_grants")) as unknown as {
      select: (c: string) => {
        eq: (
          c: string,
          v: string
        ) => {
          eq: (
            c: string,
            v: string
          ) => Promise<{
            data: PartnerFeatureGrant[] | null;
            error: unknown;
          }>;
        };
      };
    }
  )
    .select("*")
    .eq("partner_id", partnerId)
    .eq("status", "ACTIVE");
  if (error) {
    console.error("[features] listGrantsForPartner failed", error);
    return [];
  }
  return data ?? [];
}
