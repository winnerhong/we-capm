"use client";

import { useCallback, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { compressImage } from "@/lib/image-compress";
import type {
  CoopMissionConfig,
  MissionCoopSessionRow,
  OrgMissionRow,
} from "@/lib/missions/types";
import { COOP_STATE_META } from "@/lib/missions/types";
import {
  cancelCoopSessionAction,
  confirmCoopSideAction,
  createCoopSessionAction,
  joinCoopSessionAction,
  uploadCoopSharedPhotoAction,
} from "@/lib/missions/coop-actions";
import { Countdown } from "./Countdown";
import { AcornIcon } from "@/components/acorn-icon";

const BUCKET = "submission-photos";

interface KidOption {
  id: string;
  name: string;
}

interface Props {
  mission: OrgMissionRow;
  config: CoopMissionConfig;
  initialSession: MissionCoopSessionRow | null;
  currentUserId: string;
  kids: KidOption[];
  partnerName?: string | null;
}

export function CoopRunner({
  mission,
  config,
  initialSession,
  currentUserId,
  kids,
  partnerName,
}: Props) {
  const router = useRouter();
  const [pairCodeInput, setPairCodeInput] = useState("");
  const [selectedChildId, setSelectedChildId] = useState<string>(
    kids[0]?.id ?? ""
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copyToast, setCopyToast] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const session = initialSession;
  const completionRule = config.completion_rule ?? "BOTH_CONFIRM";

  // 내 역할 판정 (A = initiator, B = partner)
  const myRole: "A" | "B" | null = useMemo(() => {
    if (!session) return null;
    if (session.initiator_user_id === currentUserId) return "A";
    if (session.partner_user_id === currentUserId) return "B";
    return null;
  }, [session, currentUserId]);

  const mySubmissionId = useMemo(() => {
    if (!session || !myRole) return null;
    return myRole === "A"
      ? session.initiator_submission_id
      : session.partner_submission_id;
  }, [session, myRole]);

  const partnerSubmissionId = useMemo(() => {
    if (!session || !myRole) return null;
    return myRole === "A"
      ? session.partner_submission_id
      : session.initiator_submission_id;
  }, [session, myRole]);

  const handleCreate = () => {
    setErrorMsg(null);
    startTransition(async () => {
      try {
        await createCoopSessionAction(
          mission.id,
          selectedChildId || undefined
        );
        router.refresh();
      } catch (e) {
        setErrorMsg(e instanceof Error ? e.message : String(e));
      }
    });
  };

  const handleJoin = () => {
    const code = pairCodeInput.trim().toUpperCase();
    if (code.length < 4) {
      setErrorMsg("짝꿍 코드를 입력해 주세요");
      return;
    }
    setErrorMsg(null);
    startTransition(async () => {
      try {
        await joinCoopSessionAction(
          mission.id,
          code,
          selectedChildId || undefined
        );
        router.refresh();
      } catch (e) {
        setErrorMsg(e instanceof Error ? e.message : String(e));
      }
    });
  };

  const handleCancel = () => {
    if (!session) return;
    if (!confirm("정말 취소할까요? 짝꿍에게도 알림이 갈 거예요")) return;
    setErrorMsg(null);
    startTransition(async () => {
      try {
        await cancelCoopSessionAction(session.id);
        router.refresh();
      } catch (e) {
        setErrorMsg(e instanceof Error ? e.message : String(e));
      }
    });
  };

  const handleConfirmSide = () => {
    if (!session || !myRole) return;
    setErrorMsg(null);
    startTransition(async () => {
      try {
        await confirmCoopSideAction(session.id, myRole);
        router.refresh();
      } catch (e) {
        setErrorMsg(e instanceof Error ? e.message : String(e));
      }
    });
  };

  const handleCopyCode = async () => {
    if (!session) return;
    try {
      await navigator.clipboard.writeText(session.pair_code);
      setCopyToast(true);
      setTimeout(() => setCopyToast(false), 1500);
    } catch {
      setErrorMsg("클립보드 복사에 실패했어요. 길게 눌러서 복사해 주세요");
    }
  };

  const handleSharedPhotoUpload = useCallback(
    async (files: FileList | File[]) => {
      if (!session) return;
      const list = Array.from(files).filter((f) =>
        f.type.startsWith("image/")
      );
      if (list.length === 0) return;
      const file = list[0];

      setUploading(true);
      setErrorMsg(null);
      setUploadStatus("압축 중...");

      try {
        const compressed = await compressImage(file, { maxKb: 500 });
        setUploadStatus("업로드 중...");

        const supabase = createClient();
        const rand = Math.random().toString(36).slice(2, 8);
        const path = `coop/${session.id}/${Date.now()}-${rand}.jpg`;
        const { error } = await supabase.storage
          .from(BUCKET)
          .upload(path, compressed, {
            contentType: compressed.type,
            upsert: false,
          });
        if (error) throw error;
        const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
        const publicUrl = data.publicUrl;

        await uploadCoopSharedPhotoAction(session.id, publicUrl);
        router.refresh();
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setErrorMsg(`업로드 실패: ${msg}`);
      } finally {
        setUploading(false);
        setUploadStatus(null);
      }
    },
    [session, router]
  );

  /* ------------------------------------------------------------ */
  /* RENDER                                                         */
  /* ------------------------------------------------------------ */

  // 1) 세션 없음 — 생성/합류 진입
  if (!session) {
    return (
      <div className="space-y-4">
        <section className="rounded-3xl border border-[#D4E4BC] bg-white p-5 shadow-sm">
          <h2 className="flex items-center gap-2 text-base font-bold text-[#2D5A3D]">
            <span aria-hidden>🤝</span>
            협동 미션 시작하기
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-[#3D3A36]">
            두 가족이 함께 완성하는 미션이에요. 한 명이 짝꿍 코드를 만들고
            다른 한 명이 코드를 입력하면 시작돼요.
          </p>
          <p className="mt-2 rounded-2xl bg-[#FFF8F0] px-3 py-2 text-[12px] text-[#6B6560]">
            짝꿍 코드는 {config.match_window_min}분 동안 유효해요
            {completionRule === "SHARED_PHOTO"
              ? " · 한 장의 사진을 함께 공유해요"
              : " · 각자 완료 버튼을 눌러요"}
          </p>
        </section>

        {kids.length > 0 && (
          <section className="rounded-3xl border border-[#D4E4BC] bg-white p-4 shadow-sm">
            <label
              htmlFor="coop-child"
              className="block text-sm font-bold text-[#2D5A3D]"
            >
              🪴 함께할 아이 선택
            </label>
            <select
              id="coop-child"
              value={selectedChildId}
              onChange={(e) => setSelectedChildId(e.target.value)}
              className="mt-2 min-h-[48px] w-full rounded-2xl border border-[#D4E4BC] bg-[#FFF8F0] px-4 py-3 text-base text-[#3D3A36] outline-none focus:border-[#2D5A3D] focus:ring-2 focus:ring-[#2D5A3D]/20"
            >
              <option value="">아이 선택 없이 진행</option>
              {kids.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.name}
                </option>
              ))}
            </select>
          </section>
        )}

        <section className="space-y-3 rounded-3xl border border-[#D4E4BC] bg-white p-5 shadow-sm">
          <button
            type="button"
            onClick={handleCreate}
            disabled={isPending}
            className="min-h-[56px] w-full rounded-2xl bg-[#2D5A3D] px-4 py-3 text-base font-bold text-white shadow-sm transition hover:bg-[#3A7A52] active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-[#B8C7B0]"
          >
            {isPending ? "만드는 중..." : "👫 새 짝꿍 코드 만들기"}
          </button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center" aria-hidden>
              <div className="w-full border-t border-[#D4E4BC]" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-white px-3 text-[11px] font-semibold text-[#8B7F75]">
                또는
              </span>
            </div>
          </div>

          <div>
            <label
              htmlFor="coop-code"
              className="block text-sm font-bold text-[#2D5A3D]"
            >
              🔑 받은 짝꿍 코드 입력
            </label>
            <input
              id="coop-code"
              type="text"
              value={pairCodeInput}
              onChange={(e) =>
                setPairCodeInput(e.target.value.toUpperCase().slice(0, 8))
              }
              placeholder="예: ABC123"
              inputMode="text"
              autoCapitalize="characters"
              autoComplete="off"
              className="mt-2 min-h-[48px] w-full rounded-2xl border border-[#D4E4BC] bg-[#FFF8F0] px-4 py-3 text-center text-lg font-mono font-bold tracking-[0.3em] text-[#3D3A36] outline-none focus:border-[#2D5A3D] focus:ring-2 focus:ring-[#2D5A3D]/20"
            />
            <button
              type="button"
              onClick={handleJoin}
              disabled={isPending || pairCodeInput.trim().length < 4}
              className="mt-2 min-h-[48px] w-full rounded-2xl border-2 border-[#2D5A3D] bg-white px-4 py-3 text-sm font-bold text-[#2D5A3D] transition hover:bg-[#F5F1E8] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isPending ? "합류 중..." : "🌿 짝꿍에 합류하기"}
            </button>
          </div>
        </section>

        {errorMsg && (
          <div
            role="alert"
            className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800"
          >
            ⚠️ {errorMsg}
          </div>
        )}
      </div>
    );
  }

  // 2) 세션 상태별 렌더
  const stateMeta = COOP_STATE_META[session.state];

  // WAITING
  if (session.state === "WAITING") {
    return (
      <div className="space-y-4">
        <section
          className={`rounded-3xl border p-5 shadow-sm ${stateMeta.color}`}
        >
          <div className="flex items-center justify-between gap-2">
            <p className="inline-flex items-center gap-2 text-sm font-bold">
              <span aria-hidden>{stateMeta.icon}</span>
              <span className="animate-pulse">{stateMeta.label}</span>
            </p>
            <Countdown expiresAt={session.expires_at} urgentSec={60} />
          </div>
          <p className="mt-3 text-center text-[11px] font-semibold uppercase tracking-widest opacity-80">
            짝꿍 코드
          </p>
          <p className="mt-1 text-center text-4xl font-mono font-bold tracking-[0.3em]">
            {session.pair_code}
          </p>
          <button
            type="button"
            onClick={handleCopyCode}
            className="mt-3 min-h-[44px] w-full rounded-2xl border border-current/20 bg-white/60 px-4 py-2 text-sm font-bold backdrop-blur-sm transition hover:bg-white/80"
          >
            📋 코드 복사
          </button>
          {copyToast && (
            <p
              role="status"
              className="mt-2 text-center text-[12px] font-semibold"
            >
              ✅ 복사 완료!
            </p>
          )}
        </section>

        <section className="rounded-3xl border border-[#D4E4BC] bg-white p-4 shadow-sm">
          <p className="text-sm text-[#6B6560]">
            다른 가족에게 위 코드를 공유해 주세요. 짝꿍이 코드를 입력하면
            자동으로 시작돼요.
          </p>
        </section>

        {errorMsg && (
          <div
            role="alert"
            className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800"
          >
            ⚠️ {errorMsg}
          </div>
        )}

        <button
          type="button"
          onClick={handleCancel}
          disabled={isPending}
          className="min-h-[48px] w-full rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700 transition hover:bg-rose-100 disabled:opacity-50"
        >
          ❌ 짝꿍 코드 취소
        </button>
      </div>
    );
  }

  // EXPIRED / CANCELLED
  if (session.state === "EXPIRED" || session.state === "CANCELLED") {
    return (
      <div className="space-y-4">
        <section
          className={`rounded-3xl border p-5 text-center shadow-sm ${stateMeta.color}`}
        >
          <p className="text-5xl" aria-hidden>
            {stateMeta.icon}
          </p>
          <h2 className="mt-2 text-base font-bold">{stateMeta.label}</h2>
          <p className="mt-1 text-xs">
            {session.state === "EXPIRED"
              ? "제한 시간 안에 짝꿍이 합류하지 못했어요"
              : "세션이 취소되었어요"}
          </p>
        </section>
        <button
          type="button"
          onClick={() => router.refresh()}
          className="min-h-[56px] w-full rounded-2xl bg-[#2D5A3D] px-4 py-3 text-base font-bold text-white shadow-sm transition hover:bg-[#3A7A52]"
        >
          🌱 새로 시작하기
        </button>
      </div>
    );
  }

  // COMPLETED
  if (session.state === "COMPLETED") {
    return (
      <div className="space-y-4">
        <section
          className={`rounded-3xl border p-6 text-center shadow-sm ${stateMeta.color}`}
        >
          <p className="text-5xl" aria-hidden>
            🎉
          </p>
          <h2 className="mt-2 text-lg font-bold">함께 완성했어요!</h2>
          <p className="mt-2 inline-flex items-center gap-1 rounded-full bg-white/60 px-3 py-1 text-sm font-bold">
            <AcornIcon size={18} /> +{mission.acorns} 도토리 획득
          </p>
          {partnerName && (
            <p className="mt-3 text-xs opacity-80">
              {partnerName}님과 함께 완료했어요
            </p>
          )}
        </section>
        <a
          href={
            mission.quest_pack_id
              ? `/stampbook/${mission.quest_pack_id}`
              : "/stampbook"
          }
          className="block w-full rounded-2xl bg-[#2D5A3D] px-4 py-3 text-center text-sm font-bold text-white shadow-sm transition hover:bg-[#3A7A52]"
        >
          ← 스탬프북으로 돌아가기
        </a>
      </div>
    );
  }

  // PAIRED / A_DONE / B_DONE
  const iAmDone =
    (myRole === "A" && session.state === "A_DONE") ||
    (myRole === "B" && session.state === "B_DONE") ||
    mySubmissionId !== null;
  const partnerDone =
    (myRole === "A" && session.state === "B_DONE") ||
    (myRole === "B" && session.state === "A_DONE") ||
    partnerSubmissionId !== null;

  return (
    <div className="space-y-4">
      <section
        className={`rounded-3xl border p-5 shadow-sm ${stateMeta.color}`}
      >
        <div className="flex items-center justify-between gap-2">
          <p className="inline-flex items-center gap-2 text-sm font-bold">
            <span aria-hidden>{stateMeta.icon}</span>
            <span>{stateMeta.label}</span>
          </p>
          <Countdown expiresAt={session.expires_at} urgentSec={60} />
        </div>
        {partnerName && (
          <p className="mt-2 text-[12px] font-semibold opacity-80">
            👫 짝꿍: {partnerName}
          </p>
        )}

        {/* 양쪽 진행 상태 */}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <div
            className={`rounded-2xl border-2 bg-white/60 px-3 py-3 text-center ${
              iAmDone ? "border-emerald-400" : "border-transparent"
            }`}
          >
            <p className="text-[10px] font-bold uppercase tracking-wide">나</p>
            <p className="mt-1 text-2xl" aria-hidden>
              {iAmDone ? "✅" : "⏳"}
            </p>
            <p className="mt-0.5 text-[11px] font-semibold">
              {iAmDone ? "완료" : "대기"}
            </p>
          </div>
          <div
            className={`rounded-2xl border-2 bg-white/60 px-3 py-3 text-center ${
              partnerDone ? "border-emerald-400" : "border-transparent"
            }`}
          >
            <p className="text-[10px] font-bold uppercase tracking-wide">
              짝꿍
            </p>
            <p className="mt-1 text-2xl" aria-hidden>
              {partnerDone ? "✅" : "⏳"}
            </p>
            <p className="mt-0.5 text-[11px] font-semibold">
              {partnerDone ? "완료" : "대기"}
            </p>
          </div>
        </div>
      </section>

      {/* completion_rule 별 액션 */}
      {completionRule === "SHARED_PHOTO" ? (
        <section className="rounded-3xl border border-[#D4E4BC] bg-white p-5 shadow-sm">
          <h3 className="text-base font-bold text-[#2D5A3D]">
            📸 함께 찍은 사진
          </h3>

          {session.shared_photo_url ? (
            <div className="mt-3 space-y-3">
              <div className="overflow-hidden rounded-2xl border border-[#D4E4BC]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={session.shared_photo_url}
                  alt="함께 찍은 사진"
                  className="h-auto w-full object-cover"
                />
              </div>
              {!iAmDone && (
                <button
                  type="button"
                  onClick={handleConfirmSide}
                  disabled={isPending}
                  className="min-h-[56px] w-full rounded-2xl bg-[#2D5A3D] px-4 py-3 text-base font-bold text-white shadow-sm transition hover:bg-[#3A7A52] disabled:bg-[#B8C7B0]"
                >
                  {isPending ? "확인 중..." : "✅ 나도 확인했어요"}
                </button>
              )}
              {iAmDone && !partnerDone && (
                <p className="text-center text-[12px] font-semibold text-[#6B6560]">
                  짝꿍의 확인을 기다리고 있어요
                </p>
              )}
            </div>
          ) : (
            <>
              <p className="mt-2 text-sm text-[#3D3A36]">
                한 쪽이 사진을 업로드한 뒤 양쪽 모두 확인 버튼을 누르면
                완료돼요.
              </p>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading || isPending}
                className="mt-3 flex min-h-[56px] w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-[#D4E4BC] bg-[#FFF8F0] px-4 py-3 text-base font-bold text-[#2D5A3D] transition hover:border-[#2D5A3D] disabled:opacity-50"
              >
                {uploading ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="animate-pulse">⏳</span>
                    {uploadStatus ?? "업로드 중..."}
                  </span>
                ) : (
                  <>📷 함께 찍은 사진 올리기</>
                )}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  const files = e.target.files;
                  if (files && files.length > 0) {
                    void handleSharedPhotoUpload(files);
                  }
                  e.target.value = "";
                }}
              />
            </>
          )}
        </section>
      ) : (
        <section className="rounded-3xl border border-[#D4E4BC] bg-white p-5 shadow-sm">
          <h3 className="text-base font-bold text-[#2D5A3D]">
            ✅ 각자 완료 확인
          </h3>
          <p className="mt-2 text-sm text-[#3D3A36]">
            두 가족 모두 완료 버튼을 누르면 도토리가 지급돼요
          </p>
          {!iAmDone ? (
            <button
              type="button"
              onClick={handleConfirmSide}
              disabled={isPending}
              className="mt-3 min-h-[56px] w-full rounded-2xl bg-[#2D5A3D] px-4 py-3 text-base font-bold text-white shadow-sm transition hover:bg-[#3A7A52] disabled:bg-[#B8C7B0]"
            >
              {isPending ? "확인 중..." : "✅ 나 완료!"}
            </button>
          ) : (
            <p className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-center text-sm font-semibold text-emerald-800">
              ✅ 내 완료 기록됨 — 짝꿍을 기다리고 있어요
            </p>
          )}
        </section>
      )}

      {errorMsg && (
        <div
          role="alert"
          className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800"
        >
          ⚠️ {errorMsg}
        </div>
      )}
    </div>
  );
}
