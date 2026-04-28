// Plain types shared between server action and client preview.
// Server Action files ("use server") can only export async functions,
// so keep types and constants in this separate module.

export type BulkImportStatus = "CREATED" | "MERGED" | "SKIPPED" | "ERROR";

export type BulkImportRowResult = {
  row: number;
  phone: string;
  parentName: string;
  status: BulkImportStatus;
  error?: string;
  childrenAdded?: number;
  /** CREATED/MERGED 일 때만 채워짐 — 행사 link 등 후속 처리에서 사용. */
  userId?: string;
};

export type BulkImportResult = {
  success: number;
  failed: number;
  merged: number;
  skipped: number;
  rows: BulkImportRowResult[];
};
