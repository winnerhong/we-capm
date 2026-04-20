import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

/**
 * Public pay link: /api/pay/:token
 *  - Resolves token → invoice id
 *  - 303 redirect to /invoice/:id (public view page)
 *  - Token-not-found 시 간단한 HTML 안내 (404)
 *
 * NOTE: 303 See Other 사용 (POST→GET 아니지만, 링크 클릭 시에도 안전).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const supabase = await createClient();

  const sb = supabase as unknown as {
    from: (t: string) => {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          single: () => Promise<{
            data: {
              id: string;
              invoice_number: string;
              target_name: string | null;
              total_amount: number;
              status: string;
            } | null;
          }>;
        };
      };
    };
  };

  const { data: invoice } = await sb
    .from("invoices")
    .select("id, invoice_number, target_name, total_amount, status")
    .eq("payment_link_token", token)
    .single();

  if (!invoice) {
    return new NextResponse(
      `<!doctype html><meta charset="utf-8"><title>청구서 없음</title>` +
        `<body style="font-family:system-ui;padding:40px;text-align:center">` +
        `<h1>청구서를 찾을 수 없습니다</h1>` +
        `<p>링크가 만료되었거나 잘못되었습니다.</p></body>`,
      {
        status: 404,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      }
    );
  }

  return NextResponse.redirect(
    new URL(`/invoice/${invoice.id}`, request.url),
    303
  );
}
