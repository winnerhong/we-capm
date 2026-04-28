"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  deleteOrgEventAction,
  updateOrgEventAction,
} from "@/lib/org-events/actions";
import {
  MAX_PARKING_ITEMS,
  ORG_EVENT_STATUSES,
  ORG_EVENT_STATUS_META,
  type OrgEventStatus,
  type ParkingItem,
} from "@/lib/org-events/types";
import { CoverImagePicker } from "@/components/cover-image-picker";

const INPUT_CLS =
  "w-full rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] px-3 py-2.5 text-sm text-[#2C2C2C] focus:border-[#3A7A52] focus:outline-none focus:ring-2 focus:ring-[#3A7A52]/30";

const MIN_DURATION = 5;
const MAX_DURATION_MIN = 60 * 10; // 10시간
const DEFAULT_DURATION = 60 * 2;

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

function toLocalDateTimeValue(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function toLocalIsoMinute(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) => i);
const MIN_OPTIONS = Array.from({ length: 12 }, (_, i) => i * 5);

/** 초기 ISO → 날짜/시/분(5분 스냅) 분리. */
function splitInitialDateTime(iso: string | null): {
  date: string;
  hour: number;
  min: number;
} {
  if (!iso) return { date: "", hour: 9, min: 0 };
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { date: "", hour: 9, min: 0 };
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    hour: d.getHours(),
    min: Math.round(d.getMinutes() / 5) * 5, // 5분 스냅
  };
}

function diffMinutes(start: string, end: string): number {
  const s = new Date(start);
  const e = new Date(end);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return DEFAULT_DURATION;
  const m = Math.round((e.getTime() - s.getTime()) / 60000);
  return Math.max(MIN_DURATION, Math.min(MAX_DURATION_MIN, m));
}

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

export function EditEventForm({
  orgId,
  eventId,
  initial,
}: {
  orgId: string;
  eventId: string;
  initial: {
    name: string;
    description: string;
    starts_at: string | null;
    ends_at: string | null;
    cover_image_url: string;
    status: OrgEventStatus;
    allow_self_register: boolean;
    invitation_message: string;
    invitation_body: string;
    invitation_location: string;
    invitation_address: string;
    invitation_dress_code: string;
    invitation_parkings: ParkingItem[];
  };
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState(initial.name);
  const [description, setDescription] = useState(initial.description);
  const initialStart = toLocalDateTimeValue(initial.starts_at);
  const initialEnd = toLocalDateTimeValue(initial.ends_at);
  const initParts = splitInitialDateTime(initial.starts_at);
  const [startDate, setStartDate] = useState(initParts.date);
  const [startHour, setStartHour] = useState(initParts.hour);
  const [startMin, setStartMin] = useState(initParts.min);
  const [durationMin, setDurationMin] = useState<number>(
    initialStart && initialEnd
      ? diffMinutes(initialStart, initialEnd)
      : DEFAULT_DURATION
  );
  const [coverUrl, setCoverUrl] = useState(initial.cover_image_url);
  const [status, setStatus] = useState<OrgEventStatus>(initial.status);
  const [allowSelfRegister, setAllowSelfRegister] = useState<boolean>(
    initial.allow_self_register
  );
  // 초대장
  const [invMessage, setInvMessage] = useState(initial.invitation_message);
  const [invBody, setInvBody] = useState(initial.invitation_body);
  const [invLocation, setInvLocation] = useState(initial.invitation_location);
  const [invAddress, setInvAddress] = useState(initial.invitation_address);
  const [invDressCode, setInvDressCode] = useState(initial.invitation_dress_code);
  const [invParkings, setInvParkings] = useState<ParkingItem[]>(
    initial.invitation_parkings.length > 0
      ? initial.invitation_parkings
      : []
  );

  const updateParking = (idx: number, patch: Partial<ParkingItem>) => {
    setInvParkings((prev) =>
      prev.map((p, i) => (i === idx ? { ...p, ...patch } : p))
    );
  };
  const addParking = () => {
    if (invParkings.length >= MAX_PARKING_ITEMS) return;
    setInvParkings((prev) => [...prev, { name: "", address: "" }]);
  };
  const removeParking = (idx: number) => {
    setInvParkings((prev) => prev.filter((_, i) => i !== idx));
  };
  const [isDeleting, startDeleteTransition] = useTransition();
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const startsAt = useMemo(() => {
    if (!startDate) return "";
    return `${startDate}T${pad(startHour)}:${pad(startMin)}`;
  }, [startDate, startHour, startMin]);

  const endsAt = useMemo(() => {
    if (!startsAt) return "";
    const start = new Date(startsAt);
    if (Number.isNaN(start.getTime())) return "";
    const end = new Date(start.getTime() + durationMin * 60 * 1000);
    return toLocalIsoMinute(end);
  }, [startsAt, durationMin]);

  function handleDelete() {
    if (isDeleting || isPending) return;
    setDeleteError(null);
    // 1차 경고 — 무엇이 사라지는지 명확하게
    const ok1 = window.confirm(
      `⚠️ "${initial.name || "(이름 없음)"}" 행사를 정말 삭제할까요?\n\n` +
        `이 행사에 연결된 모든 데이터가 영구 삭제돼요:\n` +
        `· 참가자 명단 (행사-사용자 연결)\n` +
        `· 스탬프북 / 프로그램 / 숲길 연결\n` +
        `· 토리FM 세션 연결\n` +
        `· 타임테이블 슬롯\n\n` +
        `※ 참가자 / 스탬프북 / 프로그램 / 숲길 / FM 세션 자체는 기관에 그대로 보존돼요.\n\n` +
        `되돌릴 수 없어요. 계속할까요?`
    );
    if (!ok1) return;
    // 2차 확인 — 이름 입력으로 휴먼 체크
    const expected = (initial.name || "").trim();
    const typed = window.prompt(
      `정말 확실한가요?\n\n다시 한 번 확인하기 위해 행사 이름을 입력해 주세요:\n\n${expected}`
    );
    if (typed === null) return;
    if (typed.trim() !== expected) {
      setDeleteError("입력한 행사 이름이 일치하지 않아요. 삭제 취소됨.");
      return;
    }
    startDeleteTransition(async () => {
      try {
        await deleteOrgEventAction(eventId);
        router.push(`/org/${orgId}/events?deleted=1`);
        router.refresh();
      } catch (err) {
        setDeleteError(err instanceof Error ? err.message : "삭제 실패");
      }
    });
  }

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
      setError("시작일이 종료일보다 늦어요");
      return;
    }

    const fd = new FormData();
    fd.set("name", trimmed);
    fd.set("description", description.trim());
    fd.set("starts_at", startsAt);
    fd.set("ends_at", endsAt);
    fd.set("cover_image_url", coverUrl.trim());
    fd.set("status", status);
    // 체크박스 전용: backend 가 "on" / 미전송으로 true/false 판단하는 관례와 동일.
    if (allowSelfRegister) fd.set("allow_self_register", "on");
    fd.set("invitation_message", invMessage.trim());
    fd.set("invitation_body", invBody.trim());
    fd.set("invitation_location", invLocation.trim());
    fd.set("invitation_address", invAddress.trim());
    fd.set("invitation_dress_code", invDressCode.trim());
    // 주차장: 빈 행 제외, JSON 직렬화
    const cleanedParkings = invParkings
      .map((p) => ({ name: p.name.trim(), address: p.address.trim() }))
      .filter((p) => p.name || p.address);
    fd.set("invitation_parkings_json", JSON.stringify(cleanedParkings));

    startTransition(async () => {
      try {
        await updateOrgEventAction(eventId, fd);
        router.push(`/org/${orgId}/events/${eventId}?saved=1`);
        router.refresh();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "저장 실패";
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
              placeholder="행사 소개 문구"
              className={INPUT_CLS}
            />
          </div>

          {/* 시작 일시 + 기간 슬라이더 */}
          <div className="space-y-4 rounded-2xl border border-[#E5D3B8] bg-[#FFFDF8] p-4">
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#2D5A3D]">
                ⏰ 시작 일시 (5분 단위)
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
              커버 이미지
            </span>
            <CoverImagePicker
              value={coverUrl}
              onChange={setCoverUrl}
              pathPrefix="org-events"
              hint="이미지 클릭·드래그·붙여넣기(Ctrl+V) 모두 가능 · 500KB 자동 압축"
            />
          </div>

          <div>
            <label
              htmlFor="status"
              className="mb-1 block text-xs font-semibold text-[#2D5A3D]"
            >
              상태 <span className="text-rose-600">*</span>
            </label>
            <select
              id="status"
              value={status}
              onChange={(e) => setStatus(e.target.value as OrgEventStatus)}
              className={INPUT_CLS}
            >
              {ORG_EVENT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {ORG_EVENT_STATUS_META[s].label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-[#8B7F75]">
              상태는 상세 페이지의 빠른 전환 버튼으로도 바꿀 수 있어요.
            </p>
          </div>

          {/* 📨 초대장 */}
          <div className="rounded-2xl border-2 border-emerald-200 bg-gradient-to-br from-emerald-50/40 via-white to-[#FAE7D0]/30 p-4">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-[#2D5A3D]">
              <span aria-hidden>📨</span>
              <span>초대장</span>
              <span className="text-[10px] font-normal text-[#8B7F75]">
                (선택 — 비워도 기본 초대장이 만들어져요)
              </span>
            </h3>

            <div className="space-y-3">
              <div>
                <label
                  htmlFor="invitation_message"
                  className="mb-1 block text-xs font-semibold text-[#2D5A3D]"
                >
                  💬 인사말
                </label>
                <textarea
                  id="invitation_message"
                  rows={2}
                  maxLength={500}
                  value={invMessage}
                  onChange={(e) => setInvMessage(e.target.value)}
                  placeholder="예) 함께 즐거운 시간을 만들어요"
                  className={INPUT_CLS}
                />
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {[
                    "함께 즐거운 시간을 만들어요",
                    "우리 봄캠프에서 만나요",
                    "가족 모두를 초대합니다 🌲",
                  ].map((tip) => (
                    <button
                      key={tip}
                      type="button"
                      onClick={() => setInvMessage(tip)}
                      className="rounded-full border border-[#D4E4BC] bg-white px-2 py-0.5 text-[10px] font-semibold text-[#2D5A3D] hover:bg-[#F5F1E8]"
                    >
                      {tip}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label
                  htmlFor="invitation_body"
                  className="mb-1 block text-xs font-semibold text-[#2D5A3D]"
                >
                  📋 초대장 내용 (선택)
                </label>
                <textarea
                  id="invitation_body"
                  rows={6}
                  maxLength={3000}
                  value={invBody}
                  onChange={(e) => setInvBody(e.target.value)}
                  placeholder={
                    "예)\n안녕하세요! 참좋은어린이집 가족 여러분 🎉\n\n26년 봄 미션 트레일에 초대합니다.\n\n📅 일시: 2026년 5월 16일 토요일 오전 10:00\n📍 장소: 침산공원\n\n즐거운 시간 함께해요! ✊"
                  }
                  className={INPUT_CLS}
                />
                <p className="mt-1 text-[10px] text-[#8B7F75]">
                  💡 줄바꿈 그대로 보입니다. 인사말 아래 안내문 카드에 표시돼요.
                </p>
              </div>

              <div>
                <label
                  htmlFor="invitation_location"
                  className="mb-1 block text-xs font-semibold text-[#2D5A3D]"
                >
                  📍 장소 이름 (선택)
                </label>
                <input
                  id="invitation_location"
                  type="text"
                  maxLength={200}
                  value={invLocation}
                  onChange={(e) => setInvLocation(e.target.value)}
                  placeholder="예) 침산공원 / 참좋은어린이집 운동장"
                  className={INPUT_CLS}
                />
              </div>

              <div>
                <label
                  htmlFor="invitation_address"
                  className="mb-1 block text-xs font-semibold text-[#2D5A3D]"
                >
                  🏠 상세 주소 (선택)
                </label>
                <input
                  id="invitation_address"
                  type="text"
                  maxLength={300}
                  value={invAddress}
                  onChange={(e) => setInvAddress(e.target.value)}
                  placeholder="예) 대구 북구 침산동 1344-1"
                  className={INPUT_CLS}
                />
                <p className="mt-1 text-[10px] text-[#8B7F75]">
                  💡 입력하면 초대장에 카카오/네이버 지도 버튼이 자동으로 생겨요.
                </p>
              </div>

              <div>
                <label
                  htmlFor="invitation_dress_code"
                  className="mb-1 block text-xs font-semibold text-[#2D5A3D]"
                >
                  🎒 복장·준비물 (선택)
                </label>
                <textarea
                  id="invitation_dress_code"
                  rows={4}
                  maxLength={500}
                  value={invDressCode}
                  onChange={(e) => setInvDressCode(e.target.value)}
                  placeholder={
                    "예)\n- 운동화 (굽 없는 편한 신발)\n- 개인 물병\n- 모자 (야외 시)\n- 여벌옷"
                  }
                  className={INPUT_CLS}
                />
                <p className="mt-1 text-[10px] text-[#8B7F75]">
                  💡 줄바꿈이 그대로 초대장에 표시돼요.
                </p>
              </div>

              {/* 🅿 주차장 N개 */}
              <div className="rounded-xl border border-[#D4E4BC] bg-white p-3">
                <div className="mb-2 flex items-center justify-between">
                  <label className="flex items-center gap-1 text-xs font-semibold text-[#2D5A3D]">
                    <span aria-hidden>🅿</span>
                    <span>주차장 (선택 · 최대 {MAX_PARKING_ITEMS}개)</span>
                  </label>
                  <button
                    type="button"
                    onClick={addParking}
                    disabled={invParkings.length >= MAX_PARKING_ITEMS}
                    className="rounded-full border border-[#2D5A3D] bg-[#2D5A3D] px-2.5 py-0.5 text-[11px] font-bold text-white shadow-sm hover:bg-[#234a30] disabled:opacity-40"
                  >
                    ➕ 추가
                  </button>
                </div>
                {invParkings.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-[#D4E4BC] bg-[#FFF8F0] px-3 py-3 text-[11px] text-[#8B7F75]">
                    주차장 정보가 있으면 ➕ 추가 버튼으로 입력해 주세요. 입력한
                    주차장마다 카카오/네이버/티맵 버튼이 초대장에 자동 표시됩니다.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {invParkings.map((p, idx) => (
                      <li
                        key={idx}
                        className="rounded-xl border border-[#E5D3B8] bg-[#FFF8F0] p-2"
                      >
                        <div className="flex items-center justify-between">
                          <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-800">
                            🅿 제{idx + 1}주차장
                          </span>
                          <button
                            type="button"
                            onClick={() => removeParking(idx)}
                            className="rounded border border-rose-300 bg-white px-2 py-0.5 text-[10px] font-semibold text-rose-700 hover:bg-rose-50"
                          >
                            🗑 삭제
                          </button>
                        </div>
                        <input
                          type="text"
                          maxLength={100}
                          value={p.name}
                          onChange={(e) =>
                            updateParking(idx, { name: e.target.value })
                          }
                          placeholder="주차장 이름 (예: 침산공원주차장1입구)"
                          className={`${INPUT_CLS} mt-2`}
                        />
                        <input
                          type="text"
                          maxLength={200}
                          value={p.address}
                          onChange={(e) =>
                            updateParking(idx, { address: e.target.value })
                          }
                          placeholder="주소 (예: 대구 북구 침산동 1129-1)"
                          className={`${INPUT_CLS} mt-1.5`}
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <p className="rounded-lg bg-white/70 px-3 py-2 text-[10px] leading-relaxed text-[#6B6560]">
                💡 저장 후 행사 상세 페이지의{" "}
                <b>📨 초대장 공유</b> 버튼으로 발행 + 링크 공유할 수 있어요.
                참가자는 링크 클릭 → 로그인 → 본인 이름이 들어간 초대장을 받아요.
              </p>
            </div>
          </div>

          {/* 자체 가입 허용 토글 — 초대링크를 받은 미등록 번호의 신규 가입 허용 */}
          <div>
            <label
              className="flex cursor-pointer items-start gap-3 rounded-xl border border-[#D4E4BC] bg-white p-4 transition has-[:checked]:border-[#2D5A3D] has-[:checked]:bg-[#E8F0E4]"
            >
              <input
                type="checkbox"
                name="allow_self_register"
                checked={allowSelfRegister}
                onChange={(e) => setAllowSelfRegister(e.target.checked)}
                className="mt-0.5 h-4 w-4 flex-shrink-0 accent-[#2D5A3D]"
              />
              <div className="min-w-0">
                <p className="text-sm font-bold text-[#2D5A3D]">
                  🌐 초대링크 자체 가입 허용
                </p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-[#6B6560]">
                  켜면 사전 등록되지 않은 참가자도 초대링크를 받으면 이름만 입력해 바로 참여할 수 있어요.
                  끄면 기관에서 사전 등록된 전화번호만 참여 가능해요.
                </p>
              </div>
            </label>
          </div>
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-end gap-2">
        <Link
          href={`/org/${orgId}/events/${eventId}`}
          className="rounded-xl border border-[#D4E4BC] bg-white px-4 py-2.5 text-sm font-semibold text-[#6B6560] hover:bg-[#FFF8F0]"
        >
          취소
        </Link>
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#2D5A3D] to-[#3A7A52] px-5 py-2.5 text-sm font-bold text-white shadow-md hover:from-[#234a30] hover:to-[#2D5A3D] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2D5A3D]/40 disabled:opacity-60"
        >
          <span aria-hidden>{isPending ? "⏳" : "💾"}</span>
          <span>{isPending ? "저장 중..." : "저장"}</span>
        </button>
      </div>

      {/* ────────── 위험 영역 — 행사 영구 삭제 ────────── */}
      <section className="mt-8 rounded-2xl border-2 border-rose-300 bg-rose-50/40 p-5 shadow-sm">
        <h2 className="mb-2 flex items-center gap-2 text-sm font-bold text-rose-800">
          <span aria-hidden>⚠️</span>
          <span>위험 영역 — 행사 영구 삭제</span>
        </h2>
        <p className="text-xs leading-relaxed text-rose-900">
          이 행사를 삭제하면 <b>참가자 명단 / 스탬프북·프로그램·숲길·FM 세션
          연결 / 타임테이블 슬롯</b> 이 모두 사라져요. 한 번 삭제하면 되돌릴 수
          없어요.
        </p>
        <p className="mt-1 text-[11px] text-rose-700">
          참가자·스탬프북·프로그램 같은 콘텐츠 자체는 기관에 그대로 보존돼요.
          (다른 행사에 다시 연결 가능)
        </p>

        {deleteError && (
          <div
            role="alert"
            className="mt-3 rounded-xl border-2 border-rose-400 bg-white px-3 py-2 text-xs font-semibold text-rose-800"
          >
            ⚠️ {deleteError}
          </div>
        )}

        <div className="mt-4">
          <button
            type="button"
            onClick={handleDelete}
            disabled={isDeleting || isPending}
            className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-rose-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 disabled:opacity-50"
          >
            <span aria-hidden>{isDeleting ? "⏳" : "🗑"}</span>
            <span>
              {isDeleting ? "삭제 중..." : "이 행사 영구 삭제"}
            </span>
          </button>
        </div>
      </section>
    </form>
  );
}
