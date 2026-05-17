"use client";

// 쿠폰 템플릿 매니저 — 목록 + 인라인 새 쿠폰 폼 + 행별 수정·보관·삭제.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  archiveGiftTemplateAction,
  createGiftTemplateAction,
  deleteGiftTemplateAction,
  updateGiftTemplateAction,
} from "@/lib/gifts/actions";
import type { OrgGiftTemplateRow } from "@/lib/gifts/types";
import { CoverImagePicker } from "@/components/cover-image-picker";

interface Props {
  orgId: string;
  initialTemplates: OrgGiftTemplateRow[];
}

interface DraftForm {
  label: string;
  message: string;
  giftUrl: string;
  defaultExpiresDays: number;
}

const EMPTY_DRAFT: DraftForm = {
  label: "",
  message: "",
  giftUrl: "",
  defaultExpiresDays: 30,
};

export function GiftTemplateManager({ orgId, initialTemplates }: Props) {
  const router = useRouter();
  const [showArchived, setShowArchived] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // 새 쿠폰 폼
  const [createOpen, setCreateOpen] = useState(false);
  const [newDraft, setNewDraft] = useState<DraftForm>(EMPTY_DRAFT);

  // 행별 인라인 수정 상태 — id → draft
  const [editing, setEditing] = useState<Record<string, DraftForm>>({});

  const visible = initialTemplates.filter(
    (t) => showArchived || !t.is_archived
  );
  const activeCount = initialTemplates.filter((t) => !t.is_archived).length;
  const archivedCount = initialTemplates.length - activeCount;

  function clearError() {
    setError(null);
  }

  const handleCreate = () => {
    clearError();
    const label = newDraft.label.trim();
    if (!label) {
      setError("쿠폰 이름을 입력해 주세요");
      return;
    }
    startTransition(async () => {
      try {
        await createGiftTemplateAction({
          label,
          message: newDraft.message || null,
          giftUrl: newDraft.giftUrl || null,
          defaultExpiresDays: newDraft.defaultExpiresDays,
        });
        setNewDraft(EMPTY_DRAFT);
        setCreateOpen(false);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "생성 실패");
      }
    });
  };

  const beginEdit = (t: OrgGiftTemplateRow) => {
    setEditing((prev) => ({
      ...prev,
      [t.id]: {
        label: t.label,
        message: t.message ?? "",
        giftUrl: t.gift_url ?? "",
        defaultExpiresDays: t.default_expires_days,
      },
    }));
  };

  const cancelEdit = (id: string) => {
    setEditing((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const saveEdit = (id: string) => {
    clearError();
    const draft = editing[id];
    if (!draft) return;
    const label = draft.label.trim();
    if (!label) {
      setError("쿠폰 이름을 입력해 주세요");
      return;
    }
    startTransition(async () => {
      try {
        await updateGiftTemplateAction({
          id,
          label,
          message: draft.message || null,
          giftUrl: draft.giftUrl || null,
          defaultExpiresDays: draft.defaultExpiresDays,
        });
        cancelEdit(id);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "수정 실패");
      }
    });
  };

  const toggleArchive = (id: string, archive: boolean) => {
    clearError();
    startTransition(async () => {
      try {
        await archiveGiftTemplateAction(id, archive);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "보관 처리 실패");
      }
    });
  };

  const handleDelete = (id: string, label: string) => {
    clearError();
    if (
      !window.confirm(
        `"${label}" 쿠폰을 영구 삭제할까요? 발급된 선물에는 영향이 없어요.`
      )
    ) {
      return;
    }
    startTransition(async () => {
      try {
        await deleteGiftTemplateAction(id);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "삭제 실패");
      }
    });
  };

  return (
    <div className="space-y-4">
      {/* 헤더: 카운트 + 새 쿠폰 토글 + 보관함 토글 */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[#D4E4BC] bg-white px-3 py-2 shadow-sm">
        <div className="text-xs text-[#6B6560]">
          🎟️ 활성 <b className="text-[#2D5A3D]">{activeCount}</b>
          {archivedCount > 0 && (
            <>
              {" · "}
              보관 <b className="text-[#8B7F75]">{archivedCount}</b>
            </>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {archivedCount > 0 && (
            <button
              type="button"
              onClick={() => setShowArchived((v) => !v)}
              className="rounded-lg border border-[#D4E4BC] bg-[#F5F1E8] px-2.5 py-1.5 text-[11px] font-bold text-[#6B6560] hover:bg-[#E8E1D2]"
            >
              {showArchived ? "보관함 숨기기" : "보관함 보기"}
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setCreateOpen((v) => !v);
              clearError();
            }}
            className="rounded-lg bg-emerald-500 px-3 py-1.5 text-[11px] font-bold text-white shadow-md hover:bg-emerald-400"
          >
            {createOpen ? "✕ 닫기" : "＋ 새 쿠폰"}
          </button>
        </div>
      </div>

      {error && (
        <p
          role="alert"
          className="rounded-xl bg-rose-50 px-3 py-2 text-[12px] font-semibold text-rose-700 ring-1 ring-rose-200"
        >
          ⚠ {error}
        </p>
      )}

      {/* 새 쿠폰 폼 */}
      {createOpen && (
        <div className="rounded-2xl border-2 border-emerald-300 bg-emerald-50/40 p-4 shadow-sm">
          <h3 className="mb-3 text-sm font-bold text-[#2D5A3D]">
            ＋ 새 쿠폰 만들기
          </h3>
          <DraftFields
            draft={newDraft}
            onChange={setNewDraft}
            disabled={pending}
          />
          <div className="mt-3 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setCreateOpen(false);
                setNewDraft(EMPTY_DRAFT);
                clearError();
              }}
              disabled={pending}
              className="rounded-lg border border-[#D4E4BC] px-3 py-1.5 text-xs font-bold text-[#6B6560] hover:bg-[#F5F1E8] disabled:opacity-40"
            >
              취소
            </button>
            <button
              type="button"
              onClick={handleCreate}
              disabled={pending || !newDraft.label.trim()}
              className="rounded-lg bg-emerald-500 px-4 py-1.5 text-xs font-bold text-white shadow-md hover:bg-emerald-400 disabled:opacity-40"
            >
              {pending ? "저장 중..." : "저장"}
            </button>
          </div>
        </div>
      )}

      {/* 템플릿 목록 */}
      {visible.length === 0 ? (
        <div className="rounded-3xl border-2 border-dashed border-[#D4E4BC] bg-white/70 px-6 py-10 text-center">
          <p className="text-3xl" aria-hidden>
            🎟️
          </p>
          <p className="mt-2 text-sm font-bold text-[#2D5A3D]">
            아직 저장된 쿠폰이 없어요
          </p>
          <p className="mt-1 text-xs text-[#6B6560]">
            ＋ 새 쿠폰 을 눌러 자주 보내는 선물을 미리 등록해 보세요
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {visible.map((t) => {
            const draft = editing[t.id];
            const isEditing = !!draft;
            return (
              <li
                key={t.id}
                className={`rounded-2xl border bg-white p-3 shadow-sm ${
                  t.is_archived
                    ? "border-[#E5D3B8] opacity-60"
                    : "border-[#D4E4BC]"
                }`}
              >
                {isEditing ? (
                  <div className="space-y-3">
                    <DraftFields
                      draft={draft}
                      onChange={(next) =>
                        setEditing((prev) => ({ ...prev, [t.id]: next }))
                      }
                      disabled={pending}
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => cancelEdit(t.id)}
                        disabled={pending}
                        className="rounded-lg border border-[#D4E4BC] px-3 py-1.5 text-xs font-bold text-[#6B6560] hover:bg-[#F5F1E8] disabled:opacity-40"
                      >
                        취소
                      </button>
                      <button
                        type="button"
                        onClick={() => saveEdit(t.id)}
                        disabled={pending || !draft.label.trim()}
                        className="rounded-lg bg-emerald-500 px-4 py-1.5 text-xs font-bold text-white shadow-md hover:bg-emerald-400 disabled:opacity-40"
                      >
                        {pending ? "저장 중..." : "저장"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-3">
                    {/* 썸네일 */}
                    {t.gift_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={t.gift_url}
                        alt={t.label}
                        className="h-14 w-14 shrink-0 rounded-lg border border-[#E5D3B8] object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-dashed border-[#D4E4BC] bg-[#F5F1E8] text-xl">
                        🎁
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <h4 className="text-sm font-bold text-[#2D5A3D]">
                          {t.label}
                        </h4>
                        {t.is_archived && (
                          <span className="rounded-full bg-[#F5F1E8] px-1.5 py-0.5 text-[10px] font-bold text-[#8B7F75]">
                            보관됨
                          </span>
                        )}
                        <span className="text-[10px] text-[#8B7F75]">
                          만료 {t.default_expires_days === 0
                            ? "없음"
                            : `${t.default_expires_days}일`}
                        </span>
                      </div>
                      {t.message && (
                        <p className="mt-0.5 line-clamp-2 text-[11px] text-[#6B6560]">
                          “{t.message}”
                        </p>
                      )}
                    </div>
                    {/* 액션 */}
                    <div className="flex shrink-0 flex-col gap-1">
                      <button
                        type="button"
                        onClick={() => beginEdit(t)}
                        disabled={pending}
                        className="rounded-md border border-[#D4E4BC] bg-white px-2 py-1 text-[10px] font-bold text-[#2D5A3D] hover:bg-[#F5F1E8] disabled:opacity-40"
                      >
                        ✏ 수정
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleArchive(t.id, !t.is_archived)}
                        disabled={pending}
                        className="rounded-md border border-[#E5D3B8] bg-white px-2 py-1 text-[10px] font-bold text-[#8B6F47] hover:bg-[#FFF8F0] disabled:opacity-40"
                      >
                        {t.is_archived ? "↺ 복원" : "📦 보관"}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(t.id, t.label)}
                        disabled={pending}
                        className="rounded-md border border-rose-200 bg-white px-2 py-1 text-[10px] font-bold text-rose-700 hover:bg-rose-50 disabled:opacity-40"
                      >
                        🗑 삭제
                      </button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function DraftFields({
  draft,
  onChange,
  disabled,
}: {
  draft: DraftForm;
  onChange: (next: DraftForm) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-3">
      <label className="block">
        <span className="block text-[11px] font-bold text-[#2D5A3D]">
          쿠폰 이름 *
        </span>
        <input
          type="text"
          value={draft.label}
          onChange={(e) => onChange({ ...draft, label: e.target.value })}
          placeholder="GS25 5천원 상품권"
          maxLength={120}
          disabled={disabled}
          className="mt-1 w-full rounded-lg border border-[#D4E4BC] bg-white px-3 py-1.5 text-sm text-[#2D5A3D] outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400/30 disabled:opacity-50"
        />
      </label>

      <label className="block">
        <span className="block text-[11px] font-bold text-[#2D5A3D]">
          기본 메시지 (선택)
        </span>
        <textarea
          value={draft.message}
          onChange={(e) => onChange({ ...draft, message: e.target.value })}
          placeholder="가족 사진 미션 완료 축하 🎉"
          maxLength={200}
          rows={2}
          disabled={disabled}
          className="mt-1 w-full resize-none rounded-lg border border-[#D4E4BC] bg-white px-3 py-1.5 text-sm text-[#2D5A3D] outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400/30 disabled:opacity-50"
        />
      </label>

      <div>
        <span className="block text-[11px] font-bold text-[#2D5A3D]">
          기프티콘 이미지 (선택)
        </span>
        <div className="mt-1">
          <CoverImagePicker
            value={draft.giftUrl}
            onChange={(url) => onChange({ ...draft, giftUrl: url })}
            bucket="preset-covers"
            pathPrefix="gift-templates"
            compact
            hint="500KB 이하로 자동 압축돼요"
          />
        </div>
      </div>

      <label className="flex items-center gap-2">
        <span className="text-[11px] font-bold text-[#2D5A3D]">
          기본 만료
        </span>
        <input
          type="number"
          min={0}
          max={365}
          value={draft.defaultExpiresDays}
          onChange={(e) =>
            onChange({
              ...draft,
              defaultExpiresDays: Math.max(
                0,
                Math.min(365, Number(e.target.value) || 0)
              ),
            })
          }
          disabled={disabled}
          className="w-16 rounded-lg border border-[#D4E4BC] bg-white px-2 py-1 text-center text-sm text-[#2D5A3D] outline-none focus:border-emerald-400 disabled:opacity-50"
        />
        <span className="text-[11px] text-[#6B6560]">일 (0 = 만료 없음)</span>
      </label>
    </div>
  );
}
