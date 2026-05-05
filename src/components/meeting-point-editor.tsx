"use client";

// 집결장소 편집기 — 단일 객체. 비워두면 NULL.
//
// UX:
//  - 4개 필드 (이름·주소·시각·안내)
//  - 한 필드라도 채워져 있으면 객체로 저장, 모두 비면 NULL
//  - 주소 옆 [📍 카카오맵 검색] 외부 링크 (지도 위젯 통합 X — 단순)

import type { MeetingPoint } from "@/lib/partner-programs/types";
import { CoverImagePicker } from "./cover-image-picker";

interface Props {
  value: MeetingPoint | null;
  onChange: (next: MeetingPoint | null) => void;
}

function emptyPoint(): MeetingPoint {
  return { name: "", address: "" };
}

export function MeetingPointEditor({ value, onChange }: Props) {
  const point = value ?? emptyPoint();

  const update = (patch: Partial<MeetingPoint>) => {
    onChange({ ...point, ...patch });
  };

  const clear = () => {
    if (
      (point.name ?? "").trim() ||
      (point.address ?? "").trim() ||
      (point.time ?? "").trim() ||
      (point.note ?? "").trim()
    ) {
      if (!window.confirm("집결장소 정보를 모두 지울까요?")) return;
    }
    onChange(null);
  };

  const mapHref = point.address
    ? `https://map.kakao.com/?q=${encodeURIComponent(point.address.trim())}`
    : null;

  return (
    <div className="rounded-2xl border border-[#D4E4BC] bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-xs font-bold text-[#2D5A3D]">
          <span aria-hidden>📍</span>
          <span>집결 장소 (선택)</span>
        </p>
        {value !== null && (
          <button
            type="button"
            onClick={clear}
            className="rounded-lg border border-[#D4E4BC] bg-white px-2 py-1 text-[11px] font-semibold text-[#6B6560] transition hover:bg-[#F5F1E8]"
          >
            지우기
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="md:col-span-2">
          <label className="mb-1 block text-[11px] font-semibold text-[#2D5A3D]">
            장소명
          </label>
          <input
            type="text"
            value={point.name}
            onChange={(e) => update({ name: e.target.value.slice(0, 80) })}
            placeholder="예: 센터 정문 광장 / 안내데스크 앞"
            maxLength={80}
            className="w-full rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] px-3 py-2 text-sm text-[#2C2C2C] focus:border-[#3A7A52] focus:outline-none focus:ring-2 focus:ring-[#3A7A52]/30"
          />
        </div>

        <div className="md:col-span-2">
          <label className="mb-1 block text-[11px] font-semibold text-[#2D5A3D]">
            주소
          </label>
          <div className="flex flex-wrap items-stretch gap-2">
            <input
              type="text"
              value={point.address}
              onChange={(e) =>
                update({ address: e.target.value.slice(0, 200) })
              }
              placeholder="예: 경기도 가평군 ..."
              maxLength={200}
              className="min-w-[200px] flex-1 rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] px-3 py-2 text-sm text-[#2C2C2C] focus:border-[#3A7A52] focus:outline-none focus:ring-2 focus:ring-[#3A7A52]/30"
            />
            {mapHref && (
              <a
                href={mapHref}
                target="_blank"
                rel="noreferrer"
                className="inline-flex shrink-0 items-center gap-1 rounded-xl border border-[#D4E4BC] bg-white px-3 py-2 text-xs font-semibold text-[#2D5A3D] transition hover:bg-[#F5F1E8]"
              >
                <span aria-hidden>📍</span>
                <span>카카오맵 검색</span>
              </a>
            )}
          </div>
        </div>

        <div>
          <label className="mb-1 block text-[11px] font-semibold text-[#2D5A3D]">
            집결 시각 (선택)
          </label>
          <input
            type="text"
            value={point.time ?? ""}
            onChange={(e) => update({ time: e.target.value.slice(0, 50) })}
            placeholder="예: 10:00 (시작 10분 전)"
            maxLength={50}
            className="w-full rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] px-3 py-2 text-sm text-[#2C2C2C] focus:border-[#3A7A52] focus:outline-none focus:ring-2 focus:ring-[#3A7A52]/30"
          />
        </div>

        <div>
          <label className="mb-1 block text-[11px] font-semibold text-[#2D5A3D]">
            안내 (선택)
          </label>
          <input
            type="text"
            value={point.note ?? ""}
            onChange={(e) => update({ note: e.target.value.slice(0, 200) })}
            placeholder="예: 녹색 깃발 든 안내자에게 모이세요"
            maxLength={200}
            className="w-full rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] px-3 py-2 text-sm text-[#2C2C2C] focus:border-[#3A7A52] focus:outline-none focus:ring-2 focus:ring-[#3A7A52]/30"
          />
        </div>

        {/* 집결장소 사진 — 클릭/드래그/Ctrl+V 모두 지원, 자동 압축 500KB */}
        <div className="md:col-span-2">
          <label className="mb-1 block text-[11px] font-semibold text-[#2D5A3D]">
            사진 (선택)
          </label>
          <CoverImagePicker
            value={point.image_url ?? ""}
            onChange={(url) =>
              update({ image_url: url.trim() || undefined })
            }
            pathPrefix="meeting-points"
            compact
          />
          <p className="mt-1 text-[11px] text-[#8B7F75]">
            정문/간판/안내데스크 등 집결지 사진을 올리면 참가자가 길 찾기 쉬워요.
          </p>
        </div>
      </div>
    </div>
  );
}
