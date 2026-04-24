// 서버/클라이언트 공용 — Supabase import 없음
// 5개 계정 타입 공용 스키마·계산 모델.

export type AccountType =
  | "partner"
  | "org"
  | "participant"
  | "advertiser"
  | "franchise";

/**
 * 필드 체크 종류.
 * - db_field: snapshot.db[column]가 non-null, non-empty인지
 * - doc_approved: snapshot.docs[docType] === 'APPROVED'
 * - docs_all_approved: 필수 문서 전체가 APPROVED
 */
export type FieldCheck =
  | { kind: "db_field"; column: string }
  | { kind: "doc_approved"; docType: string }
  | { kind: "docs_all_approved"; requiredTypes: string[] };

export interface ProfileField {
  id: string; // 고유 — React key + missing-list 링크
  label: string; // UI 라벨
  icon?: string; // 이모지
  weight?: number; // 기본 1
  href?: string; // 편집 진입점 (상대/절대 URL)
  /** 다운로드 가능한 자료 링크 (예: 서류 템플릿). 있으면 "입력하기" 옆에 "📥 양식" 버튼 노출 */
  downloadHref?: string;
  /** 다운로드 버튼 라벨 (기본: "📥 양식") */
  downloadLabel?: string;
  check: FieldCheck;
}

export interface ProfileFieldGroup {
  id: string;
  label: string;
  icon: string;
  fields: ProfileField[];
}

export interface ProfileSchema {
  accountType: AccountType;
  groups: ProfileFieldGroup[];
}

/** 완성도 계산 결과 — UI는 이것만 소비 */
export interface CompletenessResult {
  percent: number; // 0~100 정수
  completedCount: number;
  totalCount: number; // 가중치 무시한 필드 개수
  totalWeight: number;
  completedWeight: number;
  groups: Array<{
    id: string;
    label: string;
    icon: string;
    completed: number;
    total: number;
    percent: number;
    missing: ProfileField[];
  }>;
  missing: ProfileField[]; // 전체 미완료 (그룹 무시)
  isComplete: boolean;
}

/**
 * snapshot = 계산에 필요한 현재 값들의 요약본.
 *   db: partners row의 평탄화된 key-value (값이 string이면 완료, null/공백이면 미완료)
 *   docs: doc_type별 최신 상태 (APPROVED/PENDING/REJECTED/EXPIRED/null)
 */
export interface ProfileSnapshot {
  db: Record<string, string | number | boolean | null | undefined>;
  docs: Record<string, string | null>;
}
