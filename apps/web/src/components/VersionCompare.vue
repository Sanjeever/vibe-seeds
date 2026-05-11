<script setup lang="ts">
import { computed } from "vue";
import type { Seed } from "@vibe-seeds/shared";
import { formatSeedTime } from "../utils/seeds";

const props = defineProps<{
  parentSeed: Seed | null;
  childSeed: Seed | null;
  isOpen: boolean;
}>();

const emit = defineEmits<{
  close: [];
}>();

interface FieldDiff {
  field: string;
  label: string;
  parent: string | string[];
  child: string | string[];
  type: "text" | "list";
}

const diffs = computed<FieldDiff[]>(() => {
  if (!props.parentSeed || !props.childSeed) return [];

  const result: FieldDiff[] = [];

  if (props.parentSeed.projectName !== props.childSeed.projectName) {
    result.push({
      field: "projectName",
      label: "项目名称",
      parent: props.parentSeed.projectName,
      child: props.childSeed.projectName,
      type: "text"
    });
  }

  if (props.parentSeed.concept !== props.childSeed.concept) {
    result.push({
      field: "concept",
      label: "产品概念",
      parent: props.parentSeed.concept,
      child: props.childSeed.concept,
      type: "text"
    });
  }

  if (props.parentSeed.targetUsers !== props.childSeed.targetUsers) {
    result.push({
      field: "targetUsers",
      label: "目标用户",
      parent: props.parentSeed.targetUsers,
      child: props.childSeed.targetUsers,
      type: "text"
    });
  }

  const parentFeatures = new Set(props.parentSeed.coreFeatures);
  const childFeatures = new Set(props.childSeed.coreFeatures);
  const featuresChanged = props.parentSeed.coreFeatures.length !== props.childSeed.coreFeatures.length ||
    props.parentSeed.coreFeatures.some(f => !childFeatures.has(f)) ||
    props.childSeed.coreFeatures.some(f => !parentFeatures.has(f));

  if (featuresChanged) {
    result.push({
      field: "coreFeatures",
      label: "核心功能",
      parent: props.parentSeed.coreFeatures,
      child: props.childSeed.coreFeatures,
      type: "list"
    });
  }

  const parentTech = new Set(props.parentSeed.techDirection);
  const childTech = new Set(props.childSeed.techDirection);
  const techChanged = props.parentSeed.techDirection.length !== props.childSeed.techDirection.length ||
    props.parentSeed.techDirection.some(t => !childTech.has(t)) ||
    props.childSeed.techDirection.some(t => !parentTech.has(t));

  if (techChanged) {
    result.push({
      field: "techDirection",
      label: "技术方向",
      parent: props.parentSeed.techDirection,
      child: props.childSeed.techDirection,
      type: "list"
    });
  }

  const parentTags = new Set(props.parentSeed.tags);
  const childTags = new Set(props.childSeed.tags);
  const tagsChanged = props.parentSeed.tags.length !== props.childSeed.tags.length ||
    props.parentSeed.tags.some(t => !childTags.has(t)) ||
    props.childSeed.tags.some(t => !parentTags.has(t));

  if (tagsChanged) {
    result.push({
      field: "tags",
      label: "标签",
      parent: props.parentSeed.tags,
      child: props.childSeed.tags,
      type: "list"
    });
  }

  return result;
});

function getListDiff(parent: string[], child: string[]) {
  const parentSet = new Set(parent);
  const childSet = new Set(child);

  const removed = parent.filter(item => !childSet.has(item));
  const added = child.filter(item => !parentSet.has(item));
  const kept = parent.filter(item => childSet.has(item));

  return { removed, added, kept };
}
</script>

<template>
  <Teleport to="body">
    <Transition name="dialog">
      <div v-if="isOpen && parentSeed && childSeed" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/30" @click="emit('close')"></div>

        <div class="relative w-full max-w-5xl max-h-[90vh] overflow-hidden border border-stone-200 bg-white shadow-xl">
          <div class="flex items-center justify-between border-b border-stone-200 px-6 py-4">
            <div>
              <h2 class="font-display text-2xl font-light text-stone-900">版本对比</h2>
              <p class="mt-1 text-sm text-stone-500">
                对比「{{ parentSeed.projectName }}」的演化变化
              </p>
            </div>
            <button
              class="text-stone-400 transition hover:text-stone-900"
              type="button"
              @click="emit('close')"
            >
              ✕
            </button>
          </div>

          <div class="overflow-y-auto p-6" style="max-height: calc(90vh - 80px);">
            <div v-if="diffs.length === 0" class="py-16 text-center">
              <p class="text-stone-500">没有发现明显差异</p>
              <p class="mt-2 text-sm text-stone-400">两个版本的核心字段内容相同</p>
            </div>

            <div v-else class="space-y-8">
              <!-- 版本信息 -->
              <div class="grid gap-4 md:grid-cols-2">
                <div class="border border-stone-300 bg-stone-50 p-4">
                  <p class="text-xs text-stone-400">父版本</p>
                  <p class="mt-1 font-medium text-stone-900">{{ parentSeed.projectName }}</p>
                  <p class="mt-1 text-xs text-stone-500">{{ formatSeedTime(parentSeed.createdAt) }}</p>
                  <p class="mt-1 text-xs text-stone-600">第 {{ parentSeed.generation }} 代</p>
                </div>
                <div class="border-2 border-stone-900 bg-white p-4">
                  <p class="text-xs text-stone-400">演化版本</p>
                  <p class="mt-1 font-medium text-stone-900">{{ childSeed.projectName }}</p>
                  <p class="mt-1 text-xs text-stone-500">{{ formatSeedTime(childSeed.createdAt) }}</p>
                  <p class="mt-1 text-xs text-stone-600">第 {{ childSeed.generation }} 代</p>
                  <p v-if="childSeed.evolutionNote" class="mt-2 text-xs text-stone-700">💡 {{ childSeed.evolutionNote }}</p>
                </div>
              </div>

              <!-- 差异列表 -->
              <div class="space-y-6">
                <div v-for="diff in diffs" :key="diff.field" class="border border-stone-200 p-6">
                  <h3 class="mb-4 text-sm font-medium text-stone-900">{{ diff.label }}</h3>

                  <!-- 文本类型差异 -->
                  <div v-if="diff.type === 'text'" class="grid gap-4 md:grid-cols-2">
                    <div class="border-l-2 border-red-300 bg-red-50 p-4">
                      <p class="mb-2 text-xs text-red-600">原版本</p>
                      <p class="text-sm leading-relaxed text-stone-700">{{ diff.parent }}</p>
                    </div>
                    <div class="border-l-2 border-green-300 bg-green-50 p-4">
                      <p class="mb-2 text-xs text-green-600">演化版本</p>
                      <p class="text-sm leading-relaxed text-stone-700">{{ diff.child }}</p>
                    </div>
                  </div>

                  <!-- 列表类型差异 -->
                  <div v-else-if="diff.type === 'list' && Array.isArray(diff.parent) && Array.isArray(diff.child)">
                    <div class="space-y-3">
                      <div v-if="getListDiff(diff.parent, diff.child).removed.length > 0">
                        <p class="mb-2 text-xs text-red-600">删除的项</p>
                        <ul class="space-y-1">
                          <li
                            v-for="item in getListDiff(diff.parent, diff.child).removed"
                            :key="item"
                            class="flex gap-2 text-sm text-stone-700"
                          >
                            <span class="text-red-500">−</span>
                            <span class="line-through">{{ item }}</span>
                          </li>
                        </ul>
                      </div>

                      <div v-if="getListDiff(diff.parent, diff.child).added.length > 0">
                        <p class="mb-2 text-xs text-green-600">新增的项</p>
                        <ul class="space-y-1">
                          <li
                            v-for="item in getListDiff(diff.parent, diff.child).added"
                            :key="item"
                            class="flex gap-2 text-sm text-stone-700"
                          >
                            <span class="text-green-500">+</span>
                            <span class="font-medium">{{ item }}</span>
                          </li>
                        </ul>
                      </div>

                      <div v-if="getListDiff(diff.parent, diff.child).kept.length > 0">
                        <p class="mb-2 text-xs text-stone-400">保留的项</p>
                        <ul class="space-y-1">
                          <li
                            v-for="item in getListDiff(diff.parent, diff.child).kept"
                            :key="item"
                            class="flex gap-2 text-sm text-stone-500"
                          >
                            <span>·</span>
                            <span>{{ item }}</span>
                          </li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.dialog-enter-active,
.dialog-leave-active {
  transition: opacity 0.2s ease;
}

.dialog-enter-from,
.dialog-leave-to {
  opacity: 0;
}
</style>
