import OpenAI from "openai";
import type { Exploration, ExplorationDimension, Seed } from "@vibe-seeds/shared";
import { getAiConfig } from "../config/env.js";
import { AiGenerationError } from "./seedService.js";

const dimensionPrompts: Record<ExplorationDimension, string> = {
  mvp: "请为这个产品生成一份 MVP（最小可行产品）清单。列出必须实现的核心功能，每项包含：功能名、实现优先级（必须/应该/可以）、预估工作量（小/中/大）。输出格式为 Markdown，结构清晰。",
  tech: "请为这个产品提供技术选型建议与对比分析。包含：推荐的核心技术栈、备选方案、关键技术决策点及其权衡。输出格式为 Markdown。",
  competitor: "请分析这个产品可能面对的竞品格局。包含：直接竞品、间接竞品、差异化机会、潜在风险。输出格式为 Markdown。",
  validation: "请为这个产品设计一个最小验证方案，目标是用最小成本验证核心假设。包含具体步骤（如 Landing Page 测试、快速原型、用户访谈等）。输出格式为 Markdown。",
  custom: ""
};

const dimensionLabels: Record<ExplorationDimension, string> = {
  mvp: "MVP 清单",
  tech: "技术选型",
  competitor: "竞品分析",
  validation: "最小验证方案",
  custom: "自定义追问"
};

function buildSystemPrompt(seed: Seed): string {
  return `你是一个产品分析专家和技术顾问。
用户已经有了一个产品灵感种子，现在需要你针对这个产品做深入分析。
请基于以下产品信息进行回答：

产品名称：${seed.projectName}
原始想法：${seed.sourceVibe}
产品概念：${seed.concept}
核心功能：${seed.coreFeatures.join("、")}
技术方向：${seed.techDirection.join("、")}

所有回答必须使用中文，内容具体实用，直接可以用于产品决策。`;
}

export async function* streamExplorationContent(
  seed: Seed,
  dimension: ExplorationDimension,
  customPrompt?: string,
  signal?: AbortSignal
): AsyncGenerator<string> {
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

  const userPrompt = dimension === "custom" ? (customPrompt ?? "") : dimensionPrompts[dimension];

  try {
    const stream = await client.chat.completions.create(
      {
        model: config.model,
        temperature: config.temperature,
        stream: true,
        messages: [
          { role: "system", content: buildSystemPrompt(seed) },
          { role: "user", content: userPrompt },
        ],
      },
      { signal }
    );

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) yield content;
    }
  } catch (error) {
    if (error instanceof AiGenerationError) throw error;
    if (error instanceof OpenAI.APIConnectionTimeoutError) {
      throw new AiGenerationError(`AI 请求超时，已超过 ${config.timeoutMs}ms。`);
    }
    if (error instanceof OpenAI.APIUserAbortError) {
      throw error;
    }
    if (error instanceof OpenAI.APIError) {
      throw new AiGenerationError(`AI 接口返回 ${error.status}：${error.message.slice(0, 300)}`);
    }
    throw error;
  }
}

export function buildExplorationMeta(
  dimension: ExplorationDimension,
  customPrompt?: string
): Pick<Exploration, "id" | "dimension" | "prompt" | "createdAt"> {
  return {
    id: crypto.randomUUID(),
    dimension,
    prompt: dimension === "custom" ? (customPrompt ?? "") : dimensionLabels[dimension],
    createdAt: new Date().toISOString()
  };
}

export async function generateExploration(
  seed: Seed,
  dimension: ExplorationDimension,
  customPrompt?: string
): Promise<Exploration> {
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

  const userPrompt = dimension === "custom" ? (customPrompt ?? "") : dimensionPrompts[dimension];

  try {
    const completion = await client.chat.completions.create({
      model: config.model,
      temperature: config.temperature,
      messages: [
        { role: "system", content: buildSystemPrompt(seed) },
        { role: "user", content: userPrompt },
      ],
    });

    const content = completion.choices[0]?.message.content;

    if (!content) {
      throw new AiGenerationError("AI 响应中没有 message.content。");
    }

    return {
      id: crypto.randomUUID(),
      dimension,
      prompt: dimension === "custom" ? (customPrompt ?? "") : dimensionLabels[dimension],
      response: content.trim(),
      createdAt: new Date().toISOString()
    };
  } catch (error) {
    if (error instanceof AiGenerationError) throw error;
    if (error instanceof OpenAI.APIConnectionTimeoutError) {
      throw new AiGenerationError(`AI 请求超时，已超过 ${config.timeoutMs}ms。`);
    }
    if (error instanceof OpenAI.APIError) {
      throw new AiGenerationError(`AI 接口返回 ${error.status}：${error.message.slice(0, 300)}`);
    }
    throw error;
  }
}
