import type { Seed, SeedDraft, SceneType } from "@vibe-seeds/shared";
import { getAiConfig } from "../config/env.js";
import { generateSeedWithAI } from "./aiClient.js";
import { calculateSeedScore } from "../utils/score.js";
import { createFallbackSeedFromVibe } from "./fallbackSeedGenerator.js";

export async function createSeed(vibe: string, scene?: SceneType): Promise<Seed> {
  const config = getAiConfig();

  try {
    const draft = await generateSeedWithAI(vibe, scene);
    return createSeedFromDraft(vibe, draft, scene);
  } catch (error) {
    console.error("AI seed generation failed:", error instanceof Error ? error.message : error);

    if (config.enableFallback) {
      return createFallbackSeedFromVibe(vibe);
    }

    throw new AiGenerationError();
  }
}

function createSeedFromDraft(vibe: string, draft: SeedDraft, scene?: SceneType): Seed {
  return {
    id: crypto.randomUUID(),
    projectName: draft.title,
    concept: draft.concept,
    targetUsers: draft.targetUser,
    coreFeatures: draft.features,
    techDirection: draft.techDirection,
    followUpPrompt: draft.followUpPrompt,
    tags: draft.tags,
    score: calculateSeedScore(vibe),
    source: "ai",
    scene,
    sourceVibe: vibe,
    createdAt: new Date().toISOString(),
    explorations: []
  };
}

export class AiGenerationError extends Error {
  constructor(message = "AI generation failed") {
    super(message);
  }
}

export function isAiGenerationError(error: unknown): error is AiGenerationError {
  return error instanceof AiGenerationError;
}
