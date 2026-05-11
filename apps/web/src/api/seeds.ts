import type { Exploration, ExplorationDimension, Seed, SceneType } from "@vibe-seeds/shared";

interface ErrorPayload {
  message?: string;
}

async function readErrorMessage(response: Response, fallbackMessage: string) {
  const payload = (await response.json().catch(() => null)) as ErrorPayload | null;
  return payload?.message ?? fallbackMessage;
}

export async function fetchSeeds() {
  const response = await fetch("/api/seeds");

  if (!response.ok) {
    throw new Error("加载 seed 失败");
  }

  return (await response.json()) as Seed[];
}

export async function createSeed(vibe: string, scene?: SceneType) {
  const response = await fetch("/api/seeds", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ vibe, scene })
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "生成 seed 失败"));
  }

  return (await response.json()) as Seed;
}

export async function exploreSeed(seedId: string, dimension: ExplorationDimension, customPrompt?: string) {
  const response = await fetch(`/api/seeds/${seedId}/explore`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ dimension, customPrompt })
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "探索生成失败"));
  }

  return (await response.json()) as Exploration;
}

export type StreamEvent =
  | { type: "init"; id: string; dimension: ExplorationDimension; prompt: string; createdAt: string }
  | { type: "chunk"; content: string }
  | { type: "done" }
  | { type: "error"; message: string };

export async function* streamExploreSeed(
  seedId: string,
  dimension: ExplorationDimension,
  customPrompt?: string,
  signal?: AbortSignal
): AsyncGenerator<StreamEvent> {
  const response = await fetch(`/api/seeds/${seedId}/explore/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dimension, customPrompt }),
    signal
  });

  if (!response.ok || !response.body) {
    throw new Error(await readErrorMessage(response, "探索生成失败"));
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data: ")) continue;

        try {
          yield JSON.parse(trimmed.slice(6)) as StreamEvent;
        } catch {
          // skip malformed SSE lines
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

export async function deleteExploration(seedId: string, explorationId: string) {
  const response = await fetch(`/api/seeds/${seedId}/explorations/${explorationId}`, {
    method: "DELETE"
  });

  if (!response.ok && response.status !== 404) {
    throw new Error("删除探索失败");
  }
}

export async function deleteSeed(seedId: string) {
  const response = await fetch(`/api/seeds/${seedId}`, {
    method: "DELETE"
  });

  if (!response.ok && response.status !== 404) {
    throw new Error("删除 seed 失败");
  }
}

export async function enableShare(seedId: string) {
  const response = await fetch(`/api/seeds/${seedId}/share`, { method: "POST" });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "开启分享失败"));
  }

  return (await response.json()) as Seed;
}

export async function disableShare(seedId: string) {
  const response = await fetch(`/api/seeds/${seedId}/share`, { method: "DELETE" });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "关闭分享失败"));
  }

  return (await response.json()) as Seed;
}

export async function fetchSharedSeed(shareId: string) {
  const response = await fetch(`/api/share/${shareId}`);

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "分享链接不存在或已关闭"));
  }

  return (await response.json()) as Omit<Seed, "explorations">;
}

export async function evolveSeed(seedId: string, evolutionNote: string) {
  const response = await fetch(`/api/seeds/${seedId}/evolve`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ evolutionNote })
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "演化生成失败"));
  }

  return (await response.json()) as Seed;
}

export async function combineSeeds(seedIds: string[], userIntent?: string) {
  const response = await fetch("/api/seeds/combine", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ seedIds, userIntent })
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "组合生成失败"));
  }

  return (await response.json()) as Seed;
}
