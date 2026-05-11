<script setup lang="ts">
import { ref } from "vue";
import type { Seed } from "@vibe-seeds/shared";
import { disableShare, enableShare } from "../api/seeds";
import { exportAsPng } from "../utils/export";
import { seedToMarkdown } from "../utils/markdown";
import { formatSeedTime, normalizeScore } from "../utils/seeds";

const props = defineProps<{
  seed: Seed;
}>();

const emit = defineEmits<{
  remove: [seedId: string];
  explore: [seed: Seed];
  shareUpdated: [seed: Seed];
  evolve: [seed: Seed];
  compare: [seed: Seed];
}>();

const copied = ref(false);
const menuOpen = ref(false);
const mdCopied = ref(false);
const linkCopied = ref(false);
const sharingLoading = ref(false);
const exportLoading = ref(false);
const exportCardRef = ref<HTMLElement>();

async function copyPrompt(text: string) {
  await navigator.clipboard.writeText(text);
  copied.value = true;
  setTimeout(() => { copied.value = false; }, 2000);
}

function closeMenu() {
  menuOpen.value = false;
}

async function copyMarkdown() {
  closeMenu();
  await navigator.clipboard.writeText(seedToMarkdown(props.seed));
  mdCopied.value = true;
  setTimeout(() => { mdCopied.value = false; }, 2000);
}

async function handleShareToggle() {
  closeMenu();
  sharingLoading.value = true;
  try {
    const updated = props.seed.shareId
      ? await disableShare(props.seed.id)
      : await enableShare(props.seed.id);
    emit("shareUpdated", updated);
    if (updated.shareId) {
      await copyLink(updated.shareId);
    }
  } finally {
    sharingLoading.value = false;
  }
}

async function copyShareLink() {
  closeMenu();
  if (props.seed.shareId) {
    await copyLink(props.seed.shareId);
  }
}

async function copyLink(shareId: string) {
  await navigator.clipboard.writeText(`${window.location.origin}/share/${shareId}`);
  linkCopied.value = true;
  setTimeout(() => { linkCopied.value = false; }, 2000);
}

async function handleExport() {
  closeMenu();
  if (!exportCardRef.value) return;
  exportLoading.value = true;
  try {
    await exportAsPng(exportCardRef.value, `${props.seed.projectName}.png`);
  } finally {
    exportLoading.value = false;
  }
}
</script>

<template>
  <!-- 全屏透明遮罩，点击关闭菜单 -->
  <div v-if="menuOpen" class="fixed inset-0 z-10" @click="closeMenu" />

  <article class="group border border-stone-200 bg-white p-8 transition hover:border-stone-900">
    <div class="flex items-start justify-between gap-4">
      <div class="flex-1">
        <p class="text-xs uppercase tracking-wider text-stone-400">{{ formatSeedTime(seed.createdAt) }}</p>
        <h3 class="font-display mt-3 text-2xl font-light text-stone-900">{{ seed.projectName }}</h3>
      </div>

      <!-- ··· 菜单 -->
      <div class="relative z-20 shrink-0">
        <button
          class="flex h-8 w-8 items-center justify-center text-stone-400 transition hover:text-stone-900"
          type="button"
          :aria-label="menuOpen ? '关闭菜单' : '更多操作'"
          @click="menuOpen = !menuOpen"
        >
          <span class="text-lg leading-none tracking-widest">···</span>
        </button>

        <div
          v-if="menuOpen"
          class="absolute right-0 top-9 w-44 border border-stone-200 bg-white shadow-sm"
        >
          <!-- 复制 Markdown -->
          <button
            class="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm text-stone-700 transition hover:bg-stone-50"
            type="button"
            @click="copyMarkdown"
          >
            <span class="text-stone-400">Md</span>
            {{ mdCopied ? "已复制" : "复制 Markdown" }}
          </button>

          <!-- 演化 -->
          <button
            class="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm text-stone-700 transition hover:bg-stone-50"
            type="button"
            @click="closeMenu(); emit('evolve', seed)"
          >
            <span class="text-stone-400">🌱</span>
            演化此想法
          </button>

          <!-- 对比版本（仅演化版本显示） -->
          <button
            v-if="seed.parentId"
            class="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm text-stone-700 transition hover:bg-stone-50"
            type="button"
            @click="closeMenu(); emit('compare', seed)"
          >
            <span class="text-stone-400">⇄</span>
            对比父版本
          </button>

          <!-- 分享 -->
          <button
            class="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm text-stone-700 transition hover:bg-stone-50 disabled:cursor-not-allowed disabled:text-stone-400"
            type="button"
            :disabled="sharingLoading"
            @click="seed.shareId ? copyShareLink() : handleShareToggle()"
          >
            <span class="text-stone-400">↗</span>
            <span v-if="sharingLoading">处理中...</span>
            <span v-else-if="linkCopied">链接已复制</span>
            <span v-else-if="seed.shareId">复制分享链接</span>
            <span v-else>开启分享</span>
          </button>

          <!-- 关闭分享（仅分享已开启时显示） -->
          <button
            v-if="seed.shareId"
            class="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm text-stone-500 transition hover:bg-stone-50 disabled:cursor-not-allowed"
            type="button"
            :disabled="sharingLoading"
            @click="handleShareToggle"
          >
            <span class="text-stone-400">✕</span>
            关闭分享
          </button>

          <!-- 导出为图片 -->
          <button
            class="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm text-stone-700 transition hover:bg-stone-50 disabled:cursor-not-allowed disabled:text-stone-400"
            type="button"
            :disabled="exportLoading"
            @click="handleExport"
          >
            <span class="text-stone-400">⬇</span>
            {{ exportLoading ? "生成中..." : "导出为图片" }}
          </button>

          <div class="my-1 border-t border-stone-100" />

          <!-- 删除 -->
          <button
            class="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm text-red-600 transition hover:bg-red-50"
            type="button"
            @click="closeMenu(); emit('remove', seed.id)"
          >
            <span>删除</span>
          </button>
        </div>
      </div>
    </div>

    <!-- 分享已开启指示 -->
    <div v-if="seed.shareId" class="mt-1 flex items-center gap-1.5">
      <span class="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
      <span class="text-xs text-stone-400">分享已开启</span>
    </div>

    <!-- 演化关系标记 -->
    <div v-if="seed.parentId || seed.sourceSeeds" class="mt-3 flex flex-wrap items-center gap-2 text-xs text-stone-500">
      <span v-if="seed.parentId" class="flex items-center gap-1.5 border border-stone-300 bg-stone-50 px-2 py-1">
        <span>↗️</span>
        <span>第 {{ seed.generation }} 代演化</span>
      </span>
      <span v-if="seed.sourceSeeds && seed.sourceSeeds.length > 0" class="flex items-center gap-1.5 border border-stone-300 bg-stone-50 px-2 py-1">
        <span>🔀</span>
        <span>融合自 {{ seed.sourceSeeds.length }} 个想法</span>
      </span>
      <span v-if="seed.evolutionNote" class="text-stone-400">· {{ seed.evolutionNote }}</span>
      <span v-if="seed.combinationNote" class="text-stone-400">· {{ seed.combinationNote }}</span>
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

    <div class="mt-6 flex items-center justify-between gap-4">
      <div class="flex flex-wrap gap-2">
        <span v-for="tag in seed.tags" :key="tag" class="text-xs text-stone-500"> #{{ tag }} </span>
      </div>
      <button
        class="shrink-0 border border-stone-300 px-4 py-1.5 text-xs text-stone-600 transition hover:border-stone-900 hover:text-stone-900"
        type="button"
        @click="emit('explore', seed)"
      >
        继续探索
      </button>
    </div>
  </article>

  <!-- 隐藏的导出卡片，用于 PNG 截图。
       外层 overflow:hidden 在视觉上裁剪到 0，但浏览器仍会完整 layout，html-to-image 可正常捕获 -->
  <div aria-hidden="true" style="position: fixed; left: 0; top: 0; width: 0; height: 0; overflow: hidden; pointer-events: none;">
  <div
    ref="exportCardRef"
    style="width: 560px; background: #ffffff; padding: 40px; font-family: ui-sans-serif, system-ui, sans-serif;"
  >
    <div style="border-bottom: 2px solid #1c1917; padding-bottom: 20px; margin-bottom: 24px;">
      <p style="font-size: 11px; color: #a8a29e; text-transform: uppercase; letter-spacing: 0.1em; margin: 0 0 8px;">
        {{ formatSeedTime(seed.createdAt) }}
      </p>
      <h2 style="font-size: 28px; font-weight: 300; color: #1c1917; margin: 0; line-height: 1.2;">{{ seed.projectName }}</h2>
    </div>

    <p style="border-left: 3px solid #1c1917; padding-left: 16px; color: #44403c; font-size: 14px; line-height: 1.7; margin: 0 0 24px;">
      {{ seed.concept }}
    </p>

    <div style="margin-bottom: 20px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
        <span style="font-size: 12px; color: #78716c;">灵感强度</span>
        <span style="font-size: 12px; color: #1c1917; font-family: monospace;">{{ normalizeScore(seed.score) }}</span>
      </div>
      <div style="height: 3px; background: #e7e5e4; border-radius: 0;">
        <div :style="{ width: `${normalizeScore(seed.score)}%`, height: '3px', background: '#1c1917' }"></div>
      </div>
    </div>

    <div style="margin-bottom: 20px;">
      <p style="font-size: 12px; color: #78716c; margin: 0 0 6px;">目标用户</p>
      <p style="font-size: 13px; color: #44403c; line-height: 1.6; margin: 0;">{{ seed.targetUsers }}</p>
    </div>

    <div style="margin-bottom: 20px;">
      <p style="font-size: 12px; color: #78716c; margin: 0 0 8px;">核心功能</p>
      <ul style="margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 6px;">
        <li v-for="feature in seed.coreFeatures" :key="feature" style="display: flex; gap: 8px; font-size: 13px; color: #44403c; line-height: 1.5;">
          <span style="margin-top: 7px; width: 4px; height: 4px; background: #1c1917; flex-shrink: 0; border-radius: 0;"></span>
          <span>{{ feature }}</span>
        </li>
      </ul>
    </div>

    <div style="margin-bottom: 24px;">
      <p style="font-size: 12px; color: #78716c; margin: 0 0 8px;">技术方向</p>
      <div style="display: flex; flex-wrap: wrap; gap: 6px;">
        <span
          v-for="tech in seed.techDirection"
          :key="tech"
          style="border: 1px solid #d6d3d1; background: #fafaf9; padding: 3px 10px; font-size: 11px; color: #57534e;"
        >{{ tech }}</span>
      </div>
    </div>

    <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #e7e5e4; padding-top: 16px;">
      <div style="display: flex; flex-wrap: wrap; gap: 8px;">
        <span v-for="tag in seed.tags" :key="tag" style="font-size: 11px; color: #78716c;">#{{ tag }}</span>
      </div>
      <span style="font-size: 11px; color: #a8a29e; letter-spacing: 0.05em;">Vibe Seeds</span>
    </div>
  </div>
  </div>
</template>
