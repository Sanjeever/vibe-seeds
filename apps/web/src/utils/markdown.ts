import type { Seed } from "@vibe-seeds/shared";

export function seedToMarkdown(seed: Seed): string {
  const tags = seed.tags.map((t) => `#${t}`).join(" ");

  return [
    `# ${seed.projectName}`,
    "",
    `> ${seed.concept}`,
    "",
    `**目标用户**：${seed.targetUsers}`,
    "",
    "## 核心功能",
    ...seed.coreFeatures.map((f) => `- ${f}`),
    "",
    "## 技术方向",
    ...seed.techDirection.map((t) => `- ${t}`),
    "",
    `**灵感强度**：${seed.score}/100　${tags}`,
    "",
    "## 后续 Prompt",
    "",
    seed.followUpPrompt,
  ].join("\n");
}
