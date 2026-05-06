// Asset ↔ storyboard consistency checker.
//
// Pure static (no LLM): parses assets.{1..4} JSON outputs to build entity
// indexes for characters / scenes / props, then scans storyboard.2 text
// per UNIT for mention patterns and reports:
//
//   • unknownNames     — appears in storyboard but missing from assets
//   • unmentionedAssets — defined in assets but never used in storyboard (info)
//   • caseDrift         — appears with mismatched form (typo / alias)
//
// Designed to be fast & robust to messy LLM output (uses parseLooseJson).

import type { ArtifactMap, NodeArtifact } from './types';
import { parseLooseJson } from './jsonLoose';
import type { ParsedPlan } from './storyboardPlan';

export type EntityKind = 'character' | 'scene' | 'prop';

export interface AssetEntity {
  kind: EntityKind;
  name: string;             // 标准名（assets 中登记的）
  aliases?: string[];       // 别名 / 称谓 / 旧名
  source: string;           // 来源 nodeId（assets.2 / assets.3 / ...）
}

export interface ConsistencyIssue {
  severity: 'critical' | 'major' | 'minor' | 'info';
  kind: 'unknownName' | 'unmentionedAsset' | 'caseDrift' | 'sceneMismatch';
  entityKind: EntityKind;
  name: string;
  /** 额外描述：定位单元 / 出现次数 / 建议 */
  unitIndex?: number;
  count?: number;
  suggestion?: string;
  detail: string;
}

export interface ConsistencyReport {
  ts: number;
  /** 输入快照 */
  assetCount: { character: number; scene: number; prop: number };
  storyboardUnits: number;
  /** 已发现实体（按 kind 分组的标准名集合） */
  knownNames: { character: string[]; scene: string[]; prop: string[] };
  /** 命中清单：每个 unit 中识别到的提及（用于 UI 高亮） */
  mentions: Array<{ unitIndex: number; characters: string[]; scenes: string[]; props: string[] }>;
  /** 未通过校验的项 */
  issues: ConsistencyIssue[];
  /** 三档总结 */
  verdict: 'pass' | 'warn' | 'fail';
  summary: string;
}

/* ── 资产 → entity 索引 ──────────────────────────────────────── */

/** 在嵌套 JSON 中按 keys 收集 string value，去重 */
function collectStrings(node: any, keys: string[], out: Set<string>): void {
  if (node == null) return;
  if (Array.isArray(node)) {
    for (const item of node) collectStrings(item, keys, out);
    return;
  }
  if (typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) {
      if (keys.includes(k) && typeof v === 'string' && v.trim()) {
        out.add(v.trim());
      } else if (keys.includes(k) && Array.isArray(v)) {
        for (const x of v) if (typeof x === 'string' && x.trim()) out.add(x.trim());
      } else {
        collectStrings(v, keys, out);
      }
    }
  }
}

/** 通用 name keys，覆盖中英、role/character/scene/prop */
const NAME_KEYS = ['name', '姓名', '名称', '角色名', '场景名', '道具名', 'title'];
const ALIAS_KEYS = ['aliases', 'alias', '别名', '别称', '化名', '旧名'];

interface KindHints {
  /** 在 JSON 中匹配「这个对象是哪种 entity」的 key 路径子串（用于推断 kind） */
  characterHints: string[];
  sceneHints: string[];
  propHints: string[];
}

const HINTS: KindHints = {
  characterHints: ['character', '角色', 'cast', 'persona', 'protagonist', 'antagonist', 'role'],
  sceneHints:     ['scene', '场景', '场次', 'location', 'setting'],
  propHints:      ['prop', '道具', 'item', 'object'],
};

/** 推断当前节点属于哪种 kind（按祖先 key 判断） */
function inferKind(parentKey: string): EntityKind | null {
  const k = parentKey.toLowerCase();
  if (HINTS.characterHints.some((h) => k.includes(h.toLowerCase()))) return 'character';
  if (HINTS.sceneHints.some((h) => k.includes(h.toLowerCase()))) return 'scene';
  if (HINTS.propHints.some((h) => k.includes(h.toLowerCase()))) return 'prop';
  return null;
}

/** 递归 walk JSON：根据父 key 提示给每个 entry 打 kind 标签 */
function walkAssets(
  node: any,
  parentKey: string,
  source: string,
  out: AssetEntity[],
): void {
  if (node == null) return;
  const inferred = inferKind(parentKey);

  if (Array.isArray(node)) {
    for (const item of node) walkAssets(item, parentKey, source, out);
    return;
  }
  if (typeof node === 'object') {
    // 当前对象本身是一个 entity？
    if (inferred && (node.name || node['姓名'] || node['名称'] || node.title)) {
      const name = String(node.name ?? node['姓名'] ?? node['名称'] ?? node.title).trim();
      if (name) {
        const aliases: string[] = [];
        for (const ak of ALIAS_KEYS) {
          const v = node[ak];
          if (typeof v === 'string' && v.trim()) aliases.push(v.trim());
          else if (Array.isArray(v)) {
            for (const x of v) if (typeof x === 'string' && x.trim()) aliases.push(x.trim());
          }
        }
        out.push({ kind: inferred, name, aliases: aliases.length ? aliases : undefined, source });
      }
    }
    // 继续递归
    for (const [k, v] of Object.entries(node)) {
      walkAssets(v, k, source, out);
    }
  }
}

export function buildAssetIndex(artifacts: ArtifactMap): AssetEntity[] {
  const out: AssetEntity[] = [];
  for (const id of ['assets.1', 'assets.2', 'assets.3', 'assets.4']) {
    const a = artifacts[id];
    if (!a) continue;
    let parsed: any;
    try { parsed = parseLooseJson(a.content); } catch { continue; }
    walkAssets(parsed, '', id, out);
  }
  // 去重（同 kind+name 合并 aliases）
  const dedup = new Map<string, AssetEntity>();
  for (const e of out) {
    const key = e.kind + '|' + e.name;
    const prev = dedup.get(key);
    if (prev) {
      const merged = new Set<string>([...(prev.aliases ?? []), ...(e.aliases ?? [])]);
      prev.aliases = merged.size ? [...merged] : undefined;
    } else {
      dedup.set(key, { ...e });
    }
  }
  return [...dedup.values()];
}

/* ── 分镜文本 → 提及抽取 ────────────────────────────────────── */

/** 切分 storyboard.2 内容为 UNIT 文本块 */
function splitUnits(content: string): Array<{ unitIndex: number; text: string }> {
  const out: Array<{ unitIndex: number; text: string }> = [];
  // 形如  ## UNIT 5  或  ## UNIT 5 · scene=2
  const re = /^##\s*UNIT\s+(\d+)/gmi;
  const matches: Array<{ idx: number; pos: number }> = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) != null) {
    matches.push({ idx: parseInt(m[1], 10), pos: m.index });
  }
  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].pos;
    const end = i + 1 < matches.length ? matches[i + 1].pos : content.length;
    out.push({ unitIndex: matches[i].idx, text: content.slice(start, end) });
  }
  return out;
}

/** 剥掉 Seedance prompt 字段区 / fenced code / 11 字段块，只保留散文式文字分镜。
 *  这样 `主体：xxx` `动作：xxx` `相机：xxx` 等字段就不会被当作"X：" 对白启发式命中。 */
function stripPromptArea(unitText: string): string {
  let t = unitText;
  // 1. 剥掉 ``` ``` 围栏块（Seedance prompt 经常被包在 ```prompt / ```seedance / ```json）
  t = t.replace(/```[\s\S]*?```/g, '');
  // 2. 剥掉 "Seedance prompt 区" / "提示词区" / "## Seedance" 之后到下一个 `## ` 之前的内容
  t = t.replace(
    /(^|\n)(?:#{2,4}\s*|【)\s*(?:Seedance[^\n]*|提示词区|prompt\s*\u533a|视觉提示[^\n]*)[\s\S]*?(?=\n#{2,4}\s|\n---|\n##\s|$)/gi,
    '$1',
  );
  // 3. 剥掉 11 字段标签行（即便没在 prompt 区，凡是 `主体：…`/`动作：…` 这种字段也整行删除）
  const FIELD_LABELS = [
    '主体', '动作', '外观', '服装', '场景', '光影', '相机', '构图', '时序',
    '台词', '音效', 'Must-Show', 'Must-not', '运镜', '景别', '机位', '镜头',
    '风格', '环境', '情绪', '氛围', '节奏', '色调', '焦距',
  ];
  const fieldRe = new RegExp(
    `^[ \\t>*-]*\\*{0,2}(?:${FIELD_LABELS.join('|')})\\*{0,2}\\s*[:：][^\\n]*$`,
    'gmi',
  );
  t = t.replace(fieldRe, '');
  return t;
}

/** 真台词提示：冒号后紧跟引号 / 破折号 / 「『 等，才认为是说话标记。 */
const DIALOGUE_OPENER = /["'\u201c\u201d\u2018\u2019\u300c\u300d\u300e\u300f\u300a\u300b\u2014\u2014\u2026]/;

/** 从一段文本中抽取「可能是人名」的 token；策略：
 *  1. 字典优先：扫描 vocab 中每个名字出现 → 命中
 *  2. 启发式补充：散文区扫"X 说/X 道/X 喝道"和真对白行"X：「…」"
 */
function extractCharacterMentions(text: string, vocab: Set<string>): {
  hits: Map<string, number>;
  candidates: Map<string, number>;
} {
  const hits = new Map<string, number>();
  const candidates = new Map<string, number>();

  // 1. 字典命中（按长度降序，避免短名吃掉长名）
  const sortedVocab = [...vocab].sort((a, b) => b.length - a.length);
  let scratch = text;
  for (const name of sortedVocab) {
    if (!name) continue;
    const safe = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(safe, 'g');
    const found = scratch.match(re);
    if (found && found.length) {
      hits.set(name, (hits.get(name) ?? 0) + found.length);
      // 替换为占位避免重复匹配
      scratch = scratch.replace(re, '◇'.repeat(name.length));
    }
  }

  // 2. 启发式只在散文区跑（剥掉 Seedance prompt 字段区和代码围栏）
  const prose = stripPromptArea(scratch);

  // 2a. 动词后置: 必须 (句首 OR 标点) + (姓氏 + 1-2 字名) + (说/道/...)
  // 边界锚点防止 "他低声说 → 他低" / "我微笑道 → 我微" 这类把副词当人名的误识.
  // 候选首字必须是常见姓氏, 进一步过滤随机 2-3 字组合.
  const heuristic = /(?:^|[\s，。！？；,;:!?\u3002\uff0c\uff01\uff1f\uff1b])([\u4e00-\u9fa5]{2,3})(?=(?:说|道|喝道|低语|冷笑|怒喝|喃喃|颤声|笑道|淡淡道|沉声|高声))/g;
  let mm: RegExpExecArray | null;
  while ((mm = heuristic.exec(prose)) != null) {
    const cand = mm[1];
    if (!cand) continue;
    if (!isPlausibleChineseName(cand)) continue;
    candidates.set(cand, (candidates.get(cand) ?? 0) + 1);
  }

  // 2b. 真对白：行首 X：必须紧跟引号 / 破折号, 例如 `张三：「我...」`
  for (const rawLine of prose.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    // 跳过 markdown 装饰行 (标题/列表/引用/分隔/表格/数字列表)
    if (/^[#>|*\-+_=]+/.test(line)) continue;
    if (/^\d+[.)、]/.test(line)) continue;
    const m = /^([\u4e00-\u9fa5]{2,3})\s*[:：]\s*(.{1,3})/.exec(line);
    if (!m) continue;
    const cand = m[1];
    const after = m[2] ?? '';
    // 冒号后必须紧跟真台词标记
    if (!DIALOGUE_OPENER.test(after)) continue;
    if (!isPlausibleChineseName(cand)) continue;
    candidates.set(cand, (candidates.get(cand) ?? 0) + 1);
  }

  return { hits, candidates };
}

/** 常见汉族姓氏 + 主流复姓, 覆盖率 95%+. 用于过滤启发式候选名. */
const COMMON_SURNAMES = new Set<string>([
  // 单姓 · 高频
  '王', '李', '张', '刘', '陈', '杨', '黄', '赵', '周', '吴',
  '徐', '孙', '朱', '马', '胡', '郭', '林', '何', '高', '梁',
  '郑', '罗', '宋', '谢', '唐', '韩', '曹', '许', '邓', '萧',
  '冯', '曾', '程', '蔡', '彭', '潘', '袁', '于', '董', '余',
  '苏', '叶', '吕', '魏', '蒋', '田', '杜', '丁', '沈', '姜',
  '范', '江', '傅', '钟', '卢', '汪', '戴', '崔', '任', '陆',
  '廖', '姚', '方', '金', '邱', '夏', '谭', '韦', '贾', '邹',
  '石', '熊', '孟', '秦', '阎', '薛', '侯', '雷', '白', '龙',
  '段', '郝', '孔', '邵', '史', '毛', '常', '万', '顾', '赖',
  '武', '康', '贺', '严', '尹', '钱', '施', '牛', '洪', '龚',
  // 单姓 · 中频 / 武侠玄幻常见
  '关', '卜', '陶', '鲁', '韦', '钟', '汤', '滕', '殷', '罗',
  '毕', '郁', '单', '包', '左', '岳', '沙', '聂', '庄', '柏',
  '凌', '霍', '虞', '万', '支', '柯', '昝', '管', '柳', '黎',
  '舒', '臧', '苗', '盛', '蒲', '丰', '巫', '明', '臧', '宫',
  '甘', '景', '储', '欧', '莫', '齐', '康', '伍', '余', '元',
  '卓', '蔺', '屠', '蒙', '池', '乔', '阴', '郁', '胥', '能',
  '苍', '双', '闻', '莘', '党', '翟', '谭', '贡', '劳', '逄',
  '姬', '申', '扶', '堵', '冉', '宰', '郦', '雍', '璩', '桑',
  '寿', '通', '边', '扈', '燕', '冀', '郏', '浦', '尚', '农',
  '苟', '终', '阙', '东', '欧', '殳', '沃', '利', '蔚', '越',
  '夔', '隆', '师', '巩', '厍', '聂', '晁', '勾', '敖', '融',
  '冷', '訾', '辛', '阚', '那', '简', '饶', '空', '曾', '毋',
  // 仙侠/玄幻偏好的少见单姓
  '叶', '宁', '叶', '楚', '云', '凤', '苍', '萧', '玄', '夜',
  '幽', '寒', '墨', '风', '雪', '月', '星', '辰', '霜', '雷',
  '焚', '焰', '炎', '雾', '冷', '幻', '魔', '灵',
  // 复姓首字 (复姓本身另一处校验, 这里只看首字)
  '欧', '司', '上', '诸', '东', '令', '宇', '皇', '澹', '钟',
  '夏', '南', '北', '西', '左', '右', '太', '万',
  // 兼容外文译名常见首字
  '安', '艾', '奥', '伊', '杰', '凯', '马', '杰', '柯',
]);

/** 复姓清单 (双字), 启发式候选首两字命中复姓也直接放行 */
const COMPOUND_SURNAMES = new Set<string>([
  '欧阳', '上官', '司马', '诸葛', '东方', '夏侯', '尉迟', '皇甫',
  '令狐', '宇文', '慕容', '澹台', '公孙', '万俟', '钟离', '长孙',
  '南宫', '北堂', '西门', '东门', '独孤', '轩辕', '南门', '梁丘',
  '左丘', '段干', '百里', '叱干', '叱利', '太史', '公冶', '鲜于',
  '闾丘', '司徒', '司空', '亓官', '司寇', '仉督', '子车', '颛孙',
  '端木', '巫马', '公西', '漆雕', '乐正', '壤驷', '公良',
]);

/** 一个候选 token 是否长得像中文人名: 首字符为已知姓氏 OR 首两字为复姓. */
function isPlausibleChineseName(cand: string): boolean {
  if (!cand || cand.length < 2 || cand.length > 3) return false;
  if (COMPOUND_SURNAMES.has(cand.slice(0, 2))) return true;
  if (COMMON_SURNAMES.has(cand[0])) return true;
  return false;
}

function extractEntityMentions(text: string, vocab: Set<string>): Map<string, number> {
  const hits = new Map<string, number>();
  const sortedVocab = [...vocab].sort((a, b) => b.length - a.length);
  for (const name of sortedVocab) {
    if (!name) continue;
    const safe = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(safe, 'g');
    const m = text.match(re);
    if (m && m.length) hits.set(name, (hits.get(name) ?? 0) + m.length);
  }
  return hits;
}

/* ── 主入口 ───────────────────────────────────────────────────── */

export function buildConsistencyReport(opts: {
  artifacts: ArtifactMap;
  /** 可选：允许调用方提供已解析的 plan（来自 sb1） */
  plan?: ParsedPlan;
}): ConsistencyReport {
  const { artifacts } = opts;
  const sb2: NodeArtifact | undefined = artifacts['storyboard.2'];

  const entities = buildAssetIndex(artifacts);
  const charNames = new Set<string>();
  const sceneNames = new Set<string>();
  const propNames = new Set<string>();
  // alias → canonical 反向索引（命中 alias 时计入 canonical）
  const aliasToCanonical = new Map<string, string>();

  for (const e of entities) {
    if (e.kind === 'character') charNames.add(e.name);
    if (e.kind === 'scene') sceneNames.add(e.name);
    if (e.kind === 'prop') propNames.add(e.name);
    for (const al of e.aliases ?? []) {
      aliasToCanonical.set(al, e.name);
      if (e.kind === 'character') charNames.add(al);
      if (e.kind === 'scene') sceneNames.add(al);
      if (e.kind === 'prop') propNames.add(al);
    }
  }

  const issues: ConsistencyIssue[] = [];
  const mentions: ConsistencyReport['mentions'] = [];

  if (!sb2) {
    return {
      ts: Date.now(),
      assetCount: { character: charNames.size, scene: sceneNames.size, prop: propNames.size },
      storyboardUnits: 0,
      knownNames: {
        character: [...charNames].sort(),
        scene: [...sceneNames].sort(),
        prop: [...propNames].sort(),
      },
      mentions: [],
      issues: [{
        severity: 'info',
        kind: 'unknownName',
        entityKind: 'character',
        name: '',
        detail: 'storyboard.2 尚未生成，无法做一致性检查',
      }],
      verdict: 'pass',
      summary: 'storyboard.2 未生成，跳过一致性检查',
    };
  }

  const units = splitUnits(sb2.content);
  // 累计提及，用于 unmentionedAssets 计算
  const cumChar = new Set<string>();
  const cumScene = new Set<string>();
  const cumProp = new Set<string>();
  // 累计 unknown 候选 → unitIndices
  const unknownCandidates = new Map<string, Set<number>>();

  for (const u of units) {
    const charRes = extractCharacterMentions(u.text, charNames);
    const sceneHits = extractEntityMentions(u.text, sceneNames);
    const propHits = extractEntityMentions(u.text, propNames);

    // 启发式 candidates 中过滤掉已知名 / alias
    const filtered = new Map<string, number>();
    for (const [name, count] of charRes.candidates) {
      if (charNames.has(name)) continue;
      // 排除一些常见非名字 token
      if (NON_NAME_TOKENS.has(name)) continue;
      filtered.set(name, count);
      const set = unknownCandidates.get(name) ?? new Set();
      set.add(u.unitIndex);
      unknownCandidates.set(name, set);
    }

    const charMentioned = new Set<string>();
    for (const [name] of charRes.hits) {
      charMentioned.add(aliasToCanonical.get(name) ?? name);
      cumChar.add(aliasToCanonical.get(name) ?? name);
    }
    const sceneMentioned = new Set<string>();
    for (const [name] of sceneHits) {
      sceneMentioned.add(aliasToCanonical.get(name) ?? name);
      cumScene.add(aliasToCanonical.get(name) ?? name);
    }
    const propMentioned = new Set<string>();
    for (const [name] of propHits) {
      propMentioned.add(aliasToCanonical.get(name) ?? name);
      cumProp.add(aliasToCanonical.get(name) ?? name);
    }

    mentions.push({
      unitIndex: u.unitIndex,
      characters: [...charMentioned].sort(),
      scenes: [...sceneMentioned].sort(),
      props: [...propMentioned].sort(),
    });
  }

  // 1. unknown character candidates
  for (const [cand, unitSet] of unknownCandidates) {
    // 至少在 ≥2 个 unit 出现才报告，过滤偶发误判（动词启发式 / 普通中文词）
    if (unitSet.size < 2) continue;
    // 候选名长度过短（2 字）且只在 2 个 unit 出现的，再额外要求出现频次 ≥3
    if (cand.length === 2 && unitSet.size < 3) continue;
    issues.push({
      severity: unitSet.size >= 3 ? 'major' : 'minor',
      kind: 'unknownName',
      entityKind: 'character',
      name: cand,
      unitIndex: [...unitSet][0],
      count: unitSet.size,
      suggestion:
        charNames.size === 0
          ? '尚未生成 assets.2 角色卡。请先跑 assets 阶段, 或检查角色卡输出格式'
          : `请检查是否漏登记 / 别名未录入。已知角色: ${[...charNames].slice(0, 5).join(', ')}${charNames.size > 5 ? '…' : ''}`,
      detail: `分镜中疑似角色名「${cand}」未在资产清单中登记，出现在 ${unitSet.size} 个单元`,
    });
  }

  // 2. unmentioned assets (info)
  for (const name of charNames) {
    if (aliasToCanonical.has(name)) continue; // skip aliases
    if (!cumChar.has(name)) {
      issues.push({
        severity: 'info',
        kind: 'unmentionedAsset',
        entityKind: 'character',
        name,
        detail: `角色「${name}」已登记但未在分镜中出现`,
        suggestion: '可能是工具人 / 分镜阶段被合并; 若是主线角色请检查 storyboard.1 单元规划',
      });
    }
  }
  for (const name of sceneNames) {
    if (aliasToCanonical.has(name)) continue;
    if (!cumScene.has(name)) {
      issues.push({
        severity: 'info',
        kind: 'unmentionedAsset',
        entityKind: 'scene',
        name,
        detail: `场景「${name}」已登记但未在分镜中出现`,
      });
    }
  }
  // props 未提及不报告 — 道具频繁被 storyboard 化为视觉细节, 误报多

  // 3. verdict
  const major = issues.filter((i) => i.severity === 'major').length;
  const minor = issues.filter((i) => i.severity === 'minor').length;
  const verdict: ConsistencyReport['verdict'] =
    major >= 3 ? 'fail'
    : (major >= 1 || minor >= 3) ? 'warn'
    : 'pass';

  const summary = [
    `资产 ${charNames.size}角色 / ${sceneNames.size}场景 / ${propNames.size}道具`,
    `· 分镜 ${units.length} unit`,
    `· ${issues.filter((i) => i.severity !== 'info').length} 项问题 + ${issues.filter((i) => i.severity === 'info').length} 项提示`,
  ].join(' ');

  return {
    ts: Date.now(),
    assetCount: { character: charNames.size, scene: sceneNames.size, prop: propNames.size },
    storyboardUnits: units.length,
    knownNames: {
      character: [...charNames].sort(),
      scene: [...sceneNames].sort(),
      prop: [...propNames].sort(),
    },
    mentions,
    issues,
    verdict,
    summary,
  };
}

/** 启发式黑名单：扫到也不算角色名（避免大量误报） */
const NON_NAME_TOKENS = new Set([
  // 集合代称
  '众人', '所有人', '众弟子', '弟子', '观众', '路人', '众僧', '群众',
  '自己', '对方', '那人', '此人', '某人', '何人', '彼此',
  '我们', '你们', '他们', '她们', '咱们',
  '一人', '两人', '三人', '四人', '五人', '众多',
  // 叙事副词 / 时间副词
  '画外', '镜头', '远处', '近处', '此时', '此刻', '随后', '紧接', '忽然',
  '突然', '只见', '继而', '俄而', '少顷', '片刻', '霎时', '瞬间', '同时',
  '接着', '然后', '于是', '最终', '最后', '终于', '渐渐',
  // 11 字段 prompt 标签
  '主体', '动作', '外观', '服装', '场景', '光影', '相机', '构图',
  '时序', '台词', '音效', '运镜', '景别', '机位', '镜头',
  // 相机/光影/构图 常见词
  '推镜', '拉镜', '摇镜', '移镜', '跟镜', '升镜', '降镜', '环绕',
  '手持', '航拍', '俯拍', '仰拍', '平拍', '特写', '近景', '中景',
  '全景', '远景', '大全', '过肩', '正面', '侧面', '背面',
  '逆光', '顺光', '侧光', '柔光', '硬光', '冷光', '暖光', '高光',
  '阴影', '剪影', '轮廓', '焦点', '虚焦', '失焦',
  // 场景/道具常见环境词
  '镜面', '玻璃', '门口', '窗外', '屋内', '室内', '室外', '地面',
  '空中', '水面', '墙角', '角落', '中央', '中心',
  // 常见状态/情绪词被误判
  'Must', 'must', 'show', 'Show', 'not', 'Not',
]);
