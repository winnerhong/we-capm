import Link from "next/link";

const tiers = [
  { amount: "10만원", bonus: "0%", unit: "3,000원", popular: false },
  { amount: "30만원", bonus: "10%", unit: "2,727원", popular: false },
  { amount: "100만원", bonus: "15%", unit: "2,608원", popular: true },
  { amount: "300만원", bonus: "20%", unit: "2,500원", popular: false },
];

export default function AdminAcornsPage() {
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
          <span>🎁</span>
          <span>도토리 충전 관리</span>
        </h1>
        <p className="mt-1 text-sm text-[#6B6560]">
          숲지기(업체)의 도토리 크레딧 충전을 관리해요
        </p>
      </div>

      {/* 요약 */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-2xl border border-[#D4E4BC] bg-white p-5">
          <div className="text-xs font-medium text-[#8B6F47]">누적 충전액</div>
          <div className="text-2xl font-bold text-[#6B4423] mt-1">0<span className="text-sm font-medium ml-1">원</span></div>
        </div>
        <div className="rounded-2xl border border-[#D4E4BC] bg-white p-5">
          <div className="text-xs font-medium text-[#8B6F47]">미사용 도토리</div>
          <div className="text-2xl font-bold text-[#6B4423] mt-1">0<span className="text-sm font-medium ml-1">🌰</span></div>
        </div>
        <div className="rounded-2xl border border-[#D4E4BC] bg-white p-5">
          <div className="text-xs font-medium text-[#8B6F47]">이번달 충전</div>
          <div className="text-2xl font-bold text-[#6B4423] mt-1">0<span className="text-sm font-medium ml-1">건</span></div>
        </div>
      </div>

      {/* 충전 티어 테이블 */}
      <section>
        <h2 className="text-sm font-bold text-[#2D5A3D] mb-3">🌰 충전 티어</h2>
        <div className="rounded-2xl border border-[#D4E4BC] bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[#E8F0E4] text-[#2D5A3D]">
              <tr>
                <th className="px-4 py-3 text-left font-bold">충전액</th>
                <th className="px-4 py-3 text-center font-bold">보너스</th>
                <th className="px-4 py-3 text-right font-bold">실질 단가</th>
              </tr>
            </thead>
            <tbody>
              {tiers.map((t) => (
                <tr key={t.amount} className="border-t border-[#D4E4BC]">
                  <td className="px-4 py-3 font-semibold text-[#6B4423]">
                    {t.amount}
                    {t.popular && (
                      <span className="ml-2 rounded-full bg-[#2D5A3D] text-white px-2 py-0.5 text-[10px] font-bold">
                        인기
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center text-[#2D5A3D] font-bold">+{t.bonus}</td>
                  <td className="px-4 py-3 text-right text-[#6B6560]">{t.unit} / 🌰</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* 최근 충전 내역 */}
      <section>
        <h2 className="text-sm font-bold text-[#2D5A3D] mb-3">📋 최근 충전 내역</h2>
        <div className="rounded-2xl border border-[#D4E4BC] bg-white p-5">
          <div className="py-12 text-center">
            <span className="text-4xl">🌰</span>
            <p className="mt-3 text-sm font-semibold text-[#2D5A3D]">
              아직 충전 내역이 없어요
            </p>
            <p className="mt-1 text-xs text-[#6B6560]">
              숲지기가 도토리를 충전하면 이곳에 표시됩니다
            </p>
          </div>
        </div>
      </section>

      {/* 정책 설명 */}
      <section className="rounded-2xl border border-[#E5D3B8] bg-gradient-to-br from-[#FFF8F0] to-[#F5E6D3] p-5">
        <h3 className="text-sm font-bold text-[#6B4423] flex items-center gap-1.5">
          <span>📜</span>
          <span>도토리 정책</span>
        </h3>
        <ul className="mt-2 space-y-1 text-xs text-[#8B6F47] leading-relaxed list-disc pl-5">
          <li>기본 단가는 🌰 1개당 <b>3,000원</b>입니다.</li>
          <li>충전액이 클수록 보너스 비율이 올라가 실질 단가가 낮아져요.</li>
          <li>도토리는 리워드·광고·캠페인 집행에 사용되며, <b>환불 불가 · 유효기간 2년</b>입니다.</li>
          <li>미사용 잔액은 언제든 대시보드에서 확인할 수 있어요.</li>
        </ul>
      </section>
    </div>
  );
}
