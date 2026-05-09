/**
 * v8 epic · MM5 multimodal continuity layer · 类型定义
 *
 * 4 张 add-only dexie 表的 row schema · CK I-2（add-only · 永不删表 / 永不删字段）。
 *
 * 设计原则：
 *   - 字段命名 / 枚举值全部 fili-web 自写（IP tier 2 重命名要求）
 *   - 索引字段为顶层标量 · 嵌套数据用 `?:` JSON 可选字段（CK I-2 模式）
 *   - 时间戳统一 `createdAt` / `updatedAt` 毫秒 epoch · 排序用
 *   - `chapter` 全部 1-based · 与项目内 `chapterIndex` 对齐（CK · 跨表一致）
 */

// ─── ForeshadowRow（伏笔追踪表） ─────────────────────────────────────

/**
 * 伏笔生命周期状态 · 4 态枚举（自写 · 不用 'active/closed' 两态）。
 *
 * - `planted`：已埋下 · 未回收（默认）
 * - `partial`：部分回收 · 还有遗留
 * - `resolved`：完全回收 · 闭环
 * - `broken`：埋了但忘了回收 · 危险信号（用于检测断头线）
 */
export type ForeshadowStatus = 'planted' | 'partial' | 'resolved' | 'broken';

/** 伏笔重要性 · 决定 SelfCheckPanel 的告警优先级。 */
export type ForeshadowWeight = 'minor' | 'major' | 'critical';

/**
 * 伏笔追踪表 · 一行一条伏笔记录。
 *
 * 索引设计（db.ts v8）：
 *   `++id, projectId, status, setupChapter, payoffChapter,`
 *   `[projectId+status], [projectId+setupChapter]`
 */
export interface ForeshadowRow {
  id?: number;
  projectId: number;
  /** 简短标识 · 5-30 字 · 用于 UI 列表展示。 */
  title: string;
  /** 完整描述 · 伏笔的具体内容（埋下了什么）。 */
  content: string;
  /** 状态机当前态。 */
  status: ForeshadowStatus;
  /** 重要性 · 影响告警优先级。 */
  weight: ForeshadowWeight;
  /** 埋下伏笔的章节（1-based · 必填）。 */
  setupChapter: number;
  /** 回收章节（1-based · status='resolved' 时填）。 */
  payoffChapter?: number;
  /** 回收方式说明（resolved/partial 时填）。 */
  payoffNote?: string;
  /** 自由备注 · 用户审阅时记录。 */
  notes?: string;
  createdAt: number;
  updatedAt: number;
}

// ─── CharacterArcRow（角色弧光表） ───────────────────────────────────

/**
 * 角色弧光表 · 一行一个 (characterName, epoch) 状态点。
 *
 * 设计：以 `epoch` 字符串组织角色多阶段轨迹（如 `opening` / `midpoint` / `climax` /
 * `denouement` · 由项目方法论决定 · 不硬编码枚举 · 用户可自由命名）。
 *
 * 索引设计（db.ts v8）：
 *   `++id, projectId, characterName, epoch, chapter,`
 *   `[projectId+characterName], [projectId+characterName+epoch]`
 */
export interface CharacterArcRow {
  id?: number;
  projectId: number;
  /** 角色名 · 与 characterStates / characterBible 跨表对齐（CK · 一致命名）。 */
  characterName: string;
  /** 弧光阶段标识 · 用户自定义字符串（如 'opening' / 'midpoint' / 'climax'）。 */
  epoch: string;
  /** 该 epoch 对应的章节（1-based）。 */
  chapter: number;
  /** 此阶段角色状态简述（30-200 字）。 */
  state: string;
  /** 引发本次状态变化的驱动事件（10-100 字 · 可空 · opening epoch 通常无驱动）。 */
  driver?: string;
  /** 剧本中支持本状态的引用片段（可空）。 */
  evidence?: string;
  createdAt: number;
  updatedAt: number;
}

// ─── WorldRuleRow（世界观规则表） ────────────────────────────────────

/**
 * 世界观规则严重性 · 决定违规检测策略。
 *
 * - `soft`：可破例 · 仅记录违规但不告警
 * - `hard`：硬规则 · 违规必告警（用于 MM4 分镜忠实度自检）
 */
export type WorldRuleSeverity = 'soft' | 'hard';

/**
 * 世界观规则表 · 一行一条规则 + 违规清单。
 *
 * 设计：`domain` 用户自定义字符串（如 'magic-system' / 'tech-level' / 'currency'
 * / 'social-class' / 'language' / ...）· 一个项目可有任意多 domain · 一个 domain
 * 可有任意多 rule。
 *
 * 索引设计（db.ts v8）：
 *   `++id, projectId, domain, chapter, [projectId+domain]`
 */
export interface WorldRuleRow {
  id?: number;
  projectId: number;
  /** 规则所属领域 · 用户自定义字符串。 */
  domain: string;
  /** 规则陈述（一句话 · 30-200 字）。 */
  rule: string;
  /** 严重性。 */
  severity: WorldRuleSeverity;
  /** 首次定义此规则的章节（1-based · 通常是世界观铺设章）。 */
  chapter: number;
  /** 后续章节中检测到的违规记录（自由字符串数组）· 不进索引（CK I-2 嵌套约定）。 */
  violations?: string[];
  /** 自由备注 · 用户审阅时记录。 */
  notes?: string;
  createdAt: number;
  updatedAt: number;
}

// ─── RhythmDiagnosticRow（节奏诊断表） ───────────────────────────────

/**
 * 节奏诊断表 · 一行一个 (chapter, sceneIdx) 场景节奏快照。
 *
 * 设计：MM2 epic 的 5 维自检会消费此表做"情节张力 + 情感起伏"双维曲线扫描 ·
 * MM4 epic phase-C 情绪扫描会消费此表做镜头节奏适配。本 PR-1 仅落表 · 后续 PR
 * 接入 SelfCheckPanel / 分镜板。
 *
 * 索引设计（db.ts v8）：
 *   `++id, projectId, chapter, sceneIdx,`
 *   `[projectId+chapter], [projectId+chapter+sceneIdx]`
 */
export interface RhythmDiagnosticRow {
  id?: number;
  projectId: number;
  /** 章节（1-based）。 */
  chapter: number;
  /** 章节内场景序号（0-based）。 */
  sceneIdx: number;
  /** 情节张力 · 0-10 整数 · 0=完全静态 / 10=极度紧张。 */
  tension: number;
  /** 情感色调 · -5..+5 整数 · 负值悲伤/低落 · 正值喜悦/高扬。 */
  emotion: number;
  /** 诊断警报（自由字符串数组）· 不进索引（CK I-2 嵌套约定）。 */
  warnings?: string[];
  /** 场景标题 / 简述 · 列表展示用（可空）。 */
  sceneLabel?: string;
  createdAt: number;
  updatedAt: number;
}
