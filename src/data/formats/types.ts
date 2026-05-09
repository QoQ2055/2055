/**
 * v8 epic · MM1 PR-2 · multi-format expansion · UI manifest 类型
 *
 * 职责（CK · 关注点分离）：
 *   - 仅描述 4 种格式的"工作流元数据"（步骤号 / 标题 / 目标 / 要点）
 *   - 不含 LLM prompt payload · 不含运行时 step.id（pipeline manifest 是另一个层）
 *   - 后续 MM1 PR-N 可在此基础上为每步添加 `prompt: 'prompts/feature/1.json'` 字段接入 runner
 *
 * 数据来源：docs/methodology/format-{feature,short,ultrashort,series}.md
 *           （MIT · @山音 · 字符级摘要 · attribution 见各 manifest source 字段）
 */

/** 单步元数据 · 不含 LLM payload。 */
export interface FormatStep {
  /** 1-based 步序。 */
  index: number;
  /** 步骤标题（如 "破题与核心动作"）。 */
  title: string;
  /** 一句话目标（30-60 字）。 */
  goal: string;
  /** 关键要点摘要（每条 10-40 字 · 来自 SKILL 原文 highlights）。 */
  highlights: string[];
  /** 输出格式 · 与 pipeline ManifestStep.outFormat 对齐预留。 */
  outFormat: 'markdown' | 'json';
}

/**
 * 单"路径" · 用于 What-If / How-to-Tell 这种平行二选一场景。
 * feature/short 用单 path · ultrashort 用双 paths。
 */
export interface FormatPath {
  /** 路径标识（如 'whatif' / 'howtotell' / 'main'）。 */
  id: string;
  /** 路径中文名（如 'What-If 高概念路径'）。 */
  label: string;
  /** 路径说明（30-100 字）。 */
  description: string;
  steps: FormatStep[];
}

/**
 * 单"阶段" · 用于剧集这种串行多阶段场景。
 * series 用 phases · 其他格式用 paths。
 */
export interface FormatPhase {
  /** 阶段标识（如 'season-planning' / 'episode-writing'）。 */
  id: string;
  /** 阶段中文名（如 '阶段一 · 季度规划与分集大纲'）。 */
  label: string;
  description: string;
  steps: FormatStep[];
}

/** 一份 format 完整 manifest · 4 种格式各导出一份。 */
export interface FormatManifest {
  /** 格式标识（'feature' / 'short' / 'ultrashort' / 'series'）。 */
  id: 'feature' | 'short' | 'ultrashort' | 'series';
  /** 中文名。 */
  nameZh: string;
  /** 英文名 · 用于路由路径派生。 */
  nameEn: string;
  /** 路由路径（如 '/feature-film'）。 */
  routePath: string;
  /** 时长描述（如 '75-120 分钟'）。 */
  duration: string;
  /** 一段话格式说明（80-200 字）。 */
  description: string;
  /** SKILL 文件相对路径（如 'docs/methodology/format-feature.md'）。 */
  source: string;
  /** 上游 attribution（MIT · @山音）。 */
  upstream: string;
  /**
   * 互斥分组方式 · 一份 manifest 必填二选一：
   * - paths: 单路径或多路径并行（feature/short 单 main · ultrashort 双 whatif/howtotell）
   * - phases: 多阶段串行（series · 季度规划 + 逐集剧本）
   */
  paths?: FormatPath[];
  phases?: FormatPhase[];
}
