import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getParticipant } from "@/lib/participant-session";
import { joinGuildAction, leaveGuildAction } from "./actions";
import { AcornIcon } from "@/components/acorn-icon";

export const dynamic = "force-dynamic";

type Guild = {
  id: string;
  event_id: string;
  name: string;
  description: string | null;
  icon: string | null;
  leader_phone: string;
  max_members: number;
  total_acorns: number;
  is_public: boolean;
};

type GuildMember = {
  id: string;
  guild_id: string;
  participant_phone: string;
  participant_name: string;
  role: "LEADER" | "MEMBER";
};

function anyFrom(supabase: unknown, table: string) {
  return (supabase as { from: (t: string) => any }).from(table);
}

// Palette helpers matching the 숲/forest theme
const FOREST_BG = "bg-[#FFF8F0]";
const FOREST_BORDER = "border-[#D4E4BC]";
const FOREST_DARK = "text-[#2D5A3D]";
const FOREST_MUTED = "text-[#6B6560]";

function AvatarCircle({ name, highlight }: { name: string; highlight?: boolean }) {
  const ch = (name ?? "").trim().charAt(0) || "?";
  return (
    <div
      aria-hidden
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
        highlight
          ? "bg-gradient-to-br from-[#F5D9B5] to-[#E9C38A] text-[#8B6F47]"
          : "bg-[#E8F0E4] text-[#2D5A3D]"
      }`}
    >
      {ch}
    </div>
  );
}

export default async function GuildPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = await getParticipant(id);
  if (!p) redirect("/join");

  const supabase = await createClient();
  const { data: event } = await supabase.from("events").select("id, name").eq("id", id).single();
  if (!event) notFound();

  // Probe for the guilds table. If it errors (not deployed yet), show placeholder.
  const probe = await anyFrom(supabase, "guilds").select("id").eq("event_id", id).limit(1);
  if (probe.error) {
    return (
      <main className={`min-h-dvh ${FOREST_BG} pb-24`}>
        <div className="bg-gradient-to-br from-[#2D5A3D] via-[#3A7A52] to-[#4A7C59] px-4 pt-6 pb-8 text-white">
          <Link href={`/event/${id}`} className="text-sm opacity-80">
            ← 홈으로
          </Link>
          <h1 className="mt-3 text-2xl font-bold flex items-center gap-2">
            <span>🏡</span>
            <span>숲 패밀리</span>
          </h1>
          <p className="mt-1 text-sm opacity-90">같은 숲길을 걷는 다람이가족과 함께</p>
        </div>
        <div className="mx-auto max-w-lg px-4 -mt-4">
          <div className={`rounded-2xl border ${FOREST_BORDER} bg-white p-6 text-center`}>
            <div className="text-5xl mb-3">🌱</div>
            <h2 className={`text-lg font-bold ${FOREST_DARK}`}>곧 열려요</h2>
            <p className={`text-sm ${FOREST_MUTED} mt-2`}>
              숲 패밀리 기능은 준비 중이에요.
              <br />
              조금만 기다려 주세요.
            </p>
          </div>
        </div>
      </main>
    );
  }

  // Current user's membership
  const { data: myMember } = await anyFrom(supabase, "guild_members")
    .select("id, guild_id, role")
    .eq("participant_phone", p.phone)
    .maybeSingle();

  if (myMember) {
    const guildId = (myMember as GuildMember).guild_id;
    const [guildRes, membersRes] = await Promise.all([
      anyFrom(supabase, "guilds").select("*").eq("id", guildId).single(),
      anyFrom(supabase, "guild_members")
        .select("id, guild_id, participant_phone, participant_name, role")
        .eq("guild_id", guildId),
    ]);

    const guild = guildRes.data as Guild | null;
    const members = ((membersRes.data ?? []) as GuildMember[]).slice();
    if (!guild) redirect(`/event/${id}/guild`);

    // Acorn totals per member from participants table
    const phones = members.map((m) => m.participant_phone);
    const { data: parts } = phones.length
      ? await supabase
          .from("participants")
          .select("phone, total_score")
          .eq("event_id", id)
          .in("phone", phones)
      : { data: [] as { phone: string; total_score: number | null }[] };
    const scoreMap = new Map(
      (parts ?? []).map((r) => [r.phone as string, r.total_score ?? 0])
    );

    members.sort((a, b) => {
      if (a.role === "LEADER" && b.role !== "LEADER") return -1;
      if (b.role === "LEADER" && a.role !== "LEADER") return 1;
      return (scoreMap.get(b.participant_phone) ?? 0) - (scoreMap.get(a.participant_phone) ?? 0);
    });

    const totalAcorns = members.reduce(
      (sum, m) => sum + (scoreMap.get(m.participant_phone) ?? 0),
      0
    );

    const isLeader = (myMember as GuildMember).role === "LEADER";

    return (
      <main className={`min-h-dvh ${FOREST_BG} pb-24`}>
        <div className="bg-gradient-to-br from-[#2D5A3D] via-[#3A7A52] to-[#4A7C59] px-4 pt-6 pb-10 text-white">
          <Link href={`/event/${id}`} className="text-sm opacity-80">
            ← 홈으로
          </Link>
          <h1 className="mt-3 text-2xl font-bold flex items-center gap-2">
            <span>🏡</span>
            <span>숲 패밀리</span>
          </h1>
          <p className="mt-1 text-sm opacity-90">우리 패밀리는 오늘도 숲길을 걷는 중</p>
        </div>

        <div className="mx-auto max-w-lg px-4 -mt-6 space-y-4">
          {/* Guild card */}
          <section
            className={`rounded-2xl border ${FOREST_BORDER} bg-white p-6 shadow-sm`}
            aria-label="내 패밀리 정보"
          >
            <div className="flex items-start gap-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-[#E8F0E4] text-4xl">
                {guild.icon ?? "🏡"}
              </div>
              <div className="min-w-0 flex-1">
                <h2 className={`text-xl font-bold ${FOREST_DARK} truncate`}>{guild.name}</h2>
                {guild.description && (
                  <p className={`mt-1 text-sm ${FOREST_MUTED}`}>{guild.description}</p>
                )}
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded-full bg-[#E8F0E4] px-2 py-0.5 text-[#2D5A3D]">
                    👥 {members.length}/{guild.max_members}명
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 ${
                      guild.is_public
                        ? "bg-[#E6F4EA] text-[#2D5A3D]"
                        : "bg-[#F5E6D6] text-[#8B6F47]"
                    }`}
                  >
                    {guild.is_public ? "🌿 공개" : "🔒 비공개"}
                  </span>
                </div>
              </div>
            </div>

            {/* Total acorns */}
            <div className="mt-5 rounded-2xl bg-gradient-to-br from-[#FFF3E0] to-[#FDE2C2] p-4 text-center">
              <p className="text-xs text-[#8B6F47]">패밀리 총 도토리</p>
              <p className="mt-1 text-3xl font-extrabold text-[#8B6F47] inline-flex items-center justify-center gap-1">
                <AcornIcon size={28} className="text-[#8B6F47]" /> {totalAcorns.toLocaleString("ko-KR")}
              </p>
              <p className="mt-1 text-xs text-[#8B6F47]">길드 명예의 전당 진입 중 🏆</p>
            </div>

            <button
              type="button"
              disabled
              className="mt-4 w-full rounded-xl bg-violet-600 py-3 text-sm font-semibold text-white opacity-70 hover:bg-violet-700 disabled:cursor-not-allowed"
              aria-label="길드 토리톡 열기 (곧 열려요)"
            >
              💬 길드 토리톡 열기 (곧 열려요)
            </button>
          </section>

          {/* Member list */}
          <section className={`rounded-2xl border ${FOREST_BORDER} bg-white p-5`} aria-label="패밀리 구성원">
            <h3 className={`text-sm font-semibold ${FOREST_DARK}`}>🐿️ 패밀리 구성원</h3>
            <ul className="mt-3 divide-y divide-[#F0E9DF]">
              {members.map((m) => {
                const isMe = m.participant_phone === p.phone;
                const score = scoreMap.get(m.participant_phone) ?? 0;
                return (
                  <li key={m.id} className="flex items-center gap-3 py-3">
                    <AvatarCircle name={m.participant_name} highlight={m.role === "LEADER"} />
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1.5 text-sm font-semibold text-[#2C2C2C]">
                        <span className="truncate">{m.participant_name}</span>
                        {isMe && (
                          <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold text-violet-700">
                            나
                          </span>
                        )}
                        {m.role === "LEADER" && (
                          <span className="rounded-full bg-[#F5D9B5] px-2 py-0.5 text-[10px] font-bold text-[#8B6F47]">
                            <AcornIcon className="text-[#8B6F47]" /> 숲지기
                          </span>
                        )}
                      </p>
                    </div>
                    <p className={`text-sm font-semibold ${FOREST_DARK}`}>
                      <AcornIcon /> {score.toLocaleString("ko-KR")}
                    </p>
                  </li>
                );
              })}
            </ul>
          </section>

          {/* Leave / dissolve */}
          <form action={leaveGuildAction.bind(null, id, guild.id)}>
            <button
              type="submit"
              className="w-full rounded-2xl border border-red-200 bg-white py-3 text-sm font-semibold text-red-600 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-300"
            >
              {isLeader ? "패밀리 해체하기" : "패밀리에서 나가기"}
            </button>
          </form>
        </div>
      </main>
    );
  }

  // Not in a guild — show CTA + list of public guilds
  const { data: publicRaw } = await anyFrom(supabase, "guilds")
    .select("id, event_id, name, description, icon, max_members, total_acorns, is_public")
    .eq("event_id", id)
    .eq("is_public", true)
    .order("total_acorns", { ascending: false })
    .limit(10);

  const publicGuilds = (publicRaw ?? []) as Guild[];

  // Member counts in one shot (simpler: fetch all rows for these guilds)
  const guildIds = publicGuilds.map((g) => g.id);
  const { data: memberRows } = guildIds.length
    ? await anyFrom(supabase, "guild_members").select("guild_id").in("guild_id", guildIds)
    : { data: [] as { guild_id: string }[] };
  const countMap = new Map<string, number>();
  for (const row of (memberRows ?? []) as { guild_id: string }[]) {
    countMap.set(row.guild_id, (countMap.get(row.guild_id) ?? 0) + 1);
  }

  return (
    <main className={`min-h-dvh ${FOREST_BG} pb-24`}>
      <div className="bg-gradient-to-br from-[#2D5A3D] via-[#3A7A52] to-[#4A7C59] px-4 pt-6 pb-10 text-white">
        <Link href={`/event/${id}`} className="text-sm opacity-80">
          ← 홈으로
        </Link>
        <h1 className="mt-3 text-2xl font-bold flex items-center gap-2">
          <span>🏡</span>
          <span>숲 패밀리</span>
        </h1>
        <p className="mt-1 text-sm opacity-90">같은 숲길을 걷는 다람이가족과 함께</p>
      </div>

      <div className="mx-auto max-w-lg px-4 -mt-6 space-y-4">
        {/* Create CTA */}
        <Link
          href={`/event/${id}/guild/new`}
          className="block rounded-2xl bg-violet-600 px-5 py-4 text-center font-bold text-white shadow-sm transition hover:bg-violet-700 focus:outline-none focus:ring-2 focus:ring-violet-400"
        >
          + 새 숲 패밀리 만들기
        </Link>

        {/* Public guilds */}
        <section aria-label="공개 패밀리 목록">
          <h2 className={`px-1 text-sm font-semibold ${FOREST_DARK}`}>🌿 근처 패밀리에 가입하기</h2>
          <p className={`px-1 text-xs ${FOREST_MUTED} mt-0.5`}>
            공개 패밀리에 한 번에 합류할 수 있어요
          </p>

          {publicGuilds.length === 0 ? (
            <div className={`mt-3 rounded-2xl border ${FOREST_BORDER} bg-white p-6 text-center`}>
              <div className="text-4xl mb-2">🌱</div>
              <p className={`text-sm ${FOREST_MUTED}`}>
                아직 공개된 패밀리가 없어요.
                <br />
                첫 패밀리를 직접 만들어보세요!
              </p>
            </div>
          ) : (
            <ul className="mt-3 flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 md:grid md:grid-cols-1 md:overflow-visible">
              {publicGuilds.map((g) => {
                const count = countMap.get(g.id) ?? 0;
                const full = count >= g.max_members;
                return (
                  <li
                    key={g.id}
                    className={`min-w-[260px] snap-start rounded-2xl border ${FOREST_BORDER} bg-white p-4 shadow-sm md:min-w-0`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#E8F0E4] text-2xl">
                        {g.icon ?? "🏡"}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className={`truncate text-base font-bold ${FOREST_DARK}`}>{g.name}</p>
                        {g.description && (
                          <p className={`mt-0.5 line-clamp-2 text-xs ${FOREST_MUTED}`}>
                            {g.description}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="mt-3 flex items-center justify-between text-xs">
                      <span className="rounded-full bg-[#E8F0E4] px-2 py-0.5 text-[#2D5A3D]">
                        👥 {count}/{g.max_members}
                      </span>
                      <span className="font-semibold text-[#8B6F47]">
                        <AcornIcon className="text-[#8B6F47]" /> {g.total_acorns.toLocaleString("ko-KR")}
                      </span>
                    </div>
                    <form action={joinGuildAction.bind(null, id, g.id)} className="mt-3">
                      <button
                        type="submit"
                        disabled={full}
                        className="w-full rounded-xl bg-violet-600 py-2 text-sm font-semibold text-white hover:bg-violet-700 focus:outline-none focus:ring-2 focus:ring-violet-400 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {full ? "정원 마감" : "합류하기"}
                      </button>
                    </form>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Feature preview */}
        <section className={`rounded-2xl border ${FOREST_BORDER} bg-white p-5`}>
          <h3 className={`text-sm font-semibold ${FOREST_DARK}`}>🌳 패밀리가 있으면</h3>
          <ul className={`mt-2 space-y-1.5 text-xs ${FOREST_MUTED}`}>
            <li><AcornIcon /> 도토리를 합산해 길드 랭킹에 도전</li>
            <li>💬 우리끼리만의 토리톡 공간</li>
            <li>🏆 길드 명예의 전당 TOP 10</li>
          </ul>
        </section>
      </div>
    </main>
  );
}
