// 서버/클라이언트 공용 — 순수 React 컴포넌트 (Supabase import 없음)
import type { ReactNode } from "react";
import type { TemplateData } from "../template-data";
import type {
  ArticleSection,
  TemplatedDocType,
  TemplateJson,
} from "../template-json-schema";

/* ---------- 변수 치환 ---------- */

/** "{{partner.business_name}}" 패턴 → TemplateData 값 치환 */
function substitute(text: string, data: TemplateData): string {
  return text.replace(
    /\{\{\s*([a-zA-Z_]+)\.([a-zA-Z_]+)\s*\}\}|\{\{\s*(today)\s*\}\}/g,
    (match, scope, key, singular) => {
      if (singular === "today") return data.today;
      if (scope === "partner") {
        const v = (data.partner as unknown as Record<string, string>)[key];
        return v ?? match;
      }
      if (scope === "org") {
        const v = (data.org as unknown as Record<string, string>)[key];
        return v ?? match;
      }
      return match;
    }
  );
}

/** "____" 3개 이상의 언더스코어를 <U>...</U>로 변환하고 변수 치환도 함께 */
function renderRichText(text: string, data: TemplateData): ReactNode[] {
  const substituted = substitute(text, data);
  const nodes: ReactNode[] = [];
  const regex = /_{3,}/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = regex.exec(substituted)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(substituted.slice(lastIndex, match.index));
    }
    nodes.push(
      <span
        key={`u-${key++}`}
        className="inline-block min-w-[4rem] border-b border-zinc-500 px-1 text-center font-mono"
      >
        &nbsp;
      </span>
    );
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < substituted.length) {
    nodes.push(substituted.slice(lastIndex));
  }
  return nodes;
}

/** 문단 분리 (빈 줄 = 새 문단, 한 줄 개행 = <br/>) */
function renderParagraphs(
  text: string,
  data: TemplateData,
  leading: "normal" | "relaxed" = "normal"
): ReactNode {
  const paras = text.split(/\n\s*\n/);
  return paras.map((p, i) => {
    const lines = p.split(/\n/);
    return (
      <p
        key={i}
        className={`${i === 0 ? "" : "mt-2"} ${
          leading === "relaxed" ? "leading-[2]" : "leading-[1.7]"
        }`}
      >
        {lines.map((line, j) => (
          <span key={j}>
            {j > 0 && <br />}
            {renderRichText(line, data)}
          </span>
        ))}
      </p>
    );
  });
}

/* ---------- doc_type별 시스템 블록 ---------- */

function PartiesTable_Tax({ data }: { data: TemplateData }) {
  const { partner, org } = data;
  return (
    <table className="mt-6 w-full border-collapse text-[10.5pt]">
      <tbody>
        <tr>
          <th className="w-20 border border-zinc-400 bg-zinc-50 p-2 text-left align-top">
            갑 (위탁자)
          </th>
          <td className="border border-zinc-400 p-2 align-top">
            <div>상호: <b>{partner.business_name}</b></div>
            <div>사업자등록번호: {partner.business_number}</div>
            <div>대표자: {partner.representative_name}</div>
            <div>주소: {partner.address}</div>
            <div>연락처: {partner.phone}</div>
          </td>
        </tr>
        <tr>
          <th className="border border-zinc-400 bg-zinc-50 p-2 text-left align-top">
            을 (수탁자)
          </th>
          <td className="border border-zinc-400 p-2 align-top">
            <div>기관명: <b>{org.org_name}</b></div>
            <div>사업자등록번호: {org.business_number}</div>
            <div>대표자: {org.representative_name}</div>
            <div>주소: {org.address}</div>
            <div>연락처: {org.representative_phone}</div>
          </td>
        </tr>
      </tbody>
    </table>
  );
}

function InfoTable_Facility({ data }: { data: TemplateData }) {
  const { partner, org } = data;
  const blank = (n: number) => (
    <span className="inline-block min-w-[4rem] border-b border-zinc-500 px-1 text-center font-mono">
      {" ".repeat(n)}
    </span>
  );
  return (
    <table className="mt-6 w-full border-collapse text-[10.5pt]">
      <tbody>
        <tr>
          <th className="w-24 border border-zinc-400 bg-zinc-50 p-2 text-left align-top">
            시설 운영자
          </th>
          <td className="border border-zinc-400 p-2 align-top">
            <div>상호: <b>{partner.business_name}</b></div>
            <div>대표자: {partner.representative_name}</div>
            <div>주소: {partner.address}</div>
            <div>연락처: {partner.phone}</div>
          </td>
        </tr>
        <tr>
          <th className="border border-zinc-400 bg-zinc-50 p-2 text-left align-top">
            이용 기관
          </th>
          <td className="border border-zinc-400 p-2 align-top">
            <div>기관명: <b>{org.org_name}</b></div>
            <div>대표자: {org.representative_name}</div>
            <div>주소: {org.address}</div>
            <div>연락처: {org.representative_phone}</div>
          </td>
        </tr>
        <tr>
          <th className="border border-zinc-400 bg-zinc-50 p-2 text-left align-top">
            이용 일시
          </th>
          <td className="border border-zinc-400 p-2">
            {blank(4)}년 {blank(2)}월 {blank(2)}일 {blank(2)}시 ~ {blank(2)}시
          </td>
        </tr>
        <tr>
          <th className="border border-zinc-400 bg-zinc-50 p-2 text-left align-top">
            이용 인원
          </th>
          <td className="border border-zinc-400 p-2">
            아동 {blank(2)}명 / 인솔자 {blank(2)}명
          </td>
        </tr>
        <tr>
          <th className="border border-zinc-400 bg-zinc-50 p-2 text-left align-top">
            이용 목적
          </th>
          <td className="border border-zinc-400 p-2">
            <span className="inline-block min-w-[20rem] border-b border-zinc-500 px-1 text-center font-mono">
              {" "}
            </span>
          </td>
        </tr>
      </tbody>
    </table>
  );
}

function ThirdPartyTable_Privacy({ data }: { data: TemplateData }) {
  return (
    <table className="mt-4 w-full border-collapse text-[10pt]">
      <thead>
        <tr className="bg-zinc-50">
          <th className="border border-zinc-400 p-2">제공받는 자</th>
          <th className="border border-zinc-400 p-2">목적</th>
          <th className="border border-zinc-400 p-2">제공 항목</th>
          <th className="border border-zinc-400 p-2">보유 기간</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td className="border border-zinc-400 p-2 text-center">
            {data.partner.business_name}
            <div className="text-[9pt] text-zinc-600">(위탁 운영사)</div>
          </td>
          <td className="border border-zinc-400 p-2">
            프로그램 기획·운영 지원, 참가자 관리, 정산
          </td>
          <td className="border border-zinc-400 p-2">
            아동 성명·연령·소속, 보호자 연락처, 출결 기록
          </td>
          <td className="border border-zinc-400 p-2 text-center">5년</td>
        </tr>
      </tbody>
    </table>
  );
}

function ConsentBox_Privacy({ data }: { data: TemplateData }) {
  return (
    <section className="mt-8 rounded-md border border-zinc-400 p-4">
      <h3 className="text-[12pt] font-bold">동의 여부 확인</h3>
      <div className="mt-3 space-y-2 text-[11pt]">
        <div>① 개인정보 수집·이용에 동의합니다. &nbsp;&nbsp; ☐ 동의 &nbsp;&nbsp; ☐ 동의하지 않음</div>
        <div>② 위탁 운영사({data.partner.business_name})에 대한 제3자 제공에 동의합니다. &nbsp;&nbsp; ☐ 동의 &nbsp;&nbsp; ☐ 동의하지 않음</div>
        <div>③ 활동 사진·영상 촬영 및 홍보 목적 활용에 동의합니다. (선택) &nbsp;&nbsp; ☐ 동의 &nbsp;&nbsp; ☐ 동의하지 않음</div>
      </div>
    </section>
  );
}

function Signature_Tax({ data }: { data: TemplateData }) {
  return (
    <div className="mt-10 grid grid-cols-2 gap-8 text-[11pt]">
      <div>
        <div className="font-bold">갑 (위탁자)</div>
        <div className="mt-3">상호: <u>{data.partner.business_name}</u></div>
        <div className="mt-2">
          대표자: <u>{data.partner.representative_name}</u>{" "}
          <span className="ml-2">(인)</span>
        </div>
      </div>
      <div>
        <div className="font-bold">을 (수탁자)</div>
        <div className="mt-3">기관명: <u>{data.org.org_name}</u></div>
        <div className="mt-2">
          대표자: <u>{data.org.representative_name}</u>{" "}
          <span className="ml-2">(인)</span>
        </div>
      </div>
    </div>
  );
}

function Signature_Facility({ data }: { data: TemplateData }) {
  return (
    <div className="mt-10 text-right text-[11pt]">
      <div>이용 기관: <u>{data.org.org_name}</u></div>
      <div className="mt-3">
        대표자: <u>{data.org.representative_name}</u>{" "}
        <span className="ml-2">(인)</span>
      </div>
    </div>
  );
}

function Signature_Privacy({ data }: { data: TemplateData }) {
  return (
    <div className="mt-8 grid grid-cols-2 gap-8 text-[11pt]">
      <div>
        <div className="font-bold">보호자 (법정대리인)</div>
        <div className="mt-3">
          아동 성명:{" "}
          <span className="inline-block min-w-[8rem] border-b border-zinc-500 px-1 font-mono">
            {" "}
          </span>
        </div>
        <div className="mt-2">
          보호자 성명:{" "}
          <span className="inline-block min-w-[8rem] border-b border-zinc-500 px-1 font-mono">
            {" "}
          </span>{" "}
          <span className="ml-2">(서명 또는 인)</span>
        </div>
        <div className="mt-2">
          관계:{" "}
          <span className="inline-block min-w-[4rem] border-b border-zinc-500 px-1 font-mono">
            {" "}
          </span>{" "}
          (부·모·조부모 등)
        </div>
      </div>
      <div>
        <div className="font-bold">수집·이용 기관</div>
        <div className="mt-3">기관명: <u>{data.org.org_name}</u></div>
        <div className="mt-2">
          대표자: <u>{data.org.representative_name}</u>{" "}
          <span className="ml-2">(인)</span>
        </div>
      </div>
    </div>
  );
}

/* ---------- 조문 번호 포맷 ---------- */

function articleHeading(type: TemplatedDocType, a: ArticleSection): string {
  if (type === "PRIVACY_CONSENT") {
    return `${a.no}. ${a.title}`;
  }
  return `제${a.no}조 (${a.title})`;
}

/* ---------- 메인 렌더러 ---------- */

interface Props {
  docType: TemplatedDocType;
  tmpl: TemplateJson;
  data: TemplateData;
}

export function JsonTemplateRenderer({ docType, tmpl, data }: Props) {
  const isPrivacy = docType === "PRIVACY_CONSENT";

  return (
    <article>
      {/* 제목 */}
      <header className="text-center">
        <h1 className="text-[20pt] font-bold tracking-[0.3em]">
          {tmpl.title || "(제목 없음)"}
        </h1>
        <div className="mx-auto mt-3 h-[1px] w-24 bg-zinc-400" />
      </header>

      {/* 도입부 */}
      {tmpl.intro && (
        <div className="mt-8">{renderParagraphs(tmpl.intro, data, "relaxed")}</div>
      )}

      {/* 시스템 블록: 당사자/정보 테이블 */}
      {docType === "TAX_CONTRACT" && <PartiesTable_Tax data={data} />}
      {docType === "FACILITY_CONSENT" && <InfoTable_Facility data={data} />}

      {/* 조문 */}
      {tmpl.articles.map((a) => {
        const heading = articleHeading(docType, a);
        const isThirdPartySection =
          isPrivacy && a.id === "sec-4"; // 제4조: 테이블을 본문 아래 자동 부착
        return (
          <section key={a.id} className="mt-5">
            <h3 className="text-[12pt] font-bold">{heading}</h3>
            <div className="mt-1 pl-4">
              {renderParagraphs(a.body, data)}
              {isThirdPartySection && <ThirdPartyTable_Privacy data={data} />}
            </div>
          </section>
        );
      })}

      {/* 개인정보 전용 동의 체크박스 박스 */}
      {isPrivacy && <ConsentBox_Privacy data={data} />}

      {/* 결미부 */}
      {tmpl.closing && (
        <div className="mt-8">{renderParagraphs(tmpl.closing, data, "relaxed")}</div>
      )}

      {/* 날짜 */}
      <div className="mt-10 text-center text-[12pt]">{data.today}</div>

      {/* 서명 블록 */}
      {docType === "TAX_CONTRACT" && <Signature_Tax data={data} />}
      {docType === "FACILITY_CONSENT" && <Signature_Facility data={data} />}
      {docType === "PRIVACY_CONSENT" && <Signature_Privacy data={data} />}
    </article>
  );
}
