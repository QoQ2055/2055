/**
 * /short-film route · MM1 PR-4 · 接入 LLM
 *
 * 演进路径：
 * - PR-2: FormatScaffoldPage 只读骨架（0 LLM）
 * - PR-4 (本切片): 复用 /screenplay 八步工作台 + 注入 ctx.formatId='narrative_short'
 *   · screenplay system prompt 已内置 4 分支（concept_short / narrative_short / feature / series），
 *     由 user msg 中 `体量:` 字段决定。
 *   · 通过 setCtx({ formatId }) 让 applyProjectContext 把 hardcoded 'narrative_short'
 *     替换为真正的格式标识（PR-4 默认仍 narrative_short · 现有项目零行为变化）。
 * - 后续 PR: 加格式切换提示 / 项目创建时强制选 format / 4 路由独立 artifact 命名空间等。
 *
 * 与 /screenplay 的关系：
 * - /screenplay = 通用 8 步工作台（默认 narrative_short）· 历史入口
 * - /short-film = 同一工作台 · 进入时强制 formatId='narrative_short' + header 标注短片格式
 */
import { useEffect } from 'react';
import { Screenplay } from './Screenplay';
import { useProject } from '../store/project';

export function ShortFilm() {
  const setCtx = useProject((s) => s.setCtx);
  // 进入路由 = 明确告诉系统"做叙事短片" · 设置 formatId 让 user prompt 走对应分支
  useEffect(() => { setCtx({ formatId: 'narrative_short' }); }, [setCtx]);
  return (
    <Screenplay
      stageId="screenplay"
      totalSteps={8}
      stepLabel="S"
      title="叙事短片工作台 · 8 步法（5-10 分钟）"
      subtitle="单一核心事件 · 四段式结构 · 1-2 个主角 · 一次完整 A→B 弧光"
    />
  );
}
