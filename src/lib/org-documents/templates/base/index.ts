import type { TemplatedDocType, TemplateJson } from "../../template-json-schema";
import { TAX_CONTRACT_BASE } from "./tax-contract.base";
import { FACILITY_CONSENT_BASE } from "./facility-consent.base";
import { PRIVACY_CONSENT_BASE } from "./privacy-consent.base";

export const BASE_TEMPLATES: Record<TemplatedDocType, TemplateJson> = {
  TAX_CONTRACT: TAX_CONTRACT_BASE,
  FACILITY_CONSENT: FACILITY_CONSENT_BASE,
  PRIVACY_CONSENT: PRIVACY_CONSENT_BASE,
};

export function getBaseTemplate(type: TemplatedDocType): TemplateJson {
  // 얕은 복사 — 호출부에서 수정 시 원본 불변 보장
  const base = BASE_TEMPLATES[type];
  return {
    title: base.title,
    intro: base.intro,
    closing: base.closing,
    articles: base.articles.map((a) => ({ ...a })),
  };
}
