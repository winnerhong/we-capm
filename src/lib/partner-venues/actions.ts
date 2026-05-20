"use server";

// partner_venues CRUD — 지사 행사장 카탈로그.
// requirePartner 로 소유 partner_id 확인 후 작업.

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requirePartner } from "@/lib/auth-guard";
import { parseParkingLots } from "@/lib/program-extras/parse";
import type { ParkingLot } from "@/lib/partner-programs/types";

type Row = Record<string, unknown>;
type SbErr = { message: string; code?: string } | null;
type SbRespOne<T> = { data: T | null; error: SbErr };
type SbResp<T> = { data: T[] | null; error: SbErr };

function revalidateAll(partnerId: string) {
  revalidatePath("/partner/venues");
  // org 측 행사 편집에서도 venue 목록 셀렉터를 SSR 로드 → 호출 시점에 캐시 무효.
  // 정확한 org 경로 알지 못해 layout 단위 무효.
  revalidatePath("/org", "layout");
  void partnerId;
}

/**
 * 새 행사장 생성.
 *  - name 필수, 나머지는 선택
 *  - parking_lots 는 JSON 문자열로 전달받아 parseParkingLots 로 검증
 *  - sort_order 자동 부여 (최댓값 + 10)
 */
export async function createVenueAction(input: {
  name: string;
  address?: string | null;
  imageUrl?: string | null;
  description?: string | null;
  parkingLotsJson?: string | null;
}): Promise<{ id: string }> {
  const partner = await requirePartner();
  const name = (input.name ?? "").trim();
  if (!name) throw new Error("행사장 이름을 입력해 주세요");

  const address = (input.address ?? "").trim() || null;
  const imageUrl = (input.imageUrl ?? "").trim() || null;
  const description = (input.description ?? "").trim() || null;
  const parking_lots: ParkingLot[] = parseParkingLots(
    input.parkingLotsJson ?? null
  );

  const supabase = await createClient();

  const maxResp = (await (
    supabase.from("partner_venues" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          order: (
            c: string,
            o: { ascending: boolean }
          ) => {
            limit: (n: number) => Promise<SbResp<{ sort_order: number }>>;
          };
        };
      };
    }
  )
    .select("sort_order")
    .eq("partner_id", partner.id)
    .order("sort_order", { ascending: false })
    .limit(1)) as SbResp<{ sort_order: number }>;
  const nextOrder = ((maxResp.data ?? [])[0]?.sort_order ?? 0) + 10;

  const insResp = (await (
    supabase.from("partner_venues" as never) as unknown as {
      insert: (r: Row) => {
        select: (c: string) => {
          maybeSingle: () => Promise<SbRespOne<{ id: string }>>;
        };
      };
    }
  )
    .insert({
      partner_id: partner.id,
      name,
      address,
      image_url: imageUrl,
      description,
      parking_lots,
      sort_order: nextOrder,
    } satisfies Row)
    .select("id")
    .maybeSingle()) as SbRespOne<{ id: string }>;

  if (!insResp.data?.id) {
    console.error("[partner-venues/create] failed", insResp.error);
    throw new Error("행사장 등록에 실패했어요");
  }

  revalidateAll(partner.id);
  return { id: insResp.data.id };
}

export async function updateVenueAction(input: {
  id: string;
  name?: string;
  address?: string | null;
  imageUrl?: string | null;
  description?: string | null;
  parkingLotsJson?: string | null;
}): Promise<void> {
  const partner = await requirePartner();
  const id = (input.id ?? "").trim();
  if (!id) throw new Error("행사장을 찾을 수 없어요");

  const supabase = await createClient();

  const ownResp = (await (
    supabase.from("partner_venues" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          maybeSingle: () => Promise<SbRespOne<{ partner_id: string }>>;
        };
      };
    }
  )
    .select("partner_id")
    .eq("id", id)
    .maybeSingle()) as SbRespOne<{ partner_id: string }>;
  if (!ownResp.data) throw new Error("행사장을 찾을 수 없어요");
  if (ownResp.data.partner_id !== partner.id) {
    throw new Error("다른 지사의 행사장이에요");
  }

  const patch: Row = {};
  if (typeof input.name === "string") {
    const v = input.name.trim();
    if (!v) throw new Error("행사장 이름을 입력해 주세요");
    patch.name = v;
  }
  if (input.address !== undefined) {
    patch.address = (input.address ?? "").trim() || null;
  }
  if (input.imageUrl !== undefined) {
    patch.image_url = (input.imageUrl ?? "").trim() || null;
  }
  if (input.description !== undefined) {
    patch.description = (input.description ?? "").trim() || null;
  }
  if (input.parkingLotsJson !== undefined) {
    patch.parking_lots = parseParkingLots(input.parkingLotsJson);
  }
  if (Object.keys(patch).length === 0) return;
  patch.updated_at = new Date().toISOString();

  const upd = (await (
    supabase.from("partner_venues" as never) as unknown as {
      update: (p: Row) => {
        eq: (k: string, v: string) => Promise<{ error: SbErr }>;
      };
    }
  )
    .update(patch)
    .eq("id", id)) as { error: SbErr };
  if (upd.error) {
    console.error("[partner-venues/update] error", upd.error);
    throw new Error("행사장 수정에 실패했어요");
  }

  revalidateAll(partner.id);
}

export async function archiveVenueAction(
  id: string,
  archive: boolean = true
): Promise<void> {
  const partner = await requirePartner();
  if (!id) throw new Error("행사장을 찾을 수 없어요");
  const supabase = await createClient();

  const ownResp = (await (
    supabase.from("partner_venues" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          maybeSingle: () => Promise<SbRespOne<{ partner_id: string }>>;
        };
      };
    }
  )
    .select("partner_id")
    .eq("id", id)
    .maybeSingle()) as SbRespOne<{ partner_id: string }>;
  if (!ownResp.data) throw new Error("행사장을 찾을 수 없어요");
  if (ownResp.data.partner_id !== partner.id) {
    throw new Error("다른 지사의 행사장이에요");
  }

  const upd = (await (
    supabase.from("partner_venues" as never) as unknown as {
      update: (p: Row) => {
        eq: (k: string, v: string) => Promise<{ error: SbErr }>;
      };
    }
  )
    .update({
      is_archived: archive,
      updated_at: new Date().toISOString(),
    } satisfies Row)
    .eq("id", id)) as { error: SbErr };
  if (upd.error) {
    console.error("[partner-venues/archive] error", upd.error);
    throw new Error("보관 처리에 실패했어요");
  }

  revalidateAll(partner.id);
}

export async function deleteVenueAction(id: string): Promise<void> {
  const partner = await requirePartner();
  if (!id) throw new Error("행사장을 찾을 수 없어요");
  const supabase = await createClient();

  const ownResp = (await (
    supabase.from("partner_venues" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          maybeSingle: () => Promise<SbRespOne<{ partner_id: string }>>;
        };
      };
    }
  )
    .select("partner_id")
    .eq("id", id)
    .maybeSingle()) as SbRespOne<{ partner_id: string }>;
  if (!ownResp.data) throw new Error("행사장을 찾을 수 없어요");
  if (ownResp.data.partner_id !== partner.id) {
    throw new Error("다른 지사의 행사장이에요");
  }

  const del = (await (
    supabase.from("partner_venues" as never) as unknown as {
      delete: () => {
        eq: (k: string, v: string) => Promise<{ error: SbErr }>;
      };
    }
  )
    .delete()
    .eq("id", id)) as { error: SbErr };
  if (del.error) {
    console.error("[partner-venues/delete] error", del.error);
    throw new Error("행사장 삭제에 실패했어요");
  }

  revalidateAll(partner.id);
}
