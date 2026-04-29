import dotenv from "dotenv";
import path from "node:path";
import { z } from "zod";
import { rootDir } from "./paths.js";

dotenv.config({ path: path.join(rootDir, ".env") });

export interface AiConfig {
  apiBaseUrl: string;
  apiKey?: string;
  model?: string;
  temperature: number;
  timeoutMs: number;
  enableFallback: boolean;
}

export function getRootDir() {
  return rootDir;
}

const envSchema = z.object({
  AI_API_BASE_URL: z.string().default("https://api.openai.com/v1"),
  AI_API_KEY: z.string().optional(),
  AI_MODEL: z.string().optional(),
  AI_TEMPERATURE: z.coerce.number().default(1),
  AI_TIMEOUT_MS: z.coerce.number().min(1000).default(120000),
  AI_ENABLE_FALLBACK: z
    .string()
    .default("true")
    .transform((v) => !["false", "0", "no", "off"].includes(v.trim().toLowerCase())),
});

const PLACEHOLDER_VALUES = new Set(["your_api_key_here", "your_model_name_here"]);

function cleanOptional(value: string | undefined) {
  const cleaned = value?.trim();
  return cleaned && !PLACEHOLDER_VALUES.has(cleaned) ? cleaned : undefined;
}

let cachedConfig: AiConfig | null = null;

export function getAiConfig(): AiConfig {
  if (cachedConfig !== null) return cachedConfig;

  const parsed = envSchema.parse(process.env);

  cachedConfig = {
    apiBaseUrl: parsed.AI_API_BASE_URL.replace(/\/+$/, ""),
    apiKey: cleanOptional(parsed.AI_API_KEY),
    model: cleanOptional(parsed.AI_MODEL),
    temperature: parsed.AI_TEMPERATURE,
    timeoutMs: parsed.AI_TIMEOUT_MS,
    enableFallback: parsed.AI_ENABLE_FALLBACK,
  };

  return cachedConfig;
}

export function validateAiConfigOnStartup() {
  const config = getAiConfig();
  const missing = [];

  if (!config.apiKey) missing.push("AI_API_KEY");
  if (!config.model) missing.push("AI_MODEL");

  if (missing.length === 0) return;

  const message = `AI 配置缺失：${missing.join(", ")}。请复制 .env.example 为 .env，并填写后端 AI 配置。`;

  if (config.enableFallback) {
    console.warn(`${message} 当前 AI_ENABLE_FALLBACK=true，POST /api/seeds 会使用本地兜底生成。`);
    return;
  }

  console.error(`${message} 当前 AI_ENABLE_FALLBACK=false，AI 生成失败时会返回 502。`);
}

// Keep for backward compatibility
export function loadRootEnv() {}
