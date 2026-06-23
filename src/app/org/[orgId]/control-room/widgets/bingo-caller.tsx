"use client";

// 🎤 관제실 호명 그리드 — 그림마다 방식을 골라 호명한다.
//   ⭕ 동그라미: 그 그림을 가진 모든 참가자 자동 ⭕
//   📷 QR     : 그 그림의 QR을 띄워주고, 참가자가 찾아 찍어야 ⭕

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import {
  setBingoCallAction,
  resetBingoCallsAction,
} from "@/lib/bingo/actions";
import { phraseSizeStyle } from "@/lib/bingo/tile-style";
import type { BingoEntryWithUser } from "@/lib/bingo/queries";

function short(text: string): string {
  return (text ?? "").trim().slice(0, 6);
}

export function BingoCaller({
  boardId,
  entries,
}: {
  boardId: string;
  entries: BingoEntryWithUser[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  // QR 표시 모달 — 띄울 그림 + 그 QR 이미지.
  const [qrEntry, setQrEntry] = useState<BingoEntryWithUser | null>(null);
  const [qrUrl, setQrUrl] = useState("");

  const calledCount = entries.filter((e) => e.called_at).length;

  function openQr(e: BingoEntryWithUser) {
    setQrEntry(e);
    setQrUrl("");
    QRCode.toDataURL(`WBINGO:${boardId}:${e.id}`, {
      width: 320,
      margin: 1,
      errorCorrectionLevel: "M",
      color: { dark: "#9F1239", light: "#FFFFFF" },
    })
      .then(setQrUrl)
      .catch(() => setQrUrl(""));
  }

  function setMode(
    e: BingoEntryWithUser,
    mode: "CIRCLE" | "QR",
    openQrAfter = false
  ) {
    if (pending) return;
    setBusyId(e.id);
    startTransition(async () => {
      try {
        await setBingoCallAction(boardId, e.id, mode);
        if (openQrAfter) openQr(e);
        router.refresh();
      } finally {
        setBusyId(null);
      }
    });
  }

  // ⭕ 버튼 — 자동 동그라미로 호명/해제.
  function onCircle(e: BingoEntryWithUser) {
    setMode(e, "CIRCLE");
  }

  // 📷 버튼 — 이미 QR로 호명돼 있으면 QR 다시 보여주기, 아니면 QR로 호명 + 표시.
  function onQr(e: BingoEntryWithUser) {
    if (e.called_at && e.call_mode === "QR") {
      openQr(e);
      return;
    }
    setMode(e, "QR", true);
  }

  function resetAll() {
    if (pending) return;
    if (calledCount === 0) return;
    if (!window.confirm("호명을 모두 취소할까요? (모든 가족 판의 체크가 풀려요)"))
      return;
    setBusyId("__reset__");
    startTransition(async () => {
      try {
        await resetBingoCallsAction(boardId);
        router.refresh();
      } finally {
        setBusyId(null);
      }
    });
  }

  if (entries.length === 0) return null;

  return (
    <div className="mt-2 rounded-lg bg-black/20 p-2 ring-1 ring-white/10">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="text-[10px] font-bold text-amber-200">
          🎤 그림 호명 ({calledCount}/{entries.length})
        </span>
        <button
          type="button"
          onClick={resetAll}
          disabled={pending || calledCount === 0}
          className="rounded-md bg-white/10 px-1.5 py-0.5 text-[9px] font-bold text-white/70 hover:bg-white/20 disabled:opacity-40"
        >
          전체 취소
        </button>
      </div>
      <p className="mb-1.5 rounded-md bg-white/5 px-2 py-1 text-[9px] leading-tight text-white/60">
        그림마다 <b className="text-rose-200">⭕</b>(모든 참가자 자동 동그라미) 또는{" "}
        <b className="text-rose-200">📷</b>(참가자가 상대 찾아 QR 찍기)를 골라
        누르세요.
      </p>
      <div className="grid grid-cols-5 gap-1.5 sm:grid-cols-6">
        {entries.map((e) => {
          const busy = busyId === e.id;
          const circleOn = !!e.called_at && e.call_mode === "CIRCLE";
          const qrOn = !!e.called_at && e.call_mode === "QR";
          const called = circleOn || qrOn;
          const family = e.is_org
            ? "기관"
            : e.child_name
              ? `${e.child_name} 가족`
              : e.parent_name || "이름 없음";
          return (
            <div key={e.id} className="group relative flex flex-col gap-0.5">
              {/* 호버 확대 미리보기 — 해당 칸 바로 위에 표시 */}
              <div className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 hidden w-[19.2rem] max-w-[90vw] -translate-x-1/2 group-hover:block">
                <div className="overflow-hidden rounded-2xl border border-white/20 bg-zinc-900/95 shadow-2xl ring-1 ring-black/40">
                  <div
                    className="relative aspect-square w-full"
                    style={{ containerType: "inline-size" }}
                  >
                    {e.is_org ? (
                      <>
                        <div className="absolute inset-0 bg-gradient-to-br from-violet-500 to-fuchsia-600" />
                        <div className="absolute inset-0 flex items-center justify-center overflow-hidden p-4">
                          <span
                            className="break-keep text-center font-extrabold leading-tight text-white"
                            style={phraseSizeStyle(e.keyword)}
                          >
                            {e.keyword}
                          </span>
                        </div>
                      </>
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={e.photo_url}
                        alt={e.keyword}
                        className="absolute inset-0 h-full w-full object-cover"
                      />
                    )}
                  </div>
                  <div className="flex items-baseline gap-2 px-2.5 py-2">
                    <span className="min-w-0 flex-1 truncate text-left text-lg font-extrabold text-white">
                      {e.keyword}
                    </span>
                    <span className="shrink-0 truncate text-right text-[11px] font-normal text-white/60">
                      {family}
                    </span>
                  </div>
                </div>
              </div>

              {/* 그림 */}
              <div
                style={{ containerType: "inline-size" }}
                className={`relative aspect-square overflow-hidden rounded-md border-2 ${
                  called
                    ? "border-emerald-400 ring-2 ring-emerald-300/60"
                    : "border-white/15 opacity-70"
                }`}
              >
                {e.is_org ? (
                  <>
                    <div className="absolute inset-0 bg-gradient-to-br from-violet-500 to-fuchsia-600" />
                    <div className="absolute inset-0 flex items-center justify-center overflow-hidden p-1">
                      <span
                        className="break-keep text-center font-extrabold text-white"
                        style={phraseSizeStyle(e.keyword)}
                      >
                        {e.keyword}
                      </span>
                    </div>
                    <span className="absolute left-0.5 top-0.5 rounded bg-white/85 px-1 text-[7px] font-bold text-violet-700">
                      기관
                    </span>
                  </>
                ) : (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={e.photo_url}
                      alt={e.keyword}
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                    <span className="absolute inset-x-0 bottom-0 truncate bg-black/55 px-0.5 text-center text-[9px] font-bold text-white">
                      {short(e.keyword)}
                    </span>
                  </>
                )}
                {/* ⭕ 동그라미 호명 — 중앙 도장 */}
                {circleOn && (
                  <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <span
                      className="aspect-square w-[80%] rounded-full border-[5px] border-rose-500"
                      style={{
                        boxShadow:
                          "0 0 10px rgba(244,63,94,.9), inset 0 0 8px rgba(244,63,94,.6)",
                      }}
                    />
                  </span>
                )}
                {/* 📷 QR 호명 — 상단 배지 */}
                {qrOn && (
                  <span className="pointer-events-none absolute inset-x-0 top-0 bg-rose-600/90 py-0.5 text-center text-[10px] font-extrabold tracking-wide text-white">
                    📷 QR
                  </span>
                )}
                {busy && (
                  <span className="absolute inset-0 flex items-center justify-center bg-black/50 text-[9px] font-bold text-white">
                    …
                  </span>
                )}
              </div>

              {/* ⭕ / 📷 선택 버튼 */}
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => onCircle(e)}
                  disabled={pending}
                  title="모든 참가자 자동 동그라미"
                  className={`flex flex-1 items-center justify-center rounded-md py-1.5 text-lg leading-none transition disabled:opacity-50 ${
                    circleOn
                      ? "bg-rose-500 ring-1 ring-rose-300"
                      : "bg-white/10 hover:bg-white/20"
                  }`}
                >
                  ⭕
                </button>
                <button
                  type="button"
                  onClick={() => onQr(e)}
                  disabled={pending}
                  title="QR 띄우기 — 참가자가 찾아 찍기"
                  className={`flex flex-1 items-center justify-center rounded-md py-1.5 text-lg leading-none transition disabled:opacity-50 ${
                    qrOn
                      ? "bg-rose-500 ring-1 ring-rose-300"
                      : "bg-white/10 hover:bg-white/20"
                  }`}
                >
                  📷
                </button>
              </div>

              <span
                className={`truncate text-center text-[12px] font-bold leading-tight ${
                  called ? "text-emerald-200" : "text-white/60"
                }`}
                title={family}
              >
                {family}
              </span>
            </div>
          );
        })}
      </div>

      {/* 📷 QR 표시 모달 — 참가자에게 보여줄 큰 QR */}
      {qrEntry && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4"
          onClick={() => setQrEntry(null)}
        >
          <div
            className="w-full max-w-sm rounded-3xl bg-white p-5 text-center shadow-2xl"
            onClick={(ev) => ev.stopPropagation()}
          >
            <p className="text-xs font-bold text-rose-600">
              📷 이 QR을 찍어 인증하세요
            </p>
            <h3 className="mt-1 text-xl font-extrabold text-[#2D5A3D]">
              {qrEntry.is_org
                ? qrEntry.keyword
                : qrEntry.child_name
                  ? `${qrEntry.child_name} 가족`
                  : qrEntry.parent_name || "그림"}
            </h3>
            {!qrEntry.is_org && (
              <p className="text-xs text-[#6B6560]">🗝 {qrEntry.keyword}</p>
            )}
            <div className="mt-3 flex justify-center">
              {qrUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={qrUrl}
                  alt="그림 QR"
                  width={300}
                  height={300}
                  className="block h-[300px] w-[300px] rounded-xl border border-rose-100"
                />
              ) : (
                <div className="flex h-[300px] w-[300px] items-center justify-center text-sm text-[#8B7F75]">
                  QR 생성 중…
                </div>
              )}
            </div>
            <p className="mt-3 text-[11px] text-[#6B6560]">
              이 그림을 자기 판에 가진 참가자가 QR을 찍으면 그 칸이 ⭕ 됩니다.
            </p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setMode(qrEntry, "QR");
                  setQrEntry(null);
                }}
                disabled={pending}
                className="flex-1 rounded-xl border border-rose-200 bg-white py-2 text-sm font-bold text-rose-600 hover:bg-rose-50 disabled:opacity-50"
              >
                호명 취소
              </button>
              <button
                type="button"
                onClick={() => setQrEntry(null)}
                className="flex-1 rounded-xl bg-[#2D5A3D] py-2 text-sm font-bold text-white hover:bg-[#3A7A52]"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
