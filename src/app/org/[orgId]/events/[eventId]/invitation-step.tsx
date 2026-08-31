// ② 초대장 단계 — 템플릿 / 내용 쓰기 / 발행·공유.
//
// 예전에는 초대장 하나가 세 군데 흩어져 있었다:
//   내용 쓰기  → 행사 편집 폼 안쪽
//   발행·공유  → /org/{id}/invitations  (지금은 없앴다 — 행사 목록으로 보낸다)
//   템플릿     → /org/{id}/invitations/templates  (기관 단위 자산이라 남아 있다)
// "초대장을 고치려는데 왜 행사 편집으로 가지?" 가 여기서 나왔다. 셋을 이 단계로
// 모은다.
//
// 내용 쓰기는 편집 폼을 invitation 모드로 그대로 쓴다 — 필드를 새로 만들면
// 저장 액션이 갈라지고, 그때부터 "한쪽에서 저장하면 다른 쪽이 비는" 사고가
// 생길 자리가 만들어진다.

import Link from "next/link";
import { loadOrgInvitationTemplates } from "@/lib/invitation-templates/queries";
import { loadVenuesForOrg } from "@/lib/partner-venues/queries";
import type { OrgEventRow } from "@/lib/org-events/types";
import { EditEventForm } from "./edit/edit-event-form";
import { buildEditFormInitial } from "./edit/form-initial";
import { InvitationCardShare } from "./invitation-card-share";
import { InvitationTemplateManager } from "../../invitations/templates/invitation-template-manager";
import { InvitationPhonePreview } from "./invitation-phone-preview";
import {
  resolveInvitationMessage,
  resolveInvitationTitle,
} from "@/lib/org-events/invitation-copy";

export async function InvitationStep({
  orgId,
  eventId,
  event,
  sub,
}: {
  orgId: string;
  eventId: string;
  event: OrgEventRow;
  sub: string;
}) {
  if (sub === "share") {
    // 발행 직전 마지막 확인 자리 — 내보내기 전에 받는 사람 화면을 한 번 본다.
    // 여기 값은 저장된 것 그대로다(고칠 폼이 없으니 실시간도 없다).
    return (
      <div className="space-y-3 xl:flex xl:items-start xl:gap-5 xl:space-y-0">
        <InvitationPhonePreview
          eventId={eventId}
          fields={{
            name: resolveInvitationTitle(event.name),
            message: resolveInvitationMessage(event.invitation_message),
            body: event.invitation_body?.trim() ?? "",
            dress: event.invitation_dress_code?.trim() ?? "",
            location: event.invitation_location?.trim() ?? "",
            address: event.invitation_address?.trim() ?? "",
          }}
        />
        <section className="min-w-0 flex-1 space-y-3 rounded-2xl border border-[#D4E4BC] bg-white p-5 shadow-sm">
          <InvitationCardShare
            eventId={eventId}
            eventName={event.name}
            publishedAt={event.invitation_published_at ?? null}
          />
          <p className="text-[11px] text-[#8B7F75]">
            받은 사람이 로그인하면 본인 이름이 들어간 초대장을 봐요.
          </p>
        </section>
      </div>
    );
  }

  if (sub === "templates") {
    const templates = await loadOrgInvitationTemplates(orgId, {
      includeArchived: true,
    });
    return (
      <section className="space-y-3">
        <p className="rounded-2xl border border-[#E8DDC8] bg-[#FFF8F0] px-4 py-3 text-xs leading-relaxed text-[#6B4423]">
          📨 저장해 두면 <b>내용 쓰기</b>에서 한 번 클릭으로 인사말·내용이
          채워져요. 행사마다 다시 쓰지 않아도 됩니다.
        </p>
        <InvitationTemplateManager orgId={orgId} initialTemplates={templates} />
      </section>
    );
  }

  // 내용 쓰기 — 이 단계의 기본 화면(event-steps 의 defaultSub).
  const [templates, venues] = await Promise.all([
    loadOrgInvitationTemplates(orgId),
    loadVenuesForOrg(orgId),
  ]);

  return (
    <div className="space-y-3">
      {!event.invitation_published_at && (
        <p className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[#E8DDC8] bg-[#FFF8F0] px-4 py-3 text-xs text-[#6B4423]">
          <span>아직 발행 전이에요. 내용을 채우고 발행하면 보여요.</span>
          <Link
            href={`/org/${orgId}/events/${eventId}?step=invite&sub=share`}
            className="shrink-0 font-bold underline-offset-2 hover:underline"
          >
            발행하러 가기 →
          </Link>
        </p>
      )}

      <EditEventForm
        orgId={orgId}
        eventId={eventId}
        mode="invitation"
        invitationTemplates={templates.map((t) => ({
          id: t.id,
          label: t.label,
          message: t.message,
          body: t.body,
        }))}
        venues={venues.map((v) => ({
          id: v.id,
          name: v.name,
          address: v.address,
          imageUrl: v.image_url,
          parkings: v.parking_lots.map((p) => ({
            name: p.name,
            address: p.address,
            image_url: p.image_url ?? undefined,
          })),
        }))}
        initial={buildEditFormInitial(event)}
      />
    </div>
  );
}
