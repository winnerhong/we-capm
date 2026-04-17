import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST(request: Request) {
  const cookieStore = await cookies();
  cookieStore.delete("campnic_manager");
  return NextResponse.redirect(new URL("/manager", request.url), { status: 303 });
}
