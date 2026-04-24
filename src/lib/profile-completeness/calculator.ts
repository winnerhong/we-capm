import type {
  CompletenessResult,
  ProfileField,
  ProfileSchema,
  ProfileSnapshot,
} from "./types";

function isFilled(val: unknown): boolean {
  if (val === null || val === undefined) return false;
  if (typeof val === "string") return val.trim().length > 0;
  if (typeof val === "number") return Number.isFinite(val);
  if (typeof val === "boolean") return val;
  return false;
}

function isFieldCompleted(
  field: ProfileField,
  snap: ProfileSnapshot
): boolean {
  const c = field.check;
  switch (c.kind) {
    case "db_field":
      return isFilled(snap.db[c.column]);
    case "doc_approved":
      return snap.docs[c.docType] === "APPROVED";
    case "docs_all_approved":
      return c.requiredTypes.every((t) => snap.docs[t] === "APPROVED");
  }
}

export function calcCompleteness(
  schema: ProfileSchema,
  snap: ProfileSnapshot
): CompletenessResult {
  let totalWeight = 0;
  let completedWeight = 0;
  let totalCount = 0;
  let completedCount = 0;
  const missing: ProfileField[] = [];

  const groups = schema.groups.map((g) => {
    const gMissing: ProfileField[] = [];
    let gTotal = 0;
    let gCompleted = 0;
    for (const f of g.fields) {
      const w = f.weight ?? 1;
      totalWeight += w;
      totalCount += 1;
      gTotal += 1;
      const done = isFieldCompleted(f, snap);
      if (done) {
        completedWeight += w;
        completedCount += 1;
        gCompleted += 1;
      } else {
        gMissing.push(f);
        missing.push(f);
      }
    }
    const gPct = gTotal === 0 ? 100 : Math.round((gCompleted / gTotal) * 100);
    return {
      id: g.id,
      label: g.label,
      icon: g.icon,
      completed: gCompleted,
      total: gTotal,
      percent: gPct,
      missing: gMissing,
    };
  });

  const percent =
    totalWeight === 0
      ? 100
      : Math.round((completedWeight / totalWeight) * 100);

  return {
    percent,
    completedCount,
    totalCount,
    totalWeight,
    completedWeight,
    groups,
    missing,
    isComplete: completedCount === totalCount && totalCount > 0,
  };
}

/** 완성도 % → 테마(토리로 forest palette 기반) */
export function toneForPercent(
  percent: number
): "rose" | "amber" | "emerald" | "celebrate" {
  if (percent >= 100) return "celebrate";
  if (percent >= 80) return "emerald";
  if (percent >= 50) return "amber";
  return "rose";
}
