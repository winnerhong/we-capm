/**
 * 한국 표준 세금계산서 프리뷰 컴포넌트.
 * - 공급자/공급받는자 섹션 분리
 * - 품목 테이블 + 합계 (공급가액 + VAT + 합계)
 * - print:* CSS로 인쇄 최적화 (A4 한 장)
 *
 * 실제 홈택스 연동 시에는 승인번호를 받아와 상단에 표시.
 */

export interface TaxInvoiceData {
  tax_invoice_number: string;
  issued_at?: string | null;
  type?: "TAX" | "CASH_RECEIPT" | "EXEMPT";
  supplier: {
    business_number: string;
    name: string;
    representative?: string | null;
    address?: string | null;
    business_type?: string | null;
    business_item?: string | null;
  };
  buyer: {
    business_number?: string | null;
    name: string;
    representative?: string | null;
    address?: string | null;
    email?: string | null;
  };
  items: Array<{
    name: string;
    spec?: string | null;
    quantity?: number | null;
    unit_price?: number | null;
    supply_amount: number;
    tax_amount: number;
  }>;
  supply_amount: number;
  tax_amount: number;
  total_amount: number;
  memo?: string | null;
}

function fmt(n: number): string {
  return n.toLocaleString("ko-KR");
}

export function TaxInvoicePreview({ data }: { data: TaxInvoiceData }) {
  const typeLabel =
    data.type === "CASH_RECEIPT"
      ? "현금영수증"
      : data.type === "EXEMPT"
        ? "면세계산서"
        : "세금계산서";

  return (
    <article
      className="mx-auto w-full max-w-3xl bg-white text-black print:shadow-none shadow-sm border border-neutral-300 print:border-black"
      aria-label={`${typeLabel} 미리보기`}
    >
      {/* 헤더 */}
      <header className="border-b-2 border-black px-6 py-5 text-center">
        <h1 className="text-2xl font-bold tracking-widest">
          {typeLabel}{" "}
          <span className="text-sm font-normal text-neutral-600">
            (공급받는자 보관용)
          </span>
        </h1>
        <div className="mt-2 flex justify-center gap-6 text-xs">
          <span>
            승인번호:{" "}
            <span className="font-mono font-semibold">
              {data.tax_invoice_number}
            </span>
          </span>
          {data.issued_at && (
            <span>
              발행일:{" "}
              <span className="font-mono">
                {new Date(data.issued_at).toLocaleDateString("ko-KR")}
              </span>
            </span>
          )}
        </div>
      </header>

      {/* 공급자 / 공급받는자 2단 */}
      <div className="grid grid-cols-1 md:grid-cols-2 border-b border-black divide-y md:divide-y-0 md:divide-x divide-black">
        <section className="p-4">
          <h2 className="mb-2 border-b border-neutral-400 pb-1 text-sm font-bold">
            공급자
          </h2>
          <dl className="space-y-1 text-xs">
            <Row label="등록번호" value={data.supplier.business_number} mono />
            <Row label="상호" value={data.supplier.name} bold />
            {data.supplier.representative && (
              <Row label="대표자" value={data.supplier.representative} />
            )}
            {data.supplier.address && (
              <Row label="사업장" value={data.supplier.address} />
            )}
            {data.supplier.business_type && (
              <Row label="업태" value={data.supplier.business_type} />
            )}
            {data.supplier.business_item && (
              <Row label="종목" value={data.supplier.business_item} />
            )}
          </dl>
        </section>
        <section className="p-4">
          <h2 className="mb-2 border-b border-neutral-400 pb-1 text-sm font-bold">
            공급받는자
          </h2>
          <dl className="space-y-1 text-xs">
            {data.buyer.business_number && (
              <Row label="등록번호" value={data.buyer.business_number} mono />
            )}
            <Row label="상호" value={data.buyer.name} bold />
            {data.buyer.representative && (
              <Row label="대표자" value={data.buyer.representative} />
            )}
            {data.buyer.address && (
              <Row label="사업장" value={data.buyer.address} />
            )}
            {data.buyer.email && <Row label="이메일" value={data.buyer.email} />}
          </dl>
        </section>
      </div>

      {/* 품목 테이블 */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <caption className="sr-only">품목 상세 내역</caption>
          <thead className="bg-neutral-100 border-b border-black">
            <tr>
              <th scope="col" className="px-2 py-2 font-semibold">
                품목
              </th>
              <th scope="col" className="px-2 py-2 font-semibold">
                규격
              </th>
              <th scope="col" className="px-2 py-2 text-right font-semibold">
                수량
              </th>
              <th scope="col" className="px-2 py-2 text-right font-semibold">
                단가
              </th>
              <th scope="col" className="px-2 py-2 text-right font-semibold">
                공급가액
              </th>
              <th scope="col" className="px-2 py-2 text-right font-semibold">
                세액
              </th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((item, idx) => (
              <tr key={idx} className="border-b border-neutral-300">
                <td className="px-2 py-2">{item.name}</td>
                <td className="px-2 py-2 text-neutral-600">
                  {item.spec ?? "—"}
                </td>
                <td className="px-2 py-2 text-right tabular-nums">
                  {item.quantity ?? "—"}
                </td>
                <td className="px-2 py-2 text-right tabular-nums">
                  {item.unit_price != null ? fmt(item.unit_price) : "—"}
                </td>
                <td className="px-2 py-2 text-right tabular-nums font-semibold">
                  {fmt(item.supply_amount)}
                </td>
                <td className="px-2 py-2 text-right tabular-nums">
                  {fmt(item.tax_amount)}
                </td>
              </tr>
            ))}
            {data.items.length === 0 && (
              <tr>
                <td colSpan={6} className="py-6 text-center text-neutral-500">
                  품목 없음
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* 합계 */}
      <section className="border-t-2 border-black p-4">
        <dl className="ml-auto grid max-w-sm grid-cols-2 gap-y-1 text-sm">
          <dt className="text-neutral-600">공급가액</dt>
          <dd className="text-right tabular-nums">{fmt(data.supply_amount)}원</dd>
          <dt className="text-neutral-600">세액 (VAT 10%)</dt>
          <dd className="text-right tabular-nums">{fmt(data.tax_amount)}원</dd>
          <dt className="mt-1 border-t border-black pt-1 font-bold">합계금액</dt>
          <dd className="mt-1 border-t border-black pt-1 text-right text-base font-extrabold tabular-nums">
            {fmt(data.total_amount)}원
          </dd>
        </dl>
      </section>

      {data.memo && (
        <footer className="border-t border-neutral-300 px-4 py-3 text-xs text-neutral-700">
          <span className="font-semibold">비고: </span>
          {data.memo}
        </footer>
      )}
    </article>
  );
}

function Row({
  label,
  value,
  mono,
  bold,
}: {
  label: string;
  value: string;
  mono?: boolean;
  bold?: boolean;
}) {
  return (
    <div className="flex gap-2">
      <dt className="w-16 flex-shrink-0 text-neutral-500">{label}</dt>
      <dd
        className={`min-w-0 break-words ${mono ? "font-mono" : ""} ${
          bold ? "font-bold" : ""
        }`}
      >
        {value}
      </dd>
    </div>
  );
}
