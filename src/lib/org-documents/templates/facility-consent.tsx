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

export function FacilityConsentTemplate({ data }: Props) {
  const { partner, org, today } = data;
  return (
    <article>
      <header className="text-center">
        <h1 className="text-[20pt] font-bold tracking-[0.3em]">
          시설 이용 동의서
        </h1>
        <div className="mx-auto mt-3 h-[1px] w-24 bg-zinc-400" />
      </header>

      <p className="mt-8 leading-[2]">
        본 동의서는 <b>{partner.business_name}</b>
        (이하 &ldquo;시설 운영자&rdquo;라 한다)이 운영·관리하는 시설을{" "}
        <b>{org.org_name}</b>(이하 &ldquo;이용 기관&rdquo;이라 한다)이
        프로그램 진행 목적으로 이용함에 있어, 시설 이용에 관한 제반
        사항을 숙지하고 아래 내용에 동의함을 확인하기 위한 것이다.
      </p>

      <table className="mt-6 w-full border-collapse text-[10.5pt]">
        <tbody>
          <tr>
            <th className="w-24 border border-zinc-400 bg-zinc-50 p-2 text-left align-top">
              시설 운영자
            </th>
            <td className="border border-zinc-400 p-2 align-top">
              <div>
                상호: <b>{partner.business_name}</b>
              </div>
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
              <div>
                기관명: <b>{org.org_name}</b>
              </div>
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
              <U>{"    "}</U>년 <U>{"  "}</U>월 <U>{"  "}</U>일{" "}
              <U>{"  "}</U>시 ~ <U>{"  "}</U>시
            </td>
          </tr>
          <tr>
            <th className="border border-zinc-400 bg-zinc-50 p-2 text-left align-top">
              이용 인원
            </th>
            <td className="border border-zinc-400 p-2">
              아동 <U>{"  "}</U>명 / 인솔자 <U>{"  "}</U>명
            </td>
          </tr>
          <tr>
            <th className="border border-zinc-400 bg-zinc-50 p-2 text-left align-top">
              이용 목적
            </th>
            <td className="border border-zinc-400 p-2">
              <U>{"                                    "}</U>
            </td>
          </tr>
        </tbody>
      </table>

      <Article no="1" title="시설 이용의 범위">
        <p>
          이용 기관은 시설 운영자가 지정한 구역·시설·장비에 한하여
          프로그램 진행 목적으로 사용할 수 있으며, 사전 승인 없이
          용도를 변경하지 아니한다.
        </p>
      </Article>

      <Article no="2" title="안전 수칙 준수">
        <ol className="list-decimal pl-6">
          <li>
            이용 기관은 시설 내 안전 수칙·비상 대피 경로·응급 처치
            지침을 사전에 숙지하고 소속 인솔자에게 전달한다.
          </li>
          <li>
            만 14세 미만 아동은 반드시 성인 인솔자의 보호 아래 활동하며,
            인솔자 1인당 아동 <U>{"  "}</U>명을 초과하지 아니한다.
          </li>
          <li>
            시설 운영자의 안내·지시에 따라야 하며, 위험 행위(뛰기·장난·
            고위험 기구 임의 사용 등)를 금지한다.
          </li>
        </ol>
      </Article>

      <Article no="3" title="책임의 범위">
        <ol className="list-decimal pl-6">
          <li>
            시설 운영자는 시설·장비의 유지·보수 및 통상적인 안전 관리
            의무를 다한다.
          </li>
          <li>
            이용 기관 또는 참가자의 고의·과실로 발생한 시설·장비 파손,
            인적 사고에 대해서는 이용 기관이 책임을 진다.
          </li>
          <li>
            천재지변·감염병 확산 등 불가항력 사유에 의한 이용 제한 및
            중단에 대해서는 상호 책임을 묻지 아니한다.
          </li>
        </ol>
      </Article>

      <Article no="4" title="보험 및 사고 처리">
        <p>
          이용 기관은 프로그램 참가자의 상해·배상 책임에 대비하여
          적절한 보험에 가입할 수 있으며, 사고 발생 시 즉시 시설
          운영자에게 통보하고 상호 협력하여 처리한다.
        </p>
      </Article>

      <Article no="5" title="기타">
        <p>
          본 동의서에 명시되지 아니한 사항은 시설 운영 규정 및 관계
          법령에 따르며, 양 당사자의 합의에 따라 보완할 수 있다.
        </p>
      </Article>

      <p className="mt-8 leading-[2]">
        본인은 위 내용을 충분히 이해하고 이에 동의하며, 시설 이용 중
        발생할 수 있는 사항에 대하여 성실히 협력할 것을 확인한다.
      </p>

      <div className="mt-10 text-center text-[12pt]">{today}</div>

      <div className="mt-10 text-right text-[11pt]">
        <div>
          이용 기관: <U>{org.org_name}</U>
        </div>
        <div className="mt-3">
          대표자: <U>{org.representative_name}</U>{" "}
          <span className="ml-2">(인)</span>
        </div>
      </div>
    </article>
  );
}
