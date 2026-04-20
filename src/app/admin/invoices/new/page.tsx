import { Suspense } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { InvoiceForm, type PartnerOption } from "./invoice-form";

export const dynamic = "force-dynamic";

export default async function NewInvoicePage() {
  const supabase = await createClient();

  // 숲지기(파트너) 목록을 서버에서 가져와 드롭다운 데이터로 넘겨준다.
  let partners: PartnerOption[] = [];
  try {
    const { data } = await (
      supabase as unknown as {
        from: (t: string) => {
          select: (c: string) => {
            order: (
              col: string,
              opts: { ascending: boolean },
            ) => Promise<{
              data:
                | {
                    id: string;
                    name: string;
                    business_name: string | null;
                    email: string | null;
                    phone: string | null;
                  }[]
                | null;
              error: unknown;
            }>;
          };
        };
      }
    )
      .from("partners")
      .select("id, name, business_name, email, phone")
      .order("name", { ascending: true });

    partners = (data ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      business_name: p.business_name,
      email: p.email,
      phone: p.phone,
    }));
  } catch {
    partners = [];
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex items-center justify-between">
        <Link
          href="/admin/invoices"
          className="text-sm font-medium text-[#2D5A3D] hover:underline"
        >
          ← 청구서 목록
        </Link>
      </div>

      <div className="rounded-2xl bg-gradient-to-br from-[#2D5A3D] via-[#3A7A52] to-[#4A7C59] p-6 text-white shadow-sm">
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <span>📤</span>
          <span>새 청구서 발송</span>
        </h1>
        <p className="mt-1 text-sm text-white/80">
          숲지기·기관·광고주에게 청구서를 발송하고 입금을 기다립니다
        </p>
      </div>

      <Suspense
        fallback={
          <div className="rounded-2xl border border-[#D4E4BC] bg-white p-8 text-center text-sm text-[#6B6560]">
            폼을 불러오는 중...
          </div>
        }
      >
        <InvoiceForm partners={partners} />
      </Suspense>
    </div>
  );
}
