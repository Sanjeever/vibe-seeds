import type { Exploration, ExplorationDimension, Seed } from "@vibe-seeds/shared";
import { getAiConfig } from "../config/env.js";
import { AiGenerationError } from "./seedService.js";

type ChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
};

type StreamChunk = {
  choices?: Array<{
    delta?: { content?: string };
    finish_reason?: string | null;
  }>;
};

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

  const userPrompt = dimension === "custom" ? (customPrompt ?? "") : dimensionPrompts[dimension];

  const streamTimeoutMs = config.timeoutMs;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), streamTimeoutMs);

  if (signal) {
    signal.addEventListener("abort", () => controller.abort());
  }

  try {
    const response = await fetch(`${config.apiBaseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: config.model,
        temperature: config.temperature,
        stream: true,
        messages: [
          { role: "system", content: buildSystemPrompt(seed) },
          { role: "user", content: userPrompt }
        ]
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      const responseText = await response.text().catch(() => "");
      throw new AiGenerationError(`AI 接口返回 ${response.status}${responseText ? `：${responseText.slice(0, 300)}` : ""}`);
    }

    if (!response.body) {
      throw new AiGenerationError("AI 响应没有 body。");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data: ")) continue;

        const data = trimmed.slice(6);
        if (data === "[DONE]") {
          console.log("[streamExplorationContent] received [DONE], returning normally");
          return;
        }

        try {
          const parsed = JSON.parse(data) as StreamChunk;
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) yield content;
        } catch {
          // skip malformed chunks
        }
      }
    }
    console.log("[streamExplorationContent] reader exhausted (done=true), returning normally");
  } catch (error) {
    if (error instanceof AiGenerationError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      console.error("[streamExplorationContent] AbortError caught, signal.aborted =", signal?.aborted);
      throw new AiGenerationError(`AI 请求超时，已超过 ${streamTimeoutMs}ms。`);
    }
    console.error("[streamExplorationContent] unexpected error:", error);
    throw error;
  } finally {
    clearTimeout(timeout);
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

  const userPrompt = dimension === "custom" ? (customPrompt ?? "") : dimensionPrompts[dimension];

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);

  try {
    const response = await fetch(`${config.apiBaseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: config.model,
        temperature: config.temperature,
        messages: [
          { role: "system", content: buildSystemPrompt(seed) },
          { role: "user", content: userPrompt }
        ]
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      const responseText = await response.text().catch(() => "");
      throw new AiGenerationError(`AI 接口返回 ${response.status}${responseText ? `：${responseText.slice(0, 300)}` : ""}`);
    }

    const payload = (await response.json()) as ChatCompletionResponse;
    const content = payload.choices?.[0]?.message?.content;

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
    if (error instanceof AiGenerationError) {
      throw error;
    }

    if (error instanceof Error && error.name === "AbortError") {
      throw new AiGenerationError(`AI 请求超时，已超过 ${config.timeoutMs}ms。`);
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
