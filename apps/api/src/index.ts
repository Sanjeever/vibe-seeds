import cors from "cors";
import express from "express";
import { z } from "zod";
import type { ExplorationDimension, SceneType, Seed } from "@vibe-seeds/shared";
import { validateAiConfigOnStartup } from "./config/env.js";
import { buildExplorationMeta, generateExploration, streamExplorationContent } from "./services/explorationService.js";
import { isAiGenerationError, createSeed } from "./services/seedService.js";
import { evolveSeed } from "./services/evolutionService.js";
import { combineSeeds } from "./services/combinationService.js";
import { addSeed, appendExploration, deleteSeed, getSeedById, getSeedByShareId, getSeeds, removeExploration, updateSeedShare } from "./store.js";

const sceneValues = ["indie-tool", "mobile", "chrome-extension", "ai-app"] as const;
const dimensionValues = ["mvp", "tech", "competitor", "validation", "custom"] as const;

const createSeedSchema = z.object({
  vibe: z.string().trim().min(2, "请先输入至少 2 个字符的 vibe 描述。").max(500, "Vibe 描述不能超过 500 个字符。"),
  scene: z.enum(sceneValues).optional(),
});

const exploreSchema = z.object({
  dimension: z.enum(dimensionValues, { error: "dimension 参数无效，必须为 mvp、tech、competitor、validation 或 custom。" }),
  customPrompt: z.string().trim().min(2, "自定义追问内容至少需要 2 个字符。").max(500, "自定义追问内容不能超过 500 个字符。").optional(),
}).refine((d) => d.dimension !== "custom" || (!!d.customPrompt && d.customPrompt.length >= 2), {
  message: "自定义追问内容至少需要 2 个字符。",
  path: ["customPrompt"],
});

const evolveSchema = z.object({
  evolutionNote: z.string().trim().min(2, "演化说明至少需要 2 个字符。").max(500, "演化说明不能超过 500 个字符。"),
});

const combineSchema = z.object({
  seedIds: z.array(z.string()).min(2, "至少需要选择 2 个 seeds").max(3, "最多只能选择 3 个 seeds"),
  userIntent: z.string().trim().min(2, "侧重点至少需要 2 个字符。").max(500, "侧重点不能超过 500 个字符。").optional(),
});

const app = express();
const port = Number(process.env.PORT ?? 3001);

validateAiConfigOnStartup();

app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_request, response) => {
  response.json({
    ok: true,
    service: "vibe-seeds-api",
    timestamp: new Date().toISOString()
  });
});

app.get("/api/seeds", async (_request, response, next) => {
  try {
    const seeds = await getSeeds();
    response.json(seeds);
  } catch (error) {
    next(error);
  }
});

app.post("/api/seeds", async (request, response, next) => {
  try {
    const parsed = createSeedSchema.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({ message: parsed.error.issues[0].message });
      return;
    }
    const { vibe, scene } = parsed.data;
    const seed = await createSeed(vibe, scene as SceneType | undefined);
    const savedSeed = await addSeed(seed);
    response.status(201).json(savedSeed);
  } catch (error) {
    if (isAiGenerationError(error)) {
      response.status(502).json({ message: "AI 生成失败，请检查后端环境变量或稍后重试。" });
      return;
    }

    next(error);
  }
});

app.post("/api/seeds/:id/evolve", async (request, response, next) => {
  try {
    const parentSeed = await getSeedById(request.params.id);

    if (!parentSeed) {
      response.status(404).json({ message: "Seed not found" });
      return;
    }

    const parsed = evolveSchema.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({ message: parsed.error.issues[0].message });
      return;
    }

    const { evolutionNote } = parsed.data;
    const evolvedSeed = await evolveSeed(parentSeed, evolutionNote);
    const savedSeed = await addSeed(evolvedSeed);
    response.status(201).json(savedSeed);
  } catch (error) {
    if (isAiGenerationError(error)) {
      response.status(502).json({ message: "AI 生成失败，请检查后端环境变量或稍后重试。" });
      return;
    }

    next(error);
  }
});

app.post("/api/seeds/combine", async (request, response, next) => {
  try {
    const parsed = combineSchema.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({ message: parsed.error.issues[0].message });
      return;
    }

    const { seedIds, userIntent } = parsed.data;

    const seeds = await Promise.all(seedIds.map(id => getSeedById(id)));
    const notFound = seeds.findIndex(s => s === null);
    if (notFound !== -1) {
      response.status(404).json({ message: `Seed with id ${seedIds[notFound]} not found` });
      return;
    }

    const combinedSeed = await combineSeeds(seeds as Seed[], userIntent);
    const savedSeed = await addSeed(combinedSeed);
    response.status(201).json(savedSeed);
  } catch (error) {
    if (isAiGenerationError(error)) {
      response.status(502).json({ message: "AI 生成失败，请检查后端环境变量或稍后重试。" });
      return;
    }

    next(error);
  }
});


app.post("/api/seeds/:id/explore", async (request, response, next) => {
  try {
    const seed = await getSeedById(request.params.id);

    if (!seed) {
      response.status(404).json({ message: "Seed not found" });
      return;
    }

    const parsed = exploreSchema.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({ message: parsed.error.issues[0].message });
      return;
    }
    const { dimension, customPrompt } = parsed.data;

    if (dimension === "custom") {
      const exploration = await generateExploration(seed, "custom", customPrompt!);
      const updated = await appendExploration(seed.id, exploration);

      if (!updated) {
        response.status(404).json({ message: "Seed not found" });
        return;
      }

      response.status(201).json(exploration);
      return;
    }

    const exploration = await generateExploration(seed, dimension as ExplorationDimension);
    const updated = await appendExploration(seed.id, exploration);

    if (!updated) {
      response.status(404).json({ message: "Seed not found" });
      return;
    }

    response.status(201).json(exploration);
  } catch (error) {
    console.error(error);
    if (isAiGenerationError(error)) {
      response.status(502).json({ message: "AI 生成失败，请检查后端环境变量或稍后重试。" });
      return;
    }

    next(error);
  }
});

app.post("/api/seeds/:id/explore/stream", async (request, response, next) => {
  try {
    const seed = await getSeedById(request.params.id);

    if (!seed) {
      response.status(404).json({ message: "Seed not found" });
      return;
    }

    const parsed = exploreSchema.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({ message: parsed.error.issues[0].message });
      return;
    }
    const { dimension, customPrompt } = parsed.data;

    const meta = buildExplorationMeta(dimension as ExplorationDimension, customPrompt);

    response.setHeader("Content-Type", "text/event-stream");
    response.setHeader("Cache-Control", "no-cache");
    response.setHeader("Connection", "keep-alive");
    response.flushHeaders();

    const send = (data: object) => response.write(`data: ${JSON.stringify(data)}\n\n`);

    send({ type: "init", ...meta });

    const streamAbort = new AbortController();
    response.on("close", () => {
      console.log("[explore/stream] response close event fired, writableEnded =", response.writableEnded);
      streamAbort.abort();
    });

    let fullContent = "";
    let chunkCount = 0;
    let streamOk = false;

    console.log("[explore/stream] starting AI stream for seed", seed.id, "dimension", dimension);

    try {
      for await (const chunk of streamExplorationContent(seed, dimension as ExplorationDimension, customPrompt, streamAbort.signal)) {
        fullContent += chunk;
        chunkCount++;
        send({ type: "chunk", content: chunk });
      }
      console.log("[explore/stream] AI stream completed, chunks =", chunkCount, "contentLength =", fullContent.length);
      streamOk = true;
    } catch (streamError) {
      console.error("[explore/stream] stream error:", streamError instanceof Error ? streamError.message : streamError);
      if (!response.writableEnded) {
        send({ type: "error", message: "AI 生成失败，请稍后重试。" });
        response.end();

      }
      return;
    }

    if (streamOk) {
      console.log("[explore/stream] saving exploration to store...");
      try {
        const exploration = { ...meta, response: fullContent };
        await appendExploration(seed.id, exploration);
        console.log("[explore/stream] saved, sending done event");
        send({ type: "done" });
      } catch (saveError) {
        console.error("[explore/stream] save error:", saveError instanceof Error ? saveError.message : saveError);
        send({ type: "error", message: "保存探索记录失败，请稍后重试。" });
      }
    }

    console.log("[explore/stream] ending response");
    response.end();
  } catch (error) {
    if (!response.headersSent) {
      if (isAiGenerationError(error)) {
        response.status(502).json({ message: "AI 生成失败，请检查后端环境变量或稍后重试。" });
        return;
      }
      next(error);
    }
  }
});

app.delete("/api/seeds/:id/explorations/:explorationId", async (request, response, next) => {
  try {
    const deleted = await removeExploration(request.params.id, request.params.explorationId);

    if (!deleted) {
      response.status(404).json({ message: "Exploration not found" });
      return;
    }

    response.status(204).send();
  } catch (error) {
    next(error);
  }
});

app.post("/api/seeds/:id/share", async (request, response, next) => {
  try {
    const seed = await getSeedById(request.params.id);

    if (!seed) {
      response.status(404).json({ message: "Seed not found" });
      return;
    }

    const shareId = seed.shareId ?? crypto.randomUUID();
    const updated = await updateSeedShare(seed.id, shareId);
    response.json(updated);
  } catch (error) {
    next(error);
  }
});

app.delete("/api/seeds/:id/share", async (request, response, next) => {
  try {
    const seed = await getSeedById(request.params.id);

    if (!seed) {
      response.status(404).json({ message: "Seed not found" });
      return;
    }

    const updated = await updateSeedShare(seed.id, null);
    response.json(updated);
  } catch (error) {
    next(error);
  }
});

app.get("/api/share/:shareId", async (request, response, next) => {
  try {
    const seed = await getSeedByShareId(request.params.shareId);

    if (!seed) {
      response.status(404).json({ message: "分享链接不存在或已关闭" });
      return;
    }

    const { explorations: _e, ...publicSeed } = seed;
    response.json(publicSeed);
  } catch (error) {
    next(error);
  }
});

app.delete("/api/seeds/:id", async (request, response, next) => {
  try {
    const deleted = await deleteSeed(request.params.id);

    if (!deleted) {
      response.status(404).json({ message: "Seed not found" });
      return;
    }

    response.status(204).send();
  } catch (error) {
    next(error);
  }
});

app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
  console.error(error);
  response.status(500).json({
    message: "服务器暂时无法处理这个灵感，请稍后再试。"
  });
});

const server = app.listen(port, () => {
  console.log(`Vibe Seeds API is running at http://localhost:${port}`);
});

const shutdown = () => server.close(() => process.exit(0));
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
