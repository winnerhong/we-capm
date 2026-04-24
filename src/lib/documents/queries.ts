// server-only: @/lib/supabase/server를 참조하므로 클라이언트 번들에 포함 불가
import { createClient } from "@/lib/supabase/server";
import {
  DOC_TYPE_META,
  type DocType,
  type DocStatus,
  type DocumentRow,
} from "@/lib/documents/types";

type SbResp<T> = { data: T[] | null; error: unknown };
type SbRespOne<T> = { data: T | null; error: unknown };

/**
 * 만료 자동 계산: APPROVED 상태이지만 expires_at이 현재 시각보다 과거면
 * 화면상 "EXPIRED"로 표시 (DB row 자체는 수정하지 않음; read-time 계산)
 */
function applyExpiryStatus(row: DocumentRow): DocumentRow {
  if (row.status !== "APPROVED") return row;
  if (!row.expires_at) return row;
  const exp = new Date(row.expires_at).getTime();
  if (Number.isNaN(exp)) return row;
  if (exp < Date.now()) {
    return { ...row, status: "EXPIRED" as DocStatus };
  }
  return row;
}

/**
 * 파트너의 모든 문서 로드 (최신 제출 순)
 */
export async function loadPartnerDocuments(
  partnerId: string
): Promise<DocumentRow[]> {
  if (!partnerId) return [];
  const supabase = await createClient();

  const resp = (await (
    supabase.from("partner_documents" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          order: (
            c: string,
            o: { ascending: boolean }
          ) => Promise<SbResp<DocumentRow>>;
        };
      };
    }
  )
    .select("*")
    .eq("partner_id", partnerId)
    .order("submitted_at", { ascending: false })) as SbResp<DocumentRow>;

  return (resp.data ?? []).map(applyExpiryStatus);
}

/**
 * 최신 버전만 — doc_type당 version 최고값의 row를 반환
 */
export async function loadLatestPartnerDocuments(
  partnerId: string
): Promise<Map<DocType, DocumentRow>> {
  const all = await loadPartnerDocuments(partnerId);
  const map = new Map<DocType, DocumentRow>();
  for (const row of all) {
    const prev = map.get(row.doc_type);
    if (!prev || row.version > prev.version) {
      map.set(row.doc_type, row);
    }
  }
  return map;
}

/**
 * 30일 내 만료 임박 (이미 만료된 것도 포함).
 * 최신 버전만 대상으로 계산.
 */
export async function loadExpiringDocuments(
  partnerId: string
): Promise<DocumentRow[]> {
  const latest = await loadLatestPartnerDocuments(partnerId);
  const now = Date.now();
  const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;

  const results: DocumentRow[] = [];
  for (const row of latest.values()) {
    if (!row.expires_at) continue;
    const exp = new Date(row.expires_at).getTime();
    if (Number.isNaN(exp)) continue;
    if (exp - now <= THIRTY_DAYS) {
      results.push(row);
    }
  }
  // 만료일 빠른 순
  results.sort((a, b) => {
    const ae = a.expires_at ? new Date(a.expires_at).getTime() : 0;
    const be = b.expires_at ? new Date(b.expires_at).getTime() : 0;
    return ae - be;
  });
  return results;
}

/**
 * 통계: 제출/승인/대기/반려/만료 개수 + 필수 서류 총 개수
 */
export async function loadDocumentStats(partnerId: string): Promise<{
  submitted: number;
  approved: number;
  pending: number;
  rejected: number;
  expired: number;
  totalRequired: number;
}> {
  const latest = await loadLatestPartnerDocuments(partnerId);

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

  const totalRequired = Object.values(DOC_TYPE_META).filter(
    (m) => m.required
  ).length;

  return {
    submitted: latest.size,
    approved,
    pending,
    rejected,
    expired,
    totalRequired,
  };
}

/**
 * 관리자용 — 전체 파트너 PENDING 서류 목록 (최신 제출 순)
 * partners.name을 조인해서 반환
 */
export async function loadAllPendingDocuments(): Promise<
  Array<DocumentRow & { partner_name: string }>
> {
  const supabase = await createClient();

  const resp = (await (
    supabase.from("partner_documents" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          order: (
            c: string,
            o: { ascending: boolean }
          ) => Promise<SbResp<DocumentRow>>;
        };
      };
    }
  )
    .select("*")
    .eq("status", "PENDING")
    .order("submitted_at", { ascending: false })) as SbResp<DocumentRow>;

  const rows = resp.data ?? [];
  if (rows.length === 0) return [];

  // partner 이름 맵 로드
  const partnerIds = Array.from(new Set(rows.map((r) => r.partner_id)));
  const pResp = (await (
    supabase.from("partners" as never) as unknown as {
      select: (c: string) => {
        in: (
          k: string,
          v: string[]
        ) => Promise<SbResp<{ id: string; name: string | null }>>;
      };
    }
  )
    .select("id,name")
    .in("id", partnerIds)) as SbResp<{ id: string; name: string | null }>;

  const nameMap = new Map<string, string>();
  for (const p of pResp.data ?? []) {
    nameMap.set(p.id, p.name ?? "");
  }

  return rows.map((r) => ({
    ...r,
    partner_name: nameMap.get(r.partner_id) ?? "",
  }));
}

/**
 * 핵심 4종 서류(계약 전 필수 — BUSINESS_REG, BANKBOOK, CEO_ID, CONTRACT)의
 * 최신 버전 상태만 간결하게 반환. 내 정보/대시보드 미리보기 전용.
 */
export async function loadDocumentsPreview(
  partnerId: string
): Promise<
  Array<{
    doc_type: DocType;
    status: DocStatus | null;
    submitted_at: string | null;
    reject_reason: string | null;
    expires_at: string | null;
  }>
> {
  const CORE: DocType[] = ["BUSINESS_REG", "BANKBOOK", "CEO_ID", "CONTRACT"];
  if (!partnerId) {
    return CORE.map((t) => ({
      doc_type: t,
      status: null,
      submitted_at: null,
      reject_reason: null,
      expires_at: null,
    }));
  }
  try {
    const latest = await loadLatestPartnerDocuments(partnerId);
    return CORE.map((t) => {
      const row = latest.get(t);
      if (!row) {
        return {
          doc_type: t,
          status: null,
          submitted_at: null,
          reject_reason: null,
          expires_at: null,
        };
      }
      return {
        doc_type: t,
        status: row.status,
        submitted_at: row.submitted_at,
        reject_reason: row.reject_reason,
        expires_at: row.expires_at,
      };
    });
  } catch {
    return CORE.map((t) => ({
      doc_type: t,
      status: null,
      submitted_at: null,
      reject_reason: null,
      expires_at: null,
    }));
  }
}

/**
 * 관리자용 — 전체 파트너별 PENDING(검토 대기) 서류 개수 맵.
 * 최신 버전(version 최고값)만 카운트.
 */
export async function countPendingDocumentsByPartner(): Promise<
  Map<string, number>
> {
  const supabase = await createClient();
  const result = new Map<string, number>();
  try {
    // 최신 버전만 정확히 카운트하기 위해 모든 partner_documents를 한 번에 로드
    // (규모가 커지면 SQL view로 교체 권장)
    const resp = (await (
      supabase.from("partner_documents" as never) as unknown as {
        select: (c: string) => Promise<SbResp<DocumentRow>>;
      }
    ).select("*")) as SbResp<DocumentRow>;

    const rows = resp.data ?? [];
    if (rows.length === 0) return result;

    // partner_id + doc_type별 최신 버전 row만 남기기
    const latestMap = new Map<string, DocumentRow>();
    for (const r of rows) {
      const key = `${r.partner_id}__${r.doc_type}`;
      const prev = latestMap.get(key);
      if (!prev || r.version > prev.version) {
        latestMap.set(key, r);
      }
    }

    for (const r of latestMap.values()) {
      if (r.status === "PENDING") {
        result.set(r.partner_id, (result.get(r.partner_id) ?? 0) + 1);
      }
    }
    return result;
  } catch {
    return result;
  }
}

/**
 * 관리자 대시보드용 — 전체 PENDING 서류 합계 (최신 버전 기준).
 */
export async function countPendingDocumentsAll(): Promise<number> {
  const byPartner = await countPendingDocumentsByPartner();
  let total = 0;
  for (const n of byPartner.values()) total += n;
  return total;
}

/**
 * 단일 문서 조회 (id) — 관리자/소유자 확인용
 */
export async function loadDocumentById(
  id: string
): Promise<DocumentRow | null> {
  if (!id) return null;
  const supabase = await createClient();

  const resp = (await (
    supabase.from("partner_documents" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          maybeSingle: () => Promise<SbRespOne<DocumentRow>>;
        };
      };
    }
  )
    .select("*")
    .eq("id", id)
    .maybeSingle()) as SbRespOne<DocumentRow>;

  return resp.data ? applyExpiryStatus(resp.data) : null;
}
