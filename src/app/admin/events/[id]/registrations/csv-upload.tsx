"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { uploadCsvAction } from "./actions";

interface CheckResult {
  count: number;
  newCount: number;
  duplicateCount: number;
  duplicateNames?: string[];
}

export function CsvUploadForm({ eventId }: { eventId: string }) {
  const router = useRouter();
  const [csvText, setCsvText] = useState("");
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checkResult, setCheckResult] = useState<CheckResult | null>(null);

  const handleFile = async (file: File) => {
    const text = await file.text();
    setCsvText(text);
    setCheckResult(null);
    setResult(null);
  };

  const handleCheck = () => {
    setError(null);
    setResult(null);
    setCheckResult(null);

    const formData = new FormData();
    formData.set("csv", csvText);
    formData.set("check_only", "true");

    startTransition(async () => {
      try {
        const res = await uploadCsvAction(eventId, formData) as CheckResult;
        setCheckResult(res);
      } catch (err) {
        setError(err instanceof Error ? err.message : "확인 실패");
      }
    });
  };

  const handleConfirm = () => {
    setError(null);

    const formData = new FormData();
    formData.set("csv", csvText);

    startTransition(async () => {
      try {
        const res = await uploadCsvAction(eventId, formData) as CheckResult;
        setResult(`${res.newCount}명 신규 등록 완료` + (res.duplicateCount > 0 ? ` (${res.duplicateCount}명 중복 제외)` : ""));
        setCsvText("");
        setCheckResult(null);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "등록 실패");
      }
    });
  };

  return (
    <div className="space-y-3 rounded-lg border bg-white p-4">
      <h2 className="font-semibold">CSV 일괄 등록</h2>

      <div>
        <input type="file" accept=".csv,.txt"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
          className="w-full text-sm" />
      </div>

      <textarea value={csvText}
        onChange={(e) => { setCsvText(e.target.value); setCheckResult(null); setResult(null); }}
        placeholder={"반명,이름,전화번호\n해바라기반,홍길동,01012345678\n장미반,김영희,01056789012\n\n또는 2열도 가능:\n홍길동,01012345678"}
        rows={5} className="w-full rounded-lg border px-3 py-2 font-mono text-xs" />

      {error && <p className="text-sm text-red-600">{error}</p>}
      {result && <p className="text-sm text-green-600">{result}</p>}

      {checkResult && (
        <div className="rounded-lg border p-3 space-y-2">
          <div className="text-sm">
            전체 <strong>{checkResult.count}명</strong> 중
            신규 <strong className="text-green-600">{checkResult.newCount}명</strong>,
            중복 <strong className="text-yellow-600">{checkResult.duplicateCount}명</strong>
          </div>
          {checkResult.duplicateCount > 0 && checkResult.duplicateNames && (
            <div className="text-xs text-yellow-600">
              중복: {checkResult.duplicateNames.join(", ")}
              {checkResult.duplicateCount > 10 ? ` 외 ${checkResult.duplicateCount - 10}명` : ""}
            </div>
          )}
          {checkResult.newCount > 0 ? (
            <button type="button" onClick={handleConfirm} disabled={pending}
              className="w-full rounded-lg bg-green-600 py-2 font-semibold text-white hover:bg-green-700 disabled:opacity-50">
              {pending ? "등록 중..." : `${checkResult.newCount}명 등록 진행`}
            </button>
          ) : (
            <p className="text-sm text-center">모두 이미 등록된 번호입니다</p>
          )}
        </div>
      )}

      {!checkResult && (
        <button type="button" onClick={handleCheck}
          disabled={pending || !csvText.trim()}
          className="w-full rounded-lg bg-violet-600 py-2 font-semibold text-white hover:bg-violet-700 disabled:opacity-50">
          {pending ? "확인 중..." : "중복 확인"}
        </button>
      )}
    </div>
  );
}
