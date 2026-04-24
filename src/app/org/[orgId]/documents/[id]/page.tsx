import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOrg } from "@/lib/org-auth-guard";
import {
  loadOrgDocumentById,
  loadOrgDocuments,
} from "@/lib/org-documents/queries";
import {
  ORG_DOC_META,
  ORG_DOC_STATUS_META,
  UPLOADER_META,
  type OrgDocType,
} from "@/lib/org-documents/types";
import { signedDocUrl } from "@/lib/documents/signed-url";
import { deleteOrgDocumentAction } from "../actions";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ orgId: string; id: string }>;
};

function fmtDateTime(iso: string | null | undefined) {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function fmtSize(n: number | null | undefined) {
  if (!n) return "-";
  if (n < 1024) return `${n}B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)}KB`;
  return `${(n / 1024 / 1024).toFixed(1)}MB`;
}

export default async function OrgDocumentDetailPage({ params }: PageProps) {
  const { orgId, id } = await params;

  const session = await requireOrg();

  const doc = await loadOrgDocumentById(id);
  if (!doc) notFound();
  if (doc.org_id !== orgId) {
    return (
      <div className="mx-auto max-w-4xl space-y-4 px-4 py-6">
        <div className="rounded-3xl border border-rose-200 bg-rose-50 p-6 text-center">
          <h1 className="text-xl font-bold text-rose-800">접근 불가</h1>
          <p className="mt-1 text-sm text-rose-700">
            이 서류에 접근할 권한이 없어요.
          </p>
          <Link
            href={`/org/${orgId}/documents`}
            className="mt-3 inline-block rounded-xl border border-rose-300 bg-white px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100"
          >
            목록으로
          </Link>
        </div>
      </div>
    );
  }

  const meta = ORG_DOC_META[doc.doc_type as OrgDocType];
  const statusMeta = ORG_DOC_STATUS_META[doc.status];
  const uploaderMeta = UPLOADER_META[doc.uploaded_by];
  const isImage = (doc.mime_type ?? "").startsWith("image/");

  const signedUrl = await signedDocUrl(doc.file_url, 3600);

  // 버전 히스토리: 같은 org_id + doc_type의 다른 버전들
  const allDocs = await loadOrgDocuments(orgId);
  const history = allDocs
    .filter((d) => d.doc_type === doc.doc_type && d.id !== doc.id)
    .sort((a, b) => b.version - a.version);

  const canDelete = doc.status === "PENDING" && doc.uploaded_by === "ORG";

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-6">
      {/* Breadcrumb */}
      <nav aria-label="breadcrumb" className="text-xs text-[#8B7F75]">
        <Link href={`/org/${orgId}`} className="hover:text-[#2D5A3D]">
          기관 홈
        </Link>
        <span className="mx-2">/</span>
        <Link
          href={`/org/${orgId}/documents`}
          className="hover:text-[#2D5A3D]"
        >
          서류 관리
        </Link>
        <span className="mx-2">/</span>
        <span className="font-semibold text-[#2D5A3D]">{meta.label}</span>
      </nav>

      {/* Header */}
      <header className="rounded-3xl border border-[#D4E4BC] bg-gradient-to-br from-[#E8F0E4] via-white to-[#FAE7D0] p-5 shadow-sm md:p-7">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-3xl" aria-hidden>
            {meta.icon}
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold text-[#2D5A3D] md:text-2xl">
              {meta.label}
            </h1>
            <p className="mt-1 text-xs text-[#6B6560] md:text-sm">
              버전 v{doc.version} · {fmtDateTime(doc.submitted_at)}
            </p>
          </div>
          <span
            className={`shrink-0 rounded-lg border px-3 py-1 text-sm font-semibold ${statusMeta.color}`}
          >
            {statusMeta.icon} {statusMeta.label}
          </span>
        </div>

        <div className="mt-3">
          <span
            className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-semibold ${uploaderMeta.chip}`}
          >
            {uploaderMeta.label}
          </span>
        </div>
      </header>

      {/* 반려 사유 */}
      {doc.status === "REJECTED" && doc.reject_reason && (
        <aside className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
          <h2 className="flex items-center gap-1.5 text-sm font-bold text-rose-800">
            <span>❌</span> 반려 사유
          </h2>
          <p className="mt-2 whitespace-pre-wrap text-sm text-rose-900">
            {doc.reject_reason}
          </p>
          <p className="mt-2 text-[11px] text-rose-700">
            검토일시: {fmtDateTime(doc.reviewed_at)}
          </p>
        </aside>
      )}

      {/* 파일 미리보기 */}
      <section className="rounded-2xl border border-[#D4E4BC] bg-white p-5 shadow-sm">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-[#2D5A3D]">
          <span>📎</span> 첨부 파일
        </h2>

        <div className="rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] p-3">
          <div className="flex items-center gap-3">
            <span className="text-3xl" aria-hidden>
              {isImage ? "🖼" : "📄"}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-[#2D5A3D]">
                {doc.file_name ?? "파일"}
              </p>
              <p className="text-xs text-[#6B6560]">
                {fmtSize(doc.file_size)} · {doc.mime_type ?? "파일"}
              </p>
            </div>
            {signedUrl ? (
              <a
                href={signedUrl}
                target="_blank"
                rel="noreferrer"
                className="shrink-0 rounded-lg border border-[#2D5A3D] bg-white px-3 py-1.5 text-xs font-semibold text-[#2D5A3D] hover:bg-[#E8F0E4]"
              >
                {isImage ? "🔍 원본" : "⬇ 다운로드"}
              </a>
            ) : (
              <span className="text-xs text-rose-600">미리보기 실패</span>
            )}
          </div>

          {isImage && signedUrl && (
            <div className="mt-3 overflow-hidden rounded-lg border border-[#D4E4BC] bg-white">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={signedUrl}
                alt={doc.file_name ?? meta.label}
                className="max-h-96 w-full object-contain"
              />
            </div>
          )}
          {!isImage && signedUrl && doc.mime_type === "application/pdf" && (
            <div className="mt-3 overflow-hidden rounded-lg border border-[#D4E4BC] bg-white">
              <iframe
                src={signedUrl}
                title={doc.file_name ?? meta.label}
                className="h-[60vh] w-full"
              />
            </div>
          )}
        </div>
      </section>

      {/* 상세 정보 */}
      <section className="rounded-2xl border border-[#D4E4BC] bg-white p-5 shadow-sm">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-[#2D5A3D]">
          <span>ℹ️</span> 상세 정보
        </h2>
        <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <Info
            label="상태"
            value={`${statusMeta.icon} ${statusMeta.label}`}
          />
          <Info label="업로더" value={uploaderMeta.label} />
          <Info label="버전" value={`v${doc.version}`} />
          <Info label="제출일시" value={fmtDateTime(doc.submitted_at)} />
          {doc.reviewed_at && (
            <Info label="검토일시" value={fmtDateTime(doc.reviewed_at)} />
          )}
          {doc.expires_at && (
            <Info label="만료일" value={fmtDateTime(doc.expires_at)} />
          )}
          {doc.notes && (
            <div className="sm:col-span-2">
              <dt className="text-xs font-semibold text-[#6B6560]">메모</dt>
              <dd className="mt-1 whitespace-pre-wrap rounded-lg border border-[#D4E4BC] bg-[#FFF8F0] p-3 text-sm text-[#2C2C2C]">
                {doc.notes}
              </dd>
            </div>
          )}
        </dl>
      </section>

      {/* 버전 히스토리 */}
      {history.length > 0 && (
        <section className="rounded-2xl border border-[#D4E4BC] bg-white p-5 shadow-sm">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-[#2D5A3D]">
            <span>🕒</span> 이전 버전 ({history.length})
          </h2>
          <ul className="divide-y divide-[#F0EBE3]">
            {history.map((h) => {
              const hSm = ORG_DOC_STATUS_META[h.status];
              const hUm = UPLOADER_META[h.uploaded_by];
              return (
                <li
                  key={h.id}
                  className="flex flex-wrap items-center gap-2 py-2"
                >
                  <span className="text-xs font-bold text-[#8B7F75]">
                    v{h.version}
                  </span>
                  <span
                    className={`rounded border px-1.5 py-0.5 text-[10px] ${hSm.color}`}
                  >
                    {hSm.icon} {hSm.label}
                  </span>
                  <span
                    className={`rounded border px-1.5 py-0.5 text-[10px] ${hUm.chip}`}
                  >
                    {hUm.label}
                  </span>
                  <span className="truncate text-xs text-[#6B6560]">
                    {fmtDateTime(h.submitted_at)}
                  </span>
                  <Link
                    href={`/org/${orgId}/documents/${h.id}`}
                    className="ml-auto text-[11px] font-semibold text-[#2D5A3D] hover:underline"
                  >
                    보기 →
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* 액션 */}
      <section className="flex flex-wrap items-center gap-2 rounded-2xl border border-[#D4E4BC] bg-white p-5 shadow-sm">
        <Link
          href={`/org/${orgId}/documents`}
          className="rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] px-4 py-2 text-sm font-semibold text-[#6B6560] hover:bg-[#F0EBE3]"
        >
          ← 목록
        </Link>
        <Link
          href={`/org/${orgId}/documents/upload?type=${doc.doc_type}`}
          className="rounded-xl bg-[#2D5A3D] px-4 py-2 text-sm font-semibold text-white hover:bg-[#3A7A52]"
        >
          📤 재제출 (새 버전)
        </Link>
        {canDelete && (
          <form
            action={async () => {
              "use server";
              await deleteOrgDocumentAction(orgId, doc.id);
            }}
            className="ml-auto"
          >
            <button
              type="submit"
              className="rounded-xl border border-rose-300 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100"
            >
              🗑 삭제
            </button>
          </form>
        )}
      </section>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold text-[#6B6560]">{label}</dt>
      <dd className="mt-0.5 text-sm text-[#2C2C2C]">{value}</dd>
    </div>
  );
}
