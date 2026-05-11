import OpenAI from "openai";
import type { Seed, SeedDraft } from "@vibe-seeds/shared";
import { getAiConfig } from "../config/env.js";
import { parseSeedDraft } from "./seedDraftParser.js";
import { calculateSeedScore } from "../utils/score.js";
import { AiGenerationError } from "./seedService.js";

export async function combineSeeds(seeds: Seed[], userIntent?: string): Promise<Seed> {
  const config = getAiConfig();

  if (seeds.length < 2 || seeds.length > 3) {
    throw new Error("组合功能需要选择 2-3 个 seeds");
  }

  try {
    const draft = await generateCombinationWithAI(seeds, userIntent);
    return createCombinedSeed(seeds, draft, userIntent);
  } catch (error) {
    console.error("AI combination failed:", error instanceof Error ? error.message : error);

    if (config.enableFallback) {
      return createFallbackCombination(seeds, userIntent);
    }

    throw new AiGenerationError();
  }
}

async function generateCombinationWithAI(seeds: Seed[], userIntent?: string): Promise<SeedDraft> {
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

  const systemPrompt = `你是一个创意融合专家。用户提供了 ${seeds.length} 个产品灵感，你需要分析它们的共同点、互补性和潜在的融合机会，生成一个全新的融合产品。

融合原则：
1. 保留每个原始产品的核心价值
2. 寻找自然的结合点，而不是生硬拼凑
3. 融合后的产品应该比单个产品更有吸引力
4. 明确说明从每个原始产品中继承了什么

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

  const seedDescriptions = seeds.map((s, i) => `
产品 ${i + 1}：${s.projectName}
原始想法：${s.sourceVibe}
核心概念：${s.concept}
目标用户：${s.targetUsers}
核心功能：${s.coreFeatures.join("、")}
技术方向：${s.techDirection.join("、")}
标签：${s.tags.join("、")}
`).join("\n");

  const userPrompt = `原始产品信息：
${seedDescriptions}
${userIntent ? `\n用户希望融合后的产品侧重：「${userIntent}」\n` : ''}
请生成一个融合后的新产品灵感。要求：
1. 分析这些产品的共同主题和互补特性
2. 创造一个自然融合的新产品概念
3. 在 concept 中简要说明从每个原始产品继承了什么特性
4. 确保融合后的产品有独特价值，而不只是功能堆砌

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

function createCombinedSeed(seeds: Seed[], draft: SeedDraft, userIntent?: string): Seed {
  const sourceVibes = seeds.map(s => s.sourceVibe).join(" + ");
  const allTags = Array.from(new Set(seeds.flatMap(s => s.tags)));
  const combinedTags = [...new Set([...draft.tags, ...allTags])].slice(0, 8);

  const combinationNote = userIntent
    ? `融合了「${seeds.map(s => s.projectName).join("」、「")}」，侧重${userIntent}`
    : `融合了「${seeds.map(s => s.projectName).join("」、「")}」`;

  return {
    id: crypto.randomUUID(),
    projectName: draft.title,
    concept: draft.concept,
    targetUsers: draft.targetUser,
    coreFeatures: draft.features,
    techDirection: draft.techDirection,
    followUpPrompt: draft.followUpPrompt,
    tags: combinedTags,
    score: calculateSeedScore(sourceVibes),
    source: "ai",
    sourceVibe: sourceVibes,
    createdAt: new Date().toISOString(),
    explorations: [],
    generation: 0,
    sourceSeeds: seeds.map(s => s.id),
    combinationNote
  };
}

function createFallbackCombination(seeds: Seed[], userIntent?: string): Seed {
  const projectNames = seeds.map(s => s.projectName);
  const allFeatures = Array.from(new Set(seeds.flatMap(s => s.coreFeatures)));
  const allTags = Array.from(new Set(seeds.flatMap(s => s.tags)));
  const allTechDirections = Array.from(new Set(seeds.flatMap(s => s.techDirection)));

  const combinationNote = userIntent
    ? `融合了「${projectNames.join("」、「")}」，侧重${userIntent}`
    : `融合了「${projectNames.join("」、「")}」`;

  return {
    id: crypto.randomUUID(),
    projectName: `${projectNames[0]} × ${projectNames[1]}${seeds.length > 2 ? ` × ${projectNames[2]}` : ''}`,
    concept: `这是一个融合产品，结合了${projectNames.map((name, i) => `「${name}」的${seeds[i].tags[0] ?? '特性'}`).join('、')}。${userIntent ? `特别侧重${userIntent}。` : ''}`,
    targetUsers: seeds[0].targetUsers,
    coreFeatures: allFeatures.slice(0, 6),
    techDirection: allTechDirections.slice(0, 5),
    followUpPrompt: `请基于这个融合产品，详细设计如何将${projectNames.join('、')}的核心特性有机结合。`,
    tags: [...allTags, "融合产品"].slice(0, 6),
    score: Math.round(seeds.reduce((sum, s) => sum + s.score, 0) / seeds.length),
    source: "fallback",
    sourceVibe: seeds.map(s => s.sourceVibe).join(" + "),
    createdAt: new Date().toISOString(),
    explorations: [],
    generation: 0,
    sourceSeeds: seeds.map(s => s.id),
    combinationNote
  };
}
