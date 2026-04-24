// 서버/클라이언트 공용 — Supabase import 없음
// 3개 템플릿(위탁계약서/시설동의서/개인정보동의서) 공통 편집 스키마.

export type TemplatedDocType =
  | "TAX_CONTRACT"
  | "FACILITY_CONSENT"
  | "PRIVACY_CONSENT";

export interface ArticleSection {
  id: string; // stable (React key) — crypto.randomUUID() 또는 고정 ID
  no: string; // 번호 ("1","2","I" 등) — 렌더 시 doc_type별 접두/접미 자동
  title: string; // "(목적)" 형태
  body: string; // 다중 문단 — \n\n으로 문단 분리, {{var}}/___ 지원
}

export interface TemplateJson {
  title: string; // 문서 제목 (예: "프로그램 위탁계약서")
  intro: string; // 도입부 문단 (일반적으로 당사자 소개 문장)
  articles: ArticleSection[];
  closing: string; // 결미 문단 ("본 계약의 성립을 증명하기 위하여 ..." 등)
}

export const TEMPLATE_VARS: ReadonlyArray<{ token: string; desc: string }> = [
  { token: "{{partner.business_name}}", desc: "지사 상호" },
  { token: "{{partner.business_number}}", desc: "지사 사업자번호" },
  { token: "{{partner.representative_name}}", desc: "지사 대표자" },
  { token: "{{partner.address}}", desc: "지사 주소" },
  { token: "{{partner.phone}}", desc: "지사 연락처" },
  { token: "{{org.org_name}}", desc: "기관명" },
  { token: "{{org.business_number}}", desc: "기관 사업자번호" },
  { token: "{{org.representative_name}}", desc: "기관 대표자" },
  { token: "{{org.representative_phone}}", desc: "기관 담당자 연락처" },
  { token: "{{org.address}}", desc: "기관 주소" },
  { token: "{{today}}", desc: "오늘 날짜" },
];

export function isTemplatedDocType(v: string): v is TemplatedDocType {
  return (
    v === "TAX_CONTRACT" ||
    v === "FACILITY_CONSENT" ||
    v === "PRIVACY_CONSENT"
  );
}

export function emptyTemplateJson(): TemplateJson {
  return { title: "", intro: "", articles: [], closing: "" };
}
