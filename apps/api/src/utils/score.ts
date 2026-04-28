const emotionWords = [
  "低压力",
  "轻松",
  "治愈",
  "舒缓",
  "孤独",
  "独处",
  "安静",
  "兴奋",
  "浪漫",
  "松弛",
  "焦虑",
  "calm",
  "cozy",
  "mood"
];

const techWords = [
  "ai",
  "AI",
  "agent",
  "智能",
  "自动化",
  "效率",
  "数据",
  "仪表盘",
  "赛博",
  "cyber",
  "api",
  "插件",
  "本地优先",
  "同步"
];

const creativeWords = [
  "创作",
  "灵感",
  "写作",
  "画",
  "音乐",
  "设计",
  "故事",
  "实验",
  "孵化",
  "玩法",
  "creative",
  "idea",
  "prototype"
];

function countMatches(vibe: string, words: string[]): number {
  return words.filter((word) => vibe.includes(word.toLowerCase())).length;
}

export function calculateSeedScore(vibe: string): number {
  const normalizedVibe = vibe.trim();
  const lowerVibe = normalizedVibe.toLowerCase();
  const lengthScore = Math.min(30, Math.floor(normalizedVibe.length / 4));
  const emotionScore = countMatches(lowerVibe, emotionWords) * 7;
  const techScore = countMatches(lowerVibe, techWords) * 8;
  const creativeScore = countMatches(lowerVibe, creativeWords) * 9;
  const diversityBonus = [emotionScore, techScore, creativeScore].filter((score) => score > 0).length * 5;
  const score = 18 + lengthScore + emotionScore + techScore + creativeScore + diversityBonus;

  return Math.max(1, Math.min(100, score));
}
