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

  const { data: teachers } = await supabase
    .from("event_registrations")
    .select("name, phone, status, entered_at, created_at")
    .eq("event_id", id)
    .like("name", "%선생님%")
    .order("created_at", { ascending: true });

  const header = ["NO", "담당반", "이름", "전화번호", "상태", "입장시각"];
  const rows = (teachers ?? []).map((t, i) => {
    const match = t.name.match(/^\[선생님(?:\/(.+?))?\]\s*(.+)$/);
    const className = match?.[1] ?? "";
    const realName = match?.[2] ?? t.name;

    return [
      String(i + 1),
      className,
      realName,
      t.phone,
      t.status === "ENTERED" ? "입장완료" : "미입장",
      t.entered_at ? new Date(t.entered_at).toLocaleString("ko-KR") : "",
    ];
  });

  const bom = "\uFEFF";
  const csv = bom + [header, ...rows].map((r) => r.join(",")).join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${event.name}_선생님명단.csv"`,
    },
  });
}
