import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";

export const metadata: Metadata = {
  title: "개인정보처리방침 · 토리로",
  description:
    "토리로의 개인정보처리방침입니다. 수집 항목, 이용 목적, 보유 기간, 제3자 제공, 이용자 권리 등을 안내합니다.",
};

const SECTIONS: { title: string; body: string[] }[] = [
  {
    title: "1. 수집하는 개인정보 항목",
    body: [
      "회사는 서비스 제공을 위해 다음 항목을 수집합니다.",
      "  • 필수: 이름, 휴대폰 번호, 이메일, 생년월일, 결제수단 정보",
      "  • 선택: 자녀 나이대(체험 추천용), 프로필 사진, 마케팅 수신 동의 여부",
      "  • 자동 수집: 서비스 이용 기록, 접속 IP, 쿠키, 기기 정보, 위치정보(이용자 동의 시)",
    ],
  },
  {
    title: "2. 개인정보의 수집·이용 목적",
    body: [
      "  • 회원 식별 및 본인 확인, 서비스 제공",
      "  • 숲길 예약·결제·환불, 도토리 적립 및 사용",
      "  • 고객 문의 응대 및 분쟁 처리",
      "  • 서비스 개선 및 신규 서비스 개발",
      "  • 마케팅 및 광고 활용(별도 동의한 경우에 한함)",
    ],
  },
  {
    title: "3. 개인정보의 보유 및 이용 기간",
    body: [
      "회사는 원칙적으로 개인정보 수집·이용 목적이 달성된 후 해당 정보를 지체 없이 파기합니다. 다만 관련 법령에 따라 다음 정보는 명시된 기간 동안 보관합니다.",
      "  • 계약 또는 청약철회 등에 관한 기록: 5년 (전자상거래법)",
      "  • 대금결제 및 재화 등의 공급에 관한 기록: 5년 (전자상거래법)",
      "  • 소비자 불만 또는 분쟁처리에 관한 기록: 3년 (전자상거래법)",
      "  • 로그인 기록: 3개월 (통신비밀보호법)",
    ],
  },
  {
    title: "4. 개인정보의 제3자 제공",
    body: [
      "회사는 이용자의 개인정보를 원칙적으로 외부에 제공하지 않습니다. 다만 다음의 경우에는 예외로 합니다.",
      "  • 이용자가 사전에 동의한 경우",
      "  • 법령의 규정에 의하거나 수사 목적으로 법령에 정해진 절차에 따라 수사기관의 요구가 있는 경우",
      "  • 숲지기에게는 예약 확인 목적에 한해 이용자 성함·예약 인원·연락처가 제공됩니다.",
    ],
  },
  {
    title: "5. 개인정보 처리의 위탁",
    body: [
      "회사는 서비스 향상을 위해 다음과 같이 개인정보 처리를 위탁하고 있습니다.",
      "  • 결제 처리: 토스페이먼츠, 카카오페이",
      "  • 클라우드 인프라: Amazon Web Services, Supabase",
      "  • 알림톡·SMS 발송: NHN 클라우드",
      "  • 고객 응대: 채널톡",
      "위탁 계약 시 개인정보 보호 관련 법규 준수 및 기술적·관리적 보호조치 의무를 명시하고 있습니다.",
    ],
  },
  {
    title: "6. 이용자 및 법정대리인의 권리와 행사 방법",
    body: [
      "  • 이용자는 언제든지 자신의 개인정보를 조회하거나 수정할 수 있으며, 가입 해지를 요청할 수 있습니다.",
      "  • 만 14세 미만 아동의 경우 법정대리인이 권리를 대리 행사할 수 있습니다.",
      "  • 권리 행사는 앱 내 설정 메뉴 또는 privacy@toriro.kr로 요청하실 수 있으며, 회사는 지체 없이 조치합니다.",
    ],
  },
  {
    title: "7. 개인정보의 파기 절차 및 방법",
    body: [
      "  • 파기 절차: 목적 달성 후 내부 방침 및 관련 법령에 의한 정보보호 사유에 따라 일정 기간 저장 후 파기됩니다.",
      "  • 파기 방법: 전자적 파일은 복구 불가능한 방법으로 영구 삭제하며, 종이 문서는 분쇄기로 분쇄합니다.",
    ],
  },
  {
    title: "8. 개인정보의 안전성 확보 조치",
    body: [
      "  • 기술적 조치: 개인정보 암호화 저장, 전송 구간 TLS 적용, 접근통제시스템 운영, 보안 프로그램 설치",
      "  • 관리적 조치: 개인정보 취급자 최소화, 정기 교육 실시, 내부관리계획 수립·시행",
      "  • 물리적 조치: 전산실·자료보관실 접근 통제",
    ],
  },
  {
    title: "9. 쿠키의 운용 및 거부",
    body: [
      "회사는 서비스 제공을 위해 쿠키를 사용합니다. 이용자는 웹 브라우저 설정을 통해 쿠키 저장을 거부할 수 있으나, 이 경우 일부 서비스 이용에 제한이 있을 수 있습니다.",
    ],
  },
  {
    title: "10. 만 14세 미만 아동의 개인정보 보호",
    body: [
      "회사는 만 14세 미만 아동의 개인정보를 수집하는 경우 반드시 법정대리인의 동의를 받으며, 법정대리인은 아동의 개인정보 열람·정정·삭제를 요구할 수 있습니다.",
    ],
  },
  {
    title: "11. 개인정보 보호책임자",
    body: [
      "  • 개인정보 보호책임자: 홍길동 (privacy@toriro.kr / 1544-0000)",
      "  • 개인정보 보호 관련 문의·고충은 위 연락처로 접수하시면 지체 없이 답변해 드립니다.",
      "기타 개인정보 침해 상담이 필요한 경우 아래 기관에 문의하실 수 있습니다.",
      "  • 개인정보분쟁조정위원회 (kopico.go.kr / 1833-6972)",
      "  • 개인정보침해신고센터 (privacy.kisa.or.kr / 118)",
      "  • 대검찰청 사이버수사과 (spo.go.kr / 1301)",
      "  • 경찰청 사이버수사국 (ecrm.police.go.kr / 182)",
    ],
  },
  {
    title: "12. 개정 및 고지",
    body: [
      "이 개인정보처리방침은 2026년 1월 1일부터 적용됩니다. 내용의 추가·삭제·수정이 있을 경우 최소 7일 전에 공지합니다.",
    ],
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
          PRIVACY POLICY
        </p>
        <h1 className="mt-2 font-serif text-3xl font-extrabold text-[#2D5A3D] md:text-4xl">
          개인정보처리방침
        </h1>
        <p className="mt-3 text-sm text-[#6B6560]">
          시행일: 2026년 1월 1일 · 최종 개정일: 2026년 3월 15일
        </p>

        <div className="mt-6 rounded-2xl border border-[#D4E4BC] bg-[#E8F0E4]/60 p-5 text-sm leading-relaxed text-[#2D5A3D]">
          (주)토리로(이하 '회사')는 이용자의 개인정보를 소중히 여기며,
          개인정보보호법 및 관련 법령을 준수합니다. 본 방침은 회사가 제공하는
          모든 서비스에 적용됩니다.
        </div>

        <div className="mt-8 space-y-10 rounded-3xl border border-[#D4E4BC] bg-white p-7 shadow-sm md:p-10">
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
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
