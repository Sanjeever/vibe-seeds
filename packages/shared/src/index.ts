export type ExplorationDimension = "mvp" | "tech" | "competitor" | "validation" | "custom";

export type SceneType = "indie-tool" | "mobile" | "chrome-extension" | "ai-app";

export const seedStatusValues = ["draft", "candidate", "to-validate", "validated", "abandoned"] as const;

export type SeedStatus = (typeof seedStatusValues)[number];

export interface Exploration {
  id: string;
  dimension: ExplorationDimension;
  prompt: string;
  response: string;
  createdAt: string;
}

export interface Seed {
  id: string;
  projectName: string;
  concept: string;
  targetUsers: string;
  coreFeatures: string[];
  techDirection: string[];
  followUpPrompt: string;
  tags: string[];
  score: number;
  status: SeedStatus;
  source?: "ai" | "fallback";
  scene?: SceneType;
  sourceVibe: string;
  createdAt: string;
  explorations: Exploration[];
  shareId?: string;
  parentId?: string;
  evolutionNote?: string;
  generation: number;
  sourceSeeds?: string[];
  combinationNote?: string;
}

export interface CreateSeedInput {
  vibe: string;
  scene?: SceneType;
}

export interface SeedDraft {
  title: string;
  concept: string;
  targetUser: string;
  features: string[];
  techDirection: string[];
  followUpPrompt: string;
  tags: string[];
}
