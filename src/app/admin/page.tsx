import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function AdminHome() {
  const supabase = await createClient();
  const { data: events } = await supabase
    .from("events")
    .select("id, name, status, start_at, location, manager_id")
    .order("start_at", { ascending: false })
    .limit(5);

  const active = events?.filter((e) => e.status === "ACTIVE").length ?? 0;
  const draft = events?.filter((e) => e.status === "DRAFT").length ?? 0;
  const ended = events?.filter((e) => e.status === "ENDED" || e.status === "CONFIRMED").length ?? 0;

  const statusMap: Record<string, { label: string; dot: string; bg: string }> = {
    DRAFT: { label: "준비중", dot: "bg-neutral-400", bg: "bg-neutral-100 text-neutral-600" },
    ACTIVE: { label: "진행중", dot: "bg-green-500", bg: "bg-green-100 text-green-700" },
    ENDED: { label: "종료", dot: "bg-yellow-500", bg: "bg-yellow-100 text-yellow-700" },
    CONFIRMED: { label: "확정", dot: "bg-blue-500", bg: "bg-blue-100 text-blue-700" },
  };

  return (
    <div className="space-y-6">
      {/* 헤더 — 토리로 포레스트 */}
      <div className="rounded-2xl bg-gradient-to-br from-[#2D5A3D] via-[#3A7A52] to-[#4A7C59] p-6 text-white shadow-lg relative overflow-hidden">
        <div className="relative z-10">
          <p className="text-[11px] tracking-[0.4em] opacity-70 font-light">TORIRO</p>
          <h1 className="text-2xl font-extrabold mt-1">토리로 대시보드 🌰</h1>
          <p className="mt-2 text-sm opacity-80">오늘의 숲길을 한눈에 살펴보세요</p>
        </div>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl bg-green-50 border border-green-200 p-4">
          <div className="text-xs font-medium text-green-600">진행 중</div>
          <div className="text-3xl font-bold text-green-700 mt-1">{active}</div>
        </div>
        <div className="rounded-xl bg-neutral-50 border border-neutral-200 p-4">
          <div className="text-xs font-medium text-neutral-500">준비중</div>
          <div className="text-3xl font-bold text-neutral-700 mt-1">{draft}</div>
        </div>
        <div className="rounded-xl bg-blue-50 border border-blue-200 p-4">
          <div className="text-xs font-medium text-blue-600">종료/확정</div>
          <div className="text-3xl font-bold text-blue-700 mt-1">{ended}</div>
        </div>
      </div>

      {/* 매출 한눈에 */}
      <section className="rounded-2xl bg-gradient-to-br from-[#FFF8F0] to-[#F5E6D3] border border-[#E5D3B8] p-5 relative overflow-hidden">
        <div className="absolute top-2 right-3 text-3xl opacity-20 select-none">🌰</div>
        <div className="absolute bottom-2 right-8 text-2xl opacity-10 select-none">🌰</div>
        <div className="relative z-10">
          <h2 className="text-sm font-bold text-[#6B4423] flex items-center gap-1.5">
            <span>💰</span>
            <span>이번달 매출</span>
          </h2>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <div className="rounded-xl bg-white/70 backdrop-blur-sm p-3 border border-white/50">
              <div className="text-[10px] font-medium text-[#8B6F47]">매출</div>
              <div className="text-lg font-extrabold text-[#6B4423] mt-0.5">0원</div>
            </div>
            <div className="rounded-xl bg-white/70 backdrop-blur-sm p-3 border border-white/50">
              <div className="text-[10px] font-medium text-[#8B6F47]">업체</div>
              <div className="text-lg font-extrabold text-[#6B4423] mt-0.5">0곳 <span className="text-[10px] font-medium">활동</span></div>
            </div>
            <div className="rounded-xl bg-white/70 backdrop-blur-sm p-3 border border-white/50">
              <div className="text-[10px] font-medium text-[#8B6F47]">MRR</div>
              <div className="text-lg font-extrabold text-[#6B4423] mt-0.5">0원</div>
            </div>
          </div>
        </div>
      </section>

      {/* 핵심 메뉴 8칸 */}
      <section>
        <h2 className="text-sm font-bold text-[#2D5A3D] mb-3 px-1">🌲 숲의 메뉴</h2>
        <div className="grid grid-cols-4 gap-2.5">
          <Link href="/admin/events/new"
            className="rounded-2xl border border-[#D4E4BC] bg-white p-4 flex flex-col items-center gap-1.5 hover:border-[#2D5A3D] hover:shadow-md transition-all">
            <span className="text-3xl">🌲</span>
            <span className="text-sm font-semibold text-[#2D5A3D] text-center">새 숲 다람이</span>
            <span className="text-[10px] text-[#6B6560]">숲길 열기</span>
          </Link>
          <Link href="/admin/chat"
            className="rounded-2xl border border-[#D4E4BC] bg-white p-4 flex flex-col items-center gap-1.5 hover:border-[#2D5A3D] hover:shadow-md transition-all">
            <span className="text-3xl">🌰</span>
            <span className="text-sm font-semibold text-[#2D5A3D] text-center">토리톡</span>
            <span className="text-[10px] text-[#6B6560]">이야기 나누기</span>
          </Link>
          <Link href="/admin/stats"
            className="rounded-2xl border border-[#D4E4BC] bg-white p-4 flex flex-col items-center gap-1.5 hover:border-[#2D5A3D] hover:shadow-md transition-all">
            <span className="text-3xl">📊</span>
            <span className="text-sm font-semibold text-[#2D5A3D] text-center">전체 통계</span>
            <span className="text-[10px] text-[#6B6560]">숲의 현황</span>
          </Link>
          <Link href="/admin/partners"
            className="rounded-2xl border border-[#D4E4BC] bg-white p-4 flex flex-col items-center gap-1.5 hover:border-[#2D5A3D] hover:shadow-md transition-all">
            <span className="text-3xl">🏢</span>
            <span className="text-sm font-semibold text-[#2D5A3D] text-center">숲지기 관리</span>
            <span className="text-[10px] text-[#6B6560]">파트너 업체</span>
          </Link>
          <Link href="/admin/challenges"
            className="rounded-2xl border border-[#D4E4BC] bg-white p-4 flex flex-col items-center gap-1.5 hover:border-[#2D5A3D] hover:shadow-md transition-all">
            <span className="text-3xl">🎯</span>
            <span className="text-sm font-semibold text-[#2D5A3D] text-center">챌린지 관리</span>
            <span className="text-[10px] text-[#6B6560]">주간 챌린지</span>
          </Link>
          <Link href="/admin/acorns"
            className="rounded-2xl border border-[#D4E4BC] bg-white p-4 flex flex-col items-center gap-1.5 hover:border-[#2D5A3D] hover:shadow-md transition-all">
            <span className="text-3xl">🎁</span>
            <span className="text-sm font-semibold text-[#2D5A3D] text-center">도토리 충전</span>
            <span className="text-[10px] text-[#6B6560]">크레딧 충전</span>
          </Link>
          <Link href="/admin/ads"
            className="rounded-2xl border border-[#D4E4BC] bg-white p-4 flex flex-col items-center gap-1.5 hover:border-[#2D5A3D] hover:shadow-md transition-all">
            <span className="text-3xl">📣</span>
            <span className="text-sm font-semibold text-[#2D5A3D] text-center">숲속 정령</span>
            <span className="text-[10px] text-[#6B6560]">광고 관리</span>
          </Link>
          <Link href="/admin/settings"
            className="rounded-2xl border border-[#D4E4BC] bg-white p-4 flex flex-col items-center gap-1.5 hover:border-[#2D5A3D] hover:shadow-md transition-all">
            <span className="text-3xl">⚙️</span>
            <span className="text-sm font-semibold text-[#2D5A3D] text-center">시스템 설정</span>
            <span className="text-[10px] text-[#6B6560]">운영 설정</span>
          </Link>
        </div>
      </section>

      {/* 최근 행사 */}
      <section className="rounded-2xl border bg-white p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">최근 행사</h2>
          <Link href="/admin/events" className="text-sm text-violet-600 hover:underline font-medium">
            전체 보기 →
          </Link>
        </div>
        {events && events.length > 0 ? (
          <div className="space-y-2">
            {events.map((e) => {
              const st = statusMap[e.status] ?? statusMap.DRAFT;
              return (
                <Link key={e.id} href={`/admin/events/${e.id}`}
                  className="flex items-center gap-3 rounded-xl p-3 hover:bg-neutral-50 transition-colors">
                  <div className={`h-2.5 w-2.5 rounded-full flex-shrink-0 ${st.dot}`} />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold truncate">{e.name}</div>
                    <div className="text-xs text-neutral-500 mt-0.5">
                      {e.location && `📍 ${e.location}`}
                      {e.manager_id && ` · 🏢 ${e.manager_id}`}
                    </div>
                  </div>
                  <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold flex-shrink-0 ${st.bg}`}>
                    {st.label}
                  </span>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="py-12 text-center">
            <span className="text-4xl">🏕️</span>
            <p className="mt-3 text-sm text-neutral-500">
              행사가 없습니다.{" "}
              <Link href="/admin/events/new" className="text-violet-600 hover:underline font-medium">
                첫 행사 만들기 →
              </Link>
            </p>
          </div>
        )}
      </section>

      {/* 14가지 수익원 미니 대시보드 */}
      <section className="rounded-2xl border border-[#E5D3B8] bg-gradient-to-br from-white to-[#FFF8F0] p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-bold text-[#6B4423] flex items-center gap-1.5">
            <span>💎</span>
            <span>수익원 현황</span>
          </h2>
          <span className="text-[10px] text-[#8B6F47] font-medium">14개 수익 모델</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {[
            { icon: "🌰", label: "크레딧 판매" },
            { icon: "📅", label: "구독 서비스" },
            { icon: "💼", label: "B2B 행사" },
            { icon: "🎪", label: "마켓 수수료" },
            { icon: "👑", label: "프리미엄 멤버십" },
            { icon: "📢", label: "광고 게재" },
            { icon: "🎟️", label: "쿠폰 판매" },
            { icon: "📦", label: "구독박스" },
            { icon: "📸", label: "포토 서비스" },
            { icon: "🌱", label: "ESG 프로그램" },
          ].map((item) => (
            <div key={item.label} className="flex items-center justify-between rounded-xl bg-white/70 border border-[#E5D3B8]/50 px-3 py-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-base flex-shrink-0">{item.icon}</span>
                <span className="text-xs font-medium text-[#6B4423] truncate">{item.label}</span>
              </div>
              <span className="text-[9px] font-semibold text-[#8B6F47] bg-[#F5E6D3] rounded-full px-1.5 py-0.5 flex-shrink-0">준비 중</span>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[10px] text-[#8B6F47] text-center">나머지 4개 수익원은 곧 공개됩니다 🌳</p>
      </section>
    </div>
  );
}
