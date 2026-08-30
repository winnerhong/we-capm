import Link from "next/link";
import { requireOrg } from "@/lib/org-auth-guard";
import { loadOrgEvents } from "@/lib/org-events/queries";
import { countOrgInvitationTemplates } from "@/lib/invitation-templates/queries";
import { InvitationsHeader } from "./invitations-header";
import { OrgSectionTabs } from "../_nav/org-section-tabs";
import { fmtFullDateKst } from "@/lib/datetime/kst";
import { InvitationCardShare } from "./invitation-card-share";
import { ParticipantLoginShare } from "./participant-login-share";

export const dynamic = "force-dynamic";

const fmtFullDate = fmtFullDateKst;

const STATUS_META: Record<
  string,
  { label: string; bg: string; text: string }
> = {
  DRAFT: { label: "예정", bg: "bg-amber-100", text: "text-amber-800" },
  LIVE: { label: "진행중", bg: "bg-emerald-100", text: "text-emerald-800" },
  ENDED: { label: "종료", bg: "bg-slate-100", text: "text-slate-700" },
  ARCHIVED: { label: "보관", bg: "bg-rose-100", text: "text-rose-800" },
};

export default async function OrgInvitationsPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  const session = await requireOrg();
  // 템플릿 개수는 탭에만 쓴다 — 목록 자체는 필요 없으니 세기만 한다.
  const [events, templateCount] = await Promise.all([
    loadOrgEvents(orgId),
    countOrgInvitationTemplates(orgId),
  ]);
  const visible = events.filter((e) => e.status !== "ARCHIVED");

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6">
      <OrgSectionTabs
        orgId={orgId}
        active="invitations"
        templateCount={templateCount}
      />
      <InvitationsHeader />

      {visible.length === 0 ? (
        <section className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-[#D4E4BC] bg-white px-4 py-16 text-center">
          <div className="text-4xl">🌱</div>
          <p className="mt-3 text-base font-semibold text-[#2D5A3D]">
            아직 행사가 없어요
          </p>
          <p className="mt-1 text-xs text-[#6B6560]">
            새 행사를 만들면 초대장을 발행할 수 있어요.
          </p>
          <Link
            href={`/org/${orgId}/events/new`}
            className="mt-4 inline-flex items-center rounded-xl bg-[#2D5A3D] px-4 py-2 text-xs font-semibold text-white hover:bg-[#3A7A52]"
          >
            + 새 행사 만들기
          </Link>
        </section>
      ) : (
        <>
          {/* 이 화면의 주인공 — 행사별 초대장. 바로 목록부터 시작한다
              (제목은 탭[초대장 모음]이 이미 하고 있다). */}
          <section className="space-y-2">
            <p className="text-[11px] text-[#8B7F75]">
              받은 사람이 로그인하면 <b>본인 이름이 들어간 초대장</b>을 봐요
            </p>

            <ul className="space-y-3">
              {visible.map((e) => {
                const sm = STATUS_META[e.status] ?? STATUS_META.DRAFT;
                const published = !!e.invitation_published_at;
                return (
                  <li
                    key={e.id}
                    className={`rounded-2xl border bg-white p-4 shadow-sm transition ${
                      published
                        ? "border-[#D4E4BC]"
                        : "border-dashed border-[#E5D3B8] bg-[#FFFDF8]"
                    }`}
                  >
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span aria-hidden className="text-base">
                        💌
                      </span>
                      <Link
                        href={`/org/${orgId}/events/${e.id}`}
                        className="min-w-0 flex-1 truncate text-sm font-bold text-[#2D5A3D] hover:underline"
                      >
                        {e.name || "(이름 없음)"}
                      </Link>
                      {published ? (
                        <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                          발행됨
                        </span>
                      ) : (
                        <span className="shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                          초안
                        </span>
                      )}
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${sm.bg} ${sm.text}`}
                      >
                        {sm.label}
                      </span>
                    </div>

                    {(e.starts_at || e.ends_at) && (
                      <p className="mt-0.5 pl-6 text-[11px] text-[#8B7F75]">
                        {fmtFullDate(e.starts_at)}
                        {e.ends_at && e.ends_at !== e.starts_at
                          ? ` ~ ${fmtFullDate(e.ends_at)}`
                          : ""}
                      </p>
                    )}

                    <div className="mt-2.5 pl-6">
                      <InvitationCardShare
                        eventId={e.id}
                        eventName={e.name}
                        publishedAt={e.invitation_published_at ?? null}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>

          {/* 기관 공통 링크 — 초대장이 아니라 성격이 다르다. 맨 아래에 작게. */}
          <ParticipantLoginShare orgId={orgId} orgName={session.orgName} />
        </>
      )}
    </div>
  );
}
