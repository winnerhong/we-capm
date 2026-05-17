// server-only: 가족 명단 CSV 직렬화 헬퍼.
// admin/org route 가 같은 로직으로 호출.

import "server-only";
import type {
  OrgMemberChild,
  OrgMemberFamily,
} from "@/lib/org-members/queries";

export type CsvViewMode = "family" | "child";

export interface CsvFilters {
  search: string;
  className: string | null;
  enrolledOnly: boolean;
}

function calcAge(birthDate: string | null): string {
  if (!birthDate) return "";
  try {
    const b = new Date(birthDate);
    const now = new Date();
    let age = now.getFullYear() - b.getFullYear();
    const m = now.getMonth() - b.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age -= 1;
    return String(age);
  } catch {
    return "";
  }
}

function formatPhone(raw: string): string {
  const d = raw.replace(/\D/g, "");
  if (d.length === 11) return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
  return raw;
}

function formatDate(iso: string | null): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("ko-KR");
  } catch {
    return "";
  }
}

/** CSV 필드 quoting — 쉼표/줄바꿈/따옴표 안전. */
function csvField(v: unknown): string {
  const s = v == null ? "" : String(v);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function joinRow(cells: unknown[]): string {
  return cells.map(csvField).join(",");
}

/**
 * 필터 적용된 가족 목록 → CSV 문자열.
 *  - family 뷰: 한 줄 = 한 가족, 자녀 ; 구분
 *  - child 뷰 : 한 줄 = 한 자녀
 *  - UTF-8 BOM prefix 로 Excel 한글 깨짐 방지.
 */
export function buildMembersCsv(
  families: OrgMemberFamily[],
  view: CsvViewMode,
  filters: CsvFilters
): string {
  const q = filters.search.trim().toLowerCase();
  const qDigits = q.replace(/\D/g, "");

  const filtered = families.filter((f) => {
    if (q) {
      const phone = f.parentPhone.replace(/\D/g, "");
      const matchesParent =
        f.parentName.toLowerCase().includes(q) ||
        (qDigits && phone.includes(qDigits));
      const matchesChild = f.children.some((c) =>
        c.name.toLowerCase().includes(q)
      );
      if (!matchesParent && !matchesChild) return false;
    }
    if (filters.className) {
      if (!f.children.some((c) => c.className === filters.className))
        return false;
    }
    if (filters.enrolledOnly) {
      if (!f.children.some((c) => c.isEnrolled)) return false;
    }
    return true;
  });

  const BOM = "﻿";
  const lines: string[] = [];

  if (view === "child") {
    lines.push(
      joinRow([
        "반",
        "자녀 이름",
        "생일",
        "만 나이",
        "원생 여부",
        "보호자",
        "연락처",
        "가입일",
      ])
    );
    for (const f of filtered) {
      const childPool = applyChildFilters(f.children, filters);
      for (const c of childPool) {
        lines.push(
          joinRow([
            c.className ?? "",
            c.name,
            c.birthDate ?? "",
            calcAge(c.birthDate),
            c.isEnrolled ? "원생" : "",
            f.parentName,
            formatPhone(f.parentPhone),
            formatDate(f.createdAt),
          ])
        );
      }
    }
  } else {
    lines.push(
      joinRow([
        "보호자",
        "연락처",
        "자녀 수",
        "자녀 정보",
        "원생 수",
        "도토리",
        "가입일",
        "최근 활동일",
        "누적 제출",
      ])
    );
    for (const f of filtered) {
      const childPool = applyChildFilters(f.children, filters);
      const enrolledN = childPool.filter((c) => c.isEnrolled).length;
      const childInfo = childPool
        .map((c) => {
          const parts: string[] = [];
          if (c.className) parts.push(c.className);
          parts.push(c.name);
          const age = calcAge(c.birthDate);
          if (age) parts.push(`만${age}세`);
          if (c.isEnrolled) parts.push("원생");
          return parts.join(" ");
        })
        .join("; ");
      lines.push(
        joinRow([
          f.parentName,
          formatPhone(f.parentPhone),
          childPool.length,
          childInfo,
          enrolledN,
          f.acornBalance,
          formatDate(f.createdAt),
          formatDate(f.lastActivityAt),
          f.submissionCount,
        ])
      );
    }
  }

  return BOM + lines.join("\r\n");
}

function applyChildFilters(
  children: OrgMemberChild[],
  filters: CsvFilters
): OrgMemberChild[] {
  return children.filter((c) => {
    if (filters.className && c.className !== filters.className) return false;
    if (filters.enrolledOnly && !c.isEnrolled) return false;
    return true;
  });
}

export function parseCsvFilters(searchParams: URLSearchParams): {
  view: CsvViewMode;
  filters: CsvFilters;
} {
  const viewRaw = searchParams.get("view");
  const view: CsvViewMode = viewRaw === "child" ? "child" : "family";
  return {
    view,
    filters: {
      search: searchParams.get("q") ?? "",
      className: searchParams.get("class") || null,
      enrolledOnly: searchParams.get("enrolled") === "1",
    },
  };
}
