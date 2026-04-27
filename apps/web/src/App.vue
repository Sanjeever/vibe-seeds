<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import type { Seed } from "@vibe-seeds/shared";

const vibe = ref("");
const seeds = ref<Seed[]>([]);
const isLoading = ref(false);
const isCreating = ref(false);
const errorMessage = ref("");
const sortMode = ref<"createdAt" | "score">("createdAt");

const examplePrompts = [
  "我想做一个适合雨天独处的创作工具",
  "我想做一个低压力、适合周末复盘的个人效率工具",
  "我想做一个有点赛博感的 AI 灵感看板",
  "我想做一个帮助设计师整理碎片灵感的轻量工具",
  "我想做一个让学习计划更治愈、更有仪式感的小应用"
];

const canSubmit = computed(() => vibe.value.trim().length >= 2 && !isCreating.value);
const sortedSeeds = computed(() => {
  return [...seeds.value].sort((left, right) => {
    if (sortMode.value === "score") {
      return normalizeScore(right.score) - normalizeScore(left.score);
    }

    return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
  });
});

onMounted(() => {
  void loadSeeds();
});

async function loadSeeds() {
  isLoading.value = true;
  errorMessage.value = "";

  try {
    const response = await fetch("/api/seeds");
    if (!response.ok) {
      throw new Error("加载 seed 失败");
    }

    seeds.value = await response.json();
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "加载 seed 失败";
  } finally {
    isLoading.value = false;
  }
}

async function createSeed() {
  const text = vibe.value.trim();

  if (!text) {
    return;
  }

  isCreating.value = true;
  errorMessage.value = "";

  try {
    const response = await fetch("/api/seeds", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ vibe: text })
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { message?: string } | null;
      throw new Error(payload?.message ?? "生成 seed 失败");
    }

    const seed = (await response.json()) as Seed;
    seeds.value = [seed, ...seeds.value.filter((item) => item.id !== seed.id)];
    vibe.value = "";
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "生成 seed 失败";
  } finally {
    isCreating.value = false;
  }
}

async function removeSeed(seedId: string) {
  const previousSeeds = seeds.value;
  seeds.value = seeds.value.filter((seed) => seed.id !== seedId);
  errorMessage.value = "";

  try {
    const response = await fetch(`/api/seeds/${seedId}`, {
      method: "DELETE"
    });

    if (!response.ok && response.status !== 404) {
      throw new Error("删除 seed 失败");
    }
  } catch (error) {
    seeds.value = previousSeeds;
    errorMessage.value = error instanceof Error ? error.message : "删除 seed 失败";
  }
}

function setExamplePrompt(prompt: string) {
  vibe.value = prompt;
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function normalizeScore(score: number) {
  return Math.max(1, Math.min(100, Math.round(score)));
}

</script>

<template>
  <main class="min-h-screen bg-[#fafaf9] text-stone-900">
    <section class="relative mx-auto flex w-full max-w-5xl flex-col gap-16 px-6 py-16 sm:px-8 lg:px-12">
      <header class="border-b border-stone-200 pb-12">
        <div class="max-w-2xl">
          <h1 class="text-6xl font-light tracking-tight text-stone-900 sm:text-7xl" style="font-family: 'Crimson Pro', Georgia, serif">Vibe Seeds</h1>
          <p class="mt-6 text-xl leading-relaxed text-stone-600">把模糊感觉变成可执行的小产品灵感</p>
        </div>
      </header>

      <form class="border-b border-stone-200 pb-12" @submit.prevent="createSeed">
        <label class="sr-only" for="vibe-input">描述一个 vibe</label>
        <textarea
          id="vibe-input"
          v-model="vibe"
          class="min-h-32 w-full resize-y border-0 border-b border-stone-300 bg-transparent px-0 py-4 text-lg leading-relaxed text-stone-900 outline-none transition placeholder:text-stone-400 focus:border-stone-900"
          placeholder="描述一个想法"
        ></textarea>

        <div class="mt-6 flex flex-wrap gap-3">
          <button
            v-for="prompt in examplePrompts"
            :key="prompt"
            class="text-left text-sm text-stone-500 underline decoration-stone-300 underline-offset-4 transition hover:text-stone-900 hover:decoration-stone-900"
            type="button"
            @click="setExamplePrompt(prompt)"
          >
            {{ prompt }}
          </button>
        </div>

        <div class="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p class="min-h-6 text-sm text-red-800">{{ errorMessage }}</p>
          <button
            class="inline-flex h-11 items-center justify-center border border-stone-900 bg-stone-900 px-8 text-sm text-stone-50 transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:border-stone-300 disabled:bg-stone-200 disabled:text-stone-500"
            type="submit"
            :disabled="!canSubmit"
          >
            {{ isCreating ? "生成中..." : "生成" }}
          </button>
        </div>
      </form>

      <section class="pb-16">
        <div class="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 class="text-2xl font-light text-stone-900" style="font-family: 'Crimson Pro', Georgia, serif">Seeds</h2>
            <p class="mt-1 text-sm text-stone-500">{{ seeds.length }} 个灵感</p>
          </div>
          <div class="flex flex-wrap items-center gap-3">
            <div class="flex border border-stone-300">
              <button
                class="px-4 py-2 text-sm transition"
                :class="sortMode === 'createdAt' ? 'bg-stone-900 text-stone-50' : 'text-stone-600 hover:text-stone-900'"
                type="button"
                @click="sortMode = 'createdAt'"
              >
                最新
              </button>
              <button
                class="border-l border-stone-300 px-4 py-2 text-sm transition"
                :class="sortMode === 'score' ? 'bg-stone-900 text-stone-50' : 'text-stone-600 hover:text-stone-900'"
                type="button"
                @click="sortMode = 'score'"
              >
                强度
              </button>
            </div>
            <button
              class="border border-stone-300 px-4 py-2 text-sm text-stone-600 transition hover:border-stone-900 hover:text-stone-900"
              type="button"
              @click="loadSeeds"
            >
              刷新
            </button>
          </div>
        </div>

        <div v-if="isLoading" class="border border-stone-200 bg-stone-50 p-12 text-center text-stone-600">
          加载中...
        </div>

        <div v-else-if="seeds.length === 0" class="border border-dashed border-stone-300 bg-stone-50/50 p-12 text-stone-600">
          <div class="mx-auto max-w-xl text-center">
            <p class="text-lg text-stone-900">还没有 seed</p>
            <p class="mt-2 text-sm leading-relaxed text-stone-500">输入一个想法开始</p>
          </div>
        </div>

        <div v-else class="grid gap-8 lg:grid-cols-2">
          <article
            v-for="seed in sortedSeeds"
            :key="seed.id"
            class="group border border-stone-200 bg-white p-8 transition hover:border-stone-900"
          >
            <div class="flex items-start justify-between gap-4">
              <div class="flex-1">
                <p class="text-xs uppercase tracking-wider text-stone-400">{{ formatTime(seed.createdAt) }}</p>
                <h3 class="mt-3 text-2xl font-light text-stone-900" style="font-family: 'Crimson Pro', Georgia, serif">{{ seed.projectName }}</h3>
              </div>
              <button
                class="shrink-0 text-sm text-stone-400 underline decoration-stone-300 underline-offset-4 transition hover:text-stone-900 hover:decoration-stone-900"
                type="button"
                @click="removeSeed(seed.id)"
              >
                删除
              </button>
            </div>

            <p class="mt-6 border-l-2 border-stone-900 pl-4 text-base leading-relaxed text-stone-700">
              {{ seed.concept }}
            </p>

            <section class="mt-6">
              <div class="mb-2 flex items-center justify-between gap-3">
                <h4 class="text-sm text-stone-500">灵感强度</h4>
                <span class="font-mono text-sm text-stone-900">{{ normalizeScore(seed.score) }}</span>
              </div>
              <div class="h-1 bg-stone-200">
                <div
                  class="h-full bg-stone-900 transition-all"
                  :style="{ width: `${normalizeScore(seed.score)}%` }"
                ></div>
              </div>
            </section>

            <div class="mt-8 grid gap-6">
              <section>
                <h4 class="text-sm text-stone-500">目标用户</h4>
                <p class="mt-2 text-sm leading-relaxed text-stone-700">{{ seed.targetUsers }}</p>
              </section>

              <section>
                <h4 class="text-sm text-stone-500">核心功能</h4>
                <ul class="mt-2 space-y-1.5 text-sm leading-relaxed text-stone-700">
                  <li v-for="feature in seed.coreFeatures" :key="feature" class="flex gap-2">
                    <span class="mt-2 h-1 w-1 shrink-0 bg-stone-900"></span>
                    <span>{{ feature }}</span>
                  </li>
                </ul>
              </section>

              <section>
                <h4 class="text-sm text-stone-500">技术方向</h4>
                <ul class="mt-2 flex flex-wrap gap-2">
                  <li
                    v-for="tech in seed.techDirection"
                    :key="tech"
                    class="border border-stone-300 bg-stone-50 px-3 py-1 text-xs text-stone-700"
                  >
                    {{ tech }}
                  </li>
                </ul>
              </section>

              <section>
                <h4 class="text-sm text-stone-500">后续 prompt</h4>
                <p class="mt-2 border border-stone-200 bg-stone-50 p-4 text-sm leading-relaxed text-stone-700">{{ seed.followUpPrompt }}</p>
              </section>
            </div>

            <div class="mt-6 flex flex-wrap gap-2">
              <span
                v-for="tag in seed.tags"
                :key="tag"
                class="text-xs text-stone-500"
              >
                #{{ tag }}
              </span>
            </div>
          </article>
        </div>
      </section>
    </section>
  </main>
</template>
