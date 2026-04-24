"use client";

import { useMemo, useState, useTransition, type ReactNode } from "react";
import {
  proposeContributionAction,
  withdrawContributionAction,
} from "@/lib/missions/contribution-actions";
import {
  CONTRIBUTION_STATUS_META,
  type MissionContributionRow,
  type OrgMissionRow,
  type PartnerMissionRow,
} from "@/lib/missions/types";
import { AcornIcon } from "@/components/acorn-icon";

interface Props {
  currentOrgMission: OrgMissionRow;
  targetPartnerMission: PartnerMissionRow;
  existing: MissionContributionRow | null;
}

type FieldKey = "title" | "description" | "acorns" | "config_json";

interface FieldSpec {
  key: FieldKey;
  label: string;
  icon: ReactNode;
  getFrom: (p: PartnerMissionRow) => string;
  getTo: (o: OrgMissionRow) => string;
}

const FIELD_SPECS: FieldSpec[] = [
  {
    key: "title",
    label: "제목",
    icon: "📝",
    getFrom: (p) => p.title ?? "",
    getTo: (o) => o.title ?? "",
  },
  {
    key: "description",
    label: "설명",
    icon: "📄",
    getFrom: (p) => p.description ?? "",
    getTo: (o) => o.description ?? "",
  },
  {
    key: "acorns",
    label: "도토리",
    icon: <AcornIcon size={14} />,
    getFrom: (p) => String(p.default_acorns ?? 0),
    getTo: (o) => String(o.acorns ?? 0),
  },
  {
    key: "config_json",
    label: "세부 설정 (config_json)",
    icon: "⚙️",
    getFrom: (p) => JSON.stringify(p.config_json ?? {}, null, 2),
    getTo: (o) => JSON.stringify(o.config_json ?? {}, null, 2),
  },
];

function isChanged(
  spec: FieldSpec,
  o: OrgMissionRow,
  p: PartnerMissionRow
): boolean {
  return spec.getFrom(p) !== spec.getTo(o);
}

export function ProposeDialog({
  currentOrgMission,
  targetPartnerMission,
  existing,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // 실제로 달라진 필드만 기본 체크
  const initialChecked = useMemo(() => {
    const set = new Set<FieldKey>();
    FIELD_SPECS.forEach((s) => {
      if (isChanged(s, currentOrgMission, targetPartnerMission)) {
        set.add(s.key);
      }
    });
    return set;
  }, [currentOrgMission, targetPartnerMission]);

  const [checked, setChecked] = useState<Set<FieldKey>>(initialChecked);
  const [note, setNote] = useState<string>(existing?.proposal_note ?? "");

  const hasAnyChange = FIELD_SPECS.some((s) =>
    isChanged(s, currentOrgMission, targetPartnerMission)
  );

  function toggle(key: FieldKey) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorMsg(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        await proposeContributionAction(currentOrgMission.id, fd);
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : "제안 실패");
      }
    });
  }

  function onWithdraw() {
    if (!existing) return;
    if (!window.confirm("제안을 회수할까요? 다시 보내려면 새로 작성해야 해요.")) return;
    setErrorMsg(null);
    startTransition(async () => {
      try {
        await withdrawContributionAction(existing.id);
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : "회수 실패");
      }
    });
  }

  // 기존 제안 있을 때 — 상태에 따라 다른 UI
  const existingMeta = existing
    ? CONTRIBUTION_STATUS_META[existing.status]
    : null;

  return (
    <section
      aria-label="지사에게 역반영 제안"
      className="rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 via-white to-violet-50/40 p-5 shadow-sm"
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-violet-100 text-xl"
            aria-hidden
          >
            💌
          </span>
          <div className="min-w-0">
            <h2 className="text-base font-bold text-violet-900">
              지사에게 개선 제안하기
            </h2>
            <p className="mt-0.5 text-xs text-violet-800/80">
              이 미션을 편집하면서 찾은 개선 아이디어를 지사 가이드에 역반영할
              수 있어요. 지사가 수용하면 새 버전으로 발행돼요.
            </p>
          </div>
        </div>
        {existingMeta && (
          <span
            className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold ${existingMeta.color}`}
          >
            <span aria-hidden>{existingMeta.icon}</span>
            <span>{existingMeta.label}</span>
          </span>
        )}
      </header>

      {/* 기존 제안 상세 */}
      {existing && (
        <div className="mt-4 rounded-xl border border-violet-200 bg-white/80 p-4 text-xs">
          <p className="font-semibold text-violet-900">내 제안 메시지</p>
          <p className="mt-1 whitespace-pre-wrap text-zinc-700">
            {existing.proposal_note || "(내용 없음)"}
          </p>
          {existing.reviewed_at && (
            <div className="mt-3 border-t border-violet-100 pt-3">
              <p className="font-semibold text-violet-900">지사 답변</p>
              <p className="mt-0.5 text-[10px] text-zinc-500">
                검토자: {existing.reviewed_by ?? "-"} ·{" "}
                {new Date(existing.reviewed_at).toLocaleString("ko-KR")}
              </p>
              {existing.review_note && (
                <p className="mt-1 whitespace-pre-wrap text-zinc-700">
                  {existing.review_note}
                </p>
              )}
            </div>
          )}

          {existing.status === "PROPOSED" && (
            <div className="mt-3 flex justify-end">
              <button
                type="button"
                onClick={onWithdraw}
                disabled={isPending}
                className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
              >
                ↩ 제안 회수
              </button>
            </div>
          )}
        </div>
      )}

      {/* 새 제안 폼 — 기존이 없거나 PROPOSED 라 수정 가능 */}
      {(!existing || existing.status === "PROPOSED") && (
        <>
          {!expanded ? (
            <div className="mt-4">
              <button
                type="button"
                onClick={() => setExpanded(true)}
                disabled={!hasAnyChange}
                className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-violet-700 focus:outline-none focus:ring-2 focus:ring-violet-400 disabled:cursor-not-allowed disabled:bg-violet-300"
              >
                <span aria-hidden>💌</span>
                <span>
                  {existing ? "제안 수정하기" : "지사에게 개선 제안하기"}
                </span>
              </button>
              {!hasAnyChange && (
                <p className="mt-2 text-[11px] text-zinc-500">
                  원본 가이드와 달라진 부분이 아직 없어요. 미션을 편집한 뒤 다시
                  시도해 주세요.
                </p>
              )}
            </div>
          ) : (
            <form className="mt-4 space-y-4" onSubmit={onSubmit}>
              {/* 필드 체크박스 + diff 프리뷰 */}
              <div>
                <p className="text-xs font-semibold text-violet-900">
                  어떤 항목을 제안할까요?
                </p>
                <ul className="mt-2 space-y-2">
                  {FIELD_SPECS.map((spec) => {
                    const changed = isChanged(
                      spec,
                      currentOrgMission,
                      targetPartnerMission
                    );
                    const isOn = checked.has(spec.key);
                    return (
                      <li
                        key={spec.key}
                        className={`rounded-xl border p-3 ${
                          isOn
                            ? "border-violet-300 bg-violet-50/60"
                            : "border-zinc-200 bg-white"
                        }`}
                      >
                        <label className="flex cursor-pointer items-start gap-2.5">
                          <input
                            type="checkbox"
                            name="changed_fields"
                            value={spec.key}
                            checked={isOn}
                            onChange={() => toggle(spec.key)}
                            disabled={!changed}
                            className="mt-1 h-4 w-4 rounded border-zinc-300 text-violet-600 focus:ring-violet-400 disabled:opacity-40"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 text-sm font-semibold text-violet-900">
                              <span aria-hidden>{spec.icon}</span>
                              <span>{spec.label}</span>
                              {!changed && (
                                <span className="ml-1 rounded-full bg-zinc-100 px-1.5 py-0.5 text-[10px] font-normal text-zinc-500">
                                  변경 없음
                                </span>
                              )}
                            </div>

                            {changed && (
                              <div className="mt-2 grid gap-2 md:grid-cols-2">
                                <div className="rounded-lg border border-rose-200 bg-rose-50/60 p-2">
                                  <p className="text-[10px] font-semibold uppercase tracking-wide text-rose-700">
                                    Before · 지사 가이드
                                  </p>
                                  <pre className="mt-1 whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-zinc-800">
                                    {spec.getFrom(targetPartnerMission) ||
                                      "(비어 있음)"}
                                  </pre>
                                </div>
                                <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-2">
                                  <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
                                    After · 내 제안
                                  </p>
                                  <pre className="mt-1 whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-zinc-800">
                                    {spec.getTo(currentOrgMission) ||
                                      "(비어 있음)"}
                                  </pre>
                                </div>
                              </div>
                            )}
                          </div>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </div>

              {/* 제안 메시지 */}
              <div>
                <label
                  htmlFor="proposal_note"
                  className="text-xs font-semibold text-violet-900"
                >
                  어떤 점이 좋아졌나요? <span className="text-rose-600">*</span>
                </label>
                <textarea
                  id="proposal_note"
                  name="proposal_note"
                  required
                  rows={4}
                  maxLength={2000}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="예: 사진 장수를 2장 이상으로 늘렸더니 가족 반응이 좋았어요. 프롬프트에 '표정'을 추가하니 더 자연스러운 사진이 모였어요."
                  className="mt-1.5 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-200"
                />
                <p className="mt-1 text-[10px] text-zinc-500">
                  {note.length} / 2000자
                </p>
              </div>

              {errorMsg && (
                <div
                  role="alert"
                  className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700"
                >
                  ⚠ {errorMsg}
                </div>
              )}

              <div className="flex flex-wrap items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setExpanded(false);
                    setErrorMsg(null);
                  }}
                  disabled={isPending}
                  className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={isPending || checked.size === 0}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:bg-violet-300"
                >
                  {isPending ? "보내는 중…" : existing ? "제안 업데이트" : "지사에게 보내기"}
                </button>
              </div>
            </form>
          )}
        </>
      )}
    </section>
  );
}
