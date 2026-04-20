"use client";

import { Suspense, useMemo, useState, useTransition, useCallback, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { parseCSV } from "@/lib/crm/bulk-import";
import {
  bulkImportAction,
  type BulkImportResult,
  type ImportStrategy,
  type ImportType,
} from "./actions";

const TYPE_META: Record<
  ImportType,
  {
    label: string;
    icon: string;
    desc: string;
    headers: string[];
    required: string[];
    dupKey: string;
  }
> = {
  ORG: {
    label: "기관",
    icon: "🏫",
    desc: "어린이집·유치원·학교 등 기관을 일괄 등록",
    headers: [
      "기관명*",
      "기관유형",
      "대표자*",
      "대표전화*",
      "이메일",
      "주소",
      "아동수",
      "학급수",
      "사업자등록번호",
    ],
    required: ["기관명*", "대표자*", "대표전화*"],
    dupKey: "기관명",
  },
  CUSTOMER: {
    label: "개인",
    icon: "👨‍👩‍👧",
    desc: "부모·개인 고객을 일괄 등록",
    headers: [
      "보호자이름*",
      "보호자전화*",
      "이메일",
      "주소",
      "아이이름",
      "아이나이",
      "관심사",
    ],
    required: ["보호자이름*", "보호자전화*"],
    dupKey: "보호자전화",
  },
  COMPANY: {
    label: "기업",
    icon: "🏢",
    desc: "B2B 기업 고객을 일괄 등록",
    headers: [
      "회사명*",
      "사업자등록번호*",
      "대표자*",
      "대표전화",
      "회사이메일",
      "업종",
      "직원수",
      "담당자이름",
      "담당자연락처",
    ],
    required: ["회사명*", "사업자등록번호*", "대표자*"],
    dupKey: "사업자등록번호",
  },
};

const STEPS = [
  "유형 선택",
  "템플릿·업로드",
  "매핑 확인",
  "검증 결과",
  "미리보기",
  "결과",
];

type RowError = { row: number; reason: string; data?: Record<string, string> };

type Validation = {
  valid: Record<string, string>[];
  duplicates: Record<string, string>[];
  errors: RowError[];
};

export default function BulkImportPage() {
  return (
    <Suspense fallback={<div className="py-8 text-center text-[#6B6560]">불러오는 중…</div>}>
      <BulkImportWizard />
    </Suspense>
  );
}

function BulkImportWizard() {
  const searchParams = useSearchParams();
  const initialType = (searchParams.get("type") as ImportType | null) ?? null;

  const [step, setStep] = useState(initialType ? 2 : 1);
  const [type, setType] = useState<ImportType | null>(initialType);
  const [fileName, setFileName] = useState<string | null>(null);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [dragOver, setDragOver] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [validation, setValidation] = useState<Validation | null>(null);
  const [strategy, setStrategy] = useState<ImportStrategy>("SKIP");
  const [result, setResult] = useState<BulkImportResult | null>(null);
  const [showErrorDetail, setShowErrorDetail] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Auto-match headers when rows are loaded
  useEffect(() => {
    if (!type || headers.length === 0) return;
    const meta = TYPE_META[type];
    const initialMap: Record<string, string> = {};
    for (const target of meta.headers) {
      const stripped = target.replace(/\*$/, "").trim();
      const match = headers.find((h) => {
        const hs = h.replace(/\*$/, "").trim();
        return hs === stripped || hs === target;
      });
      if (match) initialMap[target] = match;
    }
    setMapping(initialMap);
  }, [headers, type]);

  const handleFile = useCallback(
    async (file: File) => {
      setParseError(null);
      setFileName(file.name);
      const lower = file.name.toLowerCase();
      if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) {
        setParseError(
          "엑셀 파일(.xlsx)은 직접 업로드할 수 없습니다. 엑셀에서 '다른 이름으로 저장 → CSV UTF-8'로 저장 후 업로드해 주세요."
        );
        setRows([]);
        setHeaders([]);
        return;
      }
      if (!lower.endsWith(".csv")) {
        setParseError("CSV 파일만 업로드 가능합니다.");
        return;
      }
      try {
        const text = await file.text();
        const parsed = parseCSV(text);
        if (parsed.length === 0) {
          setParseError("빈 파일이거나 헤더만 있습니다.");
          setRows([]);
          setHeaders([]);
          return;
        }
        setRows(parsed);
        setHeaders(Object.keys(parsed[0]));
      } catch (e) {
        setParseError(e instanceof Error ? e.message : "파싱 실패");
      }
    },
    []
  );

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLLabelElement>) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files?.[0];
      if (file) void handleFile(file);
    },
    [handleFile]
  );

  // Run local validation once mapping is confirmed
  const runValidation = useCallback(() => {
    if (!type) return;
    const meta = TYPE_META[type];
    const result: Validation = { valid: [], duplicates: [], errors: [] };
    const seen = new Map<string, number>(); // dupKey -> first row index

    for (let i = 0; i < rows.length; i++) {
      const src = rows[i];
      // Apply mapping → produce a row keyed by target headers
      const remapped: Record<string, string> = {};
      for (const target of meta.headers) {
        const sourceKey = mapping[target];
        if (sourceKey) remapped[target] = (src[sourceKey] ?? "").trim();
        else remapped[target] = (src[target] ?? "").trim();
      }

      const rowNum = i + 2;
      const missing = meta.required.filter((r) => !remapped[r]?.trim());
      if (missing.length > 0) {
        result.errors.push({
          row: rowNum,
          reason: `필수 항목 누락: ${missing.map((m) => m.replace(/\*$/, "")).join(", ")}`,
          data: remapped,
        });
        continue;
      }

      // Simple format validation (phone / biz number) for clearer previews
      const phoneField =
        type === "ORG"
          ? "대표전화*"
          : type === "CUSTOMER"
          ? "보호자전화*"
          : "대표전화";
      const phoneRaw = remapped[phoneField] ?? "";
      if (phoneRaw && !/^01\d{1}-?\d{3,4}-?\d{4}$|^0\d{1,2}-?\d{3,4}-?\d{4}$/.test(phoneRaw.replace(/\s/g, ""))) {
        // Note: the server re-validates with stricter rules
      }

      // Duplicate detection within the file (same dup key)
      const dupValue =
        type === "ORG"
          ? remapped["기관명*"]
          : type === "CUSTOMER"
          ? remapped["보호자전화*"]
          : remapped["사업자등록번호*"];

      if (dupValue && seen.has(dupValue)) {
        result.duplicates.push(remapped);
        continue;
      }
      if (dupValue) seen.set(dupValue, i);

      result.valid.push(remapped);
    }
    setValidation(result);
  }, [mapping, rows, type]);

  const runImport = useCallback(() => {
    if (!type || !validation) return;
    // Build final row list based on strategy
    const finalRows =
      strategy === "UPDATE"
        ? [...validation.valid, ...validation.duplicates]
        : validation.valid;

    startTransition(async () => {
      try {
        const r = await bulkImportAction(type, finalRows, strategy, fileName);
        setResult(r);
        setStep(6);
      } catch (e) {
        setResult({
          success: 0,
          skipped: 0,
          updated: 0,
          errors: [
            {
              row: 0,
              reason: e instanceof Error ? e.message : "서버 오류",
            },
          ],
        });
        setStep(6);
      }
    });
  }, [fileName, strategy, type, validation]);

  const downloadErrorCsv = useCallback(() => {
    if (!result || result.errors.length === 0) return;
    const BOM = "\ufeff";
    const headers = ["행", "오류사유", "원본데이터"];
    const lines = [headers.join(",")];
    for (const err of result.errors) {
      const data = err.data ? JSON.stringify(err.data).replace(/"/g, '""') : "";
      lines.push(`${err.row},"${err.reason.replace(/"/g, '""')}","${data}"`);
    }
    const blob = new Blob([BOM + lines.join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `토리로_일괄등록_오류_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [result]);

  const reset = useCallback(() => {
    setStep(1);
    setType(null);
    setFileName(null);
    setRows([]);
    setHeaders([]);
    setMapping({});
    setValidation(null);
    setResult(null);
    setParseError(null);
  }, []);

  return (
    <div className="mx-auto max-w-4xl">
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/partner/dashboard"
          className="text-sm text-[#6B6560] hover:text-[#2D5A3D]"
        >
          ← 대시보드로
        </Link>
        <div className="mt-2 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-[#2D5A3D] md:text-3xl">
            🌿 고객 일괄 등록
          </h1>
          <Link
            href="/partner/customers/bulk-import/history"
            className="rounded-lg border border-[#D4E4BC] bg-white px-3 py-1.5 text-xs text-[#2D5A3D] hover:bg-[#F4FBE8]"
          >
            📜 등록 이력
          </Link>
        </div>
        <p className="mt-1 text-sm text-[#6B6560]">
          CSV로 기관·개인·기업 고객을 한 번에 수십 건씩 등록하세요.
        </p>
      </div>

      {/* Stepper */}
      <Stepper current={step} />

      {/* Step content */}
      <div className="mt-6 rounded-2xl border border-[#D4E4BC] bg-white p-5 shadow-sm md:p-6">
        {step === 1 && (
          <StepType
            onSelect={(t) => {
              setType(t);
              setStep(2);
            }}
          />
        )}
        {step === 2 && type && (
          <StepUpload
            type={type}
            fileName={fileName}
            rows={rows}
            dragOver={dragOver}
            setDragOver={setDragOver}
            onDrop={onDrop}
            onFile={handleFile}
            parseError={parseError}
            onBack={() => setStep(1)}
            onNext={() => setStep(3)}
          />
        )}
        {step === 3 && type && (
          <StepMapping
            type={type}
            headers={headers}
            mapping={mapping}
            setMapping={setMapping}
            onBack={() => setStep(2)}
            onNext={() => {
              runValidation();
              setStep(4);
            }}
          />
        )}
        {step === 4 && validation && type && (
          <StepValidation
            type={type}
            validation={validation}
            showDetail={showErrorDetail}
            setShowDetail={setShowErrorDetail}
            onBack={() => setStep(3)}
            onNext={() => setStep(5)}
          />
        )}
        {step === 5 && validation && type && (
          <StepPreview
            type={type}
            validation={validation}
            strategy={strategy}
            setStrategy={setStrategy}
            isPending={isPending}
            onBack={() => setStep(4)}
            onSubmit={runImport}
          />
        )}
        {step === 6 && result && (
          <StepResult
            result={result}
            onDownloadErrors={downloadErrorCsv}
            onReset={reset}
          />
        )}
      </div>
    </div>
  );
}

/* ---------- Stepper ---------- */
function Stepper({ current }: { current: number }) {
  return (
    <div className="overflow-x-auto">
      <ol className="flex min-w-max items-center gap-2 md:gap-3">
        {STEPS.map((label, idx) => {
          const n = idx + 1;
          const active = n === current;
          const done = n < current;
          return (
            <li key={label} className="flex items-center gap-2">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${
                  active
                    ? "bg-[#2D5A3D] text-white"
                    : done
                    ? "bg-[#D4E4BC] text-[#2D5A3D]"
                    : "bg-[#F4FBE8] text-[#6B6560]"
                }`}
              >
                {done ? "✓" : n}
              </div>
              <span
                className={`text-xs md:text-sm ${
                  active
                    ? "font-bold text-[#2D5A3D]"
                    : done
                    ? "text-[#2D5A3D]"
                    : "text-[#6B6560]"
                }`}
              >
                {label}
              </span>
              {n < STEPS.length && (
                <span className="mx-1 h-px w-4 bg-[#D4E4BC] md:w-8" />
              )}
            </li>
          );
        })}
      </ol>
      {/* Progress bar */}
      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-[#F4FBE8]">
        <div
          className="h-full bg-gradient-to-r from-[#C4956A] to-[#2D5A3D] transition-all"
          style={{ width: `${(current / STEPS.length) * 100}%` }}
        />
      </div>
    </div>
  );
}

/* ---------- Step 1: Type Select ---------- */
function StepType({ onSelect }: { onSelect: (t: ImportType) => void }) {
  return (
    <div>
      <h2 className="mb-4 text-lg font-bold text-[#2D5A3D]">
        어떤 유형의 고객을 등록하시나요?
      </h2>
      <div className="grid gap-3 md:grid-cols-3">
        {(Object.keys(TYPE_META) as ImportType[]).map((t) => {
          const m = TYPE_META[t];
          return (
            <button
              key={t}
              type="button"
              onClick={() => onSelect(t)}
              className="group flex flex-col items-start rounded-2xl border-2 border-[#D4E4BC] bg-[#FFF8F0] p-5 text-left transition hover:border-[#2D5A3D] hover:bg-[#F4FBE8] focus:outline-none focus:ring-2 focus:ring-[#2D5A3D]"
            >
              <div className="text-4xl">{m.icon}</div>
              <div className="mt-3 text-lg font-bold text-[#2D5A3D]">
                {m.label}
              </div>
              <div className="mt-1 text-xs text-[#6B6560]">{m.desc}</div>
              <div className="mt-3 text-xs font-medium text-[#C4956A] group-hover:text-[#2D5A3D]">
                선택 →
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- Step 2: Upload ---------- */
function StepUpload({
  type,
  fileName,
  rows,
  dragOver,
  setDragOver,
  onDrop,
  onFile,
  parseError,
  onBack,
  onNext,
}: {
  type: ImportType;
  fileName: string | null;
  rows: Record<string, string>[];
  dragOver: boolean;
  setDragOver: (v: boolean) => void;
  onDrop: (e: React.DragEvent<HTMLLabelElement>) => void;
  onFile: (f: File) => void;
  parseError: string | null;
  onBack: () => void;
  onNext: () => void;
}) {
  const m = TYPE_META[type];
  return (
    <div>
      <div className="mb-4 flex items-center gap-2 text-sm text-[#6B6560]">
        <span>선택된 유형:</span>
        <span className="rounded-full bg-[#F4FBE8] px-2 py-0.5 font-semibold text-[#2D5A3D]">
          {m.icon} {m.label}
        </span>
      </div>
      <h2 className="mb-2 text-lg font-bold text-[#2D5A3D]">
        템플릿 다운로드 후 업로드
      </h2>
      <p className="mb-4 text-sm text-[#6B6560]">
        템플릿의 헤더를 유지하고 2행부터 데이터를 입력해 저장하세요.
      </p>

      <a
        href={`/api/crm/template?type=${type}`}
        className="mb-4 inline-flex items-center gap-2 rounded-lg border border-[#C4956A] bg-[#FFF8F0] px-4 py-2 text-sm font-semibold text-[#C4956A] hover:bg-[#FBE9D4]"
        download
      >
        📄 템플릿 다운로드 ({m.label})
      </a>

      <label
        htmlFor="bulk-file"
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={`flex min-h-[180px] cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-6 text-center transition ${
          dragOver
            ? "border-[#2D5A3D] bg-[#F4FBE8]"
            : "border-[#D4E4BC] bg-[#FFF8F0] hover:border-[#2D5A3D]"
        }`}
      >
        <div className="text-4xl">🌳</div>
        <div className="mt-2 text-sm font-semibold text-[#2D5A3D]">
          {fileName ? fileName : "파일을 여기로 끌어다 놓거나 클릭해 선택"}
        </div>
        <div className="mt-1 text-xs text-[#6B6560]">
          CSV(UTF-8) 형식 권장 · 엑셀은 CSV로 저장 후 업로드
        </div>
        {rows.length > 0 && (
          <div className="mt-2 rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">
            ✓ {rows.length}행 인식됨
          </div>
        )}
        <input
          id="bulk-file"
          type="file"
          accept=".csv,.xlsx,.xls"
          className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFile(f);
          }}
        />
      </label>

      {parseError && (
        <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          ⚠️ {parseError}
        </div>
      )}

      <div className="mt-6 flex justify-between">
        <button
          type="button"
          onClick={onBack}
          className="rounded-lg border border-[#D4E4BC] bg-white px-4 py-2 text-sm text-[#6B6560] hover:bg-[#F4FBE8]"
        >
          ← 이전
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={rows.length === 0}
          className="rounded-lg bg-[#2D5A3D] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1F4030] disabled:cursor-not-allowed disabled:opacity-50"
        >
          다음: 매핑 확인 →
        </button>
      </div>
    </div>
  );
}

/* ---------- Step 3: Mapping ---------- */
function StepMapping({
  type,
  headers,
  mapping,
  setMapping,
  onBack,
  onNext,
}: {
  type: ImportType;
  headers: string[];
  mapping: Record<string, string>;
  setMapping: (m: Record<string, string>) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const meta = TYPE_META[type];
  const allRequiredMapped = meta.required.every((r) => mapping[r]);

  return (
    <div>
      <h2 className="mb-2 text-lg font-bold text-[#2D5A3D]">매핑 확인</h2>
      <p className="mb-4 text-sm text-[#6B6560]">
        업로드한 파일의 컬럼을 토리로 DB 필드에 연결합니다. 자동 매칭된 결과를
        확인하고 불일치 시 변경하세요.
      </p>

      <div className="overflow-x-auto rounded-xl border border-[#D4E4BC]">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[#F4FBE8] text-left text-xs font-semibold text-[#2D5A3D]">
              <th className="px-3 py-2">토리로 필드</th>
              <th className="px-3 py-2">엑셀 컬럼</th>
              <th className="px-3 py-2">상태</th>
            </tr>
          </thead>
          <tbody>
            {meta.headers.map((target) => {
              const isRequired = meta.required.includes(target);
              const current = mapping[target] ?? "";
              return (
                <tr key={target} className="border-t border-[#D4E4BC]">
                  <td className="px-3 py-2 font-medium text-[#2D5A3D]">
                    {target.replace(/\*$/, "")}
                    {isRequired && (
                      <span className="ml-1 text-rose-600">*</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <select
                      value={current}
                      onChange={(e) =>
                        setMapping({ ...mapping, [target]: e.target.value })
                      }
                      className="w-full rounded border border-[#D4E4BC] bg-white px-2 py-1 text-sm focus:border-[#2D5A3D] focus:outline-none focus:ring-1 focus:ring-[#2D5A3D]"
                    >
                      <option value="">(사용 안 함)</option>
                      {headers.map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {current ? (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-800">
                        ✓ 매칭
                      </span>
                    ) : isRequired ? (
                      <span className="rounded-full bg-rose-100 px-2 py-0.5 text-rose-700">
                        필수 미매칭
                      </span>
                    ) : (
                      <span className="text-[#6B6560]">선택</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-6 flex justify-between">
        <button
          type="button"
          onClick={onBack}
          className="rounded-lg border border-[#D4E4BC] bg-white px-4 py-2 text-sm text-[#6B6560] hover:bg-[#F4FBE8]"
        >
          ← 이전
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={!allRequiredMapped}
          className="rounded-lg bg-[#2D5A3D] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1F4030] disabled:cursor-not-allowed disabled:opacity-50"
        >
          다음: 검증 →
        </button>
      </div>
    </div>
  );
}

/* ---------- Step 4: Validation ---------- */
function StepValidation({
  type,
  validation,
  showDetail,
  setShowDetail,
  onBack,
  onNext,
}: {
  type: ImportType;
  validation: Validation;
  showDetail: boolean;
  setShowDetail: (v: boolean) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  return (
    <div>
      <h2 className="mb-4 text-lg font-bold text-[#2D5A3D]">검증 결과</h2>
      <div className="grid gap-3 md:grid-cols-3">
        <StatCard
          label="유효"
          count={validation.valid.length}
          tone="emerald"
          icon="✅"
        />
        <StatCard
          label="파일 내 중복"
          count={validation.duplicates.length}
          tone="amber"
          icon="⚠️"
        />
        <StatCard
          label="오류"
          count={validation.errors.length}
          tone="rose"
          icon="❌"
        />
      </div>

      {validation.errors.length > 0 && (
        <div className="mt-4">
          <button
            type="button"
            onClick={() => setShowDetail(!showDetail)}
            className="text-sm font-semibold text-[#C4956A] hover:underline"
          >
            {showDetail ? "▼" : "▶"} 오류 {validation.errors.length}건 상세
            보기
          </button>
          {showDetail && (
            <div className="mt-2 max-h-64 overflow-y-auto rounded-xl border border-rose-200 bg-rose-50/50">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-rose-100 text-left text-xs font-semibold text-rose-800">
                  <tr>
                    <th className="px-3 py-2">행</th>
                    <th className="px-3 py-2">오류 사유</th>
                  </tr>
                </thead>
                <tbody>
                  {validation.errors.map((err, i) => (
                    <tr key={i} className="border-t border-rose-200">
                      <td className="px-3 py-2 font-mono text-xs">
                        {err.row}
                      </td>
                      <td className="px-3 py-2 text-xs text-rose-700">
                        {err.reason}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <div className="mt-4 rounded-lg bg-[#F4FBE8] p-3 text-xs text-[#6B6560]">
        💡 서버에서 기존 DB와의 중복은 다음 단계에서 한 번 더 확인됩니다 (
        <strong>{TYPE_META[type].dupKey}</strong> 기준).
      </div>

      <div className="mt-6 flex justify-between">
        <button
          type="button"
          onClick={onBack}
          className="rounded-lg border border-[#D4E4BC] bg-white px-4 py-2 text-sm text-[#6B6560] hover:bg-[#F4FBE8]"
        >
          ← 이전
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={
            validation.valid.length === 0 && validation.duplicates.length === 0
          }
          className="rounded-lg bg-[#2D5A3D] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1F4030] disabled:cursor-not-allowed disabled:opacity-50"
        >
          다음: 미리보기 →
        </button>
      </div>
    </div>
  );
}

function StatCard({
  label,
  count,
  tone,
  icon,
}: {
  label: string;
  count: number;
  tone: "emerald" | "amber" | "rose";
  icon: string;
}) {
  const map = {
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-800",
    amber: "border-amber-200 bg-amber-50 text-amber-800",
    rose: "border-rose-200 bg-rose-50 text-rose-800",
  };
  return (
    <div
      className={`flex items-center justify-between rounded-xl border p-4 ${map[tone]}`}
    >
      <div>
        <div className="text-xs font-semibold">{label}</div>
        <div className="text-3xl font-bold">{count}</div>
      </div>
      <div className="text-3xl">{icon}</div>
    </div>
  );
}

/* ---------- Step 5: Preview ---------- */
function StepPreview({
  type,
  validation,
  strategy,
  setStrategy,
  isPending,
  onBack,
  onSubmit,
}: {
  type: ImportType;
  validation: Validation;
  strategy: ImportStrategy;
  setStrategy: (s: ImportStrategy) => void;
  isPending: boolean;
  onBack: () => void;
  onSubmit: () => void;
}) {
  const meta = TYPE_META[type];
  const preview = validation.valid.slice(0, 5);

  return (
    <div>
      <h2 className="mb-3 text-lg font-bold text-[#2D5A3D]">미리보기 & 확인</h2>

      <div className="overflow-x-auto rounded-xl border border-[#D4E4BC]">
        <table className="w-full text-xs md:text-sm">
          <thead className="bg-[#F4FBE8] text-left text-xs font-semibold text-[#2D5A3D]">
            <tr>
              {meta.headers.map((h) => (
                <th key={h} className="whitespace-nowrap px-3 py-2">
                  {h.replace(/\*$/, "")}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {preview.length === 0 ? (
              <tr>
                <td
                  colSpan={meta.headers.length}
                  className="px-3 py-6 text-center text-[#6B6560]"
                >
                  미리보기할 행이 없습니다.
                </td>
              </tr>
            ) : (
              preview.map((row, i) => (
                <tr key={i} className="border-t border-[#D4E4BC]">
                  {meta.headers.map((h) => (
                    <td key={h} className="whitespace-nowrap px-3 py-2">
                      {row[h] || (
                        <span className="text-[#6B6560]/60">—</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {validation.valid.length > 5 && (
        <p className="mt-2 text-xs text-[#6B6560]">
          ...외 {validation.valid.length - 5}건 (상위 5건만 표시)
        </p>
      )}

      <fieldset className="mt-5">
        <legend className="mb-2 text-sm font-semibold text-[#2D5A3D]">
          중복 데이터 처리 방식
        </legend>
        <div className="space-y-2">
          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-[#D4E4BC] bg-[#FFF8F0] p-3 hover:bg-[#F4FBE8]">
            <input
              type="radio"
              name="strategy"
              checked={strategy === "SKIP"}
              onChange={() => setStrategy("SKIP")}
              className="mt-1"
            />
            <div>
              <div className="text-sm font-semibold text-[#2D5A3D]">
                건너뛰기 (권장)
              </div>
              <div className="text-xs text-[#6B6560]">
                파일 내 중복 행과 기존 DB 중복은 제외하고 새로운 데이터만 등록
              </div>
            </div>
          </label>
          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-[#D4E4BC] bg-[#FFF8F0] p-3 hover:bg-[#F4FBE8]">
            <input
              type="radio"
              name="strategy"
              checked={strategy === "UPDATE"}
              onChange={() => setStrategy("UPDATE")}
              className="mt-1"
            />
            <div>
              <div className="text-sm font-semibold text-[#2D5A3D]">
                업데이트 (덮어쓰기)
              </div>
              <div className="text-xs text-[#6B6560]">
                기존 데이터는 새 값으로 갱신 (주의: 되돌릴 수 없음)
              </div>
            </div>
          </label>
        </div>
      </fieldset>

      <div className="mt-4 rounded-lg bg-[#F4FBE8] p-3 text-xs text-[#6B6560]">
        📱 등록이 완료되면 각 고객에게 아이디 · 임시 비밀번호가 담긴 안내 SMS가
        자동 발송됩니다.
      </div>

      <div className="mt-6 flex flex-col-reverse gap-2 md:flex-row md:justify-between">
        <button
          type="button"
          onClick={onBack}
          disabled={isPending}
          className="rounded-lg border border-[#D4E4BC] bg-white px-4 py-2 text-sm text-[#6B6560] hover:bg-[#F4FBE8] disabled:opacity-50"
        >
          ← 이전
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={isPending}
          className="rounded-lg bg-[#2D5A3D] px-6 py-2 text-sm font-semibold text-white hover:bg-[#1F4030] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? "등록 중…" : `🌱 ${validation.valid.length + (strategy === "UPDATE" ? validation.duplicates.length : 0)}건 일괄 등록 실행`}
        </button>
      </div>
    </div>
  );
}

/* ---------- Step 6: Result ---------- */
function StepResult({
  result,
  onDownloadErrors,
  onReset,
}: {
  result: BulkImportResult;
  onDownloadErrors: () => void;
  onReset: () => void;
}) {
  return (
    <div>
      <div className="mb-6 text-center">
        <div className="text-5xl">🌳</div>
        <h2 className="mt-2 text-xl font-bold text-[#2D5A3D]">
          일괄 등록 완료
        </h2>
        <p className="mt-1 text-sm text-[#6B6560]">
          각 고객에게 자동 안내 SMS가 발송되었습니다.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <BigStat label="성공" count={result.success} tone="emerald" icon="✅" />
        <BigStat
          label="업데이트"
          count={result.updated}
          tone="sky"
          icon="🔄"
        />
        <BigStat label="건너뛰기" count={result.skipped} tone="amber" icon="⏭" />
        <BigStat
          label="실패"
          count={result.errors.length}
          tone="rose"
          icon="❌"
        />
      </div>

      {result.errors.length > 0 && (
        <div className="mt-5 rounded-xl border border-rose-200 bg-rose-50 p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-rose-800">
                실패 {result.errors.length}건
              </div>
              <div className="text-xs text-rose-700">
                CSV로 다운받아 수정 후 다시 업로드하세요.
              </div>
            </div>
            <button
              type="button"
              onClick={onDownloadErrors}
              className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700"
            >
              📥 오류 CSV 다운로드
            </button>
          </div>
          <details className="mt-3">
            <summary className="cursor-pointer text-xs text-rose-700 hover:underline">
              오류 목록 보기
            </summary>
            <div className="mt-2 max-h-48 overflow-y-auto rounded bg-white/60 p-2">
              <ul className="space-y-1 text-xs text-rose-700">
                {result.errors.map((err, i) => (
                  <li key={i} className="border-b border-rose-100 pb-1">
                    <span className="font-mono">행 {err.row}</span>: {err.reason}
                  </li>
                ))}
              </ul>
            </div>
          </details>
        </div>
      )}

      <div className="mt-6 flex flex-col gap-2 md:flex-row md:justify-between">
        <button
          type="button"
          onClick={onReset}
          className="rounded-lg border border-[#D4E4BC] bg-white px-4 py-2 text-sm text-[#2D5A3D] hover:bg-[#F4FBE8]"
        >
          🔁 다시 등록
        </button>
        <Link
          href="/partner/customers/bulk-import/history"
          className="rounded-lg bg-[#2D5A3D] px-4 py-2 text-center text-sm font-semibold text-white hover:bg-[#1F4030]"
        >
          📜 등록 이력 보기 →
        </Link>
      </div>
    </div>
  );
}

function BigStat({
  label,
  count,
  tone,
  icon,
}: {
  label: string;
  count: number;
  tone: "emerald" | "sky" | "amber" | "rose";
  icon: string;
}) {
  const map = {
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-800",
    sky: "border-sky-200 bg-sky-50 text-sky-800",
    amber: "border-amber-200 bg-amber-50 text-amber-800",
    rose: "border-rose-200 bg-rose-50 text-rose-800",
  };
  return (
    <div
      className={`rounded-xl border p-4 text-center ${map[tone]}`}
    >
      <div className="text-2xl">{icon}</div>
      <div className="mt-1 text-3xl font-bold">{count}</div>
      <div className="text-xs font-semibold">{label}</div>
    </div>
  );
}
