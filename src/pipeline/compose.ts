// Compose the actual chat messages sent to DeepSeek for a given step,
// by splicing the project context + upstream artifacts into the raw payload.
//
// Strategy per stage:
//
//   screenplay.s1 .. s8  →  apply project ctx to user msg; for s>=2 append
//                           "## 上游产物（前序步骤）" with prior outputs.
//   assets.1            →  REPLACE user msg with the finished screenplay
//                           (output of screenplay.s7).
//   assets.{2,3,4}      →  REPLACE user msg with screenplay; PREPEND the
//                           scan summary from assets.1 as scan context.
//   storyboard.1        →  REPLACE user msg with JSON {paragraphIndex,assetList}
//   storyboard.2        →  caller is responsible for providing per-unit context
//                           (see runner.ts loopStoryboard, M5).
//
// All composition is pure: (payload, ctx, artifacts) → ChatMessage[].

import type { ChatMessage } from '../llm/deepseek';
import type {
  ArtifactMap,
  ManifestStep,
  ProjectContext,
  RawPromptPayload,
  StageId,
} from './types';
import { applyProjectContext, interpolate } from './interpolate';
import { paragraphize } from './paragraphize';
import { buildKbPreamble, loadKbForNode } from './kb';
import { listUserKbDocsForProject, type UserKbDocType } from '../store/userKb';
import { buildUserKbPreamble } from '../llm/extractKb';
import { loadMethodModulesForNode, buildMethodModulePreamble } from './methodModules';
import { buildDirectiveHeader, buildCondensedDirectiveHeader, R1_NODE_ID } from './editorial';
import { findGenreAnchor, findGenre, type GenreAnchor } from '../data/projectTaxonomy';
import { S0_NODE_ID, parseMaster, buildMasterDigest } from './intake';
import {
  buildPhase2UnitUser,
  type ParsedPlan,
  type PlannedUnit,
} from './storyboardPlan';

/**
 * storyboard.1 双输出契约：在原 system prompt 末尾追加，要求模型在 markdown
 * 之后再附一段机器可读的 <plan-json>。下游 storyboard.2 用 JSON 路径解析，
 * 完全规避 markdown 装饰（**bold**、bullet 列表、中文冒号等）造成的解析事故。
 */
const STORYBOARD1_JSON_ADDENDUM = `
# 输出双契约 (Phase A-D 必须遵守)

除了已规定的 markdown 输出之外, **必须**在最末尾再附一段机器可读 JSON, 用 \`<plan-json>...</plan-json>\` 标签包裹, 内容为下方 schema 的实例。markdown 与 JSON 必须一致, 以 JSON 为机器消费源, markdown 为人类阅读源。

## JSON Schema

\`\`\`
<plan-json>
{
  "meta": {
    "structureType": "linear" | "parallel" | "frame",
    "totalSec": <number>,
    "totalUnits": <number>
  },
  "paragraphs": [
    { "sectionId": "§1", "人物": "...", "动作": "...", "台词": "...", "道具": "...", "场景": "...", "情绪": "..." }
  ],
  "peaks":    [ { "sectionId": "§N", "kind": "情绪|信息|动作", "originalRef": "..." } ],
  "buffers":  [ { "sectionId": "§N", "reason": "..." } ],
  "subtexts": [ { "sectionId": "§N", "description": "..." } ],
  "units": [
    {
      "unitIndex": 1,
      "sceneId": 1,
      "sectionRefs": ["§1", "§2"],
      "durationSec": 14,
      "sceneType": "文戏" | "快文戏" | "武戏" | "动作非武" | "环境",
      "subShotCount": 3,
      "summary": "一句话单元概要",
      "plannedEntryState": "起幅锚点 (位置/姿态/镜头距离)",
      "plannedExitState":  "落幅锚点 (与下一单元 plannedEntryState 必须画面一致)"
    }
  ]
}
</plan-json>
\`\`\`

## 严禁
- 把 JSON 放在围栏 \`\`\`json ... \`\`\` 内 (除非也在 plan-json 标签里)
- 把单元字段写成 markdown 列表或 \`**bold**\` (markdown 区域可以, JSON 区域必须是合法 JSON)
- sectionRefs 用其他形式 (必须是 \`["§N", ...]\` 数组的 §N 字符串)
- 遗漏任意 unit 的任意字段

## 一致性要求
- units[*].sectionRefs 中每个 §N 必须出现在 paragraphs[*].sectionId
- units[i].plannedExitState 与 units[i+1].plannedEntryState 画面一致
- sum(units[*].durationSec) ≈ meta.totalSec (±15%)
`;

/**
 * 反装饰约束：在所有「结构化产物」节点末尾追加。
 * 仅约束结构化字段不要用 markdown 装饰污染，不约束剧本叙事文本本身。
 */
const ANTI_DECORATION_ADDENDUM = `
# 反装饰硬律 (Anti-Decoration)
你的输出会被下游解析器逐字段消费, 任何装饰都会破坏管线.

## 严禁
- 在「字段名 / 字段值」上用 \`**粗体**\` / \`*斜体*\` / \`~~删除线~~\`
- 把字段值写进 \`> blockquote\` 或带颜色 emoji 前缀 (✅❌🎬🔥 等)
- 把 JSON 放在 \`\`\`json ... \`\`\` 围栏内 (除非 prompt 明确要求围栏)
- 把数组写成 markdown 列表 (\`- \` / \`1. \`); 应是 \`["a", "b"]\`
- 多余装饰: "---", "\\n\\n\\n", ASCII 边框 (\`+----+\`)
- 在结构化字段中写"以上"、"如上图"等指代

## 允许
- 章节级 \`## 标题\` / \`### 子标题\` 用于人读分区
- 自然散文段落 (剧本叙事、情绪描写 OK)
- prompt 明确要求的格式化 (如「输出表格」「输出 JSON」)

## 检查清单 (输出前自校)
1. 字段值是不是裸文本 / 数字 / 数组 / 对象? (不是带 \\\` 或 \\\*\\\*)
2. JSON 区域是不是合法 JSON? (能 \`JSON.parse\` 过)
3. 有没有出现 prompt 没要求的 emoji?
4. 有没有把 \`["§1", "§2"]\` 写成 \`§1, §2\` 或 \`- §1\\n- §2\`?
`;

const ADAPTATION_SCREENPLAY_ADDENDUM = `
# 改编模式硬律 (Adaptation Mode)

## 上游契约
- 你正在改编现有原作 (网文/小说/旧剧本)，不是从零创作
- 上方的「原作档案 (S0)」与「改编指令书 (R1')」是不可变上游契约
- 必须遵守 R1' 的 mustKeep / mustCut / adaptationStrategy / riskList
- 涉及人物 / 世界规则 / 标志台词时，**优先复用原作**而非另起炉灶
- 若本步需创作的元素已存在于原作档案，直接引用并标注 "[源自原作]"
- 若与档案冲突，必须优先档案而非本步 user 指令

## 5 大致命错误（任意触犯一条都会被 R9' 打回）
1. ❌ 过度忠于原著 → 节奏拖沓。正解：大胆删减，只留核心冲突和爽点
2. ❌ 节奏过慢 → 观众滑走。正解：3 秒进冲突，删除所有铺垫
3. ❌ 心理描写过多 → 看不懂。正解：心理 → 动作 / 心理 → 对话 / 心理 → 删除
4. ❌ 支线过多 → 主线模糊。正解：主线 80% + 重要支线 15% + 其他删除
5. ❌ 人物过多 → 记不住。正解：主角 + 主要配角 5-8 人，工具人合并

## 5 大核心原则（决策时按此优先级）
1. 情绪钩子 > 故事完整性（能让观众"卧槽"比逻辑严密重要）
2. 视觉化 > 抽象描写（动作 > 心理；可拍 > 可读）
3. 快节奏强制（3 秒进冲突，每 30 秒必有推进，每集必有【卡黑】悬念）
4. 尊重原作结构（不要把网文连载强行重构成三幕式）
5. 算法友好（完播率 = 强悬念；互动率 = 争议点；传播率 = 金句台词）

## 单集体量参考
- 短剧每集 ≤ 2 分钟时：原作 1-2 个核心章节 / 段落 = 1 集，不要贪多
- 起承转钩 4 段法：开场 3 秒切冲突 / 15 秒节点信息 / 30 秒大反转 / 结尾卡黑钩子
---
`;

/**
 * 决定本步是否注入反装饰约束。规则：
 * - assets / storyboard 阶段全部注入（结构化产物为主）
 * - screenplay.r1 / screenplay.r9（编辑部裁决）注入：要求 JSON 化结论
 * - 其他 screenplay / adapt 步骤豁免：让模型自由叙事
 */
/**
 * 用户资料库 v2 · 节点 → 允许注入的 doc type 映射。
 *
 * 设计原则：
 * - 越靠前的节点（世界观 / 大纲）越多注入「趋势」类资料，影响题材选择
 * - 越靠后的节点（章节草稿 / 润色）越多注入「范文 / 反例 / 偏好」，影响文笔
 * - 偏好（styleGuide）全节点注入（如果有的话）；篇幅由 buildUserKbPreamble 控制
 * - 静态 KB 已覆盖的节点（screenplay / storyboard / assets / adapt），暂不重复注入
 *   用户 KB 即使绑定也只生效在 novel.* 节点（小说流程是 v2 主战场）
 */
function userKbTypesForNode(nodeId: string): UserKbDocType[] {
  // 仅对 novel.* 流程启用用户 KB 注入（v2 一期范围）
  if (!nodeId.startsWith('novel.')) return [];

  // novel.1 世界观 / 1.2 角色 bible：题材趋势 + 世界硬骨架 + 偏好 + 拆书参考
  if (nodeId === 'novel.1' || nodeId === 'novel.1.1') {
    return ['trend', 'bookAnalysis', 'styleGuide', 'worldHardSchema'];
  }
  if (nodeId === 'novel.1.2') {
    return ['trend', 'bookAnalysis', 'styleGuide', 'worldHardSchema', 'voiceCard'];
  }
  // novel.2.1 / 2.2 / 2.3 分卷 + 分章 + 伏笔：趋势 + 偏好 + 拆书（影响节奏 / 反转 / 结构选择）
  if (nodeId.startsWith('novel.2')) {
    return ['trend', 'bookAnalysis', 'styleGuide'];
  }
  // novel.3.1 章节草稿：全注入（含范文 + 反例 + 声纹）—— bookAnalysis 不注入此节点
  // 原因：章节级执行时上下文已经很重（范文 + 反例 + 声纹 + 世界硬骨架），
  // 拆书的"宏观方法论"对章节级具体写作贡献有限，反而增加 token 成本。
  if (nodeId === 'novel.3.1') {
    return ['trend', 'styleGuide', 'sample', 'antiPattern', 'voiceCard', 'worldHardSchema'];
  }
  // novel.3.2 润色：偏好 + 反例 + 范文（去 AI 化模式特别需要反例）
  if (nodeId === 'novel.3.2') {
    return ['styleGuide', 'antiPattern', 'sample'];
  }
  // 其他 novel 节点（n0 等未来扩展）：保守注入趋势 + 偏好
  return ['trend', 'styleGuide'];
}

function shouldInjectAntiDecoration(stageId: StageId, step: ManifestStep): boolean {
  if (stageId === 'assets' || stageId === 'storyboard') return true;
  if (step.id === 'screenplay.r1' || step.id === 'screenplay.r9') return true;
  if (step.outFormat === 'json') return true;
  return false;
}

/**
 * 全局创作硬约束（7 条）— 提炼自天命网文 AI 平台的小说初稿生成器规范，
 * 改写为 cineforge 体系契合版本。覆盖所有"叙事正文创作"节点，是不依赖
 * 具体方法模块的最低基线，与 anti-ai-flavor 等可选模块互补。
 *
 * Reference:
 *   - docs/internal-notes/novel-creation-pipeline-spec.md §6 (七条硬约束)
 *   - docs/reference-works/tianming-platform-prompts-original.txt L120-131
 */
const GLOBAL_CREATION_CONSTRAINTS = `
# 创作硬约束（不可违反）

以下 7 条是所有正文创作的最低基线，优先级仅次于「上方注入的设定/资料/方法模块」，高于本步 user 指令的所有局部要求。冲突时按本节执行。

1. **设定保护**：绝对遵循已注入的世界观、力量体系、角色性格、历史设定与既往情节，不得擅自修改、违反或引入未定义元素。
2. **上文优先**：上方注入的资料库（静态 KB / 用户上传 KB / 方法模块）具有更高优先级；与本步 user 指令冲突时，以上文为准。
3. **剧情一致**：生成内容必须与前文情节、角色关系、伏笔走向保持一致，不得自相矛盾；引用角色时使用已定义姓名，禁止"某某"、"另一人"等模糊指代。
4. **纯正文输出**：直接输出创作正文，禁止任何 AI 过渡语（"好的，我将..."、"以下是..."、"希望对你有帮助"、"如有需要请告诉我"等）。
5. **禁止情节重置**：不得复述上一章 / 上一场尾部已发生的动作、对话或结论；必须从上文结尾状态直接向前推进。
6. **禁止段落复读**：不得在不同段落中重复表达同一信息或场景；每段必须推进新内容（哪怕只是一个新的细节或视角变化）。
7. **禁止原地打转**：每个场景必须产生至少一项实质推进 —— 行动结果 / 信息揭示 / 关系变化 / 冲突升级。禁止用反复铺陈情绪、重新确认目标、重新介绍背景来凑字数。
`;

/**
 * 决定本步是否注入全局创作硬约束。规则：
 * - 仅注入到「叙事正文创作」节点：剧本场景 / 改编场景 / 小说章节草稿与润色
 * - 不注入到结构化设计节点（世界观大纲 / 分卷设计 / JSON 资产 / 编辑部裁决）
 *   因为它们的"输出形态"不是连续叙事正文，7 条约束（如"禁止段落复读"）不适用
 */
function shouldInjectCreationConstraints(stageId: StageId, step: ManifestStep): boolean {
  // JSON / 编辑部裁决 / 资产清单等结构化输出豁免
  if (step.outFormat === 'json') return false;
  if (step.id === 'screenplay.r1' || step.id === 'screenplay.r9') return false;
  // 剧本场景：screenplay.s1 - s8
  if (stageId === 'screenplay' && /^screenplay\.s?\d+$/.test(step.id)) return true;
  // 改编场景：adapt.s1 - s6
  if (stageId === 'adapt' && /^adapt\.s?\d+$/.test(step.id)) return true;
  // 小说章节草稿与润色：novel.3.1 / novel.3.2
  if (step.id === 'novel.3.1' || step.id === 'novel.3.2') return true;
  return false;
}

/**
 * 题材锚点注入：根据 ctx.genres 查找对应锚点配置，合并去重后拼接为
 * 一段 system prompt 段落。多题材组合（最多 3 个）时按以下规则合并：
 *   - mustInclude / mustAvoid: 全集合并去重（强约束累加）
 *   - worldRules / pronounUsage / rhythmRequirement: 按 ctx.genres 顺序拼接，前者权重更高
 *   - paragraphLength / dialogueRatio: 取均值
 *
 * 注入条件：
 *   - 仅当 ctx.genres 非空且至少一个题材有 anchor 配置
 *   - 仅对叙事正文创作节点 + 创作规划节点（不含 JSON 输出与编辑部裁决）
 */
function buildGenreAnchorPreamble(genres: string[] | undefined): string {
  if (!genres || genres.length === 0) return '';
  const anchors = genres
    .map((v) => ({ value: v, label: findGenre(v)?.label ?? v, anchor: findGenreAnchor(v) }))
    .filter((x): x is { value: string; label: string; anchor: GenreAnchor } => !!x.anchor);
  if (anchors.length === 0) return '';

  // 合并 mustInclude / mustAvoid（去重保序）
  const dedup = (xs: string[]) => Array.from(new Set(xs.map((s) => s.trim())).values());
  const allMustInclude = dedup(anchors.flatMap((a) => a.anchor.mustInclude ?? []));
  const allMustAvoid = dedup(anchors.flatMap((a) => a.anchor.mustAvoid ?? []));

  // 拼接 worldRules（按权重顺序，每条加题材标签）
  const worldRulesLines = anchors
    .map((a) => (a.anchor.worldRules ? `- 【${a.label}】${a.anchor.worldRules}` : ''))
    .filter(Boolean);
  const pronounLines = anchors
    .map((a) => (a.anchor.pronounUsage ? `- 【${a.label}】${a.anchor.pronounUsage}` : ''))
    .filter(Boolean);
  const rhythmLines = anchors
    .map((a) => (a.anchor.rhythmRequirement ? `- 【${a.label}】${a.anchor.rhythmRequirement}` : ''))
    .filter(Boolean);

  // 数值字段取均值（仅当至少一个题材有该字段）
  const paraVals = anchors.map((a) => a.anchor.paragraphLength).filter((n): n is number => typeof n === 'number');
  const diaVals = anchors.map((a) => a.anchor.dialogueRatio).filter((n): n is number => typeof n === 'number');
  const avgPara = paraVals.length ? Math.round(paraVals.reduce((s, x) => s + x, 0) / paraVals.length) : null;
  const avgDia = diaVals.length ? Math.round(diaVals.reduce((s, x) => s + x, 0) / diaVals.length) : null;

  const parts: string[] = [];
  parts.push('# 题材锚点（不可违反的题材级约束）');
  parts.push(`本作品题材定位：${anchors.map((a) => a.label).join(' + ')}。以下约束按题材合并，与你正在创作的故事必须保持一致。`);

  if (worldRulesLines.length) {
    parts.push('\n## 世界观核心规则');
    parts.push(worldRulesLines.join('\n'));
  }
  if (allMustInclude.length) {
    parts.push('\n## 必须包含（题材必备元素，应在故事中合理体现）');
    parts.push(allMustInclude.map((s) => `- ${s}`).join('\n'));
  }
  if (allMustAvoid.length) {
    parts.push('\n## 必须避免（强约束，违反即视为题材污染）');
    parts.push(allMustAvoid.map((s) => `- ${s}`).join('\n'));
  }
  if (pronounLines.length) {
    parts.push('\n## 人称运用细则');
    parts.push(pronounLines.join('\n'));
  }
  if (rhythmLines.length) {
    parts.push('\n## 节奏配方（参考）');
    parts.push(rhythmLines.join('\n'));
  }
  if (avgPara || avgDia) {
    const numHints: string[] = [];
    if (avgPara) numHints.push(`段落长度参考约 **${avgPara}** 字`);
    if (avgDia) numHints.push(`对话比例参考约 **${avgDia}%**`);
    parts.push('\n## 文体参数（参考，非硬上限）');
    parts.push('- ' + numHints.join('；'));
  }

  return parts.join('\n');
}

/**
 * 决定本步是否注入题材锚点。规则：
 * - JSON / 编辑部裁决 等结构化输出豁免（题材锚点是叙事级约束）
 * - 创作类节点（叙事正文 + 创作规划）均注入：剧本/改编场景、小说全节点
 * - 资产 / 分镜阶段豁免（视觉化阶段不需题材级文本约束）
 */
function shouldInjectGenreAnchor(stageId: StageId, step: ManifestStep): boolean {
  if (step.outFormat === 'json') return false;
  if (step.id === 'screenplay.r1' || step.id === 'screenplay.r9') return false;
  if (stageId === 'assets' || stageId === 'storyboard') return false;
  // 剧本 / 改编 / 小说阶段全部注入（含 novel.1/1.1/1.2/2.x 规划节点）
  if (stageId === 'screenplay' || stageId === 'adapt' || stageId === 'novel') return true;
  return false;
}

export interface ComposeInput {
  stageId: StageId;
  step: ManifestStep;
  payload: RawPromptPayload;
  project: ProjectContext;
  artifacts: ArtifactMap;
  // Optional override of the raw user message (e.g. user manually edited it).
  userOverride?: string;
  // Toggles
  enableKbInjection?: boolean;
  enableEditorialRounds?: boolean;
  // For storyboard.2 per-unit looping.
  unitContext?: { unit: PlannedUnit; plan: ParsedPlan };
}

export async function composeMessages(inp: ComposeInput): Promise<ChatMessage[]> {
  const {
    stageId, step, payload, project, artifacts, userOverride,
    enableKbInjection, enableEditorialRounds,
  } = inp;

  const baseSys = payload.messages.find((m) => m.role === 'system')?.content ?? '';
  const baseUser = userOverride ?? (payload.messages.find((m) => m.role === 'user')?.content ?? '');

  // ---- system enrichments (S0 master digest + R1 directive + KB blocks + adaptation addendum) ----
  const headerParts: string[] = [];
  const isAdaptation = project.createMode === 'adaptation';
  // adapt stage 本身就是改编专属流水线；screenplay 在 adaptation mode 下也复用同样的注入
  const wantAdaptInjection = stageId === 'adapt' || (isAdaptation && stageId === 'screenplay');

  // S0 原作档案
  if (wantAdaptInjection) {
    const s0 = artifacts[S0_NODE_ID];
    if (s0) {
      const digest = buildMasterDigest(parseMaster(s0.content));
      if (digest) headerParts.push(digest);
    }
  }
  // R1 / R1' directive
  if (enableEditorialRounds && (stageId === 'screenplay' || stageId === 'adapt')) {
    const head = buildDirectiveHeader(artifacts[R1_NODE_ID]);
    if (head) headerParts.push(head);
  }
  // Condensed R1 directive for visual stages (assets / storyboard) — only
  // theme-anchor / doNots / mustKeep so token cost stays low but red lines
  // and theme alignment propagate downstream to visual decisions.
  if (enableEditorialRounds && (stageId === 'assets' || stageId === 'storyboard')) {
    const head = buildCondensedDirectiveHeader(artifacts[R1_NODE_ID]);
    if (head) headerParts.push(head);
  }
  // KB injection — 静态内置 KB（基于 NODE_KB_MAP 硬编码映射）
  if (enableKbInjection) {
    try {
      const blocks = await loadKbForNode(step.id, { adaptation: wantAdaptInjection });
      const kbHead = buildKbPreamble(blocks);
      if (kbHead) headerParts.push(kbHead);
    } catch (e) {
      console.warn('[kb] inject failed for', step.id, e);
    }
  }
  // 用户资料库 v2 — 项目绑定的用户上传资料（趋势 / 偏好 / 反例 / 范文）
  // 与静态 KB 正交：静态 KB 是全局红线；用户 KB 是项目级风格资料。
  if (enableKbInjection && project.userKbDocIds?.length) {
    try {
      const allowedTypes = userKbTypesForNode(step.id);
      if (allowedTypes.length > 0) {
        const docs = await listUserKbDocsForProject(project.userKbDocIds);
        const filtered = docs.filter((d) => allowedTypes.includes(d.type));
        if (filtered.length > 0) {
          const ukbHead = buildUserKbPreamble(filtered, { nodeId: step.id });
          if (ukbHead) headerParts.push(ukbHead);
        }
      }
    } catch (e) {
      console.warn('[userKb] inject failed for', step.id, e);
    }
  }
  // 题材锚点（写什么）— 比方法模块（怎么写）更基础的题材级约束，应先注入
  if (shouldInjectGenreAnchor(stageId, step)) {
    const genreHead = buildGenreAnchorPreamble(project.genres);
    if (genreHead) headerParts.push(genreHead);
  }
  // 方法论模块（MBTI 五步法 / Save the Cat 等）— 项目启用 + 节点白名单
  if (enableKbInjection && project.methodModuleIds?.length) {
    try {
      const blocks = await loadMethodModulesForNode(project.methodModuleIds, step.id);
      const head = buildMethodModulePreamble(blocks);
      if (head) headerParts.push(head);
    } catch (e) {
      console.warn('[methodModule] inject failed for', step.id, e);
    }
  }
  // adaptation addendum 紧贴原 system 之上，提示模型"档案优先"
  let sys = baseSys;
  if (wantAdaptInjection) {
    sys = ADAPTATION_SCREENPLAY_ADDENDUM + '\n' + baseSys;
  }
  if (headerParts.length) sys = headerParts.join('\n\n') + '\n\n' + sys;

  // 反装饰约束：对结构化产物节点统一追加（创作类剧本步骤豁免，避免压抑创意）
  if (shouldInjectAntiDecoration(stageId, step)) {
    sys = sys + '\n\n' + ANTI_DECORATION_ADDENDUM;
  }

  // 全局创作硬约束（7 条基线）：仅对叙事正文创作节点注入，与反装饰约束互斥
  // （结构化产物 vs 叙事正文，二选一）。提炼自天命平台规范，详见上方常量注释。
  if (shouldInjectCreationConstraints(stageId, step)) {
    sys = sys + '\n\n' + GLOBAL_CREATION_CONSTRAINTS;
  }

  // ---- user composition (unchanged logic per stage) ----
  let user = baseUser;

  if (stageId === 'screenplay') {
    user = applyProjectContext(user, project);
    if (step.index >= 2) {
      user += '\n\n' + buildScreenplayPriorContext(step.index, artifacts);
    }
    return [{ role: 'system', content: sys }, { role: 'user', content: user }];
  }

  if (stageId === 'adapt') {
    user = applyProjectContext(user, project);
    if (step.index >= 2) {
      user += '\n\n' + buildAdaptPriorContext(step.index, artifacts);
    }
    return [{ role: 'system', content: sys }, { role: 'user', content: user }];
  }

  if (stageId === 'assets') {
    const screenplay = pickScreenplay(artifacts);
    if (!screenplay) {
      throw new Error('资产阶段需要剧本输入：请先完成 screenplay.7（原创）/ adapt.6（改编）/ 或在工作台顶部「📥 导入剧本」手动粘贴');
    }
    if (step.index === 1) {
      user = screenplay;
    } else {
      const scan = artifacts['assets.1'];
      const scanCtx = scan
        ? `## 资产扫描清单（来自 assets.1，作为完整性参考）\n${scan.content}\n\n`
        : '';
      user = scanCtx + '## 剧本原文\n' + screenplay;
    }
    return [{ role: 'system', content: sys }, { role: 'user', content: user }];
  }

  if (stageId === 'novel') {
    // 小说模式：
    // - 非 loop 节点：依赖 user 模板里的 {{ artifacts.novel.X.content | ... }} 占位符 +
    //   applyProjectContext 注入 concept / duration / 结构化字段
    // - loop 节点 (N2.2 单卷分章 / N3.1 章节草稿 / N3.2 章节润色)：
    //   调用方使用 userOverride 整体替换 baseUser, 此时这里的 interpolate 是空跑也无害
    user = applyProjectContext(user, project);
    user = interpolate(user, { project, artifacts });
    return [{ role: 'system', content: sys }, { role: 'user', content: user }];
  }

  if (stageId === 'storyboard') {
    if (step.index === 1) {
      const screenplay = pickScreenplay(artifacts);
      if (!screenplay) throw new Error('分镜阶段需要剧本输入：请先完成 screenplay.7（原创）/ adapt.6（改编）/ 或在工作台顶部「📥 导入剧本」手动粘贴');
      const paragraphIndex = paragraphize(screenplay);
      const assetList = buildAssetList(artifacts);
      user = JSON.stringify({ paragraphIndex, assetList }, null, 2);
      // 关键：要求模型在 markdown 输出后再附 <plan-json>，让 storyboard.2 走结构化路径
      const sysWithJsonContract = sys + '\n\n' + STORYBOARD1_JSON_ADDENDUM;
      return [{ role: 'system', content: sysWithJsonContract }, { role: 'user', content: user }];
    }
    // storyboard.2 ：Phase E-G 逐单元生成
    if (step.index === 2) {
      if (!inp.unitContext) {
        throw new Error('分镜.2 需要单元上下文：请使用 runStoryboardPhase2Loop 而不是 runStep 单步运行；或在 Pipeline 中点「跑完整阶段」自动循环。');
      }
      const screenplay = pickScreenplay(artifacts);
      if (!screenplay) throw new Error('分镜.2 需要剧本输入');
      const screenplayParagraphs = paragraphize(screenplay);
      const assetList = buildAssetList(artifacts);
      const u = buildPhase2UnitUser({
        unit: inp.unitContext.unit,
        plan: inp.unitContext.plan,
        screenplayParagraphs,
        assetList,
      });
      return [{ role: 'system', content: sys }, { role: 'user', content: u }];
    }
    user = interpolate(user, { project, artifacts });
    return [{ role: 'system', content: sys }, { role: 'user', content: user }];
  }

  return [{ role: 'system', content: sys }, { role: 'user', content: user }];
}

// ------- helpers ----------------------------------------------------

function pickScreenplay(artifacts: ArtifactMap): string | null {
  // 优先级：手动注入/原创 screenplay.7 > 改编最终稿 adapt.6 > 上一步兜底
  return (
    artifacts['screenplay.7']?.content ??
    artifacts['adapt.6']?.content ??
    artifacts['screenplay.6']?.content ??
    artifacts['adapt.5']?.content ??
    null
  );
}

function buildAdaptPriorContext(currentIndex: number, artifacts: ArtifactMap): string {
  const titles: Record<number, string> = {
    1: '改编梗概',
    2: '人物适配表',
    3: '短剧化结构大纲',
    4: '场次拆解',
    5: '场景写作',
    6: '改编剧本医生',
  };
  const lines: string[] = ['## 上游产物（前序 A 步已通过，作为本步上下文）'];
  for (let i = 1; i < currentIndex; i++) {
    const a = artifacts[`adapt.${i}`];
    if (!a) continue;
    lines.push('', `### A${i} · ${titles[i] ?? ''}`, a.content.trim());
  }
  return lines.join('\n');
}

function buildScreenplayPriorContext(currentIndex: number, artifacts: ArtifactMap): string {
  const titles: Record<number, string> = {
    1: '破题与核心动作',
    2: '梗概草稿',
    3: '人物深度与弧光',
    4: '前史与世界观',
    5: '结构大纲',
    6: '场次拆解',
    7: '场景写作',
    8: '剧本医生',
  };
  const lines: string[] = ['## 上游产物（前序步骤已通过，作为本步上下文）'];
  for (let i = 1; i < currentIndex; i++) {
    const a = artifacts[`screenplay.${i}`];
    if (!a) continue;
    lines.push('', `### Step ${i} · ${titles[i] ?? ''}`, a.content.trim());
  }
  return lines.join('\n');
}

function buildAssetList(artifacts: ArtifactMap): unknown {
  const tryParse = (txt?: string) => {
    if (!txt) return null;
    try { return JSON.parse(txt); } catch { return txt; }
  };
  return {
    scenes: tryParse(artifacts['assets.3']?.content),
    roles:  tryParse(artifacts['assets.2']?.content),
    props:  tryParse(artifacts['assets.4']?.content),
  };
}
