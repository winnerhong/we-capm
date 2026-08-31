"use client";

// 내 빙고판 + 가족 피드.
//
// 인터랙션 모델 (드래그 없이 탭만으로):
//   1) 피드 카드 탭 → "어디로 옮길까요?" 모드 진입 → 내 판의 빈 칸 탭 → 배치
//   2) 내 판의 채운 칸 탭 → 메뉴(다른 칸으로 이동 / 피드로 빼기)
//   3) "다른 칸으로 이동" → 빈 칸 탭하면 거기로 이동, 채운 칸 탭하면 스왑
//
// 모바일 우선 (드래그는 phase 2 폴리시).

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import { QrScanner } from "@/components/qr-scanner";
import { computeLineFlags } from "@/lib/bingo/lines";
import {
  placeEntryOnCellAction,
  removeEntryFromCellAction,
  submitQrScanAction,
  swapBingoCellsAction,
} from "@/lib/bingo/participant-actions";
import type {
  BingoGridCellRow,
  BingoGridRow,
  BingoEntryRow,
  BingoSize,
} from "@/lib/bingo/types";
import { phraseSizeStyle } from "@/lib/bingo/tile-style";
import type { BingoEntryWithUser } from "@/lib/bingo/queries";

// 빙고판/피드 카드에 노출되는 키워드는 **6글자까지만** 표시한다.
// (등록 시 더 길게 적어도 화면엔 앞 6글자만 보임 — entry-form 에서 안내.)
export const KEYWORD_DISPLAY_MAX = 6;
function displayKeyword(text: string): string {
  return (text ?? "").trim().slice(0, KEYWORD_DISPLAY_MAX);
}

// 키워드 글자수에 따른 폰트 크기 — **컨테이너 쿼리 단위 cqw** 사용.
//   - cqw = 1% of container's inline width (셀/카드 자체 폭 기준)
//   - 글자수(1~6)에 따라 cqw 비율을 다르게 → 짧으면 크게, 길면 작게
//   - 셀이 크든 작든(보드 3×3 ↔ 6×6), 화면이 좁든 넓든 항상 셀 안에 맞춤
//   - 6글자 상한이라 한두 줄로 깔끔히 들어감 (line-clamp 2 안전망).
// 부모 컨테이너에 containerType: 'inline-size' 가 있어야 cqw 가 동작.
function keywordSizeStyle(text: string): React.CSSProperties {
  const len = displayKeyword(text).length;

  let cqw: number;
  if (len <= 1) cqw = 55;       // "🎉" — 큰 임팩트
  else if (len === 2) cqw = 42; // "수박"
  else if (len === 3) cqw = 32; // "물풍선" — 한 줄 가득
  else if (len === 4) cqw = 25; // "여름가족"
  else if (len === 5) cqw = 21; // "행복한꿈나"
  else cqw = 18;                // 6자 — 한두 줄

  return {
    fontSize: `${cqw}cqw`,
    lineHeight: 1.05,
    textShadow:
      "0 2px 4px rgba(0,0,0,.85), 0 0 8px rgba(0,0,0,.6), -1.5px -1.5px 0 #000, 1.5px -1.5px 0 #000, -1.5px 1.5px 0 #000, 1.5px 1.5px 0 #000",
    display: "-webkit-box",
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical" as const,
    overflow: "hidden",
    overflowWrap: "anywhere" as const, // 띄어쓰기 없는 긴 단어도 강제 줄바꿈
  };
}

// 셀/카드 컨테이너 — cqw 가 작동하려면 inline-size container 로 선언.
const CONTAINER_QUERY_STYLE: React.CSSProperties = {
  containerType: "inline-size",
};

type Props = {
  boardId: string;
  size: BingoSize;
  linesToWin: number;
  myUserId: string;
  myEntry: BingoEntryRow | null;
  entries: BingoEntryWithUser[];
  grid: BingoGridRow | null;
  cells: BingoGridCellRow[];
  /** 체크된 entry id 목록 — 일반=호명된 그림 / 싸인 모드=내가 인증한 칸. */
  calledEntryIds: string[];
  /** QR 방식으로 호명된 entry id 목록 — 참가자가 찾아 QR 찍어야 하는 미션. */
  qrReleasedIds: string[];
  /** true 면 배열 타이머가 끝났거나 운영자가 잠금 — 모든 변경 차단. */
  locked: boolean;
};

type SelectMode =
  | { kind: "idle" }
  | { kind: "place"; entryId: string } // 피드에서 카드 선택 → 빈 칸 클릭 대기
  | { kind: "move"; fromPos: number }; // 내 판 셀 선택 → 이동 대상 대기

export function PlayBoard({
  boardId,
  size,
  linesToWin,
  myUserId,
  myEntry,
  entries,
  grid,
  cells,
  calledEntryIds,
  qrReleasedIds,
  locked,
}: Props) {
  const router = useRouter();
  const [mode, setMode] = useState<SelectMode>({ kind: "idle" });
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  // QR 스캐너 모달 열림 여부.
  const [scanOpen, setScanOpen] = useState(false);
  // 내 QR(상대방이 찍을 용도) 이미지 + 크게보기 모달.
  const [myQrUrl, setMyQrUrl] = useState("");
  const [myQrOpen, setMyQrOpen] = useState(false);

  // position → entry 매핑.
  const cellByPosition = useMemo(() => {
    const m = new Map<number, BingoGridCellRow>();
    for (const c of cells) m.set(c.position, c);
    return m;
  }, [cells]);

  // entry id → entry 매핑 (피드 사용).
  const entryById = useMemo(() => {
    const m = new Map<string, BingoEntryWithUser>();
    for (const e of entries) m.set(e.id, e);
    return m;
  }, [entries]);

  // 내 판에 이미 배치된 entry id 셋.
  const placedEntryIds = useMemo(() => {
    return new Set(cells.map((c) => c.entry_id));
  }, [cells]);

  // 운영자가 호명한 entry id 셋.
  const calledSet = useMemo(() => new Set(calledEntryIds), [calledEntryIds]);

  // 기관 고정 타일 — position → entry. 모든 판 같은 칸에 자동 노출(잠김).
  const fixedByPosition = useMemo(() => {
    const m = new Map<number, BingoEntryWithUser>();
    for (const e of entries) {
      if (e.is_org && e.fixed_position != null) m.set(e.fixed_position, e);
    }
    return m;
  }, [entries]);

  // QR 방식으로 호명된 entry 셋.
  const qrReleasedSet = useMemo(() => new Set(qrReleasedIds), [qrReleasedIds]);

  // 내 사진이 QR로 호명됐는지 — 그렇다면 내 QR을 띄워 상대에게 보여준다.
  const myQrReleased = !!myEntry && qrReleasedSet.has(myEntry.id);

  // QR 미션 — QR로 띄운 그림 중 내 판에 있고 아직 인증 안 된 것. (내 사진은 제외)
  const qrTargets = useMemo(() => {
    const fixedIds = new Set([...fixedByPosition.values()].map((e) => e.id));
    return qrReleasedIds
      .filter(
        (id) =>
          (placedEntryIds.has(id) || fixedIds.has(id)) &&
          !calledSet.has(id) &&
          id !== myEntry?.id
      )
      .map((id) => entryById.get(id))
      .filter((e): e is BingoEntryWithUser => !!e);
  }, [
    qrReleasedIds,
    placedEntryIds,
    fixedByPosition,
    calledSet,
    entryById,
    myEntry,
  ]);

  // 내 QR 이미지 생성 — 내 사진이 QR로 호명됐을 때만.
  useEffect(() => {
    if (!myQrReleased || !myEntry) return;
    let cancelled = false;
    QRCode.toDataURL(`WBINGO:${boardId}:${myEntry.id}`, {
      width: 360,
      margin: 1,
      errorCorrectionLevel: "M",
      color: { dark: "#9F1239", light: "#FFFFFF" },
    })
      .then((url) => {
        if (!cancelled) setMyQrUrl(url);
      })
      .catch(() => {
        if (!cancelled) setMyQrUrl("");
      });
    return () => {
      cancelled = true;
    };
  }, [myQrReleased, myEntry, boardId]);

  // 체크된 칸 = (배치 ∩ 호명) ∪ (호명된 고정 타일).
  const checkedPositions = useMemo(() => {
    const s = new Set<number>();
    for (const c of cells) if (calledSet.has(c.entry_id)) s.add(c.position);
    for (const [pos, e] of fixedByPosition) if (calledSet.has(e.id)) s.add(pos);
    return Array.from(s);
  }, [cells, calledSet, fixedByPosition]);

  // 채워진 칸 = 가족 배치 ∪ 고정 타일.
  const filledPositions = useMemo(() => {
    const s = new Set<number>(cells.map((c) => c.position));
    for (const pos of fixedByPosition.keys()) s.add(pos);
    return s;
  }, [cells, fixedByPosition]);

  // 피드 — 고정 배치된 기관 타일은 제외(이미 모든 판에 자동 배치됨).
  const feedEntries = useMemo(
    () => entries.filter((e) => !(e.is_org && e.fixed_position != null)),
    [entries]
  );

  // 라인 강조용 flag — 체크된 칸 기준.
  const lineFlags = useMemo(
    () => computeLineFlags(size, checkedPositions),
    [size, checkedPositions]
  );

  const totalCells = size * size;
  const filledCount = filledPositions.size;
  const checkedCount = checkedPositions.length;
  const linesCompleted = grid?.lines_completed ?? 0;
  const finished = !!grid?.finished_at;

  function clearMode() {
    setMode({ kind: "idle" });
    setError(null);
  }

  function onFeedCardClick(entry: BingoEntryWithUser) {
    setError(null);
    if (locked) {
      setError("지금은 배열 시간이 아니에요 — 운영자가 타이머를 시작하면 옮길 수 있어요");
      return;
    }
    if (placedEntryIds.has(entry.id)) {
      setError("이미 내 빙고판에 올렸어요");
      return;
    }
    setMode({ kind: "place", entryId: entry.id });
  }

  function onCellClick(position: number) {
    setError(null);

    // QR로 띄운 그림 칸을 누르면 QR 스캐너를 연다(찍으면 그 칸이 ⭕).
    {
      const fixedEntry = fixedByPosition.get(position);
      const cell = cellByPosition.get(position);
      const entryId = fixedEntry?.id ?? cell?.entry_id ?? null;
      if (entryId && qrReleasedSet.has(entryId)) {
        if (calledSet.has(entryId)) setError("이미 ⭕ 된 칸이에요");
        else setScanOpen(true);
        return;
      }
    }

    if (locked) {
      setError("지금은 배열 시간이 아니에요 — 운영자가 타이머를 시작하면 옮길 수 있어요");
      return;
    }
    if (fixedByPosition.has(position)) {
      setError("운영자가 고정한 칸이에요 — 바꿀 수 없어요");
      return;
    }
    const existing = cellByPosition.get(position);

    if (mode.kind === "place") {
      // 피드에서 선택한 entry 를 이 칸에 배치 (덮어쓰기 OK).
      const entryId = mode.entryId;
      startTransition(async () => {
        try {
          await placeEntryOnCellAction(boardId, position, entryId);
          clearMode();
          router.refresh();
        } catch (e) {
          setError(e instanceof Error ? e.message : "배치 실패");
        }
      });
      return;
    }

    if (mode.kind === "move") {
      // 같은 칸 다시 누르면 모드 종료.
      if (position === mode.fromPos) {
        clearMode();
        return;
      }
      const fromPos = mode.fromPos;
      startTransition(async () => {
        try {
          await swapBingoCellsAction(boardId, fromPos, position);
          clearMode();
          router.refresh();
        } catch (e) {
          setError(e instanceof Error ? e.message : "이동 실패");
        }
      });
      return;
    }

    // idle 모드.
    if (existing) {
      // 채운 칸 → 이동 모드 진입.
      setMode({ kind: "move", fromPos: position });
    }
    // 빈 칸은 idle 에서 아무 동작 안 함.
  }

  // QR 스캔 결과 처리 — `WBINGO:{boardId}:{entryId}` 에서 entryId 추출 후 인증.
  function onQrScan(text: string) {
    const parts = (text ?? "").trim().split(":");
    if (parts[0] !== "WBINGO") {
      setError("토리 빙고 QR이 아니에요");
      return;
    }
    if (parts[1] && parts[1] !== boardId) {
      setError("다른 빙고의 QR이에요");
      return;
    }
    const entryId = parts.slice(2).join(":");
    if (!entryId) {
      setError("QR을 다시 찍어 주세요");
      return;
    }
    // 내 판에 없는 그림 QR은 인증 불가 — 찍는 즉시 거부.
    const fixedIds = new Set([...fixedByPosition.values()].map((e) => e.id));
    if (!placedEntryIds.has(entryId) && !fixedIds.has(entryId)) {
      const e = entryById.get(entryId);
      setScanOpen(false);
      setError(
        `😢 죄송해요! ${
          e ? `「${displayKeyword(e.keyword)}」 ` : "그 "
        }그림이 내 빙고판에 없어요`
      );
      return;
    }
    if (calledSet.has(entryId)) {
      setScanOpen(false);
      setError("이미 ⭕ 된 그림이에요");
      return;
    }
    if (pending) return;
    setError(null);
    setNotice(null);
    startTransition(async () => {
      try {
        await submitQrScanAction(boardId, entryId);
        setScanOpen(false);
        setNotice("⭕ 인증 완료! 칸에 동그라미가 그려졌어요");
        router.refresh();
      } catch (e) {
        setScanOpen(false);
        setError(e instanceof Error ? e.message : "인증 실패");
      }
    });
  }

  function onRemoveCell(position: number) {
    setError(null);
    startTransition(async () => {
      try {
        await removeEntryFromCellAction(boardId, position);
        clearMode();
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "제거 실패");
      }
    });
  }

  return (
    <section className="space-y-3">
      {/* 📷 내 QR — 내 사진이 QR로 호명됐을 때 상대에게 보여줄 QR */}
      {myQrReleased && myEntry && (
        <div className="rounded-2xl border-2 border-rose-400 bg-gradient-to-br from-rose-100 to-white p-3 text-center shadow-sm">
          <p className="text-[11px] font-bold text-rose-600">
            📷 내 차례예요! 이 QR을 상대방에게 보여주세요
          </p>
          <button
            type="button"
            onClick={() => setMyQrOpen(true)}
            className="mx-auto mt-2 block rounded-2xl border border-rose-200 bg-white p-2 shadow-sm transition active:scale-[0.98]"
          >
            {myQrUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={myQrUrl}
                alt="내 QR"
                width={150}
                height={150}
                className="block h-[150px] w-[150px]"
              />
            ) : (
              <div className="flex h-[150px] w-[150px] items-center justify-center text-xs text-[#8B7F75]">
                QR 생성 중…
              </div>
            )}
          </button>
          <p className="mt-1.5 text-[11px] font-bold text-[#2D5A3D]">
            「{displayKeyword(myEntry.keyword)}」 — 탭하면 크게 보여요
          </p>
        </div>
      )}

      {/* 📷 QR 인증 미션 — QR로 띄운 그림 중 내 판에 있고 아직 미인증인 것 */}
      {qrTargets.length > 0 && (
        <div className="rounded-2xl border-2 border-rose-300 bg-gradient-to-br from-rose-50 to-white p-3 shadow-sm">
          <p className="text-[11px] font-bold text-rose-600">📷 QR 인증 미션</p>
          <p className="mt-1 text-[11px] font-semibold text-[#6B4423]">
            아래 그림을 찾아 QR 인증을 마쳐주세요!
          </p>
          <ul className="mt-2 flex flex-wrap justify-center gap-2">
            {qrTargets.map((e) => (
              <li
                key={e.id}
                className="w-[46%] max-w-[180px] overflow-hidden rounded-xl bg-white ring-1 ring-rose-200"
              >
                {/* 큰 사진/타일 */}
                <div
                  className="relative aspect-square w-full"
                  style={{ containerType: "inline-size" }}
                >
                  {e.is_org ? (
                    <>
                      <div className="absolute inset-0 bg-gradient-to-br from-violet-500 to-fuchsia-600" />
                      <div className="absolute inset-0 flex items-center justify-center overflow-hidden p-2">
                        <span
                          className="break-keep text-center font-extrabold text-white"
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
                  <span className="absolute right-1 top-1 rounded-full bg-rose-500 px-1.5 py-0.5 text-[9px] font-bold text-white shadow">
                    미인증
                  </span>
                </div>
                <div className="px-2 py-1.5 text-center">
                  <p className="truncate text-xs font-extrabold text-[#2D5A3D]">
                    「{displayKeyword(e.keyword)}」
                  </p>
                  <p className="truncate text-[11px] font-bold text-rose-600">
                    {e.is_org
                      ? "기관"
                      : e.child_name
                        ? `${e.child_name} 가족`
                        : e.parent_name || "가족"}
                  </p>
                </div>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => {
              setError(null);
              setScanOpen(true);
            }}
            disabled={pending}
            className="mt-2 w-full rounded-xl bg-rose-500 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-rose-600 active:scale-[0.99] disabled:opacity-50"
          >
            📷 QR 찍어서 인증하기
          </button>
        </div>
      )}

      {/* 진행도 카드 */}
      <div className="rounded-2xl border border-[#D4E4BC] bg-white p-3 shadow-sm">
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold text-[#2D5A3D]">
            {linesCompleted} / {linesToWin}줄 완성
          </span>
          <span className="text-[#6B6560]">
            ✅ {checkedCount} 체크 · {filledCount}/{totalCells} 배치
          </span>
        </div>
        <div className="relative mt-1.5 h-2 w-full overflow-hidden rounded-full bg-[#F4EFE8]">
          <div
            className="absolute inset-y-0 left-0 bg-gradient-to-r from-emerald-400 to-emerald-600 transition-all"
            style={{
              width: `${Math.min(100, (linesCompleted / linesToWin) * 100)}%`,
            }}
          />
        </div>
        {finished && (
          <p className="mt-2 rounded-lg bg-emerald-50 px-2 py-1.5 text-center text-xs font-bold text-emerald-700 ring-1 ring-emerald-200">
            🎉 빙고 완성! 축하해요
          </p>
        )}
      </div>

      {/* 모드 안내 */}
      {mode.kind !== "idle" && (
        <div className="rounded-lg border-2 border-amber-300 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-900">
          {mode.kind === "place"
            ? "📍 사진을 올릴 칸을 선택해 주세요"
            : "📍 옮길 칸을 선택해 주세요 (같은 칸 다시 누르면 취소)"}
          <button
            type="button"
            onClick={clearMode}
            className="ml-2 rounded bg-white px-2 py-0.5 text-[10px] font-bold text-amber-700 hover:bg-amber-100"
          >
            취소
          </button>
        </div>
      )}

      {error && (
        <div role="alert" className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-800">
          {error}
        </div>
      )}

      {notice && (
        <div
          role="status"
          className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800"
        >
          {notice}
        </div>
      )}

      {/* 📷 내 QR 크게보기 — 상대방이 찍기 쉽게 */}
      {myQrOpen && myEntry && (
        <div
          className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-black/85 p-6"
          onClick={() => setMyQrOpen(false)}
        >
          <p className="mb-3 text-center text-base font-bold text-white">
            📷 상대방에게 이 QR을 찍게 해주세요
          </p>
          <div className="rounded-3xl bg-white p-4 shadow-2xl">
            {myQrUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={myQrUrl}
                alt="내 QR"
                width={280}
                height={280}
                className="block h-[280px] w-[280px]"
              />
            ) : (
              <div className="flex h-[280px] w-[280px] items-center justify-center text-sm text-[#8B7F75]">
                QR 생성 중…
              </div>
            )}
          </div>
          <p className="mt-3 text-center text-sm font-bold text-white">
            「{displayKeyword(myEntry.keyword)}」 우리 가족
          </p>
          <p className="mt-4 text-xs text-white/60">탭하면 닫혀요</p>
        </div>
      )}

      {/* 📷 QR 스캔 모달 */}
      {scanOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setScanOpen(false)}
        >
          <div
            className="w-full max-w-xs rounded-2xl bg-white p-4 shadow-2xl"
            onClick={(ev) => ev.stopPropagation()}
          >
            <p className="text-sm font-bold text-[#2D5A3D]">
              📷 운영자 화면의 그림 QR을 찍으세요
            </p>

            <QrScanner
              onScan={onQrScan}
              onError={(m) => setError(m)}
              expectPrefix="WBINGO:"
              buttonLabel="📷 QR 스캔 시작"
              autoStart
              className="mt-3"
            />
            <button
              type="button"
              onClick={() => setScanOpen(false)}
              disabled={pending}
              className="mt-2 w-full rounded-xl border border-[#D4E4BC] bg-white py-2 text-sm font-bold text-[#6B6560] hover:bg-[#F5F1E8]"
            >
              닫기
            </button>
          </div>
        </div>
      )}

      {/* 내 빙고판 */}
      <div className="rounded-2xl border border-[#D4E4BC] bg-white p-3 shadow-sm">
        <h2 className="mb-2 text-sm font-bold text-[#2D5A3D]">📋 내 빙고판</h2>
        <div
          className="grid gap-1.5"
          style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: totalCells }, (_, pos) => {
            // 기관 고정 타일이 이 칸을 점유하면 그게 우선(잠김).
            const fixedEntry = fixedByPosition.get(pos);
            const cell = cellByPosition.get(pos);
            const entry = fixedEntry ?? (cell ? entryById.get(cell.entry_id) : null);
            const isFixed = !!fixedEntry;
            // 호명되어 체크된 칸인지.
            const isChecked = isFixed
              ? calledSet.has(fixedEntry.id)
              : !!cell && calledSet.has(cell.entry_id);
            const row = Math.floor(pos / size);
            const col = pos % size;
            const onLine =
              lineFlags.rows[row] ||
              lineFlags.cols[col] ||
              (row === col && lineFlags.diag) ||
              (row + col === size - 1 && lineFlags.antiDiag);
            const isSourceOfMove =
              mode.kind === "move" && mode.fromPos === pos;
            const hasEntry = isFixed || !!cell;
            const entryIdHere = isFixed
              ? fixedEntry.id
              : cell?.entry_id ?? null;
            // QR로 띄운 그림 칸(고정 포함)은 인증을 위해 누를 수 있음.
            const isQrCell = !!entryIdHere && qrReleasedSet.has(entryIdHere);
            const isClickable =
              !pending &&
              ((isQrCell && hasEntry && !isChecked) ||
                (!isFixed &&
                  (mode.kind === "place" ||
                    (mode.kind === "move" && pos !== mode.fromPos) ||
                    (mode.kind === "idle" && !!cell))));
            return (
              <button
                key={pos}
                type="button"
                onClick={() => onCellClick(pos)}
                disabled={
                  pending ||
                  (isFixed && !isQrCell) ||
                  (!isClickable &&
                    !(isQrCell && hasEntry) &&
                    mode.kind === "idle" &&
                    !cell)
                }
                style={CONTAINER_QUERY_STYLE}
                className={`relative aspect-square overflow-hidden rounded-lg border-2 transition ${
                  isSourceOfMove
                    ? "border-amber-500 ring-2 ring-amber-300"
                    : onLine && isChecked
                      ? "border-emerald-500 ring-2 ring-emerald-300"
                      : isChecked
                        ? "border-emerald-400"
                        : cell
                          ? "border-[#D4E4BC]"
                          : mode.kind === "place"
                            ? "border-amber-300 bg-amber-50/40"
                            : "border-dashed border-[#D4E4BC] bg-[#FFFDF8]"
                } ${isClickable ? "cursor-pointer hover:brightness-105" : ""}`}
              >
                {entry ? (
                  <>
                    {/* 배경 — 가족 사진 or 기관 문구 바탕 */}
                    {entry.is_org ? (
                      <div className="absolute inset-0 bg-gradient-to-br from-violet-500 to-fuchsia-600" />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={entry.photo_url}
                        alt={entry.keyword}
                        className="absolute inset-0 h-full w-full object-cover"
                      />
                    )}
                    {/* 미호명 칸은 어둡게 — 아직 체크 안 됨을 표시. */}
                    {!isChecked && (
                      <div className="absolute inset-0 bg-black/45" />
                    )}
                    {/* 텍스트 — 기관 타일은 문구 전체, 가족 타일은 키워드+가족명 */}
                    {entry.is_org ? (
                      <div className="absolute inset-0 flex items-center justify-center overflow-hidden p-1.5">
                        <span
                          className="break-keep text-center font-extrabold text-white"
                          style={phraseSizeStyle(entry.keyword)}
                        >
                          {entry.keyword}
                        </span>
                      </div>
                    ) : (
                      <div className="absolute inset-0 flex flex-col items-center justify-center overflow-hidden p-1">
                        <span
                          className="break-keep text-center font-extrabold text-white"
                          style={keywordSizeStyle(entry.keyword)}
                        >
                          {displayKeyword(entry.keyword)}
                        </span>
                        <span
                          className="mt-0.5 max-w-full truncate text-center font-bold text-white/95"
                          style={{
                            fontSize: "11cqw",
                            lineHeight: 1.1,
                            textShadow:
                              "0 1px 3px rgba(0,0,0,.9), 0 0 4px rgba(0,0,0,.7)",
                          }}
                        >
                          {entry.child_name
                            ? `${entry.child_name} 가족`
                            : entry.parent_name || "이름 없음"}
                        </span>
                      </div>
                    )}
                    {/* 기관 타일 배지 (고정 칸은 📌) */}
                    {entry.is_org && (
                      <span className="absolute left-0.5 top-0.5 rounded bg-white/85 px-1 text-[8px] font-bold text-violet-700 shadow">
                        {isFixed ? "📌 고정" : "기관"}
                      </span>
                    )}
                    {/* QR 인증 미션 칸 — 아직 미인증이면 깜빡여서 주목 유도. */}
                    {isQrCell && !isChecked && (
                      <>
                        <span className="pointer-events-none absolute inset-0 animate-pulse rounded-lg border-[3px] border-rose-500 bg-rose-500/15" />
                        <span className="pointer-events-none absolute right-0.5 top-0.5 animate-pulse rounded-full bg-rose-500 px-1 text-[8px] font-bold text-white shadow">
                          📷 QR
                        </span>
                      </>
                    )}
                    {/* 호명되어 체크된 칸 — 중앙에 큼직한 동그라미(O) 도장. */}
                    {isChecked && (
                      <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
                        <span
                          className="aspect-square w-[80%] rounded-full border-[6px] border-rose-500"
                          style={{
                            boxShadow:
                              "0 0 10px rgba(244,63,94,.9), inset 0 0 8px rgba(244,63,94,.6)",
                          }}
                        />
                      </span>
                    )}
                  </>
                ) : (
                  <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-[#B0A89C]">
                    {pos + 1}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* move 모드 — 선택한 셀의 추가 액션 */}
        {mode.kind === "move" && (
          <div className="mt-2 flex justify-center">
            <button
              type="button"
              onClick={() => onRemoveCell(mode.fromPos)}
              disabled={pending}
              className="rounded-lg border border-rose-300 bg-white px-3 py-1.5 text-[11px] font-bold text-rose-700 hover:bg-rose-50"
            >
              🗑 선택한 칸 비우기
            </button>
          </div>
        )}
      </div>

      {/* 배열 잠금 안내 — 내 빙고판과 가족 피드 사이 */}
      {locked && (
        <div className="rounded-2xl border-2 border-rose-300 bg-rose-50 p-3 text-center shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-rose-700">
            🔒 배열 시간 종료
          </p>
          <p className="mt-1 text-sm font-bold text-rose-900">
            빙고판이 잠겼어요. 더 이상 바꿀 수 없어요.
          </p>
        </div>
      )}

      {/* 피드 */}
      <div className="rounded-2xl border border-[#D4E4BC] bg-white p-3 shadow-sm">
        <h2 className="mb-2 text-sm font-bold text-[#2D5A3D]">
          🌳 가족 피드 ({feedEntries.length})
        </h2>
        {feedEntries.length === 0 ? (
          <p className="rounded-lg border border-dashed border-[#D4E4BC] bg-[#FFFDF8] px-3 py-6 text-center text-xs text-[#8B7F75]">
            아직 등록된 가족이 없어요. 첫 번째 가족이 되어 보세요!
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {feedEntries.map((e) => {
              const isMine = e.user_id === myUserId;
              const isPlaced = placedEntryIds.has(e.id);
              const isSelected = mode.kind === "place" && mode.entryId === e.id;
              return (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => onFeedCardClick(e)}
                  disabled={pending || isPlaced}
                  style={CONTAINER_QUERY_STYLE}
                  className={`relative aspect-square overflow-hidden rounded-lg border-2 transition ${
                    isSelected
                      ? "border-amber-500 ring-2 ring-amber-300"
                      : isPlaced
                        ? "border-zinc-200 opacity-40"
                        : isMine
                          ? "border-emerald-400 hover:border-emerald-600"
                          : "border-[#D4E4BC] hover:border-[#2D5A3D]"
                  }`}
                >
                  {/* 배경 + 텍스트 — 기관 타일은 문구, 가족 타일은 사진+키워드 */}
                  {e.is_org ? (
                    <>
                      <div className="absolute inset-0 bg-gradient-to-br from-violet-500 to-fuchsia-600" />
                      <div className="absolute inset-0 flex items-center justify-center overflow-hidden p-1.5">
                        <span
                          className="break-keep text-center font-extrabold text-white"
                          style={phraseSizeStyle(e.keyword)}
                        >
                          {e.keyword}
                        </span>
                      </div>
                    </>
                  ) : (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={e.photo_url}
                        alt={e.keyword}
                        className="absolute inset-0 h-full w-full object-cover"
                      />
                      {/* 키워드 — 카드 폭 기준 cqw 로 자동 크기 조절. */}
                      <div className="absolute inset-0 flex items-center justify-center overflow-hidden p-1.5">
                        <span
                          className="break-keep text-center font-extrabold text-white"
                          style={keywordSizeStyle(e.keyword)}
                        >
                          {displayKeyword(e.keyword)}
                        </span>
                      </div>
                    </>
                  )}
                  {e.is_org && (
                    <span className="absolute left-1 top-1 rounded-full bg-white/85 px-1 py-0 text-[8px] font-bold text-violet-700">
                      기관
                    </span>
                  )}
                  {isMine && (
                    <span className="absolute left-1 top-1 rounded-full bg-emerald-500 px-1 py-0 text-[8px] font-bold text-white">
                      우리
                    </span>
                  )}
                  {isPlaced && (
                    <span className="absolute right-1 top-1 rounded-full bg-zinc-700/80 px-1 py-0 text-[8px] font-bold text-white">
                      ✓
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
        <p className="mt-2 text-[10px] text-[#6B6560]">
          {myEntry
            ? "📌 피드 사진을 내 판 칸에 배치하세요. 진행자가 그림을 호명하면 그 칸이 ✓ 체크돼요. 체크된 칸으로 줄을 완성하면 빙고!"
            : "📌 먼저 위에서 우리 가족 사진+키워드를 등록해야 빙고가 시작돼요."}
        </p>
      </div>
    </section>
  );
}
