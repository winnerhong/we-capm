import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: event } = await supabase.from("events").select("join_code").eq("id", id).single();
  if (!event) return new NextResponse("Not Found", { status: 404 });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://we-capm.vercel.app";
  const joinUrl = `${appUrl}/join/${event.join_code}`;

  const png = await QRCode.toBuffer(joinUrl, {
    errorCorrectionLevel: "M",
    margin: 2,
    width: 512,
  });

  const url = new URL(request.url);
  const download = url.searchParams.get("download") === "1";

  const arrayBuffer = png.buffer.slice(png.byteOffset, png.byteOffset + png.byteLength) as ArrayBuffer;
  return new NextResponse(arrayBuffer, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "private, max-age=60",
      ...(download ? { "Content-Disposition": `attachment; filename="qr-${event.join_code}.png"` } : {}),
    },
  });
}
