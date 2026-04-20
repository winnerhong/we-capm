import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { BackToTop } from "@/components/back-to-top";

export const metadata: Metadata = {
  title: "이용약관 · 토리로",
  description:
    "토리로 서비스의 이용약관입니다. 회원가입, 서비스 이용, 환불, 책임 제한 등에 관한 규정을 안내합니다.",
};

const SECTIONS: { title: string; body: string[] }[] = [
  {
    title: "제1조 (목적)",
    body: [
      "이 약관은 (주)토리로(이하 '회사')가 운영하는 서비스 '토리로'(이하 '서비스')의 이용과 관련하여 회사와 회원 사이의 권리, 의무 및 책임사항, 이용조건과 절차 등 기본적인 사항을 규정함을 목적으로 합니다.",
    ],
  },
  {
    title: "제2조 (정의)",
    body: [
      "① '서비스'란 회사가 제공하는 가족 단위 숲길 체험 예약, 미션 수행, 도토리 포인트 적립·사용 등 일체의 온·오프라인 서비스를 의미합니다.",
      "② '회원'이란 약관에 동의하고 회사와 이용계약을 체결한 자를 말합니다.",
      "③ '숲지기'란 회사와 별도의 제휴 계약을 체결하고 서비스 내에서 숲길 프로그램을 운영하는 개인 또는 법인을 말합니다.",
      "④ '도토리'란 서비스 내에서 적립·사용 가능한 포인트를 의미하며, 현금으로 환급되지 않습니다.",
    ],
  },
  {
    title: "제3조 (약관의 게시와 개정)",
    body: [
      "① 회사는 이 약관의 내용을 회원이 쉽게 알 수 있도록 서비스 초기 화면 또는 연결화면을 통해 게시합니다.",
      "② 회사는 관련 법령을 위배하지 않는 범위에서 이 약관을 개정할 수 있으며, 개정 시 적용일자 및 개정 사유를 명시하여 최소 7일(회원에게 불리한 변경의 경우 30일) 이전부터 공지합니다.",
      "③ 회원이 개정 약관에 동의하지 않는 경우 이용계약을 해지할 수 있으며, 공지된 적용일까지 거부 의사를 표시하지 않으면 동의한 것으로 간주합니다.",
    ],
  },
  {
    title: "제4조 (이용계약의 성립)",
    body: [
      "① 이용계약은 이용자가 약관 내용에 동의한 후 회원가입 신청을 하고, 회사가 이를 승낙함으로써 성립합니다.",
      "② 회사는 다음 각 호에 해당하는 신청에 대해서는 승낙하지 않을 수 있습니다.",
      "  1. 타인의 명의를 사용하여 신청한 경우",
      "  2. 허위 정보를 기재하거나 기재사항을 누락한 경우",
      "  3. 만 14세 미만의 아동이 법정대리인의 동의 없이 신청한 경우",
    ],
  },
  {
    title: "제5조 (서비스의 제공 및 변경)",
    body: [
      "① 회사는 회원에게 다음과 같은 서비스를 제공합니다: 숲길 검색 및 예약, 미션 수행 및 도토리 적립, 제휴 상점에서의 도토리 사용, 가족 단위 메신저, 기타 회사가 정하는 서비스.",
      "② 회사는 운영상·기술상 필요에 따라 서비스 내용을 변경할 수 있으며, 이 경우 변경된 내용을 서비스 내에 사전 공지합니다.",
      "③ 회사는 천재지변, 시스템 점검, 통신 두절 등 불가항력적 사유로 인해 서비스 제공을 일시적으로 중단할 수 있습니다.",
    ],
  },
  {
    title: "제6조 (회원의 의무)",
    body: [
      "회원은 다음 행위를 하여서는 안 됩니다.",
      "  1. 타인의 정보를 도용하거나 허위 사실을 등록하는 행위",
      "  2. 서비스 운영을 방해하거나 고의로 시스템에 과부하를 발생시키는 행위",
      "  3. 제3자의 저작권, 초상권, 기타 권리를 침해하는 행위",
      "  4. 공공질서 및 미풍양속에 반하는 정보를 게시하는 행위",
      "  5. 회사가 허용하지 않은 상업적 목적으로 서비스를 이용하는 행위",
    ],
  },
  {
    title: "제7조 (도토리의 적립·사용)",
    body: [
      "① 도토리는 숲길 미션 완료, 이벤트 참여, 기업 후원 등 회사가 정한 방식으로 적립됩니다.",
      "② 도토리는 회사가 지정한 제휴 상점·프로그램에서만 사용 가능하며, 현금으로 환급할 수 없습니다.",
      "③ 최종 적립일로부터 1년간 사용하지 않은 도토리는 소멸됩니다. 소멸 30일 전 회사가 회원에게 사전 고지합니다.",
      "④ 부정한 방법으로 적립된 도토리는 회사가 회수할 수 있습니다.",
    ],
  },
  {
    title: "제8조 (예약·취소·환불)",
    body: [
      "① 체험 24시간 이전 취소 시 전액 환불, 24시간 이내 취소 시 50% 환불, 당일 노쇼의 경우 환불이 불가합니다.",
      "② 기상특보 발효, 천재지변, 숲지기 귀책 사유로 인한 취소는 전액 환불됩니다.",
      "③ 환불은 결제수단 원복을 원칙으로 하며, 영업일 기준 3~5일 내에 처리됩니다.",
    ],
  },
  {
    title: "제9조 (계약 해지 및 이용제한)",
    body: [
      "① 회원은 언제든지 회원 탈퇴를 통해 이용계약을 해지할 수 있습니다.",
      "② 회사는 회원이 본 약관 제6조의 의무를 위반하는 경우 사전 통지 후 이용제한, 계약 해지 등의 조치를 취할 수 있습니다.",
    ],
  },
  {
    title: "제10조 (책임 제한)",
    body: [
      "① 회사는 천재지변, 전쟁, 기간통신사업자의 서비스 중지 등 불가항력으로 서비스를 제공할 수 없는 경우 책임이 면제됩니다.",
      "② 회사는 회원의 귀책사유로 인한 서비스 이용 장애에 대해 책임지지 않습니다.",
      "③ 회사는 숲지기가 제공하는 체험 프로그램 자체의 품질 및 안전에 관하여 직접적인 당사자는 아니며, 이와 관련한 분쟁은 회원과 숲지기 간 협의로 해결함을 원칙으로 합니다. 다만 회사는 분쟁 조정을 위해 성실히 협력합니다.",
    ],
  },
  {
    title: "제11조 (준거법 및 재판관할)",
    body: [
      "이 약관과 관련된 분쟁에 대해서는 대한민국 법을 적용하며, 소송이 제기되는 경우 회사 본점 소재지를 관할하는 법원을 제1심 관할법원으로 합니다.",
    ],
  },
];

export default function TermsPage() {
  return (
    <div className="min-h-dvh bg-[#FFF8F0] text-[#2C2C2C]">
      {/* Top bar */}
      <header className="border-b border-[#D4E4BC] bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link
            href="/"
            className="flex items-center gap-2 font-bold text-[#2D5A3D]"
          >
            <span className="text-xl" aria-hidden>
              🌰
            </span>
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
          TERMS OF SERVICE
        </p>
        <h1 className="mt-2 font-serif text-3xl font-extrabold text-[#2D5A3D] md:text-4xl">
          이용약관
        </h1>
        <p className="mt-3 text-sm text-[#6B6560]">
          시행일: 2026년 1월 1일
        </p>

        <div className="mt-10 space-y-10 rounded-3xl border border-[#D4E4BC] bg-white p-7 shadow-sm md:p-10">
          {SECTIONS.map((s) => (
            <section key={s.title}>
              <h2 className="font-serif text-lg font-extrabold text-[#2D5A3D] md:text-xl">
                {s.title}
              </h2>
              <div className="mt-3 space-y-3">
                {s.body.map((p, i) => (
                  <p
                    key={i}
                    className="whitespace-pre-line text-[15px] leading-[1.95] text-[#2C2C2C]"
                  >
                    {p}
                  </p>
                ))}
              </div>
            </section>
          ))}

          <section className="border-t border-[#E8F0E4] pt-8 text-xs text-[#8B6F47]">
            <p>부칙</p>
            <p className="mt-1">
              본 약관은 2026년 1월 1일부터 시행합니다. 이전 약관은 본 약관으로
              대체됩니다.
            </p>
          </section>
        </div>
      </main>

      <SiteFooter />
      <BackToTop />
    </div>
  );
}
