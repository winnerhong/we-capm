import type { TemplateData } from "../template-data";

interface Props {
  data: TemplateData;
}

function U({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-block min-w-[6rem] border-b border-zinc-500 px-1 text-center font-mono">
      {children}
    </span>
  );
}

function Article({
  no,
  title,
  children,
}: {
  no: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-5">
      <h3 className="text-[12pt] font-bold">
        제{no}조 ({title})
      </h3>
      <div className="mt-1 pl-4">{children}</div>
    </section>
  );
}

export function TaxContractTemplate({ data }: Props) {
  const { partner, org, today } = data;
  return (
    <article>
      {/* 표제 */}
      <header className="text-center">
        <h1 className="text-[20pt] font-bold tracking-[0.3em]">
          프로그램 위탁계약서
        </h1>
        <div className="mx-auto mt-3 h-[1px] w-24 bg-zinc-400" />
      </header>

      {/* 당사자 소개 */}
      <p className="mt-8 leading-[2]">
        <b>{partner.business_name}</b>
        (이하 &ldquo;갑&rdquo;이라 한다)와 <b>{org.org_name}</b>
        (이하 &ldquo;을&rdquo;이라 한다)은 갑이 기획·운영하는 아동·청소년
        프로그램을 을이 위탁 운영함에 있어 상호 신의성실의 원칙에 따라
        다음과 같이 계약을 체결한다.
      </p>

      {/* 당사자 표 */}
      <table className="mt-6 w-full border-collapse text-[10.5pt]">
        <tbody>
          <tr>
            <th className="w-20 border border-zinc-400 bg-zinc-50 p-2 text-left align-top">
              갑 (위탁자)
            </th>
            <td className="border border-zinc-400 p-2 align-top">
              <div>
                상호: <b>{partner.business_name}</b>
              </div>
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
              <div>
                기관명: <b>{org.org_name}</b>
              </div>
              <div>사업자등록번호: {org.business_number}</div>
              <div>대표자: {org.representative_name}</div>
              <div>주소: {org.address}</div>
              <div>연락처: {org.representative_phone}</div>
            </td>
          </tr>
        </tbody>
      </table>

      {/* 조문 */}
      <Article no="1" title="목적">
        <p>
          본 계약은 갑이 기획하는 아동·청소년 대상 체험·교육 프로그램의
          운영을 을에게 위탁하고, 이에 따른 양 당사자의 권리와 의무를
          정함을 목적으로 한다.
        </p>
      </Article>

      <Article no="2" title="위탁 범위">
        <p>
          갑은 다음 각 호의 프로그램 운영 업무를 을에게 위탁한다.
        </p>
        <ol className="mt-1 list-decimal pl-6">
          <li>프로그램 참가자 모집 및 등록 관리</li>
          <li>프로그램 장소 제공 및 운영 지원</li>
          <li>참가자 안전 관리 및 프로그램 진행 보조</li>
          <li>기타 양 당사자가 별도 합의한 업무</li>
        </ol>
      </Article>

      <Article no="3" title="계약 기간">
        <p>
          본 계약의 유효기간은 <U>{"    "}</U>년 <U>{"  "}</U>월{" "}
          <U>{"  "}</U>일부터 <U>{"    "}</U>년 <U>{"  "}</U>월{" "}
          <U>{"  "}</U>일까지로 한다. 다만, 계약 만료 1개월 전까지
          어느 일방의 서면 통지가 없으면 동일한 조건으로 1년씩 자동 연장된다.
        </p>
      </Article>

      <Article no="4" title="수수료 및 정산">
        <ol className="list-decimal pl-6">
          <li>
            갑은 을에게 프로그램 매출액의 <U>{"  "}</U>% 를 위탁
            수수료로 지급한다.
          </li>
          <li>
            정산은 매월 <U>{"  "}</U>일을 기준으로 집계하여, 익월{" "}
            <U>{"  "}</U>일까지 을이 지정한 계좌로 지급한다.
          </li>
          <li>
            세금계산서는 을이 갑에게 정산일 기준 7일 이내에 발행하며,
            부가가치세는 별도로 한다.
          </li>
        </ol>
      </Article>

      <Article no="5" title="의무와 책임">
        <ol className="list-decimal pl-6">
          <li>
            갑은 프로그램 기획·홍보·고객 대응 등 본사 업무를 성실히
            수행하고, 을에게 필요한 자료와 매뉴얼을 제공한다.
          </li>
          <li>
            을은 프로그램 운영 중 참가자의 안전을 최우선으로 관리하며,
            갑이 정한 운영 기준을 준수한다.
          </li>
          <li>
            당사자의 고의 또는 중대한 과실로 발생한 사고·손해에 대해서는
            해당 당사자가 책임을 진다.
          </li>
        </ol>
      </Article>

      <Article no="6" title="개인정보 보호">
        <p>
          양 당사자는 프로그램 운영 과정에서 수집되는 참가자의 개인정보를
          「개인정보 보호법」 등 관계 법령에 따라 적법하게 처리하며,
          구체적인 처리 및 위·수탁 사항은 별도의 &ldquo;개인정보 처리 동의서&rdquo; 및
          &ldquo;개인정보 처리 위수탁 계약서&rdquo;에 따른다.
        </p>
      </Article>

      <Article no="7" title="계약 해지">
        <ol className="list-decimal pl-6">
          <li>
            어느 일방이 본 계약상 의무를 중대하게 위반하고 상대방의
            서면 최고 후 14일 이내에 이를 시정하지 아니한 경우, 상대방은
            본 계약을 해지할 수 있다.
          </li>
          <li>
            양 당사자의 합의에 따라 언제든지 본 계약을 해지할 수 있으며,
            해지 시 기 발생한 정산 채권·채무는 해지 후 30일 이내에 정리한다.
          </li>
        </ol>
      </Article>

      <Article no="8" title="분쟁 해결 및 관할">
        <ol className="list-decimal pl-6">
          <li>
            본 계약과 관련하여 분쟁이 발생한 경우 양 당사자는 상호 협의를
            통하여 원만히 해결한다.
          </li>
          <li>
            협의에 의한 해결이 이루어지지 아니한 경우, 관할 법원은 갑의
            본점 소재지 관할 법원으로 한다.
          </li>
        </ol>
      </Article>

      {/* 체결 문구 */}
      <p className="mt-8 leading-[2]">
        본 계약의 성립을 증명하기 위하여 계약서 2부를 작성하여 갑과 을이
        각각 기명날인 후 1부씩 보관한다.
      </p>

      {/* 날짜 + 서명란 */}
      <div className="mt-10 text-center text-[12pt]">{today}</div>

      <div className="mt-10 grid grid-cols-2 gap-8 text-[11pt]">
        <div>
          <div className="font-bold">갑 (위탁자)</div>
          <div className="mt-3">
            상호: <U>{partner.business_name}</U>
          </div>
          <div className="mt-2">
            대표자: <U>{partner.representative_name}</U>{" "}
            <span className="ml-2">(인)</span>
          </div>
        </div>
        <div>
          <div className="font-bold">을 (수탁자)</div>
          <div className="mt-3">
            기관명: <U>{org.org_name}</U>
          </div>
          <div className="mt-2">
            대표자: <U>{org.representative_name}</U>{" "}
            <span className="ml-2">(인)</span>
          </div>
        </div>
      </div>
    </article>
  );
}
