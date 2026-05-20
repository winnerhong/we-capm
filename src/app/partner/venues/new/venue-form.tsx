"use client";

// 행사장 편집 폼 — ParkingLotsEditor 재사용 (program 편집과 동일 UX).

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createVenueAction,
  updateVenueAction,
} from "@/lib/partner-venues/actions";
import { CoverImagePicker } from "@/components/cover-image-picker";
import { ParkingLotsEditor } from "@/components/parking-lots-editor";
import type { ParkingLot } from "@/lib/partner-programs/types";

interface InitialValue {
  id: string;
  name: string;
  address: string;
  imageUrl: string;
  description: string;
  parkingLots: ParkingLot[];
}

interface Props {
  initial: InitialValue | null;
}

const FIELD_CLS =
  "w-full rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] px-3 py-2.5 text-sm text-[#2C2C2C] focus:border-[#3A7A52] focus:outline-none focus:ring-2 focus:ring-[#3A7A52]/30";

export function VenueForm({ initial }: Props) {
  const router = useRouter();
  const isEdit = !!initial;
  const [name, setName] = useState(initial?.name ?? "");
  const [address, setAddress] = useState(initial?.address ?? "");
  const [imageUrl, setImageUrl] = useState(initial?.imageUrl ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [parkingLots, setParkingLots] = useState<ParkingLot[]>(
    initial?.parkingLots ?? []
  );
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("행사장 이름을 입력해 주세요");
      return;
    }
    startTransition(async () => {
      try {
        if (isEdit && initial) {
          await updateVenueAction({
            id: initial.id,
            name: trimmedName,
            address: address || null,
            imageUrl: imageUrl || null,
            description: description || null,
            parkingLotsJson: JSON.stringify(parkingLots),
          });
        } else {
          await createVenueAction({
            name: trimmedName,
            address: address || null,
            imageUrl: imageUrl || null,
            description: description || null,
            parkingLotsJson: JSON.stringify(parkingLots),
          });
        }
        router.push("/partner/venues");
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "저장 실패");
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* 기본 정보 */}
      <section className="rounded-2xl border border-[#D4E4BC] bg-white p-4 shadow-sm">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-[#2D5A3D]">
          <span aria-hidden>📍</span>
          <span>행사장 정보</span>
        </h3>
        <div className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-[#2D5A3D]">
              장소 이름 <span className="text-rose-600">*</span>
            </span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={80}
              placeholder="예) 침산공원 / 참좋은어린이집 운동장"
              className={FIELD_CLS}
              disabled={pending}
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-[#2D5A3D]">
              주소 (선택)
            </span>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              maxLength={200}
              placeholder="예) 대구 북구 침산동 100-1"
              className={FIELD_CLS}
              disabled={pending}
            />
          </label>

          <div>
            <span className="mb-1 block text-xs font-semibold text-[#2D5A3D]">
              대표 이미지 (선택)
            </span>
            <CoverImagePicker
              value={imageUrl}
              onChange={setImageUrl}
              bucket="preset-covers"
              pathPrefix="venues"
              compact
              hint="장소 입구·전경 등. 500KB 이하 자동 압축"
            />
          </div>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-[#2D5A3D]">
              내부 메모 (선택, 기관에 노출 안 됨)
            </span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              maxLength={500}
              placeholder="예) 주차 좁음, 정문은 도보 5분 거리"
              className={FIELD_CLS}
              disabled={pending}
            />
          </label>
        </div>
      </section>

      {/* 주차장 */}
      <section className="rounded-2xl border border-[#D4E4BC] bg-white p-4 shadow-sm">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-[#2D5A3D]">
          <span aria-hidden>🅿</span>
          <span>주차장 정보</span>
          <span className="text-[10px] font-normal text-[#8B7F75]">
            (선택 · 최대 10개)
          </span>
        </h3>
        <ParkingLotsEditor value={parkingLots} onChange={setParkingLots} />
      </section>

      {error && (
        <p
          role="alert"
          className="rounded-xl bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 ring-1 ring-rose-200"
        >
          ⚠ {error}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => router.push("/partner/venues")}
          disabled={pending}
          className="rounded-xl border border-[#D4E4BC] bg-white px-4 py-2.5 text-sm font-semibold text-[#6B6560] hover:bg-[#FFF8F0] disabled:opacity-50"
        >
          취소
        </button>
        <button
          type="submit"
          disabled={pending || !name.trim()}
          className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#2D5A3D] to-[#3A7A52] px-5 py-2.5 text-sm font-bold text-white shadow-md hover:from-[#234a30] disabled:opacity-50"
        >
          <span aria-hidden>{isEdit ? "💾" : "🌱"}</span>
          <span>
            {pending
              ? "저장 중..."
              : isEdit
                ? "변경사항 저장"
                : "행사장 등록"}
          </span>
        </button>
      </div>
    </form>
  );
}
