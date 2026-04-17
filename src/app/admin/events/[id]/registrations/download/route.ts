import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: event } = await supabase.from("events").select("name").eq("id", id).single();
  if (!event) return new NextResponse("Not Found", { status: 404 });

  const { data: regs } = await supabase
    .from("event_registrations")
    .select("name, phone, status, entered_at, created_at")
    .eq("event_id", id)
    .order("created_at", { ascending: true });

  const header = ["NO", "반명", "이름", "전화번호", "상태", "입장시각", "등록일"];
  const rows = (regs ?? []).map((r, i) => {
    const nameParts = r.name.match(/^\[(.+?)\]\s*(.+)$/);
    const className = nameParts ? nameParts[1] : "";
    const realName = nameParts ? nameParts[2] : r.name;

    return [
      String(i + 1),
      className,
      realName,
      r.phone,
      r.status === "ENTERED" ? "입장완료" : "미입장",
      r.entered_at ? new Date(r.entered_at).toLocaleString("ko-KR") : "",
      new Date(r.created_at).toLocaleString("ko-KR"),
    ];
  });

  const bom = "\uFEFF";
  const csv = bom + [header, ...rows].map((r) => r.join(",")).join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${event.name}_참가자명단.csv"`,
    },
  });
}
