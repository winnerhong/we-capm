"use server";

// 기관 운영자용 빙고 보드 액션 — CRUD + 상태 전환 + 수동 순위.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOrg } from "@/lib/org-auth-guard";
import { createClient } from "@/lib/supabase/server";
import { recomputeAllGridsForBoard } from "./grid-stats";
import { isBingoLines, isBingoSize } from "./types";

type Row = Record<string, unknown>;
type SbErr = { code?: string; message?: string } | null;

async function assertBoardOwned(boardId: string, orgId: string): Promise<void> {
  const supabase = await createClient();
  const resp = (await (
    supabase.from("org_bingo_boards" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          maybeSingle: () => Promise<{
            data: { id: string; org_id: string } | null;
          }>;
        };
      };
    }
  )
    .select("id, org_id")
    .eq("id", boardId)
    .maybeSingle()) as {
    data: { id: string; org_id: string } | null;
  };
  if (!resp.data || resp.data.org_id !== orgId) {
    throw new Error("이 빙고 보드에 접근할 권한이 없어요");
  }
}

function parseBoardFields(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const sizeRaw = Number(formData.get("size"));
  const linesRaw = Number(formData.get("lines_to_win"));
  const keywordTheme = String(formData.get("keyword_theme") ?? "").trim();
  const showRankingRaw = formData.get("show_ranking");
  const eventIdRaw = String(formData.get("event_id") ?? "").trim();

  if (!name || name.length > 60) {
    throw new Error("보드 이름은 1~60자로 입력해 주세요");
  }
  if (!isBingoSize(sizeRaw)) {
    throw new Error("빙고 크기는 3×3, 4×4, 5×5, 6×6 중에 골라주세요");
  }
  if (!isBingoLines(linesRaw)) {
    throw new Error("승리 줄 수는 1~3 사이로 골라주세요");
  }
  return {
    name,
    size: sizeRaw,
    lines_to_win: linesRaw,
    keyword_theme: keywordTheme || null,
    show_ranking:
      showRankingRaw === "on" ||
      showRankingRaw === "true" ||
      showRankingRaw === "1",
    event_id: eventIdRaw || null,
  };
}

/* -------------------------------------------------------------------------- */
/* CRUD                                                                       */
/* -------------------------------------------------------------------------- */

export async function createBingoBoardAction(
  orgId: string,
  formData: FormData
): Promise<void> {
  const org = await requireOrg();
  if (org.orgId !== orgId) throw new Error("잘못된 기관이에요");

  const fields = parseBoardFields(formData);

  const supabase = await createClient();
  const insertResp = (await (
    supabase.from("org_bingo_boards" as never) as unknown as {
      insert: (p: Row) => {
        select: (c: string) => {
          single: () => Promise<{
            data: { id: string } | null;
            error: SbErr;
          }>;
        };
      };
    }
  )
    .insert({
      org_id: orgId,
      ...fields,
      status: "DRAFT",
    } satisfies Row)
    .select("id")
    .single()) as {
    data: { id: string } | null;
    error: SbErr;
  };

  if (insertResp.error || !insertResp.data) {
    console.error("[bingo/create]", insertResp.error);
    throw new Error("빙고 보드 생성에 실패했어요");
  }

  revalidatePath(`/org/${orgId}/bingo`);
  redirect(`/org/${orgId}/bingo/${insertResp.data.id}`);
}

export async function updateBingoBoardAction(
  boardId: string,
  formData: FormData
): Promise<void> {
  const org = await requireOrg();
  await assertBoardOwned(boardId, org.orgId);

  const fields = parseBoardFields(formData);

  const supabase = await createClient();
  const resp = (await (
    supabase.from("org_bingo_boards" as never) as unknown as {
      update: (p: Row) => {
        eq: (k: string, v: string) => Promise<{ error: SbErr }>;
      };
    }
  )
    .update({
      ...fields,
      updated_at: new Date().toISOString(),
    } satisfies Row)
    .eq("id", boardId)) as { error: SbErr };

  if (resp.error) {
    console.error("[bingo/update]", resp.error);
    throw new Error("빙고 보드 수정에 실패했어요");
  }

  revalidatePath(`/org/${org.orgId}/bingo`);
  revalidatePath(`/org/${org.orgId}/bingo/${boardId}`);
}

export async function setBingoStatusAction(
  boardId: string,
  next: "DRAFT" | "LIVE" | "ENDED"
): Promise<void> {
  const org = await requireOrg();
  await assertBoardOwned(boardId, org.orgId);

  const patch: Row = {
    status: next,
    updated_at: new Date().toISOString(),
  };
  if (next === "LIVE") patch.starts_at = new Date().toISOString();
  if (next === "ENDED") patch.ends_at = new Date().toISOString();

  const supabase = await createClient();
  const resp = (await (
    supabase.from("org_bingo_boards" as never) as unknown as {
      update: (p: Row) => {
        eq: (k: string, v: string) => Promise<{ error: SbErr }>;
      };
    }
  )
    .update(patch)
    .eq("id", boardId)) as { error: SbErr };

  if (resp.error) {
    console.error("[bingo/setStatus]", resp.error);
    throw new Error("상태 변경에 실패했어요");
  }

  revalidatePath(`/org/${org.orgId}/bingo`);
  revalidatePath(`/org/${org.orgId}/bingo/${boardId}`);
}

export async function deleteBingoBoardAction(
  boardId: string
): Promise<void> {
  const org = await requireOrg();
  await assertBoardOwned(boardId, org.orgId);

  const supabase = await createClient();
  const resp = (await (
    supabase.from("org_bingo_boards" as never) as unknown as {
      delete: () => {
        eq: (k: string, v: string) => Promise<{ error: SbErr }>;
      };
    }
  )
    .delete()
    .eq("id", boardId)) as { error: SbErr };

  if (resp.error) {
    console.error("[bingo/delete]", resp.error);
    throw new Error("삭제에 실패했어요");
  }

  revalidatePath(`/org/${org.orgId}/bingo`);
  redirect(`/org/${org.orgId}/bingo`);
}

/* -------------------------------------------------------------------------- */
/* 기관 문구 타일 — 운영자가 사진 없이 문구만으로 만든 타일 (모든 가족 피드 노출)  */
/* -------------------------------------------------------------------------- */

export async function addOrgBingoTileAction(
  boardId: string,
  phrase: string
): Promise<void> {
  const org = await requireOrg();
  await assertBoardOwned(boardId, org.orgId);

  const text = (phrase ?? "").trim();
  if (!text) throw new Error("문구를 입력해 주세요");
  if (text.length > 40) throw new Error("문구는 40자 이내로 적어주세요");

  const supabase = await createClient();
  const resp = (await (
    supabase.from("org_bingo_entries" as never) as unknown as {
      insert: (p: Row) => Promise<{ error: SbErr }>;
    }
  ).insert({
    board_id: boardId,
    user_id: null,
    photo_url: "",
    keyword: text,
    is_org: true,
  } satisfies Row)) as { error: SbErr };

  if (resp.error) {
    console.error("[bingo/addOrgTile]", resp.error);
    throw new Error("기관 타일 추가에 실패했어요");
  }

  revalidatePath(`/org/${org.orgId}/bingo/${boardId}`);
  revalidatePath(`/org/${org.orgId}/control-room`);
  revalidatePath("/e/[eventId]/bingo/[boardId]", "page");
}

/**
 * 기관 문구 타일을 보드의 특정 칸에 고정 배치(또는 해제).
 *  - position 값 → 그 칸에 고정 (다른 고정 타일이 있으면 밀어냄=해제).
 *  - position null → 고정 해제(가족 자유 배치로).
 * 고정/해제 후 모든 가족 판 재계산.
 */
export async function setOrgTilePositionAction(
  boardId: string,
  entryId: string,
  position: number | null
): Promise<void> {
  const org = await requireOrg();
  await assertBoardOwned(boardId, org.orgId);

  const supabase = await createClient();

  // 보드 크기 검증.
  const boardResp = (await (
    supabase.from("org_bingo_boards" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          maybeSingle: () => Promise<{ data: { size: number } | null }>;
        };
      };
    }
  )
    .select("size")
    .eq("id", boardId)
    .maybeSingle()) as { data: { size: number } | null };
  const size = boardResp.data?.size ?? 0;

  if (position != null) {
    if (!Number.isInteger(position) || position < 0 || position >= size * size) {
      throw new Error("잘못된 칸 위치예요");
    }
    // 그 칸을 이미 점유한 다른 고정 타일은 해제.
    await (
      supabase.from("org_bingo_entries" as never) as unknown as {
        update: (p: Row) => {
          eq: (k: string, v: string) => {
            eq: (k: string, v: number) => Promise<{ error: SbErr }>;
          };
        };
      }
    )
      .update({ fixed_position: null } satisfies Row)
      .eq("board_id", boardId)
      .eq("fixed_position", position);
  }

  const resp = (await (
    supabase.from("org_bingo_entries" as never) as unknown as {
      update: (p: Row) => {
        eq: (k: string, v: string) => {
          eq: (k: string, v: boolean) => Promise<{ error: SbErr }>;
        };
      };
    }
  )
    .update({ fixed_position: position } satisfies Row)
    .eq("id", entryId)
    .eq("is_org", true)) as { error: SbErr };

  if (resp.error) {
    console.error("[bingo/setOrgTilePosition]", resp.error);
    throw new Error("고정 배치에 실패했어요");
  }

  await recomputeAllGridsForBoard(boardId);

  revalidatePath(`/org/${org.orgId}/control-room`);
  revalidatePath(`/org/${org.orgId}/bingo/${boardId}`);
  revalidatePath("/e/[eventId]/bingo/[boardId]", "page");
}

export async function deleteOrgBingoTileAction(
  boardId: string,
  entryId: string
): Promise<void> {
  const org = await requireOrg();
  await assertBoardOwned(boardId, org.orgId);

  const supabase = await createClient();
  // 기관 타일만 삭제 (가족 사진은 보호).
  const resp = (await (
    supabase.from("org_bingo_entries" as never) as unknown as {
      delete: () => {
        eq: (k: string, v: string) => {
          eq: (k: string, v: string) => {
            eq: (k: string, v: boolean) => Promise<{ error: SbErr }>;
          };
        };
      };
    }
  )
    .delete()
    .eq("id", entryId)
    .eq("board_id", boardId)
    .eq("is_org", true)) as { error: SbErr };

  if (resp.error) {
    console.error("[bingo/deleteOrgTile]", resp.error);
    throw new Error("기관 타일 삭제에 실패했어요");
  }

  // 삭제로 grid 셀이 빠질 수 있으니 재계산.
  await recomputeAllGridsForBoard(boardId);

  revalidatePath(`/org/${org.orgId}/bingo/${boardId}`);
  revalidatePath(`/org/${org.orgId}/control-room`);
  revalidatePath("/e/[eventId]/bingo/[boardId]", "page");
}

/* -------------------------------------------------------------------------- */
/* 호명 (call) — 운영자가 그림 클릭 → 모든 가족 판에서 해당 칸 자동 체크          */
/* -------------------------------------------------------------------------- */

/**
 * 그림별 호명 방식 설정.
 *  - mode='CIRCLE' → 자동 ⭕ (그 그림 가진 모든 참가자 체크)
 *  - mode='QR'     → 참가자가 QR 찍어야 ⭕
 *  - mode=null     → 호명 취소
 * 같은 방식을 다시 누르면 토글 해제(취소)된다.
 */
export async function setBingoCallAction(
  boardId: string,
  entryId: string,
  mode: "CIRCLE" | "QR"
): Promise<void> {
  const org = await requireOrg();
  await assertBoardOwned(boardId, org.orgId);

  const supabase = await createClient();
  const entryResp = (await (
    supabase.from("org_bingo_entries" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          maybeSingle: () => Promise<{
            data: {
              id: string;
              board_id: string;
              called_at: string | null;
              call_mode: "CIRCLE" | "QR";
            } | null;
          }>;
        };
      };
    }
  )
    .select("id, board_id, called_at, call_mode")
    .eq("id", entryId)
    .maybeSingle()) as {
    data: {
      id: string;
      board_id: string;
      called_at: string | null;
      call_mode: "CIRCLE" | "QR";
    } | null;
  };
  const entry = entryResp.data;
  if (!entry || entry.board_id !== boardId) {
    throw new Error("이 빙고의 그림이 아니에요");
  }

  // 같은 방식으로 이미 호명돼 있으면 해제, 아니면 그 방식으로 호명.
  const sameOn = !!entry.called_at && entry.call_mode === mode;
  const patch: Row = sameOn
    ? { called_at: null }
    : { called_at: new Date().toISOString(), call_mode: mode };

  const updResp = (await (
    supabase.from("org_bingo_entries" as never) as unknown as {
      update: (p: Row) => {
        eq: (k: string, v: string) => Promise<{ error: SbErr }>;
      };
    }
  )
    .update(patch satisfies Row)
    .eq("id", entryId)) as { error: SbErr };
  if (updResp.error) {
    console.error("[bingo/setCall]", updResp.error);
    throw new Error("호명 처리에 실패했어요");
  }

  await recomputeAllGridsForBoard(boardId);

  revalidatePath(`/org/${org.orgId}/control-room`);
  revalidatePath(`/org/${org.orgId}/bingo/${boardId}`);
  revalidatePath("/e/[eventId]/bingo/[boardId]", "page");
}

/**
 * 그림 호명 토글. 호명되면 called_at=now(), 이미 호명됐으면 취소(null).
 * 토글 후 보드의 모든 grid 를 재계산해 줄/완료 상태를 갱신한다.
 */
export async function toggleBingoCallAction(
  boardId: string,
  entryId: string
): Promise<void> {
  const org = await requireOrg();
  await assertBoardOwned(boardId, org.orgId);

  const supabase = await createClient();
  // 현재 호명 상태 확인 (보드 일치까지 검증).
  const entryResp = (await (
    supabase.from("org_bingo_entries" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          maybeSingle: () => Promise<{
            data: { id: string; board_id: string; called_at: string | null } | null;
          }>;
        };
      };
    }
  )
    .select("id, board_id, called_at")
    .eq("id", entryId)
    .maybeSingle()) as {
    data: { id: string; board_id: string; called_at: string | null } | null;
  };
  const entry = entryResp.data;
  if (!entry || entry.board_id !== boardId) {
    throw new Error("이 빙고의 그림이 아니에요");
  }

  const nextCalledAt = entry.called_at ? null : new Date().toISOString();
  const updResp = (await (
    supabase.from("org_bingo_entries" as never) as unknown as {
      update: (p: Row) => {
        eq: (k: string, v: string) => Promise<{ error: SbErr }>;
      };
    }
  )
    .update({ called_at: nextCalledAt } satisfies Row)
    .eq("id", entryId)) as { error: SbErr };
  if (updResp.error) {
    console.error("[bingo/toggleCall]", updResp.error);
    throw new Error("호명 처리에 실패했어요");
  }

  // 호명 변화는 보드의 모든 가족 판에 영향 → 전체 재계산.
  await recomputeAllGridsForBoard(boardId);

  revalidatePath(`/org/${org.orgId}/control-room`);
  revalidatePath(`/org/${org.orgId}/bingo/${boardId}`);
  revalidatePath("/e/[eventId]/bingo/[boardId]", "page");
}

/**
 * 호명 전체 초기화 — 새 라운드 시작 등. 모든 entry called_at=null + 재계산.
 */
export async function resetBingoCallsAction(boardId: string): Promise<void> {
  const org = await requireOrg();
  await assertBoardOwned(boardId, org.orgId);

  const supabase = await createClient();
  const resp = (await (
    supabase.from("org_bingo_entries" as never) as unknown as {
      update: (p: Row) => {
        eq: (k: string, v: string) => Promise<{ error: SbErr }>;
      };
    }
  )
    .update({ called_at: null } satisfies Row)
    .eq("board_id", boardId)) as { error: SbErr };
  if (resp.error) {
    console.error("[bingo/resetCalls]", resp.error);
    throw new Error("호명 초기화에 실패했어요");
  }

  await recomputeAllGridsForBoard(boardId);

  revalidatePath(`/org/${org.orgId}/control-room`);
  revalidatePath(`/org/${org.orgId}/bingo/${boardId}`);
  revalidatePath("/e/[eventId]/bingo/[boardId]", "page");
}

/* -------------------------------------------------------------------------- */
/* 📷 QR 모드 — 호명한 그림의 QR을 참가자가 찍어 인증해야 ⭕ (자동 호명 대신)       */
/* -------------------------------------------------------------------------- */

/**
 * QR 모드 토글. 켜면 호명한 그림마다 QR이 생기고, 그 QR을 찍은 참가자만
 * 칸이 ⭕ 된다. 끄면 평소처럼 호명 즉시 자동 ⭕(동그라미).
 * 모드 변경은 체크 판정 기준을 바꾸므로 전체 grid 재계산.
 */
export async function toggleSignatureModeAction(
  boardId: string
): Promise<void> {
  const org = await requireOrg();
  await assertBoardOwned(boardId, org.orgId);

  const supabase = await createClient();
  const cur = (await (
    supabase.from("org_bingo_boards" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          maybeSingle: () => Promise<{
            data: { signature_mode: boolean } | null;
          }>;
        };
      };
    }
  )
    .select("signature_mode")
    .eq("id", boardId)
    .maybeSingle()) as { data: { signature_mode: boolean } | null };

  const next = !cur.data?.signature_mode;

  const resp = (await (
    supabase.from("org_bingo_boards" as never) as unknown as {
      update: (p: Row) => {
        eq: (k: string, v: string) => Promise<{ error: SbErr }>;
      };
    }
  )
    .update({
      signature_mode: next,
      updated_at: new Date().toISOString(),
    } satisfies Row)
    .eq("id", boardId)) as { error: SbErr };
  if (resp.error) {
    console.error("[bingo/toggleSignatureMode]", resp.error);
    throw new Error("싸인 모드 전환에 실패했어요");
  }

  await recomputeAllGridsForBoard(boardId);

  revalidatePath(`/org/${org.orgId}/control-room`);
  revalidatePath(`/org/${org.orgId}/bingo/${boardId}`);
  revalidatePath("/e/[eventId]/bingo/[boardId]", "page");
}

/* -------------------------------------------------------------------------- */
/* 수동 순위                                                                  */
/* -------------------------------------------------------------------------- */

export async function setManualRankingAction(
  boardId: string,
  rank: number,
  userId: string,
  prize: string | null
): Promise<void> {
  const org = await requireOrg();
  await assertBoardOwned(boardId, org.orgId);
  if (rank < 1) throw new Error("순위는 1 이상이어야 해요");

  const supabase = await createClient();
  const resp = (await (
    supabase.from("org_bingo_rankings" as never) as unknown as {
      upsert: (
        p: Row,
        opts: { onConflict: string }
      ) => Promise<{ error: SbErr }>;
    }
  ).upsert(
    {
      board_id: boardId,
      rank,
      user_id: userId,
      prize: prize?.trim() || null,
      set_at: new Date().toISOString(),
    } satisfies Row,
    { onConflict: "board_id,rank" }
  )) as { error: SbErr };

  if (resp.error) {
    console.error("[bingo/setManualRanking]", resp.error);
    throw new Error("순위 저장에 실패했어요");
  }
  revalidatePath(`/org/${org.orgId}/bingo/${boardId}`);
}

/* -------------------------------------------------------------------------- */
/* 배열 타이머                                                                  */
/* -------------------------------------------------------------------------- */

export async function startBingoTimerAction(
  boardId: string,
  durationMinutes: number
): Promise<void> {
  const org = await requireOrg();
  await assertBoardOwned(boardId, org.orgId);
  if (
    !Number.isFinite(durationMinutes) ||
    durationMinutes < 1 ||
    durationMinutes > 120
  ) {
    throw new Error("배열 시간은 1~120분 사이로 정해주세요");
  }
  const endsAt = new Date(Date.now() + durationMinutes * 60_000).toISOString();

  const supabase = await createClient();
  const resp = (await (
    supabase.from("org_bingo_boards" as never) as unknown as {
      update: (p: Row) => {
        eq: (k: string, v: string) => Promise<{ error: SbErr }>;
      };
    }
  )
    .update({
      arrange_ends_at: endsAt,
      updated_at: new Date().toISOString(),
    } satisfies Row)
    .eq("id", boardId)) as { error: SbErr };

  if (resp.error) {
    console.error("[bingo/startTimer]", resp.error);
    throw new Error("타이머 시작에 실패했어요");
  }
  revalidatePath(`/org/${org.orgId}/bingo/${boardId}`);
  revalidatePath(`/org/${org.orgId}/control-room`);
  revalidatePath("/e/[eventId]/bingo/[boardId]", "page");
}

export async function cancelBingoTimerAction(
  boardId: string
): Promise<void> {
  const org = await requireOrg();
  await assertBoardOwned(boardId, org.orgId);

  const supabase = await createClient();
  const resp = (await (
    supabase.from("org_bingo_boards" as never) as unknown as {
      update: (p: Row) => {
        eq: (k: string, v: string) => Promise<{ error: SbErr }>;
      };
    }
  )
    .update({
      arrange_ends_at: null,
      updated_at: new Date().toISOString(),
    } satisfies Row)
    .eq("id", boardId)) as { error: SbErr };

  if (resp.error) {
    console.error("[bingo/cancelTimer]", resp.error);
    throw new Error("타이머 취소에 실패했어요");
  }
  revalidatePath(`/org/${org.orgId}/bingo/${boardId}`);
  revalidatePath(`/org/${org.orgId}/control-room`);
  revalidatePath("/e/[eventId]/bingo/[boardId]", "page");
}

export async function lockBingoArrangementAction(
  boardId: string
): Promise<void> {
  const org = await requireOrg();
  await assertBoardOwned(boardId, org.orgId);

  // arrange_ends_at 을 1초 전으로 — 즉시 잠금.
  const lockedAt = new Date(Date.now() - 1000).toISOString();
  const supabase = await createClient();
  const resp = (await (
    supabase.from("org_bingo_boards" as never) as unknown as {
      update: (p: Row) => {
        eq: (k: string, v: string) => Promise<{ error: SbErr }>;
      };
    }
  )
    .update({
      arrange_ends_at: lockedAt,
      updated_at: new Date().toISOString(),
    } satisfies Row)
    .eq("id", boardId)) as { error: SbErr };

  if (resp.error) {
    console.error("[bingo/lockArrangement]", resp.error);
    throw new Error("즉시 잠금에 실패했어요");
  }
  revalidatePath(`/org/${org.orgId}/bingo/${boardId}`);
  revalidatePath(`/org/${org.orgId}/control-room`);
  revalidatePath("/e/[eventId]/bingo/[boardId]", "page");
}

export async function clearManualRankingAction(
  boardId: string,
  rank: number
): Promise<void> {
  const org = await requireOrg();
  await assertBoardOwned(boardId, org.orgId);

  const supabase = await createClient();
  const resp = (await (
    supabase.from("org_bingo_rankings" as never) as unknown as {
      delete: () => {
        eq: (k: string, v: string) => {
          eq: (k: string, v: number) => Promise<{ error: SbErr }>;
        };
      };
    }
  )
    .delete()
    .eq("board_id", boardId)
    .eq("rank", rank)) as { error: SbErr };

  if (resp.error) {
    console.error("[bingo/clearManualRanking]", resp.error);
    throw new Error("순위 삭제에 실패했어요");
  }
  revalidatePath(`/org/${org.orgId}/bingo/${boardId}`);
}
