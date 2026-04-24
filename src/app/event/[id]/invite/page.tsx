import { redirect } from "next/navigation";
import Link from "next/link";
import { getParticipant } from "@/lib/participant-session";
import { createClient } from "@/lib/supabase/server";
import { InviteClient } from "./invite-client";
import { AcornIcon } from "@/components/acorn-icon";

export const dynamic = "force-dynamic";

type ReferralRow = {
  id: string;
  referral_code: string;
  invitee_phone: string | null;
  invitee_name: string | null;
  invitee_joined_at: string | null;
  status: "PENDING" | "JOINED" | "COMPLETED" | "EXPIRED";
  reward_acorns: number;
  reward_given: boolean;
  created_at: string;
};

type SupabaseShim = {
  from: (t: string) => {
    select: (c: string) => {
      eq: (k: string, v: string) => {
        maybeSingle: () => Promise<{ data: ReferralRow | null }>;
        order: (c: string, o: { ascending: boolean }) => {
          limit: (n: number) => Promise<{ data: ReferralRow[] | null }>;
        };
      };
    };
  };
};

function maskName(name: string | null | undefined): string {
  if (!name) return "익명";
  const n = name.trim();
  if (n.length <= 1) return n;
  if (n.length === 2) return `${n[0]}*`;
  return `${n[0]}${"*".repeat(n.length - 2)}${n[n.length - 1]}`;
}

export default async function InvitePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = await getParticipant(id);
  if (!p) redirect("/join");

  const supabase = await createClient();
  const shim = supabase as unknown as SupabaseShim;

  // Existing code lookup (may be null; client bootstraps by calling action)
  const { data: myCodeRow } = await shim
    .from("referrals")
    .select("id, referral_code, invitee_phone, invitee_name, invitee_joined_at, status, reward_acorns, reward_given, created_at")
    .eq("referrer_phone", p.phone)
    .maybeSingle();

  // Invite history — all referrals where this user is the referrer
  const { data: allMine } = await shim
    .from("referrals")
    .select("id, referral_code, invitee_phone, invitee_name, invitee_joined_at, status, reward_acorns, reward_given, created_at")
    .eq("referrer_phone", p.phone)
    .order("created_at", { ascending: false })
    .limit(50);

  const rows = allMine ?? [];
  const sentCount = rows.length;
  const joinedCount = rows.filter((r) => r.status === "JOINED" || r.status === "COMPLETED").length;
  const acornsEarned = rows
    .filter((r) => r.reward_given)
    .reduce((sum, r) => sum + (r.reward_acorns ?? 0), 0);

  const recent = rows.slice(0, 10).map((r) => ({
    id: r.id,
    name: maskName(r.invitee_name),
    status: r.status,
    joined_at: r.invitee_joined_at,
    created_at: r.created_at,
  }));

  return (
    <main className="min-h-dvh bg-gradient-to-b from-[#FFF8F0] to-[#F5E6D3] pb-24">
      {/* 헤더 */}
      <header className="relative px-4 pt-6 pb-8 text-center">
        <Link
          href={`/event/${id}`}
          className="absolute left-4 top-6 text-sm text-[#6B6560] hover:text-[#2D5A3D]"
          aria-label="뒤로가기"
        >
          ← 뒤로
        </Link>
        <div className="text-5xl mb-2">🎁</div>
        <h1 className="text-2xl font-extrabold text-[#2D5A3D]">친구 초대하기</h1>
        <p className="mt-1 text-sm text-[#6B6560]">
          친구를 초대하면 둘 다 <span className="font-bold text-[#C4956A]"><AcornIcon className="text-[#C4956A]" /> 20개</span>씩!
        </p>
      </header>

      <div className="mx-auto max-w-lg space-y-4 px-4">
        <InviteClient
          eventId={id}
          initialCode={myCodeRow?.referral_code ?? null}
        />

        {/* 내 초대 현황 */}
        <section>
          <h2 className="mb-2 text-sm font-bold text-[#2D5A3D]">📊 내 초대 현황</h2>
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-2xl border-2 border-[#C4956A]/30 bg-white p-4 text-center">
              <div className="text-2xl font-extrabold text-[#2D5A3D]">{sentCount}</div>
              <div className="mt-1 text-[11px] text-[#6B6560]">초대 보낸 수</div>
            </div>
            <div className="rounded-2xl border-2 border-[#C4956A]/30 bg-white p-4 text-center">
              <div className="text-2xl font-extrabold text-[#2D5A3D]">{joinedCount}</div>
              <div className="mt-1 text-[11px] text-[#6B6560]">가입 완료</div>
            </div>
            <div className="rounded-2xl border-2 border-[#C4956A] bg-gradient-to-br from-[#FFF8F0] to-[#F5E6D3] p-4 text-center">
              <div className="text-2xl font-extrabold text-[#C4956A] inline-flex items-center gap-1 justify-center w-full">
                <AcornIcon size={20} className="text-[#C4956A]" />{acornsEarned}
              </div>
              <div className="mt-1 text-[11px] text-[#6B6560]">받은 도토리</div>
            </div>
          </div>
        </section>

        {/* 초대한 친구 목록 */}
        <section>
          <h2 className="mb-2 text-sm font-bold text-[#2D5A3D]">🐾 초대한 친구 목록</h2>
          {recent.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-[#C4956A]/40 bg-white/60 p-8 text-center">
              <div className="text-3xl mb-2">🌱</div>
              <p className="text-sm text-[#6B6560]">아직 초대한 친구가 없어요</p>
              <p className="text-xs text-[#9A928B] mt-1">링크를 공유해보세요!</p>
            </div>
          ) : (
            <ul className="space-y-2">
              {recent.map((r) => (
                <li
                  key={r.id}
                  className="flex items-center justify-between rounded-2xl border bg-white px-4 py-3"
                >
                  <div>
                    <div className="font-semibold text-sm text-[#2D5A3D]">
                      {r.name}
                    </div>
                    <div className="text-[10px] text-[#9A928B] mt-0.5">
                      {r.joined_at
                        ? `${new Date(r.joined_at).toLocaleString("ko-KR")} 가입`
                        : `${new Date(r.created_at).toLocaleDateString("ko-KR")} 초대`}
                    </div>
                  </div>
                  <StatusBadge status={r.status} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}

function StatusBadge({ status }: { status: "PENDING" | "JOINED" | "COMPLETED" | "EXPIRED" }) {
  const map: Record<string, { label: string; cls: string }> = {
    PENDING: { label: "대기중", cls: "bg-neutral-100 text-neutral-600" },
    JOINED: { label: "가입", cls: "bg-[#E8F0E4] text-[#2D5A3D]" },
    COMPLETED: { label: "완료", cls: "bg-[#F5E6D3] text-[#C4956A]" },
    EXPIRED: { label: "만료", cls: "bg-neutral-100 text-neutral-400" },
  };
  const { label, cls } = map[status] ?? map.PENDING;
  return (
    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${cls}`}>
      {label}
    </span>
  );
}
