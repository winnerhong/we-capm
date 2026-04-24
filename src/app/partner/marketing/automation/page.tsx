import Link from "next/link";
import { requirePartner } from "@/lib/auth-guard";
import { createClient } from "@/lib/supabase/server";
import { AcornIcon } from "@/components/acorn-icon";
import {
  PRESET_SCENARIOS,
  TRIGGER_LABEL,
  type AutomationRow,
} from "./types";
import {
  createPresetAutomationAction,
  toggleAutomationAction,
  deleteAutomationAction,
} from "./actions";

export const dynamic = "force-dynamic";

async function loadAutomations(partnerId: string): Promise<AutomationRow[]> {
  const supabase = await createClient();
  try {
    const { data } = await (
      supabase.from("partner_automations" as never) as any
    )
      .select(
        "id,partner_id,name,trigger_type,trigger_config,actions,is_active,executed_count,last_executed_at,created_at"
      )
      .eq("partner_id", partnerId)
      .order("created_at", { ascending: false });
    return (data ?? []) as AutomationRow[];
  } catch {
    return [];
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

export default async function PartnerAutomationListPage() {
  const partner = await requirePartner();
  const automations = await loadAutomations(partner.id);

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 space-y-6">
      {/* 1. 헤더 */}
      <section className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-[#2D5A3D] md:text-3xl">
            <span>🤖</span>
            <span>자동화 시나리오</span>
          </h1>
          <p className="mt-1 text-sm text-[#6B6560]">
            조건만 설정해두면, 숲이 알아서 말을 걸어요 🌿
          </p>
        </div>
        <Link
          href="/partner/marketing/automation/new"
          className="inline-flex items-center gap-1.5 rounded-xl bg-[#2D5A3D] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#3A7A52]"
        >
          <span>➕</span>
          <span>빈 시나리오 만들기</span>
        </Link>
      </section>

      {/* 2. ⚡ 빠른 시작 — 추천 프리셋 */}
      <section>
        <h2 className="mb-3 flex items-center gap-2 text-base font-bold text-[#2D5A3D]">
          <span>⚡</span>
          <span>빠른 시작 — 추천 프리셋</span>
        </h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {PRESET_SCENARIOS.map((preset) => {
            const triggerMeta = TRIGGER_LABEL[preset.trigger];
            return (
              <div
                key={preset.key}
                className="flex flex-col rounded-2xl border border-[#D4E4BC] bg-[#FFF8F0] p-5 shadow-sm"
              >
                <div className="text-4xl">{preset.icon}</div>
                <div className="mt-2 text-base font-bold text-[#2D5A3D]">
                  {preset.name}
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
                  <span className="inline-flex items-center gap-1 rounded-full bg-[#E8F0E4] px-2 py-0.5 font-semibold text-[#2D5A3D]">
                    <span>{triggerMeta.icon}</span>
                    <span>{triggerMeta.label}</span>
                  </span>
                  <span className="inline-flex items-center rounded-full bg-white px-2 py-0.5 font-semibold text-[#6B6560]">
                    💌 액션 {preset.actions.length}개
                  </span>
                </div>
                <form
                  action={createPresetAutomationAction}
                  className="mt-4"
                >
                  <input type="hidden" name="preset_key" value={preset.key} />
                  <button
                    type="submit"
                    className="w-full rounded-xl bg-[#2D5A3D] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#3A7A52]"
                  >
                    이 시나리오로 시작 →
                  </button>
                </form>
              </div>
            );
          })}
        </div>
      </section>

      {/* 3. 📋 내 자동화 시나리오 */}
      <section>
        <h2 className="mb-3 flex items-center gap-2 text-base font-bold text-[#2D5A3D]">
          <span>📋</span>
          <span>내 자동화 시나리오</span>
          <span className="ml-1 rounded-full bg-[#E8F0E4] px-2 py-0.5 text-[11px] font-semibold text-[#2D5A3D]">
            {automations.length}
          </span>
        </h2>

        {automations.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#D4E4BC] bg-[#FFF8F0] px-4 py-12 text-center">
            <div className="text-4xl"><AcornIcon size={32} /></div>
            <p className="mt-2 text-sm font-semibold text-[#2D5A3D]">
              아직 시나리오가 없어요
            </p>
            <p className="mt-1 text-xs text-[#6B6560]">
              위 프리셋으로 빠르게 시작하세요! ⚡
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {automations.map((a) => {
              const triggerMeta = a.trigger_type
                ? TRIGGER_LABEL[a.trigger_type]
                : { icon: "❓", label: "알 수 없음" };
              const actionCount = Array.isArray(a.actions)
                ? a.actions.length
                : 0;
              const isActive = !!a.is_active;
              return (
                <li key={a.id}>
                  <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-[#D4E4BC] bg-white p-5 shadow-sm">
                    {/* 좌측 정보 */}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/partner/marketing/automation/${a.id}`}
                          className="truncate text-base font-bold text-[#2D5A3D] hover:underline"
                        >
                          {a.name ?? "이름 없는 시나리오"}
                        </Link>
                        <span className="inline-flex items-center gap-1 rounded-full bg-[#E8F0E4] px-2 py-0.5 text-[11px] font-semibold text-[#2D5A3D]">
                          <span>{triggerMeta.icon}</span>
                          <span>{triggerMeta.label}</span>
                        </span>
                        <span className="inline-flex items-center rounded-full bg-[#FFF8F0] px-2 py-0.5 text-[11px] font-semibold text-[#6B6560]">
                          💌 {actionCount}
                        </span>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-[#6B6560]">
                        <span>
                          🔄 실행 {(a.executed_count ?? 0).toLocaleString("ko-KR")}회
                        </span>
                        <span>
                          🕐 마지막 실행: {formatDateTime(a.last_executed_at)}
                        </span>
                      </div>
                    </div>

                    {/* 우측 토글 + 버튼 */}
                    <div className="flex items-center gap-2">
                      <form action={toggleAutomationAction}>
                        <input type="hidden" name="id" value={a.id} />
                        <input
                          type="hidden"
                          name="next_active"
                          value={isActive ? "false" : "true"}
                        />
                        <button
                          type="submit"
                          aria-pressed={isActive}
                          aria-label={isActive ? "비활성화" : "활성화"}
                          className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#2D5A3D] focus:ring-offset-2 ${
                            isActive ? "bg-[#2D5A3D]" : "bg-[#D4E4BC]"
                          }`}
                        >
                          <span
                            aria-hidden
                            className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
                              isActive ? "translate-x-6" : "translate-x-1"
                            }`}
                          />
                        </button>
                      </form>
                      <span
                        className={`min-w-[48px] text-center text-[11px] font-semibold ${
                          isActive ? "text-[#2D5A3D]" : "text-[#6B6560]"
                        }`}
                      >
                        {isActive ? "활성" : "비활성"}
                      </span>

                      <Link
                        href={`/partner/marketing/automation/${a.id}`}
                        className="inline-flex items-center rounded-xl border border-[#D4E4BC] bg-white px-3 py-1.5 text-xs font-semibold text-[#2D5A3D] transition hover:bg-[#E8F0E4]"
                      >
                        ✏️ 수정
                      </Link>
                      <form action={deleteAutomationAction}>
                        <input type="hidden" name="id" value={a.id} />
                        <button
                          type="submit"
                          className="inline-flex items-center rounded-xl border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-50"
                        >
                          🗑️ 삭제
                        </button>
                      </form>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
