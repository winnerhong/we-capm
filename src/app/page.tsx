import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Testimonials } from "@/components/testimonials";
import { SiteFooter } from "@/components/site-footer";
import { PWAInstallPrompt } from "@/components/pwa-install-prompt";
import { OrganizationLD } from "@/components/organization-ld";

export const metadata: Metadata = {
  title: "토리로 — 숲길에서 만나는 가족의 하루",
  description:
    "가족 · 기업 · 지역사회가 숲길에서 만나는 토리로. 오늘의 숲길을 찾아보세요.",
};

export const dynamic = "force-dynamic";

async function loadStats(): Promise<{
  activeEvents: number;
  partners: number;
  families: number;
}> {
  const supabase = await createClient();
  const [{ count: activeEvents }, { count: partners }, { count: families }] =
    await Promise.all([
      supabase
        .from("events")
        .select("id", { count: "exact", head: true })
        .in("status", ["ACTIVE", "DRAFT"]),
      supabase
        .from("partners")
        .select("id", { count: "exact", head: true })
        .eq("status", "ACTIVE"),
      supabase.from("participants").select("id", { count: "exact", head: true }),
    ]);
  return {
    activeEvents: activeEvents ?? 0,
    partners: partners ?? 0,
    families: families ?? 0,
  };
}

export default async function HomePage() {
  const stats = await loadStats();

  return (
    <div className="min-h-dvh bg-[#FFF8F0] text-[#2C2C2C]">
      <OrganizationLD />
      {/* Top bar */}
      <header className="sticky top-0 z-20 border-b border-[#D4E4BC] bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link href="/" className="flex items-center gap-2 font-bold text-[#2D5A3D]">
            <span className="text-xl" aria-hidden>
              🌰
            </span>
            <span>토리로</span>
          </Link>
          <nav className="flex items-center gap-1 text-xs font-semibold">
            <Link
              href="/events"
              className="rounded-full px-3 py-1.5 text-[#2D5A3D] hover:bg-[#E8F0E4]"
            >
              숲길 찾기
            </Link>
            <Link
              href="/programs"
              className="hidden rounded-full px-3 py-1.5 text-[#2D5A3D] hover:bg-[#E8F0E4] sm:inline-block"
            >
              프로그램
            </Link>
            <Link
              href="/enterprise"
              className="hidden rounded-full px-3 py-1.5 text-[#2D5A3D] hover:bg-[#E8F0E4] sm:inline-block"
            >
              기업
            </Link>
            <Link
              href="/partner"
              className="rounded-full bg-[#2D5A3D] px-3 py-1.5 text-white hover:bg-[#234a30]"
            >
              숲지기
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#1F3D2B] via-[#2D5A3D] to-[#4A7C59] text-white">
        <div className="pointer-events-none absolute inset-0 opacity-20">
          <div className="absolute left-6 top-10 text-7xl">🌲</div>
          <div className="absolute right-10 top-20 text-6xl">🌳</div>
          <div className="absolute bottom-10 left-1/4 text-6xl">🍂</div>
          <div className="absolute bottom-6 right-1/4 text-5xl">🌰</div>
          <div className="absolute left-1/2 top-1/3 text-5xl">🐿️</div>
        </div>
        <div className="relative z-10 mx-auto max-w-4xl px-4 py-16 text-center md:py-24">
          <p className="text-xs font-semibold tracking-[0.4em] text-[#D4E4BC]">
            TORIRO
          </p>
          <h1 className="mt-3 text-3xl font-extrabold leading-tight md:text-5xl">
            토리로에 오신 것을 환영합니다
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-[#E8F0E4] md:text-lg">
            숲길에서 만나는 가족의 하루.
            <br className="hidden sm:inline" />
            오늘, 어디로 걸어볼까요?
          </p>

          {/* 3 primary CTAs */}
          <div className="mx-auto mt-8 grid max-w-3xl grid-cols-1 gap-3 md:grid-cols-3">
            <Link
              href="/events"
              className="group rounded-2xl bg-white/95 p-5 text-left text-[#2D5A3D] shadow-md transition-all hover:-translate-y-0.5 hover:bg-white hover:shadow-lg"
            >
              <div className="text-4xl" aria-hidden>
                👨‍👩‍👧
              </div>
              <h2 className="mt-3 text-base font-extrabold">숲길 참여하기</h2>
              <p className="mt-1 text-xs text-[#6B6560]">
                가족과 함께할 오늘의 숲길을 찾아보세요
              </p>
              <p className="mt-3 text-xs font-bold text-[#2D5A3D] group-hover:translate-x-0.5">
                숲길 찾기 →
              </p>
            </Link>
            <Link
              href="/enterprise"
              className="group rounded-2xl bg-white/10 p-5 text-left text-white shadow-md backdrop-blur transition-all hover:-translate-y-0.5 hover:bg-white/20"
            >
              <div className="text-4xl" aria-hidden>
                🏢
              </div>
              <h2 className="mt-3 text-base font-extrabold">기업 프로그램</h2>
              <p className="mt-1 text-xs text-[#D4E4BC]">
                임직원 가족이 함께하는 ESG 팀빌딩
              </p>
              <p className="mt-3 text-xs font-bold text-white">자세히 →</p>
            </Link>
            <Link
              href="/partner"
              className="group rounded-2xl bg-white/10 p-5 text-left text-white shadow-md backdrop-blur transition-all hover:-translate-y-0.5 hover:bg-white/20"
            >
              <div className="text-4xl" aria-hidden>
                🏡
              </div>
              <h2 className="mt-3 text-base font-extrabold">숲지기 되기</h2>
              <p className="mt-1 text-xs text-[#D4E4BC]">
                내 숲길을 토리로에 등록해보세요
              </p>
              <p className="mt-3 text-xs font-bold text-white">시작하기 →</p>
            </Link>
          </div>

          {/* 코드 입장 */}
          <div className="mx-auto mt-6 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs text-[#E8F0E4] backdrop-blur">
            <span>이미 초대받으셨나요?</span>
            <Link
              href="/join"
              className="font-bold text-white underline-offset-2 hover:underline"
            >
              입장 코드 입력 →
            </Link>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section
        aria-label="토리로 현황"
        className="bg-[#FFF8F0] py-12 md:py-16"
      >
        <div className="mx-auto max-w-4xl px-4">
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="rounded-2xl border border-[#D4E4BC] bg-white p-5 shadow-sm">
              <p className="text-2xl font-extrabold text-[#2D5A3D] md:text-3xl">
                {stats.activeEvents.toLocaleString("ko-KR")}
              </p>
              <p className="mt-1 text-xs text-[#6B6560] md:text-sm">
                개 숲길 운영 중
              </p>
            </div>
            <div className="rounded-2xl border border-[#D4E4BC] bg-white p-5 shadow-sm">
              <p className="text-2xl font-extrabold text-[#2D5A3D] md:text-3xl">
                {stats.partners.toLocaleString("ko-KR")}
              </p>
              <p className="mt-1 text-xs text-[#6B6560] md:text-sm">개 기관</p>
            </div>
            <div className="rounded-2xl border border-[#D4E4BC] bg-white p-5 shadow-sm">
              <p className="text-2xl font-extrabold text-[#2D5A3D] md:text-3xl">
                {stats.families.toLocaleString("ko-KR")}
              </p>
              <p className="mt-1 text-xs text-[#6B6560] md:text-sm">
                가족 참여
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Value props */}
      <section className="bg-[#E8F0E4]/50 py-12 md:py-16">
        <div className="mx-auto max-w-5xl px-4">
          <div className="mb-8 text-center">
            <p className="text-xs font-semibold tracking-[0.3em] text-[#8B6F47]">
              WHY TORIRO
            </p>
            <h2 className="mt-2 text-2xl font-extrabold text-[#2D5A3D] md:text-3xl">
              왜 토리로인가요?
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-[#D4E4BC] bg-white p-6 shadow-sm">
              <div className="text-4xl" aria-hidden>
                🌿
              </div>
              <h3 className="mt-3 text-base font-extrabold text-[#2D5A3D]">
                자연 속 미션
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-[#6B6560]">
                아이들은 숲에서 뛰어놀며, 부모는 함께 걸으며 미션을 풀어갑니다.
              </p>
            </div>
            <div className="rounded-2xl border border-[#D4E4BC] bg-white p-6 shadow-sm">
              <div className="text-4xl" aria-hidden>
                🌰
              </div>
              <h3 className="mt-3 text-base font-extrabold text-[#2D5A3D]">
                도토리 리워드
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-[#6B6560]">
                미션 달성마다 도토리가 쌓이고, 지역 상점에서 사용할 수 있어요.
              </p>
            </div>
            <div className="rounded-2xl border border-[#D4E4BC] bg-white p-6 shadow-sm">
              <div className="text-4xl" aria-hidden>
                🏡
              </div>
              <h3 className="mt-3 text-base font-extrabold text-[#2D5A3D]">
                지역 숲지기
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-[#6B6560]">
                전국의 숲지기가 준비한 체험 프로그램이 매주 추가됩니다.
              </p>
            </div>
          </div>
        </div>
      </section>

      <Testimonials />

      <SiteFooter />
      <PWAInstallPrompt />
    </div>
  );
}
