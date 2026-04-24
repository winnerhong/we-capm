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

function Section({
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
        {no}. {title}
      </h3>
      <div className="mt-1 pl-4">{children}</div>
    </section>
  );
}

export function PrivacyConsentTemplate({ data }: Props) {
  const { partner, org, today } = data;
  return (
    <article>
      <header className="text-center">
        <h1 className="text-[20pt] font-bold tracking-[0.3em]">
          개인정보 처리 동의서
        </h1>
        <div className="mx-auto mt-3 h-[1px] w-24 bg-zinc-400" />
      </header>

      <p className="mt-8 leading-[2]">
        <b>{org.org_name}</b>(이하 &ldquo;수집·이용 기관&rdquo;이라 한다)은
        프로그램 신청·운영을 위하여 참가 아동 및 보호자의 개인정보를
        수집·이용하며, 프로그램 기획·지원 업무를 담당하는{" "}
        <b>{partner.business_name}</b>(이하 &ldquo;위탁 운영사&rdquo;라 한다)에
        일부 개인정보를 제공합니다. 「개인정보 보호법」 제15조, 제17조,
        제22조 및 제39조의3에 따라 아래와 같이 안내드리오니, 내용을
        충분히 확인하신 후 동의 여부를 결정해 주시기 바랍니다.
      </p>

      <Section no="1" title="수집·이용 목적">
        <ol className="list-decimal pl-6">
          <li>프로그램 참가 신청 접수 및 본인(보호자) 확인</li>
          <li>참가자 건강·안전 관리 및 응급 상황 시 연락</li>
          <li>프로그램 운영 결과 정리 및 만족도 조사</li>
          <li>법령상 의무 이행(세무·회계 등)</li>
        </ol>
      </Section>

      <Section no="2" title="수집 항목">
        <ul className="list-disc pl-6">
          <li>
            <b>아동</b>: 성명, 생년월일(또는 연령), 성별, 소속(반·학년),
            건강 특이사항(알레르기·복용 약 등)
          </li>
          <li>
            <b>보호자</b>: 성명, 휴대전화번호, 이메일(선택), 비상 연락처
          </li>
          <li>
            <b>운영 과정에서 생성되는 정보</b>: 출결 기록, 활동 사진·영상
            (별도 동의 시에 한함)
          </li>
        </ul>
      </Section>

      <Section no="3" title="보유 및 이용 기간">
        <p>
          수집일로부터 <b>5년</b> 간 보관 후 지체 없이 파기합니다. 다만,
          관계 법령(전자상거래법·국세기본법 등)에 따라 별도 보존이 필요한
          경우 해당 법령이 정한 기간 동안 보관합니다.
        </p>
      </Section>

      <Section no="4" title="제3자 제공(위탁)">
        <table className="mt-2 w-full border-collapse text-[10pt]">
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
                {partner.business_name}
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
      </Section>

      <Section no="5" title="거부할 권리 및 불이익">
        <p>
          정보주체(보호자)는 개인정보 수집·이용 및 제3자 제공에 대한
          동의를 거부할 권리가 있습니다. 다만, 필수 항목에 대한 동의를
          거부하시는 경우 프로그램 신청·참가가 제한될 수 있음을
          알려드립니다.
        </p>
      </Section>

      <Section no="6" title="만 14세 미만 아동의 개인정보">
        <p>
          만 14세 미만 아동의 개인정보를 수집·이용하는 경우에는 법정대리인
          (보호자)의 동의를 받으며, 법정대리인은 언제든지 아동의 개인정보
          열람·정정·삭제·처리정지를 요구할 수 있습니다.
        </p>
      </Section>

      {/* 동의란 */}
      <section className="mt-8 rounded-md border border-zinc-400 p-4">
        <h3 className="text-[12pt] font-bold">동의 여부 확인</h3>
        <div className="mt-3 space-y-2 text-[11pt]">
          <div>
            ① 개인정보 수집·이용에 동의합니다. &nbsp;&nbsp; ☐ 동의
            &nbsp;&nbsp; ☐ 동의하지 않음
          </div>
          <div>
            ② 위탁 운영사({partner.business_name})에 대한 제3자 제공에
            동의합니다. &nbsp;&nbsp; ☐ 동의 &nbsp;&nbsp; ☐ 동의하지 않음
          </div>
          <div>
            ③ 활동 사진·영상 촬영 및 홍보 목적 활용에 동의합니다. (선택)
            &nbsp;&nbsp; ☐ 동의 &nbsp;&nbsp; ☐ 동의하지 않음
          </div>
        </div>
      </section>

      <div className="mt-10 text-center text-[12pt]">{today}</div>

      <div className="mt-8 grid grid-cols-2 gap-8 text-[11pt]">
        <div>
          <div className="font-bold">보호자 (법정대리인)</div>
          <div className="mt-3">
            아동 성명: <U>{"               "}</U>
          </div>
          <div className="mt-2">
            보호자 성명: <U>{"               "}</U>{" "}
            <span className="ml-2">(서명 또는 인)</span>
          </div>
          <div className="mt-2">
            관계: <U>{"      "}</U> (부·모·조부모 등)
          </div>
        </div>
        <div>
          <div className="font-bold">수집·이용 기관</div>
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
