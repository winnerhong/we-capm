import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { requireOrg } from "@/lib/org-auth-guard";
import { loadOrgTrailById } from "@/lib/trails/queries";
import { generateQrSvg, buildQrUrl } from "@/lib/trails/qr-code";
import { ensureOrgTrailQrCodeAction } from "../../../actions";
import { PrintButton } from "@/app/partner/trails/[id]/qr/print-button";
import { QrDownloadButtons } from "./qr-download-buttons";

async function getRequestBaseUrl(): Promise<string> {
  const h = await headers();
  const host = h.get("host");
  if (!host) return "";
  const proto = h.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}

export const dynamic = "force-dynamic";

export default async function OrgOwnTrailQrPage({
  params,
}: {
  params: Promise<{ orgId: string; id: string }>;
}) {
  const { orgId, id } = await params;
  const session = await requireOrg();

  const trail = await loadOrgTrailById(id);
  if (!trail) notFound();
  if (trail.org_id !== session.orgId) {
    redirect(`/org/${orgId}/trails`);
  }

  // qr_code 가 없으면 발급 후 같은 페이지로 리다이렉트 (액션이 RSC 캐시 무효화)
  if (!trail.qr_code) {
    await ensureOrgTrailQrCodeAction(id);
    redirect(`/org/${orgId}/trails/own/${id}/qr`);
  }

  // 현재 요청 도메인 기준으로 baseUrl 빌드 — 환경변수 의존 없이 작동.
  const baseUrl = await getRequestBaseUrl();
  const qrSvg = await generateQrSvg(trail.qr_code, { baseUrl });
  const scanUrl = buildQrUrl(trail.qr_code, baseUrl);

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <nav className="text-xs text-[#6B6560] print:hidden">
        <Link href={`/org/${orgId}`} className="hover:underline">
          기관홈
        </Link>
        <span className="mx-1">›</span>
        <Link href={`/org/${orgId}/trails`} className="hover:underline">
          My 코스관리
        </Link>
        <span className="mx-1">›</span>
        <span className="font-semibold text-[#2D5A3D]">{trail.name}</span>
        <span className="mx-1">›</span>
        <span className="font-semibold text-[#2D5A3D]">QR 인쇄</span>
      </nav>

      <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#D4E4BC] bg-white p-4 shadow-sm print:hidden">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-bold text-[#2D5A3D]">
            🎫 QR 인쇄
          </h1>
          <p className="mt-1 text-xs text-[#6B6560]">
            {trail.name} · 스캔 시 코스 안내 페이지가 열려요
          </p>
          <p className="mt-1 break-all text-[10px] text-[#8B7F75]">
            🔗 {scanUrl}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/org/${orgId}/trails/own/${id}/edit`}
            className="rounded-xl border border-[#D4E4BC] bg-white px-3 py-2 text-xs font-bold text-[#2D5A3D] transition hover:bg-[#F5F1E8]"
          >
            ✏️ 편집
          </Link>
          <QrDownloadButtons
            qrCode={trail.qr_code}
            qrSvg={qrSvg}
            filenameBase={trail.name}
          />
          <PrintButton />
        </div>
      </section>

      <p className="rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] px-4 py-3 text-xs text-[#6B6560] print:hidden">
        💡 브라우저 인쇄 다이얼로그에서 <b>용지 크기 A3</b> (또는 원하는 크기) 를
        선택하면 큰 포스터로 출력됩니다. QR 은 벡터(SVG)라 어떤 크기로 인쇄해도
        선명합니다.
      </p>

      {/* 인쇄 화면 — 한 장에 QR + 코스 이름 + 설명 */}
      <div className="page-break flex min-h-[70vh] flex-col items-center justify-center rounded-2xl border border-[#D4E4BC] bg-white p-10 text-center shadow-sm print:min-h-[90vh] print:rounded-none print:border-0 print:shadow-none">
        <div className="text-xs font-semibold uppercase tracking-wider text-[#6B6560]">
          🏡 토리로 · 기관 자체 코스
        </div>
        <h2 className="mt-3 text-3xl font-extrabold text-[#2D5A3D]">
          {trail.name}
        </h2>
        {trail.description && (
          <p className="mt-3 max-w-md whitespace-pre-line text-sm text-[#6B6560]">
            {trail.description}
          </p>
        )}
        <div
          role="img"
          aria-label={`${trail.name} QR`}
          dangerouslySetInnerHTML={{ __html: qrSvg }}
          className="mt-6 h-72 w-72 rounded-2xl border-4 border-[#2D5A3D] bg-white p-2 shadow-sm [&>svg]:h-full [&>svg]:w-full print:h-[200mm] print:w-[200mm]"
        />
        <div className="mt-4 text-xs text-[#6B6560]">
          📱 카메라로 QR을 스캔하면 코스 안내가 열려요
        </div>
        <div className="mt-2 break-all rounded-full bg-[#F5F1E8] px-3 py-1 text-[10px] text-[#6B6560]">
          {scanUrl}
        </div>
      </div>

      <style>{`
        @media print {
          body { background: white !important; }
          /* @page size 미지정 — 인쇄 다이얼로그 선택(A4/A3) 그대로 사용 */
          @page { margin: 10mm; }
        }
      `}</style>
    </div>
  );
}
