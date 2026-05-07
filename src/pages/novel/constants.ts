/**
 * ui-v2 PR-4 Step A · Novel 模块共享常量
 *
 * 从 src/pages/Novel.tsx 抽出 · 供 PreviewModal / NovelSettingsDialog 等子文件共享
 * 不引入新的运行时依赖 · 仅是 string 字典常量
 */

export const NOVEL_STEP_TITLES: Record<string, string> = {
  'novel.0': 'N0 题材选题探索',
  'novel.1': 'N1.1 世界观文档',
  'novel.2': 'N1.2 人物 Bible',
  'novel.3': 'N2.1 全书分卷规划',
  'novel.4': 'N2.2 单卷分章明细（循环）',
  'novel.5': 'N2.3 伏笔表',
  'novel.6': 'N3.1 章节草稿（循环 · 墨刃）',
  'novel.7': 'N3.2 章节润色（循环 · 三模式）',
};
