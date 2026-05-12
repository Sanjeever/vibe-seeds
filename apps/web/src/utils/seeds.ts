import { seedStatusValues, type Seed, type SeedStatus } from "@vibe-seeds/shared";

export type SeedSortMode = "createdAt" | "score";

export const seedStatusOptions: { value: SeedStatus; label: string }[] = [
  { value: "draft", label: "草稿" },
  { value: "candidate", label: "候选" },
  { value: "to-validate", label: "待验证" },
  { value: "validated", label: "已验证" },
  { value: "abandoned", label: "放弃" }
];

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

export function getSeedStatusLabel(status: SeedStatus) {
  return seedStatusOptions.find((option) => option.value === status)?.label ?? "草稿";
}

export function getSeedStatusClass(status: SeedStatus) {
  if (!seedStatusValues.includes(status)) return "border-stone-200 bg-stone-50 text-stone-500";

  const classes: Record<SeedStatus, string> = {
    draft: "border-stone-200 bg-stone-50 text-stone-500",
    candidate: "border-stone-300 bg-white text-stone-700",
    "to-validate": "border-stone-400 bg-stone-100 text-stone-800",
    validated: "border-stone-900 bg-white text-stone-900",
    abandoned: "border-stone-200 bg-stone-100 text-stone-400"
  };

  return classes[status];
}
