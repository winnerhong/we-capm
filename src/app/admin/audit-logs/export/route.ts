import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";

const USER_TYPES = ["ADMIN", "MANAGER", "PARTNER", "PARTICIPANT", "PUBLIC"];
const MAX_EXPORT_ROWS = 10_000;

type LogRow = {
  id: string;
  user_type: string;
  user_id: string | null;
  user_identifier: string | null;
  action: string;
  resource: string | null;
  ip_address: string | null;
  user_agent: string | null;
  status_code: number | null;
  created_at: string;
};

function csvEscape(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (str.includes(",") || str.includes("\"") || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function GET(request: Request) {
  // Admin guard
  const cookieStore = await cookies();
  const admin = cookieStore.get("campnic_admin")?.value;
  if (!admin) {
    return NextResponse.json({ error: "관리자 권한이 필요합니다" }, { status: 401 });
  }

  const url = new URL(request.url);
  const userType = url.searchParams.get("user_type");
  const action = url.searchParams.get("action");
  const daysRaw = url.searchParams.get("days");
  const days = Math.max(1, Math.min(365, Number(daysRaw ?? 7)));
  const sinceIso = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const supabase = await createClient();

  type RunnerChain = {
    eq: (k: string, v: string) => RunnerChain;
    order: (k: string, o: { ascending: boolean }) => {
      limit: (n: number) => Promise<{ data: LogRow[] | null; error: unknown }>;
    };
  };

  const qr = supabase as unknown as {
    from: (t: string) => {
      select: (c: string) => { gte: (k: string, v: string) => RunnerChain };
    };
  };
  let runner: RunnerChain = qr
    .from("access_logs")
    .select("*")
    .gte("created_at", sinceIso);

  if (userType && USER_TYPES.includes(userType)) {
    runner = runner.eq("user_type", userType);
  }
  if (action) {
    runner = runner.eq("action", action);
  }

  const { data: logs } = await runner
    .order("created_at", { ascending: false })
    .limit(MAX_EXPORT_ROWS);

  const rows = logs ?? [];

  const header = [
    "id",
    "created_at",
    "user_type",
    "user_id",
    "user_identifier",
    "action",
    "resource",
    "ip_address",
    "user_agent",
    "status_code",
  ];

  const lines = [header.join(",")];
  for (const r of rows) {
    lines.push(
      [
        r.id,
        r.created_at,
        r.user_type,
        r.user_id ?? "",
        r.user_identifier ?? "",
        r.action,
        r.resource ?? "",
        r.ip_address ?? "",
        r.user_agent ?? "",
        r.status_code ?? "",
      ]
        .map(csvEscape)
        .join(",")
    );
  }

  // UTF-8 BOM for Excel compatibility
  const body = "\uFEFF" + lines.join("\r\n");
  const filename = `access_logs_${days}d_${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
