import cors from "cors";
import express from "express";
import type { CreateSeedInput, ExplorationDimension } from "@vibe-seeds/shared";
import { validateAiConfigOnStartup } from "./config/env.js";
import { buildExplorationMeta, generateExploration, streamExplorationContent } from "./services/explorationService.js";
import { isAiGenerationError, createSeed } from "./services/seedService.js";
import { addSeed, appendExploration, deleteSeed, getSeedById, getSeeds, removeExploration } from "./store.js";

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
    const body = request.body as Partial<CreateSeedInput>;
    const vibe = typeof body.vibe === "string" ? body.vibe.trim() : "";

    if (vibe.length < 2) {
      response.status(400).json({ message: "请先输入至少 2 个字符的 vibe 描述。" });
      return;
    }

    if (vibe.length > 500) {
      response.status(400).json({ message: "Vibe 描述不能超过 500 个字符。" });
      return;
    }

    const seed = await createSeed(vibe);
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

const validDimensions = new Set<ExplorationDimension>(["mvp", "tech", "competitor", "validation", "custom"]);

app.post("/api/seeds/:id/explore", async (request, response, next) => {
  try {
    const seed = await getSeedById(request.params.id);

    if (!seed) {
      response.status(404).json({ message: "Seed not found" });
      return;
    }

    const body = request.body as { dimension?: unknown; customPrompt?: unknown };
    const dimension = body.dimension;

    if (typeof dimension !== "string" || !validDimensions.has(dimension as ExplorationDimension)) {
      response.status(400).json({ message: "dimension 参数无效，必须为 mvp、tech、competitor、validation 或 custom。" });
      return;
    }

    if (dimension === "custom") {
      const customPrompt = typeof body.customPrompt === "string" ? body.customPrompt.trim() : "";

      if (customPrompt.length < 2) {
        response.status(400).json({ message: "自定义追问内容至少需要 2 个字符。" });
        return;
      }

      if (customPrompt.length > 500) {
        response.status(400).json({ message: "自定义追问内容不能超过 500 个字符。" });
        return;
      }

      const exploration = await generateExploration(seed, "custom", customPrompt);
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

    const body = request.body as { dimension?: unknown; customPrompt?: unknown };
    const dimension = body.dimension;

    if (typeof dimension !== "string" || !validDimensions.has(dimension as ExplorationDimension)) {
      response.status(400).json({ message: "dimension 参数无效。" });
      return;
    }

    let customPrompt: string | undefined;

    if (dimension === "custom") {
      customPrompt = typeof body.customPrompt === "string" ? body.customPrompt.trim() : "";

      if (!customPrompt || customPrompt.length < 2) {
        response.status(400).json({ message: "自定义追问内容至少需要 2 个字符。" });
        return;
      }

      if (customPrompt.length > 500) {
        response.status(400).json({ message: "自定义追问内容不能超过 500 个字符。" });
        return;
      }
    }

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
