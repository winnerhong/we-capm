import Link from "next/link";

export default function AdminPartnersPage() {
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
          <span>🏢</span>
          <span>숲지기 관리</span>
        </h1>
        <p className="mt-1 text-sm text-[#6B6560]">
          파트너 업체(토리로의 숲지기)를 관리하세요
        </p>
      </div>

      {/* 통계 카드 3개 */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-2xl border border-[#D4E4BC] bg-white p-5">
          <div className="text-xs font-medium text-[#8B6F47]">총 파트너</div>
          <div className="text-2xl font-bold text-[#2D5A3D] mt-1">0<span className="text-sm font-medium ml-1">곳</span></div>
        </div>
        <div className="rounded-2xl border border-[#D4E4BC] bg-white p-5">
          <div className="text-xs font-medium text-[#8B6F47]">활성</div>
          <div className="text-2xl font-bold text-[#2D5A3D] mt-1">0<span className="text-sm font-medium ml-1">곳</span></div>
        </div>
        <div className="rounded-2xl border border-[#D4E4BC] bg-white p-5">
          <div className="text-xs font-medium text-[#8B6F47]">이번달 매출</div>
          <div className="text-2xl font-bold text-[#2D5A3D] mt-1">0<span className="text-sm font-medium ml-1">원</span></div>
        </div>
      </div>

      {/* 액션 바 */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-[#2D5A3D]">🌲 등록된 숲지기</h2>
        <Link
          href="#"
          className="rounded-xl bg-[#2D5A3D] text-white px-4 py-2 text-sm font-semibold hover:bg-[#3A7A52] transition-colors"
        >
          + 새 숲지기 등록
        </Link>
      </div>

      {/* 빈 테이블 */}
      <div className="rounded-2xl border border-[#D4E4BC] bg-white p-5">
        <div className="py-16 text-center">
          <span className="text-5xl">🌳</span>
          <p className="mt-3 text-sm font-semibold text-[#2D5A3D]">
            아직 등록된 숲지기가 없어요
          </p>
          <p className="mt-1 text-xs text-[#6B6560]">
            첫 파트너 업체를 등록하고 숲을 풍성하게 만들어보세요
          </p>
        </div>
      </div>

      {/* 수익원 설명 */}
      <section className="rounded-2xl border border-[#E5D3B8] bg-gradient-to-br from-[#FFF8F0] to-[#F5E6D3] p-5">
        <h3 className="text-sm font-bold text-[#6B4423] flex items-center gap-1.5">
          <span>💡</span>
          <span>숲지기 수익 모델</span>
        </h3>
        <p className="mt-2 text-xs text-[#8B6F47] leading-relaxed">
          14가지 수익원 중 숲지기 관련 수익은 <b>크레딧 판매(도토리)</b>, <b>구독 서비스</b>, <b>B2B 행사 주최</b>, <b>마켓 수수료</b>입니다.
          숲지기는 도토리 크레딧을 충전해 행사 참가자 리워드·홍보·배너 광고를 집행하며, 월 구독으로 고정 트래픽을 확보할 수 있어요.
        </p>
      </section>
    </div>
  );
}
