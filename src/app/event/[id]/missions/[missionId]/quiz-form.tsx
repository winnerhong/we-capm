"use client";

import { useState, useTransition } from "react";
import { submitQuizAction } from "../actions";

export function QuizForm({ eventId, missionId }: { eventId: string; missionId: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      action={(formData) => {
        setError(null);
        startTransition(async () => {
          try {
            await submitQuizAction(eventId, missionId, formData);
          } catch (e) {
            setError(e instanceof Error ? e.message : "제출 실패");
          }
        });
      }}
      className="space-y-4 rounded-lg border bg-white p-6"
    >
      <div>
        <label htmlFor="answer" className="mb-1 block text-sm font-medium">
          답변
        </label>
        <input
          id="answer"
          name="answer"
          type="text"
          required
          autoFocus
          className="w-full rounded-lg border px-3 py-2 text-base outline-none focus:ring-2 focus:ring-violet-500"
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-violet-600 py-3 font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
      >
        {pending ? "제출 중..." : "제출"}
      </button>
    </form>
  );
}
