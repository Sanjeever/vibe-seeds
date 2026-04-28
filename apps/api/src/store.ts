import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import type { Seed } from "@vibe-seeds/shared";
import { dataDir, seedsPath } from "./config/paths.js";
import { calculateSeedScore } from "./utils/score.js";

let writeQueue = Promise.resolve();
let seedsCache: Seed[] | null = null;

export async function getSeeds(): Promise<Seed[]> {
  if (seedsCache !== null) {
    return seedsCache;
  }

  seedsCache = await readSeedsFile();
  return seedsCache;
}

export async function addSeed(seed: Seed): Promise<Seed> {
  return withWriteLock(async () => {
    const seeds = await getSeeds();
    const next = [seed, ...seeds];
    await writeSeedsFile(next);
    seedsCache = next;
    return seed;
  });
}

export async function deleteSeed(id: string): Promise<boolean> {
  return withWriteLock(async () => {
    const seeds = await getSeeds();
    const next = seeds.filter((seed) => seed.id !== id);

    if (next.length === seeds.length) {
      return false;
    }

    await writeSeedsFile(next);
    seedsCache = next;
    return true;
  });
}

async function ensureDataFile() {
  await mkdir(dataDir, { recursive: true });

  try {
    const content = await readFile(seedsPath, "utf-8");
    if (content.trim().length === 0) {
      await writeSeedsFile([]);
    }
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      await writeSeedsFile([]);
      return;
    }

    throw error;
  }
}

async function readSeedsFile(): Promise<Seed[]> {
  try {
    const content = await readFile(seedsPath, "utf-8");
    if (content.trim().length === 0) {
      return [];
    }

    const parsed = JSON.parse(content) as unknown;
    return Array.isArray(parsed) ? parsed.map(normalizeSeed).filter((seed): seed is Seed => seed !== null) : [];
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      await ensureDataFile();
      return [];
    }

    if (error instanceof SyntaxError) {
      return [];
    }

    throw error;
  }
}

async function writeSeedsFile(seeds: Seed[]) {
  await mkdir(dataDir, { recursive: true });
  const tempPath = `${seedsPath}.tmp`;
  await writeFile(tempPath, `${JSON.stringify(seeds, null, 2)}\n`, "utf-8");
  await rename(tempPath, seedsPath);
}

function withWriteLock<T>(operation: () => Promise<T>): Promise<T> {
  const run = writeQueue.then(operation, operation);
  writeQueue = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}

function normalizeSeed(value: unknown): Seed | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const id = readString(record, "id");
  const projectName = readString(record, "projectName");
  const concept = readString(record, "concept");
  const targetUsers = readString(record, "targetUsers");
  const coreFeatures = readStringArray(record, "coreFeatures");
  const techDirection = readStringArray(record, "techDirection");
  const followUpPrompt = readString(record, "followUpPrompt");
  const tags = readStringArray(record, "tags");
  const sourceVibe = readString(record, "sourceVibe") ?? "";
  const createdAt = readString(record, "createdAt");

  if (
    !id ||
    !projectName ||
    !concept ||
    !targetUsers ||
    !followUpPrompt ||
    !createdAt ||
    !coreFeatures ||
    !techDirection ||
    !tags
  ) {
    return null;
  }

  const rawScore = record.score;
  const score = typeof rawScore === "number" && Number.isFinite(rawScore) ? rawScore : calculateSeedScore(sourceVibe);
  const source = record.source === "ai" || record.source === "fallback" ? record.source : undefined;

  return {
    id,
    projectName,
    concept,
    targetUsers,
    coreFeatures,
    techDirection,
    followUpPrompt,
    tags,
    source,
    sourceVibe,
    createdAt,
    score: Math.max(1, Math.min(100, Math.round(score)))
  };
}

function readString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  return typeof value === "string" && value.trim() ? value : null;
}

function readStringArray(record: Record<string, unknown>, key: string): string[] | null {
  const value = record[key];

  if (!Array.isArray(value)) {
    return null;
  }

  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}
