import type { Seed } from "@vibe-seeds/shared";
import { calculateSeedScore } from "../utils/score.js";

type TagRule = {
  tag: string;
  keywords: string[];
};

const tagRules: TagRule[] = [
  { tag: "效率", keywords: ["效率", "待办", "任务", "日程", "专注", "productivity", "todo"] },
  { tag: "低压力", keywords: ["低压力", "轻松", "慢", "治愈", "舒缓", "不焦虑", "calm"] },
  { tag: "赛博感", keywords: ["赛博", "cyber", "霓虹", "未来", "科技感", "neon"] },
  { tag: "创作", keywords: ["创作", "写作", "画", "灵感", "笔记", "内容", "creative"] },
  { tag: "雨天", keywords: ["雨", "雨天", "阴天", "独处"] },
  { tag: "周末", keywords: ["周末", "休息日", "假期", "weekend"] },
  { tag: "学习", keywords: ["学习", "课程", "知识", "阅读", "study"] },
  { tag: "社交", keywords: ["社交", "朋友", "社区", "聊天", "关系"] },
  { tag: "健康", keywords: ["健康", "睡眠", "运动", "冥想", "情绪"] },
  { tag: "AI", keywords: ["ai", "AI", "智能", "助手", "agent"] }
];

const namePrefixes = ["Pulse", "Glow", "Drift", "NOVA", "Moss", "Echo", "Luma", "Orbit"];
const nameSuffixes = ["Lab", "Nest", "Flow", "Seed", "Station", "Kit", "OS", "Garden"];

export function createFallbackSeedFromVibe(vibe: string): Seed {
  const normalizedVibe = vibe.trim();
  const tags = inferTags(normalizedVibe);
  const projectName = createProjectName(normalizedVibe, tags);
  const createdAt = new Date().toISOString();

  return {
    id: crypto.randomUUID(),
    projectName,
    concept: createConcept(normalizedVibe, tags),
    targetUsers: createTargetUsers(tags),
    coreFeatures: createCoreFeatures(tags),
    techDirection: createTechDirection(tags),
    followUpPrompt: createFollowUpPrompt(normalizedVibe, projectName),
    tags,
    score: calculateSeedScore(normalizedVibe),
    source: "fallback",
    sourceVibe: normalizedVibe,
    createdAt,
    explorations: []
  };
}

function inferTags(vibe: string): string[] {
  const lowerVibe = vibe.toLowerCase();
  const tags = tagRules
    .filter((rule) => rule.keywords.some((keyword) => lowerVibe.includes(keyword.toLowerCase())))
    .map((rule) => rule.tag);

  if (tags.length === 0) {
    tags.push("灵感", "轻应用");
  }

  if (tags.length < 3) {
    tags.push("MVP");
  }

  return Array.from(new Set(tags)).slice(0, 6);
}

function createProjectName(vibe: string, tags: string[]): string {
  const hash = Array.from(vibe).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const prefix = namePrefixes[hash % namePrefixes.length];
  const suffix = nameSuffixes[Math.floor(hash / 3) % nameSuffixes.length];
  const tagHint = tags[0] ?? "Vibe";

  return `${prefix} ${tagHint} ${suffix}`;
}

function createConcept(vibe: string, tags: string[]): string {
  const mainTag = tags[0] ?? "灵感";
  return `一个围绕「${mainTag}」展开的小型产品实验，把“${vibe}”转译成清晰、可启动、可继续迭代的体验。`;
}

function createTargetUsers(tags: string[]): string {
  if (tags.includes("效率")) {
    return "想提升节奏但不想被复杂系统绑架的独立创作者、学生和知识工作者。";
  }

  if (tags.includes("创作")) {
    return "经常有模糊灵感、需要一个柔和入口开始创作的人。";
  }

  if (tags.includes("健康") || tags.includes("低压力")) {
    return "希望用轻量工具照顾情绪、精力和日常节奏的用户。";
  }

  return "喜欢尝试新工具、愿意把微小想法快速变成产品原型的探索者。";
}

function createCoreFeatures(tags: string[]): string[] {
  const features = [
    "灵感输入与一键生成结构化项目卡片",
    "可编辑的目标用户、功能清单和下一步 prompt",
    "按标签筛选和回看不同 vibe 的灵感轨迹"
  ];

  if (tags.includes("效率")) {
    features.push("轻量任务流，把灵感拆成今天就能推进的三个动作");
  }

  if (tags.includes("赛博感")) {
    features.push("带有霓虹扫描感的可视化状态和实验室风格界面");
  }

  if (tags.includes("低压力")) {
    features.push("低打扰提醒和柔和反馈，避免制造新的焦虑");
  }

  if (tags.includes("创作")) {
    features.push("为每个灵感自动生成创作开场、素材方向和变体标题");
  }

  return Array.from(new Set(features)).slice(0, 6);
}

function createTechDirection(tags: string[]): string[] {
  const directions = ["Vue 3 + Vite 构建快速交互原型", "Express 提供轻量 API", "JSON 文件持久化，便于本地优先迭代"];

  if (tags.includes("AI")) {
    directions.push("后续可接入 OpenAI-compatible Chat Completions 生成更丰富的卡片内容");
  }

  if (tags.includes("赛博感")) {
    directions.push("使用 TailwindCSS、CSS 渐变和细边框营造 creative lab 视觉");
  }

  if (tags.includes("效率")) {
    directions.push("预留任务、计时和状态流转的数据结构");
  }

  return directions;
}

function createFollowUpPrompt(vibe: string, projectName: string): string {
  return `请基于「${projectName}」继续扩展：把这个想法拆成 3 个核心用户场景、1 个最小可行版本、5 个界面模块，并给出适合一周内完成的开发路线图。原始 vibe：${vibe}`;
}
