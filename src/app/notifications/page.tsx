import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { markAllReadAction } from "./actions";

export const dynamic = "force-dynamic";

type Tab = "all" | "talk" | "reward" | "event";

type FeedItem = {
  key: string;
  category: Tab;
  icon: string;
  title: string;
  description: string;
  createdAt: string;
  href?: string;
  unread?: boolean;
};

function relativeTime(iso: string): string {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diff = Math.max(0, now - then);
  const min = Math.floor(diff / 60000);
  if (min < 1) return "방금 전";
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}일 전`;
  return new Date(iso).toLocaleDateString("ko-KR");
}

const REWARD_ICON: Record<string, string> = {
  POINT: "🌰",
  RANK: "🏆",
  BADGE: "🎖️",
  LOTTERY: "🎰",
  INSTANT: "🍃",
};

const NOTIF_TYPE_TO_TAB: Record<string, Tab> = {
  chat: "talk",
  message: "talk",
  reward: "reward",
  claim: "reward",
  stamp: "reward",
  event: "event",
  status: "event",
  challenge: "event",
};

function notifTypeToTab(type: string): Tab {
  const key = (type ?? "").toLowerCase();
  for (const k of Object.keys(NOTIF_TYPE_TO_TAB)) {
    if (key.includes(k)) return NOTIF_TYPE_TO_TAB[k];
  }
  return "event";
}

function notifIcon(type: string): string {
  const t = notifTypeToTab(type);
  if (t === "talk") return "💬";
  if (t === "reward") return "🎁";
  return "🔔";
}

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/notifications");

  const sp = await searchParams;
  const tab: Tab = ((): Tab => {
    const v = sp.tab;
    if (v === "talk" || v === "reward" || v === "event") return v;
    return "all";
  })();

  const now = new Date();
  const since24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

  // 1) 사용자 프로필 notifications (기존 테이블)
  const { data: notifications } = await supabase
    .from("notifications")
    .select("id, type, title, message, is_read, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  const unreadCount = (notifications ?? []).filter((n) => !n.is_read).length;

  // 2) 해당 사용자의 participant 레코드 전부 찾기 (전화 기반, user_id 기반)
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, name")
    .eq("id", user.id)
    .maybeSingle();

  // participants는 phone으로도 연결되므로 사용자의 phone을 구할 수 있으면 보강
  // (phone이 profiles에 없으므로 participants.user_id로만 탐색)
  const { data: myParticipants } = await supabase
    .from("participants")
    .select("id, event_id, phone")
    .eq("user_id", user.id);

  const participantIds = (myParticipants ?? []).map((p) => p.id);
  const eventIds = Array.from(new Set((myParticipants ?? []).map((p) => p.event_id)));
  const phones = Array.from(
    new Set((myParticipants ?? []).map((p) => p.phone).filter(Boolean) as string[])
  );

  // 3) 이벤트 이름 매핑
  const eventMap = new Map<string, string>();
  if (eventIds.length) {
    const { data: events } = await supabase
      .from("events")
      .select("id, name, status")
      .in("id", eventIds);
    (events ?? []).forEach((e) => eventMap.set(e.id, e.name));
  }

  const feed: FeedItem[] = [];

  // 3-a) notifications 테이블 항목
  for (const n of notifications ?? []) {
    feed.push({
      key: `n:${n.id}`,
      category: notifTypeToTab(n.type),
      icon: notifIcon(n.type),
      title: n.title,
      description: n.message,
      createdAt: n.created_at,
      unread: !n.is_read,
    });
  }

  // 3-b) 채팅 메시지 (내가 속한 방, 24h)
  if (phones.length) {
    const { data: memberships } = await supabase
      .from("chat_members")
      .select("room_id")
      .in("participant_phone", phones)
      .is("left_at", null);
    const roomIds = Array.from(new Set((memberships ?? []).map((m) => m.room_id)));
    if (roomIds.length) {
      const { data: rooms } = await supabase
        .from("chat_rooms")
        .select("id, name, event_id, type")
        .in("id", roomIds);
      const roomMap = new Map((rooms ?? []).map((r) => [r.id, r]));

      const { data: msgs } = await supabase
        .from("chat_messages")
        .select("id, room_id, sender_name, content, created_at, is_deleted, type")
        .in("room_id", roomIds)
        .eq("is_deleted", false)
        .gte("created_at", since24h)
        .order("created_at", { ascending: false })
        .limit(30);

      for (const m of msgs ?? []) {
        const room = roomMap.get(m.room_id);
        if (!room) continue;
        feed.push({
          key: `m:${m.id}`,
          category: "talk",
          icon: room.type === "ANNOUNCEMENT" ? "📢" : "💬",
          title: `${room.name ?? "토리톡"} · ${m.sender_name}`,
          description: m.content ?? (m.type === "photo" ? "사진을 보냈어요" : "메시지"),
          createdAt: m.created_at,
          href: `/event/${room.event_id}/chat/${m.room_id}`,
        });
      }
    }
  }

  // 3-c) 새로운 보상 (EARNED 상태)
  if (participantIds.length) {
    const { data: claims } = await supabase
      .from("reward_claims")
      .select("id, reward_id, participant_id, status, earned_at")
      .in("participant_id", participantIds)
      .eq("status", "EARNED")
      .order("earned_at", { ascending: false })
      .limit(20);

    const rewardIds = Array.from(new Set((claims ?? []).map((c) => c.reward_id)));
    const { data: rewards } = rewardIds.length
      ? await supabase
          .from("rewards")
          .select("id, name, reward_type, event_id")
          .in("id", rewardIds)
      : { data: [] as { id: string; name: string; reward_type: string; event_id: string }[] };
    const rewardMap = new Map((rewards ?? []).map((r) => [r.id, r]));

    for (const c of claims ?? []) {
      const r = rewardMap.get(c.reward_id);
      if (!r) continue;
      feed.push({
        key: `rc:${c.id}`,
        category: "reward",
        icon: REWARD_ICON[r.reward_type] ?? "🎁",
        title: `새 보상이 도착했어요`,
        description: `${r.name} · ${eventMap.get(r.event_id) ?? "행사"}`,
        createdAt: c.earned_at,
        href: `/event/${r.event_id}/rewards`,
        unread: true,
      });
    }
  }

  // 3-d) 새 도토리(스탬프) 기록
  if (participantIds.length) {
    const { data: stamps } = await supabase
      .from("stamp_records")
      .select("id, slot_id, participant_id, stamped_at")
      .in("participant_id", participantIds)
      .order("stamped_at", { ascending: false })
      .limit(20);

    const slotIds = Array.from(new Set((stamps ?? []).map((s) => s.slot_id)));
    const { data: slots } = slotIds.length
      ? await supabase
          .from("stamp_slots")
          .select("id, name, icon, board_id")
          .in("id", slotIds)
      : { data: [] as { id: string; name: string; icon: string | null; board_id: string }[] };
    const slotMap = new Map((slots ?? []).map((s) => [s.id, s]));

    const boardIds = Array.from(new Set((slots ?? []).map((s) => s.board_id)));
    const { data: boards } = boardIds.length
      ? await supabase.from("stamp_boards").select("id, event_id").in("id", boardIds)
      : { data: [] as { id: string; event_id: string }[] };
    const boardMap = new Map((boards ?? []).map((b) => [b.id, b]));

    for (const s of stamps ?? []) {
      const slot = slotMap.get(s.slot_id);
      if (!slot) continue;
      const board = boardMap.get(slot.board_id);
      feed.push({
        key: `s:${s.id}`,
        category: "reward",
        icon: slot.icon ?? "🌰",
        title: `도토리 획득`,
        description: `${slot.name} 구간을 걸었어요`,
        createdAt: s.stamped_at,
        href: board ? `/event/${board.event_id}/stamps` : undefined,
      });
    }
  }

  // 3-e) 행사 상태 변경 (간단히 내 이벤트의 최신 status)
  if (eventIds.length) {
    const { data: statusEvents } = await supabase
      .from("events")
      .select("id, name, status, start_at, end_at")
      .in("id", eventIds);
    for (const e of statusEvents ?? []) {
      if (e.status === "ENDED" || e.status === "CONFIRMED") {
        feed.push({
          key: `e:${e.id}`,
          category: "event",
          icon: "🏞️",
          title: `${e.name} 마무리됨`,
          description: "오늘의 걸음을 돌아보세요",
          createdAt: e.end_at,
          href: `/event/${e.id}/result`,
        });
      }
    }
  }

  // 정렬 + 필터
  feed.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  const filtered = tab === "all" ? feed : feed.filter((f) => f.category === tab);

  const tabs: { key: Tab; label: string }[] = [
    { key: "all", label: "전체" },
    { key: "talk", label: "토리톡" },
    { key: "reward", label: "보상" },
    { key: "event", label: "행사" },
  ];

  return (
    <main className="min-h-dvh bg-[#F5F1E8] p-4 pb-24">
      <div className="mx-auto max-w-lg space-y-4">
        <Link href="/" className="text-sm text-[#2D5A3D] hover:underline">
          ← 홈
        </Link>

        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-[#2D5A3D]">🔔 숲의 소식</h1>
          {unreadCount > 0 && (
            <form action={markAllReadAction}>
              <button
                type="submit"
                className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-violet-600 shadow-sm hover:bg-violet-50"
              >
                모두 읽음 ({unreadCount})
              </button>
            </form>
          )}
        </div>

        {/* 탭 */}
        <div
          role="tablist"
          aria-label="소식 카테고리"
          className="flex gap-2 overflow-x-auto pb-1"
        >
          {tabs.map((t) => {
            const active = t.key === tab;
            return (
              <Link
                key={t.key}
                role="tab"
                aria-selected={active}
                href={t.key === "all" ? "/notifications" : `/notifications?tab=${t.key}`}
                className={`flex-shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold transition ${
                  active
                    ? "bg-violet-600 text-white shadow"
                    : "bg-white text-[#6B6560] hover:bg-[#D4E4BC]"
                }`}
              >
                {t.label}
              </Link>
            );
          })}
        </div>

        {filtered.length > 0 ? (
          <ul className="space-y-2">
            {filtered.map((item) => {
              const Inner = (
                <>
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[#D4E4BC] text-xl">
                      {item.icon}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-semibold text-sm text-[#2D5A3D] truncate">
                          {item.title}
                        </h3>
                        {item.unread && (
                          <span
                            aria-label="읽지 않음"
                            className="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-violet-600"
                          />
                        )}
                      </div>
                      <p className="mt-0.5 truncate text-xs text-[#6B6560]">
                        {item.description}
                      </p>
                      <div className="mt-1 text-[11px] text-[#6B6560]">
                        {relativeTime(item.createdAt)}
                      </div>
                    </div>
                  </div>
                </>
              );
              const className =
                "block rounded-xl border border-[#D4E4BC] bg-white p-3 hover:shadow-sm transition";
              return (
                <li key={item.key}>
                  {item.href ? (
                    <Link href={item.href} className={className}>
                      {Inner}
                    </Link>
                  ) : (
                    <div className={className}>{Inner}</div>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="rounded-xl border border-[#D4E4BC] bg-white p-12 text-center text-sm text-[#6B6560]">
            🌱 아직 새로운 소식이 없어요
          </div>
        )}
      </div>
    </main>
  );
}
