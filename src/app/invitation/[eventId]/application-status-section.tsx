"use client";

// 상태 카드 ↔ 수정 폼 전환.
//
// 카드와 폼을 같은 자리에서 갈아 끼우기만 한다. 수정 전용 화면이나 전용 서버
// 액션은 없다 — 인원이 바뀌면 어차피 다시 승인받아야 한다는 정책 덕분에
// "수정" 이 곧 "신청서를 다시 내는 것" 과 같은 일이 되기 때문이다.

import { useState } from "react";
import { ApplicationStatusCard } from "./application-status-card";
import { ApplicationForm } from "./application-form";
import { resolveApplicationEdit } from "@/lib/org-events/application-core";
import type { ApplicationGate } from "@/lib/org-events/application-core";
import type { OrgConsent } from "@/lib/org-events/consent-core";
import type { OrgEventApplicationRow } from "@/lib/org-events/types";

export function ApplicationStatusSection({
  eventId,
  application,
  gate,
  consent,
  atCapacity,
  capacity,
  approvedPeople,
  closeLabel,
}: {
  eventId: string;
  application: OrgEventApplicationRow;
  gate: ApplicationGate;
  consent: OrgConsent;
  atCapacity: boolean;
  capacity: number | null;
  approvedPeople: number;
  closeLabel: string | null;
}) {
  const [editing, setEditing] = useState(false);

  const edit = resolveApplicationEdit({
    status: application.status,
    gateKind: gate.kind,
  });

  if (editing) {
    return (
      <ApplicationForm
        eventId={eventId}
        atCapacity={atCapacity}
        capacity={capacity}
        approvedPeople={approvedPeople}
        closeLabel={closeLabel}
        consent={consent}
        mode="edit"
        initial={{
          phone: application.phone,
          children: application.children.map((c) => ({
            name: c.name,
            className: c.class_name ?? "",
          })),
          companions: application.companions,
          wasApproved: application.status === "APPROVED",
          // 저장된 동의 전문이 지금 문구와 **글자까지 같을 때만** 미리 체크한다.
          // 문구가 바뀌었으면 다시 읽고 동의하는 게 맞다.
          consentAlreadyAgreed:
            !!application.consent_agreed_at &&
            application.consent_snapshot?.required === consent.required,
          optionalAlreadyAgreed:
            !!application.consent_optional_agreed_at &&
            !!consent.optional &&
            application.consent_snapshot?.optional === consent.optional,
        }}
        onCancelEdit={() => setEditing(false)}
      />
    );
  }

  return (
    <ApplicationStatusCard
      eventId={eventId}
      application={application}
      onEdit={edit.canEdit ? () => setEditing(true) : undefined}
      editBlockedReason={edit.canEdit ? undefined : edit.reason}
    />
  );
}
