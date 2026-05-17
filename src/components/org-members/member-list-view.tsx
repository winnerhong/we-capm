"use client";

// 조직 가족 명단 — admin / org 페이지가 동일하게 사용.
//   - 가족 뷰: 보호자 1줄 + 자녀 chip
//   - 자녀 뷰: 자녀 1줄 (반 정렬용)
//   - 검색(이름/연락처) + 반 칩 + 원생만 토글
//   - 행 클릭 시 우측 Drawer 로 상세 패널 오픈
//   - CSV 내보내기 버튼 (현재 필터 그대로)

import { useMemo, useState } from "react";
import type { OrgMemberFamily } from "@/lib/org-members/queries";
import { MemberDetailDrawer } from "./member-detail-drawer";
import { AcornIcon } from "@/components/acorn-icon";

type ViewMode = "family" | "child";

type Props = {
  families: OrgMemberFamily[];
  classOptions: string[];
  totalChildren: number;
  totalEnrolled: number;
  /**
   * 디테일 fetch + impersonate 권한이 다르므로 page 단에서 주입.
   *  - basePath: '/admin/orgs/[id]' or '/org/[orgId]' — CSV/impersonate href 조립
   *  - canImpersonate: admin 만 true (org 매니저는 false)
   *  - loadDetail: server action 으로 상세 가져오기
   */
  basePath: string;
  canImpersonate: boolean;
  detailLoader: (
    userId: string
  ) => Promise<
    | { ok: true; detail: import("@/lib/org-members/queries").OrgMemberDetail }
    | { ok: false; error: string }
  >;
};

function formatDate(iso: string | null): string {
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

function formatPhone(raw: string): string {
  const d = raw.replace(/\D/g, "");
  if (d.length === 11) return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
  return raw;
}

function calcAge(birthDate: string | null): string {
  if (!birthDate) return "";
  try {
    const b = new Date(birthDate);
    const now = new Date();
    let age = now.getFullYear() - b.getFullYear();
    const m = now.getMonth() - b.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age -= 1;
    return `만${age}세`;
  } catch {
    return "";
  }
}

export function MemberListView({
  families,
  classOptions,
  totalChildren,
  totalEnrolled,
  basePath,
  canImpersonate,
  detailLoader,
}: Props) {
  const [viewMode, setViewMode] = useState<ViewMode>("family");
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState<string | null>(null);
  const [enrolledOnly, setEnrolledOnly] = useState(false);
  const [openUserId, setOpenUserId] = useState<string | null>(null);

  // 필터 적용된 가족 목록
  const filteredFamilies = useMemo(() => {
    const q = search.trim().toLowerCase();
    return families.filter((f) => {
      // 검색: 보호자 이름 OR 자녀 이름 OR 연락처
      if (q) {
        const phoneDigits = f.parentPhone.replace(/\D/g, "");
        const matchesParent =
          f.parentName.toLowerCase().includes(q) ||
          phoneDigits.includes(q.replace(/\D/g, ""));
        const matchesChild = f.children.some((c) =>
          c.name.toLowerCase().includes(q)
        );
        if (!matchesParent && !matchesChild) return false;
      }
      // 반 필터
      if (classFilter) {
        if (!f.children.some((c) => c.className === classFilter)) return false;
      }
      // 원생만
      if (enrolledOnly) {
        if (!f.children.some((c) => c.isEnrolled)) return false;
      }
      return true;
    });
  }, [families, search, classFilter, enrolledOnly]);

  // 자녀 뷰용 평탄화 — 같은 자녀가 여러 번 안 나오게 children 별로 1줄
  const childRows = useMemo(() => {
    type Row = {
      childId: string;
      childName: string;
      className: string | null;
      isEnrolled: boolean;
      birthDate: string | null;
      parentName: string;
      parentPhone: string;
      userId: string;
    };
    const rows: Row[] = [];
    for (const f of filteredFamilies) {
      for (const c of f.children) {
        if (classFilter && c.className !== classFilter) continue;
        if (enrolledOnly && !c.isEnrolled) continue;
        rows.push({
          childId: c.id,
          childName: c.name,
          className: c.className,
          isEnrolled: c.isEnrolled,
          birthDate: c.birthDate,
          parentName: f.parentName,
          parentPhone: f.parentPhone,
          userId: f.userId,
        });
      }
    }
    // 반 ASC, 이름 ASC
    rows.sort((a, b) => {
      const ca = a.className ?? "ㅎㅎ";
      const cb = b.className ?? "ㅎㅎ";
      if (ca !== cb) return ca.localeCompare(cb);
      return a.childName.localeCompare(b.childName);
    });
    return rows;
  }, [filteredFamilies, classFilter, enrolledOnly]);

  // CSV 내보내기 href 조립 — 현재 필터/뷰모드 포함
  const exportHref = useMemo(() => {
    const params = new URLSearchParams();
    params.set("view", viewMode);
    if (search.trim()) params.set("q", search.trim());
    if (classFilter) params.set("class", classFilter);
    if (enrolledOnly) params.set("enrolled", "1");
    return `${basePath}/members/export?${params.toString()}`;
  }, [basePath, viewMode, search, classFilter, enrolledOnly]);

  return (
    <div className="space-y-4">
      {/* 요약 통계 */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl border border-[#D4E4BC] bg-white p-3">
          <p className="text-[10px] text-[#6B6560]">가족</p>
          <p className="text-lg font-bold text-[#2D5A3D]">
            {families.length.toLocaleString("ko-KR")}
          </p>
        </div>
        <div className="rounded-xl border border-[#D4E4BC] bg-white p-3">
          <p className="text-[10px] text-[#6B6560]">자녀</p>
          <p className="text-lg font-bold text-[#2D5A3D]">
            {totalChildren.toLocaleString("ko-KR")}
          </p>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
          <p className="text-[10px] text-emerald-700">원생</p>
          <p className="text-lg font-bold text-emerald-800">
            {totalEnrolled.toLocaleString("ko-KR")}
          </p>
        </div>
      </div>

      {/* 뷰 토글 + CSV */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div
          role="tablist"
          className="inline-flex rounded-xl border border-[#D4E4BC] bg-white p-0.5"
        >
          {(["family", "child"] as const).map((m) => {
            const active = viewMode === m;
            return (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setViewMode(m)}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                  active
                    ? "bg-[#2D5A3D] text-white shadow-sm"
                    : "text-[#6B6560] hover:bg-[#F5F1E8]"
                }`}
              >
                {m === "family" ? "👨‍👩‍👧 가족" : "🧒 자녀"} 뷰
              </button>
            );
          })}
        </div>

        <a
          href={exportHref}
          className="inline-flex items-center gap-1 rounded-xl border border-[#D4E4BC] bg-white px-3 py-1.5 text-xs font-bold text-[#2D5A3D] transition hover:bg-[#F5F1E8]"
        >
          📥 CSV 내보내기
        </a>
      </div>

      {/* 검색 + 필터 */}
      <div className="space-y-2 rounded-2xl border border-[#D4E4BC] bg-white p-3">
        <div className="flex flex-wrap gap-2">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="보호자/자녀 이름 또는 연락처"
            className="min-w-[200px] flex-1 rounded-lg border border-[#D4E4BC] bg-[#FFF8F0] px-3 py-2 text-sm text-[#3D3A36] outline-none focus:border-[#2D5A3D] focus:ring-2 focus:ring-[#2D5A3D]/20"
          />
          <label className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800">
            <input
              type="checkbox"
              checked={enrolledOnly}
              onChange={(e) => setEnrolledOnly(e.target.checked)}
              className="h-4 w-4 accent-emerald-600"
            />
            원생만
          </label>
        </div>

        {classOptions.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setClassFilter(null)}
              className={`rounded-full px-2.5 py-1 text-[11px] font-bold transition ${
                classFilter === null
                  ? "bg-[#2D5A3D] text-white"
                  : "border border-[#D4E4BC] bg-white text-[#6B6560] hover:bg-[#F5F1E8]"
              }`}
            >
              전체 반
            </button>
            {classOptions.map((cls) => {
              const active = classFilter === cls;
              return (
                <button
                  key={cls}
                  type="button"
                  onClick={() => setClassFilter(active ? null : cls)}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-bold transition ${
                    active
                      ? "bg-amber-400 text-[#0B1538] shadow-sm"
                      : "border border-[#D4E4BC] bg-white text-[#6B6560] hover:bg-[#F5F1E8]"
                  }`}
                >
                  {cls}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 리스트 */}
      {viewMode === "family" ? (
        <FamilyList
          families={filteredFamilies}
          onOpen={(id) => setOpenUserId(id)}
        />
      ) : (
        <ChildList rows={childRows} onOpen={(id) => setOpenUserId(id)} />
      )}

      {/* 우측 Drawer */}
      {openUserId && (
        <MemberDetailDrawer
          userId={openUserId}
          basePath={basePath}
          canImpersonate={canImpersonate}
          detailLoader={detailLoader}
          onClose={() => setOpenUserId(null)}
        />
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Family list                                                                 */
/* -------------------------------------------------------------------------- */

function FamilyList({
  families,
  onOpen,
}: {
  families: OrgMemberFamily[];
  onOpen: (userId: string) => void;
}) {
  if (families.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-[#D4E4BC] bg-white p-8 text-center text-sm text-[#6B6560]">
        조건에 맞는 가족이 없어요
      </div>
    );
  }
  return (
    <ul className="space-y-2">
      {families.map((f) => (
        <li key={f.userId}>
          <button
            type="button"
            onClick={() => onOpen(f.userId)}
            className="block w-full rounded-2xl border border-[#D4E4BC] bg-white p-4 text-left transition hover:border-[#2D5A3D] hover:bg-[#F5F1E8]/50 hover:shadow-sm"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 text-sm font-bold text-[#2D5A3D]">
                  <span>{f.parentName}</span>
                  <span className="font-mono text-[12px] font-normal text-[#6B6560]">
                    {formatPhone(f.parentPhone)}
                  </span>
                  {f.status !== "ACTIVE" && (
                    <span className="rounded-full bg-rose-100 px-1.5 py-0.5 text-[10px] font-bold text-rose-700">
                      {f.status}
                    </span>
                  )}
                </p>
                <p className="mt-1 text-[11px] text-[#8B7F75]">
                  가입 {formatDate(f.createdAt)}
                  {" · "}
                  <AcornIcon size={10} className="align-[-0.1em]" />{" "}
                  {f.acornBalance.toLocaleString("ko-KR")}
                  {f.lastActivityAt && (
                    <>
                      {" · "}최근 활동 {formatDate(f.lastActivityAt)}
                    </>
                  )}
                  {f.submissionCount > 0 && (
                    <>
                      {" · "}제출 {f.submissionCount}건
                    </>
                  )}
                </p>
              </div>
              <span className="shrink-0 text-[#8B7F75]">›</span>
            </div>

            {f.children.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {f.children.map((c) => (
                  <span
                    key={c.id}
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                      c.isEnrolled
                        ? "border border-emerald-300 bg-emerald-50 text-emerald-800"
                        : "border border-[#D4E4BC] bg-[#F5F1E8] text-[#6B6560]"
                    }`}
                  >
                    {c.className && (
                      <span className="font-bold">{c.className}</span>
                    )}
                    <span>{c.name}</span>
                    {c.birthDate && (
                      <span className="text-[10px] text-[#8B7F75]">
                        {calcAge(c.birthDate)}
                      </span>
                    )}
                  </span>
                ))}
              </div>
            )}
          </button>
        </li>
      ))}
    </ul>
  );
}

/* -------------------------------------------------------------------------- */
/* Child list — 자녀 단위 리스트                                                */
/* -------------------------------------------------------------------------- */

type ChildRow = {
  childId: string;
  childName: string;
  className: string | null;
  isEnrolled: boolean;
  birthDate: string | null;
  parentName: string;
  parentPhone: string;
  userId: string;
};

function ChildList({
  rows,
  onOpen,
}: {
  rows: ChildRow[];
  onOpen: (userId: string) => void;
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-[#D4E4BC] bg-white p-8 text-center text-sm text-[#6B6560]">
        조건에 맞는 자녀가 없어요
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-2xl border border-[#D4E4BC] bg-white">
      <table className="w-full text-sm">
        <thead className="bg-[#F5F1E8] text-[#6B6560]">
          <tr className="text-left">
            <th className="px-3 py-2 text-[11px] font-bold">반</th>
            <th className="px-3 py-2 text-[11px] font-bold">자녀</th>
            <th className="px-3 py-2 text-[11px] font-bold">나이</th>
            <th className="px-3 py-2 text-[11px] font-bold">원생</th>
            <th className="px-3 py-2 text-[11px] font-bold">보호자</th>
            <th className="px-3 py-2 text-[11px] font-bold">연락처</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#D4E4BC]/60">
          {rows.map((r) => (
            <tr
              key={r.childId}
              onClick={() => onOpen(r.userId)}
              className="cursor-pointer transition hover:bg-[#F5F1E8]/40"
            >
              <td className="px-3 py-2 text-[12px] font-bold text-[#2D5A3D]">
                {r.className ?? "-"}
              </td>
              <td className="px-3 py-2 text-[12px] font-bold">{r.childName}</td>
              <td className="px-3 py-2 text-[11px] text-[#6B6560]">
                {calcAge(r.birthDate)}
              </td>
              <td className="px-3 py-2">
                {r.isEnrolled ? (
                  <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800">
                    원생
                  </span>
                ) : (
                  <span className="text-[11px] text-[#8B7F75]">-</span>
                )}
              </td>
              <td className="px-3 py-2 text-[12px]">{r.parentName}</td>
              <td className="px-3 py-2 font-mono text-[11px] text-[#6B6560]">
                {formatPhone(r.parentPhone)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
