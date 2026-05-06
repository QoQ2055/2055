// 修复场景的"知识层 preamble"拼装器。
//
// 与 compose.ts 的 composeMessages 共享底层注入接口（loadKbForNode /
// loadMethodModulesForNode / buildGenreAnchorPreamble / listUserKbDocsForProject /
// buildCondensedDirectiveHeader），但只装配修复场景需要的子集：
//
//   1. R1 / R1' 创作指令书摘要（compact 版，控制 token）
//   2. 静态 KB（按 nodeId 白名单）
//   3. 用户 KB（按 type 白名单）
//   4. 题材锚点（mustInclude / mustAvoid / 段落规则等）
//   5. 启用的方法论模块（按 nodeId 白名单）
//
// 不注入的（避免把"生成期硬律"误施加到"修复期"）：
//   - S0 master digest（拆书原作，修复时不应改写故事走向）
//   - ADAPTATION_SCREENPLAY_ADDENDUM（生成期总框约束）
//   - ANTI_DECORATION_ADDENDUM（修复期由 issue 显式指明 → 不重复）
//   - CREATION_CONSTRAINTS（同上）
//
// 使用：
//   const extra = await buildFixContextPreamble({
//     nodeId: artifact.nodeId,
//     project: ctx,
//     artifacts: project.artifacts,
//     enableKbInjection: settings.enableKbInjection,
//     enableEditorialRounds: settings.enableEditorialRounds,
//   });
//   await runFixAllIssues({ ..., extraSystemPreamble: extra });

import { buildKbPreamble, loadKbForNode } from './kb';
import { buildMethodModulePreamble, loadMethodModulesForNode } from './methodModules';
import { buildCondensedDirectiveHeader, R1_NODE_ID } from './editorial';
import { buildGenreAnchorPreamble, userKbTypesForNode } from './compose';
import { listUserKbDocsForProject, type UserKbDoc } from '../store/userKb';
import { buildUserKbPreamble } from '../llm/extractKb';
import type { ArtifactMap, ProjectContext } from './types';

export interface FixContextOptions {
  /** 待修复产物所属节点 id（如 'screenplay.7' / 'novel.3.1'） */
  nodeId: string;
  /** 项目上下文（取 genres / createMode / methodModuleIds / userKbDocIds） */
  project: ProjectContext;
  /** 全部产物（取 R1 创作指令书） */
  artifacts: ArtifactMap;
  /** 是否启用 KB / 用户 KB / 方法论注入（与 settings 同名字段一致） */
  enableKbInjection?: boolean;
  /** 是否注入 R1 指令书要点 */
  enableEditorialRounds?: boolean;
}

/**
 * 拼装修复场景的 system 前导段。返回值可空（项目未配置任何相关知识时）。
 *
 * 失败保护：每个子模块都用 try-catch 包裹，单点失败不影响其它注入；
 * 失败原因仅 console.warn，不抛错（修复主流程优先保证可执行）。
 */
export async function buildFixContextPreamble(opts: FixContextOptions): Promise<string> {
  const {
    nodeId, project, artifacts,
    enableKbInjection = true,
    enableEditorialRounds = true,
  } = opts;

  const isAdaptation = project.createMode === 'adaptation';
  const parts: string[] = [];

  // 1. R1 / R1' 创作指令书摘要（compact 版，仅主题锚点 / doNots / mustKeep）
  if (enableEditorialRounds) {
    try {
      const head = buildCondensedDirectiveHeader(artifacts[R1_NODE_ID]);
      if (head) parts.push(head);
    } catch (e) {
      console.warn('[fixContext] R1 directive build failed', e);
    }
  }

  // 2. 静态 KB（按 nodeId 白名单 + 改编模式额外 KB）
  if (enableKbInjection) {
    try {
      const blocks = await loadKbForNode(nodeId, { adaptation: isAdaptation });
      const head = buildKbPreamble(blocks);
      if (head) parts.push(head);
    } catch (e) {
      console.warn('[fixContext] static KB load failed', e);
    }
  }

  // 3. 用户 KB（按 type 白名单 + 项目绑定的 docIds）
  if (enableKbInjection && project.userKbDocIds?.length) {
    try {
      const allowedTypes = userKbTypesForNode(nodeId);
      if (allowedTypes.length > 0) {
        const docs = await listUserKbDocsForProject(project.userKbDocIds);
        const filtered = docs.filter((d: UserKbDoc) => allowedTypes.includes(d.type));
        if (filtered.length > 0) {
          const head = buildUserKbPreamble(filtered, { nodeId });
          if (head) parts.push(head);
        }
      }
    } catch (e) {
      console.warn('[fixContext] user KB load failed', e);
    }
  }

  // 4. 题材锚点（mustInclude / mustAvoid / 段落规则）
  try {
    const head = buildGenreAnchorPreamble(project.genres);
    if (head) parts.push(head);
  } catch (e) {
    console.warn('[fixContext] genre anchor build failed', e);
  }

  // 5. 方法论模块（按 nodeId 白名单 + conflictsWith 互斥 + 上限 3）
  if (enableKbInjection && project.methodModuleIds?.length) {
    try {
      const blocks = await loadMethodModulesForNode(project.methodModuleIds, nodeId);
      const head = buildMethodModulePreamble(blocks);
      if (head) parts.push(head);
    } catch (e) {
      console.warn('[fixContext] method modules load failed', e);
    }
  }

  if (parts.length === 0) return '';

  // 修复场景独有的"使用说明"：让 LLM 把这些信息当"产物必须满足的约束"，
  // 而不是"重写所需的指南"——避免触发整体重写。
  const intro = [
    '# 修复必须遵守的项目硬约束（生成期已应用，修订时不得违反）',
    '',
    '以下知识层是项目当前生效的硬约束。修订时**只对照这些约束的违反点做最小化修改**，',
    '不要借机重写、重排、统一风格——这是修复阶段，不是创作阶段。',
    '',
  ].join('\n');

  return intro + parts.join('\n\n');
}
