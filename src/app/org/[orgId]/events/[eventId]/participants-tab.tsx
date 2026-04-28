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
import { createSingleEventParticipantAction } from "./users/actions";
import { QuickAddUser } from "@/app/org/[orgId]/users/quick-add-user";
import { AttendanceToggle } from "@/app/org/[orgId]/users/attendance-toggle";
import { AcornAdjuster } from "@/app/org/[orgId]/users/acorn-adjuster";
import { UserRowActions } from "@/app/org/[orgId]/users/user-row-actions";
import { AcornIcon } from "@/components/acorn-icon";
import { RemoveFromEventButton } from "./users/remove-from-event-button";

type UserStatus = "ACTIVE" | "SUSPENDED" | "CLOSED";
type AttendanceStatus = "PRESENT" | "LATE" | "ABSENT";

export type ParticipantOption = {
  id: string;
  parent_name: string;
  phone: string;
  status: UserStatus;
  children_count: number;
  enrolled_child_names: string[];
  acorn_balance: number;
  last_login_at: string | null;
  attendance_status: AttendanceStatus | null;
  attendance_date: string | null;
};

type Props = {
  eventId: string;
  orgId: string;
  allParticipants: ParticipantOption[];
  initialSelectedIds: string[];
};

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
    return new Date(iso).toLocaleDateString("ko-KR", {
      year: "2-digit",
      month: "2-digit",
      day: "2-digit",
    });
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
  const filteredInEvent = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return inEvent;
    return inEvent.filter((r) => {
      const hay = `${r.enrolled_child_names.join(" ")} ${r.parent_name} ${r.phone}`.toLowerCase();
      return hay.includes(q);
    });
  }, [inEvent, query]);

  // 빠른 원생 추가 — action binding (orgId, eventId 미리 채움)
  const quickAddAction = useMemo(
    () => createSingleEventParticipantAction.bind(null, orgId, eventId),
    [orgId, eventId]
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
      const hay = `${r.enrolled_child_names.join(" ")} ${r.parent_name} ${r.phone}`.toLowerCase();
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
      {/* ───────────────── 빠른 원생 추가 (행사 자동 연결) ───────────────── */}
      <QuickAddUser
        orgId={orgId}
        action={quickAddAction}
        successHint="이 행사 참가자 명단에 자동 연결됐어요."
      />

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
              <table className="w-full min-w-[1080px] text-sm">
                <thead className="bg-[#F4EFE8] text-[#6B4423]">
                  <tr>
                    <th className="px-2 py-2 text-center text-[10px] font-bold">
                      📋 출석
                    </th>
                    <th className="px-2 py-2 text-left text-[10px] font-bold">
                      🎒 원생명
                    </th>
                    <th className="px-2 py-2 text-left text-[10px] font-bold">
                      📞 연락처
                    </th>
                    <th className="px-2 py-2 text-center text-[10px] font-bold">
                      👫 자녀
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
                          <AcornAdjuster
                            userId={r.id}
                            balance={r.acorn_balance}
                            size="row"
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
                            />
                            <UserRowActions
                              orgId={orgId}
                              userId={r.id}
                              userName={name}
                              status={r.status}
                              variant="table"
                              hideSuspend
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
                    <div className="rounded-lg bg-[#F4EFE8] p-2">
                      <div className="mb-1 text-[10px] text-[#6B4423]">
                        <AcornIcon /> 도토리
                      </div>
                      <AcornAdjuster
                        userId={r.id}
                        balance={r.acorn_balance}
                        size="row"
                      />
                    </div>
                    <div className="rounded-lg bg-[#E8F0E4] p-2">
                      <div className="text-[10px] text-[#2D5A3D]">최근</div>
                      <div className="text-xs font-bold text-[#2D5A3D]">
                        📅 {formatDateTime(r.last_login_at)}
                      </div>
                    </div>
                  </div>
                  <div className="mt-2 flex justify-end">
                    <RemoveFromEventButton
                      orgId={orgId}
                      eventId={eventId}
                      userId={r.id}
                      displayName={name}
                      variant="card"
                    />
                  </div>
                  <UserRowActions
                    orgId={orgId}
                    userId={r.id}
                    userName={name}
                    status={r.status}
                    variant="card"
                    hideSuspend
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
