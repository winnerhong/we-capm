import { NextResponse } from "next/server";
import { Webhook } from "standardwebhooks";
import { sendOtpSms } from "@/lib/sms/solapi";

export const runtime = "nodejs";

interface SupabaseSmsHookPayload {
  user: { id: string; phone: string };
  sms: { otp: string };
}

export async function POST(request: Request) {
  const secret = process.env.SUPABASE_AUTH_HOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "hook secret not configured" }, { status: 500 });
  }

  const rawBody = await request.text();
  const headers = {
    "webhook-id": request.headers.get("webhook-id") ?? "",
    "webhook-timestamp": request.headers.get("webhook-timestamp") ?? "",
    "webhook-signature": request.headers.get("webhook-signature") ?? "",
  };

  const secretBase64 = secret.replace(/^v1,whsec_/, "");
  const wh = new Webhook(secretBase64);

  let payload: SupabaseSmsHookPayload;
  try {
    payload = wh.verify(rawBody, headers) as SupabaseSmsHookPayload;
  } catch {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  const { user, sms } = payload;
  if (!user?.phone || !sms?.otp) {
    return NextResponse.json({ error: "missing phone or otp" }, { status: 400 });
  }

  try {
    await sendOtpSms(user.phone, sms.otp);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "send failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
