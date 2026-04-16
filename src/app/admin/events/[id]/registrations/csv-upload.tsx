"use client";

import { useState, useTransition } from "react";
import { uploadCsvAction } from "./actions";

export function CsvUploadForm({ eventId }: { eventId: string }) {
  const [csvText, setCsvText] = useState("");
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (file: File) => {
    const text = await file.text();
    setCsvText(text);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setResult(null);

    const formData = new FormData();
    formData.set("csv", csvText);

    startTransition(async () => {
      try {
        const res = await uploadCsvAction(eventId, formData);
        setResult(`${res.count}명 등록 완료`);
        setCsvText("");
      } catch (err) {
        setError(err instanceof Error ? err.message : "업로드 실패");
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border bg-white p-4">
      <h2 className="font-semibold">CSV 일괄 등록</h2>

      <div>
        <input
          type="file"
          accept=".csv,.txt"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
          className="w-full text-sm"
        />
      </div>

      <textarea
        value={csvText}
        onChange={(e) => setCsvText(e.target.value)}
        placeholder={"이름,전화번호\n홍길동,01012345678\n김영희,01056789012"}
        rows={5}
        className="w-full rounded-lg border px-3 py-2 font-mono text-xs"
      />

      {error && <p className="text-sm text-red-600">{error}</p>}
      {result && <p className="text-sm text-green-600">{result}</p>}

      <button
        type="submit"
        disabled={pending || !csvText.trim()}
        className="w-full rounded-lg bg-violet-600 py-2 font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
      >
        {pending ? "등록 중..." : "일괄 등록"}
      </button>
    </form>
  );
}
