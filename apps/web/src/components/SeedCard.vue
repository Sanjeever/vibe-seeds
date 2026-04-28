<script setup lang="ts">
import { ref } from "vue";
import type { Seed } from "@vibe-seeds/shared";
import { formatSeedTime, normalizeScore } from "../utils/seeds";

defineProps<{
  seed: Seed;
}>();

const emit = defineEmits<{
  remove: [seedId: string];
}>();

const copied = ref(false);

async function copyPrompt(text: string) {
  await navigator.clipboard.writeText(text);
  copied.value = true;
  setTimeout(() => { copied.value = false; }, 2000);
}
</script>

<template>
  <article class="group border border-stone-200 bg-white p-8 transition hover:border-stone-900">
    <div class="flex items-start justify-between gap-4">
      <div class="flex-1">
        <p class="text-xs uppercase tracking-wider text-stone-400">{{ formatSeedTime(seed.createdAt) }}</p>
        <h3 class="font-display mt-3 text-2xl font-light text-stone-900">{{ seed.projectName }}</h3>
      </div>
      <button
        class="shrink-0 text-sm text-stone-400 underline decoration-stone-300 underline-offset-4 transition hover:text-stone-900 hover:decoration-stone-900"
        type="button"
        @click="emit('remove', seed.id)"
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
        <div class="h-full bg-stone-900 transition-all" :style="{ width: `${normalizeScore(seed.score)}%` }"></div>
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
        <div class="flex items-center justify-between gap-3">
          <h4 class="text-sm text-stone-500">后续 prompt</h4>
          <button
            class="text-xs text-stone-400 underline decoration-stone-300 underline-offset-4 transition hover:text-stone-900 hover:decoration-stone-900"
            type="button"
            @click="copyPrompt(seed.followUpPrompt)"
          >
            {{ copied ? "已复制" : "复制" }}
          </button>
        </div>
        <p class="mt-2 border border-stone-200 bg-stone-50 p-4 text-sm leading-relaxed text-stone-700">
          {{ seed.followUpPrompt }}
        </p>
      </section>
    </div>

    <div class="mt-6 flex flex-wrap gap-2">
      <span v-for="tag in seed.tags" :key="tag" class="text-xs text-stone-500"> #{{ tag }} </span>
    </div>
  </article>
</template>
