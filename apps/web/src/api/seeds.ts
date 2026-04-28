import type { Seed } from "@vibe-seeds/shared";

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

export async function createSeed(vibe: string) {
  const response = await fetch("/api/seeds", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ vibe })
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "生成 seed 失败"));
  }

  return (await response.json()) as Seed;
}

export async function deleteSeed(seedId: string) {
  const response = await fetch(`/api/seeds/${seedId}`, {
    method: "DELETE"
  });

  if (!response.ok && response.status !== 404) {
    throw new Error("删除 seed 失败");
  }
}
