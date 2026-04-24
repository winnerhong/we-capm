// server-only: @/lib/supabase/server를 참조하므로 클라이언트 번들에 포함 불가
import { createClient } from "@/lib/supabase/server";
import {
  ORG_DOC_META,
  type OrgDocStatus,
  type OrgDocType,
  type OrgDocumentRow,
} from "@/lib/org-documents/types";

type SbResp<T> = { data: T[] | null; error: unknown };
type SbRespOne<T> = { data: T | null; error: unknown };

/**
 * 만료 자동 계산: APPROVED + expires_at 과거면 화면상 EXPIRED로 표시.
 * DB row 자체는 수정하지 않음 (read-time 계산).
 */
export function applyOrgDocExpiryStatus(row: OrgDocumentRow): OrgDocumentRow {
  if (row.status !== "APPROVED") return row;
  if (!row.expires_at) return row;
  const exp = new Date(row.expires_at).getTime();
  if (Number.isNaN(exp)) return row;
  if (exp < Date.now()) {
    return { ...row, status: "EXPIRED" as OrgDocStatus };
  }
  return row;
}

/**
 * 특정 기관의 모든 서류 (모든 버전, 최신 제출 순)
 */
export async function loadOrgDocuments(
  orgId: string
): Promise<OrgDocumentRow[]> {
  if (!orgId) return [];
  const supabase = await createClient();

  const resp = (await (
    supabase.from("org_documents" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          order: (
            c: string,
            o: { ascending: boolean }
          ) => Promise<SbResp<OrgDocumentRow>>;
        };
      };
    }
  )
    .select("*")
    .eq("org_id", orgId)
    .order("submitted_at", { ascending: false })) as SbResp<OrgDocumentRow>;

  return (resp.data ?? []).map(applyOrgDocExpiryStatus);
}

/**
 * 최신 버전만 — doc_type당 version 최고값의 row를 반환
 */
export async function loadLatestOrgDocuments(
  orgId: string
): Promise<Map<OrgDocType, OrgDocumentRow>> {
  const all = await loadOrgDocuments(orgId);
  const map = new Map<OrgDocType, OrgDocumentRow>();
  for (const row of all) {
    const prev = map.get(row.doc_type);
    if (!prev || row.version > prev.version) {
      map.set(row.doc_type, row);
    }
  }
  return map;
}

/**
 * 통계 — 제출/승인/검토중/반려/만료 수 + 필수 서류 누락 목록
 * totalRequired: 5 (INSURANCE 제외 5개)
 */
export async function loadOrgDocumentStats(orgId: string): Promise<{
  submitted: number;
  approved: number;
  pending: number;
  rejected: number;
  expired: number;
  totalRequired: number;
  missingRequired: OrgDocType[];
}> {
  const latest = await loadLatestOrgDocuments(orgId);

  let approved = 0;
  let pending = 0;
  let rejected = 0;
  let expired = 0;
  for (const row of latest.values()) {
    switch (row.status) {
      case "APPROVED":
        approved += 1;
        break;
      case "PENDING":
        pending += 1;
        break;
      case "REJECTED":
        rejected += 1;
        break;
      case "EXPIRED":
        expired += 1;
        break;
    }
  }

  const requiredTypes = (Object.keys(ORG_DOC_META) as OrgDocType[]).filter(
    (k) => ORG_DOC_META[k].required
  );
  const totalRequired = requiredTypes.length;
  const missingRequired = requiredTypes.filter((k) => !latest.has(k));

  return {
    submitted: latest.size,
    approved,
    pending,
    rejected,
    expired,
    totalRequired,
    missingRequired,
  };
}

/**
 * 30일 내 만료 임박 + 이미 만료된 것. 최신 버전만 대상.
 */
export async function loadExpiringOrgDocuments(
  orgId: string
): Promise<OrgDocumentRow[]> {
  const latest = await loadLatestOrgDocuments(orgId);
  const now = Date.now();
  const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;

  const results: OrgDocumentRow[] = [];
  for (const row of latest.values()) {
    if (!row.expires_at) continue;
    const exp = new Date(row.expires_at).getTime();
    if (Number.isNaN(exp)) continue;
    if (exp - now <= THIRTY_DAYS) {
      results.push(row);
    }
  }
  results.sort((a, b) => {
    const ae = a.expires_at ? new Date(a.expires_at).getTime() : 0;
    const be = b.expires_at ? new Date(b.expires_at).getTime() : 0;
    return ae - be;
  });
  return results;
}

/**
 * 단건 조회 (id)
 */
export async function loadOrgDocumentById(
  id: string
): Promise<OrgDocumentRow | null> {
  if (!id) return null;
  const supabase = await createClient();

  const resp = (await (
    supabase.from("org_documents" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          maybeSingle: () => Promise<SbRespOne<OrgDocumentRow>>;
        };
      };
    }
  )
    .select("*")
    .eq("id", id)
    .maybeSingle()) as SbRespOne<OrgDocumentRow>;

  return resp.data ? applyOrgDocExpiryStatus(resp.data) : null;
}
