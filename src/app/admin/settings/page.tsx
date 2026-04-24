import Link from "next/link";
import { AcornIcon } from "@/components/acorn-icon";

const sections = [
  {
    icon: "🌐",
    title: "도메인 설정",
    desc: "커스텀 도메인 · SSL · 서브도메인 관리",
  },
  {
    icon: "🔐",
    title: "보안·권한",
    desc: "관리자 계정·역할·2FA·접근 로그",
  },
  {
    icon: "💳",
    title: "결제 시스템",
    desc: "PG 연동·정산·세금계산서 설정",
  },
  {
    icon: "📧",
    title: "알림·이메일",
    desc: "발송 템플릿·SMTP·푸시 알림 규칙",
  },
  {
    icon: "🎨",
    title: "브랜드 커스터마이징",
    desc: "로고·컬러·폰트·앱 아이콘",
  },
  {
    icon: "📊",
    title: "분석·트래킹",
    desc: "GA4·Mixpanel·이벤트 추적 키",
  },
];

export default function AdminSettingsPage() {
  return (
    <div className="space-y-6">
      {/* 상단 네비 */}
      <div className="flex items-center justify-between">
        <Link href="/admin" className="text-sm text-[#2D5A3D] hover:underline font-medium">
          ← 대시보드
        </Link>
        <span className="rounded-full bg-[#E8F0E4] text-[#2D5A3D] px-2 py-0.5 text-[10px] font-semibold">
          준비 중
        </span>
      </div>

      {/* 헤더 */}
      <div>
        <h1 className="text-2xl font-extrabold text-[#2D5A3D] flex items-center gap-2">
          <span>⚙️</span>
          <span>시스템 설정</span>
        </h1>
        <p className="mt-1 text-sm text-[#6B6560]">
          토리로 운영에 필요한 전역 설정을 관리해요
        </p>
      </div>

      {/* 설정 카드 그리드 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {sections.map((s) => (
          <div
            key={s.title}
            className="rounded-2xl border border-[#D4E4BC] bg-white p-5 flex items-start gap-4 hover:shadow-md transition-shadow"
          >
            <div className="text-3xl flex-shrink-0">{s.icon}</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-bold text-[#2D5A3D]">{s.title}</h3>
                <span className="rounded-full bg-[#E8F0E4] text-[#2D5A3D] px-2 py-0.5 text-[10px] font-semibold">
                  준비 중
                </span>
              </div>
              <p className="mt-1 text-xs text-[#6B6560] leading-relaxed">{s.desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* 안내 */}
      <section className="rounded-2xl border border-[#E5D3B8] bg-gradient-to-br from-[#FFF8F0] to-[#F5E6D3] p-5">
        <h3 className="text-sm font-bold text-[#6B4423] flex items-center gap-1.5">
          <span>🛠️</span>
          <span>설정 기능은 단계적으로 열립니다</span>
        </h3>
        <p className="mt-2 text-xs text-[#8B6F47] leading-relaxed">
          초기에는 안정적인 기본값으로 운영되며, 사용자가 충분히 모이면 위 섹션부터 순차적으로 활성화돼요.
          <span className="inline-flex items-center gap-1">긴급한 설정이 필요하면 개발팀에 요청해 주세요 <AcornIcon /></span>
        </p>
      </section>
    </div>
  );
}
