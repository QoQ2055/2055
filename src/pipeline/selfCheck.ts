// Node-aware targeted self-check: each pipeline node has its own checklist.
// Returns a structured diagnostic JSON the UI can render with severity badges.

import { chatStream } from '../llm/deepseek';
import type { SettingsState } from '../store/settings';
import type { NodeArtifact, ArtifactMap } from './types';

export type Severity = 'critical' | 'major' | 'minor' | 'info';
export type Verdict = 'pass' | 'warn' | 'fail';

export interface SelfCheckIssue {
  severity: Severity;
  tag: string;
  detail: string;
  suggestion?: string;
  /** 可选: 字段路径或行号定位 */
  locator?: string;
}

export interface SelfCheckReport {
  nodeId: string;
  verdict: Verdict;
  issues: SelfCheckIssue[];
  summary: string;
  /** 自检耗时 + 调用元信息 */
  ts: number;
  durationMs: number;
  tokens?: number;
  cost?: number;
}

export interface SelfCheckResult {
  raw: string;
  report: SelfCheckReport | null;
  durationMs: number;
}

/* ── 节点感知检查清单 ───────────────────────────────────────────── */

const GENERIC_CHECKLIST = [
  '反装饰: 字段值不应被 **bold** / *italic* / blockquote / emoji 包装',
  '结构对齐: 输出格式与 outFormat 声明一致 (markdown / json)',
  '完整性: 没有 "..." / "以上" / "略" 这类省略占位',
  '一致性: 同一实体名在全文用法一致',
].join('\n- ');

const NODE_CHECKLISTS: Record<string, string> = {
  'screenplay.7': [
    '场次连续性: 场号递增无跳号, 起场/结场状态自洽',
    '人物名一致: 同一角色全程同一称呼, 不出现「他」「她」歧义',
    '台词标识: 角色名+冒号格式统一, 不混用 "——" 或括号注解',
    '动作可视化: 每场至少 1 个具体动作描写, 不只有心理或对白',
    '节奏控制: 平均每场 ≤ 60 秒, 关键冲突 ≤ 30 秒进入',
    '反装饰: 场标题用 "## 场N" 不用 "**场N**"',
  ].join('\n- '),

  'adapt.6': [
    '原作锚点: mustKeep 元素全部命中, mustCut 元素全部移除',
    '改编手法: 5 大压缩策略中至少使用 2 个',
    'IP 风险: 不出现 R1\' riskList 中标红的桥段',
    '场次连续性: 同 screenplay.7 检查',
    '反装饰: 同 screenplay.7 检查',
  ].join('\n- '),

  'storyboard.1': [
    '双输出契约: 必须含 <plan-json>...</plan-json> 块且为合法 JSON',
    '段落覆盖: paragraphs[*].sectionId 对应 user 输入的 paragraphIndex 全集',
    'unit 完整性: 每个 unit 含 unitIndex / sectionRefs / durationSec / sceneType / subShotCount / summary',
    'sectionRefs 引用合法: 每个 §N 出现在 paragraphs 中',
    '时长合计: sum(units.durationSec) 与 meta.totalSec 偏差 ≤ 15%',
    '锚点链: units[i].plannedExitState 与 units[i+1].plannedEntryState 画面一致',
    '反装饰: JSON 字段不能含 **bold** / 列表语法',
  ].join('\n- '),

  'storyboard.2': [
    // ⚠ 与 public/prompts/storyboard/2.json (V5.1 章节 0.5 §7.1-§7.7) 对齐.
    // 11 字段固定顺序: 锚点 → 时序 → Must-Show → Must-not → 相机 → 微表情 → 音频 → 强制音频声明 → 强制声明(视觉) → 起幅 → 落幅 → 落幅末状态
    '双区结构: 每 UNIT 必须含 COPY 区 (Seedance 直拷) 与 NOTE 区 (段号溯源/G1-G13 自检报告/下一单元衔接) 两区, NOTE 区不得污染 COPY 区',
    'COPY 区 11 字段顺序: 锚点 → 时序 → Must-Show → Must-not → 相机 → 微表情 → 音频 → 强制音频声明 → 强制声明（视觉） → 起幅 → 落幅 → 落幅末状态. 顺序错误或字段名错写视为不达标',
    '时序节奏注释: 「## 时序」标题必须带括号节奏注释, 例 `## 时序（13 秒，4 拍：2+4+3+4）`; 子拍写 `0-3秒:` 不允许 P1/P2/P3',
    '落幅末状态题材标记: 「## 落幅末状态」标题必须带括号题材版本号, 例 `## 落幅末状态（机甲版本 5 维度）`, 5 维度: 姿态/手部/朝向/受力/环境接触',
    '资产引用格式: COPY 区只允许 `@角色名` 或 user message assets 中的 `@C1/@S1/@P1` 引用; 严禁 `@Image+UUID` / `@Image+长 hash` 引用',
    '音频字段写法: 音频通道用 `@Audio1（台词通道）:` / `@Audio2（音效通道）:`, 不得用旧 `## 台词` / `## 音效` 子块',
    '不适用字段整段删除: 非情绪单元删 `## 微表情`、非武戏删 `## 武戏硬规则`、单角色删 `## 空间站位`、无潜台词删 `## 潜台词`; 严禁写 "不适用 / 无 / N/A" 占位',
    'Must-Show 定义: 是 3-6 个叙事关键画面清单, 不是空洞物件清单 (如"手机/楼层灯/戒指印")',
    '台词字数硬上限: 单元内对白总字数 ≤ 60 字; 超出必须气口截断并在 NOTE 区 nextUnitHint 记录续接',
    '景别多样性: 子镜头 ≥ 2 个时必须混用 ≥ 2 类景别 (远/全/中/近/特)',
    '武戏五类覆盖: 武戏单元须覆盖 位移/碰撞/闪避/受创/环境破坏 中的 ≥ 4 类',
    '空间站位 + 轴线: 多角色单元必填空间站位 (锚点法), 严禁"并排/围在一起"模糊词; 多角色切镜必声明轴线 (对话轴/运动轴/交战轴)',
    '字数硬上限: COPY 区 ≤ 2000 字 (Seedance API 截断阈值), 理想区间 1100-1500',
    'COPY 区禁含元叙述: 禁止出现 § / 原文 / 段号 / 对应 / 接力 / 视线接剪 / 动作接剪 / 为下一节准备 等元叙述, 这些只允许出现在 NOTE 区',
    'G-1 到 G13 自检报告: NOTE 区必须含 G-1 到 G13 逐条自检报告, 缺一即 major',
    '反装饰: 字段值本体不要包 **bold** / *italic* / blockquote / emoji (字段标题里的 emoji 例外)',
  ].join('\n- '),

  'assets.1': [
    '完整性: 角色 / 场景 / 道具 / 服化道 四类全覆盖',
    '反装饰: 输出为合法 JSON, 字段值无 markdown 装饰',
    '主角识别: protagonist 字段单选, 不为多个角色',
  ].join('\n- '),

  'assets.2': [
    '角色卡完整: name / age / appearance / personality / motivation 全字段',
    '14 情绪 FACS: 至少标注 3 种情绪表达模板',
    '反装饰: 字段值无 markdown',
  ].join('\n- '),

  'assets.3': [
    '场景卡完整: name / time / location / mood / lighting / camera_hints 全字段',
    '视觉风格后缀: 每个场景含 styleSuffix (来自 style_library)',
    '反装饰: 字段值无 markdown',
  ].join('\n- '),

  'assets.4': [
    '道具卡完整: name / appearance / function / symbolism (三重身份)',
    '伏笔标注: 出现≥1 个 foreshadowing 字段',
    '反装饰: 字段值无 markdown',
  ].join('\n- '),
};

/* ── 主入口 ───────────────────────────────────────────────────── */

export interface SelfCheckOptions {
  artifact: NodeArtifact;
  settings: SettingsState;
  signal?: AbortSignal;
  onDelta?: (chunk: string, full: string) => void;
  /** 当启用「上下文自检」时, 调用方传入完整 artifacts 以注入 sb.1 / assets 摘要 */
  contextArtifacts?: ArtifactMap;
}

export async function runTargetedSelfCheck(opts: SelfCheckOptions): Promise<SelfCheckResult> {
  const { artifact, settings, signal, onDelta, contextArtifacts } = opts;

  const checklist = NODE_CHECKLISTS[artifact.nodeId] ?? GENERIC_CHECKLIST;
  const sys = [
    '你是一个严格的 QA 审稿员, 只做诊断不做改写.',
    '输出**必须**是合法 JSON, 不带 markdown 围栏, 不带任何解释性前后缀.',
    '',
    '## 输出 JSON schema',
    '{',
    '  "verdict": "pass" | "warn" | "fail",',
    '  "summary": "<= 80 字一句话总评",',
    '  "issues": [',
    '    { "severity": "critical|major|minor|info", "tag": "短标签", "detail": "具体问题描述", "suggestion": "修复建议", "locator": "可选行号或字段路径" }',
    '  ]',
    '}',
    '',
    '## verdict 规则',
    '- fail: 出现任何 critical 或 ≥ 3 个 major',
    '- warn: 出现 1-2 个 major 或 ≥ 3 个 minor',
    '- pass: 仅 minor 或 info',
  ].join('\n');

  const ctxBlocks: string[] = [];
  if (contextArtifacts && artifact.nodeId === 'storyboard.2') {
    const sb1 = contextArtifacts['storyboard.1'];
    if (sb1?.content) {
      ctxBlocks.push('## 上下文 · storyboard.1 单元规划 (用于核对 UNIT 数 / sectionRefs)');
      ctxBlocks.push('```');
      ctxBlocks.push(sb1.content.slice(0, 6000));
      ctxBlocks.push('```');
      ctxBlocks.push('');
    }
    const assetIds = ['assets.1', 'assets.2', 'assets.3', 'assets.4'];
    const assetParts: string[] = [];
    for (const id of assetIds) {
      const a = contextArtifacts[id];
      if (a?.content) {
        assetParts.push(`### ${id} · ${a.title ?? ''}`);
        assetParts.push('```');
        assetParts.push(a.content.slice(0, 3000));
        assetParts.push('```');
      }
    }
    if (assetParts.length) {
      ctxBlocks.push('## 上下文 · assets 资产清单 (用于核对角色 / 场景 / 道具一致性)');
      ctxBlocks.push(...assetParts);
      ctxBlocks.push('');
    }
    if (ctxBlocks.length) {
      ctxBlocks.unshift(
        '【启用上下文自检】以下额外提供 storyboard.1 与 assets, 仅用于校验一致性, **不要在 issues 之外输出**这些上下文.',
        '',
      );
    }
  }

  const user = [
    `# 节点定向自检 · ${artifact.nodeId} · ${artifact.title}`,
    '',
    '## 检查清单 (逐条核对)',
    '- ' + checklist,
    '',
    ...ctxBlocks,
    '## 待检产物 (原文, 不要改写)',
    '```',
    artifact.content,
    '```',
    '',
    '请严格按 schema 输出 JSON 诊断结果.',
  ].join('\n');

  const res = await chatStream({
    baseUrl: settings.baseUrl,
    apiKey: settings.apiKey,
    model: settings.model,
    messages: [
      { role: 'system', content: sys },
      { role: 'user',   content: user },
    ],
    temperature: 0,
    max_tokens: 2048,
    signal,
    onDelta,
  });

  let report: SelfCheckReport | null = null;
  try {
    const stripped = res.content
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```\s*$/i, '')
      .trim();
    const parsed = JSON.parse(stripped);
    report = {
      nodeId: artifact.nodeId,
      verdict: (parsed.verdict ?? 'warn') as Verdict,
      summary: String(parsed.summary ?? ''),
      issues: Array.isArray(parsed.issues)
        ? parsed.issues.map((i: any): SelfCheckIssue => ({
            severity: (i.severity ?? 'minor') as Severity,
            tag: String(i.tag ?? '').slice(0, 32),
            detail: String(i.detail ?? ''),
            suggestion: i.suggestion ? String(i.suggestion) : undefined,
            locator: i.locator ? String(i.locator) : undefined,
          }))
        : [],
      ts: Date.now(),
      durationMs: res.durationMs,
      tokens: res.usage?.total_tokens,
      cost: undefined,
    };
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[selfCheck] failed to parse JSON for', artifact.nodeId, e);
  }
  return { raw: res.content, report, durationMs: res.durationMs };
}

/* ── 单条 issue · AI 辅助修订 ─────────────────────────────────── */

export interface IssueFixOptions {
  artifact: NodeArtifact;
  issue: SelfCheckIssue;
  settings: SettingsState;
  signal?: AbortSignal;
  onDelta?: (chunk: string, full: string) => void;
  /** 可选：项目知识层 preamble（KB / 题材锚点 / 方法模块 / R1 指令书）。
   *  存在则拼接在修复 system 之前，让 LLM 在最小化修订时也遵守项目硬律。 */
  extraSystemPreamble?: string;
}

export interface IssueFixResult {
  /** 修订后的完整产物文本（已剥掉 markdown 围栏与多余前后缀） */
  revised: string;
  /** 原始 LLM 返回（debug 用） */
  raw: string;
  durationMs: number;
}

/**
 * 针对一条 self-check issue, 让 LLM 做**最小化外科手术修订**.
 * 关键约束: 返回完整产物原文, 仅在 locator 指向区域改动, 其它部分逐字保留.
 */
export async function runIssueFix(opts: IssueFixOptions): Promise<IssueFixResult> {
  const { artifact, issue, settings, signal, onDelta, extraSystemPreamble } = opts;

  // 根据 issue 关键词推断改动范围, 给 LLM 更具体的边界提示
  const issueHint = inferIssueHint(issue, artifact.nodeId);

  const sysCore = [
    '你是一名严谨的内容修订员, 对一份已有的产物按"单点诊断"做**外科手术式修订**.',
    '',
    '## 核心原则',
    '**你只修复用户提供的这一条 issue, 完全不管其它问题.**',
    '即使你看到产物里还有别的瑕疵 / 错别字 / 风格不一致 / 结构不完美, 也**一律不动**.',
    '把自己当成一只只会做一次精准切片的手术刀, 不是综合治疗方案.',
    '',
    '## 量化约束（**最重要**）',
    '**修订后的输出, 必须有 ≥ 90% 的字符与原文逐字一致.**',
    '换句话说: 如果原文 5000 字, 你最多改动 ~500 字范围. 超出此预算就是失败.',
    '尤其禁止: 重新排版 JSON、调整 key 顺序、统一引号样式、压缩空行. 保持**字符级**一致.',
    '',
    '## 硬约束',
    '1. **只改一处** — 仅修复用户提供的这一条 issue 所指向的区域, 其它部分**逐字逐符号原样保留**.',
    '2. **不连带改** — 即使发现其它问题, 包括明显的错字 / 装饰 / 不规范, 也不要改.',
    '3. **不重写** — 不"借机优化措辞" / "顺便统一风格" / "重排版" / "美化缩进". 不属于本 issue 的内容 **逐字符 1:1 复制**.',
    '4. **完整输出** — 输出修订后的**完整产物全文**, 用户会用它直接覆盖原文.',
    '5. **不解释** — 不写"以下是修订版" / "本次共修订 N 处" / "我注意到还有 X" / 任何前后缀.',
    '6. **不加围栏** — 不要 ```markdown / ```json 围栏 (除非原文本身就有).',
    '7. **保持格式** — 原文是 markdown 就还是 markdown, JSON 就还是 JSON, 缩进 / 换行 / 空行 / 项目符号一致.',
    '',
    '## 输出',
    '从产物第一字符到最后一字符的完整文本, 不带前后说明.',
    '**绝大多数字符应当与原文完全一致**, 仅 issue 指向区域有差异.',
  ].join('\n');
  const sys = extraSystemPreamble ? extraSystemPreamble + '\n\n' + sysCore : sysCore;

  const issueLines = [
    `- 严重度: ${issue.severity}`,
    `- 标签: ${issue.tag}`,
    `- 描述: ${issue.detail}`,
  ];
  if (issue.suggestion) issueLines.push(`- 建议: ${issue.suggestion}`);
  if (issue.locator)   issueLines.push(`- 定位: ${issue.locator}`);
  if (issueHint)       issueLines.push(`- **修订边界提示**: ${issueHint}`);

  const user = [
    `# 产物信息`,
    `- nodeId: ${artifact.nodeId}`,
    `- title: ${artifact.title}`,
    '',
    `# 待修订的单条 issue`,
    ...issueLines,
    '',
    `# 原产物（请仅修订上面这条 issue 指向的区域，其它逐字保留）`,
    '```',
    artifact.content,
    '```',
    '',
    '请直接输出修订后的完整产物全文。',
  ].join('\n');

  const res = await chatStream({
    baseUrl: settings.baseUrl,
    apiKey: settings.apiKey,
    model: settings.model,
    messages: [
      { role: 'system', content: sys },
      { role: 'user',   content: user },
    ],
    temperature: 0.2,
    max_tokens: settings.maxTokens,
    signal,
    onDelta,
  });

  // 防御性剥除围栏与前后缀
  let revised = res.content;
  // 去掉首尾整段围栏
  revised = revised.replace(/^\s*```[a-zA-Z0-9_-]*\s*\n/, '').replace(/\n```\s*$/, '');
  // 去掉常见前缀
  revised = revised.replace(/^[ \t]*(?:以下是|这是|修订后|修订版本|here is|here's)[^\n]*\n+/i, '');
  revised = revised.trim();

  return { revised, raw: res.content, durationMs: res.durationMs };
}

/* ── 一键修订全部 issues ──────────────────────────────────── */

export interface FixAllOptions {
  artifact: NodeArtifact;
  issues: SelfCheckIssue[];
  settings: SettingsState;
  signal?: AbortSignal;
  onDelta?: (chunk: string, full: string) => void;
  /** 可选：项目知识层 preamble（KB / 题材锚点 / 方法模块 / R1 指令书）。
   *  存在则拼接在修复 system 之前，让 LLM 在批量修订时也遵守项目硬律。 */
  extraSystemPreamble?: string;
}

/**
 * 把 self-check 报告里的全部 issue 一次性交给 LLM 修订, 输出完整的修订版产物.
 * 与 runIssueFix 的区别: 不再要求"只改一处", 而是要求"逐条对照, 一次修完".
 */
export async function runFixAllIssues(opts: FixAllOptions): Promise<IssueFixResult> {
  const { artifact, issues, settings, signal, onDelta, extraSystemPreamble } = opts;

  // info 级一般是建议性提示, 不强制修
  const actionable = issues.filter((i) => i.severity !== 'info');

  const sysCore = [
    '你是一名严谨的内容修订员, 一次性修复一份产物里的多条诊断 issue.',
    '',
    '## 核心原则',
    '1. **逐条对照** — 输入会给你一份 issue 清单 (按编号排列), 你必须逐条解决, 不能漏, 不能合并.',
    '2. **只修给定 issue** — 不要"借机优化"清单之外的内容. 看到错字 / 装饰 / 风格不一致但**不在清单里**, **保留原样**.',
    '3. **保留主体** — 只动需要修的字段 / 段落. 与本次 issue 无关的章节 / unit / 字段 / 段落 **逐字保留**.',
    '4. **不重排** — 不要重新格式化 JSON, 不要调整 key 顺序, 不要统一引号或缩进风格 (除非 issue 明确要求).',
    '5. **完整输出** — 输出修订后的**完整产物全文**, 用户会用它直接覆盖原文.',
    '6. **不解释** — 不写"以下是修订版" / "本次共修订 N 处" / "issue#1 已修复" / 任何前后缀或元说明.',
    '7. **不加围栏** — 不要 ```markdown / ```json 围栏 (除非原文本身就有).',
    '8. **保持格式** — 原文 markdown 还是 markdown, JSON 还是 JSON, 不改文件类型.',
    '',
    '## 输出',
    '从产物第一字符到最后一字符的完整文本, 不带前后说明.',
  ].join('\n');
  const sys = extraSystemPreamble ? extraSystemPreamble + '\n\n' + sysCore : sysCore;

  const issueBlocks = actionable.map((iss, i) => {
    const lines = [
      `### Issue #${i + 1} · [${iss.severity}] ${iss.tag}`,
      `- 描述: ${iss.detail}`,
    ];
    if (iss.suggestion) lines.push(`- 建议: ${iss.suggestion}`);
    if (iss.locator)   lines.push(`- 定位: ${iss.locator}`);
    const hint = inferIssueHint(iss, artifact.nodeId);
    if (hint) lines.push(`- 修订边界: ${hint}`);
    return lines.join('\n');
  });

  const user = [
    `# 产物信息`,
    `- nodeId: ${artifact.nodeId}`,
    `- title: ${artifact.title}`,
    '',
    `# 待修订的 ${actionable.length} 条 issue (逐条对照修复)`,
    issueBlocks.join('\n\n'),
    '',
    `# 原产物（请在保留主体不变的前提下, 把上面 ${actionable.length} 条 issue 全部修复）`,
    '```',
    artifact.content,
    '```',
    '',
    '请直接输出修订后的完整产物全文。',
  ].join('\n');

  const res = await chatStream({
    baseUrl: settings.baseUrl,
    apiKey: settings.apiKey,
    model: settings.model,
    messages: [
      { role: 'system', content: sys },
      { role: 'user',   content: user },
    ],
    temperature: 0.2,
    max_tokens: settings.maxTokens,
    signal,
    onDelta,
  });

  let revised = res.content;
  revised = revised.replace(/^\s*```[a-zA-Z0-9_-]*\s*\n/, '').replace(/\n```\s*$/, '');
  revised = revised.replace(/^[ \t]*(?:以下是|这是|修订后|修订版本|here is|here's)[^\n]*\n+/i, '');
  revised = revised.trim();

  return { revised, raw: res.content, durationMs: res.durationMs };
}

/** 基于 issue 关键词与节点类型, 推断**最小修订边界**, 给 LLM 具体指引避免它整体重写. */
function inferIssueHint(issue: SelfCheckIssue, nodeId: string): string {
  const haystack = `${issue.tag} ${issue.detail} ${issue.suggestion ?? ''} ${issue.locator ?? ''}`.toLowerCase();
  const has = (...kws: string[]) => kws.some((k) => haystack.includes(k.toLowerCase()));

  // 锚点链 / 单元间状态衔接
  if (has('锚点', 'anchor', '链', 'plannedExitState', 'plannedEntryState', '衔接')) {
    if (nodeId === 'storyboard.1') {
      return '这是 units[i].plannedExitState 与 units[i+1].plannedEntryState 的**字段级**不一致. **只改这一对相邻 unit 中的一个 state 字段值**, 其它 unit / 其它字段全部原样不动. 不要重排 JSON, 不要修改 sectionRefs/durationSec/summary 等其它字段.';
    }
    return '这是相邻 UNIT 出场/入场画面的衔接问题. **只改两个相邻 UNIT 中其中一个的 1-2 句状态描述**, 不要重写 prompt 区, 不要动其它 UNIT.';
  }

  // sectionRefs / 引用合法性
  if (has('sectionrefs', '引用', '§', 'section')) {
    return '只修改具体那一个 unit 的 sectionRefs 字段, 不要改其它 unit, 不要改 paragraphs.';
  }

  // 时长合计
  if (has('时长', 'duration', '合计', 'totalsec')) {
    return '只调整 1-2 个 unit 的 durationSec 数值使总和落入预期范围, 不要改 sceneType / summary / sectionRefs.';
  }

  // 反装饰类（去除 markdown 修饰）
  if (has('装饰', '反装饰', 'bold', 'italic', 'markdown', 'emoji')) {
    return '只剥除字段值上的 ** / * / > / emoji 等装饰符号, **保留字段值的中文内容一字不变**, 也不要重写 JSON 结构.';
  }

  // 资产忠实 / 一致性 / 未登记
  if (has('资产', '一致', '未登记', '角色名', 'unknown')) {
    return '只把出现"未登记角色名"的具体那行台词或描述里的角色名替换/校正, 其它 UNIT、其它对白、prompt 区全部不动.';
  }

  // 双区结构 (V5.1: COPY 区 / NOTE 区)
  if (has('双区', '文字分镜', 'seedance', 'prompt 区', 'prompt区', 'copy 区', 'copy区', 'note 区', 'note区')) {
    return '只在缺失双区的那个 UNIT 内部补充缺少的那一区 (COPY 区 / NOTE 区), 其它 UNIT 的两区都已 OK, **不要重做**.';
  }

  // 11 字段齐备 / 字段顺序 (V5.1 锚点→时序→Must-Show→Must-not→相机→微表情→音频→强制音频声明→强制声明(视觉)→起幅→落幅→落幅末状态)
  if (has('11 字段', '字段齐备', 'must-show', 'must-not', '锚点', '起幅', '落幅', '落幅末状态', '强制声明', '强制音频')) {
    return '只在出问题的那个 UNIT 的 COPY 区补全/校正缺失或错序的那 1-2 个字段 (按 V5.1 11 字段顺序), 其它字段值原样, 其它 UNIT 不动. 不要重排整个 COPY 区.';
  }

  // 时序节奏 / 落幅末状态题材标记
  if (has('时序', '节奏', '题材版本', '5 维度', '5维度', '0-3秒', 'p1/p2', 'p1 p2')) {
    return '只在出问题的那个 UNIT 修订「## 时序」或「## 落幅末状态」标题的括号注解 / 子拍格式, 不要改字段内容主体, 其它 UNIT 不动.';
  }

  // 音频通道写法 (V5.1: @Audio1/@Audio2)
  if (has('音频', 'audio', '台词通道', '音效通道')) {
    return '只把出问题的 UNIT 中音频字段改写为 `@Audio1（台词通道）:` / `@Audio2（音效通道）:` 格式, 不要改其它字段.';
  }

  // 资产引用格式 (V5.1: 禁 @Image+UUID)
  if (has('@image', 'uuid', 'hash', '引用格式', '资产引用')) {
    return '只把出问题的 UNIT 里的 `@Image+UUID/hash` 引用替换为 `@角色名` 或 `@C1/@S1/@P1` 标准引用, 其它字段原样.';
  }

  // G-1 到 G13 自检报告
  if (has('g-1', 'g1', 'g13', '自检报告', 'g 自检')) {
    return '只在 NOTE 区补全缺失的 G-X 自检报告条目, 不要动 COPY 区, 不要动其它 UNIT.';
  }

  // 武戏 / 空间站位 / 轴线
  if (has('武戏', '空间站位', '轴线', '180', '锚点法', '位移', '碰撞', '闪避', '受创')) {
    return '只在出问题的那个 UNIT 补充/修订对应字段 (武戏硬规则 / 空间站位 / 相机轴线), 其它 UNIT 不动.';
  }

  // 字数硬上限 / 台词 60 字
  if (has('60 字', '60字', '气口', '字数', '2000', '截断')) {
    return '只在超字的那个 UNIT 内做气口截断 (台词) 或字段精简 (COPY 区), 其它 UNIT 不动.';
  }

  // 场号 / 角色名一致
  if (has('场号', '场次', '人物名', '称呼')) {
    return '只对出现错号 / 错称呼的那一处具体位置做替换, 其它场次、其它对白原样不动.';
  }

  return '';
}
