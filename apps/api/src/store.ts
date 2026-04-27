import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Seed } from "@vibe-seeds/shared";
import { calculateSeedScore } from "./services/fallbackSeedGenerator.js";

const currentFile = fileURLToPath(import.meta.url);
const currentDir = path.dirname(currentFile);
const rootDir = path.resolve(currentDir, "../../..");
const dataDir = path.join(rootDir, "data");
const seedsPath = path.join(dataDir, "seeds.json");

let writeQueue = Promise.resolve();

export async function getSeeds(): Promise<Seed[]> {
  await ensureDataFile();
  return readSeedsFile();
}

export async function addSeed(seed: Seed): Promise<Seed> {
  return withWriteLock(async () => {
    const seeds = await readSeedsFile();
    seeds.unshift(seed);
    await writeSeedsFile(seeds);
    return seed;
  });
}

export async function deleteSeed(id: string): Promise<boolean> {
  return withWriteLock(async () => {
    const seeds = await readSeedsFile();
    const nextSeeds = seeds.filter((seed) => seed.id !== id);

    if (nextSeeds.length === seeds.length) {
      return false;
    }

    await writeSeedsFile(nextSeeds);
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
  if (!value || typeof value !== "object") {
    return null;
  }

  const seed = value as Seed;
  const sourceVibe = typeof seed.sourceVibe === "string" ? seed.sourceVibe : "";
  const score = typeof seed.score === "number" && Number.isFinite(seed.score) ? seed.score : calculateSeedScore(sourceVibe);
  const source = seed.source === "ai" || seed.source === "fallback" ? seed.source : undefined;

  return {
    ...seed,
    source,
    score: Math.max(1, Math.min(100, Math.round(score)))
  };
}
