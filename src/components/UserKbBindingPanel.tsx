/**
 * 资料库 v2 · 项目设置中的「知识库绑定」面板
 *
 * 让用户在 NovelSettingsDialog 里勾选启用哪些 UserKbDoc。
 * 受控组件：通过 props 接收当前 docIds，通过 onChange 回写。
 */

import { useEffect, useState } from 'react';
import { ExternalLink, Library, ToggleLeft, ToggleRight } from 'lucide-react';
import clsx from 'clsx';
import {
  listUserKbDocs,
  USER_KB_TYPE_META,
  type UserKbDoc,
  type UserKbDocType,
} from '../store/userKb';

interface Props {
  /** 当前绑定的 doc id 列表（来自 ctx.userKbDocIds） */
  value: number[];
  onChange: (next: number[]) => void;
  /** 默认折叠状态 */
  collapsed?: boolean;
}

export function UserKbBindingPanel({ value, onChange, collapsed = false }: Props) {
  const [docs, setDocs] = useState<UserKbDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(!collapsed);

  useEffect(() => {
    listUserKbDocs({ enabledOnly: true })
      .then(setDocs)
      .finally(() => setLoading(false));
  }, []);

  function toggle(id: number) {
    if (value.includes(id)) {
      onChange(value.filter((v) => v !== id));
    } else {
      onChange([...value, id]);
    }
  }

  // 按 type 分组显示，便于扫读
  const byType = new Map<UserKbDocType, UserKbDoc[]>();
  for (const d of docs) {
    if (d.id == null) continue;
    const arr = byType.get(d.type) ?? [];
    arr.push(d);
    byType.set(d.type, arr);
  }

  const selectedCount = value.filter((id) => docs.some((d) => d.id === id)).length;
  const orphanCount = value.length - selectedCount; // 引用了但已被删除/禁用的

  return (
    <div className="bg-surface/40 border border-border-subtle rounded">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-3 py-2 flex items-center gap-2 text-left hover:bg-surface/60 transition-colors rounded"
      >
        <Library className="size-4 text-primary-500 shrink-0" />
        <div className="flex-1">
          <div className="font-medium text-fg-primary">知识库绑定</div>
          <div className="text-tight-sm text-fg-muted mt-0.5">
            {loading ? '加载中…' : (
              docs.length === 0
                ? '资料库为空。'
                : `已选 ${selectedCount}/${docs.length}${orphanCount > 0 ? ` · ${orphanCount} 条悬空引用` : ''}`
            )}
          </div>
        </div>
        <a
          href="#/kb"
          target="_blank"
          rel="noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="text-tight-sm text-brand-300 hover:text-brand-200 flex items-center gap-0.5"
        >
          管理 <ExternalLink className="size-3" />
        </a>
        <span className="text-fg-muted text-xs">{expanded ? '▾' : '▸'}</span>
      </button>

      {expanded && (
        <div className="px-3 pb-3 pt-1 border-t border-border-subtle/50 space-y-2">
          {loading && <div className="text-tight-sm text-fg-muted">加载中…</div>}

          {!loading && docs.length === 0 && (
            <div className="text-tight-sm text-fg-muted italic py-2">
              还没上传过任何资料。前往「
              <a href="#/kb" target="_blank" rel="noreferrer" className="text-brand-300 underline">
                知识库 → 我的资料库
              </a>
              」上传爆款要点 / 范文 / 反例后即可绑定。
            </div>
          )}

          {Array.from(byType.entries()).map(([type, arr]) => {
            const meta = USER_KB_TYPE_META[type];
            return (
              <div key={type} className="space-y-1">
                <div className="text-tight-xs uppercase tracking-wide text-fg-muted font-semibold">
                  {meta.label} <span className="opacity-60">→ {meta.injectsTo.join(' · ')}</span>
                </div>
                <ul className="space-y-0.5">
                  {arr.map((d) => {
                    const id = d.id!;
                    const checked = value.includes(id);
                    return (
                      <li key={id}>
                        <button
                          type="button"
                          onClick={() => toggle(id)}
                          className={clsx(
                            'w-full text-left px-2 py-1 rounded text-tight-sm flex items-center gap-2 transition-colors',
                            checked
                              ? 'bg-primary-500/15 text-brand-200 border border-brand-500/40'
                              : 'border border-transparent hover:bg-surface',
                          )}
                        >
                          {checked ? (
                            <ToggleRight className="size-3.5 shrink-0 text-brand-300" />
                          ) : (
                            <ToggleLeft className="size-3.5 shrink-0 text-fg-muted" />
                          )}
                          <span className="truncate flex-1">{d.title}</span>
                          {d.tags.length > 0 && (
                            <span className="text-tight-xs text-fg-muted shrink-0">{d.tags.join('/')}</span>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}

          {orphanCount > 0 && (
            <div className="text-tight-xs text-warning/80 italic mt-2">
              注：{orphanCount} 条已绑定的资料已被删除或禁用，注入时会自动跳过；可点
              <button
                type="button"
                onClick={() => onChange(value.filter((id) => docs.some((d) => d.id === id)))}
                className="underline ml-0.5 text-warning hover:text-warning"
              >
                清理悬空引用
              </button>
              。
            </div>
          )}
        </div>
      )}
    </div>
  );
}
