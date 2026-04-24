"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAppUser } from "@/lib/user-auth-guard";
import { hashPassword, verifyPassword } from "@/lib/password";
import { loadAppUserById, loadChildrenForUser } from "@/lib/app-user/queries";
import { computeOnboardingProgress } from "@/lib/app-user/onboarding";

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
  } as never)) as { error: { message: string } | null };

  if (error) throw new Error(error.message ?? "아이 추가에 실패했어요");

  revalidatePath("/profile");
  revalidatePath("/home");
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
    .update({ name, birth_date, gender, is_enrolled } as never)
    .eq("id", childId)
    .eq("user_id", user.id)) as { error: { message: string } | null };

  if (error) throw new Error(error.message ?? "수정에 실패했어요");

  revalidatePath("/profile");
  revalidatePath("/home");
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

  const { error: insErr } = (await (
    supabase.from("app_children" as never) as unknown as {
      insert: (p: unknown) => Promise<{ error: { message: string } | null }>;
    }
  ).insert({
    user_id: session.id,
    name,
    birth_date,
    gender: genderRaw,
    is_enrolled: false, // 온보딩에서 추가하는 건 형제/자매
  } as never)) as { error: { message: string } | null };

  if (insErr) {
    return { ok: false, error: insErr.message ?? "자녀 추가 실패" };
  }

  const nextBalance = (user.acorn_balance ?? 0) + 1;
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
