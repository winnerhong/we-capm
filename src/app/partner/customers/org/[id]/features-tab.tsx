// 기관 상세 「기능」 탭 — 이 기관 하나만 설정한다.
//
// 전 기관 공통값은 /partner/features 에 있다. 여기서 만진 값은 그쪽을 이기고,
// 그래서 나중에 전체값을 바꿔도 이 기관만 안 바뀐다 — 각 줄이 그 사실을 말한다.

import Link from "next/link";
import { loadOrgToolBoard } from "@/lib/org-tools/queries";
import { ORG_TOOLS } from "@/lib/org-tools/registry";
import {
  setOrgToolStateAction,
  clearOrgToolOverrideAction,
} from "@/lib/org-tools/actions";
import { ToolBoard, type BoardRow } from "@/components/org-tools/tool-board";

export async function FeaturesTab({
  orgId,
  partnerId,
}: {
  orgId: string;
  partnerId: string;
}) {
  const board = await loadOrgToolBoard(orgId, partnerId);

  const rows: BoardRow[] = board.map((r) => ({
    key: r.tool.key,
    label: r.tool.label,
    icon: r.tool.icon,
    group: r.tool.group,
    featureCode: r.tool.featureCode ?? null,
    state: r.state,
    partnerState: r.partnerState,
    partnerHas: r.partnerHas,
    differs: r.differs,
    siblings: siblingLabels(r.tool.key, r.tool.featureCode),
  }));

  const custom = rows.filter((r) => r.differs > 0).length;

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[#D4E4BC] bg-[#F7FAF4] px-4 py-3">
        <div className="min-w-0">
          <h2 className="text-sm font-bold text-[#2D5A3D]">
            🎛 이 기관이 쓰는 기능
          </h2>
          <p className="mt-0.5 text-[11px] text-[#6B6560]">
            {custom > 0
              ? `${custom}개가 전체값과 다르게 설정돼 있어요`
              : "전부 전체값과 같아요"}
          </p>
        </div>
        <Link
          href="/partner/features"
          className="shrink-0 rounded-lg border border-[#D4E4BC] bg-white px-3 py-1.5 text-[11px] font-bold text-[#2D5A3D] transition hover:bg-[#E8F0E4]"
        >
          전체 기본값 →
        </Link>
      </header>

      <ToolBoard
        rows={rows}
        scope="org"
        onSet={setOrgToolStateAction.bind(null, orgId)}
        onClear={clearOrgToolOverrideAction.bind(null, orgId)}
      />
    </div>
  );
}

/** 같은 기능을 쓰는 다른 도구 이름 — 끄면 같이 꺼진다는 걸 말해야 한다. */
function siblingLabels(
  key: string,
  featureCode: string | undefined
): string[] {
  if (!featureCode) return [];
  return ORG_TOOLS.filter(
    (t) => t.featureCode === featureCode && t.key !== key
  ).map((t) => t.label);
}
