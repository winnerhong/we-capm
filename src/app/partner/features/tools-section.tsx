// 스위치판 본체 — 대상(전체 / 기관 하나)만 다르고 나머지는 같다.
//
// 배너 한 줄이 이 화면의 핵심이다. 스위치를 만지기 직전에 **누구에게 적용되는지**
// 를 같은 자리에서 말해 주지 않으면, 지사는 매번 위로 올라가 탭을 확인해야 한다.

import {
  loadPartnerToolBoard,
  loadOrgToolBoard,
  type ToolRow,
} from "@/lib/org-tools/queries";
import { ORG_TOOLS } from "@/lib/org-tools/registry";
import {
  setPartnerToolStateAction,
  setOrgToolStateAction,
  clearOrgToolOverrideAction,
} from "@/lib/org-tools/actions";
import { ToolBoard, type BoardRow } from "@/components/org-tools/tool-board";

export async function ToolsSection({
  partnerId,
  orgId,
  orgName,
  orgCount,
}: {
  partnerId: string;
  /** null = 전체 기관 */
  orgId: string | null;
  orgName?: string;
  orgCount: number;
}) {
  const board: ToolRow[] = orgId
    ? await loadOrgToolBoard(orgId, partnerId)
    : await loadPartnerToolBoard(partnerId);

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
    siblings: ORG_TOOLS.filter(
      (t) =>
        t.featureCode &&
        t.featureCode === r.tool.featureCode &&
        t.key !== r.tool.key
    ).map((t) => t.label),
  }));

  const changed = rows.filter((r) => r.differs > 0).length;

  return (
    <div className="space-y-3">
      {/* 지금 누구를 만지고 있나 — 스위치 바로 위. */}
      {orgId ? (
        <p className="rounded-2xl border border-[#E5D3B8] bg-[#FFFDF8] px-4 py-3 text-xs leading-relaxed text-[#6B4423]">
          <span aria-hidden>🏫</span> <b>{orgName}</b>만 바꿔요. 여기서 만진
          항목은 전체값을 덮어쓰고, 나중에 전체값을 바꿔도 그대로 남습니다.
          {changed > 0 && (
            <span className="ml-1 font-bold text-[#B5651D]">
              지금 {changed}개가 전체값과 달라요.
            </span>
          )}
        </p>
      ) : (
        <p className="rounded-2xl border border-[#D4E4BC] bg-[#F7FAF4] px-4 py-3 text-xs leading-relaxed text-[#6B6560]">
          <span aria-hidden>🏢</span> <b>기관 {orgCount}곳 전부</b>에 한꺼번에
          적용돼요. 한 곳만 다르게 하려면 위에서 그 기관을 고르세요.
          {changed > 0 && (
            <span className="ml-1 font-bold text-[#B5651D]">
              이미 다르게 설정한 기관은 안 바뀝니다.
            </span>
          )}
        </p>
      )}

      <ToolBoard
        rows={rows}
        scope={orgId ? "org" : "partner"}
        onSet={
          orgId
            ? setOrgToolStateAction.bind(null, orgId)
            : setPartnerToolStateAction
        }
        onClear={orgId ? clearOrgToolOverrideAction.bind(null, orgId) : undefined}
      />
    </div>
  );
}

