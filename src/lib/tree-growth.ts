export type TreeLevel = "SPROUT" | "BUSH" | "SAPLING" | "TREE" | "FOREST";

export interface TreeLevelInfo {
  level: TreeLevel;
  emoji: string;
  name: string;
  min: number;
  max: number | null; // null = infinite (for FOREST)
  color: string;
}

export const TREE_LEVELS: TreeLevelInfo[] = [
  { level: "SPROUT", emoji: "🌱", name: "새싹", min: 0, max: 5, color: "#A8C686" },
  { level: "BUSH", emoji: "🌿", name: "덤불", min: 6, max: 15, color: "#8FBF6D" },
  { level: "SAPLING", emoji: "🪵", name: "묘목", min: 16, max: 30, color: "#C4956A" },
  { level: "TREE", emoji: "🌲", name: "나무", min: 31, max: 60, color: "#4A7C59" },
  { level: "FOREST", emoji: "🏞️", name: "숲", min: 61, max: null, color: "#2D5A3D" },
];

export function getTreeLevel(acorns: number): TreeLevelInfo {
  return TREE_LEVELS.find((l) => acorns >= l.min && (l.max === null || acorns <= l.max)) ?? TREE_LEVELS[0];
}

export function getNextLevel(acorns: number): TreeLevelInfo | null {
  const current = getTreeLevel(acorns);
  const idx = TREE_LEVELS.findIndex((l) => l.level === current.level);
  return idx < TREE_LEVELS.length - 1 ? TREE_LEVELS[idx + 1] : null;
}

export function getProgress(acorns: number): { current: TreeLevelInfo; next: TreeLevelInfo | null; percent: number; remaining: number } {
  const current = getTreeLevel(acorns);
  const next = getNextLevel(acorns);
  if (!next || current.max === null) {
    return { current, next: null, percent: 100, remaining: 0 };
  }
  const range = next.min - current.min;
  const progress = acorns - current.min;
  return {
    current,
    next,
    percent: Math.min(100, Math.round((progress / range) * 100)),
    remaining: next.min - acorns,
  };
}
