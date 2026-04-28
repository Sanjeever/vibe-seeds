import type { Seed, SeedDraft } from "@vibe-seeds/shared";
import { getAiConfig } from "../config/env.js";
import { generateSeedWithAI } from "./aiClient.js";
import { calculateSeedScore, createFallbackSeedFromVibe } from "./fallbackSeedGenerator.js";

export async function createSeed(vibe: string): Promise<Seed> {
  const config = getAiConfig();

  try {
    const draft = await generateSeedWithAI(vibe);
    return createSeedFromDraft(vibe, draft);
  } catch (error) {
    console.error("AI seed generation failed:", error instanceof Error ? error.message : error);

    if (config.enableFallback) {
      return createFallbackSeedFromVibe(vibe);
    }

    throw new AiGenerationError();
  }
}

function createSeedFromDraft(vibe: string, draft: SeedDraft): Seed {
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
    sourceVibe: vibe,
    createdAt: new Date().toISOString()
  };
}

class AiGenerationError extends Error {
  constructor() {
    super("AI generation failed");
  }
}

export function isAiGenerationError(error: unknown): error is AiGenerationError {
  return error instanceof AiGenerationError;
}
