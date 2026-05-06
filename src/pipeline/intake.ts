// Adaptation S0 "原作摄入" stage.
// Two LLM operations:
//   summarizeChunk(chunk, type)      — per-chunk structured summary JSON
//   compileMaster(chunks, type, ...) — fold all chunk summaries into a single
//                                      master document JSON, becomes S0 artifact

import { chatStream } from '../llm/deepseek';
import type { SettingsState } from '../store/settings';
import type {
  AdaptationType, NodeArtifact, ProjectContext, SourceChunk,
} from './types';

export const S0_NODE_ID = 'screenplay.s0';
export const S0_INDEX = -1; // 排在 R1 (0) 之前

// ---------- per-chunk summary --------------------------------------------------

const CHUNK_SYSTEM_NOVEL = `你是「改编编辑助理」，正在把一部网文/小说**逐章**压缩成结构化档案。
对当前章节，输出严格 JSON（无 markdown 围栏）：

{
  "brief": "string ≤2 句话章节梗概",
  "beats": [
    {
      "summary": "string 本章主事件一句话",
      "intensity": 1-10,
      "conflictType": "人物对立 | 力量对比 | 身份矛盾 | 情感纠葛 | 生存危机 | 真相悬念 | 过渡",
      "tier": "core | sub | transition"
    }
  ],
  "emotionalHooks": [
    {
      "kind": "爽感 | 虐心 | 悬疑 | 紧张 | 温情 | 反差",
      "moment": "string ≤1 句话画面/动作",
      "intensity": 1-10
    }
  ],
  "characters": [
    { "name": "string", "appearancesHere": "string ≤1 句话本章戏份" }
  ],
  "settings": [{ "place": "string", "atmosphere": "string" }],
  "standoutLines": ["string 原文原句 ≤3 句"],
  "notes": "string ≤4 句：本章与主线关系 / 伏笔 / 哪些需视觉化重写"
}

## 硬律（依本仓库 novel_analysis.md 准则）
- beats 3-8 个；intensity 采 1-10 尺度：
  - 10 = 让读者「卧槽！」的时刻 (必独立成集) · 8-9 = 高潮 · 6-7 = 有感 · 4-5 = 平淡 · ≤3 = 必删
- conflictType 严格从 6 类枚举选（加「过渡」共 7 项），禁中间态：
  - 人物对立（主角 vs 反派 / 误会 / 背叛）
  - 力量对比（越级挑战 / 碾压 / 觉醒）
  - 身份矛盾（贵贱对立 / 隐藏身份）
  - 情感纠葛（误会 / 背叛 / 虐恋）
  - 生存危机（追杀 / 绝境）
  - 真相悬念（凶手是谁 / 身世之谜）
  - 过渡（无明显对立、机械路过 / 日常）— tier 必为 transition
- tier 三级分量：
  - core ⭐⭐⭐：intensity ≥ 7，推动主线的关键事件 · 必保留
  - sub  ⭐⭐：intensity 4-6，推进但非关键 · 可合并
  - transition ⭐：intensity ≤ 3，日常 / 铺垫 / 描写 · 应删除或极度压缩
- emotionalHooks 0-5 条：仅记 intensity ≥ 7 的「看了爽 / 痛 / 急」的时刻
- standoutLines 选【可记忆 / 可重复 / 原作金句】的原文原句`;

const CHUNK_SYSTEM_REMAKE = `你是「翻拍剧本编辑助理」，正在解析一段**旧剧本/外语原版**片段。输出严格 JSON：

{
  "brief": "string ≤2 句话本段梗概",
  "beats": [
    {
      "summary": "string 本段主事件一句话",
      "intensity": 1-10,
      "conflictType": "人物对立 | 力量对比 | 身份矛盾 | 情感纠葛 | 生存危机 | 真相悬念 | 过渡",
      "tier": "core | sub | transition"
    }
  ],
  "emotionalHooks": [
    {
      "kind": "爽感 | 虐心 | 悬疑 | 紧张 | 温情 | 反差",
      "moment": "string ≤1 句话畫面/动作",
      "intensity": 1-10
    }
  ],
  "characters": [
    { "name": "string", "appearancesHere": "string ≤1 句话本段戏份" }
  ],
  "settings": [{ "place": "string", "atmosphere": "string" }],
  "standoutLines": ["string 原版原句 ≤3 句"],
  "notes": "string ≤4 句：本段与主线关系 / 伏笔 / 翻拍要重做的部分"
}

## 硬律（本仓库 novel_analysis.md 准则同 novel 段，此处仅复述差异点）
- beats 3-8 个，conflictType / tier / intensity 三字段含义同 novel 模式
- standoutLines 是原版原句（含外语原文需注「[原文]」）
- 翻拍专属：notes 必须给出「调性 / 节奏压力 / 本土化重做点」三选一`;

export interface ChunkSummaryOpts {
  chunk: SourceChunk;
  type: AdaptationType;
  settings: SettingsState;
  signal?: AbortSignal;
  onDelta?: (chunk: string, full: string) => void;
}

export async function summarizeChunk(opts: ChunkSummaryOpts): Promise<string> {
  const { chunk, type, settings, signal, onDelta } = opts;
  if (!settings.apiKey) throw new Error('请先在设置里填写 API Key');

  const sys = type === 'novel' ? CHUNK_SYSTEM_NOVEL : CHUNK_SYSTEM_REMAKE;
  const user = `## ${chunk.title}\n\n${chunk.raw}`;

  const res = await chatStream({
    baseUrl: settings.baseUrl,
    apiKey: settings.apiKey,
    model: settings.model,
    messages: [{ role: 'system', content: sys }, { role: 'user', content: user }],
    temperature: settings.temperatureAssets,
    max_tokens: 4096,
    signal,
    onDelta,
  });

  const stripped = res.content.replace(/^```(?:json)?\s*|\s*```$/g, '').trim();
  try { JSON.parse(stripped); } catch (e: any) {
    throw new Error(`「${chunk.title}」摘要 JSON 解析失败：` + e.message);
  }
  return stripped;
}

// ---------- master document ----------------------------------------------------

const MASTER_SYSTEM_NOVEL = `你是「总编/改编主笔」，把一部网文/小说的**逐章 JSON 摘要**整合成一份**改编档案**(masterDocument)。
此档案将作为短剧 8 步剧本流程的**唯一原作锚点** —— 下游写手只看这份档案，不再看原文。

## 输出 JSON schema (严格, 无 markdown 围栏)
{
  "logline": "string ≤2 句话原作高度概括",
  "themes": ["string 原作主题 ≤3 个"],
  "mainCharacters": [
    { "name": "string", "role": "protagonist | antagonist | support | foil",
      "arc": "string 他在原作的完整角色弧 · ≤2 句话",
      "signature": "string 识别度标签 (年龄/职业/性格)" }
  ],
  "genreType": "玄幻武侠 | 都市现代 | 言情古言 | 悬疑推理 | 科幻末世 | 重生复仇 | 其他",
  "subType": "string ≤8 字 · 如「废柴逆袭」/「豪门复仇」/「虐恋情深」/「末世求生」",
  "hookDensity": "高 | 中 | 低",
  "beatSheet": [
    { "id": "B01", "summary": "string",
      "intensity": 1-10,
      "conflictType": "人物对立 | 力量对比 | 身份矛盾 | 情感纠葛 | 生存危机 | 真相悬念 | 过渡",
      "sourceChapter": "string 来自哪个章节标题" }
  ],
  "worldRules": ["string 原作世界规则 / 焦点设定"],
  "standoutLines": ["string 需保留 / 需额外关注的原文原句"],
  "adaptationRisks": [
    { "kind": "ip | length | violence | sex | culture | OOC | logic",
      "issue": "string", "mitigation": "string" }
  ],
  "summary": "string ≤5 句话原作概要"
}

## 硬律（依本仓库 novel_analysis.md / genre_adaptation.md 准则）
- genreType 从 6 类枚举中选出主类型；subType 是更具体的子题材
- hookDensity 衡量原作「情绪钩子密度」：高（6+ 个高强度钩子）/ 中（3-5）/ 低（≤2）
- beatSheet 总数 ≤30；intensity ≥ 7 的核心节拍 ≤12（短剧需求剧烈裁剪）
- mainCharacters ≤5，没用的支线人物砍掉，可合并的合并并在 arc 注明 "[合并自X]"
- adaptationRisks 至少 3 条，要诚实标出 IP / 长度 / 内容尺度 / 逻辑硬伤
- 不许凭空增设原作没有的世界规则、人物或事件 —— 这是档案，不是再创作`;

const MASTER_SYSTEM_REMAKE = `你是「翻拍总编」，把若干旧剧本/外语原版的逐段 JSON 摘要整合成翻拍档案。
## 输出 JSON schema (严格, 无 markdown 围栏)
{
  "logline": "string",
  "themes": ["string \u22643 \u4e2a"],
  "mainCharacters": [
    { "name": "string", "role": "protagonist | antagonist | support | foil",
      "arc": "string \u539f\u7248\u5b8c\u6574\u5f27\u5149",
      "signature": "string" }
  ],
  "genreType": "玄幻武侠 | 都市现代 | 言情古言 | 悬疑推理 | 科幻末世 | 重生复仇 | 其他",
  "subType": "string ≤8 字",
  "hookDensity": "高 | 中 | 低",
  "beatSheet": [
    { "id": "B01", "summary": "string", "intensity": 1-10,
      "conflictType": "人物对立 | 力量对比 | 身份矛盾 | 情感纠葛 | 生存危机 | 真相悬念 | 过渡",
      "sourceSegment": "string" }
  ],
  "worldRules": ["string \u539f\u7248\u8bbe\u5b9a / \u80cc\u666f"],
  "standoutLines": ["string \u539f\u7248\u91d1\u53e5 / catch phrase"],
  "adaptationRisks": [
    { "kind": "ip | culture | tone | structure | length | OOC",
      "issue": "string", "mitigation": "string" }
  ],
  "summary": "string \u22645 \u53e5"
}

## 硬律
- 翻拍要让档案体现原作\u300c\u8c03\u6027 / \u6b65\u8c03 / \u68a8\u91d1\u53e5\u300d\u4e09\u5927 DNA
- adaptationRisks \u8981\u6709 culture / tone \u8eab\u5546\u91cd\u70b9\u63d0\u9192
- standoutLines \u4f4e\u4e8e 5 \u6761\u672a\u91cf\uff0c\u9ad8\u4e8e 12 \u6761\u4f1a\u8b1b\u7ed5\uff0c\u53d6\u4ed5\u4e2d`;

export interface CompileMasterOpts {
  project: ProjectContext;
  chunks: SourceChunk[];   // each must have .summary
  type: AdaptationType;
  settings: SettingsState;
  signal?: AbortSignal;
  onDelta?: (chunk: string, full: string) => void;
}

export async function compileMaster(opts: CompileMasterOpts): Promise<NodeArtifact> {
  const { project, chunks, type, settings, signal, onDelta } = opts;
  if (!settings.apiKey) throw new Error('请先在设置里填写 API Key');
  const ready = chunks.filter((c) => c.summary && c.summary.trim());
  if (ready.length === 0) throw new Error('没有可用的章/段摘要 (请先逐块摘要)');

  const sys = type === 'novel' ? MASTER_SYSTEM_NOVEL : MASTER_SYSTEM_REMAKE;

  const lines: string[] = [
    '# 改编档案合成包',
    `- 项目: ${project.name}`,
    `- 概念: ${project.concept}`,
    `- 单集时长: ${project.durationMin} 分钟`,
    `- 改编类型: ${type === 'novel' ? '小说/网文 → 短剧' : '旧剧本翻拍 / 本土化'}`,
    `- 共 ${ready.length} ${type === 'novel' ? '章' : '段'}`,
    '',
  ];
  for (const c of ready) {
    lines.push(`## ${c.title}`);
    lines.push(c.summary as string);
    lines.push('');
  }
  lines.push('请按 system 的 schema 输出 masterDocument JSON，无 markdown 围栏。');

  const t0 = Date.now();
  const res = await chatStream({
    baseUrl: settings.baseUrl,
    apiKey: settings.apiKey,
    model: settings.model,
    messages: [{ role: 'system', content: sys }, { role: 'user', content: lines.join('\n') }],
    temperature: settings.temperatureAssets,
    max_tokens: 8192,
    signal,
    onDelta,
  });

  const stripped = res.content.replace(/^```(?:json)?\s*|\s*```$/g, '').trim();
  try { JSON.parse(stripped); } catch (e: any) {
    throw new Error('S0 总档案 JSON 解析失败：' + e.message);
  }

  return {
    nodeId: S0_NODE_ID,
    stageId: 'screenplay',
    index: S0_INDEX,
    title: 'S0 改编档案',
    format: 'json',
    content: stripped,
    tokens: res.usage?.total_tokens,
    durationMs: res.durationMs ?? (Date.now() - t0),
    ts: Date.now(),
  };
}

// ---------- helpers for downstream injection ----------------------------------

export interface ParsedMaster {
  logline?: string;
  themes?: string[];
  genreType?: string;
  subType?: string;
  hookDensity?: '高' | '中' | '低' | string;
  mainCharacters?: Array<{ name: string; role?: string; arc?: string; signature?: string }>;
  beatSheet?: Array<{
    id?: string; summary: string;
    /** new 1-10 scale */ intensity?: number;
    /** legacy 1-5 scale (older artifacts) */ weight?: number;
    /** new: one of 6 conflict types + transition */ conflictType?: string;
    /** legacy story-arc kind */ type?: string;
  }>;
  worldRules?: string[];
  standoutLines?: string[];
  adaptationRisks?: Array<{ kind: string; issue: string; mitigation?: string }>;
  summary?: string;
}

export function parseMaster(content: string): ParsedMaster | null {
  try { return JSON.parse(content) as ParsedMaster; } catch { return null; }
}

// Compact human-readable digest for system-prompt injection (token-friendly)
export function buildMasterDigest(master: ParsedMaster | null): string {
  if (!master) return '';
  const out: string[] = ['# 原作档案 (S0 改编档案 · 不可变上游契约)'];
  if (master.logline) out.push(`- logline: ${master.logline}`);
  if (master.themes?.length) out.push(`- themes: ${master.themes.join(' / ')}`);
  if (master.mainCharacters?.length) {
    out.push('- 主要人物:');
    for (const c of master.mainCharacters) {
      out.push(`  · ${c.name}${c.role ? ` [${c.role}]` : ''}${c.signature ? ` · ${c.signature}` : ''}${c.arc ? ` — ${c.arc}` : ''}`);
    }
  }
  if (master.genreType) {
    out.push(`- 主类型: ${master.genreType}${master.subType ? ` · ${master.subType}` : ''}${master.hookDensity ? ` (钩子密度: ${master.hookDensity})` : ''}`);
  }
  if (master.beatSheet?.length) {
    out.push(`- 节拍表 (${master.beatSheet.length} 条, intensity≥7 优先):`);
    const score = (b: { intensity?: number; weight?: number }) =>
      (b.intensity ?? (b.weight ? b.weight * 2 : 0));
    const sorted = [...master.beatSheet].sort((a, b) => score(b) - score(a));
    for (const b of sorted.slice(0, 12)) {
      const s = score(b);
      const t = b.conflictType ?? b.type ?? '';
      out.push(`  · ${b.id ?? ''} [✨${s || '-'}]${t ? ` <${t}>` : ''} ${b.summary}`);
    }
    if (sorted.length > 12) out.push(`  · …（其余 ${sorted.length - 12} 条强度较低，略）`);
  }
  if (master.worldRules?.length) out.push(`- 世界规则: ${master.worldRules.join(' / ')}`);
  if (master.standoutLines?.length) {
    out.push('- 必须保留的金句:');
    for (const l of master.standoutLines.slice(0, 8)) out.push(`  · "${l}"`);
  }
  if (master.adaptationRisks?.length) {
    out.push('- 改编风险（必须规避）:');
    for (const r of master.adaptationRisks) out.push(`  · [${r.kind}] ${r.issue}${r.mitigation ? ` → ${r.mitigation}` : ''}`);
  }
  if (master.summary) out.push(`- 原作概要: ${master.summary}`);
  out.push('---');
  return out.join('\n');
}
