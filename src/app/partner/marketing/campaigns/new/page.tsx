import Link from "next/link";
import { requirePartner } from "@/lib/auth-guard";
import { createClient } from "@/lib/supabase/server";
import type { SegmentOption } from "../types";
import { WizardForm } from "./wizard-form";

export const dynamic = "force-dynamic";

async function loadSegments(partnerId: string): Promise<SegmentOption[]> {
  const supabase = await createClient();
  const client = supabase as unknown as {
    from: (t: string) => {
      select: (c: string) => {
        eq: (k: string, v: string) => Promise<{ data: unknown[] | null }>;
      };
    };
  };
  const { data } = await client
    .from("partner_segments")
    .select("id,name,icon,member_count")
    .eq("partner_id", partnerId);

  return (data ?? []) as SegmentOption[];
}

export default async function NewCampaignPage() {
  const partner = await requirePartner();
  const segments = await loadSegments(partner.id);

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="text-xs text-[#6B6560]">
        <Link href="/partner/dashboard" className="hover:underline">
          대시보드
        </Link>
        <span className="mx-1">›</span>
        <Link href="/partner/marketing/campaigns" className="hover:underline">
          캠페인
        </Link>
        <span className="mx-1">›</span>
        <span className="font-semibold text-[#2D5A3D]">새 캠페인</span>
      </nav>

      {/* Header */}
      <section className="overflow-hidden rounded-2xl bg-gradient-to-br from-[#2D5A3D] via-[#4A7C59] to-[#2D5A3D] p-6 text-white shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wider text-[#D4E4BC]">
          New Campaign
        </p>
        <h1 className="mt-2 flex items-center gap-2 text-2xl font-bold">
          <span>📢</span>
          <span>새 캠페인 만들기</span>
        </h1>
        <p className="mt-1 text-sm text-[#D4E4BC]">
          6단계로 간편하게 마케팅 캠페인을 시작해보세요.
        </p>
      </section>

      <WizardForm segments={segments} />
    </div>
  );
}
