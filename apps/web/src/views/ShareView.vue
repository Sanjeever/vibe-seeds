<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRoute } from "vue-router";
import type { Seed } from "@vibe-seeds/shared";
import { fetchSharedSeed } from "../api/seeds";
import { normalizeScore } from "../utils/seeds";

const route = useRoute();
const shareId = route.params.shareId as string;

const seed = ref<Omit<Seed, "explorations"> | null>(null);
const loading = ref(true);
const error = ref("");

onMounted(async () => {
  try {
    seed.value = await fetchSharedSeed(shareId);
  } catch (err) {
    error.value = err instanceof Error ? err.message : "加载失败";
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <main class="min-h-screen bg-[#fafaf9] text-stone-900">
    <section class="mx-auto w-full max-w-2xl px-6 py-16 sm:px-8">
      <header class="mb-12 flex items-center justify-between">
        <a href="/" class="font-display text-xl font-light text-stone-900 transition hover:text-stone-600">
          Vibe Seeds
        </a>
        <a
          href="/"
          class="border border-stone-300 px-4 py-1.5 text-xs text-stone-600 transition hover:border-stone-900 hover:text-stone-900"
        >
          生成我的灵感 →
        </a>
      </header>

      <div v-if="loading" class="border border-stone-200 bg-stone-50 p-12 text-center text-stone-500">
        加载中...
      </div>

      <div v-else-if="error" class="border border-stone-200 bg-stone-50 p-12 text-center">
        <p class="text-stone-900">{{ error }}</p>
        <p class="mt-2 text-sm text-stone-500">该分享链接可能已关闭或不存在</p>
      </div>

      <article v-else-if="seed" class="border border-stone-200 bg-white p-8">
        <div>
          <h1 class="font-display text-3xl font-light text-stone-900">{{ seed.projectName }}</h1>
        </div>

        <p class="mt-6 border-l-2 border-stone-900 pl-4 text-base leading-relaxed text-stone-700">
          {{ seed.concept }}
        </p>

        <section class="mt-6">
          <div class="mb-2 flex items-center justify-between gap-3">
            <h2 class="text-sm text-stone-500">灵感强度</h2>
            <span class="font-mono text-sm text-stone-900">{{ normalizeScore(seed.score) }}</span>
          </div>
          <div class="h-1 bg-stone-200">
            <div class="h-full bg-stone-900" :style="{ width: `${normalizeScore(seed.score)}%` }"></div>
          </div>
        </section>

        <div class="mt-8 grid gap-6">
          <section>
            <h2 class="text-sm text-stone-500">目标用户</h2>
            <p class="mt-2 text-sm leading-relaxed text-stone-700">{{ seed.targetUsers }}</p>
          </section>

          <section>
            <h2 class="text-sm text-stone-500">核心功能</h2>
            <ul class="mt-2 space-y-1.5 text-sm leading-relaxed text-stone-700">
              <li v-for="feature in seed.coreFeatures" :key="feature" class="flex gap-2">
                <span class="mt-2 h-1 w-1 shrink-0 bg-stone-900"></span>
                <span>{{ feature }}</span>
              </li>
            </ul>
          </section>

          <section>
            <h2 class="text-sm text-stone-500">技术方向</h2>
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
            <h2 class="text-sm text-stone-500">后续 prompt</h2>
            <p class="mt-2 border border-stone-200 bg-stone-50 p-4 text-sm leading-relaxed text-stone-700">
              {{ seed.followUpPrompt }}
            </p>
          </section>
        </div>

        <div class="mt-6 flex flex-wrap gap-2 border-t border-stone-100 pt-6">
          <span v-for="tag in seed.tags" :key="tag" class="text-xs text-stone-500">#{{ tag }}</span>
        </div>
      </article>
    </section>
  </main>
</template>
