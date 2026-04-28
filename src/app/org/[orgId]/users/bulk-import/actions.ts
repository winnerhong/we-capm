"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireOrg } from "@/lib/org-auth-guard";
import { parseCSV } from "@/lib/crm/bulk-import";
import {
  createAppUserAccountFromPhone,
  normalizeUserPhone,
} from "@/lib/app-user/account";
import { linkUsersToEvent } from "@/lib/app-user/upsert-with-children";
import type { BulkImportResult, BulkImportRowResult } from "./types";

type ExistingUser = {
  id: string;
  org_id: string;
  parent_name: string;
};

type ExistingChild = {
  name: string;
};

type SbInsertResp = { error: { message: string } | null };
type SbSelectOneResp<T> = { data: T | null; error: { message: string } | null };
type SbSelectManyResp<T> = { data: T[] | null; error: { message: string } | null };

function headerOf(row: Record<string, string>, ...aliases: string[]): string {
  for (const key of Object.keys(row)) {
    const normKey = key.replace(/^\ufeff/, "").trim();
    for (const a of aliases) {
      if (normKey === a) return row[key] ?? "";
      if (normKey.toLowerCase() === a.toLowerCase()) return row[key] ?? "";
    }
  }
  return "";
}

const HEADER_KEYWORDS = [
  "원생명",
  "원생이름",
  "학생이름",
  "아동이름",
  "아이이름",
  "자녀이름",
  "이름",
  "학부모연락처",
  "학부모전화",
  "부모연락처",
  "부모전화",
  "연락처",
  "핸드폰",
  "전화번호",
  "전화",
];

/** 첫 줄이 진짜 헤더인지 판별 — 2칸 이상 + 헤더 키워드 포함 */
function isHeaderRow(cols: string[]): boolean {
  if (cols.length < 2) return false;
  return cols.some((c) =>
    HEADER_KEYWORDS.some((k) => c.trim().includes(k))
  );
}

/**
 * 자유 입력 → 표준 CSV 로 정규화.
 * - 콤마 없이 공백/탭으로 구분된 경우 콤마로 치환
 * - 첫 줄이 헤더처럼 보이지 않으면 "원생명,학부모연락처" 헤더 자동 prepend
 */
function normalizeSeparator(text: string): string {
  const lines = text.split(/\r?\n/);

  // 1) 각 줄을 콤마 구분으로 통일
  const commaLines = lines.map((line) => {
    if (!line.trim()) return line;
    if (line.includes(",")) return line;
    return line.trim().split(/\s+/).join(",");
  });

  // 2) 첫 줄이 헤더 키워드를 포함한 "진짜 헤더"가 아니면 기본 헤더 prepend
  const nonEmpty = commaLines.findIndex((l) => l.trim().length > 0);
  if (nonEmpty >= 0) {
    const firstCols = commaLines[nonEmpty].split(",");
    if (!isHeaderRow(firstCols)) {
      commaLines.splice(nonEmpty, 0, "원생명,학부모연락처");
    }
  }

  return commaLines.join("\n");
}

/**
 * Parse a birth-date cell. Accepts:
 *  - ISO yyyy-mm-dd (pass-through)
 *  - Excel serial (numeric) → ISO
 *  - anything else → null
 */
function parseBirthDate(raw: string): string | null {
  const v = (raw ?? "").trim();
  if (!v) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  if (/^\d{4}\/\d{1,2}\/\d{1,2}$/.test(v)) {
    const [y, m, d] = v.split("/");
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  if (/^\d+(\.\d+)?$/.test(v)) {
    const serial = Number(v);
    if (!Number.isFinite(serial) || serial <= 0) return null;
    // Excel epoch: 1900-01-01 = serial 1, with the Lotus 1900 leap bug handled by 25569.
    const ms = (serial - 25569) * 86400 * 1000;
    const d = new Date(ms);
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString().slice(0, 10);
  }
  return null;
}

type GroupedRow = {
  firstRowNum: number;
  parentName: string;
  phoneDigits: string;
  phoneDisplay: string;
  children: Array<{
    name: string;
    birth_date: string | null;
    rowNum: number;
  }>;
};

/**
 * Bulk import action — parses CSV FormData and upserts app_users + app_children.
 * Same phone across rows = same parent with multiple children.
 *
 * Per-row "fail open" strategy: no DB transaction; each unique phone is its
 * own mini-batch so one bad row never aborts the whole import.
 *
 * @param eventId  null 이면 기존 동작(/users 로 redirect).
 *                 string 이면 import 후 org_event_participants 에 link 하고
 *                 행사 참가자 탭으로 redirect.
 */
export async function bulkImportAppUsersAction(
  orgId: string,
  eventId: string | null,
  formData: FormData
): Promise<void> {
  const session = await requireOrg();
  if (!orgId || orgId !== session.orgId) {
    throw new Error("이 기관의 참가자를 등록할 권한이 없습니다");
  }

  const csvText = String(formData.get("csv") ?? "");
  if (!csvText.trim()) {
    throw new Error("데이터가 비어 있어요");
  }

  // 콤마 없이 공백/탭으로 구분된 경우도 허용 → 내부적으로 콤마로 정규화
  const normalized = normalizeSeparator(csvText);
  const rawRows = parseCSV(normalized);
  if (rawRows.length === 0) {
    throw new Error("헤더만 있고 데이터 행이 없어요");
  }

  // 1) Group rows by normalized phone
  const groups = new Map<string, GroupedRow>();
  const rowErrors: BulkImportRowResult[] = [];

  for (let i = 0; i < rawRows.length; i++) {
    const row = rawRows[i];
    const rowNum = i + 2; // header occupies row 1

    const parentNameRaw = headerOf(
      row,
      "보호자이름",
      "보호자명",
      "학부모이름",
      "학부모명",
      "부모이름",
      "부모명"
    ).trim();
    const phoneRaw = headerOf(
      row,
      "학부모연락처",
      "학부모전화",
      "부모연락처",
      "부모전화",
      "연락처",
      "핸드폰",
      "전화",
      "전화번호"
    ).trim();
    const childName = headerOf(
      row,
      "원생명",
      "원생이름",
      "학생이름",
      "아동이름",
      "아이이름",
      "자녀이름"
    ).trim();
    const birthRaw = headerOf(row, "생년월일", "생일").trim();

    if (!phoneRaw) {
      rowErrors.push({
        row: rowNum,
        phone: "",
        parentName: parentNameRaw,
        status: "ERROR",
        error: "학부모연락처 누락",
      });
      continue;
    }
    if (!childName) {
      rowErrors.push({
        row: rowNum,
        phone: phoneRaw,
        parentName: parentNameRaw,
        status: "ERROR",
        error: "원생명 누락",
      });
      continue;
    }

    const phoneDigits = normalizeUserPhone(phoneRaw);
    if (phoneDigits.length < 10 || phoneDigits.length > 11) {
      rowErrors.push({
        row: rowNum,
        phone: phoneRaw,
        parentName: parentNameRaw,
        status: "ERROR",
        error: `학부모연락처 형식 오류: ${phoneRaw}`,
      });
      continue;
    }

    // 보호자이름이 비어있으면 학부모연락처 뒷 4자리로 자동 생성
    const parentName =
      parentNameRaw || `학부모_${phoneDigits.slice(-4)}`;

    const birth = parseBirthDate(birthRaw);

    let g = groups.get(phoneDigits);
    if (!g) {
      g = {
        firstRowNum: rowNum,
        parentName,
        phoneDigits,
        phoneDisplay: phoneRaw,
        children: [],
      };
      groups.set(phoneDigits, g);
    }
    // Dedup children by name within the same uploaded group
    if (!g.children.some((c) => c.name === childName)) {
      g.children.push({ name: childName, birth_date: birth, rowNum });
    }
  }

  // 2) Process groups in parallel chunks of 10 (bcrypt is slow)
  const supabase = await createClient();
  const groupList = Array.from(groups.values());
  const groupResults: BulkImportRowResult[] = [];

  const CHUNK = 10;
  for (let i = 0; i < groupList.length; i += CHUNK) {
    const slice = groupList.slice(i, i + CHUNK);
    const chunkResults = await Promise.all(
      slice.map((g) => processGroup(supabase, orgId, g))
    );
    groupResults.push(...chunkResults);
  }

  // 3) Aggregate result
  const allRows = [...rowErrors, ...groupResults].sort(
    (a, b) => a.row - b.row
  );
  const result: BulkImportResult = {
    success: groupResults.filter((r) => r.status === "CREATED").length,
    merged: groupResults.filter((r) => r.status === "MERGED").length,
    skipped: allRows.filter((r) => r.status === "SKIPPED").length,
    failed: allRows.filter((r) => r.status === "ERROR").length,
    rows: allRows,
  };

  const processed = result.success + result.merged;

  // Non-fatal: if only errors, still revalidate+redirect with imported=0
  revalidatePath(`/org/${orgId}/users`);

  // 행사 모드 — 성공한 user 들을 org_event_participants 에 link 후 행사 페이지로
  if (eventId) {
    const successUserIds = groupResults
      .filter((r) => r.status === "CREATED" || r.status === "MERGED")
      .map((r) => r.userId)
      .filter((id): id is string => typeof id === "string" && id.length > 0);

    if (successUserIds.length > 0) {
      await linkUsersToEvent(eventId, successUserIds);
    }

    revalidatePath(`/org/${orgId}/events/${eventId}`);
    redirect(
      `/org/${orgId}/events/${eventId}?tab=participants&imported=${processed}&failed=${result.failed}&merged=${result.merged}`
    );
  }

  redirect(
    `/org/${orgId}/users?imported=${processed}&failed=${result.failed}&merged=${result.merged}`
  );
}

async function processGroup(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orgId: string,
  g: GroupedRow
): Promise<BulkImportRowResult> {
  try {
    // Check for existing user
    const existingResp = (await (
      supabase.from("app_users" as never) as unknown as {
        select: (c: string) => {
          eq: (
            k: string,
            v: string
          ) => {
            maybeSingle: () => Promise<SbSelectOneResp<ExistingUser>>;
          };
        };
      }
    )
      .select("id, org_id, parent_name")
      .eq("phone", g.phoneDigits)
      .maybeSingle()) as SbSelectOneResp<ExistingUser>;

    const existing = existingResp.data;

    if (existing && existing.org_id !== orgId) {
      return {
        row: g.firstRowNum,
        phone: g.phoneDisplay,
        parentName: g.parentName,
        status: "ERROR",
        error: "이미 다른 기관에 등록된 번호예요",
      };
    }

    if (existing) {
      // Merge children only — dedup by existing child names
      const added = await mergeChildren(supabase, existing.id, g.children);
      return {
        row: g.firstRowNum,
        phone: g.phoneDisplay,
        parentName: g.parentName,
        status: "MERGED",
        childrenAdded: added,
        userId: existing.id,
      };
    }

    // New user: create account + insert parent + children
    const account = await createAppUserAccountFromPhone(
      g.phoneDigits,
      orgId,
      g.parentName
    );

    const insertUserResp = (await (
      supabase.from("app_users" as never) as unknown as {
        insert: (p: unknown) => {
          select: (c: string) => {
            single: () => Promise<SbSelectOneResp<{ id: string }>>;
          };
        };
      }
    )
      .insert({
        phone: g.phoneDigits,
        password_hash: account.hash,
        parent_name: g.parentName,
        org_id: orgId,
        status: "ACTIVE",
      })
      .select("id")
      .single()) as SbSelectOneResp<{ id: string }>;

    if (insertUserResp.error || !insertUserResp.data) {
      return {
        row: g.firstRowNum,
        phone: g.phoneDisplay,
        parentName: g.parentName,
        status: "ERROR",
        error: insertUserResp.error?.message ?? "보호자 등록 실패",
      };
    }

    const newUserId = insertUserResp.data.id;

    // Insert all children in a single batch
    if (g.children.length > 0) {
      const childPayload = g.children.map((c) => ({
        user_id: newUserId,
        name: c.name,
        birth_date: c.birth_date,
      }));
      const childInsert = (await (
        supabase.from("app_children" as never) as unknown as {
          insert: (p: unknown) => Promise<SbInsertResp>;
        }
      ).insert(childPayload)) as SbInsertResp;
      if (childInsert.error) {
        // User created but children failed: soft warning — still count as CREATED
        return {
          row: g.firstRowNum,
          phone: g.phoneDisplay,
          parentName: g.parentName,
          status: "CREATED",
          childrenAdded: 0,
          error: `자녀 등록 일부 실패: ${childInsert.error.message}`,
          userId: newUserId,
        };
      }
    }

    return {
      row: g.firstRowNum,
      phone: g.phoneDisplay,
      parentName: g.parentName,
      status: "CREATED",
      childrenAdded: g.children.length,
      userId: newUserId,
    };
  } catch (e) {
    return {
      row: g.firstRowNum,
      phone: g.phoneDisplay,
      parentName: g.parentName,
      status: "ERROR",
      error: e instanceof Error ? e.message : "알 수 없는 오류",
    };
  }
}

async function mergeChildren(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  children: Array<{ name: string; birth_date: string | null }>
): Promise<number> {
  if (children.length === 0) return 0;

  const existingResp = (await (
    supabase.from("app_children" as never) as unknown as {
      select: (c: string) => {
        eq: (
          k: string,
          v: string
        ) => Promise<SbSelectManyResp<ExistingChild>>;
      };
    }
  )
    .select("name")
    .eq("user_id", userId)) as SbSelectManyResp<ExistingChild>;

  const existingNames = new Set(
    (existingResp.data ?? []).map((r) => r.name)
  );
  const toInsert = children.filter((c) => !existingNames.has(c.name));
  if (toInsert.length === 0) return 0;

  const payload = toInsert.map((c) => ({
    user_id: userId,
    name: c.name,
    birth_date: c.birth_date,
  }));

  const resp = (await (
    supabase.from("app_children" as never) as unknown as {
      insert: (p: unknown) => Promise<SbInsertResp>;
    }
  ).insert(payload)) as SbInsertResp;

  if (resp.error) {
    // Don't throw — merge is best-effort
    return 0;
  }
  return toInsert.length;
}
