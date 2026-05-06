// CharacterBible.tsx · gap-b PR-4
// Novel 页 N3 阶段 ProgressDashboard 下方 collapsible 面板（CA §4.1 Q1 决议）。
//
// 状态来源：
//   • artifacts → useProject().artifacts (live project)
//   • collapsed / selectedCharacterName / viewMode → useCharacterBible()
//
// CK invariants：
//   • I-3 子组件纯 props（CharacterTimelineView / CharacterRelationGraph 不读 store）
//   • I-4 仅 1 个新 localStorage key 'flil:character-bible:state'

import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Users, RefreshCw, AlertTriangle } from 'lucide-react';
import clsx from 'clsx';
import { useProject } from '../store/project';
import { useSettings } from '../store/settings';
import { useCharacterBible } from '../store/characterBible';
import { listCharacterTimeline, listChapterStates, type CharacterStateRecord } from '../store/characterStates';
import { runCharacterStateExtraction } from '../pipeline/characterStates';
import { CharacterTimelineView } from './character/CharacterTimelineView';
import { CharacterRelationGraph } from './character/CharacterRelationGraph';
import type { NovelChapterLoopMeta } from '../pipeline/novelLoop';

const PROJECT_ID = 0; // live project · 与 PR-3 保持一致

export function CharacterBible() {
  const artifacts = useProject((s) => s.artifacts);
  const project = useProject((s) => s.ctx);
  const settings = useSettings();
  const collapsed = useCharacterBible((s) => s.collapsed);
  const toggleCollapse = useCharacterBible((s) => s.toggleCollapse);
  const selectedCharacter = useCharacterBible((s) => s.selectedCharacterName);
  const selectCharacter = useCharacterBible((s) => s.selectCharacter);
  const viewMode = useCharacterBible((s) => s.viewMode);
  const setViewMode = useCharacterBible((s) => s.setViewMode);

  const [timeline, setTimeline] = useState<CharacterStateRecord[]>([]);
  const [allCharacters, setAllCharacters] = useState<string[]>([]);
  const [busy, setBusy] = useState<null | string>(null);

  // 总章数：从 chapterContents 数（novel.7 优先，回退 novel.6）
  const totalChapters = useMemo(() => {
    const meta7 = (artifacts['novel.7']?.meta ?? {}) as Partial<NovelChapterLoopMeta>;
    const meta6 = (artifacts['novel.6']?.meta ?? {}) as Partial<NovelChapterLoopMeta>;
    const all = { ...(meta6.chapterContents ?? {}), ...(meta7.chapterContents ?? {}) };
    const keys = Object.keys(all).map(Number).filter(Number.isFinite);
    return keys.length === 0 ? 0 : Math.max(...keys);
  }, [artifacts]);

  // 加载所有角色名清单（dexie 全表 distinct）
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const names = new Set<string>();
      for (let ch = 1; ch <= Math.max(totalChapters, 1); ch++) {
        const rows = await listChapterStates(PROJECT_ID, ch);
        for (const r of rows) names.add(r.characterName);
      }
      if (!cancelled) setAllCharacters(Array.from(names).sort());
    })().catch((e) => console.warn('[gap-b] 角色清单加载失败:', e));
    return () => { cancelled = true; };
  }, [totalChapters]);

  // 加载选中角色的时间线
  useEffect(() => {
    if (!selectedCharacter) { setTimeline([]); return; }
    let cancelled = false;
    listCharacterTimeline(PROJECT_ID, selectedCharacter).then((rows) => {
      if (!cancelled) setTimeline(rows);
    }).catch((e) => console.warn('[gap-b] 时间线加载失败:', e));
    return () => { cancelled = true; };
  }, [selectedCharacter, busy]);

  const summary = `共 ${allCharacters.length} 角色 · ${totalChapters} 章`;
  const hasFailed = timeline.some((r) => r.snapshot === null);
  const hasStale = timeline.some((r) => r.stale);

  async function handleRerun(chapterIndex: number) {
    if (!project) return;
    setBusy(`rerun-${chapterIndex}`);
    try {
      const r = await runCharacterStateExtraction({
        project, artifacts, settings,
        projectId: PROJECT_ID, chapterIndex, source: 'novel.7',
      });
      if (!r.ok) console.warn('[gap-b] 重跑失败:', r.error);
    } catch (e) {
      console.warn('[gap-b] 重跑异常:', e);
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="rounded border border-border-subtle bg-surface-1" aria-label="角色 Bible 跨章节追踪">
      <button
        type="button"
        onClick={toggleCollapse}
        aria-expanded={!collapsed}
        aria-controls="character-bible-body"
        className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-surface-2 transition focus:outline-none focus:ring-2 focus:ring-violet-400"
      >
        <span className="flex items-center gap-2 font-medium">
          <Users className="size-4 text-violet-500" />
          角色 Bible 时间线
          <span className="text-xs text-fg-muted font-normal ml-2">{summary}</span>
          {hasFailed && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-700">
              提取失败
            </span>
          )}
          {hasStale && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-700">
              已过期
            </span>
          )}
        </span>
        {collapsed ? <ChevronDown className="size-4" /> : <ChevronUp className="size-4" />}
      </button>

      {!collapsed && (
        <div id="character-bible-body" className={clsx('px-3 py-3 space-y-3 border-t border-border-subtle')}>
          {!settings.enableCharacterStateExtraction && (
            <div className="flex items-start gap-2 px-3 py-2 rounded bg-amber-500/10 text-amber-700 text-xs">
              <AlertTriangle className="size-4 mt-0.5 shrink-0" />
              <span>
                角色状态提取未开启。在 <code className="px-1 bg-amber-500/20 rounded">设置</code> 启用 <code className="px-1 bg-amber-500/20 rounded">enableCharacterStateExtraction</code> 后，N3.2 章节润色完成时会自动跑提取。
              </span>
            </div>
          )}

          {/* Toolbar：角色选择 + 视图切换 */}
          <div className="flex items-center gap-2 flex-wrap">
            <label className="text-xs text-fg-muted">角色：</label>
            <select
              className="text-xs border border-border-subtle rounded px-2 py-1 bg-surface-1"
              value={selectedCharacter ?? ''}
              onChange={(e) => selectCharacter(e.target.value || null)}
              aria-label="选择角色"
            >
              <option value="">— 选择角色 —</option>
              {allCharacters.map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>

            <div className="ml-auto flex items-center gap-1" role="tablist" aria-label="视图模式">
              <button
                type="button"
                role="tab"
                aria-selected={viewMode === 'timeline'}
                onClick={() => setViewMode('timeline')}
                className={clsx(
                  'text-xs px-2 py-1 rounded',
                  viewMode === 'timeline' ? 'bg-violet-500 text-white' : 'bg-surface-2 hover:bg-surface-3',
                )}
              >
                时间线
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={viewMode === 'relations'}
                onClick={() => setViewMode('relations')}
                className={clsx(
                  'text-xs px-2 py-1 rounded',
                  viewMode === 'relations' ? 'bg-violet-500 text-white' : 'bg-surface-2 hover:bg-surface-3',
                )}
              >
                关系图
              </button>
            </div>
          </div>

          {/* View body */}
          {!selectedCharacter ? (
            <div className="text-sm text-gray-500 px-3 py-6 text-center">
              {allCharacters.length === 0
                ? '尚无角色记录 · 跑过 N3.2 润色（开启提取）后会自动出现'
                : '从上方下拉选择一个角色查看时间线 / 关系图'}
            </div>
          ) : viewMode === 'timeline' ? (
            <>
              <CharacterTimelineView
                records={timeline}
                totalChapters={totalChapters}
                selectedChapterIndex={null}
                onSelectChapter={(ch) => handleRerun(ch)}
              />
              <div className="text-[10px] text-fg-muted px-1">
                提示：点击单元格 = 重跑该章提取（{busy ? `运行中：${busy}` : '空闲'}）
              </div>
            </>
          ) : (
            <CharacterRelationGraph characterName={selectedCharacter} records={timeline} />
          )}
        </div>
      )}
    </section>
  );
}
