"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { createOrgEventAction } from "@/lib/org-events/actions";
import { CoverImagePicker } from "@/components/cover-image-picker";

const INPUT_CLS =
  "w-full rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] px-3 py-2.5 text-sm text-[#2C2C2C] focus:border-[#3A7A52] focus:outline-none focus:ring-2 focus:ring-[#3A7A52]/30";

const MIN_DURATION = 5; // 5분
const MAX_DURATION_MIN = 60 * 10; // 10시간
const DEFAULT_DURATION = 60 * 2; // 2시간

const DURATION_PRESETS: { label: string; mins: number }[] = [
  { label: "30분", mins: 30 },
  { label: "1시간", mins: 60 },
  { label: "2시간", mins: 120 },
  { label: "3시간", mins: 180 },
  { label: "4시간", mins: 240 },
  { label: "6시간", mins: 360 },
  { label: "8시간", mins: 480 },
  { label: "10시간", mins: 600 },
];

function pad(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

function toLocalIsoMinute(d: Date): string {
  // "YYYY-MM-DDTHH:mm" — datetime-local 호환
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) => i); // 0..23
const MIN_OPTIONS = Array.from({ length: 12 }, (_, i) => i * 5); // 0,5,10,..,55

function formatDuration(min: number): string {
  if (min < 60) return `${min}분`;
  const days = Math.floor(min / (60 * 24));
  const hours = Math.floor((min % (60 * 24)) / 60);
  const mins = min % 60;
  const parts: string[] = [];
  if (days) parts.push(`${days}일`);
  if (hours) parts.push(`${hours}시간`);
  if (mins) parts.push(`${mins}분`);
  return parts.join(" ");
}

function formatDateTimeKo(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
  });
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
  const [coverUrl, setCoverUrl] = useState("");

  const startsAt = useMemo(() => {
    if (!startDate) return "";
    return `${startDate}T${pad(startHour)}:${pad(startMin)}`;
  }, [startDate, startHour, startMin]);

  // 시작 + 기간 → 종료
  const endsAt = useMemo(() => {
    if (!startsAt) return "";
    const start = new Date(startsAt);
    if (Number.isNaN(start.getTime())) return "";
    const end = new Date(start.getTime() + durationMin * 60 * 1000);
    return toLocalIsoMinute(end);
  }, [startsAt, durationMin]);

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

    const fd = new FormData();
    fd.set("name", trimmed);
    fd.set("description", description.trim());
    fd.set("starts_at", startsAt);
    fd.set("ends_at", endsAt);
    fd.set("cover_image_url", coverUrl.trim());

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

          {/* 시작 일시 + 기간 슬라이더 */}
          <div className="space-y-4 rounded-2xl border border-[#E5D3B8] bg-[#FFFDF8] p-4">
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#2D5A3D]">
                ⏰ 시작 일시 (선택, 5분 단위)
              </label>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto_auto]">
                <input
                  id="starts_at_date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  aria-label="시작 날짜"
                  className={INPUT_CLS}
                />
                <select
                  value={startHour}
                  onChange={(e) => setStartHour(Number(e.target.value))}
                  aria-label="시작 시"
                  className={INPUT_CLS}
                >
                  {HOUR_OPTIONS.map((h) => (
                    <option key={h} value={h}>
                      {pad(h)}시
                    </option>
                  ))}
                </select>
                <select
                  value={startMin}
                  onChange={(e) => setStartMin(Number(e.target.value))}
                  aria-label="시작 분"
                  className={INPUT_CLS}
                >
                  {MIN_OPTIONS.map((m) => (
                    <option key={m} value={m}>
                      {pad(m)}분
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {startsAt && (
              <>
                <div>
                  <div className="mb-1 flex items-baseline justify-between">
                    <label
                      htmlFor="duration"
                      className="text-xs font-semibold text-[#2D5A3D]"
                    >
                      📏 행사 기간 (5분 단위)
                    </label>
                    <span className="text-sm font-bold text-[#2D5A3D]">
                      {formatDuration(durationMin)}
                    </span>
                  </div>
                  <input
                    id="duration"
                    type="range"
                    min={MIN_DURATION}
                    max={MAX_DURATION_MIN}
                    step={5}
                    value={durationMin}
                    onChange={(e) => setDurationMin(Number(e.target.value))}
                    className="w-full accent-[#2D5A3D]"
                  />
                  <div className="flex justify-between text-[10px] text-[#8B7F75]">
                    <span>5분</span>
                    <span>10시간</span>
                  </div>
                </div>

                {/* 빠른 프리셋 */}
                <div className="flex flex-wrap gap-1.5">
                  {DURATION_PRESETS.map((p) => {
                    const active = durationMin === p.mins;
                    return (
                      <button
                        key={p.label}
                        type="button"
                        onClick={() => setDurationMin(p.mins)}
                        className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition ${
                          active
                            ? "border-[#2D5A3D] bg-[#2D5A3D] text-white"
                            : "border-[#D4E4BC] bg-white text-[#2D5A3D] hover:bg-[#F5F1E8]"
                        }`}
                      >
                        {p.label}
                      </button>
                    );
                  })}
                </div>

                {/* 종료 일시 — 자동 계산 결과 */}
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 px-3 py-2 text-xs text-[#2D5A3D]">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-semibold">🏁 종료 일시</span>
                    <span className="font-bold text-emerald-800">
                      {endsAt ? formatDateTimeKo(endsAt) : "-"}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[10px] text-[#6B6560]">
                    시작 일시 + 기간 슬라이더로 자동 계산됩니다.
                  </p>
                </div>
              </>
            )}
          </div>

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
