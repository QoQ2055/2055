// Pipeline manifest & runtime types.

import type { ChatMessage } from '../llm/deepseek';

export type StageId = 'screenplay' | 'adapt' | 'assets' | 'storyboard' | 'novel';
export type StageMode = 'serial' | 'gate-then-parallel' | 'plan-then-loop';
export type OutFormat = 'markdown' | 'json' | 'text';

export interface ManifestStep {
  id: string;            // e.g. "screenplay.1"
  index: number;         // 1..N
  title: string;
  prompt: string;        // relative path under public/
  outFormat: OutFormat;
  sysLen: number;
  usrLen: number;
  /**
   * DeepSeek V4 Thinking Mode strategy for this step (optional).
   * - 'enabled'  : force `extra_body.thinking = enabled`. Sampling params (temperature)
   *                become ineffective server-side (auto-stripped by deepseek.ts).
   *                Recommended for structural / JSON / planning nodes.
   * - 'disabled' : explicitly disable thinking (sends `extra_body.thinking = disabled`).
   *                Recommended for creative-writing nodes (community evidence: V4
   *                under reasoning_effort=high writes "dry").
   * - 'auto' / undefined : do NOT send `extra_body` at all (server uses its own
   *                default). Backwards-compatible default for existing manifests.
   * - effort: only applied when strategy === 'enabled'. Defaults to 'high' on the API side.
   * Reference: docs/internal-notes/deepseek-v4-tuning-guide.md §1.2 / §2.
   */
  thinkingStrategy?: 'enabled' | 'disabled' | 'auto';
  thinkingEffort?: 'high' | 'max';
  /**
   * Force JSON output via OpenAI `response_format`. When `outFormat === 'json'`
   * is true and this is unset, runner.ts will default to 'json_object' for
   * stricter LLM compliance. Set 'text' to opt out explicitly.
   */
  responseFormat?: 'text' | 'json_object';
}

export interface ManifestStage {
  id: StageId;
  nameZh: string;
  mode: StageMode;
  steps: ManifestStep[];
}

export interface Manifest {
  version: string;
  sourceDir: string;
  generated: string;
  stages: ManifestStage[];
}

// The raw payload as imported from the original .txt (deepseek chat/completions body).
export interface RawPromptPayload {
  model?: string;
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
}

// User-controlled project context, passed to every step.
//
// Project modes (first-class concept since the workflow refactor):
//   • original   — 从 0 原创剧本：题材→ R1→ S1-S8→ 资产→ 分镜
//   • adaptation — 改编：原作摄入→ A1-A6→ 资产→ 分镜
//   • express    — 特殊·快速分镜：跳过剧本，直跑分镜
//   • novel      — 小说创作（占位，待填充）
//
// `CreateMode` is kept as a deprecated alias of the original/adaptation
// subset for back-compat with existing call sites & stored projects.
export type ProjectMode = 'original' | 'adaptation' | 'express' | 'novel';
export type CreateMode = 'original' | 'adaptation';
export type AdaptationType = 'novel' | 'remake';

export interface SourceChunk {
  id: string;             // local nanoid
  title: string;          // "第一章 开竹" / "片段 1"
  raw: string;            // 原文
  summary?: string;       // intake 生成的 JSON 字符串（未生成为 undef）
  ts: number;
}

export interface ProjectContext {
  name: string;
  concept: string;          // 自动派生的展示字符串（注入到 prompt {concept}）
  durationMin: number;
  mode: string;            // 人读标签（向后兼容）
  /**
   * Authoritative mode for new code paths. When absent (legacy projects),
   * derive via `getProjectMode(ctx)` from `createMode` + `projectType`.
   */
  projectMode?: ProjectMode;
  createMode: CreateMode;  // 'original' 原创 | 'adaptation' 改编（向后兼容）
  adaptationType?: AdaptationType;
  // ─────── 结构化分类字段（v2，参与 buildConcept 派生） ───────
  genres?: string[];                                            // 1-3 个原子题材 value
  protagonistGender?: 'male' | 'female' | 'dual' | 'nonhuman';
  platform?: string;                                            // 'douyin' | 'kuaishou' | ...
  coreConflict?: string;                                        // 一句话核心冲突（原创模式）
  /** 改编原作类型（细分自 adaptationType） */
  adaptSourceType?: string;                                     // 'novel_long' | 'remake' | 'manga' | ...
  /** 视觉风格（在分镜双区 prompt 中作风格基调） */
  visualStyle?: string;                                         // 'wuxia_ink' | 'cyberpunk' | ...
  /** 项目类型：normal=完整流水线；express=特殊项目（仅资产+分镜） */
  projectType?: 'normal' | 'express';
  // ─────── 小说创作专用字段（projectMode='novel' 时必填） ───────
  /** 小说平台范式：'qidian' | 'fanqie' | 'jjwxc' | 'zongheng' | 'kindle' | 'web_free' */
  novelPlatform?: string;
  /** 小说体量档：'short' | 'medium' | 'long' | 'mega' | 'epic' */
  novelScale?: string;
  /** POV 视角：'first' | 'third_limited' | 'third_dual' | 'third_multi' | 'omniscient' */
  novelPov?: string;
  /** 读者群：'male' | 'female' | 'general' */
  novelAudience?: string;
  /** 写作调性：'fast_pleasure' | 'literary' | 'hardcore' | 'healing' | 'dark_heavy' | 'humor' */
  novelTone?: string;
  /** 用户指定的总字数（万字）。覆盖 novelScale 默认值 */
  novelTotalWordsK?: number;
  /** 用户指定的总章节数。覆盖根据体量+平台派生的默认值 */
  novelTotalChapters?: number;
  /** 主角金手指 / 关键设定（200 字以内，可选）。注入到世界观/角色 bible prompt */
  novelHook?: string;
  /** 一句话简介 / 卖点（≤ 100 字，可选）。比 coreConflict 更对外、更营销向 */
  novelLogline?: string;
  /**
   * v3 资料库 v2：本项目绑定的用户上传资料 doc id 列表。
   * compose.ts 会按 docType + nodeId 决定注入到哪个 prompt 节点。
   * 与 `Project.userKbDocIds` 双向同步。
   */
  userKbDocIds?: number[];
  /** v3 启用的方法论模块 ID（来自 public/methods/，最多 3 个）。 */
  methodModuleIds?: string[];
  source?: {               // 仅改编模式下使用
    chunks: SourceChunk[];
  };
}

// In-memory artifact for one node, used as upstream input by downstream nodes.
export interface NodeArtifact {
  nodeId: string;          // e.g. "screenplay.1"
  stageId: StageId;
  index: number;
  title: string;
  format: OutFormat;
  content: string;         // raw text output (or JSON string for json format)
  tokens?: number;
  cost?: number;
  durationMs: number;
  ts: number;
  /** 元信息：手动注入 / 镜像来源等，用于 UI 提示与下游决策 */
  meta?: {
    manual?: boolean;        // 用户粘贴的（非流水线产出）
    source?: string;         // 人读来源描述
    mirroredFrom?: string;   // 镜像自哪个 nodeId（如 adapt.6 → screenplay.7）
    [key: string]: unknown;
  };
}

// All artifacts so far in the run, keyed by nodeId.
export type ArtifactMap = Record<string, NodeArtifact>;

// Status reported by the runner for UI consumption.
export type NodeStatus = 'idle' | 'running' | 'done' | 'error' | 'aborted';
