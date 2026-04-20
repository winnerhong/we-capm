import Link from "next/link";
import { requirePartner } from "@/lib/auth-guard";
import { SegmentBuilder } from "./segment-builder";

export const dynamic = "force-dynamic";

export default async function NewSegmentPage() {
  await requirePartner();

  return (
    <div className="space-y-6">
      <nav className="text-xs text-[#6B6560]">
        <Link href="/partner/customers" className="hover:underline">
          고객 관리
        </Link>
        <span className="mx-1">›</span>
        <Link href="/partner/customers/segments" className="hover:underline">
          세그먼트
        </Link>
        <span className="mx-1">›</span>
        <span className="font-semibold text-[#2D5A3D]">새 세그먼트</span>
      </nav>

      <section className="overflow-hidden rounded-2xl bg-gradient-to-br from-violet-700 via-violet-600 to-fuchsia-600 p-6 text-white shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wider text-violet-100">
          New Segment
        </p>
        <h1 className="mt-2 flex items-center gap-2 text-2xl font-bold">
          <span>➕</span>
          <span>새 세그먼트 만들기</span>
        </h1>
        <p className="mt-1 text-sm text-violet-100">
          규칙을 조합해서 고객 그룹을 만드세요. 규칙은 실시간으로 계산됩니다.
        </p>
      </section>

      <SegmentBuilder />
    </div>
  );
}
