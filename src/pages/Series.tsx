/**
 * /series route · MM1 PR-5 · 接入 LLM
 *
 * 与 PR-4 ShortFilm 同构：复用 /screenplay 八步工作台 · 进入路由时 setCtx({ formatId: 'series' })
 * 让 user msg `体量:` 字段切换到 series · screenplay system prompt 已把 series 归入 D 分支 (叙事/长片/剧集)。
 *
 * 注意：剧集本质是"季度规划 + 逐集生成"双阶段 · 当前 PR 仅接入第一阶段（season-level 8 步）。
 * 逐集循环将在后续 MM1 PR 借鉴 N3.1 / N3.2 章节循环模式实现。
 *
 * 已知限制 (留待 MM1 PR-7):
 * - artifact key 当前与 /short-film / /feature-film / /screenplay 共享 'screenplay.{1..8}'
 *   用户在不同 format 路由切换时 artifact 会互相覆盖
 */
import { useEffect } from 'react';
import { Screenplay } from './Screenplay';
import { useProject } from '../store/project';

export function Series() {
  const setCtx = useProject((s) => s.setCtx);
  useEffect(() => { setCtx({ formatId: 'series' }); }, [setCtx]);
  return (
    <Screenplay
      stageId="screenplay"
      totalSteps={8}
      stepLabel="S"
      title="剧集工作台 · 8 步法（季度规划 + 分集结构）"
      subtitle="多集叙事 · 季度弧光 + 单集冲突 · 钩子 / 卡黑 / 集间悬念"
    />
  );
}
