/**
 * /feature-film route · MM1 PR-5 · 接入 LLM
 *
 * 与 PR-4 ShortFilm 同构：复用 /screenplay 八步工作台 · 进入路由时 setCtx({ formatId: 'feature' })
 * 让 user msg `体量:` 字段切换到 feature · screenplay system prompt 内置 4 分支会自动走电影长片分支。
 *
 * 已知限制 (留待 MM1 PR-7):
 * - artifact key 当前与 /short-film / /screenplay 共享 'screenplay.{1..8}' 命名空间
 *   用户在 /short-film 与 /feature-film 之间切换时 artifact 会互相覆盖
 *   后续 PR 加 format prefix (如 'feature.screenplay.1') 隔离
 */
import { useEffect } from 'react';
import { Screenplay } from './Screenplay';
import { useProject } from '../store/project';

export function FeatureFilm() {
  const setCtx = useProject((s) => s.setCtx);
  useEffect(() => { setCtx({ formatId: 'feature' }); }, [setCtx]);
  return (
    <Screenplay
      stageId="screenplay"
      totalSteps={8}
      stepLabel="S"
      title="电影长片工作台 · 8 步法（75-120 分钟）"
      subtitle="多线索结构 · 主角完整 Want/Need/Arc · 5-7 个戏剧节点"
    />
  );
}
