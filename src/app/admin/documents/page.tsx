import Link from "next/link";
import { requireAdmin } from "@/lib/auth-guard";
import { loadAllPendingDocuments } from "@/lib/documents/queries";
import {
  DOC_TYPE_META,
  type DocType,
  type DocumentRow,
} from "@/lib/documents/types";
import { signedDocUrl } from "@/lib/documents/signed-url";
import { ReviewActions } from "../partners/[id]/documents/review-actions";

export const dynamic = "force-dynamic";

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

function daysSince(iso: string | null | undefined): number {
  if (!iso) return 0;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return 0;
  return Math.floor((Date.now() - t) / 86_400_000);
}

type QueueRow = DocumentRow & { partner_name: string };

export default async function AdminDocumentsQueuePage() {
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

  const allPending = await loadAllPendingDocuments();

  // partner_id + doc_type별 최신 버전만 (이중 제출 중복 제거)
  const latestMap = new Map<string, QueueRow>();
  for (const d of allPending) {
    const key = `${d.partner_id}__${d.doc_type}`;
    const prev = latestMap.get(key);
    if (!prev || d.version > prev.version) latestMap.set(key, d);
  }
  // FIFO — 오래된 제출 먼저
  const queue = Array.from(latestMap.values()).sort((a, b) => {
    const at = new Date(a.submitted_at).getTime();
    const bt = new Date(b.submitted_at).getTime();
    return at - bt;
  });

  // 5일 이상 대기 경고
  const overdue = queue.filter((d) => daysSince(d.submitted_at) >= 5);

  // signed URL 프리로드
  const signedUrls = new Map<string, string | null>();
  await Promise.all(
    queue.map(async (d) => {
      const url = await signedDocUrl(d.file_url, 3600);
      signedUrls.set(d.id, url);
    })
  );

  // 파트너별 그룹
  const byPartner = new Map<
    string,
    { partner_name: string; partner_id: string; docs: QueueRow[] }
  >();
  for (const d of queue) {
    const entry = byPartner.get(d.partner_id) ?? {
      partner_name: d.partner_name || "(이름 없음)",
      partner_id: d.partner_id,
      docs: [],
    };
    entry.docs.push(d);
    byPartner.set(d.partner_id, entry);
  }
  const partnerGroups = Array.from(byPartner.values()).sort((a, b) => {
    // 가장 오래된 서류 기준
    const ao = a.docs[0] ? new Date(a.docs[0].submitted_at).getTime() : 0;
    const bo = b.docs[0] ? new Date(b.docs[0].submitted_at).getTime() : 0;
    return ao - bo;
  });

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav aria-label="breadcrumb" className="text-xs text-[#8B7F75]">
        <Link href="/admin" className="hover:text-[#2D5A3D]">
          관리자
        </Link>
        <span className="mx-2">/</span>
        <span className="font-semibold text-[#2D5A3D]">서류 검토 대기</span>
      </nav>

      {/* Header */}
      <header className="rounded-3xl border border-[#D4E4BC] bg-gradient-to-br from-[#E8F0E4] via-white to-[#FAE7D0] p-5 shadow-sm md:p-7">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-[#2D5A3D] md:text-2xl">
              ⏳ 서류 검토 대기
            </h1>
            <p className="mt-1 text-xs text-[#6B6560] md:text-sm">
              모든 지사의 검토 대기 서류를 오래된 제출 순으로 보여줘요. FIFO 원칙으로 처리하세요.
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
        <div className="mt-4 grid grid-cols-3 gap-2">
          <MiniStat label="검토 대기" value={queue.length} tone="amber" />
          <MiniStat label="대기 지사" value={partnerGroups.length} tone="green" />
          <MiniStat label="5일+ 지연" value={overdue.length} tone="rose" />
        </div>
      </header>

      {/* 지연 경고 */}
      {overdue.length > 0 && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
          <b className="font-bold">⚠️ {overdue.length}건</b>이 5일 이상 대기 중이에요.
          지사 운영이 지연될 수 있어요.
        </div>
      )}

      {/* 큐 */}
      {queue.length === 0 ? (
        <section className="rounded-2xl border border-dashed border-[#D4E4BC] bg-[#FFF8F0] p-12 text-center">
          <span className="text-5xl" aria-hidden>
            🎉
          </span>
          <h2 className="mt-3 text-lg font-bold text-[#2D5A3D]">
            모든 서류를 처리했어요!
          </h2>
          <p className="mt-1 text-xs text-[#6B6560]">
            현재 검토 대기중인 서류가 없습니다.
          </p>
        </section>
      ) : (
        <div className="space-y-5">
          {partnerGroups.map((g) => (
            <section
              key={g.partner_id}
              className="space-y-3 rounded-2xl border border-[#D4E4BC] bg-white p-4 shadow-sm md:p-5"
            >
              <header className="flex items-center justify-between gap-3 border-b border-[#E8E0D0] pb-2">
                <div className="min-w-0">
                  <h2 className="truncate text-base font-bold text-[#2D5A3D]">
                    🏡 {g.partner_name}
                  </h2>
                  <p className="mt-0.5 text-[11px] text-[#6B6560]">
                    검토 대기 {g.docs.length}건
                  </p>
                </div>
                <Link
                  href={`/admin/partners/${g.partner_id}/documents`}
                  className="shrink-0 rounded-lg border border-[#2D5A3D] bg-white px-2.5 py-1 text-[11px] font-semibold text-[#2D5A3D] hover:bg-[#E8F0E4]"
                >
                  전체 서류 →
                </Link>
              </header>

              <div className="space-y-3">
                {g.docs.map((d) => (
                  <QueueCard
                    key={d.id}
                    doc={d}
                    signedUrl={signedUrls.get(d.id) ?? null}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------- 하위 ---------- */

function MiniStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "amber" | "green" | "rose";
}) {
  const toneMap: Record<string, string> = {
    amber: "border-amber-200 bg-amber-50 text-amber-800",
    green: "border-[#D4E4BC] bg-[#E8F0E4] text-[#2D5A3D]",
    rose: "border-rose-200 bg-rose-50 text-rose-800",
  };
  return (
    <div className={`rounded-xl border px-3 py-2 ${toneMap[tone]}`}>
      <div className="text-[10px] font-semibold">{label}</div>
      <div className="text-xl font-bold">{value}</div>
    </div>
  );
}

function QueueCard({
  doc,
  signedUrl,
}: {
  doc: QueueRow;
  signedUrl: string | null;
}) {
  const meta = DOC_TYPE_META[doc.doc_type as DocType];
  const isImage = (doc.mime_type ?? "").startsWith("image/");
  const wait = daysSince(doc.submitted_at);
  const overdue = wait >= 5;

  return (
    <article
      className={`rounded-xl border p-3 ${
        overdue
          ? "border-rose-200 bg-rose-50/40"
          : "border-[#D4E4BC] bg-[#FFF8F0]"
      }`}
    >
      <header className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-lg" aria-hidden>
            {meta.icon}
          </span>
          <h3 className="text-sm font-bold text-[#2D5A3D]">{meta.label}</h3>
          <span className="text-[10px] text-[#8B7F75]">v{doc.version}</span>
        </div>
        <span
          className={`rounded-lg border px-2 py-0.5 text-[11px] font-semibold ${
            overdue
              ? "border-rose-300 bg-rose-100 text-rose-800"
              : "border-amber-200 bg-amber-50 text-amber-800"
          }`}
        >
          {overdue ? `⚠️ ${wait}일 대기` : `⏳ ${wait === 0 ? "오늘" : `${wait}일 전`}`}
        </span>
      </header>

      <div className="grid gap-3 md:grid-cols-[140px_1fr]">
        <div className="overflow-hidden rounded-lg border border-[#D4E4BC] bg-white">
          {isImage && signedUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={signedUrl}
              alt={doc.file_name ?? meta.label}
              className="h-32 w-full object-cover"
            />
          ) : (
            <div className="flex h-32 flex-col items-center justify-center gap-1">
              <span className="text-3xl" aria-hidden>
                📄
              </span>
              <p className="px-2 text-center text-[10px] text-[#6B6560]">
                {doc.mime_type ?? "파일"}
              </p>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <div className="text-xs text-[#6B6560]">
            <p className="truncate">
              📎 <b className="text-[#2D5A3D]">{doc.file_name ?? "파일"}</b> ·{" "}
              {fmtSize(doc.file_size)}
            </p>
            <p className="mt-0.5 text-[11px]">
              제출: {fmtDateTime(doc.submitted_at)}
            </p>
            {doc.notes && (
              <p className="mt-1 whitespace-pre-wrap rounded-lg bg-white p-2 text-[11px]">
                💬 {doc.notes}
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {signedUrl ? (
              <a
                href={signedUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg border border-[#2D5A3D] bg-white px-2.5 py-1 text-xs font-semibold text-[#2D5A3D] hover:bg-[#E8F0E4]"
              >
                {isImage ? "🔍 원본" : "⬇ 다운로드"}
              </a>
            ) : (
              <span className="text-xs text-rose-600">⚠️ 파일 URL 실패</span>
            )}
            <ReviewActions documentId={doc.id} />
          </div>
        </div>
      </div>
    </article>
  );
}
