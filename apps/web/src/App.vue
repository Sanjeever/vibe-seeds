<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import type { Seed } from "@vibe-seeds/shared";
import { createSeed as createSeedRequest, deleteSeed, fetchSeeds } from "./api/seeds";
import SeedCard from "./components/SeedCard.vue";
import { examplePrompts } from "./constants/example-prompts";
import { sortSeeds, type SeedSortMode } from "./utils/seeds";

const vibe = ref("");
const seeds = ref<Seed[]>([]);
const isLoading = ref(false);
const isCreating = ref(false);
const errorMessage = ref("");
const sortMode = ref<SeedSortMode>("createdAt");

const canSubmit = computed(() => vibe.value.trim().length >= 2 && !isCreating.value);
const sortedSeeds = computed(() => sortSeeds(seeds.value, sortMode.value));

onMounted(() => {
  void loadSeeds();
});

async function loadSeeds() {
  isLoading.value = true;
  errorMessage.value = "";

  try {
    seeds.value = await fetchSeeds();
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
    const seed = await createSeedRequest(text);
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
    await deleteSeed(seedId);
  } catch (error) {
    seeds.value = previousSeeds;
    errorMessage.value = error instanceof Error ? error.message : "删除 seed 失败";
  }
}

function setExamplePrompt(prompt: string) {
  vibe.value = prompt;
}
</script>

<template>
  <main class="min-h-screen bg-[#fafaf9] text-stone-900">
    <section class="relative mx-auto flex w-full max-w-5xl flex-col gap-16 px-6 py-16 sm:px-8 lg:px-12">
      <header class="border-b border-stone-200 pb-12">
        <div class="max-w-2xl">
          <h1 class="font-display text-6xl font-light tracking-tight text-stone-900 sm:text-7xl">Vibe Seeds</h1>
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
            <h2 class="font-display text-2xl font-light text-stone-900">Seeds</h2>
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
          <SeedCard
            v-for="seed in sortedSeeds"
            :key="seed.id"
            :seed="seed"
            @remove="removeSeed"
          />
        </div>
      </section>
    </section>
  </main>
</template>
