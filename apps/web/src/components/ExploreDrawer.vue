<script setup lang="ts">
import { ref, watch } from "vue";
import { marked } from "marked";
import type { Exploration, ExplorationDimension, Seed } from "@vibe-seeds/shared";
import { deleteExploration as deleteExplorationApi, streamExploreSeed } from "../api/seeds";
import { formatSeedTime } from "../utils/seeds";

const props = defineProps<{
  seed: Seed | null;
  isOpen: boolean;
}>();

const emit = defineEmits<{
  close: [];
  explorationAdded: [seedId: string, exploration: Exploration];
  explorationRemoved: [seedId: string, explorationId: string];
}>();

const customInput = ref("");
const isGenerating = ref(false);
const errorMessage = ref("");
const quotedExploration = ref<Exploration | null>(null);
const streamingExploration = ref<(Exploration & { isStreaming: true }) | null>(null);
const copiedId = ref<string | null>(null);

let abortController: AbortController | null = null;

watch(
  () => props.isOpen,
  (open) => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
      customInput.value = "";
      errorMessage.value = "";
      quotedExploration.value = null;
      abortController?.abort();
      abortController = null;
    }
  }
);

const dimensions: { key: ExplorationDimension; label: string }[] = [
  { key: "mvp", label: "MVP 清单" },
  { key: "tech", label: "技术选型" },
  { key: "competitor", label: "竞品分析" },
  { key: "validation", label: "最小验证方案" }
];

const dimensionLabels: Record<ExplorationDimension, string> = {
  mvp: "MVP 清单",
  tech: "技术选型",
  competitor: "竞品分析",
  validation: "最小验证方案",
  custom: "自定义追问"
};

function renderMarkdown(text: string): string {
  return marked.parse(text, { async: false }) as string;
}

async function triggerExploration(dimension: ExplorationDimension, customPrompt?: string) {
  if (!props.seed || isGenerating.value) return;

  isGenerating.value = true;
  errorMessage.value = "";
  streamingExploration.value = null;

  abortController = new AbortController();

  try {
    const gen = streamExploreSeed(props.seed.id, dimension, customPrompt, abortController.signal);

    for await (const event of gen) {
      if (event.type === "init") {
        streamingExploration.value = {
          id: event.id,
          dimension: event.dimension,
          prompt: event.prompt,
          response: "",
          createdAt: event.createdAt,
          isStreaming: true
        };
      } else if (event.type === "chunk" && streamingExploration.value) {
        const current: Exploration & { isStreaming: true } = streamingExploration.value;
        streamingExploration.value = { ...current, response: current.response + event.content };
      } else if (event.type === "done" && streamingExploration.value) {
        const finished: Exploration = {
          id: streamingExploration.value.id,
          dimension: streamingExploration.value.dimension,
          prompt: streamingExploration.value.prompt,
          response: streamingExploration.value.response,
          createdAt: streamingExploration.value.createdAt
        };
        streamingExploration.value = null;
        emit("explorationAdded", props.seed!.id, finished);

        if (dimension === "custom") {
          customInput.value = "";
          quotedExploration.value = null;
        }
      } else if (event.type === "error") {
        throw new Error(event.message);
      }
    }
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      // user closed drawer — silently discard
    } else {
      errorMessage.value = error instanceof Error ? error.message : "探索生成失败，请稍后重试";
    }
    streamingExploration.value = null;
  } finally {
    isGenerating.value = false;
    abortController = null;
  }
}

function handleCustomSubmit() {
  const text = customInput.value.trim();
  if (text.length < 2) return;

  const prompt = quotedExploration.value
    ? `【引用】${quotedExploration.value.prompt}：\n${quotedExploration.value.response.slice(0, 300)}${quotedExploration.value.response.length > 300 ? "..." : ""}\n\n${text}`
    : text;

  void triggerExploration("custom", prompt);
}

function quoteExploration(exploration: Exploration) {
  quotedExploration.value = exploration;
  customInput.value = "";
}

function clearQuote() {
  quotedExploration.value = null;
}

async function copyExploration(exploration: Exploration) {
  await navigator.clipboard.writeText(exploration.response);
  copiedId.value = exploration.id;
  setTimeout(() => { copiedId.value = null; }, 2000);
}

async function removeExploration(exploration: Exploration) {
  if (!props.seed) return;
  const seedId = props.seed.id;

  try {
    await deleteExplorationApi(seedId, exploration.id);
    emit("explorationRemoved", seedId, exploration.id);
  } catch {
    errorMessage.value = "删除探索失败，请稍后重试";
  }
}

function sortedExplorations(explorations: Exploration[]) {
  return [...explorations].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}
</script>

<template>
  <Teleport to="body">
    <Transition name="drawer">
      <div v-if="isOpen && seed" class="fixed inset-0 z-50 flex justify-end">
        <div class="absolute inset-0 bg-black/20" @click="emit('close')"></div>

        <div class="drawer-panel relative flex h-full w-full max-w-[520px] flex-col bg-white shadow-2xl">
          <!-- Header -->
          <div class="flex shrink-0 items-center justify-between border-b border-stone-200 px-6 py-4">
            <div class="min-w-0">
              <p class="truncate text-lg font-light text-stone-900">{{ seed.projectName }}</p>
              <p class="mt-0.5 text-xs text-stone-400">{{ seed.explorations.length }} 条探索记录</p>
            </div>
            <button
              class="ml-4 shrink-0 text-sm text-stone-400 underline decoration-stone-300 underline-offset-4 transition hover:text-stone-900"
              type="button"
              @click="emit('close')"
            >
              关闭
            </button>
          </div>

          <!-- Seed summary -->
          <div class="shrink-0 border-b border-stone-200 bg-stone-50 px-6 py-4">
            <p class="text-xs text-stone-400">原始 vibe</p>
            <p class="mt-1 text-sm leading-relaxed text-stone-700">「{{ seed.sourceVibe }}」</p>
            <p class="mt-2 line-clamp-2 text-xs leading-relaxed text-stone-500">{{ seed.concept }}</p>
          </div>

          <!-- Dimension buttons -->
          <div class="shrink-0 border-b border-stone-200 px-6 py-4">
            <p class="mb-3 text-xs text-stone-500">选择探索方向</p>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="dim in dimensions"
                :key="dim.key"
                class="border border-stone-300 px-3 py-1.5 text-xs text-stone-600 transition hover:border-stone-900 hover:text-stone-900 disabled:cursor-not-allowed disabled:opacity-40"
                type="button"
                :disabled="isGenerating"
                @click="triggerExploration(dim.key)"
              >
                {{ dim.label }}
              </button>
            </div>
          </div>

          <!-- Exploration list -->
          <div class="min-h-0 flex-1 overflow-y-auto px-6 py-4">
            <p v-if="errorMessage" class="mb-4 text-sm text-red-700">{{ errorMessage }}</p>

            <!-- Streaming card -->
            <div v-if="streamingExploration" class="mb-6 border border-stone-900 bg-stone-50 p-4">
              <div class="mb-3 flex items-center justify-between">
                <span class="border border-stone-900 px-2 py-0.5 text-xs text-stone-900">
                  {{ dimensionLabels[streamingExploration.dimension] }}
                </span>
                <span class="flex items-center gap-1.5 text-xs text-stone-400">
                  <span class="inline-block h-2 w-2 animate-pulse rounded-full bg-stone-400"></span>
                  生成中
                </span>
              </div>
              <p
                v-if="streamingExploration.dimension === 'custom'"
                class="mb-2 text-xs text-stone-500 line-clamp-1"
              >
                「{{ streamingExploration.prompt }}」
              </p>
              <!-- eslint-disable-next-line vue/no-v-html -->
              <div
                class="prose-sm prose max-w-none text-stone-700"
                v-html="renderMarkdown(streamingExploration.response)"
              ></div>
            </div>

            <div
              v-if="seed.explorations.length === 0 && !streamingExploration && !isGenerating"
              class="py-8 text-center text-sm text-stone-400"
            >
              点击上方按钮开始探索
            </div>

            <!-- Saved explorations -->
            <div class="space-y-6">
              <div
                v-for="exploration in sortedExplorations(seed.explorations)"
                :key="exploration.id"
                class="border border-stone-200 bg-stone-50 p-4"
              >
                <div class="mb-3 flex items-center justify-between gap-2">
                  <span class="shrink-0 border border-stone-300 px-2 py-0.5 text-xs text-stone-600">
                    {{ dimensionLabels[exploration.dimension] }}
                  </span>
                  <div class="flex items-center gap-3">
                    <span class="text-xs text-stone-400">{{ formatSeedTime(exploration.createdAt) }}</span>
                    <button
                      class="text-xs text-stone-400 underline decoration-stone-300 underline-offset-4 transition hover:text-stone-900"
                      type="button"
                      @click="copyExploration(exploration)"
                    >
                      {{ copiedId === exploration.id ? "已复制" : "复制" }}
                    </button>
                    <button
                      class="text-xs text-stone-400 underline decoration-stone-300 underline-offset-4 transition hover:text-stone-900"
                      type="button"
                      @click="quoteExploration(exploration)"
                    >
                      引用
                    </button>
                    <button
                      class="text-xs text-stone-400 underline decoration-stone-300 underline-offset-4 transition hover:text-red-700"
                      type="button"
                      @click="removeExploration(exploration)"
                    >
                      删除
                    </button>
                  </div>
                </div>
                <p
                  v-if="exploration.dimension === 'custom'"
                  class="mb-2 line-clamp-1 text-xs text-stone-500"
                >
                  「{{ exploration.prompt }}」
                </p>
                <!-- eslint-disable-next-line vue/no-v-html -->
                <div
                  class="prose-sm prose max-w-none text-stone-700"
                  v-html="renderMarkdown(exploration.response)"
                ></div>
              </div>
            </div>
          </div>

          <!-- Custom input -->
          <div class="shrink-0 border-t border-stone-200 px-6 py-4">
            <!-- Quote preview -->
            <div v-if="quotedExploration" class="mb-3 flex items-start gap-2 border-l-2 border-stone-400 pl-3">
              <div class="min-w-0 flex-1">
                <p class="text-xs text-stone-500">引用：{{ dimensionLabels[quotedExploration.dimension] }}</p>
                <p class="mt-0.5 line-clamp-2 text-xs text-stone-600">{{ quotedExploration.response.slice(0, 120) }}...</p>
              </div>
              <button
                class="shrink-0 text-xs text-stone-400 transition hover:text-stone-900"
                type="button"
                @click="clearQuote"
              >
                ✕
              </button>
            </div>

            <p class="mb-2 text-xs text-stone-500">或者，直接追问...</p>
            <div class="flex gap-2">
              <textarea
                v-model="customInput"
                class="min-h-[60px] flex-1 resize-none border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 outline-none transition placeholder:text-stone-400 focus:border-stone-900"
                placeholder="输入你的问题（至少 2 个字符）"
                :disabled="isGenerating"
                @keydown.ctrl.enter.prevent="handleCustomSubmit"
              ></textarea>
              <button
                class="self-end border border-stone-900 bg-stone-900 px-4 py-2 text-sm text-stone-50 transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:border-stone-300 disabled:bg-stone-200 disabled:text-stone-500"
                type="button"
                :disabled="isGenerating || customInput.trim().length < 2"
                @click="handleCustomSubmit"
              >
                发送
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.drawer-enter-active,
.drawer-leave-active {
  transition: opacity 0.2s ease;
}

.drawer-enter-active :deep(.drawer-panel),
.drawer-leave-active :deep(.drawer-panel) {
  transition: transform 0.2s ease;
}

.drawer-enter-from,
.drawer-leave-to {
  opacity: 0;
}

.drawer-enter-from :deep(.drawer-panel) {
  transform: translateX(100%);
}

.drawer-leave-to :deep(.drawer-panel) {
  transform: translateX(100%);
}

/* Markdown prose styles */
:deep(.prose) h1,
:deep(.prose) h2,
:deep(.prose) h3 {
  font-weight: 600;
  margin-top: 1rem;
  margin-bottom: 0.5rem;
  color: #1c1917;
}

:deep(.prose) h1 { font-size: 1.125rem; }
:deep(.prose) h2 { font-size: 1rem; }
:deep(.prose) h3 { font-size: 0.875rem; }

:deep(.prose) p {
  margin-bottom: 0.5rem;
  line-height: 1.6;
}

:deep(.prose) ul,
:deep(.prose) ol {
  padding-left: 1.25rem;
  margin-bottom: 0.5rem;
}

:deep(.prose) ul { list-style-type: disc; }
:deep(.prose) ol { list-style-type: decimal; }

:deep(.prose) li {
  margin-bottom: 0.25rem;
  line-height: 1.6;
}

:deep(.prose) strong {
  font-weight: 600;
  color: #1c1917;
}

:deep(.prose) code {
  background: #e7e5e4;
  padding: 0.1rem 0.3rem;
  border-radius: 2px;
  font-size: 0.8em;
  font-family: monospace;
}

:deep(.prose) pre {
  background: #e7e5e4;
  padding: 0.75rem;
  overflow-x: auto;
  margin-bottom: 0.5rem;
}

:deep(.prose) pre code {
  background: none;
  padding: 0;
}

:deep(.prose) blockquote {
  border-left: 2px solid #a8a29e;
  padding-left: 0.75rem;
  color: #78716c;
  margin-bottom: 0.5rem;
}

:deep(.prose) table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 0.5rem;
  font-size: 0.8rem;
}

:deep(.prose) th,
:deep(.prose) td {
  border: 1px solid #d6d3d1;
  padding: 0.375rem 0.5rem;
  text-align: left;
}

:deep(.prose) th {
  background: #e7e5e4;
  font-weight: 600;
}
</style>
