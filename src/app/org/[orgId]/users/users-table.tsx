"use client";

// 참가자 목록 테이블 — 체크박스 다중 선택 + 일괄 액션 지원.
// 데스크탑 테이블 + 모바일 카드 양쪽에서 동일 동작.
//
// 일괄 액션:
//   - 🎪 행사에 추가 — events 드롭다운에서 행사 선택 후 일괄 link (멱등)
//   - 💤 일괄 비활성화 / ✅ 일괄 활성화
//   - 🗑 일괄 영구 삭제 (이중 확인)

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useMemo,
  useState,
  useTransition,
  type ChangeEvent,
} from "react";
import {
  deleteAppUserAction,
  updateAppUserStatusAction,
  type UserStatus,
  type AttendanceStatus,
} from "./actions";
import { linkUsersToEventAction } from "@/app/org/[orgId]/events/[eventId]/users/actions";
import { UserRowActions } from "./user-row-actions";
import { AttendanceToggle } from "./attendance-toggle";
import { AcornAdjuster } from "./acorn-adjuster";
import { AcornIcon } from "@/components/acorn-icon";

type AppUserListRow = {
  id: string;
  phone: string;
  parent_name: string;
  org_id: string;
  acorn_balance: number;
  status: UserStatus;
  last_login_at: string | null;
  created_at: string;
  attendance_status: AttendanceStatus | null;
  attendance_date: string | null;
};

type AppUserWithCount = AppUserListRow & {
  children_count: number;
  enrolled_names: string[];
  class_names: string[];
};

type EventLite = {
  event_id: string;
  name: string;
  status: string;
};

type Props = {
  orgId: string;
  rows: AppUserWithCount[];
  todayIso: string;
  events: EventLite[];
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

const PAGE_SIZE = 20;

// 정렬 가능한 컬럼 키 (체크박스/작업은 제외).
type SortKey =
  | "attendance"
  | "class"
  | "name"
  | "phone"
  | "children"
  | "acorns"
  | "recent"
  | "status";
type SortDir = "asc" | "desc";
type SortState = { key: SortKey; dir: SortDir } | null;

// 동일 키 클릭 시 asc → desc → 해제 사이클.
function cycleSort(prev: SortState, key: SortKey): SortState {
  if (!prev || prev.key !== key) return { key, dir: "asc" };
  if (prev.dir === "asc") return { key, dir: "desc" };
  return null;
}

function getSortValue(
  r: AppUserWithCount,
  key: SortKey,
  todayIso: string
): string | number | null {
  switch (key) {
    case "attendance": {
      const a = r.attendance_date === todayIso ? r.attendance_status : null;
      if (a === "PRESENT") return 0;
      if (a === "LATE") return 1;
      if (a === "ABSENT") return 2;
      return null;
    }
    case "class":
      return r.class_names[0]?.toLowerCase() ?? null;
    case "name": {
      const name = r.enrolled_names[0] || r.parent_name || "";
      return name.toLocaleLowerCase("ko");
    }
    case "phone":
      return (r.phone ?? "").replace(/\D/g, "");
    case "children":
      return r.children_count;
    case "acorns":
      return r.acorn_balance;
    case "recent":
      return r.last_login_at ?? null;
    case "status": {
      if (r.status === "ACTIVE") return 0;
      if (r.status === "SUSPENDED") return 1;
      return 2; // CLOSED
    }
  }
}

function compareForSort(
  a: AppUserWithCount,
  b: AppUserWithCount,
  sort: NonNullable<SortState>,
  todayIso: string
): number {
  const va = getSortValue(a, sort.key, todayIso);
  const vb = getSortValue(b, sort.key, todayIso);
  // null 은 항상 뒤로 (정렬 방향과 무관).
  if (va == null && vb == null) return 0;
  if (va == null) return 1;
  if (vb == null) return -1;
  const mul = sort.dir === "asc" ? 1 : -1;
  if (typeof va === "number" && typeof vb === "number") {
    return (va - vb) * mul;
  }
  // 문자열 비교 — ko locale.
  return String(va).localeCompare(String(vb), "ko") * mul;
}

function SortIndicator({
  active,
  dir,
}: {
  active: boolean;
  dir: SortDir;
}) {
  if (!active) {
    return (
      <span aria-hidden className="text-[9px] text-[#B0A89D]">
        ⇅
      </span>
    );
  }
  return (
    <span aria-hidden className="text-[10px] text-[#2D5A3D]">
      {dir === "asc" ? "▲" : "▼"}
    </span>
  );
}

export function UsersTable({ orgId, rows, todayIso, events }: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();

  // "행사에 추가" 드롭다운
  const [pickerEventId, setPickerEventId] = useState("");

  // 컬럼 정렬 상태 — null 이면 서버에서 받은 원래 순서 유지.
  const [sort, setSort] = useState<SortState>(null);

  // 정렬된 전체 rows.
  const sortedRows = useMemo(() => {
    if (!sort) return rows;
    const copy = rows.slice();
    copy.sort((a, b) => compareForSort(a, b, sort, todayIso));
    return copy;
  }, [rows, sort, todayIso]);

  // 페이지네이션 — 기본 20개, "더 보기" 누를수록 PAGE_SIZE 만큼 추가, "전체 보기"는 즉시 모두 노출.
  const [visibleCount, setVisibleCount] = useState<number>(PAGE_SIZE);
  const visibleRows = useMemo(
    () => sortedRows.slice(0, visibleCount),
    [sortedRows, visibleCount]
  );
  const hasMore = visibleCount < sortedRows.length;
  const expanded =
    visibleCount >= sortedRows.length && sortedRows.length > PAGE_SIZE;

  const onSort = (key: SortKey) => setSort((prev) => cycleSort(prev, key));

  const allSelected = useMemo(
    () =>
      visibleRows.length > 0 && visibleRows.every((r) => selected.has(r.id)),
    [visibleRows, selected]
  );

  function toggleOne(id: string): void {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll(): void {
    if (allSelected) {
      // 보이는 행에서 선택 해제 (보이지 않는 행에 대한 선택은 보존)
      setSelected((prev) => {
        const next = new Set(prev);
        for (const r of visibleRows) next.delete(r.id);
        return next;
      });
    } else {
      // 보이는 행 모두 선택에 추가
      setSelected((prev) => {
        const next = new Set(prev);
        for (const r of visibleRows) next.add(r.id);
        return next;
      });
    }
  }

  function clearSelection(): void {
    setSelected(new Set());
  }

  function showSavedToast(): void {
    setSavedAt(Date.now());
    setTimeout(() => setSavedAt(null), 2200);
  }

  /* ─────────── 일괄 액션 ─────────── */

  function onBulkAddToEvent(): void {
    if (selected.size === 0 || isPending) return;
    if (!pickerEventId) {
      setError("연결할 행사를 선택해 주세요");
      return;
    }
    setError(null);
    const ids = Array.from(selected);
    startTransition(async () => {
      const res = await linkUsersToEventAction(orgId, pickerEventId, ids);
      if (!res.ok) {
        setError(res.message);
        return;
      }
      clearSelection();
      setPickerEventId("");
      showSavedToast();
      router.refresh();
    });
  }

  function onBulkSetStatus(next: UserStatus): void {
    if (selected.size === 0 || isPending) return;
    const label = next === "SUSPENDED" ? "비활성화" : "활성화";
    if (
      !window.confirm(
        `${selected.size}명을 ${label}할까요?\n${
          next === "SUSPENDED"
            ? "비활성 상태에서는 학부모 앱 로그인이 차단돼요."
            : "다시 학부모 앱 로그인이 가능해져요."
        }`
      )
    )
      return;
    setError(null);
    const ids = Array.from(selected);
    startTransition(async () => {
      try {
        for (const id of ids) {
          await updateAppUserStatusAction(id, next);
        }
        clearSelection();
        showSavedToast();
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : `${label} 실패`);
      }
    });
  }

  function onBulkDelete(): void {
    if (selected.size === 0 || isPending) return;
    if (
      !window.confirm(
        `⚠️ 선택한 ${selected.size}명을 영구 삭제할까요?\n\n` +
          `각 참가자의 자녀·도토리·미션 제출·행사 연결 등 모든 데이터가 함께 삭제돼요.\n` +
          `되돌릴 수 없어요.`
      )
    )
      return;
    const expected = `${selected.size}명 삭제`;
    const typed = window.prompt(
      `정말 확실한가요?\n다시 한 번 확인하기 위해 아래 문구를 그대로 입력해 주세요:\n\n${expected}`
    );
    if (typed === null) return;
    if (typed.trim() !== expected) {
      setError("입력한 문구가 일치하지 않아요. 삭제 취소.");
      return;
    }
    setError(null);
    const ids = Array.from(selected);
    startTransition(async () => {
      try {
        for (const id of ids) {
          await deleteAppUserAction(id);
        }
        clearSelection();
        showSavedToast();
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "삭제 실패");
      }
    });
  }

  return (
    <div className="space-y-3">
      {/* ─── 일괄 작업 툴바 (선택 시에만) ─── */}
      {selected.size > 0 && (
        <div
          role="region"
          aria-label="일괄 작업"
          className="sticky top-[64px] z-20 flex flex-wrap items-center gap-2 rounded-2xl border-2 border-emerald-400 bg-emerald-50 p-3 shadow-md"
        >
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-3 py-1 text-xs font-bold text-white">
            ✓ {selected.size}명 선택됨
          </span>
          <button
            type="button"
            onClick={clearSelection}
            className="rounded-lg border border-[#D4E4BC] bg-white px-2.5 py-1 text-[11px] font-semibold text-[#6B6560] hover:bg-[#F5F1E8]"
          >
            전체 해제
          </button>

          <div className="ml-auto flex flex-wrap items-center gap-1.5">
            {/* 행사에 일괄 연결 */}
            {events.length > 0 && (
              <div className="flex items-center gap-1 rounded-lg border border-emerald-300 bg-white px-1.5 py-0.5">
                <span className="px-1 text-[11px] font-semibold text-emerald-800">
                  🎪
                </span>
                <select
                  value={pickerEventId}
                  onChange={(e) => setPickerEventId(e.target.value)}
                  disabled={isPending}
                  className="bg-transparent py-1 pr-1 text-[11px] font-semibold text-[#2D5A3D] focus:outline-none"
                  aria-label="행사 선택"
                >
                  <option value="">행사에 추가...</option>
                  {events.map((e) => (
                    <option key={e.event_id} value={e.event_id}>
                      {e.status === "LIVE" ? "🔴 " : ""}
                      {e.name || "(이름 없음)"}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={onBulkAddToEvent}
                  disabled={!pickerEventId || isPending}
                  className="rounded-md bg-emerald-600 px-2 py-1 text-[11px] font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  연결
                </button>
              </div>
            )}
            {/* 일괄 비활성화 / 활성화 */}
            <button
              type="button"
              onClick={() => onBulkSetStatus("SUSPENDED")}
              disabled={isPending}
              className="inline-flex items-center gap-1 rounded-lg border border-amber-300 bg-white px-2.5 py-1.5 text-[11px] font-bold text-amber-800 hover:bg-amber-50 disabled:opacity-40"
            >
              <span aria-hidden>💤</span>
              <span>비활성화</span>
            </button>
            <button
              type="button"
              onClick={() => onBulkSetStatus("ACTIVE")}
              disabled={isPending}
              className="inline-flex items-center gap-1 rounded-lg border border-[#D4E4BC] bg-white px-2.5 py-1.5 text-[11px] font-bold text-[#2D5A3D] hover:bg-[#F5F1E8] disabled:opacity-40"
            >
              <span aria-hidden>✅</span>
              <span>활성화</span>
            </button>
            {/* 일괄 삭제 */}
            <button
              type="button"
              onClick={onBulkDelete}
              disabled={isPending}
              className="inline-flex items-center gap-1 rounded-lg bg-rose-600 px-2.5 py-1.5 text-[11px] font-bold text-white hover:bg-rose-700 disabled:opacity-40"
            >
              <span aria-hidden>{isPending ? "⏳" : "🗑"}</span>
              <span>일괄 삭제</span>
            </button>
          </div>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="rounded-2xl border-2 border-rose-300 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800"
        >
          ⚠️ {error}
        </div>
      )}
      {savedAt != null && (
        <div
          role="status"
          className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800"
        >
          ✅ 처리됐어요
        </div>
      )}

      {/* ─── 데스크탑 테이블 ─── */}
      <div className="hidden overflow-hidden rounded-2xl border border-[#D4E4BC] bg-white shadow-sm md:block">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-[#F4EFE8] text-[#6B4423]">
              <tr>
                <th className="w-10 px-2 py-2 text-center text-[10px] font-bold">
                  <input
                    type="checkbox"
                    aria-label="전체 선택"
                    checked={allSelected}
                    onChange={toggleAll}
                    className="h-4 w-4 rounded border-[#D4E4BC] text-emerald-600 focus:ring-emerald-500"
                  />
                </th>
                <th className="px-2 py-2 text-center text-[10px] font-bold">
                  <SortableHeader
                    onClick={() => onSort("attendance")}
                    active={sort?.key === "attendance"}
                    dir={sort?.dir ?? "asc"}
                    align="center"
                  >
                    📋 출석
                  </SortableHeader>
                </th>
                <th className="px-2 py-2 text-left text-[10px] font-bold">
                  <SortableHeader
                    onClick={() => onSort("class")}
                    active={sort?.key === "class"}
                    dir={sort?.dir ?? "asc"}
                  >
                    🐰 반
                  </SortableHeader>
                </th>
                <th className="px-2 py-2 text-left text-[10px] font-bold">
                  <SortableHeader
                    onClick={() => onSort("name")}
                    active={sort?.key === "name"}
                    dir={sort?.dir ?? "asc"}
                  >
                    🎒 원생명
                  </SortableHeader>
                </th>
                <th className="px-2 py-2 text-left text-[10px] font-bold">
                  <SortableHeader
                    onClick={() => onSort("phone")}
                    active={sort?.key === "phone"}
                    dir={sort?.dir ?? "asc"}
                  >
                    📞 학부모연락처
                  </SortableHeader>
                </th>
                <th className="px-2 py-2 text-center text-[10px] font-bold">
                  <SortableHeader
                    onClick={() => onSort("children")}
                    active={sort?.key === "children"}
                    dir={sort?.dir ?? "asc"}
                    align="center"
                  >
                    👫 자녀
                  </SortableHeader>
                </th>
                <th className="px-2 py-2 text-center text-[10px] font-bold">
                  <SortableHeader
                    onClick={() => onSort("acorns")}
                    active={sort?.key === "acorns"}
                    dir={sort?.dir ?? "asc"}
                    align="center"
                  >
                    <AcornIcon /> 도토리
                  </SortableHeader>
                </th>
                <th className="px-2 py-2 text-right text-[10px] font-bold">
                  <SortableHeader
                    onClick={() => onSort("recent")}
                    active={sort?.key === "recent"}
                    dir={sort?.dir ?? "asc"}
                    align="right"
                  >
                    📅 최근
                  </SortableHeader>
                </th>
                <th className="px-2 py-2 text-center text-[10px] font-bold">
                  <SortableHeader
                    onClick={() => onSort("status")}
                    active={sort?.key === "status"}
                    dir={sort?.dir ?? "asc"}
                    align="center"
                  >
                    상태
                  </SortableHeader>
                </th>
                <th className="px-2 py-2 text-center text-[10px] font-bold">
                  작업
                </th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((r) => {
                const status = STATUS_META[r.status] ?? STATUS_META.ACTIVE;
                const displayName =
                  r.enrolled_names.length > 0
                    ? r.enrolled_names.join(", ")
                    : r.parent_name;
                const attendanceToday =
                  r.attendance_date === todayIso ? r.attendance_status : null;
                const phoneDigits = (r.phone ?? "").replace(/\D/g, "");
                const isChecked = selected.has(r.id);
                return (
                  <tr
                    key={r.id}
                    className={`border-t border-[#F4EFE8] ${
                      isChecked
                        ? "bg-emerald-50/40 hover:bg-emerald-50/60"
                        : "hover:bg-[#FFF8F0]"
                    }`}
                  >
                    <td className="px-2 py-2 text-center">
                      <input
                        type="checkbox"
                        aria-label={`${displayName} 선택`}
                        checked={isChecked}
                        onChange={() => toggleOne(r.id)}
                        className="h-4 w-4 rounded border-[#D4E4BC] text-emerald-600 focus:ring-emerald-500"
                      />
                    </td>
                    <td className="px-2 py-2 text-center">
                      <AttendanceToggle
                        userId={r.id}
                        current={attendanceToday}
                        size="sm"
                        iconOnly
                      />
                    </td>
                    <td className="px-2 py-2">
                      {r.class_names.length > 0 ? (
                        <span className="inline-flex flex-wrap gap-1">
                          {r.class_names.map((cn) => (
                            <span
                              key={cn}
                              className="inline-flex items-center rounded-full bg-[#E8F0E4] px-2 py-0.5 text-[10px] font-bold text-[#2D5A3D]"
                            >
                              {cn}
                            </span>
                          ))}
                        </span>
                      ) : (
                        <span className="text-[10px] text-[#B0A89D]">—</span>
                      )}
                    </td>
                    <td className="px-2 py-2">
                      <Link
                        href={`/org/${orgId}/users/${r.id}`}
                        className="font-semibold text-[#2D5A3D] underline-offset-2 hover:underline"
                      >
                        {displayName}
                      </Link>
                      {r.enrolled_names.length === 0 && (
                        <span className="ml-1 text-[10px] text-[#8B7F75]">
                          (원생 미지정)
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-2">
                      <a
                        href={`tel:${phoneDigits}`}
                        className="inline-flex items-center gap-1 font-mono text-[11px] text-[#2D5A3D] underline-offset-2 hover:underline"
                        title="클릭해서 전화 걸기"
                      >
                        📞 {formatPhone(r.phone)}
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
                      <UserRowActions
                        orgId={orgId}
                        userId={r.id}
                        userName={displayName}
                        status={r.status}
                        variant="table"
                        iconOnly
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── 모바일 정렬 셀렉터 — 헤더 클릭 대안 ─── */}
      <div className="md:hidden flex items-center gap-2 rounded-xl border border-[#D4E4BC] bg-white px-3 py-2 text-[11px] shadow-sm">
        <span className="font-semibold text-[#6B6560]">정렬</span>
        <select
          value={sort ? `${sort.key}:${sort.dir}` : ""}
          onChange={(e) => {
            const v = e.target.value;
            if (!v) return setSort(null);
            const [k, d] = v.split(":") as [SortKey, SortDir];
            setSort({ key: k, dir: d });
          }}
          className="flex-1 rounded-md border border-[#D4E4BC] bg-white px-2 py-1 text-xs"
        >
          <option value="">기본 (등록 순)</option>
          <option value="attendance:asc">📋 출석 (출석→결석)</option>
          <option value="class:asc">🐰 반 (가나다)</option>
          <option value="name:asc">🎒 원생명 (가나다)</option>
          <option value="acorns:desc">도토리 많은순</option>
          <option value="acorns:asc">도토리 적은순</option>
          <option value="recent:desc">📅 최근 접속 (최신순)</option>
          <option value="recent:asc">📅 최근 접속 (오래된순)</option>
          <option value="status:asc">상태 (활성→비활성)</option>
        </select>
      </div>

      {/* ─── 모바일 카드 ─── */}
      <ul className="space-y-2 md:hidden">
        {visibleRows.map((r) => {
          const status = STATUS_META[r.status] ?? STATUS_META.ACTIVE;
          const displayName =
            r.enrolled_names.length > 0
              ? r.enrolled_names.join(", ")
              : r.parent_name;
          const attendanceToday =
            r.attendance_date === todayIso ? r.attendance_status : null;
          const phoneDigits = (r.phone ?? "").replace(/\D/g, "");
          const isChecked = selected.has(r.id);
          return (
            <li
              key={r.id}
              className={`rounded-2xl border p-4 shadow-sm transition ${
                isChecked
                  ? "border-emerald-500 bg-emerald-50/30 ring-2 ring-emerald-300/30"
                  : "border-[#D4E4BC] bg-white"
              }`}
            >
              <label className="mb-3 flex items-center gap-2">
                <input
                  type="checkbox"
                  aria-label={`${displayName} 선택`}
                  checked={isChecked}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => {
                    e.preventDefault();
                    toggleOne(r.id);
                  }}
                  className="h-4 w-4 rounded border-[#D4E4BC] text-emerald-600 focus:ring-emerald-500"
                />
                <span className="text-[11px] font-semibold text-[#6B6560]">
                  선택
                </span>
              </label>
              <div className="mb-3 flex justify-center">
                <AttendanceToggle
                  userId={r.id}
                  current={attendanceToday}
                  size="md"
                />
              </div>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  {r.class_names.length > 0 && (
                    <div className="mb-1 flex flex-wrap gap-1">
                      {r.class_names.map((cn) => (
                        <span
                          key={cn}
                          className="inline-flex items-center rounded-full bg-[#E8F0E4] px-2 py-0.5 text-[10px] font-bold text-[#2D5A3D]"
                        >
                          🐰 {cn}
                        </span>
                      ))}
                    </div>
                  )}
                  <Link
                    href={`/org/${orgId}/users/${r.id}`}
                    className="block text-base font-bold text-[#2D5A3D] hover:underline"
                  >
                    🎒 {displayName}
                  </Link>
                  <a
                    href={`tel:${phoneDigits}`}
                    className="mt-1 inline-flex items-center gap-1 font-mono text-xs text-[#2D5A3D] underline-offset-2 hover:underline"
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
              <UserRowActions
                orgId={orgId}
                userId={r.id}
                userName={displayName}
                status={r.status}
                variant="card"
              />
            </li>
          );
        })}
      </ul>

      {/* ─── 페이지네이션 푸터 — 20개 초과 시에만 노출 ─── */}
      {rows.length > PAGE_SIZE && (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-[#D4E4BC] bg-white px-4 py-3 shadow-sm sm:flex-row sm:justify-between">
          <p className="text-[11px] font-semibold text-[#6B6560]">
            <b className="text-[#2D5A3D]">{visibleRows.length}</b>
            <span className="text-[#8B7F75]"> / </span>
            <b className="text-[#2D5A3D]">{rows.length}</b>
            <span className="text-[#8B7F75]"> 명 표시</span>
          </p>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {hasMore && (
              <button
                type="button"
                onClick={() =>
                  setVisibleCount((v) => Math.min(rows.length, v + PAGE_SIZE))
                }
                className="rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] px-3 py-1.5 text-xs font-bold text-[#2D5A3D] shadow-sm hover:bg-[#F5F1E8]"
              >
                ⬇ {PAGE_SIZE}명 더 보기
              </button>
            )}
            {hasMore && (
              <button
                type="button"
                onClick={() => setVisibleCount(rows.length)}
                className="rounded-xl bg-gradient-to-r from-[#2D5A3D] to-[#3A7A52] px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:from-[#234a30] hover:to-[#2D5A3D]"
              >
                📂 전체 {rows.length}명 모두 보기
              </button>
            )}
            {expanded && (
              <button
                type="button"
                onClick={() => setVisibleCount(PAGE_SIZE)}
                className="rounded-xl border border-[#D4E4BC] bg-white px-3 py-1.5 text-xs font-bold text-[#6B6560] shadow-sm hover:bg-[#F5F1E8]"
              >
                ⬆ 처음 {PAGE_SIZE}명만 보기
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * 정렬 가능한 컬럼 헤더 — 클릭으로 asc → desc → 해제 사이클.
 * align 으로 좌/중/우 정렬, 현재 활성이면 ▲▼ 아니면 ⇅.
 */
function SortableHeader({
  children,
  onClick,
  active,
  dir,
  align = "left",
}: {
  children: React.ReactNode;
  onClick: () => void;
  active: boolean;
  dir: SortDir;
  align?: "left" | "center" | "right";
}) {
  const alignClass =
    align === "center"
      ? "justify-center"
      : align === "right"
        ? "justify-end"
        : "justify-start";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-1 ${alignClass} text-[10px] font-bold transition hover:text-[#2D5A3D] ${
        active ? "text-[#2D5A3D]" : "text-[#6B4423]"
      }`}
      title={
        active
          ? dir === "asc"
            ? "오름차순 — 한 번 더 누르면 내림차순"
            : "내림차순 — 한 번 더 누르면 해제"
          : "정렬"
      }
    >
      <span>{children}</span>
      <SortIndicator active={active} dir={dir} />
    </button>
  );
}
