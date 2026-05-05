"use client";

// 주차장 정보 편집기 — 프로그램 편집 폼에 마운트.
//
// UX:
//  - 빈 상태: [+ 주차장 추가] 버튼 한 개
//  - 추가하면 카드 한 장 (이름·주소·수용대수·요금·안내)
//  - 최대 10개 까지 추가 (앱 정책)
//  - [×] 즉시 삭제 (입력값 있으면 confirm)
//
// 부모 폼은 controlled 패턴: value/onChange 로 상태 받음.
// 폼 제출 시 hidden input 으로 JSON.stringify 직렬화 (parent 가 처리).
//
// DB 컬럼: partner_programs.parking_lots / org_programs.parking_lots (jsonb 배열)

import type { ParkingLot } from "@/lib/partner-programs/types";
import { CoverImagePicker } from "./cover-image-picker";

const MAX_LOTS = 10;

interface Props {
  value: ParkingLot[];
  onChange: (next: ParkingLot[]) => void;
}

export function ParkingLotsEditor({ value, onChange }: Props) {
  const lots = Array.isArray(value) ? value : [];

  const addLot = () => {
    if (lots.length >= MAX_LOTS) return;
    onChange([
      ...lots,
      { name: "", address: "", capacity: undefined, fee: "", note: "" },
    ]);
  };

  const updateLot = (idx: number, patch: Partial<ParkingLot>) => {
    onChange(lots.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  };

  const removeLot = (idx: number) => {
    const lot = lots[idx];
    const hasContent =
      (lot?.name ?? "").trim() ||
      (lot?.address ?? "").trim() ||
      (lot?.fee ?? "").trim() ||
      (lot?.note ?? "").trim() ||
      (lot?.image_url ?? "").trim() ||
      typeof lot?.capacity === "number";
    if (hasContent && !window.confirm("이 주차장 정보를 삭제할까요?")) return;
    onChange(lots.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-3">
      {lots.length === 0 && (
        <p className="mx-auto w-full max-w-2xl rounded-xl border border-dashed border-[#D4E4BC] bg-[#FFF8F0] p-4 text-center text-xs text-[#8B7F75]">
          주차장 정보를 추가하면 참가자에게 안내돼요.
        </p>
      )}

      {lots.map((lot, idx) => (
        <div
          key={idx}
          className="mx-auto w-full max-w-2xl rounded-2xl border border-[#D4E4BC] bg-white p-4 shadow-sm"
        >
          <div className="mb-3 flex items-center justify-between">
            <p className="flex items-center gap-1.5 text-xs font-bold text-[#2D5A3D]">
              <span aria-hidden>🅿️</span>
              <span>주차장 #{idx + 1}</span>
            </p>
            <button
              type="button"
              onClick={() => removeLot(idx)}
              aria-label={`주차장 ${idx + 1} 제거`}
              className="rounded-lg border border-rose-200 bg-white px-2 py-1 text-[11px] font-semibold text-rose-700 transition hover:bg-rose-50"
            >
              ✕ 제거
            </button>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="mb-1 block text-[11px] font-semibold text-[#2D5A3D]">
                이름 <span className="text-rose-600">*</span>
              </label>
              <input
                type="text"
                value={lot.name}
                onChange={(e) =>
                  updateLot(idx, { name: e.target.value.slice(0, 50) })
                }
                placeholder="예: 정문 주차장"
                maxLength={50}
                className="w-full rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] px-3 py-2 text-sm text-[#2C2C2C] focus:border-[#3A7A52] focus:outline-none focus:ring-2 focus:ring-[#3A7A52]/30"
              />
            </div>

            <div className="md:col-span-2">
              <label className="mb-1 block text-[11px] font-semibold text-[#2D5A3D]">
                주소 <span className="text-rose-600">*</span>
              </label>
              <input
                type="text"
                value={lot.address}
                onChange={(e) =>
                  updateLot(idx, { address: e.target.value.slice(0, 200) })
                }
                placeholder="예: 경기도 가평군 청평면 ..."
                maxLength={200}
                className="w-full rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] px-3 py-2 text-sm text-[#2C2C2C] focus:border-[#3A7A52] focus:outline-none focus:ring-2 focus:ring-[#3A7A52]/30"
              />
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-semibold text-[#2D5A3D]">
                수용 대수 (선택)
              </label>
              <input
                type="number"
                min={0}
                max={9999}
                step={1}
                inputMode="numeric"
                value={
                  typeof lot.capacity === "number" && lot.capacity >= 0
                    ? lot.capacity
                    : ""
                }
                onChange={(e) => {
                  const v = e.target.value.trim();
                  if (v === "") {
                    updateLot(idx, { capacity: undefined });
                    return;
                  }
                  const n = Number(v);
                  updateLot(idx, {
                    capacity:
                      Number.isFinite(n) && n >= 0 && n <= 9999
                        ? Math.floor(n)
                        : undefined,
                  });
                }}
                placeholder="예: 50"
                className="w-full rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] px-3 py-2 text-sm text-[#2C2C2C] focus:border-[#3A7A52] focus:outline-none focus:ring-2 focus:ring-[#3A7A52]/30"
              />
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-semibold text-[#2D5A3D]">
                요금 (선택)
              </label>
              <input
                type="text"
                value={lot.fee ?? ""}
                onChange={(e) =>
                  updateLot(idx, { fee: e.target.value.slice(0, 50) })
                }
                placeholder='예: 무료 / 1시간 무료 / 1,000원/시간'
                maxLength={50}
                className="w-full rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] px-3 py-2 text-sm text-[#2C2C2C] focus:border-[#3A7A52] focus:outline-none focus:ring-2 focus:ring-[#3A7A52]/30"
              />
            </div>

            <div className="md:col-span-2">
              <label className="mb-1 block text-[11px] font-semibold text-[#2D5A3D]">
                안내 (선택)
              </label>
              <input
                type="text"
                value={lot.note ?? ""}
                onChange={(e) =>
                  updateLot(idx, { note: e.target.value.slice(0, 200) })
                }
                placeholder="예: 좁은 입구 주의 / 셔틀 운영"
                maxLength={200}
                className="w-full rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] px-3 py-2 text-sm text-[#2C2C2C] focus:border-[#3A7A52] focus:outline-none focus:ring-2 focus:ring-[#3A7A52]/30"
              />
            </div>

            {/* 주차장 사진 — 클릭/드래그/Ctrl+V 지원, 자동 압축 500KB */}
            <div className="md:col-span-2">
              <label className="mb-1 block text-[11px] font-semibold text-[#2D5A3D]">
                사진 (선택)
              </label>
              <CoverImagePicker
                value={lot.image_url ?? ""}
                onChange={(url) =>
                  updateLot(idx, { image_url: url.trim() || undefined })
                }
                pathPrefix="parking-lots"
                compact
              />
              <p className="mt-1 text-[11px] text-[#8B7F75]">
                입구·간판 사진을 올리면 참가자가 도착할 때 더 쉽게 찾을 수 있어요.
              </p>
            </div>
          </div>
        </div>
      ))}

      {/* [+ 주차장 추가] — 카드들과 같은 max-w 로 중앙정렬, 풀폭 버튼 */}
      <div className="mx-auto w-full max-w-2xl">
        <button
          type="button"
          onClick={addLot}
          disabled={lots.length >= MAX_LOTS}
          className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[#2D5A3D] bg-white px-4 py-3 text-sm font-bold text-[#2D5A3D] transition hover:bg-[#F5F1E8] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <span aria-hidden>➕</span>
          <span>주차장 추가</span>
          <span className="text-[11px] font-semibold text-[#8B7F75]">
            ({lots.length}/{MAX_LOTS})
          </span>
        </button>
      </div>
    </div>
  );
}
