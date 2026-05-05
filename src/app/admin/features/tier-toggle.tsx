"use client";

import { useState, useTransition } from "react";
import {
  PACK_TIER_META,
  PACK_TIERS,
  type PackTier,
} from "@/lib/features/types";
import { changeFeatureTierAction } from "./actions";

type Policy = "GRANDFATHER" | "AUTO_GRANT" | "REVOKE_ALL";

export function TierToggle({
  code,
  current,
}: {
  code: string;
  current: PackTier;
}) {
  const [pending, start] = useTransition();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [confirm, setConfirm] = useState<{ next: PackTier } | null>(null);
  const [policy, setPolicy] = useState<Policy>("GRANDFATHER");

  const meta = PACK_TIER_META[current];

  const onPick = (next: PackTier) => {
    setPickerOpen(false);
    if (next === current) return;
    setPolicy("GRANDFATHER");
    setConfirm({ next });
  };

  const onSubmit = () => {
    if (!confirm) return;
    start(async () => {
      const res = await changeFeatureTierAction(code, confirm.next, policy);
      if (!res.ok) {
        alert(res.message);
        return;
      }
      setConfirm(null);
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setPickerOpen((v) => !v)}
        disabled={pending}
        className={`relative inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition ${
          current === "BASIC"
            ? "border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
            : current === "OPTIONAL"
              ? "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100"
              : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
        }`}
      >
        <span aria-hidden>{meta.emoji}</span>
        <span>{meta.label}</span>
        <span aria-hidden className="text-[9px] opacity-60">
          ▼
        </span>
        {pickerOpen && (
          <div className="absolute left-0 top-full z-30 mt-1 w-48 overflow-hidden rounded-xl border border-[#D4E4BC] bg-white text-left shadow-lg">
            {PACK_TIERS.map((t) => {
              const tm = PACK_TIER_META[t];
              const active = t === current;
              return (
                <div
                  key={t}
                  onClick={(e) => {
                    e.stopPropagation();
                    onPick(t);
                  }}
                  className={`cursor-pointer px-3 py-2 text-xs transition ${
                    active
                      ? "bg-[#FFF8F0] font-bold text-[#2D5A3D]"
                      : "text-[#2C2C2C] hover:bg-[#FFF8F0]"
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <span>{tm.emoji}</span>
                    <span>{tm.label}</span>
                    {active && <span className="ml-auto">✓</span>}
                  </div>
                  <div className="mt-0.5 text-[10px] font-normal text-[#6B6560]">
                    {tm.desc}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </button>

      {/* Confirm modal */}
      {confirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setConfirm(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-bold text-[#2D5A3D]">
              분류 변경 확인
            </h3>
            <p className="mt-2 text-sm text-[#6B6560]">
              <span className="font-mono text-xs">{code}</span>의 분류를{" "}
              <b>{PACK_TIER_META[current].label}</b> →{" "}
              <b>{PACK_TIER_META[confirm.next].label}</b> 로 변경합니다.
            </p>

            <fieldset className="mt-4 space-y-2 rounded-xl border border-[#F0EBE3] p-3">
              <legend className="px-1 text-xs font-semibold text-[#2D5A3D]">
                기존 보유 지사 처리 방식
              </legend>
              <label className="flex items-start gap-2 text-xs">
                <input
                  type="radio"
                  name="policy"
                  value="GRANDFATHER"
                  checked={policy === "GRANDFATHER"}
                  onChange={() => setPolicy("GRANDFATHER")}
                  className="mt-0.5"
                />
                <span>
                  <b>그대로 유지 (권장)</b> — 기존 보유 지사 권한 변경 없음
                </span>
              </label>
              {confirm.next === "BASIC" && current === "OPTIONAL" && (
                <label className="flex items-start gap-2 text-xs">
                  <input
                    type="radio"
                    name="policy"
                    value="AUTO_GRANT"
                    checked={policy === "AUTO_GRANT"}
                    onChange={() => setPolicy("AUTO_GRANT")}
                    className="mt-0.5"
                  />
                  <span>
                    <b>모든 지사에 자동 부여</b> — 미보유 지사 전체에 ACTIVE
                    grant
                  </span>
                </label>
              )}
              {confirm.next !== "BASIC" && current === "BASIC" && (
                <label className="flex items-start gap-2 text-xs text-rose-700">
                  <input
                    type="radio"
                    name="policy"
                    value="REVOKE_ALL"
                    checked={policy === "REVOKE_ALL"}
                    onChange={() => setPolicy("REVOKE_ALL")}
                    className="mt-0.5"
                  />
                  <span>
                    <b>전체 회수 (위험)</b> — 모든 지사의 grant 즉시 REVOKED
                  </span>
                </label>
              )}
            </fieldset>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                disabled={pending}
                onClick={() => setConfirm(null)}
                className="rounded-xl border border-[#D4E4BC] bg-white px-3 py-1.5 text-xs font-semibold text-[#6B6560] hover:bg-[#FFF8F0]"
              >
                취소
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={onSubmit}
                className="rounded-xl bg-[#2D5A3D] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#3A7A52] disabled:opacity-50"
              >
                {pending ? "변경 중..." : "변경"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
