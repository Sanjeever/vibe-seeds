import type { SeedDraft } from "@vibe-seeds/shared";

export function parseSeedDraft(content: string): SeedDraft {
  const parsed = parseJsonObject(content);
  return validateSeedDraft(parsed);
}

function parseJsonObject(content: string): unknown {
  const trimmed = content.trim();

  try {
    return JSON.parse(trimmed);
  } catch {
    const fenced = extractJsonFence(trimmed);
    if (fenced) {
      try {
        return JSON.parse(fenced);
      } catch {
        // Continue to object extraction.
      }
    }

    const objectText = extractFirstJsonObject(trimmed);
    if (objectText) {
      return JSON.parse(objectText);
    }
  }

  throw new Error("AI 返回内容不是可解析的 JSON object。");
}

function extractJsonFence(content: string): string | undefined {
  const match = content.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return match?.[1]?.trim();
}

function extractFirstJsonObject(content: string): string | null {
  const start = content.indexOf("{");

  if (start === -1) {
    return null;
  }

  let depth = 0;
  let inString = false;
  let isEscaped = false;

  for (let index = start; index < content.length; index += 1) {
    const char = content[index];

    if (isEscaped) {
      isEscaped = false;
      continue;
    }

    if (char === "\\") {
      isEscaped = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (inString) {
      continue;
    }

    if (char === "{") {
      depth += 1;
    }

    if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return content.slice(start, index + 1);
      }
    }
  }

  return null;
}

function validateSeedDraft(value: unknown): SeedDraft {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("AI JSON 必须是 object。");
  }

  const record = value as Record<string, unknown>;
  const title = readRequiredString(record, "title", 20);
  const concept = readRequiredString(record, "concept");
  const targetUser = readRequiredString(record, "targetUser");
  const features = readStringArray(record, "features", 3, 6);
  const techDirection = readStringArray(record, "techDirection", 2, 5);
  const followUpPrompt = readRequiredString(record, "followUpPrompt");
  const tags = readStringArray(record, "tags", 2, 6);

  return {
    title,
    concept,
    targetUser,
    features,
    techDirection,
    followUpPrompt,
    tags
  };
}

function readRequiredString(record: Record<string, unknown>, key: string, maxLength?: number): string {
  const value = record[key];

  if (typeof value !== "string") {
    throw new Error(`AI JSON 字段 ${key} 必须是字符串。`);
  }

  const trimmed = value.trim();

  if (!trimmed) {
    throw new Error(`AI JSON 字段 ${key} 不能为空。`);
  }

  const chars = Array.from(trimmed);

  if (maxLength && chars.length > maxLength) {
    return chars.slice(0, maxLength).join("");
  }

  return trimmed;
}

function readStringArray(record: Record<string, unknown>, key: string, minLength: number, maxLength: number): string[] {
  const value = record[key];

  if (!Array.isArray(value)) {
    throw new Error(`AI JSON 字段 ${key} 必须是数组。`);
  }

  const items = Array.from(
    new Set(
      value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean)
    )
  ).slice(0, maxLength);

  if (items.length < minLength) {
    throw new Error(`AI JSON 字段 ${key} 至少需要 ${minLength} 个有效字符串。`);
  }

  return items;
}
