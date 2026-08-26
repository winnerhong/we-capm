// 초대장 하단 — 내가 낸 신청서의 진행 상태.
//
// 문자를 보내지 않기로 했으므로(정책), 신청자가 결과를 확인하는 주 경로가
// 바로 이 카드다. 쿠키(toriro_apply_{eventId}) 또는 연락처 조회로 신청서를
// 찾았을 때 폼 대신 렌더된다.
//
// REJECTED 는 여기서 다루지 않는다 — 재신청을 허용하므로 페이지가 폼을
// 다시 띄우고, 그 위에 안내 문구만 얹는다.

import Link from "next/link";
import { fmtDateTimeKst } from "@/lib/datetime/kst";
import type { OrgEventApplicationRow } from "@/lib/org-events/types";

export function ApplicationStatusCard({
  eventId,
  application,
}: {
  eventId: string;
  application: OrgEventApplicationRow;
}) {
  const approved = application.status === "APPROVED";
  const names = application.children.map((c) =>
    c.class_name ? `${c.class_name} ${c.name}` : c.name
  );

  return (
    <section className="mx-auto max-w-md px-6 pb-14 pt-2">
      <div
        className={`rounded-3xl border-2 p-6 text-center shadow-sm ${
          approved
            ? "border-emerald-200 bg-emerald-50/70"
            : "border-amber-200 bg-amber-50/70"
        }`}
      >
        <p className="text-4xl" aria-hidden>
          {approved ? "🎉" : "⏳"}
        </p>
        <h2 className="mt-3 text-lg font-bold text-[#2D5A3D]">
          {approved ? "참가가 승인됐어요!" : "승인을 기다리고 있어요"}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-[#4A4340]">
          {approved
            ? "아래 버튼으로 입장하시면 스탬프북·프로그램을 바로 시작할 수 있어요."
            : "기관에서 확인하는 중이에요. 승인되면 이 화면이 바뀝니다."}
        </p>

        <dl className="mt-4 space-y-1.5 rounded-2xl bg-white/70 px-4 py-3 text-left text-xs">
          <div className="flex gap-2">
            <dt className="shrink-0 font-semibold text-[#8B7F75]">참가 아이</dt>
            <dd className="min-w-0 flex-1 font-bold text-[#2C2C2C]">
              {names.join(" · ") || "-"}
            </dd>
          </div>
          <div className="flex gap-2">
            <dt className="shrink-0 font-semibold text-[#8B7F75]">참가 인원</dt>
            <dd className="min-w-0 flex-1 font-bold text-[#2C2C2C]">
              {application.party_size}명
            </dd>
          </div>
          <div className="flex gap-2">
            <dt className="shrink-0 font-semibold text-[#8B7F75]">신청 일시</dt>
            <dd className="min-w-0 flex-1 font-bold text-[#2C2C2C]">
              {fmtDateTimeKst(application.created_at)}
            </dd>
          </div>
        </dl>

        {approved ? (
          <Link
            href={`/join/event/${eventId}`}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#2D5A3D] to-[#3A7A52] px-6 py-3.5 text-base font-bold text-white shadow-md transition hover:from-[#234a30] hover:to-[#2D5A3D]"
          >
            <span aria-hidden>🎪</span>
            <span>행사 입장하기</span>
            <span aria-hidden>→</span>
          </Link>
        ) : (
          <p className="mt-4 text-[11px] text-[#8B7F75]">
            신청 내용을 바꾸시려면 같은 연락처로 다시 신청해 주세요. 마지막에
            보낸 내용으로 덮어써집니다.
          </p>
        )}
      </div>
    </section>
  );
}

/**
 * 접수 마감 안내 — 폼 자리를 대신한다.
 * implicit = 기관이 마감을 따로 정하지 않아 "행사 시작 1시간 전"으로 닫힌 경우.
 */
export function ApplicationClosedCard({
  closedAt,
  implicit = false,
}: {
  closedAt: string;
  implicit?: boolean;
}) {
  return (
    <section className="mx-auto max-w-md px-6 pb-14 pt-2">
      <div className="rounded-3xl border-2 border-[#E8DDC8] bg-[#F5F1E8]/70 p-6 text-center shadow-sm">
        <p className="text-4xl" aria-hidden>
          🕘
        </p>
        <h2 className="mt-3 text-lg font-bold text-[#6B4423]">
          접수가 마감됐어요
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-[#6B6560]">
          {fmtDateTimeKst(closedAt)}
          {implicit ? " (행사 시작 1시간 전)" : ""}에 신청이 마감됐어요.
          <br />
          참가를 원하시면 기관 담당자에게 문의해 주세요.
        </p>
      </div>
    </section>
  );
}
