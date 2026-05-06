// Editorial rounds R1 (创作指令书) and R9 (总编四级裁决).
// Adapted from ShadowScript editorial_dispatch_9rounds.md, condensed.
//
// R1 runs BEFORE Step 1 — output a locked "creative directive" that
// is injected into every screenplay step's system prompt.
// R9 runs AFTER Step 8 — final 4-tier verdict on the whole screenplay.

import { chatStream } from '../llm/deepseek';
import type { SettingsState } from '../store/settings';
import type { ArtifactMap, NodeArtifact, ProjectContext } from './types';
import { S0_NODE_ID, parseMaster, buildMasterDigest } from './intake';
import { loadKbForNode, buildKbPreamble } from './kb';
import { buildConsistencyReport } from './consistencyCheck';
import type { SelfCheckReport } from './selfCheck';
import { recordRun } from '../store/db';

// nodeId conventions
export const R1_NODE_ID = 'screenplay.r1';
export const R9_NODE_ID = 'screenplay.r9';

// ---------- R1 ----------------------------------------------------------------

const R1_SYSTEM = `你是「总编」(R1)，负责为短剧项目锁定**创作指令书**。
本指令书将作为下游剧本 8 步、资产、分镜全部 LLM 调用的不可变共享上下文。

## 你的职责（仅限战略层，禁碰具体情节/人物/场景）
1. 主题锚定 themeAnchor — 三天后观众记住什么（一句话，≤25 字）
2. 受众画像 audienceProfile — 核心受众 + 心理诉求 + 付费倾向
3. 题材策略 genreStrategy — 类型配方（爽 / 虐 / 甜 / 三种混搭比例）+ 平台基调
4. 一句话钩子 positioningHook — 用于物料 / 推流（≤30 字）
5. 红线 doNots — 3-5 条（题材禁忌 / 主题偏离风险 / AI 味雷区）
6. 节拍策略 beatStrategy — 是否启用反向蓄力 / 三番四震 / 黄金三章

## 输出格式（严格 JSON, 无 markdown 围栏, 禁额外说明）
{
  "themeAnchor": "string",
  "audienceProfile": "string",
  "genreStrategy": "string",
  "positioningHook": "string",
  "doNots": ["string", "string", "..."],
  "beatStrategy": "string",
  "rationale": "string ≤120 字"
}

## 硬律
- 严格按受众/题材推导，禁拍脑袋；rationale 必须援引受众心理或题材公式
- 0 命中 AI 体禁词（赋能 / 闭环 / 底层逻辑 / 多元化 …）
- 输出后 doNots 里的禁词将作为下游 system 红线，谨慎选择`;

// ---- adaptation variant: extra fields for IP/source-faithful work ----
const R1_ADAPTATION_SYSTEM = `你是「改编总编」(R1')，为**短剧改编项目**锁定**改编指令书**。
此指令书将作为下游剧本 8 步、资产、分镜全部 LLM 调用的不可变共享上下文。

## 输出 JSON schema (严格 JSON, 无 markdown 围栏, 禁额外说明)
{
  "themeAnchor": "string ≤25 字",
  "audienceProfile": "string",
  "genreStrategy": "string",
  "positioningHook": "string ≤30 字",
  "doNots": ["string", "string", "..."],
  "beatStrategy": "string",
  "rationale": "string ≤120 字",

  "adaptationStrategy": "FAITHFUL | RESTRUCTURE | LOOSELY_INSPIRED",
  "mustKeep": ["原作必须保留的元素 (人物/情节/世界规则/金句)，3-7 条"],
  "mustCut":  ["原作必须删除/合并的元素，3-6 条"],
  "riskList": [
    { "kind": "ip | length | violence | sex | culture | OOC | logic", "issue": "string", "mitigation": "string" }
  ]
}

## 硬律
- 必须基于上方提供的「原作档案 (S0)」做战略决策，禁脱离档案凭空发挥
- **上方注入的 KB「类型化改编策略」**是必考资料：mustKeep / mustCut / 必强化 都必须能在 KB 的 6 类型清单中找到依据
- **上方注入的 KB「压缩 5 策略」**优先作为 beatStrategy 描述依据（冲突合并 / 时间跳跃 / 信息前置 / 删繁就简 / 支线取舍）
- adaptationStrategy 选项含义：
  · FAITHFUL = 80%+ 沿用原作主线 (适合金 IP 翻拍)
  · RESTRUCTURE = 保留人物/世界，重塑节奏与主题 (最常见)
  · LOOSELY_INSPIRED = 仅借核心冲突或人设，重写一切 (借壳)
- mustKeep 优先放: 标志性台词、关键反转、IP 识别度强的设定（参考 KB 同类型「必保留」列）
- mustCut 优先放: 与短剧节奏冲突的支线 / 过长内心戏 / 平台禁忌内容（参考 KB 同类型「必删除」列）
- riskList 至少 3 条，必须涵盖 ip 风险 (是否触碰原作版权方红线)
- doNots 中必须含「5 大致命错误」中适用本项目的 ≥2 条 (过度忠于原著 / 节奏过慢 / 心理描写过多 / 支线过多 / 人物过多)
- 0 命中 AI 体禁词`;

export async function runR1Directive(opts: {
  project: ProjectContext;
  artifacts?: ArtifactMap;
  settings: SettingsState;
  signal?: AbortSignal;
  onDelta?: (chunk: string, full: string) => void;
}): Promise<NodeArtifact> {
  const { project, artifacts, settings, signal, onDelta } = opts;
  if (!settings.apiKey) throw new Error('请先在设置里填写 API Key');

  const isAdaptation = project.createMode === 'adaptation';
  const baseSys = isAdaptation ? R1_ADAPTATION_SYSTEM : R1_SYSTEM;
  // Inject adaptation KBs (genre strategy + compression) when in adaptation mode
  let sys = baseSys;
  if (isAdaptation) {
    try {
      const blocks = await loadKbForNode(R1_NODE_ID, { adaptation: true });
      const kbHead = buildKbPreamble(blocks);
      if (kbHead) sys = kbHead + '\n\n' + baseSys;
    } catch (e) {
      console.warn('[r1] kb inject failed:', e);
    }
  }

  const userParts: string[] = [
    '# 项目立项',
    '',
    `- 项目名: ${project.name}`,
    `- 一句话概念: ${project.concept}`,
    `- 单集时长: ${project.durationMin} 分钟`,
    `- 创作模式: ${isAdaptation
        ? `改编 (${project.adaptationType === 'novel' ? '小说/网文' : '旧剧本翻拍'})`
        : '原创 / 从零创作'}`,
    '',
  ];

  if (isAdaptation) {
    const s0 = artifacts?.[S0_NODE_ID];
    if (!s0) {
      throw new Error('改编模式 R1 必须先完成 S0 原作档案 (Intake)');
    }
    const digest = buildMasterDigest(parseMaster(s0.content));
    if (digest) {
      userParts.push(digest);
      userParts.push('');
    }
  }
  userParts.push('请按 system 的指令书 schema 输出严格 JSON。');

  const t0 = Date.now();
  const res = await chatStream({
    baseUrl: settings.baseUrl,
    apiKey: settings.apiKey,
    model: settings.model,
    messages: [
      { role: 'system', content: sys },
      { role: 'user',   content: userParts.join('\n') },
    ],
    temperature: settings.temperatureAssets, // 战略层用低温
    max_tokens: 3072,
    signal,
    onDelta,
  });

  // validate JSON
  const stripped = res.content.replace(/^```(?:json)?\s*|\s*```$/g, '').trim();
  try { JSON.parse(stripped); } catch (e: any) {
    recordRun({
      projectId: 0,
      nodeId: R1_NODE_ID,
      stageId: 'screenplay',
      stepIndex: 0,
      title: 'R1 创作指令书',
      ts: Date.now(),
      status: 'error',
      durationMs: Date.now() - t0,
      error: 'R1 invalid JSON: ' + e.message,
      model: settings.model,
    }).catch(() => {});
    throw new Error('R1 输出非合法 JSON：' + e.message);
  }

  const durationMs = res.durationMs ?? (Date.now() - t0);
  recordRun({
    projectId: 0,
    nodeId: R1_NODE_ID,
    stageId: 'screenplay',
    stepIndex: 0,
    title: 'R1 创作指令书',
    ts: Date.now(),
    status: 'done',
    durationMs,
    tokens: res.usage?.total_tokens,
    contentLength: stripped.length,
    contentSnapshot: stripped.length > 4096 ? stripped.slice(0, 4096) + '…' : stripped,
    model: settings.model,
    temperature: settings.temperatureAssets,
  }).catch(() => {});

  return {
    nodeId: R1_NODE_ID,
    stageId: 'screenplay',
    index: 0,
    title: 'R1 创作指令书',
    format: 'json',
    content: stripped,
    tokens: res.usage?.total_tokens,
    durationMs,
    ts: Date.now(),
  };
}

/**
 * Build a CONDENSED directive header for downstream visual stages
 * (assets / storyboard). 仅保留对视觉/分镜决策有约束力的字段:
 *  - themeAnchor: 防止资产/分镜风格偏离主题
 *  - positioningHook: 帮助选择视觉钩子
 *  - doNots: 红线（必须遵守）
 *  - mustKeep / mustCut (改编模式): 影响资产忠实度与分镜元素选择
 *
 * 不含 audienceProfile / genreStrategy / beatStrategy / rationale 以节约 tokens.
 */
export function buildCondensedDirectiveHeader(r1?: NodeArtifact): string {
  if (!r1) return '';
  let parsed: any;
  try { parsed = JSON.parse(r1.content); } catch { return ''; }
  const isAdapt = !!parsed.adaptationStrategy;
  const lines: string[] = [
    isAdapt
      ? '# 上游 R1\' 改编指令书摘要（视觉决策必须遵守）'
      : '# 上游 R1 创作指令书摘要（视觉决策必须遵守）',
  ];
  if (parsed.themeAnchor)     lines.push(`- 主题锚定: ${parsed.themeAnchor}`);
  if (parsed.positioningHook) lines.push(`- 一句话钩子: ${parsed.positioningHook}`);
  if (isAdapt) {
    if (Array.isArray(parsed.mustKeep) && parsed.mustKeep.length) {
      lines.push('- 必保留 (mustKeep, 资产/分镜须忠实呈现):');
      for (const d of parsed.mustKeep.slice(0, 6)) lines.push(`  · ${d}`);
    }
    if (Array.isArray(parsed.mustCut) && parsed.mustCut.length) {
      lines.push('- 必裁掉 (mustCut, 不得在视觉中出现):');
      for (const d of parsed.mustCut.slice(0, 5)) lines.push(`  · ${d}`);
    }
  }
  if (Array.isArray(parsed.doNots) && parsed.doNots.length) {
    lines.push('- 红线（视觉/构图同样适用）:');
    for (const d of parsed.doNots) lines.push(`  · ${d}`);
  }
  lines.push('---');
  return lines.length > 1 ? lines.join('\n') : '';
}

// Build the directive header to prepend into every screenplay step's system.
export function buildDirectiveHeader(r1?: NodeArtifact): string {
  if (!r1) return '';
  let parsed: any;
  try { parsed = JSON.parse(r1.content); } catch { return ''; }
  const isAdapt = !!parsed.adaptationStrategy;
  const lines: string[] = [
    isAdapt
      ? '# 改编指令书（R1\' 总编已锁定 · 不可变上游契约）'
      : '# 创作指令书（R1 总编已锁定 · 不可变上游契约）',
  ];
  if (parsed.themeAnchor)    lines.push(`- 主题锚定: ${parsed.themeAnchor}`);
  if (parsed.audienceProfile) lines.push(`- 受众画像: ${parsed.audienceProfile}`);
  if (parsed.genreStrategy)  lines.push(`- 题材策略: ${parsed.genreStrategy}`);
  if (parsed.positioningHook) lines.push(`- 一句话钩子: ${parsed.positioningHook}`);
  if (parsed.beatStrategy)   lines.push(`- 节拍策略: ${parsed.beatStrategy}`);
  if (isAdapt) {
    lines.push(`- 改编策略: ${parsed.adaptationStrategy}`);
    if (Array.isArray(parsed.mustKeep) && parsed.mustKeep.length) {
      lines.push('- 必须保留 (mustKeep):');
      for (const d of parsed.mustKeep) lines.push(`  · ${d}`);
    }
    if (Array.isArray(parsed.mustCut) && parsed.mustCut.length) {
      lines.push('- 必须裁掉 (mustCut):');
      for (const d of parsed.mustCut) lines.push(`  · ${d}`);
    }
    if (Array.isArray(parsed.riskList) && parsed.riskList.length) {
      lines.push('- 改编风险 (riskList):');
      for (const r of parsed.riskList) {
        lines.push(`  · [${r.kind}] ${r.issue}${r.mitigation ? ` → ${r.mitigation}` : ''}`);
      }
    }
  }
  if (Array.isArray(parsed.doNots) && parsed.doNots.length) {
    lines.push('- 红线（必须遵守）:');
    for (const d of parsed.doNots) lines.push(`  · ${d}`);
  }
  lines.push('---');
  return lines.join('\n');
}

// ---------- R9 ----------------------------------------------------------------

const R9_SYSTEM = `你是「总编」(R9)，对完整剧本（Step 1-8 全部产物）做**主题维度终审**, 输出四级裁决。

## 仅限主题/受众/商业判断, 禁做技术审计（伏笔/时间线已由其他角色检验）

## 重要: 上游已附「QA 信号」(self-check + consistency)
- user 消息中若出现 "## QA 信号" 区块, 你必须将其作为客观证据基础
- criticalIssues 中**必须**援引至少一条 QA 信号 (若有), 不得只凭主观感觉报问题
- 若 QA 信号中已被标记 fail/critical, 你的 verdict 不得高于 REVISION_MAJOR

## 输出 JSON schema (严格, 无 markdown 围栏)
{
  "verdict": "APPROVED | REVISION_MINOR | REVISION_MAJOR | REJECTED",
  "themeFit":      { "score": 0-10, "comment": "string" },
  "audienceFit":   { "score": 0-10, "comment": "string" },
  "marketability": { "score": 0-10, "comment": "string" },
  "directiveAlignment": { "score": 0-10, "comment": "与 R1 创作指令书的一致度" },
  "criticalIssues": [
    { "stepRef": 1-8, "issue": "string", "suggestion": "string" }
  ],
  "recommendation": "string ≤200 字, 给出明确下一步动作"
}

## 裁决标准
- APPROVED        : 三维度均 ≥7, criticalIssues 为空
- REVISION_MINOR  : 任一维度 5-6, 仅有 minor 修订（用词 / 节奏微调）
- REVISION_MAJOR  : 任一维度 ≤4 或有 critical issue, 需回退到具体 Step 重做
- REJECTED        : 偏离 R1 指令书 / 触碰红线 / 主题不可救药`;

const R9_ADAPTATION_SYSTEM = `你是「改编总编」(R9')，对完整改编剧本（S0 原作档案 + R1' 改编指令书 + Step 1-8 全部产物）做**改编质量终审**。

## 输出 JSON schema (严格, 无 markdown 围栏)
{
  "verdict": "APPROVED | REVISION_MINOR | REVISION_MAJOR | REJECTED",
  "themeFit":      { "score": 0-10, "comment": "string" },
  "audienceFit":   { "score": 0-10, "comment": "string" },
  "marketability": { "score": 0-10, "comment": "string" },
  "directiveAlignment": { "score": 0-10, "comment": "与 R1' 改编指令书的一致度" },
  "fidelityScore":   { "score": 0-10, "comment": "对原作 mustKeep 的执行度 / 标志元素保留度" },
  "originalityScore":{ "score": 0-10, "comment": "在保留原作 DNA 的前提下，是否有再创作的灵气" },
  "ipRiskCheck": "PASS | WARN | FAIL",
  "criticalIssues": [
    { "stepRef": "A1 | A2 | A3 | A4 | A5 | A6", "issue": "string", "suggestion": "string" }
  ],
  "recommendation": "string ≤200 字, 给出明确下一步动作"
}

## 裁决标准
- APPROVED        : 6 维度全 ≥7 且 ipRiskCheck = PASS
- REVISION_MINOR  : 任一维度 5-6 且 ipRiskCheck != FAIL
- REVISION_MAJOR  : 任一维度 ≤4 或 fidelityScore<5 或 ipRiskCheck = WARN
- REJECTED        : ipRiskCheck = FAIL 或 偏离 R1' / 触碰原作版权方红线

## ipRiskCheck 扫描准则 (仅接上方 KB「IP / 合规风险扫描清单」逐项根据)
- 必须逐项扫描 5 个维度：版权 (UCR57.1) / 肖像 (57.2) / 涉政涉军涉警涉宗教 (57.3) / 未成年保护 (57.4) / 平台差异 (57.5)
- 命中任意一项 P0 项 → 「FAIL」；仅命中 P1 项 → 「WARN」；零命中才能「PASS」
- 所有 WARN/FAIL 命中项都要以 criticalIssues 表项列出，且在 recommendation 中给出具体 mitigation (改名 / 打码 / 换音乐 / 加声明)

## fidelityScore 评分准则
- 检查下游 8 步产物 vs R1' 的 mustKeep 清单：完整体现 ≥7 / 部分体现 4-6 / 丢失严重 ≤3
- 检查原作金句（standoutLines）是否被保留或合理重塑

## originalityScore 评分准则
- 在保留原作 DNA 的前提下，是否有本土化重塑 / 人设适配现代观众 / 节奏重新设计等亮点
- 创意重塑是加分，但违反 mustKeep 是减分

## 重要: 上游已附「QA 信号」(self-check + consistency)
- user 消息中若出现 "## QA 信号" 区块, 你必须将其作为客观证据基础
- criticalIssues 中**必须**援引至少一条 QA 信号 (若有), 不得只凭主观感觉报问题
- 若 QA 信号中已被标记 fail/critical, 你的 verdict 不得高于 REVISION_MAJOR
- consistency 报告中 verdict=fail 时, fidelityScore 必须 ≤ 5`;

export async function runR9Verdict(opts: {
  project: ProjectContext;
  artifacts: ArtifactMap;
  settings: SettingsState;
  signal?: AbortSignal;
  onDelta?: (chunk: string, full: string) => void;
}): Promise<NodeArtifact> {
  const { project, artifacts, settings, signal, onDelta } = opts;
  if (!settings.apiKey) throw new Error('请先在设置里填写 API Key');

  const isAdaptation = project.createMode === 'adaptation';
  const baseSys = isAdaptation ? R9_ADAPTATION_SYSTEM : R9_SYSTEM;
  // Inject IP risk checklist KB when in adaptation mode
  let sys = baseSys;
  if (isAdaptation) {
    try {
      const blocks = await loadKbForNode(R9_NODE_ID, { adaptation: true });
      const kbHead = buildKbPreamble(blocks);
      if (kbHead) sys = kbHead + '\n\n' + baseSys;
    } catch (e) {
      console.warn('[r9] kb inject failed:', e);
    }
  }
  const r1 = artifacts[R1_NODE_ID];
  const s0 = artifacts[S0_NODE_ID];
  // 改编模式读 adapt.* (6 步)；原创模式读 screenplay.* (8 步)
  const screenplayTitles: Record<number, string> = {
    1: '破题', 2: '梗概', 3: '人物', 4: '前史世界观',
    5: '结构', 6: '场次拆解', 7: '场景写作', 8: '剧本医生',
  };
  const adaptTitles: Record<number, string> = {
    1: '改编梗概', 2: '人物适配表', 3: '短剧化结构大纲',
    4: '场次拆解', 5: '场景写作', 6: '改编剧本医生',
  };
  const lines: string[] = [
    `# 项目终审包`,
    `- 项目: ${project.name}`,
    `- 概念: ${project.concept}`,
    `- 时长: ${project.durationMin} 分钟`,
    `- 创作模式: ${isAdaptation
        ? `改编 (${project.adaptationType === 'novel' ? '小说/网文' : '旧剧本翻拍'})`
        : '原创'}`,
    '',
  ];
  if (isAdaptation && s0) {
    lines.push('## S0 原作档案');
    const body = s0.content.length > 3000 ? s0.content.slice(0, 3000) + '\n…（已截断）' : s0.content;
    lines.push(body);
    lines.push('');
  }
  if (r1) {
    lines.push(isAdaptation ? "## R1' 改编指令书" : '## R1 创作指令书');
    lines.push(r1.content);
    lines.push('');
  }
  if (isAdaptation) {
    for (let i = 1; i <= 6; i++) {
      const a = artifacts[`adapt.${i}`];
      if (!a) continue;
      lines.push(`## A${i} · ${adaptTitles[i]}`);
      const body = a.content.length > 4000 ? a.content.slice(0, 4000) + '\n…（已截断）' : a.content;
      lines.push(body);
      lines.push('');
    }
  } else {
    for (let i = 1; i <= 8; i++) {
      const a = artifacts[`screenplay.${i}`];
      if (!a) continue;
      lines.push(`## Step ${i} · ${screenplayTitles[i]}`);
      const body = a.content.length > 4000 ? a.content.slice(0, 4000) + '\n…（已截断）' : a.content;
      lines.push(body);
      lines.push('');
    }
  }

  // ── 资产 / 分镜 产物摘要 (仅摘头，控制 token) ────────────────
  const visualLines = buildVisualSummaryBlock(artifacts);
  if (visualLines) {
    lines.push(visualLines);
    lines.push('');
  }

  // ── QA 信号：self-check reports + consistency report ───────────────
  const qaBlock = buildQaSignalsBlock(artifacts);
  if (qaBlock) {
    lines.push(qaBlock);
    lines.push('');
  }

  lines.push('请严格按 system 的 verdict JSON schema 输出，无 markdown 围栏。');

  const res = await chatStream({
    baseUrl: settings.baseUrl,
    apiKey: settings.apiKey,
    model: settings.model,
    messages: [
      { role: 'system', content: sys },
      { role: 'user',   content: lines.join('\n') },
    ],
    temperature: settings.temperatureAssets,
    max_tokens: 4096,
    signal,
    onDelta,
  });

  const stripped = res.content.replace(/^```(?:json)?\s*|\s*```$/g, '').trim();
  try { JSON.parse(stripped); } catch (e: any) {
    recordRun({
      projectId: 0,
      nodeId: R9_NODE_ID,
      stageId: 'screenplay',
      stepIndex: 9,
      title: 'R9 总编裁决',
      ts: Date.now(),
      status: 'error',
      durationMs: res.durationMs ?? 0,
      error: 'R9 invalid JSON: ' + e.message,
      model: settings.model,
    }).catch(() => {});
    throw new Error('R9 输出非合法 JSON：' + e.message);
  }

  recordRun({
    projectId: 0,
    nodeId: R9_NODE_ID,
    stageId: 'screenplay',
    stepIndex: 9,
    title: 'R9 总编裁决',
    ts: Date.now(),
    status: 'done',
    durationMs: res.durationMs ?? 0,
    tokens: res.usage?.total_tokens,
    contentLength: stripped.length,
    contentSnapshot: stripped.length > 4096 ? stripped.slice(0, 4096) + '…' : stripped,
    model: settings.model,
    temperature: settings.temperatureAssets,
  }).catch(() => {});

  return {
    nodeId: R9_NODE_ID,
    stageId: 'screenplay',
    index: 9,
    title: 'R9 总编裁决',
    format: 'json',
    content: stripped,
    tokens: res.usage?.total_tokens,
    durationMs: res.durationMs,
    ts: Date.now(),
  };
}

/**
 * Build a compact summary of assets / storyboard artifacts for R9 review.
 * 仅输出节点存在性、字数、关键 meta 摘要，不灌入完整内容（控制 token 成本）。
 */
function buildVisualSummaryBlock(artifacts: ArtifactMap): string {
  const lines: string[] = [];
  const assetNodes: Array<[string, string]> = [
    ['assets.1', '资产扫描清单'],
    ['assets.2', '角色卡'],
    ['assets.3', '场景卡'],
    ['assets.4', '道具卡'],
  ];
  const sbNodes: Array<[string, string]> = [
    ['storyboard.1', '分镜规划 (Phase A-D)'],
    ['storyboard.2', '分镜逐单元 (Phase E-G)'],
  ];
  const present: string[] = [];
  for (const [id, label] of [...assetNodes, ...sbNodes]) {
    const a = artifacts[id];
    if (!a) continue;
    const head = a.content.length > 1500 ? a.content.slice(0, 1500) + '\n…（已截断）' : a.content;
    present.push(`### ${id} · ${label}（${a.content.length} 字）\n${head}`);
  }
  if (!present.length) return '';
  lines.push('## 视觉产物摘要 (assets / storyboard)');
  lines.push('（仅供主题/受众一致性参考；技术细节已由 self-check / consistency 校验）');
  lines.push('');
  lines.push(present.join('\n\n'));
  return lines.join('\n');
}

/**
 * Aggregate self-check reports stored in artifact.meta.selfCheck plus the
 * static consistency report computed from current artifacts. Empty string
 * if no signals available — R9 then falls back to pure subjective review.
 */
function buildQaSignalsBlock(artifacts: ArtifactMap): string {
  const lines: string[] = [];

  // 1. Self-check reports from each artifact's meta
  const selfChecks: Array<{ nodeId: string; report: SelfCheckReport }> = [];
  for (const [id, a] of Object.entries(artifacts)) {
    const r = (a.meta as any)?.selfCheck as SelfCheckReport | undefined;
    if (r && r.verdict) selfChecks.push({ nodeId: id, report: r });
  }

  // 2. Consistency report (only meaningful if storyboard.2 exists)
  const hasSb2 = !!artifacts['storyboard.2'];
  let consistency: ReturnType<typeof buildConsistencyReport> | null = null;
  if (hasSb2) {
    try { consistency = buildConsistencyReport({ artifacts }); }
    catch { consistency = null; }
  }

  if (!selfChecks.length && !consistency) return '';

  lines.push('## QA 信号');
  lines.push('（上游已自动检测的客观问题；R9 必须将以下条目作为 criticalIssues 援引依据）');
  lines.push('');

  if (selfChecks.length) {
    lines.push('### Self-check 报告（按节点）');
    for (const { nodeId, report } of selfChecks) {
      lines.push(`- **${nodeId}** · verdict=${report.verdict} · ${report.summary}`);
      const major = report.issues.filter((i) => i.severity === 'critical' || i.severity === 'major');
      for (const it of major.slice(0, 5)) {
        lines.push(`  · [${it.severity}] ${it.tag}: ${it.detail}`);
      }
      if (major.length > 5) lines.push(`  · …还有 ${major.length - 5} 项 major+`);
    }
    lines.push('');
  }

  if (consistency) {
    lines.push('### 资产 ↔ 分镜 一致性');
    lines.push(`- verdict=${consistency.verdict} · ${consistency.summary}`);
    const blocking = consistency.issues.filter((i) => i.severity !== 'info');
    for (const it of blocking.slice(0, 8)) {
      const loc = it.unitIndex != null ? ` @UNIT ${it.unitIndex}` : '';
      lines.push(`  · [${it.severity}] ${it.entityKind} 「${it.name}」${loc}: ${it.detail}`);
    }
    if (blocking.length > 8) lines.push(`  · …还有 ${blocking.length - 8} 项`);
    lines.push('');
  }

  return lines.join('\n');
}

export function parseR9(content: string): {
  verdict: 'APPROVED' | 'REVISION_MINOR' | 'REVISION_MAJOR' | 'REJECTED' | string;
  scores: {
    theme?: number; audience?: number; marketability?: number; directive?: number;
    fidelity?: number; originality?: number;
  };
  ipRiskCheck?: 'PASS' | 'WARN' | 'FAIL' | string;
  criticalIssues: Array<{ stepRef?: number; stepLabel?: string; issue: string; suggestion?: string }>;
  recommendation: string;
  isAdaptation: boolean;
} | null {
  try {
    const j = JSON.parse(content);
    const isAdaptation = j.fidelityScore != null || j.ipRiskCheck != null;
    // 支持 stepRef 形如 "A3" / "S5" / 数字 3
    const normIssues = (Array.isArray(j.criticalIssues) ? j.criticalIssues : []).map((it: any) => {
      const raw = it.stepRef;
      let stepRef: number | undefined;
      let stepLabel: string | undefined;
      if (typeof raw === 'number') {
        stepRef = raw;
        stepLabel = isAdaptation ? `A${raw}` : `Step ${raw}`;
      } else if (typeof raw === 'string') {
        const m = raw.match(/(\d+)/);
        stepRef = m ? Number(m[1]) : undefined;
        stepLabel = raw;
      }
      return { ...it, stepRef, stepLabel };
    });
    return {
      verdict: j.verdict ?? 'unknown',
      scores: {
        theme: j.themeFit?.score,
        audience: j.audienceFit?.score,
        marketability: j.marketability?.score,
        directive: j.directiveAlignment?.score,
        fidelity: j.fidelityScore?.score,
        originality: j.originalityScore?.score,
      },
      ipRiskCheck: j.ipRiskCheck,
      criticalIssues: normIssues,
      recommendation: j.recommendation ?? '',
      isAdaptation,
    };
  } catch { return null; }
}
