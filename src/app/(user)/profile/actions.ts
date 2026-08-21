"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAppUser } from "@/lib/user-auth-guard";
import { hashPassword, verifyPassword } from "@/lib/password";
import { loadAppUserById, loadChildrenForUser } from "@/lib/app-user/queries";
import { computeOnboardingProgress } from "@/lib/app-user/onboarding";
import { insertAcornTx } from "@/lib/app-user/acorn-ledger";

/** 이 보호자가 가장 먼저 참가한 행사 — 행사 특정이 안 되는 지급의 귀속처. */
async function firstJoinedEventId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
): Promise<string | null> {
  try {
    const resp = (await (
      supabase.from("org_event_participants" as never) as unknown as {
        select: (c: string) => {
          eq: (
            k: string,
            v: string
          ) => {
            order: (
              c: string,
              o: { ascending: boolean }
            ) => {
              limit: (
                n: number
              ) => Promise<{ data: { event_id: string }[] | null }>;
            };
          };
        };
      }
    )
      .select("event_id")
      .eq("user_id", userId)
      .order("joined_at", { ascending: true })
      .limit(1)) as { data: { event_id: string }[] | null };
    return resp.data?.[0]?.event_id ?? null;
  } catch {
    return null;
  }
}

/**
 * 도토리 지급을 원장(user_acorn_transactions)에도 기록.
 *
 * 온보딩 보상·형제 보너스는 오랫동안 app_users.acorn_balance 만 올리고 원장을
 * 남기지 않았다. 그 결과 231명 중 79명의 잔액이 원장 합계와 어긋나 있었고,
 * 도토리를 행사 단위로 집계할 수가 없었다(원장에 없는 건 귀속할 곳이 없다).
 * 지급 경로는 전부 원장을 남긴다 — 잔액은 원장의 파생값이어야 한다.
 *
 * best-effort: 실패해도 지급 자체를 막지 않는다(미션 지급 경로와 동일한 정책).
 */
async function recordAcornGrant(
  supabase: Awaited<ReturnType<typeof createClient>>,
  input: {
    userId: string;
    amount: number;
    reason: string;
    sourceType: string;
    sourceId: string | null;
    memo: string;
  }
): Promise<void> {
  // 온보딩 보상은 특정 행사의 것이 아니다 — 그 보호자가 가장 먼저 참가한
  // 행사에 귀속시킨다(마이그레이션의 잔여분 처리와 같은 규칙).
  const eventId = await firstJoinedEventId(supabase, input.userId);

  const resp = (await insertAcornTx(supabase, {
    user_id: input.userId,
    amount: input.amount,
    reason: input.reason,
    source_type: input.sourceType,
    source_id: input.sourceId,
    memo: input.memo,
    event_id: eventId,
  })) as { error: { message: string } | null };

  if (resp.error) {
    console.error("[profile/recordAcornGrant] tx insert error", resp.error);
  }
}

function toStr(v: FormDataEntryValue | null, fallback = ""): string {
  if (v === null) return fallback;
  return String(v).trim();
}

function toNullStr(v: FormDataEntryValue | null): string | null {
  const s = toStr(v);
  return s === "" ? null : s;
}

/**
 * 보호자 프로필 (이름, 알림 동의) 수정
 */
export async function updateProfileAction(formData: FormData): Promise<void> {
  const user = await requireAppUser();
  const parent_name = toStr(formData.get("parent_name"));
  if (!parent_name) throw new Error("이름을 입력해주세요");
  const notification_consent =
    toStr(formData.get("notification_consent")) === "on";

  const supabase = await createClient();
  const { error } = (await (
    supabase.from("app_users" as never) as unknown as {
      update: (p: unknown) => {
        eq: (k: string, v: string) => Promise<{ error: { message: string } | null }>;
      };
    }
  )
    .update({ parent_name, notification_consent } as never)
    .eq("id", user.id)) as { error: { message: string } | null };

  if (error) throw new Error(error.message ?? "저장에 실패했어요");

  revalidatePath("/profile");
  revalidatePath("/home");
}

/**
 * 보호자 이름만 업데이트 — 온보딩 위저드 등에서 사용.
 */
export async function updateParentNameAction(
  parentName: string
): Promise<void> {
  const user = await requireAppUser();
  const name = (parentName ?? "").trim();
  if (!name) throw new Error("이름을 입력해주세요");

  const supabase = await createClient();
  const { error } = (await (
    supabase.from("app_users" as never) as unknown as {
      update: (p: unknown) => {
        eq: (
          k: string,
          v: string
        ) => Promise<{ error: { message: string } | null }>;
      };
    }
  )
    .update({ parent_name: name } as never)
    .eq("id", user.id)) as { error: { message: string } | null };

  if (error) throw new Error(error.message ?? "저장에 실패했어요");

  revalidatePath("/profile");
  revalidatePath("/home");
}

/**
 * 아이 추가
 */
/**
 * 생년월일 입력 정규화 + 유효성 검증.
 * - "161001" (YYMMDD 6자리) → "2016-10-01"
 * - "20161001" (YYYYMMDD 8자리) → "2016-10-01"
 * - "2016-10-01" (이미 ISO) → pass-through (검증 포함)
 * - 월/일 범위 벗어나거나 존재하지 않는 날짜(예: 2월 30일) → null
 * - 그 외 / 빈 문자열 → null
 *
 * YY 해석 규칙:
 *   YY <= 현재 YY(last 2) + 5 → 2000년대
 *   그 외                       → 1900년대
 */
function parseBirthDigits(raw: string | null): string | null {
  const v = (raw ?? "").trim();
  if (!v) return null;

  let yyyy: number;
  let mm: number;
  let dd: number;

  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (isoMatch) {
    yyyy = parseInt(isoMatch[1], 10);
    mm = parseInt(isoMatch[2], 10);
    dd = parseInt(isoMatch[3], 10);
  } else {
    const digits = v.replace(/\D/g, "");
    if (digits.length === 6) {
      const yy = parseInt(digits.slice(0, 2), 10);
      mm = parseInt(digits.slice(2, 4), 10);
      dd = parseInt(digits.slice(4, 6), 10);
      const nowYY = new Date().getFullYear() % 100;
      const century = yy <= nowYY + 5 ? 2000 : 1900;
      yyyy = century + yy;
    } else if (digits.length === 8) {
      yyyy = parseInt(digits.slice(0, 4), 10);
      mm = parseInt(digits.slice(4, 6), 10);
      dd = parseInt(digits.slice(6, 8), 10);
    } else {
      return null;
    }
  }

  // 범위 체크
  if (mm < 1 || mm > 12) return null;
  if (dd < 1 || dd > 31) return null;
  if (yyyy < 1900 || yyyy > 2100) return null;

  // 실제 달력상 유효한 날짜인지 검증 (예: 2월 30일 거부)
  const d = new Date(Date.UTC(yyyy, mm - 1, dd));
  if (
    d.getUTCFullYear() !== yyyy ||
    d.getUTCMonth() !== mm - 1 ||
    d.getUTCDate() !== dd
  ) {
    return null;
  }

  const mmStr = String(mm).padStart(2, "0");
  const ddStr = String(dd).padStart(2, "0");
  return `${yyyy}-${mmStr}-${ddStr}`;
}

export async function addChildAction(formData: FormData): Promise<void> {
  const user = await requireAppUser();
  const name = toStr(formData.get("name"));
  if (!name) throw new Error("아이 이름을 입력해주세요");
  const birth_date = parseBirthDigits(toNullStr(formData.get("birth_date")));
  const genderRaw = toStr(formData.get("gender")).toUpperCase();
  const gender = genderRaw === "M" || genderRaw === "F" ? genderRaw : null;
  const notes = toNullStr(formData.get("notes"));
  const enrolledRaw = toStr(formData.get("is_enrolled"));
  const is_enrolled =
    enrolledRaw === "1" || enrolledRaw === "true" || enrolledRaw === "on";
  const class_name = toNullStr(formData.get("class_name"));

  const supabase = await createClient();
  const { error } = (await (
    supabase.from("app_children" as never) as unknown as {
      insert: (p: unknown) => Promise<{ error: { message: string } | null }>;
    }
  ).insert({
    user_id: user.id,
    name,
    birth_date,
    gender,
    notes,
    is_enrolled,
    class_name,
  } as never)) as { error: { message: string } | null };

  if (error) throw new Error(error.message ?? "아이 추가에 실패했어요");

  // 토리톡 자동 가입
  if (class_name && class_name.trim().length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any;
    try {
      await sb.rpc("toritalk_ensure_room_membership", {
        p_org_id: user.orgId,
        p_class_name: class_name,
        p_user_id: user.id,
      });
    } catch {
      /* swallow */
    }
  }

  revalidatePath("/profile");
  revalidatePath("/home");
  revalidatePath("/tori-talk");
}

/**
 * 기존 아이 정보 업데이트 — 본인(app_user) 소유 자녀만 수정 가능.
 */
export async function updateChildAction(
  childId: string,
  formData: FormData
): Promise<void> {
  const user = await requireAppUser();
  if (!childId) throw new Error("잘못된 요청이에요");

  const name = toStr(formData.get("name"));
  if (!name) throw new Error("아이 이름을 입력해주세요");
  const birth_date = parseBirthDigits(toNullStr(formData.get("birth_date")));
  const genderRaw = toStr(formData.get("gender")).toUpperCase();
  const gender = genderRaw === "M" || genderRaw === "F" ? genderRaw : null;
  const enrolledRaw = toStr(formData.get("is_enrolled"));
  const is_enrolled =
    enrolledRaw === "1" || enrolledRaw === "true" || enrolledRaw === "on";
  const class_name = toNullStr(formData.get("class_name"));

  const supabase = await createClient();
  const { error } = (await (
    supabase.from("app_children" as never) as unknown as {
      update: (p: unknown) => {
        eq: (k: string, v: string) => {
          eq: (
            k: string,
            v: string
          ) => Promise<{ error: { message: string } | null }>;
        };
      };
    }
  )
    .update({ name, birth_date, gender, is_enrolled, class_name } as never)
    .eq("id", childId)
    .eq("user_id", user.id)) as { error: { message: string } | null };

  if (error) throw new Error(error.message ?? "수정에 실패했어요");

  // 토리톡 자동 가입 — 새/변경된 반명 기준
  if (class_name && class_name.trim().length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any;
    try {
      await sb.rpc("toritalk_ensure_room_membership", {
        p_org_id: user.orgId,
        p_class_name: class_name,
        p_user_id: user.id,
      });
    } catch {
      /* swallow */
    }
  }

  revalidatePath("/profile");
  revalidatePath("/home");
  revalidatePath("/tori-talk");
}

/**
 * 아이 삭제 — childId bound via .bind(null, id)
 */
export async function removeChildAction(childId: string): Promise<void> {
  const user = await requireAppUser();
  if (!childId) throw new Error("잘못된 요청이에요");

  const supabase = await createClient();
  const { error } = (await (
    supabase.from("app_children" as never) as unknown as {
      delete: () => {
        eq: (k: string, v: string) => {
          eq: (k: string, v: string) => Promise<{ error: { message: string } | null }>;
        };
      };
    }
  )
    .delete()
    .eq("id", childId)
    .eq("user_id", user.id)) as { error: { message: string } | null };

  if (error) throw new Error(error.message ?? "삭제에 실패했어요");

  revalidatePath("/profile");
  revalidatePath("/home");
}

/**
 * 비밀번호 변경
 */
export async function changePasswordAction(formData: FormData): Promise<void> {
  const user = await requireAppUser();
  const old_pw = toStr(formData.get("old_pw"));
  const new_pw = toStr(formData.get("new_pw"));
  const confirm_pw = toStr(formData.get("confirm_pw"));

  if (!old_pw || !new_pw || !confirm_pw)
    throw new Error("모든 칸을 입력해주세요");
  if (new_pw.length < 4)
    throw new Error("새 비밀번호는 4자 이상이어야 해요");
  if (new_pw !== confirm_pw) throw new Error("새 비밀번호 확인이 맞지 않아요");
  if (new_pw === old_pw)
    throw new Error("기존 비밀번호와 다르게 설정해주세요");

  const row = await loadAppUserById(user.id);
  if (!row) throw new Error("계정을 찾을 수 없어요");

  const matched = await verifyPassword(old_pw, row.password_hash);
  if (!matched) throw new Error("기존 비밀번호가 맞지 않아요");

  const newHash = await hashPassword(new_pw);
  const supabase = await createClient();
  const { error } = (await (
    supabase.from("app_users" as never) as unknown as {
      update: (p: unknown) => {
        eq: (k: string, v: string) => Promise<{ error: { message: string } | null }>;
      };
    }
  )
    .update({ password_hash: newHash } as never)
    .eq("id", user.id)) as { error: { message: string } | null };

  if (error) throw new Error(error.message ?? "비밀번호 변경에 실패했어요");

  revalidatePath("/profile");
}

// 온보딩 형제/자매 보너스 상한 — 2회 (기본 1 + 보너스 2 = 총 3개 도토리)
const ONBOARDING_BONUS_LIMIT = 2;

/**
 * 온보딩 중 형제/자매 추가 — 성 검증 통과 시 +1 도토리 보상 (상한 2회).
 *
 * 검증:
 *  - 이름 필수, 생년월일 YYMMDD 6자리(또는 8자리 YYYYMMDD) 필수
 *  - 성별 M/F 필수
 *  - 성(한글 첫 글자)이 기존 자녀 중 하나와 일치해야 함
 *  - 이미 보너스 2회 지급받았으면 거부
 */
export async function addBonusSiblingAction(formData: FormData): Promise<{
  ok: true;
  newBalance: number;
  bonusCount: number;
} | {
  ok: false;
  error: string;
}> {
  const session = await requireAppUser();

  const name = toStr(formData.get("name"));
  const birthDigits = toStr(formData.get("birth_date")).replace(/\D/g, "");
  const genderRaw = toStr(formData.get("gender")).toUpperCase();

  if (!name) return { ok: false, error: "이름을 입력해 주세요" };
  if (genderRaw !== "M" && genderRaw !== "F") {
    return { ok: false, error: "성별을 선택해 주세요" };
  }
  if (birthDigits.length !== 6 && birthDigits.length !== 8) {
    return { ok: false, error: "생년월일은 6자리(YYMMDD)로 입력해 주세요" };
  }
  const birth_date = parseBirthDigits(birthDigits);
  if (!birth_date) {
    return {
      ok: false,
      error: "생년월일이 올바르지 않아요 (월은 01~12, 일은 달에 맞게)",
    };
  }

  // 성 검증 — 기존 자녀가 1명이라도 있어야, 그리고 성이 일치해야 함
  const existing = await loadChildrenForUser(session.id);
  if (existing.length === 0) {
    return {
      ok: false,
      error: "기존 자녀가 없어서 형제/자매를 추가할 수 없어요",
    };
  }
  const newSurname = (name.trim().charAt(0) ?? "").trim();
  const knownSurnames = new Set(
    existing.map((c) => (c.name.trim().charAt(0) ?? "").trim())
  );
  if (!newSurname || !knownSurnames.has(newSurname)) {
    return {
      ok: false,
      error: `성이 기존 자녀와 달라요 (기존: ${Array.from(knownSurnames).join("·")})`,
    };
  }

  // 보너스 상한 체크
  const user = await loadAppUserById(session.id);
  if (!user) return { ok: false, error: "계정을 찾을 수 없어요" };

  const prevBonusCount = user.onboarding_bonus_count ?? 0;
  if (prevBonusCount >= ONBOARDING_BONUS_LIMIT) {
    return {
      ok: false,
      error: `도토리는 최대 ${ONBOARDING_BONUS_LIMIT}개까지 받을 수 있어요`,
    };
  }

  const supabase = await createClient();

  const { data: newChild, error: insErr } = (await (
    supabase.from("app_children" as never) as unknown as {
      insert: (p: unknown) => {
        select: (c: string) => {
          single: () => Promise<{
            data: { id: string } | null;
            error: { message: string } | null;
          }>;
        };
      };
    }
  )
    .insert({
      user_id: session.id,
      name,
      birth_date,
      gender: genderRaw,
      is_enrolled: false, // 온보딩에서 추가하는 건 형제/자매
    } as never)
    .select("id")
    .single()) as {
    data: { id: string } | null;
    error: { message: string } | null;
  };

  if (insErr) {
    return { ok: false, error: insErr.message ?? "자녀 추가 실패" };
  }

  const nextBalance = (user.acorn_balance ?? 0) + 1;

  // 잔액을 올리기 전에 원장부터 — 순서가 뒤집히면 실패 시 잔액만 늘어난다.
  await recordAcornGrant(supabase, {
    userId: session.id,
    amount: 1,
    reason: "ONBOARDING_SIBLING",
    sourceType: "onboarding_sibling",
    sourceId: newChild?.id ?? null,
    memo: `형제·자매 등록 보너스 (${name})`,
  });
  const nextBonusCount = prevBonusCount + 1;
  const { error: updErr } = (await (
    supabase.from("app_users" as never) as unknown as {
      update: (p: unknown) => {
        eq: (
          k: string,
          v: string
        ) => Promise<{ error: { message: string } | null }>;
      };
    }
  )
    .update({
      acorn_balance: nextBalance,
      onboarding_bonus_count: nextBonusCount,
    } as never)
    .eq("id", session.id)) as { error: { message: string } | null };

  if (updErr) {
    console.error("[addBonusSibling] balance update error", updErr);
  }

  revalidatePath("/profile");
  revalidatePath("/home");

  return { ok: true, newBalance: nextBalance, bonusCount: nextBonusCount };
}

/**
 * 온보딩 완료 시 도토리 1개 보상 — 멱등.
 * 조건:
 *   - 모든 필수 정보가 완료 상태 (allDone)
 *   - onboarding_rewarded = false
 * 이미 지급 받았거나 미완료면 조용히 { rewarded: false } 반환.
 */
export async function claimOnboardingRewardAction(): Promise<{
  rewarded: boolean;
  newBalance: number;
}> {
  const session = await requireAppUser();

  const [user, children] = await Promise.all([
    loadAppUserById(session.id),
    loadChildrenForUser(session.id),
  ]);

  if (!user) return { rewarded: false, newBalance: 0 };
  if (user.onboarding_rewarded) {
    return { rewarded: false, newBalance: user.acorn_balance };
  }

  const progress = computeOnboardingProgress(user, children);
  if (!progress.allDone) {
    return { rewarded: false, newBalance: user.acorn_balance };
  }

  const nextBalance = (user.acorn_balance ?? 0) + 1;

  const supabase = await createClient();

  // 원장 먼저 — onboarding_rewarded 플래그가 멱등을 보장하므로 중복 기록은 없다.
  await recordAcornGrant(supabase, {
    userId: user.id,
    amount: 1,
    reason: "ONBOARDING",
    sourceType: "onboarding",
    sourceId: user.id,
    memo: "온보딩 완료 보상",
  });

  const { error } = (await (
    supabase.from("app_users" as never) as unknown as {
      update: (p: unknown) => {
        eq: (
          k: string,
          v: string
        ) => Promise<{ error: { message: string } | null }>;
      };
    }
  )
    .update({
      onboarding_rewarded: true,
      acorn_balance: nextBalance,
    } as never)
    .eq("id", user.id)) as { error: { message: string } | null };

  if (error) throw new Error(error.message ?? "보상 지급 실패");

  revalidatePath("/profile");
  revalidatePath("/home");

  return { rewarded: true, newBalance: nextBalance };
}
