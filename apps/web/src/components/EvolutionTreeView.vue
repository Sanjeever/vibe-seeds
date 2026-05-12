<script setup lang="ts">
import { computed, h, defineComponent, type PropType } from "vue";
import type { Seed } from "@vibe-seeds/shared";
import { formatSeedTime, getSeedStatusClass, getSeedStatusLabel } from "../utils/seeds";

const props = defineProps<{
  seeds: Seed[];
  isOpen: boolean;
}>();

const emit = defineEmits<{
  close: [];
  selectSeed: [seedId: string];
}>();

interface TreeNode {
  seed: Seed;
  children: TreeNode[];
  level: number;
}

const evolutionTrees = computed(() => {
  const rootSeeds: Seed[] = [];

  for (const seed of props.seeds) {
    if (!seed.parentId) {
      rootSeeds.push(seed);
    }
  }

  function buildTree(seed: Seed, level: number): TreeNode {
    const children = props.seeds
      .filter(s => s.parentId === seed.id)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      .map(child => buildTree(child, level + 1));

    return { seed, children, level };
  }

  return rootSeeds
    .filter(root => props.seeds.some(s => s.parentId === root.id))
    .map(root => buildTree(root, 0));
});

const combinationGroups = computed(() => {
  return props.seeds
    .filter(s => s.sourceSeeds && s.sourceSeeds.length > 0)
    .map(combined => {
      const sources = combined.sourceSeeds!
        .map(id => props.seeds.find(s => s.id === id))
        .filter((s): s is Seed => s !== undefined);
      return { combined, sources };
    });
});

function getGenerationLabel(generation: number): string {
  if (generation === 0) return "原始";
  return `第 ${generation} 代`;
}

const TreeNodeComponent: any = defineComponent({
  name: "TreeNodeComponent",
  props: {
    node: {
      type: Object as PropType<TreeNode>,
      required: true
    }
  },
  emits: ["selectSeed"],
  setup(props, { emit }): any {
    return (): any => h('div', { class: 'space-y-4' }, [
      h('div', {
        class: [
          'cursor-pointer border p-4 transition',
          props.node.level === 0 ? 'border-stone-900 bg-white' : 'border-stone-300 bg-stone-50 hover:border-stone-900'
        ],
        onClick: () => emit('selectSeed', props.node.seed.id)
      }, [
        h('div', { class: 'flex items-start justify-between gap-4' }, [
          h('div', { class: 'flex-1' }, [
            h('div', { class: 'flex items-center gap-2' }, [
              h('span', { class: 'text-xs text-stone-400' }, formatSeedTime(props.node.seed.createdAt)),
              h('span', { class: 'border border-stone-300 px-2 py-0.5 text-xs text-stone-600' }, getGenerationLabel(props.node.seed.generation)),
              h('span', { class: ['border px-2 py-0.5 text-xs', getSeedStatusClass(props.node.seed.status)] }, getSeedStatusLabel(props.node.seed.status))
            ]),
            h('p', { class: 'mt-2 font-medium text-stone-900' }, props.node.seed.projectName),
            h('p', { class: 'mt-1 text-sm text-stone-600 line-clamp-2' }, props.node.seed.concept),
            props.node.seed.evolutionNote ? h('p', { class: 'mt-2 text-xs text-stone-500' }, `💡 ${props.node.seed.evolutionNote}`) : null
          ])
        ])
      ]),
      props.node.children.length > 0 ? h('div', { class: 'ml-8 space-y-4 border-l-2 border-stone-300 pl-6' },
        props.node.children.map(child =>
          h(TreeNodeComponent, {
            key: child.seed.id,
            node: child,
            onSelectSeed: (id: string) => emit('selectSeed', id)
          })
        )
      ) : null
    ]);
  }
});
</script>

<template>
  <Teleport to="body">
    <Transition name="drawer">
      <div v-if="isOpen" class="fixed inset-0 z-50 flex justify-end">
        <div class="absolute inset-0 bg-black/20" @click="emit('close')"></div>

        <div class="drawer-panel relative flex h-full w-full max-w-4xl flex-col bg-white shadow-2xl">
          <div class="flex shrink-0 items-center justify-between border-b border-stone-200 px-6 py-4">
            <div>
              <h2 class="font-display text-2xl font-light text-stone-900">演化树视图</h2>
              <p class="mt-1 text-sm text-stone-500">查看灵感的演化和组合关系</p>
            </div>
            <button
              class="text-sm text-stone-400 underline decoration-stone-300 underline-offset-4 transition hover:text-stone-900"
              type="button"
              @click="emit('close')"
            >
              关闭
            </button>
          </div>

          <div class="min-h-0 flex-1 overflow-y-auto px-6 py-8">
            <div v-if="evolutionTrees.length === 0 && combinationGroups.length === 0" class="py-16 text-center">
              <p class="text-stone-500">还没有演化或组合的灵感</p>
              <p class="mt-2 text-sm text-stone-400">在卡片菜单中选择"演化此想法"或使用"组合灵感"功能</p>
            </div>

            <div v-else class="space-y-12">
              <!-- 演化树 -->
              <section v-if="evolutionTrees.length > 0">
                <h3 class="mb-6 text-lg font-light text-stone-900">演化链</h3>
                <div class="space-y-8">
                  <div v-for="tree in evolutionTrees" :key="tree.seed.id" class="border border-stone-200 p-6">
                    <TreeNodeComponent :node="tree" @select-seed="emit('selectSeed', $event)" />
                  </div>
                </div>
              </section>

              <!-- 组合关系 -->
              <section v-if="combinationGroups.length > 0">
                <h3 class="mb-6 text-lg font-light text-stone-900">组合产品</h3>
                <div class="space-y-8">
                  <div v-for="group in combinationGroups" :key="group.combined.id" class="border border-stone-200 p-6">
                    <div class="mb-6 flex flex-wrap items-center gap-4">
                      <div
                        v-for="source in group.sources"
                        :key="source.id"
                        class="min-w-[200px] flex-1 cursor-pointer border border-stone-300 bg-stone-50 p-4 transition hover:border-stone-900"
                        @click="emit('selectSeed', source.id)"
                      >
                        <div class="flex flex-wrap items-center gap-2">
                          <p class="text-xs text-stone-400">{{ formatSeedTime(source.createdAt) }}</p>
                          <span class="border px-2 py-0.5 text-xs" :class="getSeedStatusClass(source.status)">{{ getSeedStatusLabel(source.status) }}</span>
                        </div>
                        <p class="mt-1 font-medium text-stone-900">{{ source.projectName }}</p>
                        <div class="mt-2 flex flex-wrap gap-1">
                          <span v-for="tag in source.tags.slice(0, 3)" :key="tag" class="text-xs text-stone-500">#{{ tag }}</span>
                        </div>
                      </div>
                    </div>

                    <div class="flex justify-center">
                      <div class="flex items-center gap-2 text-stone-400">
                        <div class="h-px w-8 bg-stone-300"></div>
                        <span class="text-sm">🔀 组合</span>
                        <div class="h-px w-8 bg-stone-300"></div>
                      </div>
                    </div>

                    <div
                      class="mt-6 cursor-pointer border-2 border-stone-900 bg-white p-6 transition hover:bg-stone-50"
                      @click="emit('selectSeed', group.combined.id)"
                    >
                      <div class="flex flex-wrap items-center gap-2">
                        <p class="text-xs text-stone-400">{{ formatSeedTime(group.combined.createdAt) }}</p>
                        <span class="border px-2 py-0.5 text-xs" :class="getSeedStatusClass(group.combined.status)">{{ getSeedStatusLabel(group.combined.status) }}</span>
                      </div>
                      <p class="mt-2 text-xl font-light text-stone-900">{{ group.combined.projectName }}</p>
                      <p class="mt-2 text-sm text-stone-600">{{ group.combined.concept }}</p>
                      <div class="mt-3 flex flex-wrap gap-2">
                        <span v-for="tag in group.combined.tags" :key="tag" class="border border-stone-300 px-2 py-0.5 text-xs text-stone-600">#{{ tag }}</span>
                      </div>
                      <p v-if="group.combined.combinationNote" class="mt-3 text-xs text-stone-500">{{ group.combined.combinationNote }}</p>
                    </div>
                  </div>
                </div>
              </section>
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
</style>
