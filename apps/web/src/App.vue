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

function tagPillClass(index: number) {
  const classes = [
    "border-cyan-300/30 bg-cyan-300/10 text-cyan-100",
    "border-fuchsia-300/30 bg-fuchsia-300/10 text-fuchsia-100",
    "border-emerald-300/30 bg-emerald-300/10 text-emerald-100",
    "border-amber-300/30 bg-amber-300/10 text-amber-100",
    "border-violet-300/30 bg-violet-300/10 text-violet-100",
    "border-rose-300/30 bg-rose-300/10 text-rose-100"
  ];

  return classes[index % classes.length];
}
</script>

<template>
  <main class="min-h-screen overflow-hidden bg-[#07070b] text-slate-100">
    <div class="pointer-events-none fixed inset-0">
      <div class="absolute inset-0 bg-[linear-gradient(135deg,rgba(34,211,238,0.14),transparent_34%,rgba(244,114,182,0.1)_68%,rgba(16,185,129,0.1))]"></div>
      <div class="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[size:44px_44px] opacity-30"></div>
    </div>

    <section class="relative mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-8 sm:px-6 lg:px-8">
      <header class="grid gap-8 pt-6 sm:pt-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
        <div class="flex flex-col gap-5">
          <div class="inline-flex w-fit items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs font-medium uppercase text-cyan-100">
            AI Creative Lab
          </div>
          <div class="max-w-3xl">
            <h1 class="text-5xl font-black tracking-normal text-white sm:text-7xl">Vibe Seeds</h1>
            <p class="mt-4 max-w-2xl text-lg leading-8 text-slate-300 sm:text-xl">把模糊感觉变成可执行的小产品灵感</p>
          </div>
          <div class="grid max-w-2xl grid-cols-3 gap-3">
            <div class="rounded-lg border border-cyan-300/15 bg-cyan-300/5 p-3">
              <p class="text-xs text-slate-400">Mode</p>
              <p class="mt-1 text-sm font-semibold text-cyan-100">Idea Synthesis</p>
            </div>
            <div class="rounded-lg border border-fuchsia-300/15 bg-fuchsia-300/5 p-3">
              <p class="text-xs text-slate-400">Signal</p>
              <p class="mt-1 text-sm font-semibold text-fuchsia-100">Vibe Input</p>
            </div>
            <div class="rounded-lg border border-emerald-300/15 bg-emerald-300/5 p-3">
              <p class="text-xs text-slate-400">Output</p>
              <p class="mt-1 text-sm font-semibold text-emerald-100">Seed Card</p>
            </div>
          </div>
        </div>

        <div class="rounded-lg border border-white/10 bg-slate-950/70 p-5 shadow-glow backdrop-blur-xl">
          <div class="flex items-center justify-between gap-4">
            <p class="text-sm font-semibold text-white">Lab Console</p>
            <span class="rounded-full border border-emerald-300/30 bg-emerald-300/10 px-3 py-1 text-xs text-emerald-100">online</span>
          </div>
          <div class="mt-5 grid gap-3">
            <div class="h-2 rounded-full bg-gradient-to-r from-cyan-300 via-fuchsia-300 to-emerald-300"></div>
            <div class="grid grid-cols-6 gap-2">
              <span v-for="index in 18" :key="index" class="h-8 rounded border border-white/10 bg-white/[0.04]" :class="index % 4 === 0 ? 'bg-cyan-300/15' : index % 5 === 0 ? 'bg-fuchsia-300/15' : ''"></span>
            </div>
            <p class="rounded-lg border border-white/10 bg-black/25 p-3 text-sm leading-6 text-slate-300">
              输入一个模糊情绪、场景或产品直觉，实验室会把它拆解成可继续追问 AI 的产品种子。
            </p>
          </div>
        </div>
      </header>

      <form class="rounded-lg border border-white/10 bg-white/[0.06] p-4 shadow-glow backdrop-blur-xl sm:p-6" @submit.prevent="createSeed">
        <label class="sr-only" for="vibe-input">描述一个 vibe</label>
        <textarea
          id="vibe-input"
          v-model="vibe"
          class="min-h-40 w-full resize-y rounded-lg border border-white/10 bg-black/30 px-5 py-4 text-base leading-7 text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-300/70 focus:ring-4 focus:ring-cyan-300/10"
          placeholder="描述一个 vibe，比如：我想做一个适合雨天独处的创作工具"
        ></textarea>

        <div class="mt-4 flex flex-wrap gap-2">
          <button
            v-for="prompt in examplePrompts"
            :key="prompt"
            class="rounded-full border border-white/10 bg-black/20 px-3 py-2 text-left text-xs leading-5 text-slate-300 transition hover:-translate-y-0.5 hover:border-cyan-300/50 hover:bg-cyan-300/10 hover:text-cyan-100"
            type="button"
            @click="setExamplePrompt(prompt)"
          >
            {{ prompt }}
          </button>
        </div>

        <div class="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p class="min-h-6 text-sm text-rose-200">{{ errorMessage }}</p>
          <button
            class="inline-flex h-12 items-center justify-center rounded-full bg-cyan-300 px-6 text-sm font-bold text-slate-950 shadow-lg shadow-cyan-950/40 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:bg-slate-600 disabled:text-slate-300"
            type="submit"
            :disabled="!canSubmit"
          >
            {{ isCreating ? "AI 正在孵化灵感..." : "调用 AI 生成灵感种子" }}
          </button>
        </div>
      </form>

      <section class="pb-12">
        <div class="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 class="text-2xl font-bold text-white">Seeds</h2>
            <p class="mt-1 text-sm text-slate-400">{{ seeds.length }} 个灵感种子正在孵化</p>
          </div>
          <div class="flex flex-wrap items-center gap-2">
            <div class="flex rounded-full border border-white/10 bg-black/20 p-1">
              <button
                class="rounded-full px-4 py-2 text-sm transition"
                :class="sortMode === 'createdAt' ? 'bg-cyan-300 text-slate-950' : 'text-slate-300 hover:text-cyan-100'"
                type="button"
                @click="sortMode = 'createdAt'"
              >
                最新
              </button>
              <button
                class="rounded-full px-4 py-2 text-sm transition"
                :class="sortMode === 'score' ? 'bg-fuchsia-300 text-slate-950' : 'text-slate-300 hover:text-fuchsia-100'"
                type="button"
                @click="sortMode = 'score'"
              >
                强度
              </button>
            </div>
            <button
              class="rounded-full border border-white/10 px-4 py-2 text-sm text-slate-300 transition hover:border-cyan-300/40 hover:text-cyan-100"
              type="button"
              @click="loadSeeds"
            >
              刷新
            </button>
          </div>
        </div>

        <div v-if="isLoading" class="rounded-lg border border-white/10 bg-white/[0.05] p-8 text-center text-slate-300">
          正在同步灵感场...
        </div>

        <div v-else-if="seeds.length === 0" class="rounded-lg border border-dashed border-white/15 bg-white/[0.04] p-5 text-slate-300 sm:p-8">
          <div class="mx-auto max-w-3xl text-center">
            <p class="text-lg font-semibold text-white">实验台还没有 seed</p>
            <p class="mt-2 text-sm leading-6 text-slate-400">可以从下面 3 个示例开始，或直接输入自己的模糊想法。</p>
          </div>
          <div class="mt-6 grid gap-3 md:grid-cols-3">
            <button
              v-for="prompt in examplePrompts.slice(0, 3)"
              :key="prompt"
              class="rounded-lg border border-white/10 bg-slate-950/60 p-4 text-left text-sm leading-6 text-slate-300 transition hover:-translate-y-1 hover:border-cyan-300/40 hover:bg-cyan-300/10 hover:text-cyan-50"
              type="button"
              @click="setExamplePrompt(prompt)"
            >
              {{ prompt }}
            </button>
          </div>
        </div>

        <div v-else class="grid gap-5 lg:grid-cols-2">
          <article
            v-for="seed in sortedSeeds"
            :key="seed.id"
            class="group rounded-lg border border-white/10 bg-slate-950/70 p-5 shadow-2xl shadow-black/25 backdrop-blur transition duration-300 hover:-translate-y-1 hover:border-cyan-300/40 hover:bg-slate-950/90 hover:shadow-[0_26px_80px_rgba(34,211,238,0.16)] sm:p-6"
          >
            <div class="flex items-start justify-between gap-4">
              <div>
                <p class="text-xs uppercase text-cyan-200/80">{{ formatTime(seed.createdAt) }}</p>
                <div class="mt-2 flex flex-wrap items-center gap-2">
                  <h3 class="text-2xl font-black text-white transition group-hover:text-cyan-50">{{ seed.projectName }}</h3>
                  <span
                    v-if="seed.source"
                    class="rounded-full border px-2.5 py-1 text-xs"
                    :class="seed.source === 'ai' ? 'border-cyan-300/30 bg-cyan-300/10 text-cyan-100' : 'border-amber-300/30 bg-amber-300/10 text-amber-100'"
                  >
                    {{ seed.source === "ai" ? "AI 生成" : "本地兜底" }}
                  </span>
                </div>
              </div>
              <button
                class="shrink-0 rounded-full border border-white/10 px-3 py-1.5 text-sm text-slate-400 transition hover:border-rose-300/50 hover:text-rose-200"
                type="button"
                @click="removeSeed(seed.id)"
              >
                删除
              </button>
            </div>

            <p class="mt-4 rounded-lg border border-cyan-300/10 bg-cyan-300/5 p-4 text-sm leading-7 text-slate-200">
              {{ seed.concept }}
            </p>

            <section class="mt-4">
              <div class="mb-2 flex items-center justify-between gap-3">
                <h4 class="text-sm font-semibold text-cyan-100">灵感强度</h4>
                <span class="font-mono text-lg font-bold text-white">{{ normalizeScore(seed.score) }}</span>
              </div>
              <div class="h-3 overflow-hidden rounded-full border border-white/10 bg-black/35">
                <div
                  class="h-full rounded-full bg-gradient-to-r from-cyan-300 via-fuchsia-300 to-emerald-300 shadow-[0_0_24px_rgba(34,211,238,0.35)] transition-all"
                  :style="{ width: `${normalizeScore(seed.score)}%` }"
                ></div>
              </div>
            </section>

            <div class="mt-5 grid gap-4">
              <section>
                <h4 class="text-sm font-semibold text-cyan-100">目标用户</h4>
                <p class="mt-2 text-sm leading-6 text-slate-300">{{ seed.targetUsers }}</p>
              </section>

              <section>
                <h4 class="text-sm font-semibold text-cyan-100">核心功能</h4>
                <ul class="mt-2 space-y-2 text-sm leading-6 text-slate-300">
                  <li v-for="feature in seed.coreFeatures" :key="feature" class="flex gap-2">
                    <span class="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-fuchsia-300"></span>
                    <span>{{ feature }}</span>
                  </li>
                </ul>
              </section>

              <section>
                <h4 class="text-sm font-semibold text-cyan-100">技术方向</h4>
                <ul class="mt-2 flex flex-wrap gap-2">
                  <li
                    v-for="tech in seed.techDirection"
                    :key="tech"
                    class="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1 text-xs leading-5 text-emerald-100"
                  >
                    {{ tech }}
                  </li>
                </ul>
              </section>

              <section>
                <h4 class="text-sm font-semibold text-cyan-100">后续 prompt</h4>
                <p class="mt-2 rounded-lg bg-black/25 p-4 text-sm leading-7 text-slate-300">{{ seed.followUpPrompt }}</p>
              </section>
            </div>

            <div class="mt-5 flex flex-wrap gap-2">
              <span
                v-for="(tag, index) in seed.tags"
                :key="tag"
                class="rounded-full border px-3 py-1 text-xs shadow-sm"
                :class="tagPillClass(index)"
              >
                # {{ tag }}
              </span>
            </div>
          </article>
        </div>
      </section>
    </section>
  </main>
</template>
