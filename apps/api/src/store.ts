import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { seedStatusValues, type Exploration, type Seed, type SeedStatus, type SceneType } from "@vibe-seeds/shared";
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

export async function getSeedById(id: string): Promise<Seed | null> {
  const seeds = await getSeeds();
  return seeds.find((seed) => seed.id === id) ?? null;
}

export async function appendExploration(seedId: string, exploration: Exploration): Promise<Seed | null> {
  return withWriteLock(async () => {
    const seeds = await readSeedsFile();
    const index = seeds.findIndex((seed) => seed.id === seedId);

    if (index === -1) {
      return null;
    }

    seeds[index] = { ...seeds[index], explorations: [...seeds[index].explorations, exploration] };
    await writeSeedsFile(seeds);
    seedsCache = seeds;
    return seeds[index];
  });
}

export async function removeExploration(seedId: string, explorationId: string): Promise<boolean> {
  return withWriteLock(async () => {
    const seeds = await readSeedsFile();
    const index = seeds.findIndex((seed) => seed.id === seedId);

    if (index === -1) return false;

    const prev = seeds[index].explorations;
    const next = prev.filter((e) => e.id !== explorationId);

    if (next.length === prev.length) return false;

    seeds[index] = { ...seeds[index], explorations: next };
    await writeSeedsFile(seeds);
    seedsCache = seeds;
    return true;
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

export async function updateSeedShare(id: string, shareId: string | null): Promise<Seed | null> {
  return withWriteLock(async () => {
    const seeds = await readSeedsFile();
    const index = seeds.findIndex((seed) => seed.id === id);

    if (index === -1) return null;

    const updated = { ...seeds[index] };
    if (shareId === null) {
      delete updated.shareId;
    } else {
      updated.shareId = shareId;
    }

    seeds[index] = updated;
    await writeSeedsFile(seeds);
    seedsCache = seeds;
    return updated;
  });
}

export async function updateSeedStatus(id: string, status: SeedStatus): Promise<Seed | null> {
  return withWriteLock(async () => {
    const seeds = await readSeedsFile();
    const index = seeds.findIndex((seed) => seed.id === id);

    if (index === -1) return null;

    const updated = { ...seeds[index], status };
    seeds[index] = updated;
    await writeSeedsFile(seeds);
    seedsCache = seeds;
    return updated;
  });
}

export async function getSeedByShareId(shareId: string): Promise<Seed | null> {
  const seeds = await getSeeds();
  return seeds.find((seed) => seed.shareId === shareId) ?? null;
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
  const status = normalizeSeedStatus(record.status);
  const validScenes = new Set<SceneType>(["indie-tool", "mobile", "chrome-extension", "ai-app"]);
  const scene = typeof record.scene === "string" && validScenes.has(record.scene as SceneType) ? (record.scene as SceneType) : undefined;
  const explorations = normalizeExplorations(record.explorations);
  const shareId = typeof record.shareId === "string" && record.shareId.trim() ? record.shareId : undefined;
  const parentId = typeof record.parentId === "string" && record.parentId.trim() ? record.parentId : undefined;
  const evolutionNote = typeof record.evolutionNote === "string" && record.evolutionNote.trim() ? record.evolutionNote : undefined;
  const generation = typeof record.generation === "number" && Number.isFinite(record.generation) ? record.generation : 0;
  const sourceSeeds = Array.isArray(record.sourceSeeds) ? record.sourceSeeds.filter((s): s is string => typeof s === "string" && s.trim().length > 0) : undefined;
  const combinationNote = typeof record.combinationNote === "string" && record.combinationNote.trim() ? record.combinationNote : undefined;

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
    scene,
    sourceVibe,
    createdAt,
    score: Math.max(1, Math.min(100, Math.round(score))),
    status,
    explorations,
    generation,
    ...(shareId ? { shareId } : {}),
    ...(parentId ? { parentId } : {}),
    ...(evolutionNote ? { evolutionNote } : {}),
    ...(sourceSeeds && sourceSeeds.length > 0 ? { sourceSeeds } : {}),
    ...(combinationNote ? { combinationNote } : {})
  };
}

function normalizeSeedStatus(value: unknown): SeedStatus {
  return typeof value === "string" && seedStatusValues.includes(value as SeedStatus) ? (value as SeedStatus) : "draft";
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

const validDimensions = new Set(["mvp", "tech", "competitor", "validation", "custom"]);

function normalizeExplorations(value: unknown): Exploration[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is Exploration => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return false;
    const r = item as Record<string, unknown>;
    return (
      typeof r.id === "string" &&
      typeof r.dimension === "string" &&
      validDimensions.has(r.dimension) &&
      typeof r.prompt === "string" &&
      typeof r.response === "string" &&
      typeof r.createdAt === "string"
    );
  });
}
