import cors from "cors";
import express from "express";
import type { CreateSeedInput } from "@vibe-seeds/shared";
import { validateAiConfigOnStartup } from "./config/env.js";
import { createSeed, isAiGenerationError } from "./services/seedService.js";
import { addSeed, deleteSeed, getSeeds } from "./store.js";

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

app.listen(port, () => {
  console.log(`Vibe Seeds API is running at http://localhost:${port}`);
});
