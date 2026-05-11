"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth-guard";
import { createClient } from "@/lib/supabase/server";
import { hashPassword } from "@/lib/password";

type PartnerTier = "SPROUT" | "EXPLORER" | "TREE" | "FOREST" | "LEGEND";
type PartnerStatus = "PENDING" | "ACTIVE" | "SUSPENDED" | "CLOSED";

const TIER_SET = new Set<PartnerTier>(["SPROUT", "EXPLORER", "TREE", "FOREST", "LEGEND"]);
const STATUS_SET = new Set<PartnerStatus>(["PENDING", "ACTIVE", "SUSPENDED", "CLOSED"]);

export async function createPartnerAction(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();

  const name = String(formData.get("name") ?? "").trim();
  const business_name = String(formData.get("business_name") ?? "").trim() || null;
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const email = String(formData.get("email") ?? "").trim() || null;
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const tierRaw = String(formData.get("tier") ?? "SPROUT");
  const tier: PartnerTier = TIER_SET.has(tierRaw as PartnerTier) ? (tierRaw as PartnerTier) : "SPROUT";
  const commission_rate = Number(formData.get("commission_rate") ?? 20);
  const statusRaw = String(formData.get("status") ?? "ACTIVE");
  const status: PartnerStatus = STATUS_SET.has(statusRaw as PartnerStatus) ? (statusRaw as PartnerStatus) : "ACTIVE";

  if (!name || !username || !password) {
    throw new Error("필수 항목이 비어있습니다 (상호/아이디/비밀번호)");
  }
  if (Number.isNaN(commission_rate) || commission_rate < 0 || commission_rate > 100) {
    throw new Error("커미션율은 0~100 사이여야 합니다");
  }

  // 아이디 중복 확인
  const { data: existing } = await (supabase as unknown as { from: (t: string) => { select: (c: string) => { eq: (k: string, v: string) => { maybeSingle: () => Promise<{ data: { id: string } | null }> } } } })
    .from("partners")
    .select("id")
    .eq("username", username)
    .maybeSingle();

  if (existing) {
    throw new Error("이미 사용 중인 아이디입니다");
  }

  const hashedPassword = await hashPassword(password);

  const { error } = await (supabase as unknown as { from: (t: string) => { insert: (row: Record<string, unknown>) => Promise<{ error: { message: string } | null }> } })
    .from("partners")
    .insert({
      name,
      business_name,
      username,
      password: hashedPassword,
      email,
      phone,
      tier,
      commission_rate,
      status,
    });

  if (error) throw new Error(error.message);

  revalidatePath("/admin/partners");
  redirect("/admin/partners");
}

export async function updatePartnerStatusAction(id: string, status: string) {
  await requireAdmin();
  if (!STATUS_SET.has(status as PartnerStatus)) {
    throw new Error("잘못된 상태값입니다");
  }
  const supabase = await createClient();
  const { error } = await (supabase as unknown as { from: (t: string) => { update: (p: Record<string, unknown>) => { eq: (k: string, v: string) => Promise<{ error: { message: string } | null }> } } })
    .from("partners")
    .update({ status })
    .eq("id", id);

  if (error) throw new Error(error.message);

  revalidatePath("/admin/partners");
}

export async function updatePartnerTierAction(id: string, tier: string) {
  await requireAdmin();
  if (!TIER_SET.has(tier as PartnerTier)) {
    throw new Error("잘못된 등급입니다");
  }
  const supabase = await createClient();
  const { error } = await (supabase as unknown as { from: (t: string) => { update: (p: Record<string, unknown>) => { eq: (k: string, v: string) => Promise<{ error: { message: string } | null }> } } })
    .from("partners")
    .update({ tier })
    .eq("id", id);

  if (error) throw new Error(error.message);

  revalidatePath("/admin/partners");
}

/**
 * 지사(partner) 삭제 — 의존 데이터 있으면 차단, 없으면 DELETE.
 *
 * 운영상 partner 삭제는 매우 위험: CASCADE 체인이 partner_orgs → org_events →
 * org_event_participants → app_users 자녀(app_children/user_gifts/...) 까지 줄줄이
 * 날아간다. 실수로 살아있는 기관·행사가 있는 지사를 지우면 학부모·아이까지 증발.
 *
 * 안전 정책:
 *  1) partner_orgs / org_events / partner_trails 에 한 건이라도 있으면 거부.
 *     → 사용자에게 "먼저 [상태: 폐업]으로 변경하거나 데이터를 정리해 주세요" 안내.
 *  2) 의존 없는 경우에만 실제 DELETE.
 *  3) revalidatePath 대신 redirect 로 새 페이지 진입 → stale cache 재렌더 회피.
 */
export async function deletePartnerAction(id: string) {
  await requireAdmin();
  if (!id) throw new Error("지사 정보가 없습니다");
  const supabase = await createClient();

  // 1) 의존 데이터 카운트 — count: 'exact' + head: true 로 가벼운 쿼리.
  type CountResp = { count: number | null; error: { message: string } | null };
  type CountTable = {
    select: (
      c: string,
      o: { count: "exact"; head: true }
    ) => {
      eq: (k: string, v: string) => Promise<CountResp>;
    };
  };

  async function countDep(table: string, fk: string): Promise<number> {
    const resp = (await (
      supabase.from(table as never) as unknown as CountTable
    )
      .select("id", { count: "exact", head: true })
      .eq(fk, id)) as CountResp;
    if (resp.error) {
      // 테이블 미존재(42P01) 같은 케이스는 0 으로 처리 — 빌드 환경 호환.
      return 0;
    }
    return resp.count ?? 0;
  }

  const [orgCount, trailCount, programCount] = await Promise.all([
    countDep("partner_orgs", "partner_id"),
    countDep("partner_trails", "partner_id"),
    countDep("partner_programs", "partner_id"),
  ]);

  // org_events 는 partner 직접 FK 가 없고 partner_orgs 를 거치므로,
  // partner_orgs > 0 이면 자연히 막힘 — 별도 count 불필요.

  if (orgCount > 0 || trailCount > 0 || programCount > 0) {
    const parts: string[] = [];
    if (orgCount > 0) parts.push(`기관 ${orgCount}곳`);
    if (trailCount > 0) parts.push(`숲길 ${trailCount}개`);
    if (programCount > 0) parts.push(`프로그램 ${programCount}개`);
    throw new Error(
      `이 지사에 ${parts.join(" · ")} 가 연결되어 있어 삭제할 수 없어요. ` +
        `먼저 데이터를 정리하거나 상태를 "폐업"으로 변경해 주세요.`
    );
  }

  // 2) 실제 DELETE — 의존 없음 확정.
  const { error } = await (
    supabase as unknown as {
      from: (t: string) => {
        delete: () => {
          eq: (
            k: string,
            v: string
          ) => Promise<{ error: { message: string; code?: string } | null }>;
        };
      };
    }
  )
    .from("partners")
    .delete()
    .eq("id", id);

  if (error) {
    // FK 위반(23503) 등은 친절한 메시지로.
    if (error.code === "23503") {
      throw new Error(
        "삭제하기 전에 이 지사에 연결된 데이터를 먼저 정리해 주세요"
      );
    }
    throw new Error(error.message);
  }

  // 3) revalidate + redirect — 새 진입으로 stale cache 회피.
  revalidatePath("/admin/partners");
  redirect("/admin/partners");
}
