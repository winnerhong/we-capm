"use client";

import { useEffect, useRef, useState } from "react";

type StopLite = {
  id: string;
  order: number;
  name: string;
  qr_code: string;
  reward_points: number;
};

type Props = {
  trailId: string;
  trailName: string;
  stops: StopLite[];
  totalPoints: number;
};

export function Certificate({ trailId, trailName, stops, totalPoints }: Props) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [name, setName] = useState("");
  const [cleared, setCleared] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [allDone, setAllDone] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(`trail-progress-${trailId}`);
      if (raw) {
        const parsed = JSON.parse(raw) as {
          stops_cleared?: string[];
          name?: string;
        };
        const cl = new Set(parsed.stops_cleared ?? []);
        setCleared(cl);
        if (parsed.name) setName(parsed.name);
        setAllDone(stops.length > 0 && cl.size >= stops.length);
      }
    } catch {
      /* ignore */
    }
  }, [trailId, stops.length]);

  const dateKo = new Date().toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const onDownload = async () => {
    if (!cardRef.current) return;
    setBusy(true);
    try {
      const mod = await import("html2canvas");
      const html2canvas = mod.default;
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: "#FFF8F0",
        scale: 2,
      });
      const dataUrl = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `${trailName}-완주인증.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (e) {
      console.error("[certificate] download failed", e);
      alert("이미지 저장에 실패했어요. 스크린샷을 이용해 주세요.");
    } finally {
      setBusy(false);
    }
  };

  const onShare = async () => {
    const shareText = `🏆 ${trailName} 완주 인증! (총 ${totalPoints}점 · ${stops.length}개 지점)`;
    const shareUrl = window.location.href;

    if (
      typeof navigator !== "undefined" &&
      "share" in navigator &&
      typeof navigator.share === "function"
    ) {
      try {
        await navigator.share({ title: trailName, text: shareText, url: shareUrl });
        return;
      } catch {
        /* 취소 fallback */
      }
    }
    try {
      await navigator.clipboard.writeText(`${shareText}\n${shareUrl}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  if (!allDone) {
    return (
      <section className="rounded-3xl bg-white shadow-lg p-8 text-center">
        <div className="text-5xl mb-3" aria-hidden>
          🔒
        </div>
        <h1 className="text-xl font-extrabold text-[#2D5A3D]">
          아직 완주하지 않았어요
        </h1>
        <p className="mt-2 text-sm text-zinc-600">
          모든 지점의 미션을 완료해야 인증서를 받을 수 있어요.
        </p>
        <p className="mt-3 text-xs text-zinc-500">
          방문한 지점: {cleared.size} / {stops.length}
        </p>
      </section>
    );
  }

  return (
    <div className="space-y-4">
      {/* 인증서 — 이미지 캡처 대상 */}
      <div
        ref={cardRef}
        className="relative rounded-3xl bg-[#FFF8F0] p-8 shadow-2xl"
        style={{
          border: "4px double #FFD700",
          boxShadow: "0 20px 50px rgba(45,90,61,0.25)",
        }}
      >
        {/* 장식 코너 */}
        <div className="absolute top-3 left-3 text-2xl" aria-hidden>
          🌲
        </div>
        <div className="absolute top-3 right-3 text-2xl" aria-hidden>
          🌲
        </div>
        <div className="absolute bottom-3 left-3 text-2xl" aria-hidden>
          🍃
        </div>
        <div className="absolute bottom-3 right-3 text-2xl" aria-hidden>
          🍃
        </div>

        <div className="text-center">
          <div className="text-5xl mb-2" aria-hidden>
            🏆
          </div>
          <p className="text-xs font-semibold tracking-[0.3em] text-[#C4956A]">
            CERTIFICATE
          </p>
          <h1 className="mt-1 text-2xl font-extrabold text-[#2D5A3D] leading-tight">
            {trailName}
            <br />
            완주 인증
          </h1>
          <div className="my-4 h-px bg-gradient-to-r from-transparent via-[#C4956A] to-transparent" />

          <p className="text-sm text-zinc-700">아래 참여자는</p>
          <p className="my-2 text-3xl font-extrabold text-[#2D5A3D]">
            {name || "이름 없는 모험가"}
          </p>
          <p className="text-sm text-zinc-700">
            <b>{trailName}</b> 숲길의 모든 지점을
            <br />
            성공적으로 완주하였기에 이를 인증합니다.
          </p>

          <div className="mt-5 grid grid-cols-2 gap-3 text-center">
            <div className="rounded-xl bg-white/70 px-3 py-2">
              <p className="text-[10px] text-zinc-500">획득 점수</p>
              <p className="text-lg font-extrabold text-[#C4956A]">
                ⭐ {totalPoints}점
              </p>
            </div>
            <div className="rounded-xl bg-white/70 px-3 py-2">
              <p className="text-[10px] text-zinc-500">방문 지점</p>
              <p className="text-lg font-extrabold text-[#2D5A3D]">
                {stops.length}곳
              </p>
            </div>
          </div>

          <p className="mt-5 text-xs text-zinc-600">완주 일자 · {dateKo}</p>

          {/* 방문한 지점 */}
          <div className="mt-4 rounded-2xl bg-white/60 p-3 text-left">
            <p className="text-[10px] font-bold text-[#2D5A3D] mb-1 text-center">
              — 방문한 지점 —
            </p>
            <ol className="space-y-0.5 text-xs text-zinc-700">
              {stops.map((s) => (
                <li key={s.id} className="flex items-center gap-2">
                  <span className="w-5 text-center font-bold text-[#4A7C59]">
                    {s.order}
                  </span>
                  <span className="flex-1 truncate">{s.name}</span>
                  <span className="text-[#C4956A] font-semibold">
                    +{s.reward_points}
                  </span>
                </li>
              ))}
            </ol>
          </div>

          <p className="mt-4 text-[10px] text-zinc-500">토리로 · 나만의 숲길 체험</p>
        </div>
      </div>

      {/* 이름 미입력 시 안내 */}
      {!name && (
        <div>
          <label
            htmlFor="cert-name"
            className="block text-xs font-semibold text-zinc-600 mb-1"
          >
            인증서에 표시할 이름
          </label>
          <input
            id="cert-name"
            type="text"
            autoComplete="name"
            value={name}
            onChange={(e) => {
              const v = e.target.value;
              setName(v);
              try {
                const key = `trail-progress-${trailId}`;
                const raw = localStorage.getItem(key);
                const prev = raw ? JSON.parse(raw) : {};
                localStorage.setItem(
                  key,
                  JSON.stringify({ ...prev, name: v })
                );
              } catch {
                /* ignore */
              }
            }}
            className="w-full rounded-xl border-2 border-[#D4E4BC] focus:border-[#2D5A3D] bg-white px-3 py-2 text-sm outline-none"
            placeholder="홍길동"
          />
        </div>
      )}

      {/* 액션 */}
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onDownload}
          disabled={busy}
          className="h-12 rounded-xl bg-[#2D5A3D] text-white font-bold disabled:opacity-60"
        >
          {busy ? "저장 중..." : "📥 이미지 저장"}
        </button>
        <button
          type="button"
          onClick={onShare}
          className="h-12 rounded-xl bg-white border-2 border-[#2D5A3D] text-[#2D5A3D] font-bold"
        >
          {copied ? "✅ 복사됨" : "🔗 공유하기"}
        </button>
      </div>
    </div>
  );
}
