import Link from "next/link";
import { requireOrg } from "@/lib/org-auth-guard";
import { NewUserForm } from "./new-user-form";
import { BulkImportForm } from "../bulk-import/csv-preview";
import { bulkImportAppUsersAction } from "../bulk-import/actions";

export const dynamic = "force-dynamic";

export default async function NewOrgUserPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  await requireOrg();

  const bulkAction = bulkImportAppUsersAction.bind(null, orgId);

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6">
      {/* Breadcrumb */}
      <nav aria-label="breadcrumb" className="text-xs text-[#8B7F75]">
        <Link href={`/org/${orgId}`} className="hover:text-[#2D5A3D]">
          기관 홈
        </Link>
        <span className="mx-2">/</span>
        <Link href={`/org/${orgId}/users`} className="hover:text-[#2D5A3D]">
          참가자 관리
        </Link>
        <span className="mx-2">/</span>
        <span className="font-semibold text-[#2D5A3D]">한 명 추가</span>
      </nav>

      {/* Header */}
      <header className="rounded-3xl border border-[#D4E4BC] bg-gradient-to-br from-[#E8F0E4] via-white to-[#FAE7D0] p-5 shadow-sm md:p-7">
        <div className="flex items-center gap-3">
          <span className="text-3xl" aria-hidden>
            🙋
          </span>
          <div>
            <h1 className="text-xl font-bold text-[#2D5A3D] md:text-2xl">
              참가자 한 명 등록
            </h1>
            <p className="mt-1 text-xs text-[#6B6560] md:text-sm">
              보호자와 자녀를 한 가족 단위로 등록해요. 같은 핸드폰이 이미 있으면 자녀만 추가돼요.
            </p>
          </div>
        </div>
      </header>

      <aside className="rounded-2xl border border-sky-200 bg-sky-50 p-3 text-[11px] text-sky-900">
        <p className="font-semibold">💡 여러 명을 한 번에 등록하려면?</p>
        <p className="mt-0.5">
          아래 <b>한 명 등록</b> 아래쪽에 있는 <b>엑셀/CSV 일괄 등록</b>{" "}
          섹션을 열어 CSV 파일로 한 번에 올릴 수 있어요.
        </p>
      </aside>

      <NewUserForm orgId={orgId} />

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
                  여러 보호자·자녀를 CSV 파일로 한 번에 등록해요
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
              </ul>
            </aside>

            <BulkImportForm orgId={orgId} action={bulkAction} />
          </div>
        </details>
      </section>
    </div>
  );
}
