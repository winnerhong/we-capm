"use client";

// 행사 참가자 탭 — /org/[orgId]/users 페이지와 동일한 풍부한 row UI를 행사 단위로 제공.
// - 상단: QuickAddUser (action 을 createSingleEventParticipantAction 으로 binding)
// - 검색바 (client-side 필터)
// - 풍부한 행 테이블: 출석/원생명/연락처/자녀/도토리/최근로그인/상태/작업(로그인·비활성화·행사제외·영구삭제)
// - 하단 접이식: 기관에 있는 다른 참가자를 이 행사에 일괄 추가 (체크박스 UX)

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useMemo,
  useState,
  useTransition,
  type ChangeEvent,
} from "react";
import { setEventParticipantsAction } from "@/lib/org-events/actions";
import {
  createSingleEventParticipantAction,
  lookupParticipantByPhoneAction,
  linkParticipantToEventsAction,
} from "./users/actions";
import { QuickAddUser } from "@/app/org/[orgId]/users/quick-add-user";
import { AttendanceToggle } from "@/app/org/[orgId]/users/attendance-toggle";
import { AcornAdjuster } from "@/app/org/[orgId]/users/acorn-adjuster";
import { UserRowActions } from "@/app/org/[orgId]/users/user-row-actions";
import { AcornIcon } from "@/components/acorn-icon";
import { RemoveFromEventButton } from "./users/remove-from-event-button";
import { PartyCountEditor } from "./party-count-editor";
import { RemoveFromOrgButton } from "./users/remove-from-org-button";
import { SelfRegisterToggle } from "./self-register-toggle";
import { fmtFullDateKst } from "@/lib/datetime/kst";
import type { EventPartyCount } from "@/lib/org-events/application-queries";
import type { OrgEventStatus } from "@/lib/org-events/types";

type UserStatus = "ACTIVE" | "SUSPENDED" | "CLOSED";
type AttendanceStatus = "PRESENT" | "LATE" | "ABSENT";

export type ParticipantOption = {
  id: string;
  parent_name: string;
  phone: string;
  status: UserStatus;
  children_count: number;
  enrolled_child_names: string[];
  class_name: string | null;
  acorn_balance: number;
  last_login_at: string | null;
  attendance_status: AttendanceStatus | null;
  attendance_date: string | null;
  /** 다른 기관 소속이면 그 기관명. 같은 기관이면 null. */
  home_org_name: string | null;
  /** 가입 경로 — 'self_register' 이면 🆕 배지 노출. */
  created_via: "manual" | "csv" | "self_register" | "cross_org" | null;
};

export type EventLite = { id: string; name: string; status: string };

type Props = {
  eventId: string;
  orgId: string;
  allParticipants: ParticipantOption[];
  initialSelectedIds: string[];
  /** 중복 감지 패널에서 선택할 수 있는 이 기관의 행사 목록. */
  events: EventLite[];
  /** 셀프 등록 허용 여부 — 토글 카드 초기값. */
  allowSelfRegister: boolean;
  /** 현재 행사 상태 — LIVE 가 아니면 셀프 등록이 실제 동작하지 않음을 표시. */
  eventStatus: OrgEventStatus;
  /**
   * user_id → 이 행사 참석 인원 구성(접수 승인분만 채워져 있다).
   * 관리자가 직접 등록한 참가자는 항목이 없거나 0/0 이라 배지를 숨긴다.
   */
  partyCounts: Record<string, EventPartyCount>;
  /**
   * user_id → 계정 전역 누적 도토리.
   *
   * 행에 보이는 숫자는 **이 행사에서 번 것**(acorn_balance 를 서버가 덮어씀)이라,
   * 타 기관에서 모아온 사람은 0 으로 뜬다. 왜 0인지 알 수 있게 전역 누적을
   * 툴팁으로만 곁들인다.
   */
  globalAcorns: Record<string, number>;
};

/** "전체 누적 21개 (다른 기관 포함)" — 이 행사 값과 다를 때만. */
function acornTitle(
  eventAcorns: number,
  global: number | undefined
): string {
  if (global === undefined || global === eventAcorns) {
    return `이 행사에서 모은 도토리 ${eventAcorns}개`;
  }
  return `이 행사 ${eventAcorns}개 · 전체 누적 ${global}개 (다른 기관 행사 포함)`;
}

/**
 * 이 행사 참가자 전체의 구성 합계.
 *
 * 접수를 거치지 않고 관리자가 직접 등록한 가족은 구성이 0/0/0 이라 인원을 알 수
 * 없다. 그런 가족을 0명으로 더해버리면 합계가 실제보다 적게 나오므로, 따로
 * unknownFamilies 로 세서 화면에 명시한다.
 */
function summarizeParty(
  rows: ParticipantOption[],
  partyCounts: Record<string, EventPartyCount>
): {
  child: number;
  adult: number;
  senior: number;
  total: number;
  knownFamilies: number;
  unknownFamilies: number;
} {
  let child = 0;
  let adult = 0;
  let senior = 0;
  let knownFamilies = 0;
  let unknownFamilies = 0;
  for (const r of rows) {
    const pc = partyCounts[r.id];
    const c = pc?.child_count ?? 0;
    const a = pc?.adult_count ?? 0;
    const sn = pc?.senior_count ?? 0;
    if (c === 0 && a === 0 && sn === 0) {
      unknownFamilies += 1;
      continue;
    }
    child += c;
    adult += a;
    senior += sn;
    knownFamilies += 1;
  }
  return {
    child,
    adult,
    senior,
    total: child + adult + senior,
    knownFamilies,
    unknownFamilies,
  };
}

const STATUS_META: Record<UserStatus, { label: string; chip: string }> = {
  ACTIVE: {
    label: "활성화",
    chip: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  SUSPENDED: {
    label: "비활성화",
    chip: "bg-amber-50 text-amber-700 border-amber-200",
  },
  CLOSED: {
    label: "해지",
    chip: "bg-zinc-100 text-zinc-600 border-zinc-200",
  },
};

function formatPhone(raw: string): string {
  const digits = (raw ?? "").replace(/\D/g, "");
  if (digits.length === 11) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return raw;
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "-";
  try {
    return fmtFullDateKst(iso);
  } catch {
    return "-";
  }
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function displayName(r: ParticipantOption): string {
  if (r.enrolled_child_names.length === 0) {
    return r.parent_name || "(이름 없음)";
  }
  if (r.enrolled_child_names.length === 1) {
    return r.enrolled_child_names[0];
  }
  return `${r.enrolled_child_names[0]} 외 ${r.enrolled_child_names.length - 1}명`;
}

export function ParticipantsTab({
  eventId,
  orgId,
  allParticipants,
  initialSelectedIds,
  events,
  allowSelfRegister,
  eventStatus,
  partyCounts,
  globalAcorns,
}: Props) {
  const router = useRouter();
  const todayIso = todayIsoDate();

  // 서버에서 매번 새로 받기 때문에 props 의 set 만 신뢰
  const eventParticipantIds = useMemo(
    () => new Set(initialSelectedIds),
    [initialSelectedIds]
  );

  // 행사에 속한 참가자 / 그 외
  const inEvent = useMemo(
    () => allParticipants.filter((p) => eventParticipantIds.has(p.id)),
    [allParticipants, eventParticipantIds]
  );
  const notInEvent = useMemo(
    () => allParticipants.filter((p) => !eventParticipantIds.has(p.id)),
    [allParticipants, eventParticipantIds]
  );

  // 검색 (client-side, 풍부한 행 테이블 대상)
  const [query, setQuery] = useState("");
  // 구성 합계 — 검색 필터와 무관하게 이 행사 참가자 전체 기준.
  const partySummary = useMemo(
    () => summarizeParty(inEvent, partyCounts),
    [inEvent, partyCounts]
  );

  const filteredInEvent = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return inEvent;
    return inEvent.filter((r) => {
      const hay = `${r.enrolled_child_names.join(" ")} ${r.parent_name} ${r.phone} ${r.class_name ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [inEvent, query]);

  // 빠른 원생 추가 — action binding (orgId, eventId 미리 채움)
  const quickAddAction = useMemo(
    () => createSingleEventParticipantAction.bind(null, orgId, eventId),
    [orgId, eventId]
  );
  // 중복 감지 — 연락처 조회 / 기존 참가자 다중행사 연결
  const lookupAction = useMemo(
    () => lookupParticipantByPhoneAction.bind(null, orgId),
    [orgId]
  );
  const linkAction = useMemo(
    () => linkParticipantToEventsAction.bind(null, orgId),
    [orgId]
  );

  // 하단 접이식: 기관 다른 참가자 추가 (체크박스 UX)
  const [bulkSelected, setBulkSelected] = useState<Set<string>>(new Set());
  const [bulkQuery, setBulkQuery] = useState("");
  const [bulkActiveOnly, setBulkActiveOnly] = useState(true);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [bulkSavedAt, setBulkSavedAt] = useState<number | null>(null);
  const [bulkPending, startBulkTransition] = useTransition();

  useEffect(() => {
    if (bulkSavedAt == null) return;
    const t = setTimeout(() => setBulkSavedAt(null), 2000);
    return () => clearTimeout(t);
  }, [bulkSavedAt]);

  const filteredNotInEvent = useMemo(() => {
    const q = bulkQuery.trim().toLowerCase();
    return notInEvent.filter((r) => {
      if (bulkActiveOnly && r.status !== "ACTIVE") return false;
      if (!q) return true;
      const hay = `${r.enrolled_child_names.join(" ")} ${r.parent_name} ${r.phone} ${r.class_name ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [notInEvent, bulkQuery, bulkActiveOnly]);

  function toggleBulk(id: string, status: UserStatus): void {
    if (status === "CLOSED") return;
    setBulkSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllInBulkView(): void {
    setBulkSelected((prev) => {
      const next = new Set(prev);
      for (const r of filteredNotInEvent) {
        if (r.status !== "CLOSED") next.add(r.id);
      }
      return next;
    });
  }

  function clearBulkSelection(): void {
    setBulkSelected(new Set());
  }

  function onBulkAdd(): void {
    if (bulkSelected.size === 0 || bulkPending) return;
    setBulkError(null);
    // 기존 + 새로 추가
    const nextIds = Array.from(
      new Set([...initialSelectedIds, ...Array.from(bulkSelected)])
    );
    startBulkTransition(async () => {
      try {
        await setEventParticipantsAction(eventId, nextIds);
        setBulkSavedAt(Date.now());
        setBulkSelected(new Set());
        router.refresh();
      } catch (err) {
        setBulkError(err instanceof Error ? err.message : "추가에 실패했어요");
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* ───────────────── 셀프 등록 허용 토글 ───────────────── */}
      <SelfRegisterToggle
        eventId={eventId}
        initialEnabled={allowSelfRegister}
        eventStatus={eventStatus}
      />

      {/* ───────────────── 빠른 원생 추가 (행사 자동 연결) ───────────────── */}
      <QuickAddUser
        orgId={orgId}
        action={quickAddAction}
        successHint="이 행사 참가자 명단에 자동 연결됐어요."
        lookupAction={lookupAction}
        linkAction={linkAction}
        events={events}
        currentEventId={eventId}
      />

      {/* ───────────────── 엑셀 일괄등록 진입 ───────────────── */}
      <Link
        href={`/org/${orgId}/users/bulk-import?event=${eventId}`}
        className="flex items-center justify-between gap-3 rounded-2xl border border-dashed border-[#6B4423]/40 bg-[#FFFDF8] px-4 py-3 shadow-sm transition hover:border-[#6B4423] hover:bg-[#FFF8F0]"
      >
        <div className="flex items-center gap-3">
          <span className="text-xl" aria-hidden>
            📥
          </span>
          <div>
            <p className="text-sm font-bold text-[#6B4423]">
              엑셀로 한 번에 등록
            </p>
            <p className="text-[11px] text-[#8B7F75]">
              엑셀/CSV 업로드 → 이 행사 참가자 명단에 자동 연결
            </p>
          </div>
        </div>
        <span aria-hidden className="text-[#8B6F47]">
          ›
        </span>
      </Link>

      {/* ───────────────── 참가 구성 요약 ───────────────── */}
      <section className="rounded-2xl border border-[#D4E4BC] bg-gradient-to-br from-[#F5F1E8] via-white to-[#E8F0E4] p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-[#2D5A3D]">
            👨‍👩‍👧‍👦 참가 구성
          </h3>
          <p className="text-xs font-semibold text-[#6B6560]">
            {inEvent.length.toLocaleString("ko-KR")}가족
          </p>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { icon: "👶", label: "유아", value: partySummary.child, tone: "bg-[#FAE7D0] text-[#6B4423]" },
            { icon: "🧑", label: "성인", value: partySummary.adult, tone: "bg-[#E8F0E4] text-[#2D5A3D]" },
            { icon: "👴", label: "조부모", value: partySummary.senior, tone: "bg-[#EDE7F6] text-[#4A3A6B]" },
            { icon: "🧮", label: "합계", value: partySummary.total, tone: "bg-[#2D5A3D] text-white" },
          ].map((it) => (
            <div
              key={it.label}
              className={`rounded-xl px-3 py-2.5 text-center ${it.tone}`}
            >
              <div className="text-[10px] font-semibold opacity-80">
                <span aria-hidden>{it.icon}</span> {it.label}
              </div>
              <div className="text-lg font-extrabold tabular-nums">
                {it.value.toLocaleString("ko-KR")}
                <span className="text-[11px] font-bold">명</span>
              </div>
            </div>
          ))}
        </div>

        {partySummary.unknownFamilies > 0 && (
          <p className="mt-2 text-[11px] leading-relaxed text-[#8B7F75]">
            ⚠️ {partySummary.unknownFamilies}가족은 구성이 기록돼 있지 않아 합계에서
            빠져 있어요. 접수(신청서)를 거치지 않고 등록된 참가자예요.
          </p>
        )}
        {partySummary.unknownFamilies === 0 && partySummary.total === 0 && (
          <p className="mt-2 text-[11px] text-[#8B7F75]">
            아직 참가자가 없어요.
          </p>
        )}
      </section>

      {/* ───────────────── 검색 ───────────────── */}
      <div className="rounded-2xl border border-[#D4E4BC] bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex-1 min-w-[200px]">
            <span className="text-[11px] font-semibold text-[#6B6560]">
              원생명 / 학부모연락처 검색
            </span>
            <input
              type="search"
              value={query}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                setQuery(e.target.value)
              }
              placeholder="예) 홍유빈 / 010-1234-5678"
              inputMode="search"
              autoComplete="off"
              className="mt-1 w-full rounded-lg border border-[#E5D3B8] bg-white px-3 py-2 text-sm text-[#2D5A3D] focus:border-[#2D5A3D] focus:outline-none focus:ring-2 focus:ring-[#2D5A3D]/30"
            />
          </label>
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="rounded-lg border border-[#E5D3B8] bg-white px-4 py-2 text-xs font-semibold text-[#6B4423] hover:bg-[#FFF8F0]"
            >
              초기화
            </button>
          )}
          <span className="ml-auto text-xs text-[#6B6560]">
            {filteredInEvent.length.toLocaleString("ko-KR")} /{" "}
            {inEvent.length.toLocaleString("ko-KR")}명
          </span>
        </div>
      </div>

      {/* ───────────────── 풍부한 행 테이블 (이 행사 참가자) ───────────────── */}
      {filteredInEvent.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#D4E4BC] bg-white p-10 text-center">
          <div className="text-5xl" aria-hidden>
            🌱
          </div>
          <p className="mt-3 text-sm font-semibold text-[#2D5A3D]">
            {query
              ? "조건에 맞는 참가자가 없어요"
              : "이 행사에 등록된 참가자가 없어요"}
          </p>
          <p className="mt-1 text-xs text-[#6B6560]">
            {query
              ? "검색어를 비우거나 다른 조건으로 시도해 보세요."
              : "위의 ⚡ 빠른 원생 추가로 한 명씩 등록하거나, 아래 \"기관 다른 참가자 추가\" 에서 기존 참가자를 일괄 연결할 수 있어요."}
          </p>
        </div>
      ) : (
        <>
          {/* 데스크탑 테이블 */}
          <div className="hidden overflow-hidden rounded-2xl border border-[#D4E4BC] bg-white shadow-sm md:block">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="bg-[#F4EFE8] text-[#6B4423]">
                  <tr>
                    <th className="px-2 py-2 text-center text-[10px] font-bold">
                      📋 출석
                    </th>
                    <th className="px-2 py-2 text-left text-[10px] font-bold">
                      🎒 원생명
                    </th>
                    <th className="px-2 py-2 text-center text-[10px] font-bold">
                      🏫 반명
                    </th>
                    <th className="px-2 py-2 text-left text-[10px] font-bold">
                      📞 연락처
                    </th>
                    <th className="px-2 py-2 text-center text-[10px] font-bold">
                      👫 자녀
                    </th>
                    <th className="px-2 py-2 text-center text-[10px] font-bold">
                      👨‍👩‍👧 참석
                    </th>
                    <th className="px-2 py-2 text-center text-[10px] font-bold">
                      <AcornIcon /> 도토리
                    </th>
                    <th className="px-2 py-2 text-right text-[10px] font-bold">
                      📅 최근
                    </th>
                    <th className="px-2 py-2 text-center text-[10px] font-bold">
                      상태
                    </th>
                    <th className="px-2 py-2 text-right text-[10px] font-bold">
                      작업
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredInEvent.map((r) => {
                    const status = STATUS_META[r.status] ?? STATUS_META.ACTIVE;
                    const name = displayName(r);
                    const attendanceToday =
                      r.attendance_date === todayIso
                        ? r.attendance_status
                        : null;
                    const phoneDigits = (r.phone ?? "").replace(/\D/g, "");
                    return (
                      <tr
                        key={r.id}
                        className="border-t border-[#F4EFE8] hover:bg-[#FFF8F0]"
                      >
                        <td className="px-2 py-2 text-center">
                          <AttendanceToggle
                            userId={r.id}
                            current={attendanceToday}
                            size="sm"
                            iconOnly
                          />
                        </td>
                        <td className="px-2 py-2">
                          <Link
                            href={`/org/${orgId}/users/${r.id}`}
                            className="text-xs font-semibold text-[#2D5A3D] underline-offset-2 hover:underline"
                          >
                            {name}
                          </Link>
                          {r.enrolled_child_names.length === 0 && (
                            <span className="ml-1 text-[10px] text-[#8B7F75]">
                              (미지정)
                            </span>
                          )}
                          {(r.home_org_name ||
                            r.created_via === "self_register") && (
                            <div className="mt-0.5 flex flex-wrap gap-1">
                              {r.home_org_name && (
                                <span className="inline-flex items-center rounded-full bg-amber-50 px-1.5 py-0.5 text-[9px] font-bold text-amber-700 ring-1 ring-amber-200">
                                  🏫 타기관 · {r.home_org_name}
                                </span>
                              )}
                              {r.created_via === "self_register" && (
                                <span
                                  className="inline-flex items-center rounded-full bg-violet-50 px-1.5 py-0.5 text-[9px] font-bold text-violet-700 ring-1 ring-violet-200"
                                  title="초대장 링크에서 본인이 직접 등록한 참가자예요"
                                >
                                  🆕 셀프
                                </span>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="px-2 py-2 text-center">
                          {r.class_name ? (
                            <span className="inline-flex items-center rounded-full bg-[#E8F0E4] px-2 py-0.5 text-[10px] font-bold text-[#2D5A3D]">
                              {r.class_name}
                            </span>
                          ) : (
                            <span className="text-[10px] text-[#B0A89C]">-</span>
                          )}
                        </td>
                        <td className="px-2 py-2">
                          <a
                            href={`tel:${phoneDigits}`}
                            className="inline-flex items-center gap-1 font-mono text-[11px] text-[#2D5A3D] underline-offset-2 hover:underline"
                            title="클릭해서 전화 걸기"
                          >
                            {formatPhone(r.phone)}
                          </a>
                        </td>
                        <td className="px-2 py-2 text-center">
                          <span className="inline-flex items-center gap-0.5 rounded-full bg-[#FAE7D0] px-2 py-0.5 text-[10px] font-bold text-[#6B4423]">
                            <span aria-hidden>👫</span>
                            {r.children_count}명
                          </span>
                        </td>
                        <td className="px-2 py-2 text-center">
                          {/* 인원은 신청 후에도 바뀐다 — 배지를 눌러 바로 고친다. */}
                          <PartyCountEditor
                            orgId={orgId}
                            eventId={eventId}
                            userId={r.id}
                            displayName={r.parent_name}
                            current={partyCounts[r.id]}
                          />
                        </td>
                        <td
                          className="px-2 py-2 text-center"
                          title={acornTitle(r.acorn_balance, globalAcorns[r.id])}
                        >
                          <AcornAdjuster
                            userId={r.id}
                            balance={r.acorn_balance}
                            size="row"
                            eventId={eventId}
                          />
                        </td>
                        <td className="px-2 py-2 text-right text-[11px] text-[#6B6560]">
                          {formatDateTime(r.last_login_at)}
                        </td>
                        <td className="px-2 py-2 text-center">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${status.chip}`}
                          >
                            {status.label}
                          </span>
                        </td>
                        <td className="px-2 py-2">
                          <div className="flex flex-wrap items-center justify-end gap-1">
                            <RemoveFromEventButton
                              orgId={orgId}
                              eventId={eventId}
                              userId={r.id}
                              displayName={name}
                              variant="table"
                              iconOnly
                            />
                            {/* 타 기관 계정에만 — 우리 기관 것만 정리하는 버튼.
                                (영구삭제는 홈 기관만 가능해서 여기선 실패한다) */}
                            {r.home_org_name && (
                              <RemoveFromOrgButton
                                orgId={orgId}
                                userId={r.id}
                                displayName={name}
                                homeOrgName={r.home_org_name}
                                variant="table"
                                iconOnly
                              />
                            )}
                            <UserRowActions
                              orgId={orgId}
                              userId={r.id}
                              userName={name}
                              status={r.status}
                              variant="table"
                              hideSuspend
                              /* 타 기관 계정은 영구삭제 불가 — 대신 위의 📤 */
                              hideDelete={!!r.home_org_name}
                              iconOnly
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* 모바일 카드 */}
          <ul className="space-y-2 md:hidden">
            {filteredInEvent.map((r) => {
              const status = STATUS_META[r.status] ?? STATUS_META.ACTIVE;
              const name = displayName(r);
              const attendanceToday =
                r.attendance_date === todayIso ? r.attendance_status : null;
              const phoneDigits = (r.phone ?? "").replace(/\D/g, "");
              return (
                <li
                  key={r.id}
                  className="rounded-2xl border border-[#D4E4BC] bg-white p-4 shadow-sm"
                >
                  <div className="mb-3 flex justify-center">
                    <AttendanceToggle
                      userId={r.id}
                      current={attendanceToday}
                      size="md"
                    />
                  </div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/org/${orgId}/users/${r.id}`}
                        className="block text-base font-bold text-[#2D5A3D] hover:underline"
                      >
                        🎒 {name}
                      </Link>
                      <div className="mt-0.5 flex flex-wrap gap-1">
                        {r.class_name && (
                          <span className="inline-flex items-center rounded-full bg-[#E8F0E4] px-2 py-0.5 text-[10px] font-bold text-[#2D5A3D]">
                            🏫 {r.class_name}
                          </span>
                        )}
                        {r.home_org_name && (
                          <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700 ring-1 ring-amber-200">
                            타기관 · {r.home_org_name}
                          </span>
                        )}
                        {r.created_via === "self_register" && (
                          <span
                            className="inline-flex items-center rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-bold text-violet-700 ring-1 ring-violet-200"
                            title="초대장 링크에서 본인이 직접 등록한 참가자예요"
                          >
                            🆕 셀프 등록
                          </span>
                        )}
                      </div>
                      <a
                        href={`tel:${phoneDigits}`}
                        className="mt-0.5 inline-flex items-center gap-1 font-mono text-xs text-[#2D5A3D] underline-offset-2 hover:underline"
                      >
                        📞 {formatPhone(r.phone)}
                      </a>
                    </div>
                    <span
                      className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${status.chip}`}
                    >
                      {status.label}
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-lg bg-[#FAE7D0] p-2">
                      <div className="text-[10px] text-[#6B4423]">자녀</div>
                      <div className="text-sm font-bold text-[#6B4423]">
                        👫 {r.children_count}명
                      </div>
                    </div>
                    {/* 구성을 모르는 행(직접 등록분)도 눌러서 채울 수 있게
                        조건 없이 띄운다. */}
                    <div className="rounded-lg bg-[#E8F0E4] p-2">
                      <div className="text-[10px] text-[#2D5A3D]">참석</div>
                      <div className="mt-0.5">
                        <PartyCountEditor
                          orgId={orgId}
                          eventId={eventId}
                          userId={r.id}
                          displayName={r.parent_name}
                          current={partyCounts[r.id]}
                          variant="card"
                        />
                      </div>
                    </div>
                    <div
                      className="rounded-lg bg-[#F4EFE8] p-2"
                      title={acornTitle(r.acorn_balance, globalAcorns[r.id])}
                    >
                      <div className="mb-1 text-[10px] text-[#6B4423]">
                        <AcornIcon /> 도토리
                      </div>
                      <AcornAdjuster
                        userId={r.id}
                        balance={r.acorn_balance}
                        size="row"
                        eventId={eventId}
                      />
                    </div>
                    <div className="rounded-lg bg-[#E8F0E4] p-2">
                      <div className="text-[10px] text-[#2D5A3D]">최근</div>
                      <div className="text-xs font-bold text-[#2D5A3D]">
                        📅 {formatDateTime(r.last_login_at)}
                      </div>
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap justify-end gap-1.5">
                    <RemoveFromEventButton
                      orgId={orgId}
                      eventId={eventId}
                      userId={r.id}
                      displayName={name}
                      variant="card"
                    />
                    {r.home_org_name && (
                      <RemoveFromOrgButton
                        orgId={orgId}
                        userId={r.id}
                        displayName={name}
                        homeOrgName={r.home_org_name}
                        variant="card"
                      />
                    )}
                  </div>
                  <UserRowActions
                    orgId={orgId}
                    userId={r.id}
                    userName={name}
                    status={r.status}
                    variant="card"
                    hideSuspend
                    hideDelete={!!r.home_org_name}
                  />
                </li>
              );
            })}
          </ul>
        </>
      )}

      {/* ───────────────── 하단: 기관 다른 참가자 추가 (접이식, 일괄) ───────────────── */}
      {notInEvent.length > 0 && (
        <section className="rounded-2xl border border-[#D4E4BC] bg-white shadow-sm">
          <details className="group" open={false}>
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-2xl bg-gradient-to-br from-[#FAE7D0] via-white to-[#E8F0E4] p-4">
              <div className="flex items-center gap-2 text-[#2D5A3D]">
                <span aria-hidden className="text-xl">
                  ➕
                </span>
                <div>
                  <p className="text-sm font-bold">
                    기관에 등록된 다른 참가자 추가
                  </p>
                  <p className="text-[11px] text-[#6B6560]">
                    이 행사에 아직 연결되지 않은 참가자{" "}
                    {notInEvent.length.toLocaleString("ko-KR")}명을 한꺼번에
                    체크해서 추가할 수 있어요.
                  </p>
                </div>
              </div>
              <span
                aria-hidden
                className="shrink-0 rounded-full bg-white px-2 py-1 text-[11px] font-bold text-[#2D5A3D] shadow-sm transition group-open:rotate-180"
              >
                ▼
              </span>
            </summary>

            <div className="space-y-3 border-t border-[#D4E4BC] p-4">
              {/* 검색 + 필터 */}
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="search"
                  value={bulkQuery}
                  onChange={(e) => setBulkQuery(e.target.value)}
                  placeholder="🔍 원생/보호자명/연락처 검색"
                  className="flex-1 min-w-[200px] rounded-lg border border-[#E5D3B8] bg-white px-3 py-2 text-sm text-[#2D5A3D] focus:border-[#2D5A3D] focus:outline-none focus:ring-2 focus:ring-[#2D5A3D]/30"
                />
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-[#D4E4BC] bg-white px-3 py-2 text-xs font-semibold text-[#2D5A3D] hover:bg-[#F5F1E8]">
                  <input
                    type="checkbox"
                    checked={bulkActiveOnly}
                    onChange={(e) => setBulkActiveOnly(e.target.checked)}
                    className="h-4 w-4 rounded border-[#D4E4BC] text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>활성만 보기</span>
                </label>
                <button
                  type="button"
                  onClick={selectAllInBulkView}
                  disabled={filteredNotInEvent.length === 0}
                  className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  보이는 항목 전체 선택
                </button>
                <button
                  type="button"
                  onClick={clearBulkSelection}
                  disabled={bulkSelected.size === 0}
                  className="rounded-lg border border-[#E5D3B8] bg-white px-3 py-2 text-xs font-bold text-[#6B4423] hover:bg-[#FFF8F0] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  전체 해제
                </button>
              </div>

              {bulkError && (
                <div
                  role="alert"
                  className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-800"
                >
                  ⚠️ {bulkError}
                </div>
              )}
              {bulkSavedAt != null && (
                <div
                  role="status"
                  className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800"
                >
                  ✅ 추가됐어요
                </div>
              )}

              {/* 후보 목록 */}
              {filteredNotInEvent.length === 0 ? (
                <p className="rounded-lg border border-dashed border-[#D4E4BC] bg-[#FFF8F0] px-3 py-4 text-center text-xs text-[#6B6560]">
                  {notInEvent.length === 0
                    ? "기관에 등록된 모든 참가자가 이미 이 행사에 연결되어 있어요."
                    : "조건에 맞는 후보가 없어요."}
                </p>
              ) : (
                <ul className="max-h-72 space-y-1 overflow-y-auto rounded-lg border border-[#F4EFE8] bg-[#FFFDF8] p-2">
                  {filteredNotInEvent.map((r) => {
                    const isClosed = r.status === "CLOSED";
                    const isChecked = bulkSelected.has(r.id);
                    const name = displayName(r);
                    return (
                      <li key={r.id}>
                        <label
                          className={`flex items-center gap-2 rounded-lg px-2 py-1.5 ${
                            isClosed
                              ? "cursor-not-allowed opacity-50"
                              : isChecked
                                ? "bg-emerald-50"
                                : "hover:bg-white"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            disabled={isClosed}
                            onChange={() => toggleBulk(r.id, r.status)}
                            className="h-4 w-4 rounded border-[#D4E4BC] text-emerald-600 focus:ring-emerald-500 disabled:cursor-not-allowed"
                          />
                          <span className="flex-1 text-xs font-semibold text-[#2D5A3D]">
                            🎒 {name}
                          </span>
                          <span className="font-mono text-[11px] text-[#6B6560]">
                            {formatPhone(r.phone)}
                          </span>
                          <span className="rounded-full bg-[#FAE7D0] px-2 py-0.5 text-[10px] font-bold text-[#6B4423]">
                            👫 {r.children_count}명
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              )}

              {/* 추가 버튼 */}
              <div className="flex flex-wrap items-center justify-end gap-2">
                <span className="text-xs text-[#6B6560]">
                  선택{" "}
                  <b className="text-[#2D5A3D]">
                    {bulkSelected.size.toLocaleString("ko-KR")}명
                  </b>
                </span>
                <button
                  type="button"
                  onClick={onBulkAdd}
                  disabled={bulkSelected.size === 0 || bulkPending}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#2D5A3D] to-[#3A7A52] px-4 py-2 text-xs font-bold text-white shadow-sm hover:from-[#234a30] hover:to-[#2D5A3D] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span aria-hidden>{bulkPending ? "⏳" : "➕"}</span>
                  <span>
                    {bulkPending ? "추가 중..." : "이 행사에 추가"}
                  </span>
                </button>
              </div>
            </div>
          </details>
        </section>
      )}
    </div>
  );
}
