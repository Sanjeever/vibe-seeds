export type ExplorationDimension = "mvp" | "tech" | "competitor" | "validation" | "custom";

export type SceneType = "indie-tool" | "mobile" | "chrome-extension" | "ai-app";

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
  source?: "ai" | "fallback";
  scene?: SceneType;
  sourceVibe: string;
  createdAt: string;
  explorations: Exploration[];
  shareId?: string;
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
