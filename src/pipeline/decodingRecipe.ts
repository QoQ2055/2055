// Per-node decoding recipe (temperature + stop sequences + future knobs).
//
// 设计原则
// ─────────
//   • 不动 prompt 模板。仅在 runner.ts 调用 chatStream 之前注入解码参数。
//   • 节点级 > 阶段级 > 全局：runner.ts 优先用 node recipe，未命中再 fallback
//     到 settings.temperatureScreenplay / temperatureAssets。
//   • Recipe 是"我们对节点最佳温度的工程判断"，跟 prompt 内容无关；可以独立
//     于 prompt 迭代。
//
// 使用
// ─────
//   import { resolveTemperature, resolveStop, restoreStopMarker } from './decodingRecipe';
//   const temperature = resolveTemperature(stageId, step.id, settings);
//   const stop        = resolveStop(step.id);
//   ...
//   res.content = restoreStopMarker(res.content, res.finishReason, stop);

import type { StageId } from './types';
import type { SettingsState } from '../store/settings';

/* ───────────────────────────────────────────────────────────────────
 * 温度配方（只列偏离阶段默认的节点；其它节点继续走阶段默认）
 *
 * 约定
 *   • 创意发散类  : 0.80 - 0.95（破题 / 爽点设计 / 章节正文 / 单元 prompt）
 *   • 结构化抽取类: 0.20 - 0.40（plan-json / 资产扫描 / JSON 模式）
 *   • 自检 / 审计 : 0.10 - 0.25（违规清单 / 一致性检查 / 伏笔审计）
 *   • 润色 / 改写 : 0.50 - 0.65（剧本医生 / 章节润色）
 *   • 大纲 / 设定 : 0.55 - 0.75（人物 bible / 分卷 / 伏笔表）
 * ─────────────────────────────────────────────────────────────────── */
export const TEMPERATURE_RECIPE: Record<string, number> = {
  // ─── 剧本（screenplay）─────────────────────────────────────
  'screenplay.1': 0.85,   // 破题与核心动作 — 创意发散
  'screenplay.2': 0.80,   // 梗概草稿
  'screenplay.3': 0.75,   // 人物深度与弧光
  'screenplay.4': 0.70,   // 前史与世界观
  'screenplay.5': 0.75,   // 结构大纲
  'screenplay.6': 0.70,   // 场次拆解
  'screenplay.7': 0.85,   // 场景写作 — 高发散
  'screenplay.8': 0.30,   // 剧本医生 JSON — 严抽取

  // ─── 改编（adapt）──────────────────────────────────────────
  'adapt.1': 0.40,        // 原作摄入
  'adapt.2': 0.55,        // 主线提取
  'adapt.3': 0.65,        // 改编策略
  'adapt.4': 0.70,        // 结构重塑
  'adapt.5': 0.75,        // 场次重写
  'adapt.6': 0.85,        // 镜像剧本写作

  // ─── 资产（assets）────────────────────────────────────────
  'assets.1': 0.25,       // 完整性扫描 — 严抽取
  'assets.2': 0.55,       // 角色卡
  'assets.3': 0.55,       // 场景卡
  'assets.4': 0.50,       // 道具卡

  // ─── 分镜（storyboard）────────────────────────────────────
  'storyboard.1': 0.35,   // Phase A-D plan-json — 结构化
  'storyboard.2': 0.80,   // Phase E-G 单元生成 — 创意

  // ─── 小说（novel）─────────────────────────────────────────
  'novel.0': 0.85,        // 题材选题探索 — 高发散，3 候选要差异化
  'novel.1': 0.65,        // 世界观文档
  'novel.2': 0.70,        // 人物 bible
  'novel.3': 0.65,        // 分卷规划
  'novel.4': 0.70,        // 单卷分章
  'novel.5': 0.55,        // 伏笔表
  'novel.6': 0.90,        // 章节草稿（墨刃）— 极高发散
  'novel.7': 0.55,        // 章节润色
};

/* ───────────────────────────────────────────────────────────────────
 * Stop 序列配方
 *
 * 警告：OpenAI 兼容协议规定 stop 字符串 **不会** 出现在返回内容里。
 *      如下游解析依赖标记本体，必须用 restoreStopMarker() 在 finishReason
 *      === 'stop' 时把它拼回去。
 *
 * 当前不启用任何全局停止符——markers 由模型遵循 prompt 自行生成。
 * 如未来观察到模型在标记后继续输出元话语，再启用对应节点的 stop。
 * ─────────────────────────────────────────────────────────────────── */
export const STOP_RECIPE: Record<string, string[]> = {
  // 'novel.3': ['[VOLUME-PLAN-END]'],
  // 'novel.4': ['[VOLUME-N-END]'],
};

/* ───────────────────────────────────────────────────────────────────
 * 模型分级配方（per-node tier routing）
 *
 * 设计目的：让创作发散类节点用最强模型，结构化抽取类节点用最便宜的模型，
 * 多数节点继续走全局默认。空 settings.modelFlagship / modelLite 时静默
 * fallback 到 settings.model，保持向后兼容。
 *
 *   tier  →  settings 字段
 *   ────────────────────────────
 *   'flagship'  →  modelFlagship（如填）, 否则 model
 *   'standard'  →  model
 *   'lite'      →  modelLite（如填）, 否则 model
 * ─────────────────────────────────────────────────────────────────── */

export type ModelTier = 'flagship' | 'standard' | 'lite';

export const MODEL_RECIPE: Record<string, ModelTier> = {
  // ─── flagship: 创作发散，质量直接决定下游
  'screenplay.1': 'flagship',
  'screenplay.5': 'flagship',
  'screenplay.7': 'flagship',
  'adapt.6':      'flagship',
  'novel.6':      'flagship',
  'storyboard.2': 'flagship',

  // ─── lite: 结构化抽取 / 扫描，质量与成本权衡明显倾向便宜
  'assets.1':     'lite',
  'screenplay.8': 'lite',   // 剧本医生 JSON
  'storyboard.1': 'lite',   // plan-json 抽取（虽然要全文，但格式固定）

  // ─── 其它节点未列出 → 'standard'（走默认 settings.model）
};

/* ───────────────────────────────────────────────────────────────────
 * Resolver
 * ─────────────────────────────────────────────────────────────────── */

/** 优先级：node recipe > stage tier > 0.7（chatStream 默认） */
export function resolveTemperature(
  stageId: StageId,
  stepId: string,
  settings: SettingsState,
): number {
  const fromRecipe = TEMPERATURE_RECIPE[stepId];
  if (typeof fromRecipe === 'number') return fromRecipe;
  // Stage tier — backwards compatible with original two-tier scheme.
  return stageId === 'screenplay'
    ? settings.temperatureScreenplay
    : settings.temperatureAssets;
}

export function resolveStop(stepId: string): string[] | undefined {
  const arr = STOP_RECIPE[stepId];
  return arr && arr.length ? [...arr] : undefined;
}

/**
 * 优先级：MODEL_RECIPE 命中 + settings 对应字段非空 → 该字段；
 *        否则一律回退到 settings.model（向后兼容）。
 *
 * 同时返回 `tier` 让调用方记录到 artifact.meta，便于事后做模型对照分析。
 */
export function resolveModel(
  stepId: string,
  settings: SettingsState,
): { model: string; tier: ModelTier } {
  const tier = MODEL_RECIPE[stepId] ?? 'standard';
  if (tier === 'flagship' && settings.modelFlagship) {
    return { model: settings.modelFlagship, tier };
  }
  if (tier === 'lite' && settings.modelLite) {
    return { model: settings.modelLite, tier };
  }
  return { model: settings.model, tier };
}

/**
 * OpenAI-compatible APIs strip the matched stop sequence from `content` but
 * report `finish_reason: 'stop'`. If the downstream parser expects the marker
 * (e.g. UI reads `[VOLUME-PLAN-END]` to know "this volume done"), re-append
 * the first stop string when stripping is detected.
 */
export function restoreStopMarker(
  content: string,
  finishReason: string | null,
  stop: string[] | undefined,
): string {
  if (!stop || !stop.length) return content;
  if (finishReason !== 'stop') return content;
  // Find which stop marker is missing from the tail and restore it.
  const tail = content.trimEnd();
  for (const marker of stop) {
    if (tail.endsWith(marker)) return content; // already present, nothing to do
  }
  return content.trimEnd() + '\n' + stop[0] + '\n';
}
