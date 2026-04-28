import type { SeedDraft } from "@vibe-seeds/shared";
import { getAiConfig } from "../config/env.js";
import { parseSeedDraft } from "./seedDraftParser.js";

type ChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
};

const systemPrompt = `你是一个擅长 vibe coding、产品灵感孵化、全栈原型设计的 AI 创意伙伴。
你的任务是把用户输入的一句模糊想法、情绪、场景或产品冲动，转化成一个可以马上开始编码的小产品灵感。
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
结果要具体、有画面感、有产品味，但不要过度复杂。
title 要短、有产品感，不要超过 20 个中文字符。
features 至少 3 项，最多 6 项。
techDirection 至少 2 项，最多 5 项。
tags 至少 2 项，最多 6 项。
followUpPrompt 要是一段可以继续复制给 AI 的提示词。
技术方向要结合当前项目技术栈：Vue、Vite、TailwindCSS、Express、JSON 文件存储、pnpm monorepo。`;

export async function generateSeedWithAI(input: string): Promise<SeedDraft> {
  const config = getAiConfig();

  if (!config.apiKey || !config.model) {
    throw new Error("AI 配置缺失：请设置 AI_API_KEY 和 AI_MODEL。");
  }

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
          {
            role: "system",
            content: systemPrompt
          },
          {
            role: "user",
            content: createUserPrompt(input)
          }
        ]
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      const responseText = await response.text().catch(() => "");
      throw new Error(`AI 接口返回 ${response.status}${responseText ? `：${responseText.slice(0, 300)}` : ""}`);
    }

    const payload = (await response.json()) as ChatCompletionResponse;
    const content = payload.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("AI 响应中没有 message.content。");
    }

    return parseSeedDraft(content);
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`AI 请求超时，已超过 ${config.timeoutMs}ms。`);
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function createUserPrompt(input: string) {
  return `用户输入的 vibe 是：
「${input}」

请基于这个 vibe 生成一个适合快速原型开发的小产品灵感种子。
请只返回 JSON。`;
}
