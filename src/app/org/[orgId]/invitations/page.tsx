import Link from "next/link";
import { requireOrg } from "@/lib/org-auth-guard";
import { loadOrgEvents } from "@/lib/org-events/queries";
import { fmtFullDateKst } from "@/lib/datetime/kst";
import { InvitationCardShare } from "./invitation-card-share";

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
  await requireOrg();
  const events = await loadOrgEvents(orgId);
  const visible = events.filter((e) => e.status !== "ARCHIVED");

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6">
      <nav aria-label="breadcrumb" className="text-xs text-[#8B7F75]">
        <Link href={`/org/${orgId}`} className="hover:text-[#2D5A3D]">
          기관 홈
        </Link>
        <span className="mx-2">/</span>
        <span className="font-semibold text-[#2D5A3D]">초대장</span>
      </nav>

      <header className="rounded-3xl border border-[#D4E4BC] bg-gradient-to-br from-[#E8F0E4] via-white to-[#FAE7D0] p-5 shadow-sm md:p-7">
        <div className="flex items-start gap-3">
          <span className="text-3xl" aria-hidden>
            💌
          </span>
          <div>
            <h1 className="text-xl font-bold text-[#2D5A3D] md:text-2xl">
              초대장 모음
            </h1>
            <p className="mt-1 text-xs text-[#6B6560] md:text-sm">
              행사별 초대장을 한 곳에서 발행·공유하세요. 참가자가 받을 링크를
              바로 복사하거나 카카오톡으로 공유할 수 있어요.
            </p>
          </div>
        </div>
      </header>

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
        <div className="space-y-4">
          {visible.map((e) => {
            const sm = STATUS_META[e.status] ?? STATUS_META.DRAFT;
            return (
              <section
                key={e.id}
                className="overflow-hidden rounded-3xl border border-[#D4E4BC] bg-white shadow-sm"
              >
                <header className="border-b border-[#F0EBE3] bg-[#FFF8F0] px-5 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Link
                      href={`/org/${orgId}/events/${e.id}`}
                      className="text-base font-bold text-[#2D5A3D] hover:underline"
                    >
                      {e.name || "(이름 없음)"}
                    </Link>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${sm.bg} ${sm.text}`}
                    >
                      {sm.label}
                    </span>
                  </div>
                  {(e.starts_at || e.ends_at) && (
                    <p className="mt-1 text-[11px] text-[#6B6560]">
                      📅 {fmtFullDate(e.starts_at)}
                      {e.ends_at && e.ends_at !== e.starts_at
                        ? ` ~ ${fmtFullDate(e.ends_at)}`
                        : ""}
                    </p>
                  )}
                </header>
                <div className="p-5">
                  <InvitationCardShare
                    eventId={e.id}
                    eventName={e.name}
                    publishedAt={e.invitation_published_at ?? null}
                  />
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
