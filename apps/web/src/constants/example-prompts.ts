import type { SceneType } from "@vibe-seeds/shared";

export const defaultExamplePrompts = [
  "我想做一个适合雨天独处的创作工具",
  "我想做一个低压力、适合周末复盘的个人效率工具",
  "我想做一个有点赛博感的 AI 灵感看板",
  "我想做一个帮助设计师整理碎片灵感的轻量工具",
  "我想做一个让学习计划更治愈、更有仪式感的小应用"
];

export const sceneExamplePrompts: Record<SceneType, string[]> = {
  "indie-tool": [
    "我想做一个管理本地 Markdown 笔记的极简工具",
    "我想做一个帮开发者追踪每日编码时间的桌面小工具",
    "我想做一个本地运行的 API 接口调试工具",
    "我想做一个批量重命名文件并预览效果的效率工具"
  ],
  "mobile": [
    "我想做一个记录每天喝水量的极简 App",
    "我想做一个通勤路上背单词的轻量应用",
    "我想做一个用照片记录植物生长过程的小 App",
    "我想做一个睡前帮助放松的呼吸引导应用"
  ],
  "chrome-extension": [
    "我想做一个在任何网页上快速高亮并保存文字的插件",
    "我想做一个屏蔽社交媒体推荐流、只留搜索框的专注插件",
    "我想做一个自动整理浏览器标签页的效率插件",
    "我想做一个在 GitHub 页面显示 npm 包下载量的插件"
  ],
  "ai-app": [
    "我想做一个帮设计师把草图描述转化成 Tailwind 组件的工具",
    "我想做一个用 AI 分析日记情绪并生成周报的应用",
    "我想做一个根据食材自动生成食谱的 AI 厨房助手",
    "我想做一个让 AI 扮演苏格拉底陪我思考问题的对话应用"
  ]
};

export function getExamplePrompts(scene?: SceneType): string[] {
  return scene ? sceneExamplePrompts[scene] : defaultExamplePrompts;
}
