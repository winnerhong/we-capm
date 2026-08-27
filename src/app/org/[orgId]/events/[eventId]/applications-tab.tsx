"use client";

// 행사 접수 탭 — 초대장으로 들어온 참가 신청서를 확인하고 수락/거절한다.
//
// 수락하면 그 자리에서 보호자 계정·자녀·소속·행사 참가가 모두 만들어진다
// (application-actions 의 approveEventApplicationAction). 이 화면은 그 트리거일 뿐,
// 로직을 들고 있지 않다.
//
// 참가자 탭과 톤을 맞추되 행이 훨씬 단순하다 — 아직 계정이 없는 신청서라
// 도토리·출석 같은 계정 정보가 없기 때문.

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  approveEventApplicationAction,
  approveEventApplicationsBulkAction,
  cancelEventApplicationAction,
  deleteEventApplicationAction,
  loadApplicationConsentAction,
  rejectEventApplicationAction,
  revertEventApplicationAction,
} from "@/lib/org-events/application-actions";
import {
  computeHeadcount,
  formatHeadcount,
  formatPhoneDisplay,
} from "@/lib/org-events/application-core";
import { fmtDateTimeKst } from "@/lib/datetime/kst";
import type { ConsentSnapshot } from "@/lib/org-events/consent-core";
import {
  COMPANION_KIND_META,
  ORG_EVENT_APPLICATION_STATUS_META,
  type OrgEventApplicationCounts,
  type OrgEventApplicationRow,
} from "@/lib/org-events/types";
import { ApplicationSettings } from "./application-settings";
import { ConsentEditor } from "./consent-editor";

type FilterKey =
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "CANCELED"
  | "ALL";

type Props = {
  orgId: string;
  eventId: string;
  applications: OrgEventApplicationRow[];
  counts: OrgEventApplicationCounts;
  enabled: boolean;
  closeAtLocal: string;
  capacity: string;
  invitationPublished: boolean;
  /** 마감을 비웠을 때 적용될 자동 마감 라벨(행사 시작 1시간 전). */
  defaultCloseLabel: string | null;
  /** 이미 이 행사 참가자인 연락처 — "이미 참가 중" 배지용. */
  participantPhones: string[];
  /**
   * 개인정보 동의 문구 — **기관 단위** 설정이라 행사 설정과 범위가 다르다.
   * 편집 화면은 치환 전 원본을 봐야 하므로 {기관명} 토큰이 살아 있는 값이다.
   */
  consent: {
    orgName: string;
    body: string;
    optionalBody: string;
    optionalEnabled: boolean;
    updatedAt: string | null;
  };
};

export function ApplicationsTab({
  orgId,
  eventId,
  applications,
  counts,
  enabled,
  closeAtLocal,
  capacity,
  invitationPublished,
  defaultCloseLabel,
  participantPhones,
  consent,
}: Props) {
  const router = useRouter();
  const [filter, setFilter] = useState<FilterKey>("PENDING");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const participantSet = useMemo(
    () => new Set(participantPhones),
    [participantPhones]
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return applications.filter((a) => {
      if (filter !== "ALL" && a.status !== filter) return false;
      if (!q) return true;
      const haystack = [
        a.phone,
        formatPhoneDisplay(a.phone),
        ...a.children.map((c) => c.name),
        ...a.children.map((c) => c.class_name ?? ""),
        // "할머니" 로도 찾을 수 있게 동반인 유형을 검색 대상에 넣는다.
        ...a.companions.map((c) => c.label),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [applications, filter, query]);

  const selectablePending = visible.filter((a) => a.status === "PENDING");
  const selectedPending = selectablePending.filter((a) => selected.has(a.id));

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    const allChosen =
      selectablePending.length > 0 &&
      selectedPending.length === selectablePending.length;
    setSelected(
      allChosen ? new Set<string>() : new Set(selectablePending.map((a) => a.id))
    );
  }

  function run(
    id: string | null,
    fn: () => Promise<{ ok: boolean; message?: string } | void>,
    okMessage: string
  ) {
    setError(null);
    setMessage(null);
    setBusyId(id);
    startTransition(async () => {
      try {
        const res = await fn();
        if (res && "ok" in res && !res.ok) {
          setError(res.message ?? "처리에 실패했어요");
        } else {
          setMessage(okMessage);
          router.refresh();
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "처리 중 오류가 났어요");
      } finally {
        setBusyId(null);
      }
    });
  }

  function approve(a: OrgEventApplicationRow) {
    // 정원 초과 승인은 막지 않되 한 번 확인한다.
    const cap = Number(capacity);
    if (
      Number.isFinite(cap) &&
      cap > 0 &&
      counts.approved_people + a.party_size > cap
    ) {
      const ok = window.confirm(
        `정원 ${cap}명을 넘게 됩니다 (승인 시 ${counts.approved_people + a.party_size}명).\n그래도 수락할까요?`
      );
      if (!ok) return;
    }
    run(
      a.id,
      () => approveEventApplicationAction(orgId, eventId, a.id),
      "수락했어요 — 참가자 탭에서 확인하실 수 있어요"
    );
  }

  function reject(a: OrgEventApplicationRow) {
    const reason = window.prompt(
      "거절 사유를 남겨주세요 (기관 기록용, 신청자에게는 보이지 않아요)",
      ""
    );
    if (reason === null) return;
    run(
      a.id,
      () => rejectEventApplicationAction(orgId, eventId, a.id, reason),
      "거절 처리했어요"
    );
  }

  function cancel(a: OrgEventApplicationRow) {
    const warn =
      a.status === "APPROVED"
        ? "이 가족의 참가를 취소할까요?\n참가자 명단에서 빠지고 정원 자리가 반환됩니다.\n(계정·자녀·도토리는 그대로)"
        : "이 신청을 취소 처리할까요?";
    if (!window.confirm(warn)) return;
    const reason = window.prompt(
      "취소 사유를 남겨주세요 (선택 — 신청자가 알려준 내용)",
      ""
    );
    if (reason === null) return;
    run(
      a.id,
      () => cancelEventApplicationAction(orgId, eventId, a.id, reason),
      "취소 처리했어요 — [취소] 필터에서 계속 보실 수 있어요"
    );
  }

  /** 취소된 신청서 영구 삭제 — 되돌릴 수 없어 한 번 더 확인한다. */
  function purge(a: OrgEventApplicationRow) {
    const who = a.children.map((c) => c.name).join(", ") || "이 신청";
    if (
      !window.confirm(
        `[${who}] 신청서를 완전히 삭제할까요?\n\n` +
          "취소 목록에서도 사라지고 되돌릴 수 없어요.\n" +
          "누가 왜 빠졌는지 기록이 필요하면 그대로 두시는 편이 좋아요."
      )
    ) {
      return;
    }
    run(
      a.id,
      () => deleteEventApplicationAction(orgId, eventId, a.id),
      "완전히 삭제했어요"
    );
  }

  function revert(a: OrgEventApplicationRow) {
    const warn =
      a.status === "APPROVED"
        ? "승인을 취소하면 이 가족이 행사 참가자에서 빠집니다.\n(계정과 도토리는 남습니다)\n\n계속할까요?"
        : a.status === "CANCELED"
          ? "취소를 되돌려 대기 상태로 만들까요?\n취소 사유 기록도 함께 지워집니다."
          : "대기 상태로 되돌릴까요?";
    if (!window.confirm(warn)) return;
    run(
      a.id,
      () => revertEventApplicationAction(orgId, eventId, a.id),
      "대기 상태로 되돌렸어요"
    );
  }

  function bulkApprove() {
    const ids = selectedPending.map((a) => a.id);
    if (ids.length === 0) return;
    if (!window.confirm(`선택한 ${ids.length}건을 모두 수락할까요?`)) return;
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const res = await approveEventApplicationsBulkAction(
        orgId,
        eventId,
        ids
      );
      setSelected(new Set());
      if (res.failed.length > 0) {
        setError(
          `${res.approved}건 수락 · ${res.failed.length}건 실패 (${res.failed[0].message})`
        );
      } else {
        setMessage(`${res.approved}건을 수락했어요`);
      }
      router.refresh();
    });
  }

  const FILTERS: { key: FilterKey; label: string; count: number }[] = [
    { key: "PENDING", label: "대기", count: counts.pending_count },
    { key: "APPROVED", label: "승인", count: counts.approved_count },
    { key: "REJECTED", label: "거절", count: counts.rejected_count },
    { key: "CANCELED", label: "취소", count: counts.canceled_count },
    { key: "ALL", label: "전체", count: applications.length },
  ];

  return (
    <div className="space-y-4">
      <ApplicationSettings
        orgId={orgId}
        eventId={eventId}
        initialEnabled={enabled}
        initialCloseAtLocal={closeAtLocal}
        initialCapacity={capacity}
        counts={counts}
        invitationPublished={invitationPublished}
        defaultCloseLabel={defaultCloseLabel}
      />

      {/* 접수를 켠 행사에서만 — 신청서가 없으면 동의문도 뜰 일이 없다. */}
      {enabled && (
        <ConsentEditor
          orgId={orgId}
          orgName={consent.orgName}
          initialBody={consent.body}
          initialOptionalBody={consent.optionalBody}
          initialOptionalEnabled={consent.optionalEnabled}
          updatedAt={consent.updatedAt}
        />
      )}

      {(message || error) && (
        <p
          role="status"
          className={`rounded-xl px-4 py-2.5 text-sm font-semibold ${
            error
              ? "border border-rose-200 bg-rose-50 text-rose-800"
              : "border border-emerald-200 bg-emerald-50 text-emerald-800"
          }`}
        >
          {error ?? message}
        </p>
      )}

      {/* 필터 + 검색 */}
      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${
              filter === f.key
                ? "border-[#2D5A3D] bg-[#2D5A3D] text-white"
                : "border-[#D4E4BC] bg-white text-[#2D5A3D] hover:bg-[#F5F1E8]"
            }`}
          >
            {f.label} {f.count}
          </button>
        ))}
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="🔍 원아명·반명·연락처"
          className="ml-auto min-w-[10rem] flex-1 rounded-full border border-[#D4E4BC] bg-white px-4 py-1.5 text-xs text-[#2D5A3D] outline-none focus:border-[#3A7A52] sm:flex-none sm:basis-56"
        />
      </div>

      {/* 일괄 수락 바 */}
      {selectablePending.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[#E8DDC8] bg-[#FFFDF8] px-3 py-2">
          <label className="flex items-center gap-2 text-xs font-semibold text-[#6B4423]">
            <input
              type="checkbox"
              checked={
                selectedPending.length === selectablePending.length &&
                selectablePending.length > 0
              }
              onChange={toggleAll}
              className="h-4 w-4 accent-[#2D5A3D]"
            />
            대기 {selectablePending.length}건 전체 선택
          </label>
          <button
            type="button"
            disabled={pending || selectedPending.length === 0}
            onClick={bulkApprove}
            className="ml-auto rounded-xl bg-[#2D5A3D] px-4 py-2 text-xs font-bold text-white disabled:opacity-40"
          >
            선택 {selectedPending.length}건 일괄 수락
          </button>
        </div>
      )}

      {/* 목록 */}
      {visible.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#D4E4BC] bg-white/60 px-6 py-12 text-center">
          <p className="text-3xl" aria-hidden>
            📭
          </p>
          <p className="mt-2 text-sm font-semibold text-[#6B6560]">
            {applications.length === 0
              ? enabled
                ? "아직 접수된 신청서가 없어요. 초대장을 공유해 보세요."
                : "접수를 켜면 초대장 하단에 신청서가 뜹니다."
              : "조건에 맞는 신청서가 없어요."}
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {visible.map((a) => (
            <ApplicationRow
              key={a.id}
              application={a}
              selected={selected.has(a.id)}
              busy={pending && busyId === a.id}
              disabled={pending}
              alreadyParticipant={participantSet.has(a.phone)}
              onToggle={() => toggle(a.id)}
              onApprove={() => approve(a)}
              onReject={() => reject(a)}
              onRevert={() => revert(a)}
              onCancel={() => cancel(a)}
              onPurge={() => purge(a)}
              orgId={orgId}
              eventId={eventId}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function ApplicationRow({
  application: a,
  selected,
  busy,
  disabled,
  alreadyParticipant,
  onToggle,
  onApprove,
  onReject,
  onRevert,
  onCancel,
  onPurge,
  orgId,
  eventId,
}: {
  application: OrgEventApplicationRow;
  selected: boolean;
  busy: boolean;
  disabled: boolean;
  alreadyParticipant: boolean;
  onToggle: () => void;
  onApprove: () => void;
  onReject: () => void;
  onRevert: () => void;
  onCancel: () => void;
  onPurge: () => void;
  orgId: string;
  eventId: string;
}) {
  const meta = ORG_EVENT_APPLICATION_STATUS_META[a.status];
  const isPending = a.status === "PENDING";
  // updated_at 은 트리거로 자동 갱신된다. 5초 여유를 두는 이유는 최초 insert 와
  // 같은 트랜잭션에서 두 값이 밀리초 단위로 어긋날 수 있어서다.
  const isEdited =
    isPending &&
    !a.reviewed_by &&
    new Date(a.updated_at).getTime() - new Date(a.created_at).getTime() > 5_000;
  // 전문은 목록 응답에 실리지 않는다(용량). 누른 순간 한 건만 가져온다.
  const [proof, setProof] = useState<ConsentSnapshot | null>(null);
  const [proofState, setProofState] = useState<
    "closed" | "loading" | "open" | "error"
  >("closed");

  function toggleConsent() {
    if (proofState === "open" || proofState === "error") {
      setProofState("closed");
      return;
    }
    if (proof) {
      setProofState("open");
      return;
    }
    setProofState("loading");
    void loadApplicationConsentAction(orgId, eventId, a.id).then((res) => {
      if (!res.ok) {
        setProofState("error");
        return;
      }
      setProof(res.snapshot);
      setProofState("open");
    });
  }

  return (
    <li className="rounded-2xl border border-[#D4E4BC] bg-white p-3 shadow-sm">
      <div className="flex items-start gap-3">
        {isPending && (
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggle}
            aria-label="선택"
            className="mt-1 h-4 w-4 shrink-0 accent-[#2D5A3D]"
          />
        )}

        <div className="min-w-0 flex-1">
          {/* 아이 칩들 */}
          <div className="flex flex-wrap items-center gap-1.5">
            {a.children.map((c, i) => (
              <span
                key={`${c.name}-${i}`}
                className="inline-flex items-center gap-1 rounded-full bg-[#F5F1E8] px-2 py-0.5 text-xs font-bold text-[#2D5A3D]"
              >
                {c.class_name && (
                  <span className="text-[10px] font-semibold text-[#8B7F75]">
                    {c.class_name}
                  </span>
                )}
                {c.name}
              </span>
            ))}
            <span
              className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold ${meta.color}`}
            >
              {meta.icon} {meta.label}
            </span>
            {/* 새로 들어온 신청과 "고쳐서 다시 온" 신청은 다르게 봐야 한다.
                신청자가 인원을 바꾸면 승인이 풀리고 이 목록으로 되돌아온다.
                reviewed_by 가 비어 있어야 관리자가 되돌린 건과 구분된다. */}
            {isEdited && (
              <span className="inline-flex items-center rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                ✏️ 수정된 신청
              </span>
            )}
          </div>

          <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-[#6B6560]">
            <span className="font-semibold tabular-nums text-[#4A4340]">
              📞 {formatPhoneDisplay(a.phone)}
            </span>
            <span className="font-semibold tabular-nums">
              {/* companions 가 없던 시절의 신청서는 총 인원만 (0명 오해 방지) */}
              {a.companions.length > 0
                ? formatHeadcount(computeHeadcount(a.children, a.companions))
                : `👨‍👩‍👧 총 ${a.party_size}명`}
            </span>
            <span className="tabular-nums text-[#8B7F75]">
              {fmtDateTimeKst(a.created_at)}
            </span>
            <ConsentBadge
              application={a}
              open={proofState === "open"}
              loading={proofState === "loading"}
              onToggle={toggleConsent}
            />
          </p>

          {proofState === "error" && (
            <p className="mt-2 text-[11px] font-semibold text-rose-700">
              동의 기록을 불러오지 못했어요
            </p>
          )}
          {proofState === "open" && proof && (
            <div className="mt-2 space-y-2">
              <ConsentProof
                label="[필수] 개인정보 수집·이용"
                at={a.consent_agreed_at}
                body={proof.required}
              />
              {proof.optional ? (
                <ConsentProof
                  label="[선택] 계열사 제3자 제공"
                  at={a.consent_optional_agreed_at}
                  body={proof.optional}
                />
              ) : (
                <p className="text-[10px] text-[#8B7F75]">
                  [선택] 계열사 제3자 제공 — 동의하지 않으셨어요 (참가에는 영향 없음)
                </p>
              )}
            </div>
          )}

          {/* 누가 오는지 한눈에 — 유형 칩 */}
          {a.companions.length > 0 && (
            <p className="mt-1 flex flex-wrap items-center gap-1">
              {a.companions.map((c, i) => (
                <span
                  key={`${c.label}-${i}`}
                  className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                    c.kind === "CHILD"
                      ? "bg-[#FAE7D0] text-[#6B4423]"
                      : "bg-[#E8F0E4] text-[#2D5A3D]"
                  }`}
                >
                  <span aria-hidden>
                    {COMPANION_KIND_META[c.kind].icon}
                  </span>
                  {c.label}
                </span>
              ))}
            </p>
          )}

          {alreadyParticipant && a.status !== "APPROVED" && (
            <p className="mt-1 text-[11px] font-semibold text-amber-700">
              ⚠️ 이미 이 행사에 참가 중인 연락처예요
            </p>
          )}
          {a.status === "REJECTED" && a.note && (
            <p className="mt-1 text-[11px] text-[#8B7F75]">
              기관 메모: {a.note}
            </p>
          )}
          {a.status === "CANCELED" && (
            <p className="mt-1 text-[11px] font-semibold text-rose-700">
              🚫 {a.canceled_at ? fmtDateTimeKst(a.canceled_at) : ""} 취소
              {a.cancel_reason ? ` · 사유: ${a.cancel_reason}` : ""}
            </p>
          )}
        </div>

        {/* 작업 */}
        <div className="flex shrink-0 flex-col gap-1.5">
          {isPending && (
            <>
              <button
                type="button"
                disabled={disabled}
                onClick={onApprove}
                className="rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-40"
              >
                {busy ? "처리 중" : "✅ 수락"}
              </button>
              <button
                type="button"
                disabled={disabled}
                onClick={onReject}
                className="rounded-xl border border-[#D4E4BC] bg-white px-3 py-1.5 text-xs font-bold text-[#8B7F75] hover:text-rose-700 disabled:opacity-40"
              >
                ❌ 거절
              </button>
            </>
          )}
          {!isPending && (
            <button
              type="button"
              disabled={disabled}
              onClick={onRevert}
              className="rounded-xl border border-[#D4E4BC] bg-white px-3 py-1.5 text-xs font-bold text-[#6B6560] hover:bg-[#F5F1E8] disabled:opacity-40"
            >
              {a.status === "APPROVED"
                ? "승인 취소"
                : a.status === "CANCELED"
                  ? "대기로 되돌리기"
                  : "대기로"}
            </button>
          )}
          {/* 취소된 건만 최종 정리를 열어준다 — 삭제는 2단계(취소 → 삭제)다. */}
          {a.status === "CANCELED" && (
            <button
              type="button"
              disabled={disabled}
              onClick={onPurge}
              title="취소 목록에서도 완전히 지웁니다 (되돌릴 수 없어요)"
              className="rounded-xl border border-rose-300 bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-100 disabled:opacity-40"
            >
              🗑 완전 삭제
            </button>
          )}
          {/* 전화로 취소 통보를 받는 경우가 잦아 관리자도 대행할 수 있게. */}
          {(a.status === "PENDING" || a.status === "APPROVED") && (
            <button
              type="button"
              disabled={disabled}
              onClick={onCancel}
              className="rounded-xl border border-rose-200 bg-white px-3 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-50 disabled:opacity-40"
            >
              🚫 취소 처리
            </button>
          )}
        </div>
      </div>
    </li>
  );
}

/* -------------------------------------------------------------------------- */
/* 개인정보 동의 기록                                                          */
/* -------------------------------------------------------------------------- */

/**
 * 동의 여부 배지.
 *
 * 기록이 없는 신청서(consent_agreed_at = null)는 "거부" 가 아니라 **동의 기능
 * 도입 전에 접수된 건**이다. 그 구분이 안 보이면 관리자가 잘못 판단한다.
 */
function ConsentBadge({
  application: a,
  open,
  loading,
  onToggle,
}: {
  application: OrgEventApplicationRow;
  open: boolean;
  loading: boolean;
  onToggle: () => void;
}) {
  // 전문 없이 시각만으로 판단한다 — 목록에는 시각만 실려 온다.
  if (!a.consent_agreed_at) {
    return (
      <span className="rounded-full bg-[#F5F1E8] px-2 py-0.5 text-[10px] font-semibold text-[#8B7F75]">
        📜 동의 기록 없음 (도입 전)
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      className="rounded-full bg-[#E8F0E4] px-2 py-0.5 text-[10px] font-bold text-[#2D5A3D] hover:bg-[#D4E4BC]"
    >
      📜 동의{a.consent_optional_agreed_at ? " · 계열사 ✓" : ""}
      <span className="ml-1 font-semibold opacity-70">
        {loading ? "여는 중" : open ? "접기" : "보기"}
      </span>
    </button>
  );
}

/**
 * 동의 당시 전문. **지금 문구가 아니라 그때 문구**를 보여준다 — 기관이 나중에
 * 문구를 고쳐도 이 사람이 동의한 내용은 바뀌지 않는다는 게 이 기록의 요점이다.
 */
function ConsentProof({
  label,
  at,
  body,
}: {
  label: string;
  at: string | null;
  body: string;
}) {
  return (
    <div className="rounded-xl border border-[#E8DDC8] bg-[#FFFDF8] p-2.5">
      <p className="flex flex-wrap items-baseline justify-between gap-2 text-[10px] font-bold text-[#2D5A3D]">
        <span>{label}</span>
        {at && (
          <span className="tabular-nums font-semibold text-[#8B7F75]">
            {fmtDateTimeKst(at)} 동의
          </span>
        )}
      </p>
      <pre className="mt-1.5 max-h-48 overflow-y-auto whitespace-pre-wrap font-sans text-[10px] leading-relaxed text-[#4A4340]">
        {body}
      </pre>
    </div>
  );
}
