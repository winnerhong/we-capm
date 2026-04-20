import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requirePartner } from "@/lib/auth-guard";
import { DownloadErrorsButton } from "./download-button";

export const dynamic = "force-dynamic";

type ImportRow = {
  id: string;
  partner_id: string;
  import_type: "ORG" | "CUSTOMER" | "COMPANY";
  file_name: string | null;
  total_rows: number;
  success_rows: number;
  error_rows: number;
  skipped_rows: number;
  error_details: unknown;
  created_at: string;
};

const TYPE_META: Record<ImportRow["import_type"], { label: string; icon: string }> = {
  ORG: { label: "기관", icon: "🏫" },
  CUSTOMER: { label: "개인", icon: "👨‍👩‍👧" },
  COMPANY: { label: "기업", icon: "🏢" },
};

export default async function BulkImportHistoryPage() {
  const partner = await requirePartner();
  const supabase = await createClient();

  const { data } = await (
    supabase.from("partner_bulk_imports") as unknown as {
      select: (c: string) => {
        eq: (c: string, v: string) => {
          order: (
            c: string,
            o: { ascending: boolean }
          ) => {
            limit: (n: number) => Promise<{ data: ImportRow[] | null }>;
          };
        };
      };
    }
  )
    .select("*")
    .eq("partner_id", partner.id)
    .order("created_at", { ascending: false })
    .limit(100);

  const rows: ImportRow[] = data ?? [];

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Link
            href="/partner/customers/bulk-import"
            className="text-sm text-[#6B6560] hover:text-[#2D5A3D]"
          >
            ← 일괄 등록으로
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-[#2D5A3D] md:text-3xl">
            📜 일괄 등록 이력
          </h1>
          <p className="mt-1 text-sm text-[#6B6560]">
            최근 100건의 등록 기록입니다.
          </p>
        </div>
        <Link
          href="/partner/customers/bulk-import"
          className="rounded-lg bg-[#2D5A3D] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1F4030]"
        >
          + 새 일괄 등록
        </Link>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-[#D4E4BC] bg-[#FFF8F0] p-10 text-center">
          <div className="text-5xl">🌱</div>
          <p className="mt-2 text-sm text-[#6B6560]">
            아직 일괄 등록 이력이 없습니다.
          </p>
          <Link
            href="/partner/customers/bulk-import"
            className="mt-4 inline-block rounded-lg bg-[#2D5A3D] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1F4030]"
          >
            지금 등록하러 가기 →
          </Link>
        </div>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="space-y-3 md:hidden">
            {rows.map((r) => (
              <MobileCard key={r.id} row={r} />
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden overflow-x-auto rounded-2xl border border-[#D4E4BC] bg-white shadow-sm md:block">
            <table className="w-full text-sm">
              <thead className="bg-[#F4FBE8] text-left text-xs font-semibold text-[#2D5A3D]">
                <tr>
                  <th className="px-4 py-3">날짜</th>
                  <th className="px-4 py-3">유형</th>
                  <th className="px-4 py-3">파일명</th>
                  <th className="px-4 py-3 text-right">전체</th>
                  <th className="px-4 py-3 text-right text-emerald-700">성공</th>
                  <th className="px-4 py-3 text-right text-amber-700">건너뜀</th>
                  <th className="px-4 py-3 text-right text-rose-700">실패</th>
                  <th className="px-4 py-3">상세</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const meta = TYPE_META[r.import_type];
                  const errorCount = Array.isArray(r.error_details)
                    ? (r.error_details as unknown[]).length
                    : 0;
                  return (
                    <tr
                      key={r.id}
                      className="border-t border-[#D4E4BC] hover:bg-[#FFF8F0]"
                    >
                      <td className="px-4 py-3 text-xs text-[#6B6560]">
                        {new Date(r.created_at).toLocaleString("ko-KR")}
                      </td>
                      <td className="px-4 py-3">
                        <span className="rounded-full bg-[#F4FBE8] px-2 py-0.5 text-xs font-semibold text-[#2D5A3D]">
                          {meta.icon} {meta.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-[#2D5A3D]">
                        {r.file_name ?? (
                          <span className="text-[#6B6560]">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        {r.total_rows}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-emerald-700">
                        {r.success_rows}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-amber-700">
                        {r.skipped_rows}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-rose-700">
                        {r.error_rows}
                      </td>
                      <td className="px-4 py-3">
                        {errorCount > 0 ? (
                          <DownloadErrorsButton
                            rowId={r.id}
                            fileName={
                              r.file_name ??
                              `일괄등록_${r.created_at.slice(0, 10)}`
                            }
                            errors={r.error_details}
                          />
                        ) : (
                          <span className="text-xs text-[#6B6560]">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function MobileCard({ row }: { row: ImportRow }) {
  const meta = TYPE_META[row.import_type];
  const errorCount = Array.isArray(row.error_details)
    ? (row.error_details as unknown[]).length
    : 0;

  return (
    <div className="rounded-xl border border-[#D4E4BC] bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-[#F4FBE8] px-2 py-0.5 text-xs font-semibold text-[#2D5A3D]">
              {meta.icon} {meta.label}
            </span>
            <span className="text-xs text-[#6B6560]">
              {new Date(row.created_at).toLocaleString("ko-KR")}
            </span>
          </div>
          {row.file_name && (
            <div className="mt-1 truncate text-xs text-[#2D5A3D]">
              📄 {row.file_name}
            </div>
          )}
        </div>
      </div>
      <div className="mt-3 grid grid-cols-4 gap-2 text-center text-xs">
        <div className="rounded bg-[#F4FBE8] p-2">
          <div className="font-bold text-[#2D5A3D]">{row.total_rows}</div>
          <div className="text-[#6B6560]">전체</div>
        </div>
        <div className="rounded bg-emerald-50 p-2">
          <div className="font-bold text-emerald-800">{row.success_rows}</div>
          <div className="text-emerald-700">성공</div>
        </div>
        <div className="rounded bg-amber-50 p-2">
          <div className="font-bold text-amber-800">{row.skipped_rows}</div>
          <div className="text-amber-700">건너뜀</div>
        </div>
        <div className="rounded bg-rose-50 p-2">
          <div className="font-bold text-rose-800">{row.error_rows}</div>
          <div className="text-rose-700">실패</div>
        </div>
      </div>
      {errorCount > 0 && (
        <div className="mt-3">
          <DownloadErrorsButton
            rowId={row.id}
            fileName={row.file_name ?? `일괄등록_${row.created_at.slice(0, 10)}`}
            errors={row.error_details}
          />
        </div>
      )}
    </div>
  );
}
