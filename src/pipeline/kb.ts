// Knowledge-base loader & injection map.
// On-demand loads markdown KB files, caches them, and exposes which KB(s)
// to inject into which pipeline node's system prompt.

export interface KbItem {
  id: string;
  title: string;
  file: string;       // relative to /kb/
  category: 'writing' | 'visual' | 'shot' | 'combat' | 'asset' | 'adaptation' | string;
  summary: string;
  /** if true, only inject when project is in adaptation mode */
  adaptationOnly?: boolean;
}

export interface KbManifest {
  version: string;
  source: string;
  items: KbItem[];
}

let _manifest: KbManifest | null = null;
const _content = new Map<string, string>();

function asset(p: string) { return './' + p.replace(/^\.?\/?/, ''); }

export async function loadKbManifest(): Promise<KbManifest> {
  if (_manifest) return _manifest;
  const res = await fetch(asset('kb/manifest.json'));
  if (!res.ok) throw new Error(`无法加载 kb/manifest.json (HTTP ${res.status})`);
  _manifest = (await res.json()) as KbManifest;
  return _manifest;
}

export async function loadKbContent(id: string): Promise<string> {
  const cached = _content.get(id);
  if (cached) return cached;
  const m = await loadKbManifest();
  const item = m.items.find((i) => i.id === id);
  if (!item) throw new Error(`KB 不存在: ${id}`);
  const res = await fetch(asset('kb/' + item.file));
  if (!res.ok) throw new Error(`KB 加载失败: ${item.file}`);
  const text = await res.text();
  _content.set(id, text);
  return text;
}

// Which KBs apply to which pipeline node, by stage+index.
// Conservative defaults; user can disable via settings.enableKbInjection.
const NODE_KB_MAP: Record<string, string[]> = {
  // Screenplay — anti-AI-flavor on writing-heavy steps
  'screenplay.2': ['anti_ai_flavor_registry'],
  'screenplay.3': ['anti_ai_flavor_registry'],
  'screenplay.6': ['anti_ai_flavor_registry'],
  'screenplay.7': ['anti_ai_flavor_registry'],
  'screenplay.8': ['anti_ai_flavor_registry'],

  // Adapt — anti-AI-flavor on writing-heavy steps
  'adapt.1': ['anti_ai_flavor_registry'],
  'adapt.3': ['anti_ai_flavor_registry'],
  'adapt.4': ['anti_ai_flavor_registry'],
  'adapt.5': ['anti_ai_flavor_registry'],
  'adapt.6': ['anti_ai_flavor_registry'],

  // Assets — scene/prop/role visual mastery
  'assets.1': [],
  'assets.2': ['ai_emotion_expression_prompts'],          // 角色卡
  'assets.3': ['style_library'],                          // 场景卡：视觉风格后缀
  'assets.4': ['prop_design_mastery'],                    // 道具卡：三重身份/伏笔

  // Storyboard — full visual / shot / combat boost
  'storyboard.1': [
    'key_storyboard_engine',
    'storyboard_pro_mode',            // 进阶模式总览（含 LLM-only vs Schema 对照）
    'genre_taxonomy_and_taboos',      // 视听签名 / 5 维度落幅 / 题材禁忌
    'genre_to_av_signature_mapping',  // 30 原子题材 → 10 视听签名映射
  ],
  // V5.1 (2026-04-27) 重构：2.json 第七章已正本清源 11 字段排版 / 五行相机
  // / 多题材落幅末状态 / 三层强制声明 / G13 排版自检。KB 只保留 2.json 没有
  // 的「数值参考 / 反 AI 味 / 工作流约束 / 音频 dB 表」共 4 项，避免 prompt 冗余。
  // 已下线（内容被 2.json 第七章吸收）：unit_copy_template, cinematography_terms,
  // camera_motion_library, quality_motion_boosters, ai_emotion_expression_prompts,
  // combat_three_act_template, combat_camera_lock。
  'storyboard.2': [
    'audio_db_reference',             // dB / AUDIO_REFS（2.json 未含数值表）
    'numerical_anchors',              // 数值上下界 / 拍数升级
    'anti_ai_flavor_registry',        // 反 AI 味词库（黑名单）
    'storyboard_workflow_norms',      // TODO / 字数压缩工作流约束
  ],
};

// Per-KB compression cap override.
// Default cap is 4000 chars (see compressKb); these KBs would lose critical
// content (rule tables / multi-genre examples / 5-dimension末状态) if cut.
// Caps below sit ~5% above each KB's compressed size so future小 edits don't
// re-trigger truncation while still catching runaway growth.
//
// Verify with: `node -e "..."` snippet that prints (compressed, cap, truncated%)
// — see git history for the diagnostic command.
const KB_HARD_CAP_OVERRIDE: Record<string, number> = {
  // ── storyboard.1 ──
  // (key_storyboard_engine + the 3 below 都在 4000 内)
  genre_taxonomy_and_taboos: 6000,        // 4095 实际，留头空
  genre_to_av_signature_mapping: 4500,    // 3393 实际
  storyboard_pro_mode: 13000,             // 12051 实际（含 LLM-only vs Schema 对照表）
  // ── storyboard.2 (V5.1 精简后仅 4 项) ──
  audio_db_reference: 4500,               // 4056 实际
  numerical_anchors: 4500,                // 4086 实际
  anti_ai_flavor_registry: 4000,          // 2821 实际（默认 cap 已够）
  storyboard_workflow_norms: 4000,        // 3512 实际（默认 cap 已够）
  // 注：以下 KB 仍存在于 manifest，可能被 storyboard.1 / 其他场景使用，cap 保留
  // 以防别处引入；当前仅 storyboard.2 的注入清单不再含它们。
  // unit_copy_template / camera_motion_library / quality_motion_boosters /
  // ai_emotion_expression_prompts / cinematography_terms / combat_*
};

// Extra KBs to inject ONLY when project is in adaptation mode.
// These get merged with NODE_KB_MAP at load time and filtered by
// `adaptationOnly` flag on the manifest item.
const ADAPTATION_NODE_KB_MAP: Record<string, string[]> = {
  // R1' 改编指令书生成 — 需要 6 类型策略 + 压缩手法参考
  'screenplay.r1':  ['adaptation_genre_strategy', 'adaptation_compression'],
  // R9' 总审 — IP 风险扫描表
  'screenplay.r9':  ['adaptation_ip_risk'],

  // Adapt 流程（改编专属流水线）
  'adapt.1':        ['adaptation_compression'],                                  // 改编梗概：压缩 5 策略
  'adapt.2':        ['adaptation_genre_strategy'],                               // 人物适配：6 类型「保留 / 合并」清单
  'adapt.3':        ['adaptation_compression', 'adaptation_genre_strategy'],     // 短剧化结构大纲
  'adapt.4':        ['adaptation_compression'],                                  // 场次拆解
  'adapt.6':        ['adaptation_ip_risk'],                                      // 改编剧本医生

  // 旧 8 步在 adaptation 模式下若仍被使用（保留兼容）
  'screenplay.1':   ['adaptation_genre_strategy', 'adaptation_compression'],
  'screenplay.2':   ['adaptation_compression'],
  'screenplay.5':   ['adaptation_compression'],
  'screenplay.6':   ['adaptation_compression'],
};

// Compress a KB file: strip examples / version footer / 引言 to save tokens.
function compressKb(text: string, hardCap = 4000): string {
  let s = text
    .replace(/^>\s.*$/gm, '')                          // blockquote intros
    .replace(/^---+\s*$/gm, '')                        // horizontal rules
    .replace(/\n{3,}/g, '\n\n');
  // drop trailing version section
  s = s.replace(/\n#+\s*(版本|Version|Changelog)[\s\S]*$/i, '\n');
  s = s.trim();
  if (s.length > hardCap) {
    s = s.slice(0, hardCap) + '\n…（KB 已截断以控制 token）';
  }
  return s;
}

export interface InjectedKb {
  id: string;
  title: string;
  content: string;        // already compressed
  rawSize: number;
  compressedSize: number;
}

// Returns the KB blocks attached to the given nodeId, or [] if none.
// Pass `adaptation: true` to include adaptation-mode-only KBs.
export async function loadKbForNode(
  nodeId: string,
  opts: { adaptation?: boolean } = {},
): Promise<InjectedKb[]> {
  const baseIds = NODE_KB_MAP[nodeId] ?? [];
  const adaptIds = opts.adaptation ? (ADAPTATION_NODE_KB_MAP[nodeId] ?? []) : [];
  const ids = Array.from(new Set([...baseIds, ...adaptIds]));
  if (ids.length === 0) return [];
  const m = await loadKbManifest();
  const out: InjectedKb[] = [];
  for (const id of ids) {
    const item = m.items.find((i) => i.id === id);
    if (!item) continue;
    // Hard guard: even if mistakenly listed in NODE_KB_MAP, never inject
    // adaptationOnly KBs in original mode.
    if (item.adaptationOnly && !opts.adaptation) continue;
    const raw = await loadKbContent(id);
    const cap = KB_HARD_CAP_OVERRIDE[id] ?? 4000;
    const compressed = compressKb(raw, cap);
    out.push({
      id,
      title: item.title,
      content: compressed,
      rawSize: raw.length,
      compressedSize: compressed.length,
    });
  }
  return out;
}

// Build a single string ready to prepend before the original system prompt.
export function buildKbPreamble(blocks: InjectedKb[]): string {
  if (blocks.length === 0) return '';
  const parts: string[] = ['# 增强知识库（写作 / 视觉 / 镜头 红线，必须遵守）'];
  for (const b of blocks) {
    parts.push(`\n## 【KB】${b.title}\n${b.content}`);
  }
  parts.push('\n---\n（以上为通用红线；下方为本步具体职责。）\n');
  return parts.join('\n');
}

