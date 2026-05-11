import OpenAI from "openai";
import type { Seed, SeedDraft } from "@vibe-seeds/shared";
import { getAiConfig } from "../config/env.js";
import { parseSeedDraft } from "./seedDraftParser.js";
import { calculateSeedScore } from "../utils/score.js";
import { AiGenerationError } from "./seedService.js";

export async function evolveSeed(parentSeed: Seed, evolutionNote: string): Promise<Seed> {
  const config = getAiConfig();

  try {
    const draft = await generateEvolutionWithAI(parentSeed, evolutionNote);
    return createEvolvedSeed(parentSeed, draft, evolutionNote);
  } catch (error) {
    console.error("AI evolution failed:", error instanceof Error ? error.message : error);

    if (config.enableFallback) {
      return createFallbackEvolution(parentSeed, evolutionNote);
    }

    throw new AiGenerationError();
  }
}

async function generateEvolutionWithAI(parentSeed: Seed, evolutionNote: string): Promise<SeedDraft> {
  const config = getAiConfig();

  if (!config.apiKey || !config.model) {
    throw new AiGenerationError("AI 配置缺失：请设置 AI_API_KEY 和 AI_MODEL。");
  }

  const client = new OpenAI({
    apiKey: config.apiKey,
    baseURL: config.apiBaseUrl,
    timeout: config.timeoutMs,
    maxRetries: 0,
  });

  const systemPrompt = `你是一个产品迭代专家。用户已经有了一个产品灵感，现在希望在此基础上进行演化改进。

你必须只输出严格 JSON，不要输出 Markdown，不要解释。
输出字段必须符合：
{
  "title": string,
  "concept": string,
  "targetUser": string,
  "features": string[],
  "techDirection": string[],
  "followUpPrompt": string,
  "tags": string[]
}
所有内容必须是中文。
title 要短、有产品感，不要超过 20 个中文字符。
features 至少 3 项，最多 6 项。
techDirection 至少 2 项，最多 5 项。
tags 至少 2 项，最多 6 项。`;

  const userPrompt = `原始产品信息：
- 项目名称：${parentSeed.projectName}
- 原始想法：${parentSeed.sourceVibe}
- 产品概念：${parentSeed.concept}
- 目标用户：${parentSeed.targetUsers}
- 核心功能：${parentSeed.coreFeatures.join("、")}
- 技术方向：${parentSeed.techDirection.join("、")}
- 标签：${parentSeed.tags.join("、")}

用户希望的演化方向：「${evolutionNote}」

请基于原始产品生成一个演化改进版本。要求：
1. 保留原产品的核心理念和价值主张
2. 融入用户提出的演化方向
3. 确保演化后的产品比原版本更具体、更完善
4. 如果演化方向涉及新功能，要合理整合到现有功能体系中
5. 如果演化方向涉及场景转换，要调整目标用户和技术方向

请只返回 JSON。`;

  try {
    const completion = await client.chat.completions.create({
      model: config.model,
      temperature: config.temperature,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });

    const content = completion.choices[0]?.message.content;

    if (!content) {
      throw new Error("AI 响应中没有 message.content。");
    }

    return parseSeedDraft(content);
  } catch (error) {
    if (error instanceof OpenAI.APIConnectionTimeoutError) {
      throw new Error(`AI 请求超时，已超过 ${config.timeoutMs}ms。`);
    }
    if (error instanceof OpenAI.APIError) {
      throw new Error(`AI 接口返回 ${error.status}：${error.message.slice(0, 300)}`);
    }
    throw error;
  }
}

function createEvolvedSeed(parentSeed: Seed, draft: SeedDraft, evolutionNote: string): Seed {
  return {
    id: crypto.randomUUID(),
    projectName: draft.title,
    concept: draft.concept,
    targetUsers: draft.targetUser,
    coreFeatures: draft.features,
    techDirection: draft.techDirection,
    followUpPrompt: draft.followUpPrompt,
    tags: draft.tags,
    score: calculateSeedScore(parentSeed.sourceVibe + " " + evolutionNote),
    source: "ai",
    scene: parentSeed.scene,
    sourceVibe: parentSeed.sourceVibe,
    createdAt: new Date().toISOString(),
    explorations: [],
    parentId: parentSeed.id,
    evolutionNote,
    generation: parentSeed.generation + 1
  };
}

function createFallbackEvolution(parentSeed: Seed, evolutionNote: string): Seed {
  return {
    id: crypto.randomUUID(),
    projectName: `${parentSeed.projectName} v${parentSeed.generation + 2}`,
    concept: `${parentSeed.concept}\n\n演化方向：${evolutionNote}`,
    targetUsers: parentSeed.targetUsers,
    coreFeatures: [...parentSeed.coreFeatures, `新增：${evolutionNote}`],
    techDirection: parentSeed.techDirection,
    followUpPrompt: `请基于"${parentSeed.projectName}"的演化版本，进一步细化"${evolutionNote}"的实现方案。`,
    tags: [...new Set([...parentSeed.tags, "演化版本"])],
    score: calculateSeedScore(parentSeed.sourceVibe + " " + evolutionNote),
    source: "fallback",
    scene: parentSeed.scene,
    sourceVibe: parentSeed.sourceVibe,
    createdAt: new Date().toISOString(),
    explorations: [],
    parentId: parentSeed.id,
    evolutionNote,
    generation: parentSeed.generation + 1
  };
}
