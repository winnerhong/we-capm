import { NextResponse } from "next/server";
import { getPartner } from "@/lib/auth-guard";
import { createClient } from "@/lib/supabase/server";
import { logAccess, getRequestMeta } from "@/lib/audit-log";

export const dynamic = "force-dynamic";

/**
 * 파트너용 개인정보 열람권 (PIPA 제35조)
 */
export async function GET(request: Request) {
  const partner = await getPartner();
  if (!partner) {
    return NextResponse.json(
      { error: "로그인이 필요합니다" },
      { status: 401 }
    );
  }

  const supabase = await createClient();

  const { data: profile } = await (
    supabase.from("partners") as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          maybeSingle: () => Promise<{ data: Record<string, unknown> | null }>;
        };
      };
    }
  )
    .select("id,name,username,business_name,email,phone,tier,status,created_at")
    .eq("id", partner.id)
    .maybeSingle();

  const { data: programs } = await (
    supabase.from("partner_programs") as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => Promise<{
          data: Record<string, unknown>[] | null;
        }>;
      };
    }
  )
    .select("*")
    .eq("partner_id", partner.id);

  const myData = {
    exported_at: new Date().toISOString(),
    pipa_notice:
      "본 데이터는 개인정보보호법 제35조(열람권)에 따라 본인에게 제공됩니다. 타인에게 공유하지 마세요.",
    partner_profile: profile,
    programs: programs ?? [],
  };

  const meta = getRequestMeta(request.headers);
  await logAccess(supabase, {
    user_type: "PARTNER",
    user_id: partner.id,
    user_identifier: partner.username,
    action: "EXPORT_PARTNER_DATA",
    status_code: 200,
    ...meta,
  });

  const datePart = new Date().toISOString().slice(0, 10);
  return new NextResponse(JSON.stringify(myData, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="toriro_partner_data_${datePart}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
