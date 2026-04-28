import type { Seed } from "@vibe-seeds/shared";

export type SeedSortMode = "createdAt" | "score";

const seedTimeFormatter = new Intl.DateTimeFormat("zh-CN", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit"
});

export function sortSeeds(seeds: Seed[], sortMode: SeedSortMode) {
  return [...seeds].sort((left, right) => {
    if (sortMode === "score") {
      return normalizeScore(right.score) - normalizeScore(left.score);
    }

    return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
  });
}

export function formatSeedTime(value: string) {
  return seedTimeFormatter.format(new Date(value));
}

export function normalizeScore(score: number) {
  return Math.max(1, Math.min(100, Math.round(score)));
}
