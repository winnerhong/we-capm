"use client";

// 'use client' 필요: OrgPresenceCounter 가 render-prop(함수) API 라서
// 부모도 client 여야 함수가 server→client 경계를 넘지 않는다.
//
// 참가자 카운터를 클릭하면 → 전체 참가자 목록 모달.
// 참가자에 마우스를 올리면 → 오른쪽 패널에 사진 + 상세 정보 미리보기.

import { useEffect, useMemo, useRef, useState } from "react";
import { fmtAmPmClockKst, fmtCompactDateKst } from "@/lib/datetime/kst";
import type {
  ControlRoomSnapshot,
  ControlRoomParticipant,
} from "@/lib/control-room/types";
import styles from "../control-room.module.css";
import { useOrgPresence } from "@/components/presence/org-presence-counter";

type Props = { snapshot: ControlRoomSnapshot; orgId: string };

const EMPTY_ONLINE = new Set<string>();

/**
 * 타일을 감싸 클릭하면 랭킹 모달을 여는 런처.
 * 랭킹 모달은 presence 를 구독하지 않으므로(빈 온라인셋) 채널 충돌 없음.
 */
export function RankingLauncher({
  snapshot,
  orgId,
  rankBy,
  children,
}: {
  snapshot: ControlRoomSnapshot;
  orgId: string;
  rankBy: "acorns" | "submissions";
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="클릭하면 랭킹 보기"
        className="block h-full w-full text-left transition hover:brightness-125 [&>*]:h-full"
      >
        {children}
      </button>
      {open && (
        <ParticipantsModal
          snapshot={snapshot}
          orgId={orgId}
          onlineIds={EMPTY_ONLINE}
          rankBy={rankBy}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function fmtPhone(digits: string): string {
  const d = (digits ?? "").replace(/\D/g, "");
  if (d.length === 11) return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
  return digits || "-";
}

/* -------------------------------------------------------------------------- */
/* 참가자 상세 (온디맨드)                                                       */
/* -------------------------------------------------------------------------- */

type MemberDetail = {
  userId: string;
  parentName: string;
  parentPhone: string;
  status: string;
  acornBalance: number;
  createdAt: string;
  lastLoginAt: string | null;
  children: Array<{
    id: string;
    name: string;
    className: string | null;
    isEnrolled: boolean;
    birthDate: string | null;
  }>;
  recentSubmissions: Array<{
    id: string;
    missionTitle: string;
    missionIcon: string | null;
    status: string;
    awardedAcorns: number | null;
    submittedAt: string;
  }>;
  participatedEvents: Array<{
    id: string;
    name: string;
    startsAt: string | null;
    endsAt: string | null;
    status: string;
    joinedAt: string | null;
  }>;
  recentAcornTx: Array<{
    id: string;
    amount: number;
    reason: string;
    memo: string | null;
    createdAt: string;
  }>;
};

/** 선택된 참가자의 상세를 debounce 로 로드 + userId 별 캐시. */
function useParticipantDetail(orgId: string, userId: string | null) {
  const [detail, setDetail] = useState<MemberDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const cache = useRef<Map<string, MemberDetail>>(new Map());

  useEffect(() => {
    if (!userId) {
      setDetail(null);
      return;
    }
    const cached = cache.current.get(userId);
    if (cached) {
      setDetail(cached);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setDetail(null);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/org/participant-detail?org=${orgId}&userId=${userId}`
        );
        const data = res.ok ? ((await res.json()) as MemberDetail) : null;
        if (cancelled) return;
        if (data) cache.current.set(userId, data);
        setDetail(data);
      } catch {
        if (!cancelled) setDetail(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 220); // hover 연타 debounce
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [orgId, userId]);

  return { detail, loading };
}

export function ParticipantsTile({ snapshot, orgId }: Props) {
  const [open, setOpen] = useState(false);
  // 접속 현황은 여기서 한 번만 구독 (같은 topic 중복 구독 금지).
  const { count, isLive, onlineIds } = useOrgPresence(orgId);
  const liveCount = isLive ? count : snapshot.todayActiveParticipants;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="클릭하면 참가자 전체 보기"
        className={`${styles.surface} flex w-full items-center gap-2 px-3 py-2 text-left transition hover:brightness-125`}
      >
        <span className="text-sm" aria-hidden>
          🧑‍🤝‍🧑
        </span>
        <h2 className="text-[10px] font-semibold tracking-[0.15em] text-[#a8b8d0]">
          참가자
        </h2>

        <div className="ml-auto flex items-baseline gap-3">
          <div className="flex items-baseline gap-1">
            <span className="flex items-center gap-0.5 text-[9px] text-[#a8b8d0]">
              {isLive ? (
                <>
                  <span
                    className={`${styles.liveDot} ${styles.livePulse}`}
                    aria-hidden
                    style={{
                      width: 5,
                      height: 5,
                      background: "#6ee7b7",
                      boxShadow: "0 0 6px rgba(110,231,183,0.8)",
                    }}
                  />
                  <span>접속</span>
                </>
              ) : (
                <span>오늘</span>
              )}
            </span>
            <span
              className={`${styles.neonGreen} font-mono text-xl font-extrabold leading-none`}
              aria-live="polite"
            >
              {liveCount.toLocaleString("ko-KR")}
            </span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-[9px] text-[#a8b8d0]">전체</span>
            <span className="font-mono text-base font-bold leading-none text-[#f4ecd8]">
              {snapshot.totalParticipants.toLocaleString("ko-KR")}
            </span>
          </div>
        </div>
      </button>

      {open && (
        <ParticipantsModal
          snapshot={snapshot}
          orgId={orgId}
          onlineIds={onlineIds}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

/* -------------------------------------------------------------------------- */

type RankBy = "acorns" | "submissions";

const RANK_META: Record<
  RankBy,
  { title: string; icon: string; unit: string; valueOf: (r: ControlRoomParticipant) => number }
> = {
  acorns: { title: "도토리 랭킹", icon: "🌰", unit: "도토리", valueOf: (r) => r.acorns },
  submissions: { title: "스탬프 랭킹", icon: "🎯", unit: "개", valueOf: (r) => r.submissions },
};

export function ParticipantsModal({
  snapshot,
  orgId,
  onlineIds,
  onClose,
  rankBy,
}: {
  snapshot: ControlRoomSnapshot;
  orgId: string;
  onlineIds: Set<string>;
  onClose: () => void;
  /** 지정하면 그 지표 내림차순 랭킹 모드 (토글 없음). */
  rankBy?: RankBy;
}) {
  // 🟢 접속자 / 전체 등록자 토글. (랭킹 모드에선 미사용)
  const [view, setView] = useState<"online" | "all">("all");

  // userId → 그 참가자가 올린 사진 url 들 (최신순, 중복 제거).
  const photosByUser = useMemo(() => {
    const m = new Map<string, string[]>();
    const sorted = [...snapshot.photoWall].sort((a, b) =>
      b.submittedAt.localeCompare(a.submittedAt)
    );
    for (const p of sorted) {
      if (!p.url || !p.userId) continue;
      const list = m.get(p.userId) ?? [];
      if (!list.includes(p.url)) list.push(p.url);
      m.set(p.userId, list);
    }
    return m;
  }, [snapshot.photoWall]);

  const rankMeta = rankBy ? RANK_META[rankBy] : null;

  const allRows = useMemo(() => {
    const list = [...snapshot.participants];
    if (rankMeta) {
      return list.sort((a, b) => rankMeta.valueOf(b) - rankMeta.valueOf(a));
    }
    return list.sort((a, b) => a.displayName.localeCompare(b.displayName, "ko"));
  }, [snapshot.participants, rankMeta]);
  const onlineCount = useMemo(
    () => allRows.filter((r) => onlineIds.has(r.userId)).length,
    [allRows, onlineIds]
  );
  const rows = useMemo(
    () =>
      !rankBy && view === "online"
        ? allRows.filter((r) => onlineIds.has(r.userId))
        : allRows,
    [rankBy, view, allRows, onlineIds]
  );

  // 클릭하면 고정(pin), 고정 없을 땐 마우스 올린 항목(hover) 미리보기.
  const [pinnedId, setPinnedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(
    allRows[0]?.userId ?? null
  );
  const selected = useMemo(() => {
    const id = pinnedId ?? hoveredId;
    return allRows.find((r) => r.userId === id) ?? allRows[0] ?? null;
  }, [pinnedId, hoveredId, allRows]);

  // 선택된 참가자의 상세(활동/도토리/행사/자녀) 온디맨드 로드.
  const { detail, loading: detailLoading } = useParticipantDetail(
    orgId,
    selected?.userId ?? null
  );

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0b1538] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
          <span className="text-base" aria-hidden>
            {rankMeta ? rankMeta.icon : "🧑‍🤝‍🧑"}
          </span>
          <h2 className="text-sm font-bold text-white">
            {rankMeta ? rankMeta.title : "참가자"}
          </h2>

          {/* 🟢 접속자 / 전체 등록자 토글 (일반 모드만) */}
          {!rankBy && (
            <div className="ml-2 flex overflow-hidden rounded-lg ring-1 ring-white/15">
              <button
                type="button"
                onClick={() => setView("online")}
                className={`flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold transition ${
                  view === "online"
                    ? "bg-emerald-500 text-white"
                    : "bg-white/5 text-white/60 hover:bg-white/10"
                }`}
              >
                <span
                  className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-300"
                  aria-hidden
                />
                접속 {onlineCount}
              </button>
              <button
                type="button"
                onClick={() => setView("all")}
                className={`px-2.5 py-1 text-[11px] font-bold transition ${
                  view === "all"
                    ? "bg-amber-400 text-black"
                    : "bg-white/5 text-white/60 hover:bg-white/10"
                }`}
              >
                등록 {allRows.length}
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={onClose}
            className="ml-auto rounded-md px-2 py-0.5 text-lg text-white/50 hover:bg-white/10 hover:text-white"
          >
            ✕
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-3 p-3 md:flex-row">
          {/* 참가자 목록 — 랭킹 모드는 1위부터 세로 한 줄, 명단 모드는 여러 열 */}
          <ul
            className={`scroll-dark min-h-0 flex-1 overflow-y-auto p-1 md:max-w-[60%] ${
              rankBy
                ? "flex flex-col gap-1"
                : "grid auto-rows-min grid-cols-2 gap-1.5 sm:grid-cols-3"
            }`}
          >
            {rows.map((r, idx) => {
              const photo = photosByUser.get(r.userId)?.[0];
              const isPinned = pinnedId === r.userId;
              const isSel = selected?.userId === r.userId;
              const isOnline = onlineIds.has(r.userId);
              const medal =
                rankBy && idx < 3 ? ["🥇", "🥈", "🥉"][idx] : null;
              return (
                <li key={r.userId}>
                  <button
                    type="button"
                    onMouseEnter={() => {
                      if (!pinnedId) setHoveredId(r.userId);
                    }}
                    onFocus={() => {
                      if (!pinnedId) setHoveredId(r.userId);
                    }}
                    onClick={() =>
                      setPinnedId((prev) =>
                        prev === r.userId ? null : r.userId
                      )
                    }
                    title={isPinned ? "클릭하면 고정 해제" : "클릭하면 고정"}
                    className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition ${
                      isPinned
                        ? "bg-amber-400/25 ring-2 ring-amber-300"
                        : isSel
                          ? "bg-amber-400/10 ring-1 ring-amber-300/40"
                          : "hover:bg-white/5"
                    }`}
                  >
                    {rankBy && (
                      <span className="w-6 shrink-0 text-center text-sm font-bold text-white/70">
                        {medal ?? idx + 1}
                      </span>
                    )}
                    <span className="relative shrink-0">
                      <Avatar photo={photo} name={r.displayName} size={34} />
                      {isOnline && (
                        <span
                          className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#0b1538] bg-emerald-400"
                          title="접속중"
                          aria-hidden
                        />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-bold text-white">
                        {isPinned && <span aria-hidden>📌 </span>}
                        {r.displayName}
                      </span>
                      <span className="block truncate text-[10px] text-white/50">
                        {r.classNames.length > 0
                          ? r.classNames.join(", ")
                          : "반 미지정"}
                      </span>
                    </span>
                    {rankMeta && (
                      <span className="shrink-0 font-mono text-sm font-extrabold text-amber-200">
                        {rankMeta.valueOf(r).toLocaleString("ko-KR")}
                        <span className="ml-0.5 text-[9px] font-normal text-white/40">
                          {rankMeta.unit}
                        </span>
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
            {rows.length === 0 && (
              <li className="col-span-full py-8 text-center text-xs text-white/50">
                {view === "online"
                  ? "지금 접속중인 참가자가 없어요"
                  : "아직 참가자가 없어요"}
              </li>
            )}
          </ul>

          {/* 미리보기 패널 */}
          <div className="scroll-dark min-h-0 shrink-0 overflow-y-auto rounded-xl bg-white/5 p-3 md:w-[40%]">
            {selected ? (
              <ParticipantPreview
                key={selected.userId}
                row={selected}
                orgId={orgId}
                photos={photosByUser.get(selected.userId) ?? []}
                detail={detail?.userId === selected.userId ? detail : null}
                detailLoading={detailLoading}
              />
            ) : (
              <p className="py-10 text-center text-xs text-white/50">
                참가자에 마우스를 올리면 정보가 보이고, 클릭하면 고정돼요
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function fmtDate(iso: string | null): string {
  if (!iso) return "활동 없음";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("ko-KR", {
    year: "2-digit",
    month: "2-digit",
    day: "2-digit",
  });
}

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: "활성",
  SUSPENDED: "정지",
  CLOSED: "탈퇴",
};

/**
 * "5/22(금) 오후 12:00"
 *
 * ⚠ toLocaleString 은 쓰지 않는다 — hour 를 주고 hour12 를 안 주면 오전/오후가
 *   붙는데, 그 글자가 서버(영어 ICU)와 브라우저(한국어)에서 갈려 하이드레이션이
 *   깨진다. timeZone 도 서버 UTC / 브라우저 KST 로 어긋난다.
 */
function fmtDateTime(iso: string | null): string {
  if (!iso) return "-";
  const date = fmtCompactDateKst(iso);
  if (!date) return "-";
  const clock = fmtAmPmClockKst(iso);
  return clock ? `${date} ${clock}` : date;
}

const SUB_STATUS: Record<string, { label: string; cls: string }> = {
  APPROVED: { label: "완료", cls: "bg-emerald-500/80 text-white" },
  AUTO_APPROVED: { label: "완료", cls: "bg-emerald-500/80 text-white" },
  PENDING_REVIEW: { label: "검수", cls: "bg-amber-500/80 text-white" },
  SUBMITTED: { label: "검수", cls: "bg-amber-500/80 text-white" },
  REJECTED: { label: "반려", cls: "bg-rose-500/80 text-white" },
  REVOKED: { label: "회수", cls: "bg-zinc-500/80 text-white" },
};

function ParticipantPreview({
  row,
  orgId,
  photos,
  detail,
  detailLoading,
}: {
  row: ControlRoomParticipant;
  orgId: string;
  photos: string[];
  detail: MemberDetail | null;
  detailLoading: boolean;
}) {
  const acorns = detail ? detail.acornBalance : row.acorns;
  const children = detail?.children ?? row.children;
  const phone = detail?.parentPhone ?? row.phone;
  const parentName = detail?.parentName ?? row.parentName;
  const status = detail?.status ?? row.status;

  return (
    <div>
      {/* 사진 캐러셀 — 그 참가자가 올린 사진들, 옆으로 넘기기 */}
      <PhotoCarousel photos={photos} name={row.displayName} />

      <h3 className="mt-3 text-center text-base font-extrabold text-white">
        {row.displayName}
      </h3>

      {/* 이 참가자로 로그인된 개인화면을 새창으로 열기 (임퍼스네이트) */}
      {status === "ACTIVE" ? (
        <a
          href={`/api/org/impersonate-user?id=${row.userId}&org=${orgId}`}
          target="_blank"
          rel="noopener noreferrer"
          title="이 참가자로 로그인해 개인화면을 새창으로 열기"
          className="mt-2 flex items-center justify-center gap-1.5 rounded-lg bg-sky-500/90 py-2 text-xs font-bold text-white transition hover:bg-sky-500 active:scale-[0.99]"
        >
          <span aria-hidden>🔑</span>
          개인화면 열기
          <span aria-hidden>↗</span>
        </a>
      ) : (
        <p className="mt-2 rounded-lg bg-white/5 py-2 text-center text-[11px] text-white/40">
          정지·탈퇴 계정은 개인화면을 열 수 없어요
        </p>
      )}

      {/* 통계 */}
      <div className="mt-2 grid grid-cols-3 gap-1.5 text-center">
        <div className="rounded-lg bg-white/5 py-1.5">
          <p className="text-[9px] text-white/50">🌰 도토리</p>
          <p className="font-mono text-base font-bold text-amber-200">
            {acorns.toLocaleString("ko-KR")}
          </p>
        </div>
        <div className="rounded-lg bg-white/5 py-1.5">
          <p className="text-[9px] text-white/50">🎯 스탬프</p>
          <p className="font-mono text-base font-bold text-sky-300">
            {row.submissions.toLocaleString("ko-KR")}
          </p>
        </div>
        <div className="rounded-lg bg-white/5 py-1.5">
          <p className="text-[9px] text-white/50">🕐 최근</p>
          <p className="font-mono text-[11px] font-bold leading-tight text-emerald-300">
            {fmtDate(row.lastActivityAt)}
          </p>
        </div>
      </div>

      {/* 기본 정보 */}
      <dl className="mt-3 space-y-1.5 text-xs">
        <Info label="상태" value={STATUS_LABEL[status] ?? status} />
        <Info label="보호자" value={parentName || "-"} />
        <Info label="전화" value={phone ? fmtPhone(phone) : "-"} />
        {detail && (
          <>
            <Info label="가입일" value={fmtDate(detail.createdAt)} />
            <Info label="최근 로그인" value={fmtDate(detail.lastLoginAt)} />
          </>
        )}
        {children.length > 0 && (
          <div>
            <dt className="text-[10px] text-white/50">자녀</dt>
            <dd className="mt-0.5 space-y-0.5">
              {children.map((c, i) => (
                <p key={i} className="text-white">
                  {c.className && (
                    <span className="mr-1 rounded bg-sky-400/20 px-1 py-0.5 text-[9px] font-bold text-sky-200">
                      {c.className}
                    </span>
                  )}
                  {c.name}
                  {"isEnrolled" in c && !c.isEnrolled && (
                    <span className="ml-1 text-[9px] text-white/40">(졸업/미등록)</span>
                  )}
                </p>
              ))}
            </dd>
          </div>
        )}
      </dl>

      {/* 로딩 */}
      {detailLoading && !detail && (
        <p className="mt-3 rounded-lg bg-white/5 py-3 text-center text-[11px] text-white/40">
          활동 정보를 불러오는 중…
        </p>
      )}

      {detail && (
        <>
          {/* 미션 활동 */}
          <Section title="🎯 미션 활동" count={detail.recentSubmissions.length}>
            {detail.recentSubmissions.length === 0 ? (
              <Empty text="아직 제출한 미션이 없어요" />
            ) : (
              <ul className="space-y-1">
                {detail.recentSubmissions.map((s) => {
                  const st = SUB_STATUS[s.status] ?? {
                    label: s.status,
                    cls: "bg-white/20 text-white",
                  };
                  return (
                    <li
                      key={s.id}
                      className="flex items-center gap-2 rounded-md bg-white/5 px-2 py-1"
                    >
                      <span className="shrink-0">{s.missionIcon ?? "🌱"}</span>
                      <span className="min-w-0 flex-1 truncate text-white">
                        {s.missionTitle}
                      </span>
                      {s.awardedAcorns ? (
                        <span className="shrink-0 font-mono text-[10px] font-bold text-amber-200">
                          +{s.awardedAcorns}
                        </span>
                      ) : null}
                      <span
                        className={`shrink-0 rounded px-1 py-0.5 text-[9px] font-bold ${st.cls}`}
                      >
                        {st.label}
                      </span>
                      <span className="shrink-0 text-[9px] text-white/40">
                        {fmtDateTime(s.submittedAt)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Section>

          {/* 도토리 내역 */}
          <Section title="🌰 도토리 내역" count={detail.recentAcornTx.length}>
            {detail.recentAcornTx.length === 0 ? (
              <Empty text="도토리 변동 내역이 없어요" />
            ) : (
              <ul className="space-y-1">
                {detail.recentAcornTx.map((t) => (
                  <li
                    key={t.id}
                    className="flex items-center gap-2 rounded-md bg-white/5 px-2 py-1"
                  >
                    <span
                      className={`shrink-0 w-10 font-mono text-xs font-bold ${
                        t.amount >= 0 ? "text-emerald-300" : "text-rose-300"
                      }`}
                    >
                      {t.amount >= 0 ? "+" : ""}
                      {t.amount}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-white/80">
                      {t.reason}
                      {t.memo ? (
                        <span className="text-white/40"> · {t.memo}</span>
                      ) : null}
                    </span>
                    <span className="shrink-0 text-[9px] text-white/40">
                      {fmtDateTime(t.createdAt)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          {/* 참여 행사 */}
          <Section title="🌲 참여 행사" count={detail.participatedEvents.length}>
            {detail.participatedEvents.length === 0 ? (
              <Empty text="참여한 행사가 없어요" />
            ) : (
              <ul className="space-y-1">
                {detail.participatedEvents.map((e) => (
                  <li
                    key={e.id}
                    className="flex items-center gap-2 rounded-md bg-white/5 px-2 py-1"
                  >
                    <span className="min-w-0 flex-1 truncate text-white">
                      {e.name}
                    </span>
                    <span className="shrink-0 text-[9px] text-white/40">
                      {e.joinedAt ? fmtDate(e.joinedAt) : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </>
      )}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="shrink-0 text-[10px] text-white/50">{label}</dt>
      <dd className="truncate text-right font-semibold text-white">{value}</dd>
    </div>
  );
}

function Section({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-3">
      <p className="mb-1 text-[10px] font-bold tracking-wide text-white/50">
        {title} {count > 0 && <span className="text-white/30">({count})</span>}
      </p>
      {children}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <p className="rounded-md bg-white/5 py-2 text-center text-[10px] text-white/30">
      {text}
    </p>
  );
}

/** 참가자가 올린 사진들을 좌우로 넘겨보는 캐러셀. 사진 없으면 이니셜. */
function PhotoCarousel({ photos, name }: { photos: string[]; name: string }) {
  const [idx, setIdx] = useState(0);
  const touchX = useRef<number | null>(null);
  const total = photos.length;

  const go = (d: number) => {
    if (total === 0) return;
    setIdx((i) => (i + d + total) % total);
  };

  if (total === 0) {
    return (
      <div className="relative mx-auto flex aspect-square w-full max-w-[240px] items-center justify-center overflow-hidden rounded-xl bg-black/30">
        <Avatar photo={undefined} name={name} size={96} />
        <span className="absolute bottom-1.5 text-[10px] text-white/40">
          올린 사진이 없어요
        </span>
      </div>
    );
  }

  const cur = Math.min(idx, total - 1);
  return (
    <div className="mx-auto w-full max-w-[240px]">
      <div
        className="relative aspect-square w-full select-none overflow-hidden rounded-xl bg-black/30"
        onTouchStart={(e) => {
          touchX.current = e.touches[0]?.clientX ?? null;
        }}
        onTouchEnd={(e) => {
          if (touchX.current == null) return;
          const dx = (e.changedTouches[0]?.clientX ?? 0) - touchX.current;
          if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
          touchX.current = null;
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photos[cur]}
          alt={`${name} 사진 ${cur + 1}`}
          className="absolute inset-0 h-full w-full object-cover"
        />

        {total > 1 && (
          <>
            <button
              type="button"
              onClick={() => go(-1)}
              aria-label="이전 사진"
              className="absolute left-1 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur transition hover:bg-black/70"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              aria-label="다음 사진"
              className="absolute right-1 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur transition hover:bg-black/70"
            >
              ›
            </button>
            <span className="absolute right-2 top-2 rounded-full bg-black/55 px-1.5 py-0.5 text-[10px] font-bold text-white">
              {cur + 1}/{total}
            </span>
          </>
        )}
      </div>

      {/* 점 인디케이터 */}
      {total > 1 && (
        <div className="mt-1.5 flex flex-wrap justify-center gap-1">
          {photos.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setIdx(i)}
              aria-label={`${i + 1}번 사진`}
              className={`h-1.5 rounded-full transition-all ${
                i === cur ? "w-4 bg-sky-400" : "w-1.5 bg-white/30 hover:bg-white/50"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function Avatar({
  photo,
  name,
  size,
}: {
  photo: string | undefined;
  name: string;
  size: number;
}) {
  if (photo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={photo}
        alt={name}
        width={size}
        height={size}
        className="shrink-0 rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  const initial = (name ?? "").trim().charAt(0) || "?";
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-sky-500 to-indigo-600 font-bold text-white"
      style={{ width: size, height: size, fontSize: size * 0.42 }}
    >
      {initial}
    </span>
  );
}
