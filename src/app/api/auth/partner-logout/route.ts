import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function POST() {
  const cookieStore = await cookies();
  cookieStore.delete("campnic_partner");
  return NextResponse.redirect(
    new URL(
      "/partner",
      process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:1000"
    ),
    { status: 303 }
  );
}
