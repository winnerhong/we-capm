// server-only — 계산은 로컬이지만 스냅샷 로더가 서버 전용
import { loadPartnerProfileSnapshot } from "./queries";
import type { ProfileSnapshot } from "./types";

/** 게이트 결과: ok=false 면 reason을 표시하고 cta로 유도 */
export interface GateResult {
  ok: boolean;
  /** 사용자에게 보여줄 차단 사유 */
  reason?: string;
  /** "프로필 완성 하러가기" CTA href */
  cta?: { label: string; href: string };
  /** 구체적으로 빠진 항목 (선택) */
  missing?: string[];
}

/** 지사의 필수 서류 3종(계약 전 필수) 승인 여부 */
function partnerCoreDocsApproved(snap: ProfileSnapshot): {
  ok: boolean;
  missing: string[];
} {
  const required: Array<{ type: string; label: string }> = [
    { type: "BUSINESS_REG", label: "사업자등록증" },
    { type: "BANKBOOK", label: "통장 사본" },
    { type: "CONTRACT", label: "플랫폼 계약서" },
  ];
  const missing = required
    .filter((r) => snap.docs[r.type] !== "APPROVED")
    .map((r) => r.label);
  return { ok: missing.length === 0, missing };
}

/** 지사의 정산 계좌 3필드 모두 존재 여부 */
function partnerBankComplete(snap: ProfileSnapshot): {
  ok: boolean;
  missing: string[];
} {
  const fields: Array<{ column: string; label: string }> = [
    { column: "bank_name", label: "은행" },
    { column: "account_number", label: "계좌번호" },
    { column: "account_holder", label: "예금주" },
  ];
  const missing = fields
    .filter((f) => {
      const v = snap.db[f.column];
      if (typeof v === "string") return v.trim().length === 0;
      return !v;
    })
    .map((f) => f.label);
  return { ok: missing.length === 0, missing };
}

/**
 * 지사가 신규 기관 고객을 등록할 수 있는가?
 * - 필수 서류 3종 승인 필요 (플랫폼 계약서 없이 B2B 고객 유치는 위험)
 */
export async function canPartnerAddOrgCustomer(
  partnerId: string
): Promise<GateResult> {
  if (!partnerId) {
    return { ok: false, reason: "인증이 필요해요" };
  }
  const snap = await loadPartnerProfileSnapshot(partnerId);
  const docs = partnerCoreDocsApproved(snap);

  if (!docs.ok) {
    return {
      ok: false,
      reason: `필수 서류 ${docs.missing.length}종이 아직 승인되지 않아 신규 기관 고객을 등록할 수 없어요.`,
      missing: docs.missing,
      cta: {
        label: "서류 제출하러 가기",
        href: "/partner/settings/documents",
      },
    };
  }
  return { ok: true };
}

/**
 * 지사가 정산을 받을 수 있는가?
 * - 은행·계좌번호·예금주 모두 필요
 */
export async function canPartnerReceivePayout(
  partnerId: string
): Promise<GateResult> {
  if (!partnerId) {
    return { ok: false, reason: "인증이 필요해요" };
  }
  const snap = await loadPartnerProfileSnapshot(partnerId);
  const bank = partnerBankComplete(snap);
  if (!bank.ok) {
    return {
      ok: false,
      reason: `정산 계좌 ${bank.missing.join("·")} 정보가 비어 있어 지급이 불가능해요.`,
      missing: bank.missing,
      cta: {
        label: "정산 계좌 입력하기",
        href: "/partner/my/edit#bank",
      },
    };
  }
  return { ok: true };
}
