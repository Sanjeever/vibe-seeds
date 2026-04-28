import { readFileSync } from "node:fs";
import path from "node:path";
import { rootDir } from "./paths.js";

const envPath = path.join(rootDir, ".env");

let isLoaded = false;

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

export function loadRootEnv() {
  if (isLoaded) {
    return;
  }

  isLoaded = true;

  try {
    const content = readFileSync(envPath, "utf-8");
    for (const line of content.split(/\r?\n/)) {
      const parsed = parseEnvLine(line);
      if (!parsed) {
        continue;
      }

      const [key, value] = parsed;
      if (process.env[key] === undefined) {
        process.env[key] = value;
      }
    }
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      return;
    }

    throw error;
  }
}

let cachedConfig: AiConfig | null = null;

export function getAiConfig(): AiConfig {
  if (cachedConfig !== null) {
    return cachedConfig;
  }

  loadRootEnv();

  cachedConfig = {
    apiBaseUrl: trimTrailingSlash(process.env.AI_API_BASE_URL?.trim() || "https://api.openai.com/v1"),
    apiKey: cleanOptional(process.env.AI_API_KEY),
    model: cleanOptional(process.env.AI_MODEL),
    temperature: parseNumber(process.env.AI_TEMPERATURE, 1),
    timeoutMs: Math.max(1000, Math.round(parseNumber(process.env.AI_TIMEOUT_MS, 30000))),
    enableFallback: parseBoolean(process.env.AI_ENABLE_FALLBACK, true)
  };

  return cachedConfig;
}

export function validateAiConfigOnStartup() {
  const config = getAiConfig();
  const missing = [];

  if (!config.apiKey) {
    missing.push("AI_API_KEY");
  }

  if (!config.model) {
    missing.push("AI_MODEL");
  }

  if (missing.length === 0) {
    return;
  }

  const message = `AI 配置缺失：${missing.join(", ")}。请复制 .env.example 为 .env，并填写后端 AI 配置。`;

  if (config.enableFallback) {
    console.warn(`${message} 当前 AI_ENABLE_FALLBACK=true，POST /api/seeds 会使用本地兜底生成。`);
    return;
  }

  console.error(`${message} 当前 AI_ENABLE_FALLBACK=false，AI 生成失败时会返回 502。`);
}

function parseEnvLine(line: string): [string, string] | null {
  const trimmed = line.trim();

  if (!trimmed || trimmed.startsWith("#")) {
    return null;
  }

  const separatorIndex = trimmed.indexOf("=");
  if (separatorIndex === -1) {
    return null;
  }

  const key = trimmed.slice(0, separatorIndex).trim();
  const value = unquote(trimmed.slice(separatorIndex + 1).trim());

  return key ? [key, value] : null;
}

function unquote(value: string) {
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }

  return value;
}

function cleanOptional(value: string | undefined) {
  const cleaned = value?.trim();

  if (!cleaned || cleaned === "your_api_key_here" || cleaned === "your_model_name_here") {
    return undefined;
  }

  return cleaned;
}

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

function parseNumber(value: string | undefined, fallback: number) {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseBoolean(value: string | undefined, fallback: boolean) {
  if (!value) {
    return fallback;
  }

  return !["false", "0", "no", "off"].includes(value.trim().toLowerCase());
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
