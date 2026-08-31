"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { createOrgEventAction } from "@/lib/org-events/actions";
import { CoverImagePicker } from "@/components/cover-image-picker";
import { EventScheduleFields } from "@/components/event-schedule-fields";
import {
  composeStartsAt,
  computeEndsAt,
  DEFAULT_DURATION,
} from "@/lib/org-events/schedule-core";
import { fmtDateTimeKst } from "@/lib/datetime/kst";

const INPUT_CLS =
  "w-full rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] px-3 py-2.5 text-sm text-[#2C2C2C] focus:border-[#3A7A52] focus:outline-none focus:ring-2 focus:ring-[#3A7A52]/30";

function formatDateTimeKo(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return fmtDateTimeKst(iso);
}

export function NewEventForm({ orgId }: { orgId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  // 시작 일시 — 날짜 / 시 / 분(5분 단위) 분리
  const [startDate, setStartDate] = useState(""); // YYYY-MM-DD
  const [startHour, setStartHour] = useState(9);
  const [startMin, setStartMin] = useState(0);
  const [durationMin, setDurationMin] = useState(DEFAULT_DURATION);
  // 입장가능시간(분). 예전엔 새 행사에서 정할 수가 없어, 만들고 나서 편집으로
  // 다시 들어가야 했다. 비워 두면 초대장에 입장 안내가 나가지 않는다.
  const [entryLead, setEntryLead] = useState("");
  const [coverUrl, setCoverUrl] = useState("");

  const startsAt = useMemo(
    () => composeStartsAt(startDate, startHour, startMin),
    [startDate, startHour, startMin]
  );
  const endsAt = useMemo(
    () => computeEndsAt(startsAt, durationMin),
    [startsAt, durationMin]
  );

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const trimmed = name.trim();
    if (!trimmed) {
      setError("행사 이름을 입력해 주세요");
      return;
    }
    if (trimmed.length > 100) {
      setError("이름은 100자 이내로 입력해 주세요");
      return;
    }
    if (startsAt && endsAt && new Date(startsAt) > new Date(endsAt)) {
      setError("시작 시간이 종료 시간보다 늦어요");
      return;
    }

    // 사용자 입력은 KST 로 가정 — "+09:00" 명시해서 서버가 정확한 UTC instant 로 변환.
    // (이전엔 naive 문자열을 서버(Vercel UTC)가 UTC 로 해석해서 9시간 어긋남.)
    const toKstIso = (v: string) => (v ? `${v}:00+09:00` : "");

    const fd = new FormData();
    fd.set("name", trimmed);
    fd.set("description", description.trim());
    fd.set("starts_at", toKstIso(startsAt));
    fd.set("ends_at", toKstIso(endsAt));
    fd.set("cover_image_url", coverUrl.trim());
    fd.set("invitation_entry_lead_min", entryLead.trim());

    startTransition(async () => {
      try {
        const res = await createOrgEventAction(fd);
        if (res.ok) {
          router.push(`/org/${orgId}/events/${res.eventId}`);
          router.refresh();
        } else {
          setError(res.message);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "생성 실패";
        if (msg.includes("NEXT_REDIRECT")) return;
        setError(msg);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      {error && (
        <div
          role="alert"
          className="rounded-xl border-2 border-rose-300 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800"
        >
          ⚠️ {error}
        </div>
      )}

      <section className="rounded-2xl border border-[#D4E4BC] bg-white p-5 shadow-sm">
        <h2 className="mb-4 flex items-center gap-2 text-sm font-bold text-[#2D5A3D]">
          <span aria-hidden>📝</span>
          <span>기본 정보</span>
        </h2>

        <div className="space-y-4">
          <div>
            <label
              htmlFor="name"
              className="mb-1 block text-xs font-semibold text-[#2D5A3D]"
            >
              행사 이름 <span className="text-rose-600">*</span>
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예) 2026 봄 숲 캠프"
              maxLength={100}
              autoComplete="off"
              required
              className={INPUT_CLS}
            />
            <p className="mt-1 text-[11px] text-[#8B7F75]">
              {name.length} / 100자
            </p>
          </div>

          <div>
            <label
              htmlFor="description"
              className="mb-1 block text-xs font-semibold text-[#2D5A3D]"
            >
              설명 (선택)
            </label>
            <textarea
              id="description"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="행사 소개 문구를 적어주세요"
              className={INPUT_CLS}
            />
          </div>

          {/* 시작 일시 · 기간 · 종료 · 입장가능시간 — 행사 편집과 같은
              컴포넌트. 예전엔 이 140줄을 두 폼이 각자 복붙해 갖고 있었고,
              편집 쪽에만 입장가능시간이 붙으면서 갈라졌다. */}
          <EventScheduleFields
            startDate={startDate}
            onStartDate={setStartDate}
            startHour={startHour}
            onStartHour={setStartHour}
            startMin={startMin}
            onStartMin={setStartMin}
            durationMin={durationMin}
            onDurationMin={setDurationMin}
            entryLeadMin={entryLead}
            onEntryLeadMin={setEntryLead}
            startsAt={startsAt}
            endsAt={endsAt}
            formatEndLabel={formatDateTimeKo}
          />

          <div>
            <span className="mb-1 block text-xs font-semibold text-[#2D5A3D]">
              커버 이미지 (선택)
            </span>
            <CoverImagePicker
              value={coverUrl}
              onChange={setCoverUrl}
              pathPrefix="org-events"
              hint="이미지 클릭·드래그·붙여넣기(Ctrl+V) 모두 가능 · 500KB 자동 압축"
            />
            <p className="mt-1 text-[11px] text-[#8B7F75]">
              비워두면 🎪 이모지 플레이스홀더로 표시돼요.
            </p>
          </div>
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-end gap-2">
        <Link
          href={`/org/${orgId}/events`}
          className="rounded-xl border border-[#D4E4BC] bg-white px-4 py-2.5 text-sm font-semibold text-[#6B6560] hover:bg-[#FFF8F0]"
        >
          취소
        </Link>
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#2D5A3D] to-[#3A7A52] px-5 py-2.5 text-sm font-bold text-white shadow-md hover:from-[#234a30] hover:to-[#2D5A3D] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2D5A3D]/40 disabled:opacity-60"
        >
          <span aria-hidden>{isPending ? "⏳" : "🎪"}</span>
          <span>{isPending ? "생성 중..." : "초안으로 만들기"}</span>
        </button>
      </div>
    </form>
  );
}
