import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePartner } from "@/lib/auth-guard";
import { createClient } from "@/lib/supabase/server";
import { TRIGGER_LABEL, type AutomationRow } from "../types";
import {
  deleteAutomationAction,
  testSendAutomationAction,
  toggleAutomationAction,
} from "../actions";
import AutomationEditor from "./AutomationEditor";

export const dynamic = "force-dynamic";

async function loadAutomation(
  partnerId: string,
  id: string
): Promise<AutomationRow | null> {
  const supabase = await createClient();
  try {
    const { data } = await (
      supabase.from("partner_automations" as never) as any
    )
      .select(
        "id,partner_id,name,trigger_type,trigger_config,actions,is_active,executed_count,last_executed_at,created_at"
      )
      .eq("id", id)
      .eq("partner_id", partnerId)
      .maybeSingle();
    return (data ?? null) as AutomationRow | null;
  } catch {
    return null;
  }
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "아직 실행 안 됨";
  try {
    return new Date(iso).toLocaleString("ko-KR", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "-";
  }
}

export default async function AutomationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const partner = await requirePartner();
  const automation = await loadAutomation(partner.id, id);

  if (!automation) notFound();

  const triggerMeta = automation.trigger_type
    ? TRIGGER_LABEL[automation.trigger_type]
    : { icon: "❓", label: "알 수 없음" };
  const isActive = !!automation.is_active;
  const actionCount = Array.isArray(automation.actions)
    ? automation.actions.length
    : 0;

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 space-y-6">
      {/* 헤더 */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="mb-1 text-xs text-[#6B6560]">
            <Link
              href="/partner/marketing/automation"
              className="hover:underline"
            >
              ← 자동화 시나리오
            </Link>
          </div>
          <h1 className="flex flex-wrap items-center gap-2 text-2xl font-bold text-[#2D5A3D] md:text-3xl">
            <span>🤖</span>
            <span className="truncate">
              {automation.name ?? "이름 없는 시나리오"}
            </span>
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
            <span className="inline-flex items-center gap-1 rounded-full bg-[#E8F0E4] px-2 py-0.5 font-semibold text-[#2D5A3D]">
              <span>{triggerMeta.icon}</span>
              <span>{triggerMeta.label}</span>
            </span>
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 font-semibold ${
                isActive
                  ? "bg-[#2D5A3D] text-white"
                  : "bg-[#D4E4BC] text-[#2D5A3D]"
              }`}
            >
              {isActive ? "🟢 활성" : "⚪ 비활성"}
            </span>
            <span className="inline-flex items-center rounded-full bg-[#FFF8F0] px-2 py-0.5 font-semibold text-[#6B6560]">
              💌 액션 {actionCount}개
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <form action={toggleAutomationAction}>
            <input type="hidden" name="id" value={automation.id} />
            <input
              type="hidden"
              name="next_active"
              value={isActive ? "false" : "true"}
            />
            <button
              type="submit"
              className={`inline-flex items-center rounded-xl px-3 py-2 text-sm font-semibold transition ${
                isActive
                  ? "border border-[#D4E4BC] bg-white text-[#2D5A3D] hover:bg-[#E8F0E4]"
                  : "bg-[#2D5A3D] text-white hover:bg-[#3A7A52]"
              }`}
            >
              {isActive ? "⏸️ 일시정지" : "▶️ 활성화"}
            </button>
          </form>
        </div>
      </div>

      {/* 통계 */}
      <section className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-[#D4E4BC] bg-white p-4 shadow-sm">
          <div className="text-xs font-semibold text-[#6B6560]">🔄 실행 횟수</div>
          <div className="mt-1 text-2xl font-bold text-[#2D5A3D]">
            {(automation.executed_count ?? 0).toLocaleString("ko-KR")}회
          </div>
        </div>
        <div className="rounded-2xl border border-[#D4E4BC] bg-white p-4 shadow-sm">
          <div className="text-xs font-semibold text-[#6B6560]">🕐 마지막 실행</div>
          <div className="mt-1 text-sm font-bold text-[#2D5A3D]">
            {formatDateTime(automation.last_executed_at)}
          </div>
        </div>
        <div className="rounded-2xl border border-[#D4E4BC] bg-white p-4 shadow-sm">
          <div className="text-xs font-semibold text-[#6B6560]">📅 생성일</div>
          <div className="mt-1 text-sm font-bold text-[#2D5A3D]">
            {formatDateTime(automation.created_at)}
          </div>
        </div>
      </section>

      {/* 편집 영역 */}
      <AutomationEditor
        id={automation.id}
        initialName={automation.name ?? ""}
        initialTrigger={automation.trigger_type ?? "SIGNUP"}
        initialActions={
          Array.isArray(automation.actions) ? automation.actions : []
        }
      />

      {/* 테스트 발송 + 삭제 */}
      <section className="rounded-2xl border border-[#D4E4BC] bg-[#FFF8F0] p-5 shadow-sm">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-[#2D5A3D]">
          <span>🧪</span>
          <span>테스트 발송</span>
        </h2>
        <p className="mb-3 text-xs text-[#6B6560]">
          내 번호로 첫 번째 액션을 미리 보내볼 수 있어요 (MVP: 모의 발송)
        </p>
        <form action={testSendAutomationAction}>
          <input type="hidden" name="id" value={automation.id} />
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 rounded-xl border border-[#D4E4BC] bg-white px-4 py-2 text-sm font-semibold text-[#2D5A3D] transition hover:bg-[#E8F0E4]"
          >
            📤 내 번호로 테스트 발송
          </button>
        </form>
      </section>

      {/* 삭제 영역 */}
      <section className="rounded-2xl border border-red-200 bg-red-50 p-5 shadow-sm">
        <h2 className="mb-2 flex items-center gap-2 text-sm font-bold text-red-700">
          <span>⚠️</span>
          <span>위험 영역</span>
        </h2>
        <p className="mb-3 text-xs text-red-600">
          삭제한 시나리오는 복구할 수 없어요
        </p>
        <form action={deleteAutomationAction}>
          <input type="hidden" name="id" value={automation.id} />
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 rounded-xl border border-red-300 bg-white px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-100"
          >
            🗑️ 시나리오 삭제
          </button>
        </form>
      </section>
    </div>
  );
}
