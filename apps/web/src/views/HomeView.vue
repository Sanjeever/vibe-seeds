<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import type { Exploration, Seed, SceneType } from "@vibe-seeds/shared";
import { createSeed as createSeedRequest, deleteSeed, fetchSeeds } from "../api/seeds";
import ExploreDrawer from "../components/ExploreDrawer.vue";
import SeedCard from "../components/SeedCard.vue";
import { getExamplePrompts } from "../constants/example-prompts";
import { sortSeeds, type SeedSortMode } from "../utils/seeds";

const vibe = ref("");
const seeds = ref<Seed[]>([]);
const isLoading = ref(false);
const isCreating = ref(false);
const errorMessage = ref("");
const sortMode = ref<SeedSortMode>("createdAt");
const searchQuery = ref("");
const selectedTags = ref<string[]>([]);
const selectedScene = ref<SceneType | undefined>(undefined);

const scenes: { type: SceneType; label: string; icon: string }[] = [
  { type: "indie-tool", label: "独立开发者工具", icon: "🛠" },
  { type: "mobile", label: "移动端小产品", icon: "📱" },
  { type: "chrome-extension", label: "Chrome 插件", icon: "🌐" },
  { type: "ai-app", label: "AI 应用", icon: "💬" }
];

const examplePrompts = computed(() => getExamplePrompts(selectedScene.value));

const canSubmit = computed(() => vibe.value.trim().length >= 2 && !isCreating.value);
const sortedSeeds = computed(() => sortSeeds(seeds.value, sortMode.value));

const allTags = computed(() => {
  const counts = new Map<string, number>();
  for (const seed of seeds.value) {
    for (const tag of seed.tags) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([tag, count]) => ({ tag, count }));
});

const filteredSeeds = computed(() => {
  let result = sortedSeeds.value;

  const q = searchQuery.value.trim().toLowerCase();
  if (q) {
    result = result.filter(
      (seed) =>
        seed.projectName.toLowerCase().includes(q) ||
        seed.concept.toLowerCase().includes(q) ||
        seed.tags.some((tag) => tag.includes(q)),
    );
  }

  if (selectedTags.value.length > 0) {
    result = result.filter((seed) => selectedTags.value.some((tag) => seed.tags.includes(tag)));
  }

  return result;
});

const isFiltered = computed(() => searchQuery.value.trim() !== "" || selectedTags.value.length > 0);

function toggleTag(tag: string) {
  const idx = selectedTags.value.indexOf(tag);
  if (idx === -1) {
    selectedTags.value.push(tag);
  } else {
    selectedTags.value.splice(idx, 1);
  }
}

function clearFilters() {
  searchQuery.value = "";
  selectedTags.value = [];
}

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
    const seed = await createSeedRequest(text, selectedScene.value);
    seeds.value.unshift(seed);
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

function toggleScene(scene: SceneType) {
  selectedScene.value = selectedScene.value === scene ? undefined : scene;
  vibe.value = "";
}

function setExamplePrompt(prompt: string) {
  vibe.value = prompt;
}

const selectedSeed = ref<Seed | null>(null);

function handleExplore(seed: Seed) {
  selectedSeed.value = seed;
}

function handleDrawerClose() {
  selectedSeed.value = null;
}

function handleExplorationAdded(seedId: string, exploration: Exploration) {
  const target = seeds.value.find((s) => s.id === seedId);
  if (target) {
    target.explorations.push(exploration);
  }
}

function handleExplorationRemoved(seedId: string, explorationId: string) {
  const target = seeds.value.find((s) => s.id === seedId);
  if (target) {
    target.explorations = target.explorations.filter((e) => e.id !== explorationId);
  }
}

function handleShareUpdated(updatedSeed: Seed) {
  const index = seeds.value.findIndex((s) => s.id === updatedSeed.id);
  if (index !== -1) {
    seeds.value[index] = { ...seeds.value[index], shareId: updatedSeed.shareId };
  }
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
        <div class="mb-6">
          <p class="mb-3 text-sm text-stone-500">选择场景（可选）</p>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="scene in scenes"
              :key="scene.type"
              class="inline-flex items-center gap-1.5 border px-3 py-1.5 text-sm transition"
              :class="
                selectedScene === scene.type
                  ? 'border-stone-900 bg-stone-900 text-stone-50'
                  : 'border-stone-300 text-stone-600 hover:border-stone-600 hover:text-stone-900'
              "
              type="button"
              @click="toggleScene(scene.type)"
            >
              <span>{{ scene.icon }}</span>
              <span>{{ scene.label }}</span>
            </button>
          </div>
        </div>

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
            <p class="mt-1 text-sm text-stone-500">
              <template v-if="isFiltered">显示 {{ filteredSeeds.length }} / {{ seeds.length }} 个灵感</template>
              <template v-else>{{ seeds.length }} 个灵感</template>
            </p>
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

        <div v-if="seeds.length > 0" class="mb-8 space-y-4">
          <input
            v-model="searchQuery"
            class="w-full border-0 border-b border-stone-300 bg-transparent py-2.5 text-sm text-stone-900 outline-none transition placeholder:text-stone-400 focus:border-stone-900"
            placeholder="搜索项目名、想法、标签..."
            type="search"
          />
          <div v-if="allTags.length > 0" class="flex flex-wrap gap-2">
            <button
              v-for="{ tag, count } in allTags"
              :key="tag"
              class="border px-3 py-1 text-xs transition"
              :class="
                selectedTags.includes(tag)
                  ? 'border-stone-900 bg-stone-900 text-stone-50'
                  : 'border-stone-300 text-stone-600 hover:border-stone-600 hover:text-stone-900'
              "
              type="button"
              @click="toggleTag(tag)"
            >
              {{ tag }}
              <span :class="selectedTags.includes(tag) ? 'text-stone-300' : 'text-stone-400'">{{ count }}</span>
            </button>
            <button
              v-if="isFiltered"
              class="border border-dashed border-stone-300 px-3 py-1 text-xs text-stone-500 transition hover:border-stone-600 hover:text-stone-900"
              type="button"
              @click="clearFilters"
            >
              清除筛选
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

        <div v-else-if="filteredSeeds.length === 0" class="border border-dashed border-stone-300 bg-stone-50/50 p-12 text-stone-600">
          <div class="mx-auto max-w-xl text-center">
            <p class="text-lg text-stone-900">没有匹配的 seed</p>
            <p class="mt-2 text-sm leading-relaxed text-stone-500">
              <button class="underline decoration-stone-300 underline-offset-4 transition hover:text-stone-900 hover:decoration-stone-900" type="button" @click="clearFilters">清除筛选条件</button>
              重新浏览
            </p>
          </div>
        </div>

        <div v-else class="grid gap-8 lg:grid-cols-2">
          <SeedCard
            v-for="seed in filteredSeeds"
            :key="seed.id"
            :seed="seed"
            @remove="removeSeed"
            @explore="handleExplore"
            @share-updated="handleShareUpdated"
          />
        </div>
      </section>
    </section>
  </main>

  <ExploreDrawer
    :seed="selectedSeed"
    :is-open="selectedSeed !== null"
    @close="handleDrawerClose"
    @exploration-added="handleExplorationAdded"
    @exploration-removed="handleExplorationRemoved"
  />
</template>
