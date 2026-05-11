"use client";

import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type ClipboardEvent,
} from "react";

// 튜플 순서: [반, 원생명, 학부모연락처] — 전체 UI/CSV 정렬 통일.
const EXAMPLE_ROWS: Array<[string, string, string]> = [
  ["토끼반", "홍길동", "01012341234"],
  ["곰반", "홍길순", "01012344567"],
];

const INITIAL_ROW_COUNT = 5;

type GridRow = { id: string; name: string; phone: string; className: string };

function newRowId(): string {
  return Math.random().toString(36).slice(2, 8);
}

function makeEmptyRows(n: number): GridRow[] {
  return Array.from({ length: n }, () => ({
    id: newRowId(),
    name: "",
    phone: "",
    className: "",
  }));
}

/** 한 줄을 tab/comma/whitespace 로 split */
function splitLineCells(line: string): string[] {
  if (line.includes("\t")) return line.split("\t").map((c) => c.trim());
  if (line.includes(",")) return line.split(",").map((c) => c.trim());
  return line.trim().split(/\s+/);
}

/** CSV 셀 이스케이프 — 콤마/따옴표/줄바꿈이 있으면 따옴표로 감싸기 */
function csvCell(v: string): string {
  if (v.includes(",") || v.includes('"') || v.includes("\n")) {
    return `"${v.replace(/"/g, '""')}"`;
  }
  return v;
}

/** 그리드 rows → 서버가 받는 CSV 문자열 (헤더 포함, 반→원생명→연락처 순) */
function rowsToCsv(rows: GridRow[]): string {
  const valid = rows.filter(
    (r) => r.name.trim().length > 0 && r.phone.replace(/\D/g, "").length > 0
  );
  if (valid.length === 0) return "";
  const lines = ["반,원생명,학부모연락처"];
  for (const r of valid) {
    lines.push(
      [
        csvCell(r.className.trim()),
        csvCell(r.name.trim()),
        csvCell(r.phone.trim()),
      ].join(",")
    );
  }
  return lines.join("\n");
}

const HEADER_KEYWORDS = [
  "원생명",
  "원생이름",
  "학생이름",
  "아동이름",
  "아이이름",
  "자녀이름",
  "이름",
  "학부모연락처",
  "학부모전화",
  "부모연락처",
  "부모전화",
  "연락처",
  "핸드폰",
  "전화번호",
  "전화",
  "반",
  "반명",
  "학급",
  "학반",
];

const CLASS_KEYWORDS = ["반", "반명", "학급", "학반"];

function detectClassColumnIdx(headerCols: string[]): number {
  for (let i = 0; i < headerCols.length; i++) {
    const c = headerCols[i].trim();
    if (CLASS_KEYWORDS.some((k) => c === k || c.includes(k))) return i;
  }
  return -1;
}

/** 첫 줄이 헤더처럼 보이는지 — 2칸 이상 + 헤더 키워드 포함 시만 true */
function isHeaderRow(cols: string[]): boolean {
  if (cols.length < 2) return false; // 1칸만 있으면 항상 데이터로 간주
  return cols.some((c) =>
    HEADER_KEYWORDS.some((k) => c.trim().includes(k))
  );
}

/** 헤더 컬럼에서 "이름/원생명" 또는 "연락처" 위치 찾기 */
function detectNameColumnIdx(headerCols: string[]): number {
  const kw = [
    "원생명",
    "원생이름",
    "학생이름",
    "아동이름",
    "아이이름",
    "자녀이름",
    "이름",
  ];
  for (let i = 0; i < headerCols.length; i++) {
    const c = headerCols[i].trim();
    if (kw.some((k) => c === k || c.includes(k))) return i;
  }
  return -1;
}

function detectPhoneColumnIdx(headerCols: string[]): number {
  const kw = [
    "학부모연락처",
    "학부모전화",
    "부모연락처",
    "부모전화",
    "연락처",
    "핸드폰",
    "전화번호",
    "전화",
  ];
  for (let i = 0; i < headerCols.length; i++) {
    const c = headerCols[i].trim();
    if (kw.some((k) => c === k || c.includes(k))) return i;
  }
  return -1;
}

/**
 * 파일/복붙 텍스트 → 그리드 rows.
 * 헤더가 있으면 컬럼명으로 매핑 (구버전 "원생명,학부모연락처,반" 데이터도 정상 import).
 * 헤더가 없으면 canonical 순서(반→원생명→연락처) 가정. 단, 3열이 아닐 때는
 * 첫 셀의 패턴으로 추정 — 숫자 위주면 phone 로 본다 (legacy "원생명,학부모연락처").
 */
function textToRows(text: string): GridRow[] {
  const cleaned = text.replace(/^﻿/, "");
  const lines = cleaned.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) return [];

  const firstCols = splitLineCells(lines[0]);
  const hasHeader = isHeaderRow(firstCols);
  const dataLines = hasHeader ? lines.slice(1) : lines;

  let classIdx: number;
  let nameIdx: number;
  let phoneIdx: number;

  if (hasHeader) {
    classIdx = detectClassColumnIdx(firstCols);
    nameIdx = detectNameColumnIdx(firstCols);
    phoneIdx = detectPhoneColumnIdx(firstCols);
    // 폴백 — 헤더에 있지만 키워드 안 잡힐 경우
    if (nameIdx < 0) nameIdx = classIdx >= 0 && classIdx === 0 ? 1 : 0;
    if (phoneIdx < 0) phoneIdx = nameIdx + 1;
  } else {
    // 헤더 없음 — canonical 순서 (반, 원생명, 연락처) 가정
    // 단 2열이면 legacy 형식 (원생명, 연락처) 으로 처리
    if (firstCols.length >= 3) {
      classIdx = 0;
      nameIdx = 1;
      phoneIdx = 2;
    } else {
      classIdx = -1;
      nameIdx = 0;
      phoneIdx = 1;
    }
  }

  return dataLines.map((l) => {
    const cols = splitLineCells(l);
    return {
      id: newRowId(),
      name: cols[nameIdx] ?? "",
      phone: cols[phoneIdx] ?? "",
      className: classIdx >= 0 ? (cols[classIdx] ?? "") : "",
    };
  });
}

export function BulkImportForm({
  action,
}: {
  orgId: string;
  action: (formData: FormData) => void | Promise<void>;
}) {
  const [rows, setRows] = useState<GridRow[]>(() =>
    makeEmptyRows(INITIAL_ROW_COUNT)
  );
  const [copied, setCopied] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const csvValue = useMemo(() => rowsToCsv(rows), [rows]);

  const validCount = useMemo(
    () =>
      rows.filter(
        (r) =>
          r.name.trim().length > 0 && r.phone.replace(/\D/g, "").length > 0
      ).length,
    [rows]
  );

  const uniquePhones = useMemo(() => {
    const s = new Set<string>();
    for (const r of rows) {
      const digits = r.phone.replace(/\D/g, "");
      if (digits && r.name.trim()) s.add(digits);
    }
    return s.size;
  }, [rows]);

  const updateCell = useCallback(
    (id: string, key: "name" | "phone" | "className", value: string) => {
      setRows((prev) =>
        prev.map((r) => (r.id === id ? { ...r, [key]: value } : r))
      );
    },
    []
  );

  const addRow = useCallback(() => {
    setRows((prev) => [
      ...prev,
      { id: newRowId(), name: "", phone: "", className: "" },
    ]);
  }, []);

  const addRows = useCallback((n: number) => {
    setRows((prev) => [...prev, ...makeEmptyRows(n)]);
  }, []);

  const removeRow = useCallback((id: string) => {
    setRows((prev) => {
      const next = prev.filter((r) => r.id !== id);
      return next.length === 0 ? makeEmptyRows(1) : next;
    });
  }, []);

  const clearAll = useCallback(() => {
    setRows(makeEmptyRows(INITIAL_ROW_COUNT));
  }, []);

  /** 엑셀에서 복붙 시 셀이 여러 줄/열로 들어오면 자동 분산 */
  const handlePaste = useCallback(
    (
      e: ClipboardEvent<HTMLInputElement>,
      rowIdx: number,
      col: "name" | "phone" | "className"
    ) => {
      const clip = e.clipboardData.getData("text/plain") ?? "";
      // 단일 셀 복붙이면 기본 동작 허용
      if (!clip.includes("\n") && !clip.includes("\t") && !clip.includes(",")) {
        return;
      }
      e.preventDefault();

      const parsed = textToRows(clip);
      if (parsed.length === 0) return;

      // 붙여넣은 데이터가 1칸짜리(= phone/className 둘 다 비어있음)인지 감지
      const isSingleColumnPaste = parsed.every(
        (r) => !r.phone && !r.className
      );

      setRows((prev) => {
        const next = [...prev];
        for (let i = 0; i < parsed.length; i++) {
          const targetIdx = rowIdx + i;
          // 필요하면 빈 행 추가
          while (next.length <= targetIdx) {
            next.push({
              id: newRowId(),
              name: "",
              phone: "",
              className: "",
            });
          }

          if (isSingleColumnPaste) {
            // 단일 컬럼 복붙 — 시작 셀의 열에만 값을 채우고 다른 열은 보존
            next[targetIdx] = {
              ...next[targetIdx],
              [col]: parsed[i].name,
            };
          } else {
            // 2칸 이상 복붙 — name+phone+className 모두 교체
            next[targetIdx] = {
              ...next[targetIdx],
              name: parsed[i].name,
              phone: parsed[i].phone,
              className: parsed[i].className,
            };
          }
        }
        return next;
      });
    },
    []
  );

  const downloadExample = useCallback(() => {
    const rows = ["반,원생명,학부모연락처"];
    for (const [c, n, p] of EXAMPLE_ROWS) {
      rows.push(`${c},${n},${p}`);
    }
    const csv = rows.join("\n") + "\n";
    // UTF-8 BOM 포함 (Excel 한글 호환)
    const blob = new Blob(["﻿" + csv], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "참가자_일괄등록_예시.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, []);

  const handleFile = useCallback(async (file: File) => {
    const nm = file.name.toLowerCase();
    if (nm.endsWith(".xlsx") || nm.endsWith(".xls")) {
      alert(
        "엑셀 파일은 업로드할 수 없어요. 엑셀에서 '다른 이름으로 저장 → CSV UTF-8'로 저장 후 업로드해 주세요."
      );
      return;
    }
    if (!nm.endsWith(".csv") && !nm.endsWith(".txt")) {
      alert("CSV 파일만 업로드 가능해요");
      return;
    }
    try {
      const text = await file.text();
      const parsed = textToRows(text);
      if (parsed.length === 0) {
        alert("파일에서 데이터를 찾지 못했어요");
        return;
      }
      setRows(parsed);
    } catch {
      alert("파일을 읽는 중 오류가 발생했어요");
    }
  }, []);

  const copyExample = useCallback(async () => {
    const example = EXAMPLE_ROWS.map(([c, n, p]) => `${c}\t${n}\t${p}`).join(
      "\n"
    );
    try {
      await navigator.clipboard.writeText(example);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // noop
    }
  }, []);

  const cellBase =
    "block w-full border-0 bg-white px-2 py-2 text-xs text-[#2C2C2C] outline-none focus:bg-[#FFFBF0] focus:ring-2 focus:ring-inset focus:ring-[#3A7A52]/30";

  return (
    <div className="space-y-5">
      <form
        ref={formRef}
        action={action}
        onSubmit={() => setSubmitting(true)}
        className="space-y-4 rounded-3xl border border-[#D4E4BC] bg-white p-5 shadow-sm md:p-6"
      >
        {/* 1) 파일 업로드 */}
        <div>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <label
              htmlFor="csv-file"
              className="text-sm font-semibold text-[#2D5A3D]"
            >
              1) 파일 업로드 (선택)
            </label>
            <button
              type="button"
              onClick={downloadExample}
              className="inline-flex items-center gap-1 rounded-lg border border-[#D4E4BC] bg-white px-3 py-1.5 text-xs font-semibold text-[#2D5A3D] hover:bg-[#E8F0E4]"
              title="예시 CSV 파일 다운로드 (엑셀에서 열어 편집 후 재업로드)"
            >
              <span aria-hidden>📥</span>
              <span>예시엑셀 다운</span>
            </button>
          </div>
          <input
            id="csv-file"
            type="file"
            accept=".csv,.txt"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleFile(f);
            }}
            className="block w-full text-sm text-[#6B6560] file:mr-3 file:rounded-lg file:border-0 file:bg-[#E8F0E4] file:px-3 file:py-2 file:text-xs file:font-semibold file:text-[#2D5A3D] hover:file:bg-[#D4E4BC]"
          />
          <p className="mt-1 text-[11px] text-[#8B7F75]">
            CSV 업로드 시 아래 표에 자동으로 채워져요
          </p>
        </div>

        {/* 2) 엑셀 시트 입력 */}
        <div>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <label className="text-sm font-semibold text-[#2D5A3D]">
              2) 엑셀 시트 붙여넣기
            </label>
            <button
              type="button"
              onClick={copyExample}
              className="rounded-lg border border-[#E5D3B8] bg-white px-3 py-1.5 text-xs font-semibold text-[#6B4423] hover:bg-[#FAE7D0]"
            >
              {copied ? "✓ 복사됨" : "📋 예시 복사"}
            </button>
          </div>

          <p className="mb-2 text-[11px] text-[#6B6560]">
            💡 엑셀에서 3열(반·원생명·연락처)을 복사해 첫 번째 칸에 붙여넣으면
            자동으로 퍼져요. <b>반</b>은 선택입력이며 토리톡 활성화 기관은 반
            채팅방에 자동 참여돼요.
          </p>

          {/* Excel-like grid — 반 / 원생명 / 학부모연락처 순 */}
          <div className="overflow-hidden rounded-xl border border-[#D4E4BC] bg-[#F4EFE8]">
            {/* 헤더 */}
            <div className="grid grid-cols-[36px_0.8fr_1fr_1fr_36px] border-b-2 border-[#D4E4BC] bg-[#E8F0E4] text-[11px] font-bold text-[#2D5A3D]">
              <div className="border-r border-[#D4E4BC] px-2 py-2 text-center">
                #
              </div>
              <div className="border-r border-[#D4E4BC] px-2 py-2">
                🐰 반 (선택)
              </div>
              <div className="border-r border-[#D4E4BC] px-2 py-2">
                🎒 원생명
              </div>
              <div className="border-r border-[#D4E4BC] px-2 py-2">
                📞 학부모연락처
              </div>
              <div className="px-2 py-2 text-center" aria-hidden>
                ×
              </div>
            </div>

            {/* 데이터 행 */}
            {rows.map((r, idx) => (
              <div
                key={r.id}
                className="grid grid-cols-[36px_0.8fr_1fr_1fr_36px] border-b border-[#E8E0D0] bg-white"
              >
                <div className="flex items-center justify-center border-r border-[#E8E0D0] bg-[#FFFDF8] px-2 text-[11px] font-mono text-[#8B7F75]">
                  {idx + 1}
                </div>
                <input
                  type="text"
                  value={r.className}
                  onChange={(e) =>
                    updateCell(r.id, "className", e.target.value)
                  }
                  onPaste={(e) => handlePaste(e, idx, "className")}
                  placeholder="토끼반"
                  autoComplete="off"
                  maxLength={40}
                  className={`${cellBase} border-r border-[#E8E0D0]`}
                />
                <input
                  type="text"
                  value={r.name}
                  onChange={(e) => updateCell(r.id, "name", e.target.value)}
                  onPaste={(e) => handlePaste(e, idx, "name")}
                  placeholder="홍길동"
                  autoComplete="off"
                  className={`${cellBase} border-r border-[#E8E0D0]`}
                />
                <input
                  type="tel"
                  inputMode="numeric"
                  value={r.phone}
                  onChange={(e) => updateCell(r.id, "phone", e.target.value)}
                  onPaste={(e) => handlePaste(e, idx, "phone")}
                  placeholder="01012345678"
                  autoComplete="off"
                  className={`${cellBase} border-r border-[#E8E0D0] font-mono`}
                />
                <button
                  type="button"
                  onClick={() => removeRow(r.id)}
                  aria-label={`${idx + 1}번 행 삭제`}
                  className="flex items-center justify-center bg-white text-sm text-rose-400 transition hover:bg-rose-50 hover:text-rose-700"
                >
                  ×
                </button>
              </div>
            ))}

            {/* 추가 버튼 */}
            <div className="flex flex-wrap gap-2 bg-white p-2">
              <button
                type="button"
                onClick={addRow}
                className="rounded-md border border-dashed border-[#2D5A3D] bg-white px-3 py-1 text-xs font-semibold text-[#2D5A3D] hover:bg-[#F5F1E8]"
              >
                + 행 추가
              </button>
              <button
                type="button"
                onClick={() => addRows(10)}
                className="rounded-md border border-dashed border-[#D4E4BC] bg-white px-3 py-1 text-xs font-semibold text-[#6B6560] hover:bg-[#F5F1E8]"
              >
                + 10행
              </button>
            </div>
          </div>
        </div>

        {/* 서버액션으로 보낼 CSV (hidden) */}
        <input type="hidden" name="csv" value={csvValue} />

        {/* 액션 바 */}
        <div className="flex flex-col gap-2 border-t border-[#D4E4BC] pt-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-[11px] text-[#8B7F75]">
            {validCount > 0
              ? `등록 대상: 고유 번호 ${uniquePhones.toLocaleString(
                  "ko-KR"
                )}명 · 행 ${validCount.toLocaleString("ko-KR")}건`
              : "입력된 데이터가 없어요"}
          </div>
          <div className="flex gap-2 sm:ml-auto">
            <button
              type="button"
              onClick={clearAll}
              disabled={submitting || validCount === 0}
              className="rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] px-4 py-2.5 text-sm font-semibold text-[#6B6560] hover:bg-[#F0EBE3] disabled:cursor-not-allowed disabled:opacity-50"
            >
              전체 비우기
            </button>
            <button
              type="submit"
              disabled={submitting || uniquePhones === 0}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-[#2D5A3D] to-[#3A7A52] px-5 py-2.5 text-sm font-bold text-white shadow-md hover:from-[#234a30] hover:to-[#2D5A3D] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <span aria-hidden>⏳</span>
                  <span>등록 중...</span>
                </>
              ) : (
                <>
                  <span aria-hidden>🌱</span>
                  <span>
                    {uniquePhones.toLocaleString("ko-KR")}명 일괄 등록
                  </span>
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
