import Link from "next/link";
import { requireAdmin } from "@/lib/auth-guard";
import { createClient } from "@/lib/supabase/server";
import { loadPartnerDocuments } from "@/lib/documents/queries";
import {
  DOC_TYPE_META,
  STATUS_META,
  type DocStatus,
  type DocType,
  type DocumentRow,
} from "@/lib/documents/types";
import { signedDocUrl } from "@/lib/documents/signed-url";
import { ReviewActions } from "./review-actions";
import { DocumentImageViewer } from "./document-image-viewer";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
};

type PartnerInfo = {
  id: string;
  name: string | null;
  username: string | null;
  business_name: string | null;
  email: string | null;
  phone: string | null;
};

async function loadPartnerInfo(id: string): Promise<PartnerInfo | null> {
  const supabase = await createClient();
  try {
    const { data } = await (
      supabase.from("partners") as unknown as {
        select: (c: string) => {
          eq: (k: string, v: string) => {
            maybeSingle: () => Promise<{ data: PartnerInfo | null }>;
          };
        };
      }
    )
      .select("id,name,username,business_name,email,phone")
      .eq("id", id)
      .maybeSingle();
    return data ?? null;
  } catch {
    return null;
  }
}

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

export default async function AdminPartnerDocumentsPage({ params }: PageProps) {
  const { id: partnerId } = await params;

  try {
    await requireAdmin();
  } catch {
    return (
      <div className="space-y-4 rounded-3xl border border-rose-200 bg-rose-50 p-6 text-center">
        <h1 className="text-xl font-bold text-rose-800">관리자 권한 필요</h1>
        <Link
          href="/admin"
          className="inline-block rounded-xl border border-rose-300 bg-white px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100"
        >
          관리자 로그인
        </Link>
      </div>
    );
  }

  const [partner, docs] = await Promise.all([
    loadPartnerInfo(partnerId),
    loadPartnerDocuments(partnerId),
  ]);

  if (!partner) {
    return (
      <div className="space-y-4 rounded-3xl border border-rose-200 bg-rose-50 p-6 text-center">
        <h1 className="text-xl font-bold text-rose-800">파트너를 찾을 수 없음</h1>
        <Link
          href="/admin/partners"
          className="inline-block rounded-xl border border-rose-300 bg-white px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100"
        >
          파트너 목록
        </Link>
      </div>
    );
  }

  // 최신 버전만 (doc_type별 최신)
  const latestMap = new Map<DocType, DocumentRow>();
  for (const d of docs) {
    const prev = latestMap.get(d.doc_type);
    if (!prev || d.version > prev.version) latestMap.set(d.doc_type, d);
  }
  const latest = Array.from(latestMap.values());

  const groups: Record<DocStatus, DocumentRow[]> = {
    PENDING: [],
    APPROVED: [],
    REJECTED: [],
    EXPIRED: [],
  };
  for (const d of latest) groups[d.status].push(d);

  // signed URL pre-load
  const signedUrls = new Map<string, string | null>();
  await Promise.all(
    latest.map(async (d) => {
      const url = await signedDocUrl(d.file_url, 3600);
      signedUrls.set(d.id, url);
    })
  );

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav aria-label="breadcrumb" className="text-xs text-[#8B7F75]">
        <Link href="/admin" className="hover:text-[#2D5A3D]">
          관리자
        </Link>
        <span className="mx-2">/</span>
        <Link href="/admin/partners" className="hover:text-[#2D5A3D]">
          파트너
        </Link>
        <span className="mx-2">/</span>
        <span className="font-semibold text-[#2D5A3D]">
          {partner.name ?? partner.username} — 서류
        </span>
      </nav>

      {/* Header */}
      <header className="rounded-3xl border border-[#D4E4BC] bg-gradient-to-br from-[#E8F0E4] via-white to-[#FAE7D0] p-5 shadow-sm md:p-7">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-[#2D5A3D] md:text-2xl">
              📄 {partner.name ?? partner.username} 서류 검토
            </h1>
            <p className="mt-1 text-xs text-[#6B6560] md:text-sm">
              {partner.business_name && `${partner.business_name} · `}
              {partner.email ?? ""}
              {partner.phone && ` · ${partner.phone}`}
            </p>
          </div>
          <Link
            href="/admin/partners"
            className="shrink-0 rounded-xl border border-[#D4E4BC] bg-white px-3 py-1.5 text-xs font-semibold text-[#2D5A3D] hover:bg-[#E8F0E4]"
          >
            ← 파트너 목록
          </Link>
        </div>

        {/* 요약 */}
        <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4">
          <MiniStat
            label="검토 대기"
            value={groups.PENDING.length}
            tone="amber"
          />
          <MiniStat label="승인" value={groups.APPROVED.length} tone="emerald" />
          <MiniStat label="반려" value={groups.REJECTED.length} tone="rose" />
          <MiniStat label="만료" value={groups.EXPIRED.length} tone="zinc" />
        </div>
      </header>

      {/* 검토 대기 (가장 먼저) */}
      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-base font-bold text-[#2D5A3D]">
          <span>⏳</span> 검토 대기 ({groups.PENDING.length})
        </h2>
        {groups.PENDING.length === 0 ? (
          <p className="rounded-xl border border-dashed border-[#D4E4BC] bg-[#FFF8F0] p-4 text-center text-xs text-[#6B6560]">
            검토할 서류가 없어요
          </p>
        ) : (
          <div className="space-y-3">
            {groups.PENDING.map((d) => (
              <DocReviewCard
                key={d.id}
                doc={d}
                signedUrl={signedUrls.get(d.id) ?? null}
                showActions
              />
            ))}
          </div>
        )}
      </section>

      {/* 승인된 서류 */}
      {groups.APPROVED.length > 0 && (
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-base font-bold text-emerald-700">
            <span>✅</span> 승인됨 ({groups.APPROVED.length})
          </h2>
          <div className="space-y-3">
            {groups.APPROVED.map((d) => (
              <DocReviewCard
                key={d.id}
                doc={d}
                signedUrl={signedUrls.get(d.id) ?? null}
              />
            ))}
          </div>
        </section>
      )}

      {/* 반려된 서류 */}
      {groups.REJECTED.length > 0 && (
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-base font-bold text-rose-700">
            <span>❌</span> 반려됨 ({groups.REJECTED.length})
          </h2>
          <div className="space-y-3">
            {groups.REJECTED.map((d) => (
              <DocReviewCard
                key={d.id}
                doc={d}
                signedUrl={signedUrls.get(d.id) ?? null}
              />
            ))}
          </div>
        </section>
      )}

      {/* 만료된 서류 */}
      {groups.EXPIRED.length > 0 && (
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-base font-bold text-zinc-600">
            <span>⚰️</span> 만료됨 ({groups.EXPIRED.length})
          </h2>
          <div className="space-y-3">
            {groups.EXPIRED.map((d) => (
              <DocReviewCard
                key={d.id}
                doc={d}
                signedUrl={signedUrls.get(d.id) ?? null}
              />
            ))}
          </div>
        </section>
      )}

      {latest.length === 0 && (
        <p className="rounded-2xl border border-dashed border-[#D4E4BC] bg-[#FFF8F0] p-8 text-center text-sm text-[#6B6560]">
          아직 제출된 서류가 없어요
        </p>
      )}
    </div>
  );
}

/* ---------- 하위 컴포넌트 ---------- */

function MiniStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "amber" | "emerald" | "rose" | "zinc";
}) {
  const toneMap: Record<string, string> = {
    amber: "border-amber-200 bg-amber-50 text-amber-800",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-800",
    rose: "border-rose-200 bg-rose-50 text-rose-800",
    zinc: "border-zinc-200 bg-zinc-50 text-zinc-700",
  };
  return (
    <div className={`rounded-xl border px-3 py-2 ${toneMap[tone]}`}>
      <div className="text-[10px] font-semibold">{label}</div>
      <div className="text-xl font-bold">{value}</div>
    </div>
  );
}

function DocReviewCard({
  doc,
  signedUrl,
  showActions,
}: {
  doc: DocumentRow;
  signedUrl: string | null;
  showActions?: boolean;
}) {
  const meta = DOC_TYPE_META[doc.doc_type as DocType];
  const statusMeta = STATUS_META[doc.status];
  const isImage = (doc.mime_type ?? "").startsWith("image/");

  return (
    <article className="rounded-2xl border border-[#D4E4BC] bg-white p-4 shadow-sm md:p-5">
      <header className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xl" aria-hidden>
              {meta.icon}
            </span>
            <h3 className="truncate text-sm font-bold text-[#2D5A3D] md:text-base">
              {meta.label}
            </h3>
            <span className="text-[10px] text-[#8B7F75]">v{doc.version}</span>
          </div>
          <p className="mt-0.5 text-[11px] text-[#6B6560]">
            제출: {fmtDateTime(doc.submitted_at)}
            {doc.expires_at && ` · 만료: ${fmtDateTime(doc.expires_at)}`}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-lg border px-2 py-0.5 text-[11px] font-semibold ${statusMeta.color}`}
        >
          {statusMeta.icon} {statusMeta.label}
        </span>
      </header>

      {/* 파일 미리보기 */}
      <div className="grid gap-3 md:grid-cols-[180px_1fr]">
        <div>
          <DocumentImageViewer
            signedUrl={signedUrl ?? ""}
            alt={doc.file_name ?? meta.label}
            fileName={doc.file_name ?? "파일"}
            fileSize={doc.file_size}
            isImage={isImage}
            mimeType={doc.mime_type}
          />
        </div>

        <div className="flex flex-col gap-3">
          <div className="text-xs text-[#6B6560]">
            <p className="truncate">
              📎 <b className="text-[#2D5A3D]">{doc.file_name ?? "파일"}</b> ·{" "}
              {fmtSize(doc.file_size)}
            </p>
            {doc.notes && (
              <p className="mt-1 whitespace-pre-wrap rounded-lg bg-[#FFF8F0] p-2 text-[11px]">
                💬 {doc.notes}
              </p>
            )}
            {doc.reject_reason && (
              <p className="mt-1 whitespace-pre-wrap rounded-lg border border-rose-200 bg-rose-50 p-2 text-[11px] text-rose-900">
                <b>반려 사유:</b> {doc.reject_reason}
              </p>
            )}
          </div>

          {showActions && <ReviewActions documentId={doc.id} />}
        </div>
      </div>
    </article>
  );
}
