// 方法论模块的"可机检规则"注册表（评分系统专用）。
//
// 每条规则是一个轻量正则 + 命中次数阈值。LLM 不参与，运行 < 1ms。
// 维护策略：
//   - 仅给"高用户量 + 规则可量化"的模块写规则；其它模块该维度自动 inactive。
//   - 规则不可能完美覆盖整个方法论的精神，仅作"硬骨架达成度"指标。
//   - 真正的语义评估留给 r1Align / userKbStyle 两个 LLM 维度。
//
// 后续可考虑迁移到 public/methods/manifest.json 的每个 module 字段下，
// 但当前用 TS map 便于快速迭代。

export type ModuleCheckKind = 'min' | 'max' | 'range' | 'present';

export interface ModuleScoreCheck {
  /** 短中文标签（用于扣分提示） */
  label: string;
  /** 正则 source（不含分隔符 / / ） */
  pattern: string;
  /** 正则 flags，默认 'g' */
  flags?: string;
  /** 阈值类型 */
  kind: ModuleCheckKind;
  /** kind=min/range 用 */
  min?: number;
  /** kind=max/range 用 */
  max?: number;
  /** 命中失败的严重程度（决定扣分） */
  severity?: 'major' | 'minor';
  /** 仅在这些 nodeId 应用；不设置则该模块所有 injectsTo 节点都跑 */
  appliesTo?: string[];
}

/**
 * 方法论模块 → 规则数组。key 必须与 public/methods/manifest.json 的 module.id 一致。
 *
 * 当前覆盖（v2 阶段 2.9 首版，8 个高用量模块）：
 *   1. seven-emotion-peaks   — 七情绪峰
 *   2. webfiction-pacing-pack — 网文节奏包
 *   3. three-density-review  — 三密度审查
 *   4. twelve-step-mystery   — 十二步推理
 *   5. save-the-cat-15beats  — Save the Cat 15 节拍
 *   6. heros-journey-12stages — 英雄之旅 12 阶段
 *   7. snowflake-method      — 雪花十步
 *   8. anti-ai-flavor        — 反 AI 味
 */
export const MODULE_SCORE_CHECKS: Record<string, ModuleScoreCheck[]> = {
  // ── 1. 七情绪峰：每章应有 ≥ 5 处情绪转折标志 ──
  'seven-emotion-peaks': [
    {
      label: '情绪峰段落数 ≥ 5',
      pattern: '(突然|猛地|颤抖|心头一紧|呼吸停滞|攥紧|血涌上|失声|愣在原地|呆住)',
      kind: 'min',
      min: 5,
      severity: 'major',
      appliesTo: ['novel.3.1', 'novel.3.2'],
    },
    {
      label: '至少 2 类情绪类型',
      pattern: '(愤怒|绝望|喜悦|恐惧|羞耻|嫉妒|疲惫|温柔|不甘|期待)',
      kind: 'min',
      min: 4,
      severity: 'minor',
      appliesTo: ['novel.3.1', 'novel.3.2'],
    },
  ],

  // ── 2. 网文节奏：钩子 + 钩子密度 ──
  'webfiction-pacing-pack': [
    {
      label: '章末钩子（章末 200 字内含悬念信号）',
      // 简化：检查"？""！""未完""下一刻""然而"等结尾常见信号
      pattern: '(然而|却在此时|可就在|就在|未曾想|却不知|与此同时|下一刻)[^\\n]{0,30}[？?！!\\.\\.\\.…]?\\s*$',
      flags: 'gm',
      kind: 'present',
      severity: 'major',
      appliesTo: ['novel.3.1', 'novel.3.2'],
    },
    {
      label: '钩子转折词密度 ≥ 3',
      pattern: '(然而|可是|却|不料|没想到|没成想|岂料|哪曾想)',
      kind: 'min',
      min: 3,
      severity: 'minor',
      appliesTo: ['novel.3.1', 'novel.3.2'],
    },
  ],

  // ── 3. 三密度审查：动作/对白/心理三密度都要有 ──
  'three-density-review': [
    {
      label: '对白行（"…"或「…」）≥ 8 行',
      pattern: '("[^"\\n]{2,}"|「[^」\\n]{2,}」)',
      kind: 'min',
      min: 8,
      severity: 'minor',
      appliesTo: ['novel.3.1', 'novel.3.2'],
    },
    {
      label: '动作描写关键词 ≥ 6',
      pattern: '(起身|转身|抬手|抓起|推开|跨步|靠近|后退|低头|抬头|皱眉|握紧)',
      kind: 'min',
      min: 6,
      severity: 'minor',
      appliesTo: ['novel.3.1', 'novel.3.2'],
    },
  ],

  // ── 4. 十二步推理：线索铺设 + 反转 ──
  'twelve-step-mystery': [
    {
      label: '反转标志 ≥ 1（揭穿 / 真相 / 其实）',
      pattern: '(其实|真相|揭穿|原来|事实上|没想到|出人意料)',
      kind: 'min',
      min: 1,
      severity: 'major',
      appliesTo: ['novel.3.1', 'novel.3.2'],
    },
  ],

  // ── 5. Save the Cat 15 节拍：分卷规划应包含节拍命名 ──
  'save-the-cat-15beats': [
    {
      label: '节拍关键词出现（开场镜头/主题陈述/铺陈/导火索/争辩/第二幕开始/B 故事/玩转/中点/坏蛋逼近/失去一切/灵魂暗夜/第三幕开始/结局/终场镜头）',
      pattern: '(开场镜头|主题陈述|铺陈|导火索|争辩|第二幕|B 故事|玩转|中点|坏蛋逼近|失去一切|灵魂暗夜|第三幕|终场镜头)',
      kind: 'min',
      min: 5,
      severity: 'major',
      appliesTo: ['novel.2.1', 'novel.2.2'],
    },
  ],

  // ── 6. 英雄之旅 12 阶段：阶段名命中 ──
  'heros-journey-12stages': [
    {
      label: '阶段名命中（启程/拒绝/导师/越界/试炼/盟友与敌人/接近/磨难/奖赏/归途/复活/带回灵药）',
      pattern: '(启程|拒绝|导师|越界|试炼|盟友|敌人|接近|磨难|奖赏|归途|复活|灵药)',
      kind: 'min',
      min: 4,
      severity: 'major',
      appliesTo: ['novel.2.1', 'novel.2.2'],
    },
  ],

  // ── 7. 雪花十步：分卷应包含主旨/单段概要/角色/三段式/扩展... ──
  'snowflake-method': [
    {
      label: '雪花步骤词命中',
      pattern: '(一句话|主旨|段落概要|角色概述|三段式|场景列表|长篇扩展)',
      kind: 'min',
      min: 2,
      severity: 'minor',
      appliesTo: ['novel.2.1', 'novel.2.2'],
    },
  ],

  // ── 8. 反 AI 味：是 KB 红线的强化版（双保险） ──
  'anti-ai-flavor': [
    {
      label: 'AI 套话（不禁/暗自/默默地/与此同时/紧接着等）≤ 3 次',
      pattern: '(不禁|暗自|默默地|与此同时|紧接着|不由得|若有所思|心中一动)',
      kind: 'max',
      max: 3,
      severity: 'major',
      appliesTo: ['novel.3.1', 'novel.3.2'],
    },
  ],
};
