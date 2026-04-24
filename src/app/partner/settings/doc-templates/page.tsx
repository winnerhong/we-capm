import Link from "next/link";
import { requirePartnerWithRole } from "@/lib/auth-guard";
import { loadPartnerCustomTemplates } from "@/lib/org-documents/custom-template";
import { signedDocUrl } from "@/lib/documents/signed-url";
import { ORG_DOC_META, type OrgDocType } from "@/lib/org-documents/types";
import { deleteCustomTemplateAction } from "./actions";

export const dynamic = "force-dynamic";

const TEMPLATED_TYPES = [
  "TAX_CONTRACT",
  "FACILITY_CONSENT",
  "PRIVACY_CONSENT",
] as const satisfies readonly OrgDocType[];

type TemplatedType = (typeof TEMPLATED_TYPES)[number];

type PageProps = {
  searchParams: Promise<{ uploaded?: string }>;
};

function fmtSize(bytes: number | null | undefined) {
  if (!bytes || bytes <= 0) return "";
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  } catch {
    return iso;
  }
}

export default async function PartnerDocTemplatesPage({ searchParams }: PageProps) {
  const sp = await searchParams;

  let session;
  try {
    session = await requirePartnerWithRole(["OWNER"]);
  } catch {
    return (
      <div className="space-y-4 rounded-3xl border border-rose-200 bg-rose-50 p-6 text-center">
        <h1 className="text-xl font-bold text-rose-800">접근 권한 없음</h1>
        <p className="text-sm text-rose-700">
          서류 템플릿 관리는 <b>OWNER</b> 역할만 이용할 수 있어요.
        </p>
        <Link
          href="/partner/settings"
          className="inline-block rounded-xl border border-rose-300 bg-white px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100"
        >
          설정으로 돌아가기
        </Link>
      </div>
    );
  }

  const templates = await loadPartnerCustomTemplates(session.id);

  // 각 템플릿에 대한 signed URL 미리 계산
  const signedUrls = new Map<string, string | null>();
  await Promise.all(
    Array.from(templates.values()).map(async (t) => {
      const url = await signedDocUrl(t.file_url, 3600);
      signedUrls.set(t.id, url);
    })
  );

  const uploadedType =
    sp.uploaded && (TEMPLATED_TYPES as readonly string[]).includes(sp.uploaded)
      ? (sp.uploaded as TemplatedType)
      : null;

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav aria-label="breadcrumb" className="text-xs text-[#8B7F75]">
        <Link href="/partner/dashboard" className="hover:text-[#2D5A3D]">
          대시보드
        </Link>
        <span className="mx-2">/</span>
        <Link href="/partner/settings" className="hover:text-[#2D5A3D]">
          설정
        </Link>
        <span className="mx-2">/</span>
        <span className="font-semibold text-[#2D5A3D]">서류 템플릿</span>
      </nav>

      {/* Header */}
      <header className="rounded-3xl border border-[#D4E4BC] bg-gradient-to-br from-[#E8F0E4] via-white to-[#FAE7D0] p-5 shadow-sm md:p-7">
        <div className="flex items-center gap-3">
          <span className="text-3xl" aria-hidden>
            📄
          </span>
          <div>
            <h1 className="text-xl font-bold text-[#2D5A3D] md:text-2xl">
              서류 템플릿 관리
            </h1>
            <p className="mt-1 text-xs text-[#6B6560] md:text-sm">
              기관 고객이 다운로드할 표준 서류를 업로드하세요. 업로드 안 하면{" "}
              <b>토리로 기본 양식</b>이 사용돼요.
            </p>
          </div>
        </div>
      </header>

      {/* 업로드 완료 토스트 */}
      {uploadedType && (
        <div
          role="status"
          className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
        >
          ✅ <b>{ORG_DOC_META[uploadedType].label}</b> 커스텀 템플릿이
          등록됐어요. 앞으로 기관 고객이 다운로드할 땐 이 파일을 받게 돼요.
        </div>
      )}

      {/* 3개 템플릿 카드 */}
      <section className="grid gap-4 md:grid-cols-3">
        {TEMPLATED_TYPES.map((type) => {
          const meta = ORG_DOC_META[type];
          const template = templates.get(type) ?? null;
          const signedUrl = template ? signedUrls.get(template.id) : null;

          return (
            <article
              key={type}
              className="flex flex-col gap-3 rounded-2xl border border-[#D4E4BC] bg-white p-5 shadow-sm"
            >
              {/* 카드 헤더 */}
              <header className="flex items-center gap-2">
                <span className="text-2xl" aria-hidden>
                  {meta.icon}
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-base font-bold text-[#2D5A3D]">
                    {meta.label}
                  </h3>
                  <p className="truncate text-[11px] text-[#8B7F75]">
                    {meta.desc}
                  </p>
                </div>
              </header>

              {/* 상태 배지 */}
              {template?.format === "SECTIONS" ? (
                <div className="rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-semibold text-violet-800">
                  ✏️ 섹션 편집본 사용 중
                </div>
              ) : template?.format === "FILE" ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800">
                  ✅ 커스텀 파일 업로드됨
                </div>
              ) : (
                <div className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-semibold text-sky-800">
                  🌲 토리로 기본 양식 사용 중
                </div>
              )}

              {/* 파일 정보 or 섹션 요약 or 설명 */}
              {template?.format === "FILE" ? (
                <div className="rounded-xl bg-[#FFF8F0] px-3 py-2 text-[11px] text-[#6B6560]">
                  <p className="truncate font-semibold text-[#2D5A3D]">
                    {template.file_name ?? "custom-template.pdf"}
                  </p>
                  <p className="mt-0.5">
                    {fmtSize(template.file_size)}
                    {template.version > 1 && (
                      <span className="ml-1 rounded bg-white px-1 text-[10px] font-semibold text-[#2D5A3D]">
                        v{template.version}
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 text-[#8B7F75]">
                    {fmtDate(template.uploaded_at)} 업로드
                  </p>
                </div>
              ) : template?.format === "SECTIONS" ? (
                <div className="rounded-xl bg-[#FFF8F0] px-3 py-2 text-[11px] text-[#6B6560]">
                  <p className="truncate font-semibold text-[#2D5A3D]">
                    조문 {template.sections?.articles.length ?? 0}개 · v
                    {template.version}
                  </p>
                  <p className="mt-0.5 text-[#8B7F75]">
                    {fmtDate(template.uploaded_at)} 편집
                  </p>
                </div>
              ) : (
                <p className="text-xs text-[#6B6560]">
                  기본 양식을 불러와 온라인에서 수정하거나, 지사 로고·문구가
                  반영된 자체 PDF를 업로드할 수 있어요.
                </p>
              )}

              {/* 액션 버튼 */}
              <div className="mt-auto flex flex-wrap gap-2">
                {template?.format === "FILE" ? (
                  <>
                    {signedUrl && (
                      <a
                        href={signedUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-lg border border-[#D4E4BC] bg-white px-3 py-1.5 text-xs font-semibold text-[#2D5A3D] hover:bg-[#E8F0E4]"
                      >
                        👁 보기
                      </a>
                    )}
                    <Link
                      href={`/partner/settings/doc-templates/${type}/edit`}
                      className="rounded-lg border border-violet-300 bg-white px-3 py-1.5 text-xs font-semibold text-violet-700 hover:bg-violet-50"
                    >
                      ✏️ 편집으로 전환
                    </Link>
                    <Link
                      href={`/partner/settings/doc-templates/upload?type=${type}`}
                      className="rounded-lg border border-[#2D5A3D] bg-white px-3 py-1.5 text-xs font-semibold text-[#2D5A3D] hover:bg-[#E8F0E4]"
                    >
                      🔄 재업로드
                    </Link>
                    <form
                      action={async () => {
                        "use server";
                        await deleteCustomTemplateAction(template.id);
                      }}
                    >
                      <button
                        type="submit"
                        className="rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50"
                      >
                        🗑 제거
                      </button>
                    </form>
                  </>
                ) : template?.format === "SECTIONS" ? (
                  <>
                    <Link
                      href={`/partner/settings/doc-templates/${type}/edit`}
                      className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-700"
                    >
                      ✏️ 편집 계속
                    </Link>
                    <Link
                      href={`/partner/settings/doc-templates/upload?type=${type}`}
                      className="rounded-lg border border-[#D4E4BC] bg-white px-3 py-1.5 text-xs font-semibold text-[#6B6560] hover:bg-[#FFF8F0]"
                    >
                      📤 파일 업로드로 전환
                    </Link>
                  </>
                ) : (
                  <>
                    <Link
                      href={`/partner/settings/doc-templates/${type}/edit`}
                      className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-700"
                    >
                      ✏️ 기본 양식 불러와 편집
                    </Link>
                    <Link
                      href={`/partner/settings/doc-templates/upload?type=${type}`}
                      className="rounded-lg border border-[#2D5A3D] bg-white px-3 py-1.5 text-xs font-semibold text-[#2D5A3D] hover:bg-[#E8F0E4]"
                    >
                      📤 커스텀 업로드
                    </Link>
                  </>
                )}
              </div>
            </article>
          );
        })}
      </section>

      {/* 안내 */}
      <aside className="rounded-2xl border border-[#D4E4BC] bg-[#FFF8F0] p-4 text-xs text-[#6B6560] md:text-sm">
        <p className="font-semibold text-[#2D5A3D]">💡 템플릿 3가지 모드</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>
            <b>🌲 토리로 기본</b> — 아무것도 안 하면 토리로가 준비한 표준
            양식이 사용돼요
          </li>
          <li>
            <b className="text-violet-700">✏️ 섹션 편집</b> — 기본 양식을
            불러와 온라인에서 조문·문구를 직접 수정할 수 있어요 (지사 개별
            조건 반영에 유리)
          </li>
          <li>
            <b className="text-emerald-700">✅ 파일 업로드</b> — 이미 만들어
            둔 자체 PDF/이미지를 그대로 제공할 수 있어요 (로고·도장 포함
            버전에 유리)
          </li>
        </ul>
        <p className="mt-3 text-[11px] text-[#8B7F75]">
          세 모드는 동시에 활성화되지 않아요. 다른 모드로 전환하면 이전 것이
          비활성화됩니다. 파일 업로드 제한: PDF·JPG·PNG·WebP · 최대 5MB.
        </p>
      </aside>
    </div>
  );
}
