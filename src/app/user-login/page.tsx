import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getAppUser } from "@/lib/user-auth-guard";
import { LoginForm } from "./login-form";
import { AcornIcon } from "@/components/acorn-icon";

export const dynamic = "force-dynamic";

export default async function UserLoginPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string }>;
}) {
  const existing = await getAppUser();
  if (existing) redirect("/home");

  const sp = (await searchParams) ?? {};
  const initialError =
    typeof sp.error === "string" && sp.error.trim() ? sp.error : null;

  return (
    <main className="flex min-h-dvh items-center justify-center bg-gradient-to-b from-[#FFF8F0] via-[#F5F1E8] to-[#E8F0E4] px-4 py-10">
      <div className="w-full max-w-md space-y-6">
        {/* Logo / heading */}
        <div className="text-center">
          <div
            className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-[#D4E4BC] to-[#FAE7D0] text-[#2D5A3D] shadow-md"
          >
            <AcornIcon size={40} />
          </div>
          <h1 className="mt-4 text-2xl font-bold text-[#2D5A3D]">
            토리로에 오신 걸 환영해요
          </h1>
          <p className="mt-1.5 text-sm text-[#6B6560]">
            학부모 연락처만 입력하면 바로 입장돼요
          </p>
        </div>

        {/* Card */}
        <section className="rounded-3xl border border-[#D4E4BC] bg-white/80 p-6 shadow-sm backdrop-blur-sm">
          <Suspense fallback={<div className="h-40" aria-hidden />}>
            <LoginForm initialError={initialError} />
          </Suspense>
        </section>

        {/* Help */}
        <p className="text-center text-xs text-[#8B7F75]">
          로그인이 안 되나요? 기관(어린이집·학교)에 문의해주세요.
        </p>

        <div className="flex justify-center">
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-xs text-[#8B7F75] transition hover:text-[#2D5A3D]"
          >
            ← 첫 화면으로
          </Link>
        </div>
      </div>
    </main>
  );
}
