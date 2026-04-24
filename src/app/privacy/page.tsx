import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { BackToTop } from "@/components/back-to-top";
import { AcornIcon } from "@/components/acorn-icon";

export const metadata: Metadata = {
  title: "개인정보처리방침 · 토리로",
  description:
    "토리로의 개인정보처리방침입니다. 수집 항목, 이용 목적, 보유 기간, 제3자 제공, 위탁, 국외 이전, 이용자 권리, 파기, 안전성 확보조치 등을 안내합니다.",
};

type Article = {
  id: string;
  title: string;
  content: React.ReactNode;
};

const ARTICLES: Article[] = [
  {
    id: "article-1",
    title: "제1조 (개인정보의 수집 항목 및 방법)",
    content: (
      <div className="space-y-4">
        <p>
          토리로(이하 '회사')는 회원가입, 서비스 이용, 고객 문의 응대 등을 위해
          최소한의 개인정보를 수집합니다. 수집 항목은 다음과 같습니다.
        </p>
        <div className="overflow-x-auto rounded-xl border border-[#D4E4BC]">
          <table className="w-full border-collapse text-xs md:text-sm">
            <thead className="bg-[#E8F0E4] text-[#2D5A3D]">
              <tr>
                <th className="border-b border-[#D4E4BC] px-3 py-2 text-left font-semibold">
                  구분
                </th>
                <th className="border-b border-[#D4E4BC] px-3 py-2 text-left font-semibold">
                  수집 항목
                </th>
                <th className="border-b border-[#D4E4BC] px-3 py-2 text-left font-semibold">
                  수집 시점
                </th>
              </tr>
            </thead>
            <tbody className="text-[#2C2C2C]">
              <tr>
                <td className="border-b border-[#E8F0E4] px-3 py-2 font-semibold">
                  필수
                </td>
                <td className="border-b border-[#E8F0E4] px-3 py-2">
                  휴대전화번호, 이름
                </td>
                <td className="border-b border-[#E8F0E4] px-3 py-2">
                  회원가입
                </td>
              </tr>
              <tr>
                <td className="border-b border-[#E8F0E4] px-3 py-2 font-semibold">
                  선택
                </td>
                <td className="border-b border-[#E8F0E4] px-3 py-2">
                  이메일 주소, 아이 이름(별칭), 프로필 사진
                </td>
                <td className="border-b border-[#E8F0E4] px-3 py-2">
                  회원가입·프로필 등록
                </td>
              </tr>
              <tr>
                <td className="border-b border-[#E8F0E4] px-3 py-2 font-semibold">
                  결제
                </td>
                <td className="border-b border-[#E8F0E4] px-3 py-2">
                  결제수단 정보, 결제 이력(카드사·승인번호 등)
                </td>
                <td className="border-b border-[#E8F0E4] px-3 py-2">
                  유료 서비스 결제 시
                </td>
              </tr>
              <tr>
                <td className="px-3 py-2 font-semibold">자동수집</td>
                <td className="px-3 py-2">
                  접속 로그, IP 주소, 쿠키, 기기 정보, 위치정보(동의 시)
                </td>
                <td className="px-3 py-2">서비스 이용 시</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p>
          수집 방법: 회원가입 양식 입력, 서비스 이용 과정에서의 자동 수집,
          고객센터 문의, 이벤트 응모, 파트너사로부터의 제공(이용자 동의 시).
        </p>
      </div>
    ),
  },
  {
    id: "article-2",
    title: "제2조 (개인정보의 수집·이용 목적)",
    content: (
      <ol className="list-decimal space-y-2 pl-5">
        <li>
          <span className="font-semibold">회원 관리:</span> 회원제 서비스 이용에
          따른 본인 식별·인증, 회원 자격 유지·관리, 부정 이용 방지, 각종 고지·
          통지, 고충 처리
        </li>
        <li>
          <span className="font-semibold">서비스 제공:</span> 숲길 체험 예약·
          운영, 도토리 포인트 적립·사용, 스탬프 랠리 참여 관리, 리더보드 산정,
          행사 참여 확인
        </li>
        <li>
          <span className="font-semibold">결제 및 정산:</span> 유료 서비스
          결제, 환불 처리, 파트너 정산, 전자상거래 관련 기록 보관
        </li>
        <li>
          <span className="font-semibold">마케팅 및 광고(선택 동의 시):</span>{" "}
          맞춤형 서비스 추천, 이벤트·혜택 정보 제공, 통계 분석, 광고 성과 측정
        </li>
        <li>
          <span className="font-semibold">법적 의무 이행:</span>{" "}
          전자상거래법·통신비밀보호법 등 관계 법령이 정하는 보관·신고 의무 이행
        </li>
      </ol>
    ),
  },
  {
    id: "article-3",
    title: "제3조 (개인정보의 보유 및 이용 기간)",
    content: (
      <div className="space-y-4">
        <p>
          회사는 이용자의 개인정보를 수집·이용 목적이 달성되면 지체 없이
          파기합니다. 다만 관계 법령에 따라 일정 기간 보관이 필요한 정보는 해당
          기간 동안 안전하게 보관합니다.
        </p>
        <div className="overflow-x-auto rounded-xl border border-[#D4E4BC]">
          <table className="w-full border-collapse text-xs md:text-sm">
            <thead className="bg-[#E8F0E4] text-[#2D5A3D]">
              <tr>
                <th className="border-b border-[#D4E4BC] px-3 py-2 text-left font-semibold">
                  보관 대상
                </th>
                <th className="border-b border-[#D4E4BC] px-3 py-2 text-left font-semibold">
                  보관 기간
                </th>
                <th className="border-b border-[#D4E4BC] px-3 py-2 text-left font-semibold">
                  근거 법령
                </th>
              </tr>
            </thead>
            <tbody className="text-[#2C2C2C]">
              <tr>
                <td className="border-b border-[#E8F0E4] px-3 py-2">
                  회원 기본 정보
                </td>
                <td className="border-b border-[#E8F0E4] px-3 py-2">
                  탈퇴 시 지체 없이 파기
                </td>
                <td className="border-b border-[#E8F0E4] px-3 py-2">
                  개인정보 보호법 제21조
                </td>
              </tr>
              <tr>
                <td className="border-b border-[#E8F0E4] px-3 py-2">
                  계약 또는 청약철회 등에 관한 기록
                </td>
                <td className="border-b border-[#E8F0E4] px-3 py-2">5년</td>
                <td className="border-b border-[#E8F0E4] px-3 py-2">
                  전자상거래 등에서의 소비자보호에 관한 법률
                </td>
              </tr>
              <tr>
                <td className="border-b border-[#E8F0E4] px-3 py-2">
                  대금결제 및 재화 등의 공급에 관한 기록
                </td>
                <td className="border-b border-[#E8F0E4] px-3 py-2">5년</td>
                <td className="border-b border-[#E8F0E4] px-3 py-2">
                  전자상거래 등에서의 소비자보호에 관한 법률
                </td>
              </tr>
              <tr>
                <td className="border-b border-[#E8F0E4] px-3 py-2">
                  소비자 불만 또는 분쟁 처리에 관한 기록
                </td>
                <td className="border-b border-[#E8F0E4] px-3 py-2">3년</td>
                <td className="border-b border-[#E8F0E4] px-3 py-2">
                  전자상거래 등에서의 소비자보호에 관한 법률
                </td>
              </tr>
              <tr>
                <td className="px-3 py-2">접속 로그·IP</td>
                <td className="px-3 py-2">3개월</td>
                <td className="px-3 py-2">통신비밀보호법</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    ),
  },
  {
    id: "article-4",
    title: "제4조 (개인정보의 제3자 제공)",
    content: (
      <div className="space-y-3">
        <p>
          회사는 이용자의 개인정보를 제2조에서 명시한 목적 범위 내에서만 처리
          하며, 이용자의 사전 동의 없이 제3자에게 제공하지 않습니다. 다만 다음과
          같이 서비스 운영을 위해 필요한 경우 최소한의 범위에서 제공합니다.
        </p>
        <div className="overflow-x-auto rounded-xl border border-[#D4E4BC]">
          <table className="w-full border-collapse text-xs md:text-sm">
            <thead className="bg-[#E8F0E4] text-[#2D5A3D]">
              <tr>
                <th className="border-b border-[#D4E4BC] px-3 py-2 text-left font-semibold">
                  제공받는 자
                </th>
                <th className="border-b border-[#D4E4BC] px-3 py-2 text-left font-semibold">
                  제공 목적
                </th>
                <th className="border-b border-[#D4E4BC] px-3 py-2 text-left font-semibold">
                  제공 항목
                </th>
                <th className="border-b border-[#D4E4BC] px-3 py-2 text-left font-semibold">
                  보유·이용 기간
                </th>
              </tr>
            </thead>
            <tbody className="text-[#2C2C2C]">
              <tr>
                <td className="border-b border-[#E8F0E4] px-3 py-2">
                  참여 기관(학교·유치원·지자체 등)
                </td>
                <td className="border-b border-[#E8F0E4] px-3 py-2">
                  단체 예약 확인, 행사 운영
                </td>
                <td className="border-b border-[#E8F0E4] px-3 py-2">
                  이름, 휴대전화번호, 참여 인원
                </td>
                <td className="border-b border-[#E8F0E4] px-3 py-2">
                  행사 종료 후 1개월
                </td>
              </tr>
              <tr>
                <td className="px-3 py-2">참여 업체(숲지기)</td>
                <td className="px-3 py-2">
                  체험 프로그램 운영, 본인 확인
                </td>
                <td className="px-3 py-2">
                  이름, 휴대전화번호, 예약 내역
                </td>
                <td className="px-3 py-2">행사 종료 후 1개월</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-xs text-[#6B6560]">
          * 법령에 특별한 규정이 있거나 수사 목적으로 법령에 정해진 절차와
          방법에 따라 수사기관의 요구가 있는 경우 예외적으로 제공될 수 있습니다.
        </p>
      </div>
    ),
  },
  {
    id: "article-5",
    title: "제5조 (개인정보 처리 위탁)",
    content: (
      <div className="space-y-3">
        <p>
          회사는 서비스 제공을 위하여 다음과 같이 개인정보 처리를 위탁하고
          있으며, 관계 법령에 따라 위탁계약 시 개인정보가 안전하게 관리되도록
          필요한 사항을 규정하고 있습니다.
        </p>
        <div className="overflow-x-auto rounded-xl border border-[#D4E4BC]">
          <table className="w-full border-collapse text-xs md:text-sm">
            <thead className="bg-[#E8F0E4] text-[#2D5A3D]">
              <tr>
                <th className="border-b border-[#D4E4BC] px-3 py-2 text-left font-semibold">
                  수탁업체
                </th>
                <th className="border-b border-[#D4E4BC] px-3 py-2 text-left font-semibold">
                  위탁 업무 내용
                </th>
                <th className="border-b border-[#D4E4BC] px-3 py-2 text-left font-semibold">
                  보유·이용 기간
                </th>
              </tr>
            </thead>
            <tbody className="text-[#2C2C2C]">
              <tr>
                <td className="border-b border-[#E8F0E4] px-3 py-2">
                  Supabase Inc.
                </td>
                <td className="border-b border-[#E8F0E4] px-3 py-2">
                  데이터베이스(DB) 운영·인증 인프라
                </td>
                <td className="border-b border-[#E8F0E4] px-3 py-2">
                  회원 탈퇴 시 또는 위탁 계약 종료 시
                </td>
              </tr>
              <tr>
                <td className="border-b border-[#E8F0E4] px-3 py-2">
                  Vercel Inc.
                </td>
                <td className="border-b border-[#E8F0E4] px-3 py-2">
                  웹·모바일 호스팅, CDN 운영
                </td>
                <td className="border-b border-[#E8F0E4] px-3 py-2">
                  회원 탈퇴 시 또는 위탁 계약 종료 시
                </td>
              </tr>
              <tr>
                <td className="px-3 py-2">솔라피(SOLAPI)</td>
                <td className="px-3 py-2">
                  SMS·알림톡·문자메시지 발송
                </td>
                <td className="px-3 py-2">발송 후 관련 법령 보관 기간</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    ),
  },
  {
    id: "article-6",
    title: "제6조 (개인정보의 국외 이전)",
    content: (
      <div className="space-y-3">
        <p>
          회사는 안정적인 서비스 제공을 위하여 일부 개인정보 처리를 국외의
          수탁업체에 위탁하고 있으며, 「개인정보 보호법」 제28조의8에 따라 다음
          내용을 이용자에게 고지합니다.
        </p>
        <div className="overflow-x-auto rounded-xl border border-[#D4E4BC]">
          <table className="w-full border-collapse text-xs md:text-sm">
            <thead className="bg-[#E8F0E4] text-[#2D5A3D]">
              <tr>
                <th className="border-b border-[#D4E4BC] px-3 py-2 text-left font-semibold">
                  이전 업체
                </th>
                <th className="border-b border-[#D4E4BC] px-3 py-2 text-left font-semibold">
                  이전 국가
                </th>
                <th className="border-b border-[#D4E4BC] px-3 py-2 text-left font-semibold">
                  이전 일시·방법
                </th>
                <th className="border-b border-[#D4E4BC] px-3 py-2 text-left font-semibold">
                  이전 목적·기간
                </th>
              </tr>
            </thead>
            <tbody className="text-[#2C2C2C]">
              <tr>
                <td className="border-b border-[#E8F0E4] px-3 py-2">
                  Supabase Inc.
                </td>
                <td className="border-b border-[#E8F0E4] px-3 py-2">
                  미국(AWS ap-northeast-2, 서울 리전 기본)
                </td>
                <td className="border-b border-[#E8F0E4] px-3 py-2">
                  서비스 이용 시 네트워크를 통한 전송
                </td>
                <td className="border-b border-[#E8F0E4] px-3 py-2">
                  DB 운영 / 위탁 종료 시까지
                </td>
              </tr>
              <tr>
                <td className="px-3 py-2">Vercel Inc.</td>
                <td className="px-3 py-2">미국</td>
                <td className="px-3 py-2">
                  서비스 이용 시 네트워크를 통한 전송
                </td>
                <td className="px-3 py-2">호스팅 / 위탁 종료 시까지</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-xs text-[#6B6560]">
          * 이전되는 개인정보 항목: 제1조의 수집 항목 중 서비스 이용에 필요한
          항목. 이용자는 국외 이전을 거부할 권리가 있으며, 거부 시 서비스 이용이
          제한될 수 있습니다.
        </p>
      </div>
    ),
  },
  {
    id: "article-7",
    title: "제7조 (이용자 및 법정대리인의 권리와 행사 방법)",
    content: (
      <div className="space-y-3">
        <p>
          이용자 및 법정대리인은 「개인정보 보호법」 제35조부터 제37조에 따라
          언제든지 회사에 대하여 다음의 권리를 행사할 수 있습니다.
        </p>
        <ol className="list-decimal space-y-1 pl-5">
          <li>개인정보 열람 요구</li>
          <li>오류 등이 있을 경우 정정 요구</li>
          <li>삭제 요구</li>
          <li>처리 정지 요구</li>
          <li>동의 철회</li>
        </ol>
        <p>
          권리 행사는 개인정보보호책임자에게 이메일(privacy@toriro.com), 서면,
          팩스 등을 통하여 하실 수 있으며, 회사는 이에 대해 지체 없이
          조치하겠습니다.
        </p>
        <p className="text-xs text-[#6B6560]">
          이용자가 개인정보의 오류 등에 대한 정정 또는 삭제를 요구한 경우에는
          회사는 정정 또는 삭제를 완료할 때까지 당해 개인정보를 이용하거나
          제공하지 않습니다.
        </p>
      </div>
    ),
  },
  {
    id: "article-8",
    title: "제8조 (개인정보의 파기)",
    content: (
      <div className="space-y-3">
        <p>
          회사는 개인정보 보유 기간의 경과, 처리 목적 달성 등 개인정보가
          불필요하게 되었을 때에는 지체 없이 해당 개인정보를 파기합니다.
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <span className="font-semibold">파기 절차:</span> 이용자가 입력한
            정보는 목적 달성 후 별도의 DB로 옮겨져(종이의 경우 별도의 서류함)
            내부 방침 및 기타 관련 법령에 따라 일정 기간 저장된 후 혹은 즉시
            파기됩니다.
          </li>
          <li>
            <span className="font-semibold">파기 방법:</span> 전자적 파일
            형태의 정보는 기록을 재생할 수 없는 기술적 방법을 사용하여 영구
            삭제합니다. 종이에 출력된 개인정보는 분쇄기로 분쇄하거나 소각을
            통하여 파기합니다.
          </li>
        </ul>
      </div>
    ),
  },
  {
    id: "article-9",
    title: "제9조 (개인정보 자동 수집 장치의 설치·운영 및 거부)",
    content: (
      <div className="space-y-3">
        <p>
          회사는 이용자에게 개별적인 맞춤 서비스를 제공하기 위해 이용 정보를
          저장하고 수시로 불러오는 '쿠키(cookie)'를 사용합니다.
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <span className="font-semibold">쿠키의 사용 목적:</span> 이용자가
            방문한 각 서비스의 접속 빈도, 방문 시간 등 분석, 이용자 취향 및
            관심 분야 파악, 보안 접속 유지
          </li>
          <li>
            <span className="font-semibold">쿠키의 설치·운영 및 거부:</span>{" "}
            웹브라우저 상단의 [도구] &gt; [인터넷 옵션] &gt; [개인정보] 메뉴의
            옵션 설정을 통해 쿠키 저장을 거부할 수 있습니다.
          </li>
          <li>
            <span className="font-semibold">주의:</span> 쿠키 저장을 거부할
            경우 로그인이 필요한 일부 서비스 이용에 어려움이 발생할 수
            있습니다.
          </li>
        </ul>
      </div>
    ),
  },
  {
    id: "article-10",
    title: "제10조 (아동의 개인정보 보호)",
    content: (
      <div className="space-y-3">
        <p>
          회사는 만 14세 미만 아동의 회원가입을 원칙적으로 제한하며, 예외적으로
          수집이 필요한 경우에는 반드시 법정대리인의 동의를 받습니다.
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            법정대리인의 동의를 받기 위하여 아동으로부터 법정대리인의 성명,
            연락처 등 최소한의 정보를 수집할 수 있으며, 동의 확인 후 즉시
            파기합니다.
          </li>
          <li>
            법정대리인은 아동의 개인정보에 대한 열람·정정·삭제·처리정지 및 동의
            철회를 요구할 수 있습니다.
          </li>
          <li>
            가족 단위 서비스 특성상 보호자 계정의 '패밀리 프로필'로 아동 정보가
            등록되는 경우, 해당 정보의 관리 책임은 법정대리인에게 있습니다.
          </li>
        </ul>
      </div>
    ),
  },
  {
    id: "article-11",
    title: "제11조 (개인정보의 안전성 확보 조치)",
    content: (
      <div className="space-y-3">
        <p>
          회사는 「개인정보 보호법」 제29조에 따라 개인정보의 안전성 확보를
          위하여 다음과 같은 관리적·기술적·물리적 조치를 하고 있습니다.
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <span className="font-semibold">관리적 조치:</span> 내부관리계획
            수립·시행, 개인정보취급자 최소화 및 정기 교육, 정기 자체 감사
          </li>
          <li>
            <span className="font-semibold">기술적 조치:</span> 개인정보처리
            시스템 접근권한 관리, 접근통제시스템 설치, 고유 식별정보 등의
            암호화, 보안프로그램 설치 및 주기적 갱신, 접속기록 보관(1년 이상)
            및 위·변조 방지
          </li>
          <li>
            <span className="font-semibold">물리적 조치:</span> 전산실·자료
            보관실 등의 접근통제
          </li>
        </ul>
      </div>
    ),
  },
  {
    id: "article-12",
    title: "제12조 (개인정보 보호책임자 및 담당 부서)",
    content: (
      <div className="space-y-3">
        <p>
          회사는 개인정보 처리에 관한 업무를 총괄해서 책임지고, 개인정보 처리와
          관련한 이용자의 불만 처리 및 피해 구제 등을 위하여 아래와 같이
          개인정보 보호책임자를 지정하고 있습니다.
        </p>
        <div className="rounded-xl border border-[#D4E4BC] bg-[#E8F0E4]/60 p-4 text-sm">
          <p className="font-semibold text-[#2D5A3D]">
            개인정보 보호책임자
          </p>
          <ul className="mt-2 space-y-1 text-[#2C2C2C]">
            <li>성명: 홍길동</li>
            <li>이메일: privacy@toriro.com</li>
            <li>전화: 1588-0000</li>
          </ul>
          <p className="mt-3 font-semibold text-[#2D5A3D]">
            고충처리·문의 부서
          </p>
          <ul className="mt-2 space-y-1 text-[#2C2C2C]">
            <li>부서명: 고객지원팀</li>
            <li>이메일: hello@toriro.com</li>
            <li>전화: 1588-0000 (평일 10:00–18:00, 공휴일 제외)</li>
          </ul>
        </div>
      </div>
    ),
  },
  {
    id: "article-13",
    title: "제13조 (권익침해 구제 방법)",
    content: (
      <div className="space-y-3">
        <p>
          이용자는 개인정보 침해로 인한 구제를 받기 위하여 개인정보분쟁조정
          위원회, 한국인터넷진흥원 개인정보침해신고센터 등에 분쟁해결이나 상담
          등을 신청할 수 있습니다.
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            개인정보분쟁조정위원회: (국번없이) 1833-6972 ·{" "}
            <a
              href="https://www.kopico.go.kr"
              target="_blank"
              rel="noreferrer noopener"
              className="text-[#2D5A3D] underline"
            >
              www.kopico.go.kr
            </a>
          </li>
          <li>
            개인정보침해신고센터: (국번없이) 118 ·{" "}
            <a
              href="https://privacy.go.kr"
              target="_blank"
              rel="noreferrer noopener"
              className="text-[#2D5A3D] underline"
            >
              privacy.go.kr
            </a>
          </li>
          <li>
            대검찰청 사이버수사과: (국번없이) 1301 ·{" "}
            <a
              href="https://www.spo.go.kr"
              target="_blank"
              rel="noreferrer noopener"
              className="text-[#2D5A3D] underline"
            >
              www.spo.go.kr
            </a>
          </li>
          <li>
            경찰청 사이버수사국: (국번없이) 182 ·{" "}
            <a
              href="https://cyberbureau.police.go.kr"
              target="_blank"
              rel="noreferrer noopener"
              className="text-[#2D5A3D] underline"
            >
              cyberbureau.police.go.kr
            </a>
          </li>
        </ul>
      </div>
    ),
  },
];

export default function PrivacyPage() {
  return (
    <div className="min-h-dvh bg-[#FFF8F0] text-[#2C2C2C]">
      <header className="border-b border-[#D4E4BC] bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link
            href="/"
            className="flex items-center gap-2 font-bold text-[#2D5A3D]"
          >
            <AcornIcon size={20} />
            <span>토리로</span>
          </Link>
          <Link
            href="/"
            className="text-xs font-semibold text-[#2D5A3D] hover:underline"
          >
            ← 홈으로
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-10 md:py-14">
        <p className="text-xs font-semibold tracking-[0.3em] text-[#8B6F47]">
          PRIVACY POLICY
        </p>
        <div className="mt-2 flex flex-wrap items-end gap-3">
          <h1 className="font-serif text-3xl font-extrabold text-[#2D5A3D] md:text-4xl">
            개인정보처리방침
          </h1>
          <span className="inline-flex items-center rounded-full border border-[#D4E4BC] bg-white px-3 py-1 text-xs font-semibold text-[#2D5A3D]">
            시행일 2026-04-20
          </span>
        </div>

        {/* Sample disclaimer */}
        <div
          role="note"
          className="mt-6 rounded-2xl border-l-4 border-amber-400 bg-amber-50 p-4 text-sm leading-relaxed text-amber-900"
        >
          <p className="font-semibold">
            ⚠️ 이 문서는 샘플입니다. 실제 서비스 운영 시 법률 자문을 받아
            수정하세요.
          </p>
          <p className="mt-1 text-xs text-amber-800">
            본 방침은 「개인정보 보호법」의 일반적 요건을 반영하여 작성된
            템플릿이며, 실 운영 환경과 수탁업체 현황에 맞게 반드시 개인정보
            전문 변호사·CPO의 검토를 거쳐 확정해 주세요.
          </p>
        </div>

        {/* Overview */}
        <div className="mt-6 rounded-2xl border border-[#D4E4BC] bg-[#E8F0E4]/60 p-5 text-sm leading-relaxed text-[#2D5A3D]">
          <p className="font-semibold">개인정보처리방침 개요</p>
          <p className="mt-2 text-[#2C2C2C]">
            토리로(TORIRO, 이하 '회사')는 이용자의 개인정보를 소중히 여기며,
            「개인정보 보호법」, 「정보통신망 이용촉진 및 정보보호 등에 관한
            법률」 등 관련 법령을 준수하고 있습니다. 회사는 본 개인정보처리
            방침을 통해 이용자가 제공하는 개인정보가 어떠한 목적과 방식으로
            이용되고 있으며, 개인정보 보호를 위해 어떤 조치가 취해지고 있는지
            알려드립니다.
          </p>
        </div>

        {/* Table of contents */}
        <nav
          aria-label="목차"
          className="mt-6 rounded-2xl border border-[#D4E4BC] bg-white p-5 text-sm md:p-6"
        >
          <p className="text-xs font-bold tracking-wider text-[#8B6F47]">
            목차
          </p>
          <ol className="mt-3 grid grid-cols-1 gap-x-4 gap-y-1 md:grid-cols-2">
            {ARTICLES.map((a) => (
              <li key={a.id}>
                <a
                  href={`#${a.id}`}
                  className="text-[#2D5A3D] hover:underline"
                >
                  {a.title}
                </a>
              </li>
            ))}
            <li>
              <a
                href="#addendum"
                className="text-[#2D5A3D] hover:underline"
              >
                부칙 및 변경 이력
              </a>
            </li>
          </ol>
        </nav>

        <div className="mt-8 space-y-10 rounded-3xl border border-[#D4E4BC] bg-white p-7 shadow-sm md:p-10">
          {ARTICLES.map((a) => (
            <section key={a.id} id={a.id} className="scroll-mt-24">
              <h2 className="font-serif text-lg font-extrabold text-[#2D5A3D] md:text-xl">
                {a.title}
              </h2>
              <div className="mt-4 text-sm leading-relaxed text-[#2C2C2C]">
                {a.content}
              </div>
            </section>
          ))}

          <section
            id="addendum"
            className="scroll-mt-24 border-t border-[#E8F0E4] pt-8"
          >
            <h2 className="font-serif text-lg font-extrabold text-[#2D5A3D] md:text-xl">
              부칙 및 변경 이력
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-[#2C2C2C]">
              본 개인정보처리방침은 2026년 4월 20일부터 시행합니다. 방침의
              내용 추가·삭제·수정이 있을 때에는 시행 최소 7일 전(이용자에게
              불리한 변경의 경우 최소 30일 전)에 서비스 내 공지사항을 통해
              고지합니다.
            </p>
            <ul className="mt-4 list-disc space-y-1 pl-5 text-xs text-[#6B6560]">
              <li>2026-04-20 : 최초 제정 및 시행</li>
            </ul>
          </section>
        </div>
      </main>

      <SiteFooter />
      <BackToTop />
    </div>
  );
}
