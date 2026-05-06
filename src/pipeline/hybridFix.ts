// Hybrid issue-fix engine.
// 让 LLM 输出"patch 计划"而不是整体重写, 我们再确定性地把 patch 应用到原产物.
// 支持 4 种 patch 类型 (按精度降序):
//   1. jsonpatch (RFC 6902 子集)        — 仅 JSON 产物 (assets.* / storyboard.1 内的 plan-json)
//   2. search-replace (唯一精确子串替换)  — 任何文本产物
//   3. block (整块替换)                  — markdown 节点 (storyboard.2 / screenplay.7 / adapt.6)
//   4. rewrite-all (整体重写, 兜底)       — 仅当上面 3 种都做不到才允许
//
// 优势: 爆炸半径可控, 多数 issue 改动局部, 不会"修一个引发三个新的".

import { chatStream } from '../llm/deepseek';
import type { SettingsState } from '../store/settings';
import type { NodeArtifact } from './types';
import type { SelfCheckIssue } from './selfCheck';
import { parseLooseJson } from './jsonLoose';

/* ── 公共类型 ───────────────────────────────────────────────── */

export type JsonPatchOp =
  | { op: 'replace'; path: string; value: unknown }
  | { op: 'add'; path: string; value: unknown }
  | { op: 'remove'; path: string };

export type Patch =
  | { type: 'jsonpatch'; ops: JsonPatchOp[]; issues?: string[] }
  | { type: 'search-replace'; old: string; new: string; issues?: string[] }
  | { type: 'block'; blockId: string; newContent: string; issues?: string[] }
  | { type: 'rewrite-all'; newContent: string; issues?: string[] };

export interface PatchPlan {
  patches: Patch[];
  skipped?: { issueId: string; reason: string }[];
}

export interface AppliedPatch {
  type: Patch['type'];
  issues: string[];
  summary: string;
}
export interface FailedPatch {
  type: Patch['type'];
  issues: string[];
  reason: string;
}

export interface HybridFixResult {
  revised: string;
  applied: AppliedPatch[];
  failed: FailedPatch[];
  skipped: { issueId: string; reason: string }[];
  raw: string;
  durationMs: number;
}

export interface HybridFixOptions {
  artifact: NodeArtifact;
  issues: SelfCheckIssue[];
  settings: SettingsState;
  signal?: AbortSignal;
  onDelta?: (chunk: string, full: string) => void;
}

/* ── 节点类型路由 ───────────────────────────────────────────── */

/** 纯 JSON 产物: 整 content 就是 JSON */
const PURE_JSON_NODES = new Set<string>(['assets.1', 'assets.2', 'assets.3', 'assets.4']);
/** JSON-in-markdown: content 里有 <plan-json>...</plan-json> 块 */
const PLAN_JSON_NODES = new Set<string>(['storyboard.1']);
/** 有 block 切分能力的 markdown 节点 */
const MARKDOWN_BLOCK_PATTERNS: Record<string, RegExp> = {
  'storyboard.2': /^#{1,3}\s*UNIT[\s_]*(\d+)/gm,
  'screenplay.7': /^#{1,3}\s*场\s*(\d+)/gm,
  'adapt.6': /^#{1,3}\s*场\s*(\d+)/gm,
};

interface Block {
  blockId: string;
  start: number;
  end: number;
}

function extractBlocks(content: string, nodeId: string): Block[] {
  const re = MARKDOWN_BLOCK_PATTERNS[nodeId];
  if (!re) return [];
  // matchAll 需要 g flag, 重新创建以避免 lastIndex 残留
  const compiled = new RegExp(re.source, re.flags);
  const matches = [...content.matchAll(compiled)];
  const out: Block[] = [];
  for (let i = 0; i < matches.length; i++) {
    const m = matches[i];
    if (m.index == null) continue;
    const start = m.index;
    const end = i + 1 < matches.length ? (matches[i + 1].index ?? content.length) : content.length;
    const idPrefix = nodeId === 'storyboard.2' ? 'UNIT' : 'SCENE';
    out.push({ blockId: `${idPrefix}_${m[1]}`, start, end });
  }
  return out;
}

/* ── JSONPatch 极简实现 (RFC 6902 子集) ─────────────────────── */

function unescapeSeg(s: string): string {
  // RFC6901: ~1 -> /, ~0 -> ~ (顺序敏感)
  return s.replace(/~1/g, '/').replace(/~0/g, '~');
}

function applyJsonOp(root: any, op: JsonPatchOp): void {
  const segs = op.path.split('/').slice(1).map(unescapeSeg);
  if (segs.length === 0) throw new Error(`空 path: ${op.path}`);
  const last = segs[segs.length - 1];
  let parent = root;
  for (let i = 0; i < segs.length - 1; i++) {
    const seg = segs[i];
    if (parent == null) throw new Error(`path 不存在: /${segs.slice(0, i + 1).join('/')}`);
    parent = Array.isArray(parent) ? parent[Number(seg)] : parent[seg];
  }
  if (parent == null) throw new Error(`父节点不存在: ${op.path}`);

  if (op.op === 'remove') {
    if (Array.isArray(parent)) parent.splice(Number(last), 1);
    else delete parent[last];
  } else if (op.op === 'replace') {
    if (Array.isArray(parent)) parent[Number(last)] = op.value;
    else parent[last] = op.value;
  } else if (op.op === 'add') {
    if (Array.isArray(parent)) {
      if (last === '-') parent.push(op.value);
      else parent.splice(Number(last), 0, op.value);
    } else {
      parent[last] = op.value;
    }
  } else {
    throw new Error(`不支持的 op: ${(op as any).op}`);
  }
}

/* ── 应用单条 patch ─────────────────────────────────────────── */

function applyPatch(
  cur: string,
  patch: Patch,
  blocks: Block[],
  nodeId: string,
): { next: string; summary: string; newBlocks: Block[] } {
  switch (patch.type) {
    case 'search-replace': {
      const idx = cur.indexOf(patch.old);
      if (idx < 0) throw new Error(`search-replace: 在产物中未找到 old (前 40 字: ${patch.old.slice(0, 40)})`);
      const idx2 = cur.indexOf(patch.old, idx + 1);
      if (idx2 >= 0) throw new Error(`search-replace: old 出现 ≥ 2 次, 不唯一`);
      const next = cur.slice(0, idx) + patch.new + cur.slice(idx + patch.old.length);
      return {
        next,
        summary: `替换 ${patch.old.length} → ${patch.new.length} 字`,
        newBlocks: extractBlocks(next, nodeId),
      };
    }
    case 'block': {
      const blk = blocks.find((b) => b.blockId === patch.blockId);
      if (!blk) throw new Error(`block: 未找到 blockId=${patch.blockId}`);
      const next = cur.slice(0, blk.start) + patch.newContent + cur.slice(blk.end);
      return {
        next,
        summary: `重写块 ${patch.blockId} (${blk.end - blk.start} → ${patch.newContent.length} 字)`,
        newBlocks: extractBlocks(next, nodeId),
      };
    }
    case 'jsonpatch': {
      // 提取 JSON 文本
      const isPureJson = PURE_JSON_NODES.has(nodeId);
      const isPlanJson = PLAN_JSON_NODES.has(nodeId);
      if (!isPureJson && !isPlanJson) {
        throw new Error(`jsonpatch: 节点 ${nodeId} 非 JSON 产物`);
      }
      let jsonText: string;
      let prefix = '';
      let suffix = '';
      if (isPureJson) {
        jsonText = cur.trim();
      } else {
        const m = /<plan-json>([\s\S]*?)<\/plan-json>/.exec(cur);
        if (!m) throw new Error('jsonpatch: 未找到 <plan-json> 块');
        prefix = cur.slice(0, m.index + '<plan-json>'.length);
        suffix = cur.slice(m.index + m[0].length - '</plan-json>'.length);
        jsonText = m[1];
      }
      let obj: any;
      try {
        obj = JSON.parse(jsonText);
      } catch (e: any) {
        throw new Error(`jsonpatch: 原 JSON 解析失败 (${e?.message ?? e})`);
      }
      for (const op of patch.ops) applyJsonOp(obj, op);
      const newJson = JSON.stringify(obj, null, 2);
      const next = isPureJson ? newJson : prefix + '\n' + newJson + '\n' + suffix;
      return {
        next,
        summary: `JSONPatch ${patch.ops.length} 操作`,
        newBlocks: extractBlocks(next, nodeId),
      };
    }
    case 'rewrite-all': {
      // 调用方应该已单独处理, 这里兜底
      return {
        next: patch.newContent,
        summary: `整体重写 (${cur.length} → ${patch.newContent.length} 字)`,
        newBlocks: extractBlocks(patch.newContent, nodeId),
      };
    }
  }
}

/* ── 应用 plan ──────────────────────────────────────────────── */

export function applyPatchPlan(
  content: string,
  plan: PatchPlan,
  nodeId: string,
): { revised: string; applied: AppliedPatch[]; failed: FailedPatch[] } {
  // rewrite-all 优先级: 若存在则丢弃其他, 单独使用
  const rewriteAll = plan.patches.find((p) => p.type === 'rewrite-all') as
    | { type: 'rewrite-all'; newContent: string; issues?: string[] }
    | undefined;
  if (rewriteAll) {
    return {
      revised: rewriteAll.newContent,
      applied: [
        {
          type: 'rewrite-all',
          issues: rewriteAll.issues ?? [],
          summary: `整体重写 (${content.length} → ${rewriteAll.newContent.length} 字)`,
        },
      ],
      failed: plan.patches
        .filter((p) => p !== rewriteAll)
        .map((p) => ({
          type: p.type,
          issues: p.issues ?? [],
          reason: '同 plan 内存在 rewrite-all, 其他 patch 被忽略',
        })),
    };
  }

  let cur = content;
  let blocks = extractBlocks(cur, nodeId);
  const applied: AppliedPatch[] = [];
  const failed: FailedPatch[] = [];

  for (const p of plan.patches) {
    try {
      const res = applyPatch(cur, p, blocks, nodeId);
      cur = res.next;
      blocks = res.newBlocks;
      applied.push({ type: p.type, issues: p.issues ?? [], summary: res.summary });
    } catch (e: any) {
      failed.push({ type: p.type, issues: p.issues ?? [], reason: e?.message ?? String(e) });
    }
  }
  return { revised: cur, applied, failed };
}

/* ── 主入口: 询问 LLM 出 patch plan + 应用 ─────────────────── */

export async function runHybridFix(opts: HybridFixOptions): Promise<HybridFixResult> {
  const { artifact, issues, settings, signal, onDelta } = opts;
  const actionable = issues.filter((i) => i.severity !== 'info');
  if (!actionable.length) {
    return {
      revised: artifact.content,
      applied: [],
      failed: [],
      skipped: [],
      raw: '',
      durationMs: 0,
    };
  }

  const nodeId = artifact.nodeId;
  const isPureJson = PURE_JSON_NODES.has(nodeId);
  const isPlanJson = PLAN_JSON_NODES.has(nodeId);
  const canJsonPatch = isPureJson || isPlanJson;
  const blocks = extractBlocks(artifact.content, nodeId);
  const canBlock = blocks.length > 0;

  /* 构造 prompt */
  const sys = [
    '你是一名严谨的 QA 修复员. 给定一份产物和若干 issue, **输出 patch 计划 (JSON), 而不是修订后的全文**.',
    '',
    '## 核心原则',
    '- 优先选**爆炸半径最小**的 patch 类型, 避免整体重写.',
    '- 一条 patch 可解决多条相关 issue (在 issues 字段列出 issueId).',
    '- 改不动的 issue 放进 skipped, **不要**编造 patch 应付.',
    '',
    '## 可用 patch 类型 (精度降序)',
    canJsonPatch
      ? '1. {"type":"jsonpatch","ops":[{"op":"replace|add|remove","path":"/RFC6901 路径","value":...}], "issues":["I1"]}'
      : '1. jsonpatch — **不可用** (本节点非 JSON 产物)',
    '2. {"type":"search-replace","old":"<原文中唯一精确出现的子串>","new":"<替换片段>","issues":["I2"]}',
    canBlock
      ? `3. {"type":"block","blockId":"<下面清单中的 ID>","newContent":"<整块新内容>","issues":["I3"]}`
      : '3. block — **不可用** (本节点无可寻址 block)',
    '4. {"type":"rewrite-all","newContent":"<整文新内容>","issues":["I4"]} — **仅当**上面三种都做不到才允许; 一旦使用必须是 patches 中**唯一**一条.',
    '',
    '## 严格约束',
    '- search-replace 的 `old` 必须是产物中**精确出现且仅出现一次**的子串 (含原始空格/标点/换行).',
    '- jsonpatch path 必须是合法 RFC 6901 JSON Pointer (例: /units/2/summary).',
    '- block.blockId 必须在下面给定清单中.',
    '- 输出**必须**是合法 JSON, 无 markdown 围栏, 无任何解释性前后缀.',
    '',
    '## JSON 字符串转义铁律 (违反即整批 patch 报废)',
    '- 字符串值内的 `"` 必须写成 `\\"`, 反斜杠写 `\\\\`, 换行写 `\\n`, 制表符 `\\t`.',
    '- **严禁** 在字符串值内出现真实换行 (会让 JSON 解析在该位置炸掉).',
    '- 字符串内出现 markdown 反引号 ``` / 引号 / emoji 都要保持转义后仍是合法 JSON 字符串.',
    '- patches 数组里多个对象之间**必须**有英文逗号; 末尾不要多余逗号.',
    '',
    '## 体量约束 (硬要求, 防止 JSON 解析失败)',
    '- 单条 patch 的 `newContent` / `value` 字符串 **≤ 2500 字**. 超出请拆成多条 search-replace 或 jsonpatch.',
    '- 一份 plan 里 `block` 类型 patch 数量 ≤ 3. 还修不完的剩余 issue 放 skipped, 让用户决定下一轮.',
    '- 优先级: search-replace > jsonpatch > block ≫ rewrite-all. 能用 search-replace 就**绝不**用 block.',
    '',
    '## 输出 schema',
    '{',
    '  "patches": [ <patch 对象数组> ],',
    '  "skipped": [ {"issueId":"I3","reason":"..."} ]',
    '}',
  ].join('\n');

  const issueBlocks = actionable.map((iss, i) => {
    const id = `I${i + 1}`;
    const lines = [
      `### ${id} · [${iss.severity}] ${iss.tag}`,
      `- 描述: ${iss.detail}`,
    ];
    if (iss.suggestion) lines.push(`- 建议: ${iss.suggestion}`);
    if (iss.locator) lines.push(`- 定位: ${iss.locator}`);
    return lines.join('\n');
  });

  const blockListing = canBlock
    ? ['', '# 可寻址 blocks', blocks.map((b) => `- ${b.blockId}`).join('\n'), ''].join('\n')
    : '';

  const user = [
    `# 产物信息`,
    `- nodeId: ${nodeId}`,
    `- title: ${artifact.title}`,
    `- 类型: ${isPureJson ? 'pure JSON' : isPlanJson ? 'JSON-in-markdown (plan-json)' : 'markdown'}`,
    blockListing,
    `# 待修订 ${actionable.length} 条 issue`,
    issueBlocks.join('\n\n'),
    '',
    `# 原产物`,
    '```',
    artifact.content,
    '```',
    '',
    '请直接输出 patch 计划的 JSON.',
  ].join('\n');

  const res = await chatStream({
    baseUrl: settings.baseUrl,
    apiKey: settings.apiKey,
    model: settings.model,
    messages: [
      { role: 'system', content: sys },
      { role: 'user', content: user },
    ],
    temperature: 0.2,
    max_tokens: settings.maxTokens,
    signal,
    onDelta,
  });

  /* 解析 plan: 三段式回退
     1) 严格 JSON.parse        — LLM 输出标准 JSON 时最快路径
     2) parseLooseJson         — 容忍 ```json 围栏 / 行尾逗号 / 末尾截断
     3) 逐 patch 抢救           — 主串无法整体解析时, 用括号匹配抠出每个 patch 对象
        (典型场景: block.newContent 内嵌大 markdown 触发引号/反斜杠转义错乱)
  */
  const cleaned = stripJsonFence(res.content);
  let plan: PatchPlan | null = null;
  let parseErr: string | null = null;
  try {
    plan = JSON.parse(cleaned);
  } catch (e: any) {
    parseErr = e?.message ?? String(e);
    try {
      plan = parseLooseJson(cleaned);
    } catch {
      const salvaged = salvagePatchObjects(cleaned);
      if (salvaged.length > 0) {
        plan = { patches: salvaged };
        // eslint-disable-next-line no-console
        console.warn(
          `[hybridFix] JSON 整体解析失败 (${parseErr}), 已抢救 ${salvaged.length} 条 patch 继续应用`,
        );
      }
    }
  }
  if (!plan || !Array.isArray(plan.patches)) {
    throw new Error(
      `hybridFix: LLM 未输出合法 JSON plan (${parseErr ?? '未知'}). ` +
      `原始输出前 200 字: ${cleaned.slice(0, 200)}`,
    );
  }

  const { revised, applied, failed } = applyPatchPlan(artifact.content, plan, nodeId);
  return {
    revised,
    applied,
    failed,
    skipped: plan.skipped ?? [],
    raw: res.content,
    durationMs: res.durationMs,
  };
}

function stripJsonFence(s: string): string {
  let t = s.trim();
  t = t.replace(/^```(?:json|JSON)?\s*\n/, '').replace(/\n```\s*$/, '');
  // 容忍前后说明: 取第一个 { 到最后一个 }
  const i = t.indexOf('{');
  const j = t.lastIndexOf('}');
  if (i >= 0 && j > i) t = t.slice(i, j + 1);
  return t;
}

/**
 * 抢救解析: 当主 JSON 因为某条 patch 内嵌大块 markdown 触发引号/逗号错乱
 * 而整体不可解析时, 逐对象扫描 `patches: [...]` 区间, 用括号深度匹配抠出
 * 单个 patch 对象, 对每个对象单独 parseLooseJson, 失败则跳过。
 *
 * 优势: 一条 patch 出错不会让整批 patch 全部丢弃 (这是 V5.1 storyboard.2
 * 大 UNIT 重写场景下 hybridFix 失败的主因)。
 */
function salvagePatchObjects(jsonText: string): Patch[] {
  const arrStart = (() => {
    const m = /"patches"\s*:\s*\[/.exec(jsonText);
    if (m) return m.index + m[0].length;
    const i = jsonText.indexOf('[');
    return i >= 0 ? i + 1 : -1;
  })();
  if (arrStart < 0) return [];

  const out: Patch[] = [];
  let i = arrStart;
  const n = jsonText.length;
  while (i < n) {
    while (i < n && /[\s,]/.test(jsonText[i])) i++;
    if (i >= n || jsonText[i] === ']') break;
    if (jsonText[i] !== '{') { i++; continue; }

    const start = i;
    let depth = 0, inStr = false, esc = false, end = -1;
    for (; i < n; i++) {
      const ch = jsonText[i];
      if (inStr) {
        if (esc) esc = false;
        else if (ch === '\\') esc = true;
        else if (ch === '"') inStr = false;
        continue;
      }
      if (ch === '"') inStr = true;
      else if (ch === '{') depth++;
      else if (ch === '}') {
        depth--;
        if (depth === 0) { end = i + 1; i++; break; }
      }
    }
    if (end < 0) break; // 截断, 余下不可救

    const objText = jsonText.slice(start, end);
    try {
      const obj = parseLooseJson(objText);
      if (obj && typeof obj === 'object' && typeof (obj as any).type === 'string') {
        out.push(obj as Patch);
      }
    } catch { /* 单条对象内部错乱, 跳过它继续 */ }
  }
  return out;
}
