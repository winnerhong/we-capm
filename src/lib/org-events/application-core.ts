// 참가 접수 — 순수 로직 (서버/클라이언트 공용, DB 접근 없음).
//
// 여기 있는 함수는 전부 부수효과가 없다. 서버 액션이 최종 검증에 쓰고,
// 클라이언트 폼이 같은 규칙으로 미리 걸러 사용자에게 즉시 피드백을 준다.
// 규칙이 두 벌로 갈라지지 않게 하는 것이 이 파일의 존재 이유.

import {
  MAX_APPLICATION_CHILDREN,
  MAX_APPLICATION_COMPANIONS,
  MAX_APPLICATION_PARTY_SIZE,
  MAX_COMPANION_LABEL_LENGTH,
  type ApplicationChild,
  type ApplicationCompanion,
  type CompanionKind,
} from "./types";

/** 이름 한 개의 길이 상한 — app_children 입력들과 동일 규약. */
export const MAX_NAME_LENGTH = 50;

export type ApplicationInput = {
  /** 하이픈 포함 여부 무관 — 내부에서 숫자만 남긴다. */
  phone: string;
  children: { name: string; className: string }[];
  /**
   * 함께 오는 사람. 총 인원은 여기서 파생되므로 클라이언트가 인원 숫자를
   * 따로 보내지 않는다 (조작 여지를 없앤다).
   */
  companions: ApplicationCompanion[];
};

export type Headcount = {
  /** 유아 — 참가 아이 + 아동 동반인. */
  childCount: number;
  /** 성인 동반인 (조부모 제외). */
  adultCount: number;
  /** 조부모 동반인. */
  seniorCount: number;
  total: number;
};

export type NormalizedApplication = Headcount & {
  phone: string;
  children: ApplicationChild[];
  companions: ApplicationCompanion[];
  /** = total. DB party_size 컬럼에 그대로 들어간다. */
  partySize: number;
};

export type ValidationResult =
  | { ok: true; value: NormalizedApplication }
  | { ok: false; message: string };

/**
 * 알 수 없는 값 → 성인. 폼·jsonb 양쪽에서 같은 규칙을 쓴다.
 * (조부모 분류가 나중에 생겨서, 그 전 데이터는 SENIOR 가 아닌 값으로 들어온다)
 */
export function normalizeCompanionKind(v: unknown): CompanionKind {
  if (v === "CHILD") return "CHILD";
  if (v === "SENIOR") return "SENIOR";
  return "ADULT";
}

/** 하이픈/공백 제거. account.ts 의 normalizeUserPhone 과 같은 규칙(클라 공용). */
export function digitsOnly(input: string): string {
  return (input ?? "").replace(/\D/g, "");
}

/**
 * 인원 합산 — 화면·서버가 같은 함수를 쓴다.
 *
 * 아동은 "참가 아이 + 아동으로 표시된 동반인" 이다. 원생이 아닌 동생이 따라오는
 * 경우가 있어서, 원아 칸에 넣지 않고도 아동으로 셀 수 있어야 한다.
 *
 * 상태로 따로 들고 있지 않고 매번 계산한다 — 자녀를 추가했는데 인원이 안 따라오는
 * 종류의 어긋남이 원천적으로 생기지 않게.
 */
export function computeHeadcount(
  children: readonly unknown[],
  companions: readonly { kind: CompanionKind }[]
): Headcount {
  const childCompanions = companions.filter((c) => c?.kind === "CHILD").length;
  const seniorCount = companions.filter((c) => c?.kind === "SENIOR").length;
  // 성인은 나머지 전부 — kind 가 깨진 값이어도 인원에서 누락되지 않게.
  const adultCount = companions.length - childCompanions - seniorCount;
  const childCount = children.length + childCompanions;
  return {
    childCount,
    adultCount,
    seniorCount,
    total: childCount + adultCount + seniorCount,
  };
}

/** "유아 2 · 성인 3 · 조부모 1 · 총 6명" — 관리자 화면과 폼이 함께 쓰는 라벨. */
export function formatHeadcount(h: Headcount): string {
  const parts: string[] = [];
  if (h.childCount > 0) parts.push(`👶 유아 ${h.childCount}`);
  if (h.adultCount > 0) parts.push(`🧑 성인 ${h.adultCount}`);
  if (h.seniorCount > 0) parts.push(`👴 조부모 ${h.seniorCount}`);
  parts.push(`총 ${h.total}명`);
  return parts.join(" · ");
}

/**
 * 신청서 입력 검증 + 정규화.
 *  - 연락처 10~11자리
 *  - 자녀 1~6명, 이름 필수(각 50자), 이름 중복 제거
 *  - 참가 인원 1~20, 그리고 자녀 수 이상 (아이보다 적은 인원은 오타)
 */
export function validateApplicationInput(
  input: ApplicationInput
): ValidationResult {
  const phone = digitsOnly(input.phone);
  if (phone.length < 10 || phone.length > 11) {
    return { ok: false, message: "연락처 10~11자리를 숫자로 입력해 주세요" };
  }

  const children: ApplicationChild[] = [];
  const seen = new Set<string>();
  for (const raw of input.children ?? []) {
    const name = (raw?.name ?? "").trim();
    if (!name) continue;
    if (name.length > MAX_NAME_LENGTH) {
      return {
        ok: false,
        message: `원아 이름은 ${MAX_NAME_LENGTH}자 이내로 입력해 주세요`,
      };
    }
    const className = (raw?.className ?? "").trim();
    if (className.length > MAX_NAME_LENGTH) {
      return {
        ok: false,
        message: `반 이름은 ${MAX_NAME_LENGTH}자 이내로 입력해 주세요`,
      };
    }
    if (seen.has(name)) continue;
    seen.add(name);
    children.push({ name, class_name: className || null });
  }

  if (children.length === 0) {
    return { ok: false, message: "원아 이름을 입력해 주세요" };
  }
  if (children.length > MAX_APPLICATION_CHILDREN) {
    return {
      ok: false,
      message: `자녀는 최대 ${MAX_APPLICATION_CHILDREN}명까지 신청할 수 있어요`,
    };
  }

  // 동반인 — 빈 라벨 줄은 (사용자가 칩만 눌러두고 안 적은 경우) 조용히 버린다.
  const companions: ApplicationCompanion[] = [];
  for (const raw of input.companions ?? []) {
    const label = (raw?.label ?? "").trim();
    if (!label) continue;
    if (label.length > MAX_COMPANION_LABEL_LENGTH) {
      return {
        ok: false,
        message: `함께 오시는 분은 ${MAX_COMPANION_LABEL_LENGTH}자 이내로 적어주세요`,
      };
    }
    companions.push({ label, kind: normalizeCompanionKind(raw.kind) });
  }

  if (companions.length > MAX_APPLICATION_COMPANIONS) {
    return {
      ok: false,
      message: `함께 오시는 분은 최대 ${MAX_APPLICATION_COMPANIONS}명까지 적을 수 있어요`,
    };
  }

  // 총 인원은 입력이 아니라 파생값이다 — 클라이언트가 숫자를 조작할 여지가 없다.
  const head = computeHeadcount(children, companions);
  if (head.total > MAX_APPLICATION_PARTY_SIZE) {
    return {
      ok: false,
      message: `참가 인원은 최대 ${MAX_APPLICATION_PARTY_SIZE}명까지예요. 더 많으면 기관에 문의해 주세요`,
    };
  }

  return {
    ok: true,
    value: { phone, children, companions, partySize: head.total, ...head },
  };
}

/**
 * jsonb 컬럼 → ApplicationChild[]. 형태가 깨져 있어도 화면이 죽지 않게 방어적으로.
 */
export function parseApplicationChildren(raw: unknown): ApplicationChild[] {
  if (!Array.isArray(raw)) return [];
  const out: ApplicationChild[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const rec = item as { name?: unknown; class_name?: unknown };
    const name = typeof rec.name === "string" ? rec.name.trim() : "";
    if (!name) continue;
    const cls =
      typeof rec.class_name === "string" ? rec.class_name.trim() : "";
    out.push({ name, class_name: cls || null });
  }
  return out;
}

/**
 * jsonb 컬럼 → ApplicationCompanion[]. 깨진 값은 버리고, kind 가 이상하면 성인 취급.
 * (companions 컬럼이 없던 시절의 신청서는 빈 배열로 읽힌다 — 화면이 총 인원만 표시)
 */
export function parseApplicationCompanions(
  raw: unknown
): ApplicationCompanion[] {
  if (!Array.isArray(raw)) return [];
  const out: ApplicationCompanion[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const rec = item as { label?: unknown; kind?: unknown };
    const label = typeof rec.label === "string" ? rec.label.trim() : "";
    if (!label) continue;
    out.push({ label, kind: normalizeCompanionKind(rec.kind) });
  }
  return out;
}

/**
 * 승인 시 만들 보호자 이름.
 * 신청 폼은 보호자 이름을 받지 않으므로 "{첫 원아명} 학부모" 로 만든다.
 * 자녀가 없으면 빈 문자열 — upsertParticipantWithChildren 이 `학부모_{뒤4자리}`
 * 로 폴백한다.
 */
export function deriveParentName(children: ApplicationChild[]): string {
  const first = children[0]?.name?.trim();
  return first ? `${first} 학부모` : "";
}

/** "홍유빈" → "홍*빈" / "홍유" → "홍*". 연락처 조회 응답에서만 쓴다. */
export function maskName(name: string): string {
  const s = (name ?? "").trim();
  if (s.length <= 1) return s;
  if (s.length === 2) return `${s[0]}*`;
  return `${s[0]}${"*".repeat(s.length - 2)}${s[s.length - 1]}`;
}

/** "01012345678" → "010-1234-5678". 관리자 화면 표시용. */
export function formatPhoneDisplay(phone: string): string {
  const d = digitsOnly(phone);
  if (d.length === 11) return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
  return d;
}

/* -------------------------------------------------------------------------- */
/* 접수 창구 상태 — 초대장이 무엇을 보여줄지 결정한다.                          */
/* -------------------------------------------------------------------------- */

/**
 * 마감을 따로 지정하지 않았을 때의 기본 마감 = 행사 시작 N분 전.
 *
 * 이유: 마감을 비워두면 행사가 시작된 뒤에도, 심지어 끝난 뒤에도 신청서가 계속
 * 들어온다. 기관이 매번 마감을 챙겨 넣지 않아도 상식적인 선에서 닫히도록
 * 시작 1시간 전을 기본값으로 둔다. (준비·명단 확정에 필요한 최소 시간)
 */
export const APPLICATION_DEFAULT_LEAD_MINUTES = 60;

/**
 * 실제로 적용되는 마감 시각.
 *   1) 기관이 지정한 마감이 있으면 그것
 *   2) 없으면 행사 시작 1시간 전
 *   3) 행사 시작 시각조차 없으면 무기한(null)
 */
export function computeEffectiveCloseAt(
  closeAt: string | null | undefined,
  startsAt: string | null | undefined
): { at: string | null; implicit: boolean } {
  if (closeAt) {
    const t = new Date(closeAt).getTime();
    if (Number.isFinite(t)) return { at: closeAt, implicit: false };
  }
  if (startsAt) {
    const t = new Date(startsAt).getTime();
    if (Number.isFinite(t)) {
      const at = new Date(
        t - APPLICATION_DEFAULT_LEAD_MINUTES * 60_000
      ).toISOString();
      return { at, implicit: true };
    }
  }
  return { at: null, implicit: false };
}

export type ApplicationGate =
  /** 접수제를 안 쓰는 행사 — 기존 CTA 그대로. */
  | { kind: "DISABLED" }
  /** 마감 지남. implicit 이면 기관이 지정한 게 아니라 "행사 1시간 전" 기본값. */
  | { kind: "CLOSED"; closedAt: string; implicit: boolean }
  /** 접수 중. atCapacity 면 "대기 접수" 안내를 덧붙인다. */
  | {
      kind: "OPEN";
      atCapacity: boolean;
      capacity: number | null;
      approvedPeople: number;
      /** 실제 적용 마감 — 지정 마감 또는 "행사 1시간 전". 없으면 무기한. */
      closeAt: string | null;
      /** true 면 기관이 지정한 게 아니라 기본값으로 계산된 마감. */
      closeIsImplicit: boolean;
    };

/**
 * 초대장 하단 게이트 판정.
 *
 * 정원은 **차단 기준이 아니다**. 도달해도 접수는 계속 받되 "대기 접수" 로
 * 안내한다. 승인이 어차피 수동이라 과접수가 위험하지 않고, 취소분을 채우려면
 * 대기자가 있어야 하기 때문.
 *
 * @param args.nowMs 판정 기준 시각. 테스트에서 고정값을 주입할 때만 넘긴다.
 *   (호출부가 Date.now() 를 직접 부르지 않게 기본값을 여기서 만든다 — 서버
 *    컴포넌트 렌더 중 impure 호출로 잡히는 걸 피하려는 이유도 있다.)
 */
export function resolveApplicationGate(args: {
  enabled: boolean | null;
  closeAt: string | null;
  /** 행사 시작 시각 — 마감 미지정 시 "1시간 전" 기본 마감을 만드는 근거. */
  startsAt?: string | null;
  capacity: number | null;
  approvedPeople: number;
  nowMs?: number;
}): ApplicationGate {
  if (!args.enabled) return { kind: "DISABLED" };

  const nowMs = args.nowMs ?? Date.now();
  const { at: effectiveClose, implicit } = computeEffectiveCloseAt(
    args.closeAt,
    args.startsAt
  );

  if (effectiveClose) {
    const closeMs = new Date(effectiveClose).getTime();
    if (Number.isFinite(closeMs) && closeMs <= nowMs) {
      return { kind: "CLOSED", closedAt: effectiveClose, implicit };
    }
  }

  const capacity =
    typeof args.capacity === "number" && args.capacity > 0
      ? args.capacity
      : null;

  return {
    kind: "OPEN",
    atCapacity: capacity !== null && args.approvedPeople >= capacity,
    capacity,
    approvedPeople: args.approvedPeople,
    closeAt: effectiveClose,
    closeIsImplicit: implicit,
  };
}
