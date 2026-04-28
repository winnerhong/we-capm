// 행사 전용 참가자 한 명 등록.
//   /users/new 와 동일한 폼(NewUserForm + 일괄 등록 섹션)을 그대로 재사용.
//   action 만 createSingleEventParticipantAction 로 바꿔서 등록 후 자동으로
//   org_event_participants 에 link 되도록 구성.

import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOrg } from "@/lib/org-auth-guard";
import { loadOrgEventById } from "@/lib/org-events/queries";
import { NewUserForm } from "@/app/org/[orgId]/users/new/new-user-form";
import { BulkImportForm } from "@/app/org/[orgId]/users/bulk-import/csv-preview";
import { bulkImportAppUsersAction } from "@/app/org/[orgId]/users/bulk-import/actions";
import { createSingleEventParticipantAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewEventParticipantPage({
  params,
}: {
  params: Promise<{ orgId: string; eventId: string }>;
}) {
  const { orgId, eventId } = await params;
  const session = await requireOrg();

  const event = await loadOrgEventById(eventId);
  if (!event || event.org_id !== orgId || session.orgId !== orgId) {
    notFound();
  }

  // 한 명 추가 액션 — eventId binding
  const singleAction = createSingleEventParticipantAction.bind(
    null,
    orgId,
    eventId
  );

  // 일괄 등록 액션 — eventId binding (행사 link 후 행사 페이지로 redirect)
  const bulkAction = bulkImportAppUsersAction.bind(null, orgId, eventId);

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6">
      {/* Breadcrumb */}
      <nav aria-label="breadcrumb" className="text-xs text-[#8B7F75]">
        <Link href={`/org/${orgId}`} className="hover:text-[#2D5A3D]">
          기관 홈
        </Link>
        <span className="mx-2">/</span>
        <Link href={`/org/${orgId}/events`} className="hover:text-[#2D5A3D]">
          행사
        </Link>
        <span className="mx-2">/</span>
        <Link
          href={`/org/${orgId}/events/${eventId}?tab=participants`}
          className="hover:text-[#2D5A3D]"
        >
          {event.name}
        </Link>
        <span className="mx-2">/</span>
        <span className="font-semibold text-[#2D5A3D]">참가자 등록</span>
      </nav>

      {/* Header */}
      <header className="rounded-3xl border border-[#D4E4BC] bg-gradient-to-br from-[#E8F0E4] via-white to-[#FAE7D0] p-5 shadow-sm md:p-7">
        <div className="flex items-center gap-3">
          <span className="text-3xl" aria-hidden>
            🙋
          </span>
          <div>
            <h1 className="text-xl font-bold text-[#2D5A3D] md:text-2xl">
              {event.name} 참가자 등록
            </h1>
            <p className="mt-1 text-xs text-[#6B6560] md:text-sm">
              이 행사에만 등록되는 참가자예요. 보호자와 자녀를 한 가족 단위로
              입력하세요. 같은 핸드폰이 이미 있으면 자녀만 추가되고 행사에 자동
              연결돼요.
            </p>
          </div>
        </div>
      </header>

      <aside className="rounded-2xl border border-sky-200 bg-sky-50 p-3 text-[11px] text-sky-900">
        <p className="font-semibold">💡 여러 명을 한 번에 등록하려면?</p>
        <p className="mt-0.5">
          아래 <b>한 명 등록</b> 아래쪽에 있는 <b>엑셀/CSV 일괄 등록</b>{" "}
          섹션을 열어 CSV 파일로 한 번에 올릴 수 있어요. 등록된 모든 참가자가
          이 행사에 자동 연결됩니다.
        </p>
      </aside>

      <NewUserForm
        orgId={orgId}
        action={singleAction}
        submitLabel="🌱 행사에 참가자 등록"
      />

      {/* ─────────────────────────────────────────── */}

      <section className="rounded-3xl border border-[#D4E4BC] bg-white shadow-sm">
        <details className="group" open={false}>
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-3xl bg-gradient-to-br from-[#FAE7D0] via-white to-[#E8F0E4] p-5 md:p-6">
            <div className="flex items-center gap-3">
              <span className="text-2xl" aria-hidden>
                📥
              </span>
              <div className="min-w-0">
                <p className="text-base font-bold text-[#2D5A3D] md:text-lg">
                  엑셀/CSV 일괄 등록
                </p>
                <p className="mt-0.5 text-[11px] text-[#6B6560] md:text-xs">
                  여러 보호자·자녀를 CSV 파일로 한 번에 등록 → 행사 자동 연결
                </p>
              </div>
            </div>
            <span
              aria-hidden
              className="shrink-0 rounded-full bg-white px-2 py-1 text-[11px] font-bold text-[#2D5A3D] shadow-sm transition group-open:rotate-180"
            >
              ▼
            </span>
          </summary>

          <div className="space-y-4 border-t border-[#D4E4BC] p-5 md:p-6">
            <aside className="rounded-2xl border border-[#D4E4BC] bg-[#FFF8F0] p-4 text-xs text-[#6B6560] md:text-sm">
              <p className="font-semibold text-[#2D5A3D]">💡 등록 규칙</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>
                  필수 컬럼: <b>원생명 · 학부모연락처</b> 두 개예요
                </li>
                <li>
                  <b>계정 아이디</b>는 학부모연락처(숫자만),{" "}
                  <b>초기 비밀번호</b>는 뒷 4자리로 자동 생성돼요
                </li>
                <li>
                  같은 학부모연락처로 여러 줄 쓰면{" "}
                  <span className="font-semibold text-[#2D5A3D]">
                    한 계정에 원생이 묶여요
                  </span>
                </li>
                <li className="font-semibold text-[#2D5A3D]">
                  📌 등록된 모든 참가자는 자동으로 이 행사에 연결돼요
                </li>
              </ul>
            </aside>

            <BulkImportForm orgId={orgId} action={bulkAction} />
          </div>
        </details>
      </section>

      <div className="text-center">
        <Link
          href={`/org/${orgId}/events/${eventId}?tab=participants`}
          className="text-xs text-[#6B6560] hover:text-[#2D5A3D]"
        >
          ← 이 행사 참가자 목록으로
        </Link>
      </div>
    </div>
  );
}
