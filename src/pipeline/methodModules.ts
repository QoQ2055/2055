/**
 * 资料库 v2 P2 · 方法论模块加载与注入
 *
 * 与静态 KB（pipeline/kb.ts）和用户 KB（store/userKb.ts）并列的第三种知识层：
 * 「方法论模块」是预置的写作方法论（MBTI 五步法 / Save the Cat / 英雄之旅 等），
 * 由项目通过 `Project.methodModuleIds` 多选启用，按 manifest 里的 injectsTo 字段
 * 决定注入到哪些 prompt 节点。
 *
 * 文件位置：public/methods/manifest.json + public/methods/<id>.md
 */

export interface MethodModuleItem {
  id: string;
  title: string;
  file: string;
  category: string;
  summary: string;
  /** 该模块注入到哪些节点（白名单） */
  injectsTo: string[];
  estimatedTokens: number;
  /** 互斥模块 id（同时启用时只取列表里第一个） */
  conflictsWith: string[];
  /**
   * 题材兼容性矩阵（v2 阶段 2.3）。可选；缺省视为「全题材通用」。
   * - `recommended`：模块在这些题材下表现最佳（仅信息提示，不强制）
   * - `incompatible`：模块与这些题材语义冲突，启用时显示红色警示
   *   （例：超自然包 × 硬科幻；东亚四段 × 工业化爽文）
   * - `warnOnEnable`：模块在这些题材下兼容性较弱（黄色警示，不阻拦）
   *
   * 题材取值参考 src/data/projectTaxonomy.ts 中 GENRES 的 value 字段。
   */
  genreCompat?: {
    recommended?: string[];
    incompatible?: string[];
    warnOnEnable?: string[];
  };
}

export interface MethodModuleManifest {
  version: string;
  source: string;
  modules: MethodModuleItem[];
}

/** 题材兼容性问题：UI 用于在启用列表上显示警示徽章 */
export interface GenreCompatIssue {
  moduleId: string;
  /** 'incompatible' 显示红色警示（仍允许启用，给用户选择权）；'warning' 黄色 */
  level: 'incompatible' | 'warning';
  /** 触发警示的题材 value 列表（与用户选择的 genres 的交集） */
  conflictingGenres: string[];
  /** 一句话说明，用于 tooltip */
  message: string;
}

/**
 * 校验「已启用模块 × 项目题材」的兼容性。
 *
 * 设计原则：
 * - 只检查 manifest 里 genreCompat 显式声明的关系；未声明视为通用
 * - incompatible 优先于 warning（同一模块同时命中两种时，仅返回 incompatible）
 * - 用户题材为空时不警示（项目尚未选题材，警示无意义）
 * - 不阻拦启用 —— 仅作信息提示，最终决策权在用户
 */
export function validateMethodModuleGenres(
  enabledIds: string[],
  userGenres: string[],
  manifest: MethodModuleManifest,
): GenreCompatIssue[] {
  const issues: GenreCompatIssue[] = [];
  if (!userGenres || userGenres.length === 0) return issues;

  for (const id of enabledIds) {
    const mod = manifest.modules.find((m) => m.id === id);
    if (!mod?.genreCompat) continue;

    const incompat = (mod.genreCompat.incompatible ?? []).filter((g) => userGenres.includes(g));
    if (incompat.length > 0) {
      issues.push({
        moduleId: id,
        level: 'incompatible',
        conflictingGenres: incompat,
        message: `${mod.title} 与所选题材语义冲突：[${incompat.join(', ')}]。建议关闭此模块或调整题材。`,
      });
      continue;
    }

    const warn = (mod.genreCompat.warnOnEnable ?? []).filter((g) => userGenres.includes(g));
    if (warn.length > 0) {
      issues.push({
        moduleId: id,
        level: 'warning',
        conflictingGenres: warn,
        message: `${mod.title} 在题材 [${warn.join(', ')}] 下兼容性较弱，可能产出不理想。`,
      });
    }
  }
  return issues;
}

let _manifestCache: MethodModuleManifest | null = null;
const _contentCache = new Map<string, string>();

function resolveAsset(p: string): string {
  return './' + p.replace(/^\.?\/?/, '');
}

export async function loadMethodModuleManifest(): Promise<MethodModuleManifest> {
  if (_manifestCache) return _manifestCache;
  try {
    const res = await fetch(resolveAsset('methods/manifest.json'));
    if (!res.ok) {
      // 静默降级：方法论模块是 nice-to-have，缺失不影响主流程
      _manifestCache = { version: '0', source: 'empty', modules: [] };
      return _manifestCache;
    }
    _manifestCache = (await res.json()) as MethodModuleManifest;
    return _manifestCache;
  } catch {
    _manifestCache = { version: '0', source: 'empty', modules: [] };
    return _manifestCache;
  }
}

export async function loadMethodModuleContent(id: string): Promise<string> {
  const cached = _contentCache.get(id);
  if (cached) return cached;
  const m = await loadMethodModuleManifest();
  const mod = m.modules.find((x) => x.id === id);
  if (!mod) throw new Error(`方法论模块不存在: ${id}`);
  const res = await fetch(resolveAsset('methods/' + mod.file));
  if (!res.ok) throw new Error(`方法论模块内容加载失败: ${mod.file}`);
  const text = await res.text();
  _contentCache.set(id, text);
  return text;
}

/* ───────────────────────────────────────────────────────────────────
 * 注入接口（被 compose.ts 调用）
 * ─────────────────────────────────────────────────────────────────── */

export interface InjectedMethodModule {
  id: string;
  title: string;
  content: string;
  estimatedTokens: number;
}

/**
 * 给定项目启用的模块 id 列表 + 当前节点 id，返回**应注入**的模块内容数组。
 * 自动应用：
 *  - injectsTo 节点白名单过滤
 *  - conflictsWith 互斥（保留 enabled 列表里靠前的，丢弃靠后的冲突项）
 *  - 上限 3 个（避免 token 爆炸）
 */
export async function loadMethodModulesForNode(
  enabledIds: string[],
  nodeId: string,
): Promise<InjectedMethodModule[]> {
  if (!enabledIds || enabledIds.length === 0) return [];
  const m = await loadMethodModuleManifest();

  // 过滤：必须存在 + 节点白名单
  const candidates = enabledIds
    .map((id) => m.modules.find((x) => x.id === id))
    .filter((x): x is MethodModuleItem => x != null && x.injectsTo.includes(nodeId));

  // 互斥处理（先保留先列出的）
  const accepted: MethodModuleItem[] = [];
  const blocked = new Set<string>();
  for (const mod of candidates) {
    if (blocked.has(mod.id)) continue;
    accepted.push(mod);
    for (const conflict of mod.conflictsWith) blocked.add(conflict);
    if (accepted.length >= 3) break; // 硬上限
  }

  // 异步加载内容
  const out: InjectedMethodModule[] = [];
  for (const mod of accepted) {
    try {
      const content = await loadMethodModuleContent(mod.id);
      out.push({
        id: mod.id,
        title: mod.title,
        content,
        estimatedTokens: mod.estimatedTokens,
      });
    } catch (e) {
      console.warn('[methodModule] 加载失败', mod.id, e);
    }
  }
  return out;
}

/** 把已加载的模块拼成单个 system 注入段 */
export function buildMethodModulePreamble(blocks: InjectedMethodModule[]): string {
  if (blocks.length === 0) return '';
  const parts: string[] = ['# 方法论模块（项目启用，强制遵循）'];
  for (const b of blocks) {
    parts.push(`\n## 【方法论】${b.title}\n${b.content}`);
  }
  parts.push('\n---\n（以上为方法论硬律；下方为本步具体职责。）\n');
  return parts.join('\n');
}
