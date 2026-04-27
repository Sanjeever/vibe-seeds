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
  sourceVibe: string;
  createdAt: string;
}

export interface CreateSeedInput {
  vibe: string;
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
