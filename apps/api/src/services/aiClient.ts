import type { SceneType, SeedDraft } from "@vibe-seeds/shared";
import { getAiConfig } from "../config/env.js";
import { parseSeedDraft } from "./seedDraftParser.js";

type ChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
};

const baseOutputRules = `你必须只输出严格 JSON，不要输出 Markdown，不要解释。
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
followUpPrompt 要是一段可以继续复制给 AI 的提示词。`;

const sceneSystemPrompts: Record<SceneType, string> = {
  "indie-tool": `你是一个擅长独立开发者工具产品设计的 AI 创意伙伴。
你的任务是把用户输入的模糊想法转化成一个适合独立开发者独立完成的桌面或 Web 工具产品灵感。
分析框架重点：
- 核心功能要极简，单人两周内可完成 MVP
- 技术栈优先推荐本地优先（Local-first）、无服务器或轻后端方案
- 商业化路径建议 Buy once / 订阅 / 开源+Pro
- targetUser 聚焦开发者、设计师、创作者等技术向用户
- techDirection 优先推荐：Electron、Tauri、PWA、SQLite、Vite、TypeScript
${baseOutputRules}`,

  "mobile": `你是一个擅长移动端小产品设计的 AI 创意伙伴。
你的任务是把用户输入的模糊想法转化成一个适合移动端的轻量小产品灵感。
分析框架重点：
- 核心功能聚焦单一场景，符合移动端碎片化使用习惯
- 交互要适合触屏操作，页面层级扁平
- 考虑推送通知、小组件等移动端特有能力
- targetUser 描述具体使用场景（通勤中、睡前、健身时等）
- techDirection 优先推荐：React Native、Flutter、Expo、SwiftUI、Capacitor
${baseOutputRules}`,

  "chrome-extension": `你是一个擅长 Chrome 插件产品设计的 AI 创意伙伴。
你的任务是把用户输入的模糊想法转化成一个有价值的 Chrome 浏览器插件产品灵感。
分析框架重点：
- 功能必须与浏览器上下文强相关（增强网页、捕获内容、自动化操作等）
- 明确插件形态：popup、content script、background service worker、side panel
- 考虑权限最小化原则，不要请求多余权限
- targetUser 聚焦重度浏览器使用者、信息工作者、研究人员等
- techDirection 优先推荐：Chrome Extension Manifest V3、React/Vue popup、content script、Chrome Storage API
${baseOutputRules}`,

  "ai-app": `你是一个擅长 AI 应用产品设计的 AI 创意伙伴。
你的任务是把用户输入的模糊想法转化成一个以 AI 能力为核心驱动的应用产品灵感。
分析框架重点：
- 明确 AI 在产品中的核心角色（生成、分析、分类、对话、推荐等）
- 设计差异化的交互范式，而不只是套壳 ChatGPT
- 考虑 prompt 工程、上下文管理、结果可编辑性
- targetUser 要描述具体的 AI 辅助场景和用户痛点
- techDirection 优先推荐：OpenAI API / Claude API、LangChain、Vercel AI SDK、流式输出（SSE/streaming）、向量数据库
${baseOutputRules}`
};

const defaultSystemPrompt = `你是一个擅长 vibe coding、产品灵感孵化、全栈原型设计的 AI 创意伙伴。
你的任务是把用户输入的一句模糊想法、情绪、场景或产品冲动，转化成一个可以马上开始编码的小产品灵感。
${baseOutputRules}
技术方向要结合当前项目技术栈：Vue、Vite、TailwindCSS、Express、JSON 文件存储、pnpm monorepo。`;

export async function generateSeedWithAI(input: string, scene?: SceneType): Promise<SeedDraft> {
  const config = getAiConfig();

  if (!config.apiKey || !config.model) {
    throw new Error("AI 配置缺失：请设置 AI_API_KEY 和 AI_MODEL。");
  }

  const systemPrompt = scene ? sceneSystemPrompts[scene] : defaultSystemPrompt;

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
            content: createUserPrompt(input, scene)
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

const sceneLabels: Record<SceneType, string> = {
  "indie-tool": "独立开发者工具",
  "mobile": "移动端小产品",
  "chrome-extension": "Chrome 插件",
  "ai-app": "AI 应用"
};

function createUserPrompt(input: string, scene?: SceneType) {
  const sceneHint = scene ? `\n场景类型：${sceneLabels[scene]}` : "";
  return `用户输入的 vibe 是：
「${input}」${sceneHint}

请基于这个 vibe 生成一个适合快速原型开发的小产品灵感种子。
请只返回 JSON。`;
}
