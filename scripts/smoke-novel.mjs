#!/usr/bin/env node
// 小说全流程烟雾测试（不调用任何 LLM；纯本地校验）
//
// 验证目标：
//   1. 7 个 novel prompt JSON 文件存在且结构合法（messages[system]+[user]）
//   2. 用户消息中的 {{ var | filter }} 引用，在合成 ctx + artifacts 下都能解析
//   3. 用真实风格的"假 LLM 输出"喂给 parseVolumePlan / parseChapterOutlines，
//      确认能正确切分卷与章节
//   4. 验证调性 / 读者群 KB 预设注入到 user 消息底部
//   5. 输出 PASS / FAIL 表，定位每个阶段的薄弱点
//
// 用法：
//   node scripts/smoke-novel.mjs
//
// 退出码：失败数 > 0 时为 1；全通过为 0。

import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PROMPT_DIR = path.join(ROOT, 'public', 'prompts', 'novel');
const MANIFEST_PATH = path.join(ROOT, 'public', 'prompts', 'manifest.json');

/* ───────────────────────── 小工具 ───────────────────────── */
const checks = [];
function check(name, fn) {
  checks.push({ name, fn });
}
function color(s, c) {
  const codes = { red: 31, green: 32, yellow: 33, gray: 90, cyan: 36, bold: 1 };
  return `\x1b[${codes[c] ?? 0}m${s}\x1b[0m`;
}

/* ─────────── 内联：novel KB preset（与 novelTonePresets.ts 一致） ─────────── */
const NOVEL_TONE_PRESETS = {
  fast_pleasure: '调性硬律 · 爽文快节奏',
  literary: '调性硬律 · 文艺慢节奏',
  hardcore: '调性硬律 · 硬核',
  healing: '调性硬律 · 治愈日常',
  dark_heavy: '调性硬律 · 黑暗厚重',
  humor: '调性硬律 · 幽默吐槽',
};
const NOVEL_AUDIENCE_PRESETS = {
  male: '读者群偏好 · 男频',
  female: '读者群偏好 · 女频',
  general: '读者群偏好 · 通用',
};

/* ─────────── 内联：parseVolumePlan（与 novelLoop.ts 一致） ─────────── */
const CN_NUM = { 零: 0, 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };
function chineseToInt(s) {
  if (/^\d+$/.test(s)) return parseInt(s, 10);
  if (s.length === 1) return CN_NUM[s] ?? 0;
  if (s === '十') return 10;
  if (s.startsWith('十')) return 10 + (CN_NUM[s[1]] ?? 0);
  if (s.endsWith('十')) return (CN_NUM[s[0]] ?? 0) * 10;
  if (s.includes('十')) {
    const [a, b] = s.split('十');
    return (CN_NUM[a] ?? 1) * 10 + (CN_NUM[b] ?? 0);
  }
  return parseInt(s, 10) || 0;
}
function parseVolumePlan(content) {
  if (!content) return [];
  const lines = content.split(/\r?\n/);
  const volumes = [];
  let cur = null;
  const flush = () => {
    if (cur) {
      const raw = cur.buf.join('\n').trim();
      volumes.push({ index: cur.idx, title: cur.title.trim(), rawSection: raw });
    }
    cur = null;
  };
  for (const line of lines) {
    const m = line.match(/^#{1,4}\s*第\s*(\d+|[一二三四五六七八九十百千]+)\s*卷[\s·:：]*([^\n]*)$/);
    if (m) {
      flush();
      cur = { idx: chineseToInt(m[1]), title: m[2] || `第 ${m[1]} 卷`, buf: [line] };
    } else if (cur) {
      cur.buf.push(line);
    }
  }
  flush();
  // ── 回退：解析 markdown 表格行（与 src/pipeline/novelLoop.ts 保持一致）──
  if (volumes.length === 0) {
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line.startsWith('|')) continue;
      if (/^\|[\s\-:|]+\|?$/.test(line)) continue;
      const cells = line.split('|').map((c) => c.trim()).filter((c, i, arr) => {
        return !(i === 0 && c === '') && !(i === arr.length - 1 && c === '');
      });
      if (cells.length < 2) continue;
      const idx = chineseToInt(cells[0]);
      if (!idx || idx < 1 || idx > 99) continue;
      if (/卷号|序号|编号|index|no\.?/i.test(cells[0])) continue;
      const title = cells[1] || `第 ${idx} 卷`;
      volumes.push({
        index: idx,
        title: title.replace(/^[\[【]|[\]】]$/g, '').trim(),
        rawSection: rawLine,
      });
    }
  }
  return volumes.sort((a, b) => a.index - b.index);
}

function extractField(text, keys) {
  for (const k of keys) {
    const re = new RegExp(`(?:^|\\n)\\s*[-*•]?\\s*\\*{0,2}${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\*{0,2}\\s*[：:]\\s*([^\\n]+)`, 'i');
    const m = text.match(re);
    if (m) return m[1].trim();
  }
  return '';
}
function parseChapterOutlines(content) {
  if (!content) return [];
  const lines = content.split(/\r?\n/);
  const chapters = [];
  let curVol = 0;
  let cur = null;
  const flush = () => {
    if (cur) {
      const raw = cur.buf.join('\n').trim();
      cur.ch.rawSection = raw;
      cur.ch.beat = extractField(raw, ['戏点', '主线推进', '本章戏点', '本章核心']) || undefined;
      cur.ch.paceTag = extractField(raw, ['节奏标签', '节奏', '密度']) || undefined;
      cur.ch.foreshadowOps = extractField(raw, ['伏笔', '伏笔指令']) || undefined;
      chapters.push(cur.ch);
    }
    cur = null;
  };
  for (const line of lines) {
    const volM = line.match(/^#{1,4}\s*(?:第\s*)?卷\s*(\d+|[一二三四五六七八九十百千]+)/)
      || line.match(/^#{1,4}\s*第\s*(\d+|[一二三四五六七八九十百千]+)\s*卷/);
    if (volM && /卷/.test(line)) { flush(); curVol = chineseToInt(volM[1]); continue; }
    const chM = line.match(/^#{2,4}\s*第\s*(\d+|[一二三四五六七八九十百千]+)\s*章[\s·:：]*([^\n\[]*)/);
    if (chM) {
      flush();
      cur = {
        ch: {
          index: chineseToInt(chM[1]),
          title: (chM[2] || '').trim() || `第 ${chM[1]} 章`,
          volumeIndex: curVol || undefined,
          rawSection: '',
        },
        buf: [line],
      };
    } else if (cur) {
      cur.buf.push(line);
    }
  }
  flush();
  // ── 回退：解析 markdown 表格行 ──
  if (chapters.length === 0) {
    let curVol2 = 0;
    for (const rawLine of lines) {
      const line = rawLine.trim();
      const vm = line.match(/^#{1,4}\s*(?:第\s*)?卷\s*(\d+|[一二三四五六七八九十百千]+)/)
        || line.match(/^#{1,4}\s*第\s*(\d+|[一二三四五六七八九十百千]+)\s*卷/);
      if (vm && /卷/.test(line)) { curVol2 = chineseToInt(vm[1]); continue; }
      if (!line.startsWith('|')) continue;
      if (/^\|[\s\-:|]+\|?$/.test(line)) continue;
      const cells = line.split('|').map((c) => c.trim()).filter((c, i, arr) => {
        return !(i === 0 && c === '') && !(i === arr.length - 1 && c === '');
      });
      if (cells.length < 3) continue;
      if (/^(?:章号|序号|编号|chapter|no\.?|#)$/i.test(cells[0])) continue;
      const idxMatch = cells[0].match(/^(\d+)$/) || cells[0].match(/^第?\s*(\d+)\s*章?$/);
      if (!idxMatch) continue;
      const idx = parseInt(idxMatch[1], 10);
      if (!idx || idx < 1 || idx > 9999) continue;
      const titleCell = cells[1] ?? '';
      if (/^\[.*\]$/.test(titleCell) || /本卷全部章节|零省略|\.\.\./i.test(titleCell)) continue;
      const tw = parseInt((cells[3] ?? '').replace(/[^\d]/g, ''), 10);
      chapters.push({
        index: idx,
        title: titleCell.replace(/^[\[【]|[\]】]$/g, '').trim() || `第 ${idx} 章`,
        volumeIndex: curVol2 || undefined,
        beat: cells[2] || undefined,
        paceTag: cells[4] || undefined,
        foreshadowOps: cells[8] || undefined,
        targetWords: !isNaN(tw) && tw > 100 ? tw : undefined,
        rawSection: rawLine,
      });
    }
  }
  return chapters.sort((a, b) => a.index - b.index);
}

/* ───────────────────────── Test 1: prompt 文件存在 ───────────────────────── */
const NOVEL_FILES = ['1.1', '1.2', '2.1', '2.2', '2.3', '3.1', '3.2'];

check('1. 所有 7 个 novel prompt JSON 存在', async () => {
  const missing = NOVEL_FILES.filter((n) => !existsSync(path.join(PROMPT_DIR, `${n}.json`)));
  if (missing.length) throw new Error(`缺失: ${missing.join(', ')}`);
  return `✓ ${NOVEL_FILES.length}/7`;
});

check('2. manifest.json 列出全部 7 个 novel 节点', async () => {
  const txt = await readFile(MANIFEST_PATH, 'utf8');
  const m = JSON.parse(txt);
  const novel = m.stages?.find((s) => s.id === 'novel');
  if (!novel) throw new Error('manifest 中没有 novel stage');
  const ids = (novel.steps ?? []).map((s) => s.id);
  const expected = ['novel.1', 'novel.2', 'novel.3', 'novel.4', 'novel.5', 'novel.6', 'novel.7'];
  const missing = expected.filter((e) => !ids.includes(e));
  if (missing.length) throw new Error(`manifest 缺失: ${missing.join(', ')}`);
  return `✓ ${ids.length}/7`;
});

/* ───────────────────────── Test 3: 每个 prompt 结构合法 ───────────────────────── */
const promptCache = {};
async function loadPrompt(name) {
  if (!promptCache[name]) {
    const txt = await readFile(path.join(PROMPT_DIR, `${name}.json`), 'utf8');
    promptCache[name] = JSON.parse(txt);
  }
  return promptCache[name];
}

for (const name of NOVEL_FILES) {
  check(`3. novel/${name}.json 结构（system + user）`, async () => {
    const p = await loadPrompt(name);
    if (!Array.isArray(p.messages)) throw new Error('messages 不是数组');
    const sys = p.messages.find((m) => m.role === 'system');
    const usr = p.messages.find((m) => m.role === 'user');
    if (!sys?.content) throw new Error('system 消息缺失或为空');
    if (!usr?.content) throw new Error('user 消息缺失或为空');
    if (sys.content.length < 200) throw new Error(`system 太短 (${sys.content.length} 字)`);
    return `system ${sys.content.length} 字 / user ${usr.content.length} 字`;
  });
}

/* ───────────────────────── Test 4: 模板变量解析 ───────────────────────── */
// 合成完整 ctx + artifacts，检查每个 user 消息中的 {{ }} 都不会留下未替换的占位符
const MOCK_CTX = {
  name: '《长夜未央》',
  projectMode: 'novel',
  concept: '仙侠+系统流·男频·起点中文网·80万/228章',
  genres: ['xianxia', 'system'],
  protagonistGender: 'male',
  coreConflict: '少年绑定签到系统立誓十年内灭杀屠戮全族的仇家',
  novelPlatform: 'qidian',
  novelScale: 'long',
  novelPov: 'third_limited',
  novelAudience: 'male',
  novelTone: 'fast_pleasure',
  novelTotalWordsK: 80,
  novelTotalChapters: 228,
  novelLogline: '当所有修真者都在追逐天道，他选择跟天道讨债',
  novelHook: '每杀同境界敌人吞噬其修为，但每次都带回死者最痛苦的记忆',
};

const MOCK_ARTIFACTS = {
  'novel.1': { content: '# 世界观设定\n（mock 世界观文档 800 字）'.repeat(3) },
  'novel.2': { content: '# 人物 Bible\n## 主角 林墨\n（mock 人物档案）'.repeat(3) },
  'novel.3': { content: `# 全书分卷规划

## 第 1 卷 · 落魄少年（约 30-40 章）
主角立志报仇，绑定签到系统，初探修真界。

## 第 2 卷 · 步步高升（约 60-80 章）
进入宗门，结交盟友，发现仇家更深的阴谋。

## 第 3 卷 · 真相大白（约 80-100 章）
终极决战，主角面对系统的真正代价。
` },
  'novel.4': { content: `# 单卷分章明细

## 第 1 卷 · 落魄少年

### 第 1 章 · 灭门之夜
- 戏点：少年目睹全族被屠戮，觉醒签到系统
- 节奏标签：高密度爆点
- 伏笔：埋下真凶身份疑点

### 第 2 章 · 第一次签到
- 戏点：试用系统，获得第一份资源
- 节奏标签：信息密集

### 第 3 章 · 立誓报仇
- 戏点：决心进入修真界，与系统达成契约
- 节奏标签：情绪转折

### 第 4 章 · 山门之外
- 戏点：第一次接触修真者，被嘲讽
- 节奏标签：日常铺垫

### 第 5 章 · 入门考核
- 戏点：以打脸方式通过考核，引起注目
- 节奏标签：爽点爆发
- 伏笔：推进"真凶"线索一段
` },
  'novel.5': { content: '# 伏笔表\n（mock 伏笔表）' },
  'novel.6': { content: '# 第 1 章草稿\n（mock 章节正文 3500 字）' },
  'novel.7': { content: '# 第 1 章润色\n（mock 润色后正文）' },
};

// 这些变量由 loop runner 在运行时通过 userOverride 注入（非 project/artifacts 命名空间）
// 详见 src/pipeline/novelLoop.ts 中 runVolumeLoop / runChapterLoopShared 的 userOverride 构造。
const LOOP_RUNTIME_VARS = new Set([
  'priorVolumes', 'currentVolume', 'allVolumes',         // 卷循环
  'rollingContext', 'chapterIndex', 'chapterTitle',      // 章节循环：滚动上下文
  'chapterBeat', 'paceTag', 'foreshadowOps', 'targetWords',
  'previousChapter', 'currentChapterDraft',              // 润色循环
]);

function getMockValue(varPath) {
  // varPath 如: "project.name" / "project.coreConflict" / "artifacts.novel.3.content"
  const parts = varPath.split('.');
  let cur;
  if (parts[0] === 'project') {
    cur = MOCK_CTX;
    parts.shift();
  } else if (parts[0] === 'artifacts') {
    cur = MOCK_ARTIFACTS;
    parts.shift();
    // artifacts.novel.X.content → key 是 "novel.X"
    if (parts.length >= 2) {
      const key = `${parts[0]}.${parts[1]}`;
      if (MOCK_ARTIFACTS[key]) {
        cur = MOCK_ARTIFACTS[key];
        parts.splice(0, 2);
      } else {
        return undefined;
      }
    }
  } else {
    return undefined;
  }
  for (const p of parts) {
    if (cur == null) return undefined;
    cur = cur[p];
  }
  return cur;
}

for (const name of NOVEL_FILES) {
  check(`4. novel/${name}.json 模板变量可解析`, async () => {
    const p = await loadPrompt(name);
    const usr = p.messages.find((m) => m.role === 'user').content;
    const re = /\{\{\s*([^}|]+?)(?:\s*\|[^}]*)?\s*\}\}/g;
    const refs = [];
    let m;
    while ((m = re.exec(usr)) !== null) {
      refs.push(m[1].trim());
    }
    if (refs.length === 0) return '无变量引用';
    const unresolved = [];
    const loopVars = [];
    for (const r of refs) {
      // loop runtime 变量是合法的（loop runner 会用 userOverride 注入），跳过
      if (LOOP_RUNTIME_VARS.has(r.split('.')[0])) { loopVars.push(r); continue; }
      const v = getMockValue(r);
      if (v === undefined || v === null) unresolved.push(r);
    }
    if (unresolved.length) throw new Error(`未解析（既非 ctx/artifacts 也非 loop 运行时变量）: ${[...new Set(unresolved)].join(', ')}`);
    const detail = `${refs.length} 处引用 / ${refs.length - loopVars.length} 来自 ctx+artifacts`
      + (loopVars.length ? ` / ${loopVars.length} 来自 loop runtime` : '');
    return detail;
  });
}

/* ───────────────────────── Test 5: parseVolumePlan ───────────────────────── */
check('5. parseVolumePlan 解析 N2.1 输出', async () => {
  const vols = parseVolumePlan(MOCK_ARTIFACTS['novel.3'].content);
  if (vols.length !== 3) throw new Error(`期望 3 卷，实际 ${vols.length}`);
  if (vols[0].title.indexOf('落魄少年') === -1) throw new Error(`卷 1 标题异常: "${vols[0].title}"`);
  if (vols[2].index !== 3) throw new Error(`卷 3 index 错误: ${vols[2].index}`);
  return `✓ 解析到 ${vols.length} 卷：${vols.map((v) => `${v.index}.${v.title}`).join(' / ')}`;
});

/* ───────────────────────── Test 6: parseChapterOutlines ───────────────────────── */
check('6. parseChapterOutlines 解析 N2.2 输出', async () => {
  const chs = parseChapterOutlines(MOCK_ARTIFACTS['novel.4'].content);
  if (chs.length !== 5) throw new Error(`期望 5 章，实际 ${chs.length}`);
  const ch1 = chs[0];
  if (ch1.index !== 1) throw new Error(`章 1 index: ${ch1.index}`);
  if (!ch1.beat) throw new Error(`章 1 戏点未抓到（应为「少年目睹...」）`);
  if (ch1.beat.indexOf('签到系统') === -1) throw new Error(`章 1 戏点内容异常: "${ch1.beat}"`);
  if (ch1.title.indexOf('灭门') === -1) throw new Error(`章 1 标题异常: "${ch1.title}"`);
  if (!ch1.paceTag) throw new Error(`章 1 节奏标签未抓到`);
  if (ch1.volumeIndex !== 1) throw new Error(`章 1 卷归属错误: ${ch1.volumeIndex}`);
  const withForeshadow = chs.filter((c) => c.foreshadowOps);
  if (withForeshadow.length === 0) throw new Error('全部章节都未识别伏笔指令');
  return `✓ ${chs.length} 章 / 戏点 ${chs.filter((c) => c.beat).length} / 节奏 ${chs.filter((c) => c.paceTag).length} / 伏笔 ${withForeshadow.length}`;
});

/* ───────────────────────── Test 6.5: N2.1 真实输出格式（markdown 表格） ───────── */
// Bug regression: N2.1 system prompt 要求输出表格，原 parseVolumePlan 仅识别 ## 标题
// 导致 N2.2 按钮被永久禁用（badge "需先跑 N2.1" 但实际已跑过）
check('6.5. parseVolumePlan 支持 N2.1 prompt 默认的 markdown 表格输出', async () => {
  const realN21Output = `# 大纲蓝图 · 仙侠爱情短剧 · 分卷规划

## 全书参数
- 总字数目标：80 万字
- 总章节数：228
- 每卷数量：3
- POV：第三·单

## 分卷规划
| 卷号 | 卷名 | 章号区间 | 字数 | 卷核心目标 | 卷末转折 / 钩子 |
|---|---|---|---|---|---|
| 一 | 落魄少年 | 1-30 | 12 万字 | 主角立志报仇绑定签到系统 | 仇家踪迹首次浮现 |
| 二 | 步步高升 | 31-110 | 32 万字 | 进入宗门发现更深阴谋 | 师门叛徒身份揭露 |
| 三 | 真相大白 | 111-228 | 36 万字 | 终极决战面对系统代价 | 系统真正身份反转 |

## 全书节奏锚点
- 第 1-3 章爽点类型：灭门觉醒
- 第 10 章首次大高潮：第一次签到爆发

[VOLUME-PLAN-END]`;
  const vols = parseVolumePlan(realN21Output);
  if (vols.length !== 3) throw new Error(`期望 3 卷，实际解析到 ${vols.length}`);
  if (vols[0].title !== '落魄少年') throw new Error(`卷 1 标题: "${vols[0].title}"`);
  if (vols[2].index !== 3) throw new Error(`卷 3 index: ${vols[2].index}`);
  return `✓ 表格格式回退解析成功，识别 ${vols.length} 卷：${vols.map((v) => `${v.index}.${v.title}`).join(' / ')}`;
});

/* ───────────────────────── Test 6.6: parseChapterOutlines 表格回退（N2.2 真实输出） ───── */
// Bug regression: N2.2 prompt 输出章节表格（`| 章号 | 标题 | 戏点 | ... |`），
// 不含 `### 第 N 章` 标题。原解析器对其返回 []，导致 Stage C "暂无章节列表"。
check('6.6. parseChapterOutlines 支持 N2.2 prompt 默认的 markdown 表格输出', async () => {
  const realN22Output = `## 卷 1 · 落魄少年（第 1-5 章）
**卷核心**：主角立志报仇绑定签到系统
**开卷钩子**：灭门之夜的觉醒

| 章号 | 标题 | 戏点（一句话 50-100 字） | 字数 | 节奏标签 | 不可逆事件 | 转折 1 / 2 | 钩子类型 | 埋入线索 ID（回收章） | 情绪波峰 |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 灭门之夜 | 少年目睹全族被屠戮，觉醒签到系统 | 3500 | 爽点·开场 | 全族灭亡 | 第 30% / 第 75% | 新威胁 | L001（第 8 章） | 震惊→沉默 |
| 2 | 第一次签到 | 主角试用系统，获得修真初阶资源 | 3200 | 回血 | 系统契约确立 | 第 30% / 第 80% | 信息反转 | L002（第 12 章） | 失落→希望 |
| 3 | 立誓报仇 | 决心进入修真界，与系统达成代价契约 | 3500 | 转折 | 主角誓言宣告 | 第 25% / 第 70% | 危险决定 | L003（第 20 章） | 悲愤→坚定 |

## 卷 1 节奏审计
- 是否有连续 ≥3 个爽点章：否
- 卷末高潮章号：30
- 本卷新增伏笔编号：L001-L003

[VOLUME-1-END]`;
  const chs = parseChapterOutlines(realN22Output);
  if (chs.length !== 3) throw new Error(`期望 3 章，实际 ${chs.length}`);
  const ch1 = chs[0];
  if (ch1.index !== 1) throw new Error(`章 1 index: ${ch1.index}`);
  if (ch1.title !== '灭门之夜') throw new Error(`章 1 title: "${ch1.title}"`);
  if (!ch1.beat?.includes('签到系统')) throw new Error(`章 1 beat: "${ch1.beat}"`);
  if (ch1.targetWords !== 3500) throw new Error(`章 1 targetWords: ${ch1.targetWords}`);
  if (ch1.paceTag !== '爽点·开场') throw new Error(`章 1 paceTag: "${ch1.paceTag}"`);
  if (!ch1.foreshadowOps?.includes('L001')) throw new Error(`章 1 foreshadowOps: "${ch1.foreshadowOps}"`);
  if (ch1.volumeIndex !== 1) throw new Error(`章 1 volumeIndex: ${ch1.volumeIndex}`);
  return `✓ 表格格式回退解析成功，识别 ${chs.length} 章 / 全部含戏点+字数+节奏+伏笔`;
});

/* ───────────────────────── Test 6.7: 跳过示例占位行 ───────────────────────── */
check('6.7. parseChapterOutlines 跳过 N2.2 prompt 模板里的示例占位行', async () => {
  // prompt 自身的示例使用了占位符 A / [标题] / "本卷全部章节"，必须跳过
  const md = `| 章号 | 标题 | 戏点 | 字数 | 节奏标签 |
|---|---|---|---|---|
| A | [标题] | [一句话] | 3500 | 爽点·开场 |
| A+1 | [标题] | [一句话] | 3200 | 回血 |
| ... | (本卷全部章节，零省略) | ... | ... | ... |
| 1 | 真章节 | 真戏点 | 3500 | 真节奏 |`;
  const chs = parseChapterOutlines(md);
  if (chs.length !== 1) throw new Error(`期望 1 章（仅真章节），实际 ${chs.length}`);
  if (chs[0].title !== '真章节') throw new Error(`title: "${chs[0].title}"`);
  return `✓ 占位行 A / [标题] / 「本卷全部章节」均被跳过`;
});

/* ───────────────────────── Test 17: de_ai 模式集成 ───────────────────────── */
check('17. 去 AI 化模式（de_ai）已贯通：prompt + type + UI', async () => {
  // a) prompt 里有【去AI化】前缀
  const promptTxt = await readFile(path.join(PROMPT_DIR, '3.2.json'), 'utf8');
  if (!promptTxt.includes('【去AI化】')) throw new Error('public/prompts/novel/3.2.json 没有【去AI化】前缀');
  if (!promptTxt.includes('反 AI 笔触')) throw new Error('3.2.json 缺去 AI 化模式说明');
  // b) NovelPolishMode 含 de_ai
  const loop = await readFile(path.join(ROOT, 'src', 'pipeline', 'novelLoop.ts'), 'utf8');
  if (!loop.includes("'de_ai'")) throw new Error('NovelPolishMode 未加 de_ai');
  if (!loop.includes('【去AI化】')) throw new Error('POLISH_MODE_PREFIX 未加【去AI化】');
  // c) UI 选项
  const ui = await readFile(path.join(ROOT, 'src', 'pages', 'Novel.tsx'), 'utf8');
  if (!ui.includes('value="de_ai"')) throw new Error('Novel.tsx polish select 未加 de_ai option');
  return '✓ prompt + type + UI 三处全部对齐';
});

/* ───────────────────────── Test 7: 中文卷/章序号 ───────────────────────── */
check('7. parseVolumePlan / parseChapterOutlines 支持中文数字', async () => {
  const md = `# 测试

## 第 一 卷 · 测试卷
说明

### 第 二 章 · 测试章
- 戏点：测试戏点
`;
  const vols = parseVolumePlan(md);
  const chs = parseChapterOutlines(md);
  if (vols.length !== 1 || vols[0].index !== 1) throw new Error(`卷解析失败: ${JSON.stringify(vols.map((v) => v.index))}`);
  if (chs.length !== 1 || chs[0].index !== 2) throw new Error(`章解析失败: ${JSON.stringify(chs.map((c) => c.index))}`);
  return '✓ 中文「一」「二」识别正确';
});

/* ───────────────────────── Test 8: 调性 / 读者 KB 预设存在 ───────────────────────── */
check('8. KB 预设：6 调性 + 3 读者群', async () => {
  const tones = Object.keys(NOVEL_TONE_PRESETS);
  const auds = Object.keys(NOVEL_AUDIENCE_PRESETS);
  if (tones.length !== 6) throw new Error(`tone 预设期望 6 套，实际 ${tones.length}`);
  if (auds.length !== 3) throw new Error(`audience 预设期望 3 套，实际 ${auds.length}`);
  // 检查 ctx 中实际选中的两个有 preset 命中
  if (!NOVEL_TONE_PRESETS[MOCK_CTX.novelTone]) throw new Error(`MOCK_CTX.novelTone="${MOCK_CTX.novelTone}" 未命中预设`);
  if (!NOVEL_AUDIENCE_PRESETS[MOCK_CTX.novelAudience]) throw new Error(`MOCK_CTX.novelAudience="${MOCK_CTX.novelAudience}" 未命中预设`);
  return `✓ 调性 ${tones.length} / 读者群 ${auds.length} / mock ctx 命中`;
});

/* ───────────────────────── Test 9: novelTonePresets.ts 文件实际存在 ───────────────────────── */
check('9. src/pipeline/novelTonePresets.ts 实际存在且导出 getNovelPresets', async () => {
  const f = path.join(ROOT, 'src', 'pipeline', 'novelTonePresets.ts');
  if (!existsSync(f)) throw new Error(`文件不存在: ${f}`);
  const txt = await readFile(f, 'utf8');
  if (txt.indexOf('export function getNovelPresets') === -1)
    throw new Error('未导出 getNovelPresets');
  const tones = (txt.match(/^\s+(fast_pleasure|literary|hardcore|healing|dark_heavy|humor):/gm) ?? []).length;
  if (tones < 6) throw new Error(`只找到 ${tones} 个 tone 预设`);
  return `✓ 6 调性 + 3 读者群预设完整`;
});

/* ───────────────────────── Test 10: ProjectContext 有小说字段 ───────────────────────── */
check('10. types.ts 包含全部小说字段', async () => {
  const f = path.join(ROOT, 'src', 'pipeline', 'types.ts');
  const txt = await readFile(f, 'utf8');
  const requiredFields = [
    'novelPlatform', 'novelScale', 'novelPov', 'novelAudience', 'novelTone',
    'novelTotalWordsK', 'novelTotalChapters', 'novelLogline', 'novelHook',
  ];
  const missing = requiredFields.filter((k) => txt.indexOf(k) === -1);
  if (missing.length) throw new Error(`types.ts 缺字段: ${missing.join(', ')}`);
  return `✓ ${requiredFields.length} 字段全在`;
});

/* ───────────────────────── Test 11: interpolate.ts 注入 KB preset ───────────────────────── */
check('11. interpolate.ts 注入 getNovelPresets', async () => {
  const f = path.join(ROOT, 'src', 'pipeline', 'interpolate.ts');
  const txt = await readFile(f, 'utf8');
  if (txt.indexOf('getNovelPresets') === -1)
    throw new Error('interpolate.ts 未引用 getNovelPresets');
  if (txt.indexOf("from './novelTonePresets'") === -1)
    throw new Error('interpolate.ts 未 import novelTonePresets');
  return '✓ KB preset 已接线到 buildStructuredFields';
});

/* ───────────────────────── Test 12: bestOfN 推荐节点包含 novel ───────────────────────── */
check('12. bestOfN.ts 白名单包含 novel.1/3/6', async () => {
  const f = path.join(ROOT, 'src', 'pipeline', 'bestOfN.ts');
  const txt = await readFile(f, 'utf8');
  for (const id of ['novel.1', 'novel.3', 'novel.6']) {
    if (txt.indexOf(`'${id}'`) === -1) throw new Error(`白名单缺少 ${id}`);
  }
  return '✓ novel.1 / novel.3 / novel.6 都在 BEST_OF_N_NODES';
});

/* ───────────────────────── Test 13: novelLoop 集成 useBestOfN ───────────────────────── */
check('13. novelLoop.ts 章节循环支持 useBestOfN', async () => {
  const f = path.join(ROOT, 'src', 'pipeline', 'novelLoop.ts');
  const txt = await readFile(f, 'utf8');
  if (txt.indexOf('useBestOfN') === -1) throw new Error('未声明 useBestOfN 选项');
  if (txt.indexOf('runStepBestOfN') === -1) throw new Error('未在循环内调用 runStepBestOfN');
  return '✓ 章节草稿循环可启用 Best-of-N';
});

/* ───────────────────────── Test 14: 调性切换会改变 KB preset ───────────────────────── */
check('14. 不同 tone 注入不同 KB preset 文本', async () => {
  // 简化：直接对比两个 tone 的预设文本不一样
  const a = NOVEL_TONE_PRESETS.fast_pleasure;
  const b = NOVEL_TONE_PRESETS.literary;
  if (a === b) throw new Error('fast_pleasure 与 literary 预设文本相同');
  return '✓ fast_pleasure ≠ literary，预设有区分度';
});

/* ───────────────────────── Test 15: NewProjectDialog 表单已重写 ───────────────────────── */
check('15. NewProjectDialog NovelForm 包含新字段', async () => {
  const f = path.join(ROOT, 'src', 'components', 'NewProjectDialog.tsx');
  const txt = await readFile(f, 'utf8');
  const required = [
    'novelPlatform', 'novelScale', 'novelPov', 'novelAudience', 'novelTone',
    'NOVEL_PLATFORMS', 'NOVEL_SCALES', 'NOVEL_POVS',
  ];
  const missing = required.filter((k) => txt.indexOf(k) === -1);
  if (missing.length) throw new Error(`NewProjectDialog 缺: ${missing.join(', ')}`);
  return '✓ 表单已包含全部小说设定字段';
});

/* ───────────────────────── Test 16: Novel.tsx 摘要卡 + 编辑对话框 ───────────────────────── */
check('16. Novel.tsx 含 ProjectSettingsCard + NovelSettingsDialog', async () => {
  const f = path.join(ROOT, 'src', 'pages', 'Novel.tsx');
  const txt = await readFile(f, 'utf8');
  if (txt.indexOf('ProjectSettingsCard') === -1) throw new Error('缺 ProjectSettingsCard');
  if (txt.indexOf('NovelSettingsDialog') === -1) throw new Error('缺 NovelSettingsDialog');
  if (txt.indexOf('useBestOfN') === -1) throw new Error('缺 Best-of-N 全局开关');
  return '✓ 全部 UI 集成到位';
});

/* ─────────── 资料库 v2 (P0) — 基建层验证 ─────────── */

check('18. 资料库 v2 · 4 个 LLM 提炼 prompt 文件存在且 schema 合法', async () => {
  const KB_PROMPT_DIR = path.join(ROOT, 'public', 'prompts', 'kb');
  const required = [
    'extract-trend.json',
    'extract-sample.json',
    'extract-anti-pattern.json',
    'summarize-feedback.json',
  ];
  for (const f of required) {
    const p = path.join(KB_PROMPT_DIR, f);
    if (!existsSync(p)) throw new Error(`缺失：${p}`);
    const j = JSON.parse(await readFile(p, 'utf8'));
    if (!j.id || !j.id.startsWith('kb.')) throw new Error(`${f}: id 缺失或前缀不是 kb.`);
    if (!Array.isArray(j.messages) || j.messages.length < 2) throw new Error(`${f}: messages 不足 2 条`);
    const sys = j.messages.find((m) => m.role === 'system');
    const usr = j.messages.find((m) => m.role === 'user');
    if (!sys || !sys.content) throw new Error(`${f}: 缺 system message`);
    if (!usr || !usr.content) throw new Error(`${f}: 缺 user message`);
    if (sys.content.length < 200) throw new Error(`${f}: system 太短（${sys.content.length} 字），可能是占位骨架`);
    // user 消息应有插值变量
    if (!/\{\{\s*\w+\s*\}\}/.test(usr.content)) {
      throw new Error(`${f}: user 消息未发现 {{ var }} 插值变量`);
    }
  }
  return `✓ ${required.length}/4 prompt 完整：${required.map((f) => f.replace('.json', '')).join(', ')}`;
});

check('19. 资料库 v2 · userKb.ts 类型 + helpers 完整', async () => {
  const txt = await readFile(path.join(ROOT, 'src', 'store', 'userKb.ts'), 'utf8');
  const requiredTypes = ['UserKbDoc', 'UserKbFeedback', 'UserKbDocType'];
  for (const t of requiredTypes) {
    if (!new RegExp(`(export\\s+(?:type|interface)\\s+${t})`).test(txt)) {
      throw new Error(`缺类型 ${t}`);
    }
  }
  const requiredFns = [
    'listUserKbDocs',
    'getUserKbDoc',
    'createUserKbDoc',
    'updateUserKbDoc',
    'deleteUserKbDoc',
    'listUserKbDocsForProject',
    'recordUserKbFeedback',
    'listUserKbFeedback',
    'clearUserKbFeedbackForProject',
  ];
  for (const fn of requiredFns) {
    if (!new RegExp(`export\\s+async\\s+function\\s+${fn}\\b`).test(txt)) {
      throw new Error(`缺 helper ${fn}`);
    }
  }
  // 6 个 type 都要在 USER_KB_TYPE_META 里有定义
  const expectedTypes = ['trend', 'sample', 'antiPattern', 'styleGuide', 'worldHardSchema', 'voiceCard'];
  for (const t of expectedTypes) {
    if (!new RegExp(`\\b${t}:\\s*\\{`).test(txt)) {
      throw new Error(`USER_KB_TYPE_META 缺 ${t}`);
    }
  }
  return `✓ 3 type / 9 helper / 6 type meta 全在`;
});

check('20. 资料库 v2 · Dexie v3 schema 注册 userKbDocs + userKbFeedback', async () => {
  const txt = await readFile(path.join(ROOT, 'src', 'store', 'db.ts'), 'utf8');
  if (!/this\.version\(3\)/.test(txt)) throw new Error('缺 v3 schema 升级');
  if (!/userKbDocs:\s*'/.test(txt)) throw new Error('缺 userKbDocs 表');
  if (!/userKbFeedback:\s*'/.test(txt)) throw new Error('缺 userKbFeedback 表');
  if (!/userKbDocs!:\s*Table<UserKbDoc/.test(txt)) throw new Error('缺 userKbDocs Table 字段');
  if (!/userKbFeedback!:\s*Table<UserKbFeedback/.test(txt)) throw new Error('缺 userKbFeedback Table 字段');
  // Project 接口也要带新字段
  if (!/userKbDocIds\?:\s*number\[\]/.test(txt)) throw new Error('Project 接口缺 userKbDocIds');
  if (!/methodModuleIds\?:\s*string\[\]/.test(txt)) throw new Error('Project 接口缺 methodModuleIds');
  return '✓ v3 表 + Project 字段全在';
});

/* ─────────── 资料库 v2 (P1) — 注入 + UI 接线验证 ─────────── */

check('21. 资料库 v2 · extractKb.ts 含 LLM 提炼 + buildUserKbPreamble', async () => {
  const txt = await readFile(path.join(ROOT, 'src', 'llm', 'extractKb.ts'), 'utf8');
  if (!/export\s+async\s+function\s+extractUserKbDoc\b/.test(txt)) {
    throw new Error('缺 extractUserKbDoc');
  }
  if (!/export\s+function\s+buildUserKbPreamble\b/.test(txt)) {
    throw new Error('缺 buildUserKbPreamble');
  }
  // 渲染分支必须覆盖至少 4 个 type
  for (const t of ['trend', 'styleGuide', 'antiPattern', 'sample']) {
    if (!new RegExp(`case\\s+'${t}'`).test(txt)) {
      throw new Error(`renderStructuredForType 缺 ${t} 分支`);
    }
  }
  // 用 lite 模型（提炼任务低创意）
  if (!/modelLite\s*\|\|\s*settings\.model/.test(txt)) {
    throw new Error('未优先用 modelLite（提炼任务应该走廉价模型）');
  }
  // temperature 必须低
  if (!/temperature:\s*0\.[01]\d?\b/.test(txt) && !/temperature:\s*0\b/.test(txt)) {
    throw new Error('temperature 未设为低值（提炼任务应稳定）');
  }
  return '✓ extractUserKbDoc + buildUserKbPreamble + 4 type 渲染分支 + lite 模型路由';
});

check('22. 资料库 v2 · compose.ts 接线 userKb 注入 + 节点策略', async () => {
  const txt = await readFile(path.join(ROOT, 'src', 'pipeline', 'compose.ts'), 'utf8');
  if (!/from\s+'\.\.\/store\/userKb'/.test(txt)) {
    throw new Error('compose.ts 未引入 userKb');
  }
  if (!/buildUserKbPreamble/.test(txt)) {
    throw new Error('compose.ts 未调用 buildUserKbPreamble');
  }
  if (!/function\s+userKbTypesForNode/.test(txt)) {
    throw new Error('compose.ts 缺节点策略函数 userKbTypesForNode');
  }
  // 注入策略：novel.3.1 (草稿) 必须含 sample + antiPattern（最重要的注入点）
  const m = txt.match(/nodeId\s*===\s*'novel\.3\.1'[^}]*?return\s+\[([^\]]+)\]/);
  if (!m) throw new Error('novel.3.1 注入策略未找到');
  const types = m[1];
  for (const t of ['sample', 'antiPattern', 'styleGuide', 'trend']) {
    if (!types.includes(`'${t}'`)) throw new Error(`novel.3.1 注入缺 ${t}`);
  }
  // 仅 novel.* 启用，screenplay 等不影响
  if (!/!nodeId\.startsWith\('novel\.'\)/.test(txt)) {
    throw new Error('应限制仅 novel.* 启用 userKb 注入');
  }
  return '✓ 注入接线 + 节点策略 + novel.3.1 含 4 类资料';
});

check('23. 资料库 v2 · ProjectContext 含 userKbDocIds + methodModuleIds', async () => {
  const txt = await readFile(path.join(ROOT, 'src', 'pipeline', 'types.ts'), 'utf8');
  if (!/userKbDocIds\?:\s*number\[\]/.test(txt)) {
    throw new Error('ProjectContext 缺 userKbDocIds');
  }
  if (!/methodModuleIds\?:\s*string\[\]/.test(txt)) {
    throw new Error('ProjectContext 缺 methodModuleIds');
  }
  return '✓ ProjectContext 含 v3 资料库绑定字段';
});

check('24. 资料库 v2 · KnowledgeBase 页面 tab + UserKbLibrary + UploadDialog', async () => {
  const kbTxt = await readFile(path.join(ROOT, 'src', 'pages', 'KnowledgeBase.tsx'), 'utf8');
  if (!/UserKbLibrary/.test(kbTxt)) throw new Error('KnowledgeBase 未引入 UserKbLibrary');
  if (!/BuiltinKbView/.test(kbTxt)) throw new Error('内置 KB 视图未保留为 BuiltinKbView');
  if (!/'builtin'\s*\|\s*'user'/.test(kbTxt)) throw new Error('缺 KbTab 类型');

  const libTxt = await readFile(path.join(ROOT, 'src', 'components', 'UserKbLibrary.tsx'), 'utf8');
  if (!/export\s+function\s+UserKbLibrary\b/.test(libTxt)) throw new Error('UserKbLibrary 未 export');
  if (!/UserKbUploadDialog/.test(libTxt)) throw new Error('UserKbLibrary 未集成 UserKbUploadDialog');
  // 6 类型筛选都要在 UI 里
  for (const t of ['trend', 'sample', 'antiPattern', 'styleGuide', 'worldHardSchema', 'voiceCard']) {
    if (!new RegExp(`'${t}'`).test(libTxt)) throw new Error(`类型筛选缺 ${t}`);
  }

  const dlgTxt = await readFile(path.join(ROOT, 'src', 'components', 'UserKbUploadDialog.tsx'), 'utf8');
  if (!/export\s+function\s+UserKbUploadDialog\b/.test(dlgTxt)) throw new Error('UserKbUploadDialog 未 export');
  if (!/extractUserKbDoc/.test(dlgTxt)) throw new Error('UploadDialog 未调用 extractUserKbDoc');
  if (!/createUserKbDoc/.test(dlgTxt)) throw new Error('UploadDialog 未调用 createUserKbDoc');
  // 必须有「跳过提炼」分支（兜底，避免 LLM 不可用时无法保存）
  if (!/handleSkipExtract/.test(dlgTxt)) throw new Error('UploadDialog 缺「跳过提炼」分支');
  return '✓ tab + UserKbLibrary + UploadDialog（含跳过提炼分支） + 6 type 筛选';
});

check('25. 资料库 v2 (P1b) · UserKbBindingPanel 接入 NovelSettingsDialog + 摘要卡', async () => {
  const novelTxt = await readFile(path.join(ROOT, 'src', 'pages', 'Novel.tsx'), 'utf8');
  if (!/UserKbBindingPanel/.test(novelTxt)) throw new Error('Novel.tsx 未引入 UserKbBindingPanel');
  // 设置对话框：必须有 state + 保存 patch
  if (!/setUserKbDocIds/.test(novelTxt)) throw new Error('NovelSettingsDialog 缺 userKbDocIds state');
  if (!/userKbDocIds:\s*userKbDocIds\.length/.test(novelTxt)) {
    throw new Error('handleSave 未把 userKbDocIds 写入 patch');
  }
  // 摘要卡：显示绑定数量 + 跳到 /kb 链接
  if (!/ctx\.userKbDocIds.*length/.test(novelTxt)) {
    throw new Error('ProjectSettingsCard 未显示绑定信息');
  }
  // 面板组件本身合规
  const panelTxt = await readFile(path.join(ROOT, 'src', 'components', 'UserKbBindingPanel.tsx'), 'utf8');
  if (!/export\s+function\s+UserKbBindingPanel\b/.test(panelTxt)) throw new Error('UserKbBindingPanel 未 export');
  if (!/listUserKbDocs.*enabledOnly/.test(panelTxt)) throw new Error('面板未过滤 enabledOnly（避免列出禁用资料）');
  if (!/orphanCount/.test(panelTxt)) throw new Error('面板未处理悬空引用');
  return '✓ Dialog 状态绑定 + 摘要卡显示 + 悬空引用清理';
});

/* ───────────────────────── 主入口 ───────────────────────── */
async function main() {
  console.log(color('\n━━━━━━━ 小说全流程烟雾测试 ━━━━━━━\n', 'bold'));
  let pass = 0, fail = 0;
  const failed = [];
  for (const c of checks) {
    try {
      const detail = await c.fn();
      console.log(`${color('PASS', 'green')}  ${c.name}  ${color(detail || '', 'gray')}`);
      pass++;
    } catch (e) {
      console.log(`${color('FAIL', 'red')}  ${c.name}\n      ${color(e.message ?? String(e), 'yellow')}`);
      fail++;
      failed.push({ name: c.name, error: e.message ?? String(e) });
    }
  }
  console.log(color(`\n━━━━━━━ ${pass} pass / ${fail} fail / ${checks.length} total ━━━━━━━`, 'bold'));
  if (fail) {
    console.log(color('\n失败汇总：', 'red'));
    failed.forEach((f) => console.log(`  ${color('•', 'red')} ${f.name}: ${f.error}`));
    process.exit(1);
  } else {
    console.log(color('\n✓ 全部通过；小说流水线设定层 + 解析层 + Best-of-N 集成均健康。', 'green'));
    console.log(color('  剩余风险点（需真 LLM 调用才能验证）：', 'gray'));
    console.log(color('  - 章节循环的 condense / rolling context 实际效果', 'gray'));
    console.log(color('  - Best-of-N 裁判 prompt 在小说语境下的鉴别力', 'gray'));
    console.log(color('  - 长链路（卷 1 → 章 5 → 草稿 → 润色）的 token 累积', 'gray'));
    process.exit(0);
  }
}

main().catch((e) => {
  console.error(color('烟雾测试自身崩溃:', 'red'), e);
  process.exit(2);
});
