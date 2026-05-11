"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireOrg } from "@/lib/org-auth-guard";
import {
  createAppUserAccountFromPhone,
  normalizeUserPhone,
} from "@/lib/app-user/account";

type SbErr = { message: string } | null;
type SbOne<T> = { data: T | null; error: SbErr };
type SbMany<T> = { data: T[] | null; error: SbErr };

type ParsedChild = {
  name: string;
  birth_date: string | null;
  is_enrolled: boolean;
  class_name: string | null;
};

function parseChildren(formData: FormData): ParsedChild[] {
  const names = formData.getAll("child_name").map((v) => String(v).trim());
  const births = formData.getAll("child_birth").map((v) => String(v).trim());
  const enrolled = formData
    .getAll("child_enrolled")
    .map((v) => String(v).trim());
  const classes = formData
    .getAll("child_class")
    .map((v) => String(v).trim());
  const out: ParsedChild[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < names.length; i++) {
    const name = names[i];
    if (!name) continue;
    if (seen.has(name)) continue;
    seen.add(name);
    const birthRaw = births[i] ?? "";
    const birth =
      /^\d{4}-\d{2}-\d{2}$/.test(birthRaw) ? birthRaw : null;
    // enrolled 플래그 — "1" / "true" 면 원생, 그 외는 형제/자매.
    // 플래그가 안 들어오는 레거시 호출은 첫 번째 아이를 원생으로 가정.
    const enrolledRaw = enrolled[i];
    const isEnrolled =
      enrolledRaw === undefined
        ? out.length === 0
        : enrolledRaw === "1" || enrolledRaw === "true";
    const className = (classes[i] ?? "").trim() || null;
    out.push({
      name,
      birth_date: birth,
      is_enrolled: isEnrolled,
      class_name: className,
    });
  }
  return out;
}

/** 가입 후 토리톡 방 자동 매핑 — 자녀들의 unique class_name 마다 RPC 호출. */
async function syncToritalkMembershipsFromChildren(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orgId: string,
  userId: string,
  childrenClassNames: Array<string | null>
): Promise<void> {
  const uniqueClasses = Array.from(
    new Set(
      childrenClassNames
        .map((c) => (c ?? "").trim())
        .filter((c) => c.length > 0)
    )
  );
  if (uniqueClasses.length === 0) return;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  // 병렬 호출 — RPC 들은 멱등하므로 실패해도 다른 반은 진행
  await Promise.all(
    uniqueClasses.map(async (cn) => {
      try {
        await sb.rpc("toritalk_ensure_room_membership", {
          p_org_id: orgId,
          p_class_name: cn,
          p_user_id: userId,
        });
      } catch {
        /* swallow — 토리톡 미세팅이어도 핵심 가입은 성공 */
      }
    })
  );
}

/**
 * 단일 참가자(보호자+자녀N) 등록.
 * - 핸드폰 번호가 이미 다른 기관에 등록되어 있으면 차단
 * - 같은 기관에 이미 있으면 자녀 병합(이름 기준 dedup)
 * - 아니면 새로 생성(자동 계정 발급)
 */
export async function createSingleAppUserAction(
  orgId: string,
  formData: FormData
): Promise<void> {
  const session = await requireOrg();
  if (!orgId || orgId !== session.orgId) {
    throw new Error("이 기관의 참가자를 등록할 권한이 없습니다");
  }

  const parentNameRaw = String(formData.get("parent_name") ?? "").trim();
  const phoneRaw = String(formData.get("phone") ?? "").trim();

  if (!phoneRaw) throw new Error("부모님 연락처를 입력해 주세요");

  const phoneDigits = normalizeUserPhone(phoneRaw);
  if (phoneDigits.length < 10 || phoneDigits.length > 11) {
    throw new Error("연락처 형식이 올바르지 않아요 (10~11자리 숫자)");
  }

  const children = parseChildren(formData);
  if (children.length === 0) {
    throw new Error("원생 이름을 입력해 주세요");
  }

  // 부모님 이름이 비어있으면 연락처 뒷4자리로 자동 생성
  const parentName = parentNameRaw || `학부모_${phoneDigits.slice(-4)}`;

  const supabase = await createClient();

  // 1) 기존 유저 확인
  const existingResp = (await (
    supabase.from("app_users" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          maybeSingle: () => Promise<
            SbOne<{ id: string; org_id: string; parent_name: string }>
          >;
        };
      };
    }
  )
    .select("id, org_id, parent_name")
    .eq("phone", phoneDigits)
    .maybeSingle()) as SbOne<{
    id: string;
    org_id: string;
    parent_name: string;
  }>;

  const existing = existingResp.data;

  if (existing && existing.org_id !== orgId) {
    throw new Error("이미 다른 기관에 등록된 핸드폰 번호예요");
  }

  let userId: string;
  let merged = false;

  if (existing) {
    merged = true;
    userId = existing.id;
  } else {
    // 2) 새 유저 생성
    const account = await createAppUserAccountFromPhone(
      phoneDigits,
      orgId,
      parentName
    );

    const insResp = (await (
      supabase.from("app_users" as never) as unknown as {
        insert: (p: unknown) => {
          select: (c: string) => {
            single: () => Promise<SbOne<{ id: string }>>;
          };
        };
      }
    )
      .insert({
        phone: phoneDigits,
        password_hash: account.hash,
        parent_name: parentName,
        org_id: orgId,
        status: "ACTIVE",
      })
      .select("id")
      .single()) as SbOne<{ id: string }>;

    if (insResp.error || !insResp.data) {
      throw new Error(
        `보호자 등록 실패: ${insResp.error?.message ?? "알 수 없는 오류"}`
      );
    }
    userId = insResp.data.id;
  }

  // 3) 자녀 추가 (기존 이름과 dedup) — class_name 도 함께 저장
  //    기존 자녀 이름이 다시 들어오고 class_name 이 다르면 UPDATE 로 반영.
  const existingChildrenResp = (await (
    supabase.from("app_children" as never) as unknown as {
      select: (c: string) => {
        eq: (
          k: string,
          v: string
        ) => Promise<SbMany<{ id: string; name: string; class_name: string | null }>>;
      };
    }
  )
    .select("id, name, class_name")
    .eq("user_id", userId)) as SbMany<{
    id: string;
    name: string;
    class_name: string | null;
  }>;

  const existingByName = new Map(
    (existingChildrenResp.data ?? []).map((r) => [r.name, r])
  );
  const toInsert = children.filter((c) => !existingByName.has(c.name));
  const toUpdate = children.filter((c) => {
    const ex = existingByName.get(c.name);
    if (!ex) return false;
    // class_name 만 바뀌었으면 update 대상
    const before = (ex.class_name ?? "").trim();
    const after = (c.class_name ?? "").trim();
    return after.length > 0 && after !== before;
  });

  if (toInsert.length > 0) {
    const childResp = (await (
      supabase.from("app_children" as never) as unknown as {
        insert: (p: unknown) => Promise<{ error: SbErr }>;
      }
    ).insert(
      toInsert.map((c) => ({
        user_id: userId,
        name: c.name,
        birth_date: c.birth_date,
        is_enrolled: c.is_enrolled,
        class_name: c.class_name,
      }))
    )) as { error: SbErr };

    if (childResp.error) {
      throw new Error(`자녀 등록 실패: ${childResp.error.message}`);
    }
  }

  // 같은 자녀의 반만 바뀐 경우 UPDATE
  for (const c of toUpdate) {
    const ex = existingByName.get(c.name);
    if (!ex) continue;
    await (
      supabase.from("app_children" as never) as unknown as {
        update: (p: unknown) => {
          eq: (k: string, v: string) => Promise<{ error: SbErr }>;
        };
      }
    )
      .update({ class_name: c.class_name })
      .eq("id", ex.id);
  }

  // 4) 토리톡 자동 가입 — 모든 자녀의 class_name 기반
  //    insert/update 후 최신 자녀 데이터로 동기화
  const allClasses = [
    ...children.map((c) => c.class_name),
    ...Array.from(existingByName.values())
      .filter((ex) => !children.some((c) => c.name === ex.name)) // 이번 폼 외 기존
      .map((ex) => ex.class_name),
  ];
  await syncToritalkMembershipsFromChildren(supabase, orgId, userId, allClasses);

  revalidatePath(`/org/${orgId}/users`);
  redirect(
    `/org/${orgId}/users?imported=1${merged ? "&merged=1" : ""}`
  );
}
