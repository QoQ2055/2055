/**
 * useScreenplayFormatRoute · MM1 PR-6
 *
 * 4 个 format 路由（/short-film / /feature-film / /series · 未来 /ultrashort）
 * 共享的"目标 format vs 已有产物"协调 hook。
 *
 * 决策矩阵：
 *
 *   ctx.formatId    | hasArtifacts | 行为
 *   ----------------|--------------|--------------------------------
 *   undefined       | any          | 静默 setCtx({ formatId: target })
 *   === target      | any          | 不动 · 渲染 Screenplay
 *   !== target      | false        | 静默 setCtx · 无产物覆盖风险
 *   !== target      | true         | 返回 mismatch · 调用方渲染 FormatMismatchBanner
 *
 * 价值：
 *   PR-4/5 的 useEffect 无条件 setCtx({ formatId }) 会在格式切换时让 ctx 与
 *   artifact 不一致（ctx 是新 format · artifact 是旧 format 内容）。本 hook
 *   把"切换"延后到用户在 banner 里显式确认 · 避免静默覆盖。
 */
import { useEffect } from 'react';
import { useProject } from '../store/project';
import type { ProjectContext } from '../pipeline/types';

type FormatId = NonNullable<ProjectContext['formatId']>;

/** 4 个 stage 的产物正则 · 这些产物受 format 影响 · 切换格式时需清除。 */
const FORMATTED_STAGE_RE = /^(screenplay|adapt|assets|storyboard)\./;

export interface FormatMismatchInfo {
  /** 当前 ctx 中的 formatId（与路由目标不一致） */
  currentFormatId: FormatId;
  /** 用户确认切换后调用：清 4 stage 产物 + 设新 formatId */
  onConfirmSwitch: () => void;
}

/**
 * @param target 当前路由期望的 formatId
 * @returns mismatch !== null 时调用方应渲染 FormatMismatchBanner · 否则渲染正常工作台
 */
export function useScreenplayFormatRoute(target: FormatId): { mismatch: FormatMismatchInfo | null } {
  const ctx = useProject((s) => s.ctx);
  const setCtx = useProject((s) => s.setCtx);
  const clearStage = useProject((s) => s.clearStage);
  const hasArtifacts = useProject((s) =>
    Object.keys(s.artifacts).some((k) => FORMATTED_STAGE_RE.test(k)),
  );

  useEffect(() => {
    if (ctx.formatId === target) return;
    // 安全场景: 未设过 formatId 或不一致但无产物 · 静默切换
    if (!ctx.formatId || !hasArtifacts) setCtx({ formatId: target });
    // 不一致 + 有产物 → 不动 · 让调用方渲染 banner
  }, [ctx.formatId, hasArtifacts, setCtx, target]);

  if (ctx.formatId && ctx.formatId !== target && hasArtifacts) {
    return {
      mismatch: {
        currentFormatId: ctx.formatId,
        onConfirmSwitch: () => {
          clearStage('screenplay');
          clearStage('adapt');
          clearStage('assets');
          clearStage('storyboard');
          setCtx({ formatId: target });
        },
      },
    };
  }

  return { mismatch: null };
}
