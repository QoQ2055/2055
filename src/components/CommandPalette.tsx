/**
 * ui-v3 PR-1 MVP · Command Palette（Cmd+K / Ctrl+K 全局命令面板）
 *
 * 范围（MVP · 不含完整快捷键系统 · 留 PR-1B）：
 *   • 触发：Layout.tsx 挂全局 keydown 监听（仅 Cmd+K / Ctrl+K · 非 input focus 时）
 *   • 命令：10 个 nav 跳转命令（不涉及跨组件 dialog state · 避免 props drilling）
 *   • 交互：input 搜索 + ArrowUp/Down 导航 + Enter 执行 + Esc/click outside 关闭
 *
 * 不变量遵守（V3-I-1 ~ V3-I-7）：
 *   • V3-I-1 路由不动：本组件仅 useNavigate() 跳到既有路径 · 不新增路由
 *   • V3-I-2 不与浏览器冲突：仅捕获 Cmd+K (preventDefault) · 不抢 Cmd+C/V/Z 等
 *   • V3-I-4 不静默吞错：action 出错走 console.error + Toast（V2-I-9 同源）
 *   • DESIGN.md ① Token 优先：bg-canvas / border-border-subtle / text-fg-primary
 *   • DESIGN.md ⑥ 语义色配 icon：仅 nav 命令灰色 · 不用纯色块
 *
 * 后续延后项（PR-1B / PR-2）：
 *   • 完整快捷键系统（J/K/S/?  + handbook modal）
 *   • "新建项目" 命令（需要全局 dialog state）
 *   • "切换主题" 命令（settings store 暂无 theme 字段）
 *   • fuzzy match 升级（当前 substring · 后续可换 fuse.js / cmdk）
 */

import { useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, Home as HomeIcon, BookOpen, FileText, BookCopy,
  Wand2, FileSearch, Settings as SettingsIcon, FlaskConical,
  Brain, Lightbulb, FileDown, Film, type LucideIcon,
} from 'lucide-react';
import clsx from 'clsx';
import { useCommandPalette } from '../store/commandPalette';
import { useExportDrawer } from '../store/exportDrawer';
import { toast } from '../store/toast';

interface CommandContext {
  navigate: ReturnType<typeof useNavigate>;
}

interface Command {
  id: string;
  label: string;
  description?: string;
  group: 'navigate' | 'tools' | 'actions';
  icon: LucideIcon;
  keywords?: string[];
  action: (ctx: CommandContext) => void;
}

const COMMANDS: Command[] = [
  // 导航
  {
    id: 'nav-home',
    label: '首页',
    description: '回到项目列表',
    group: 'navigate',
    icon: HomeIcon,
    keywords: ['home', 'project', '项目', '主页'],
    action: ({ navigate }) => navigate('/'),
  },
  {
    id: 'nav-novel',
    label: '小说工坊',
    description: 'N0~N3.2 小说生产流水线',
    group: 'navigate',
    icon: BookOpen,
    keywords: ['novel', '小说', 'n3', '章节'],
    action: ({ navigate }) => navigate('/novel'),
  },
  {
    id: 'nav-screenplay',
    label: '剧本工坊',
    description: '原创剧本生产流水线',
    group: 'navigate',
    icon: FileText,
    keywords: ['screenplay', '剧本', '原创'],
    action: ({ navigate }) => navigate('/screenplay'),
  },
  {
    id: 'nav-adapt',
    label: '改编工坊',
    description: '小说→剧本改编流水线',
    group: 'navigate',
    icon: BookCopy,
    keywords: ['adapt', '改编'],
    action: ({ navigate }) => navigate('/adapt'),
  },
  {
    id: 'nav-kb',
    label: '知识库',
    description: '用户文档 / 嵌入资料',
    group: 'navigate',
    icon: BookOpen,
    keywords: ['kb', 'knowledge', '资料', '文档'],
    action: ({ navigate }) => navigate('/kb'),
  },
  // 工具
  {
    id: 'nav-analyzer',
    label: '拆书分析',
    description: '小说拆解 / 学习模式',
    group: 'tools',
    icon: FileSearch,
    keywords: ['analyzer', '拆书', '分析'],
    action: ({ navigate }) => navigate('/analyzer'),
  },
  {
    id: 'nav-refinery',
    label: '润色工坊',
    description: '6 个单一职责润色工具',
    group: 'tools',
    icon: Wand2,
    keywords: ['refinery', '润色', 'refine'],
    action: ({ navigate }) => navigate('/refinery'),
  },
  {
    id: 'nav-playground',
    label: '调试台',
    description: '裸 prompt 测试',
    group: 'tools',
    icon: FlaskConical,
    keywords: ['playground', '调试', 'prompt'],
    action: ({ navigate }) => navigate('/playground'),
  },
  {
    id: 'nav-methods',
    label: '方法论',
    description: '叙事方法论模块库',
    group: 'tools',
    icon: Brain,
    keywords: ['methods', '方法论'],
    action: ({ navigate }) => navigate('/methods'),
  },
  {
    id: 'nav-lessons',
    label: 'Reflector Lessons',
    description: '反思学习记录',
    group: 'tools',
    icon: Lightbulb,
    keywords: ['lessons', '反思', 'reflector'],
    action: ({ navigate }) => navigate('/lessons'),
  },
  {
    id: 'nav-settings',
    label: '设置',
    description: 'API Key / 模型 / 偏好',
    group: 'tools',
    icon: SettingsIcon,
    keywords: ['settings', '设置', 'api', 'config'],
    action: ({ navigate }) => navigate('/settings'),
  },
  // gap-e PR-2 · 导出动作类命令 · 调起 ExportDrawer
  {
    id: 'export-all',
    label: '导出产物…',
    description: '打开导出抽屉 · 5 种创作产物格式',
    group: 'actions',
    icon: FileDown,
    keywords: ['export', 'download', '导出', '下载', '产物', 'md', 'docx', 'fdx', 'fountain', 'csv'],
    action: () => useExportDrawer.getState().show('all'),
  },
  {
    id: 'export-novel',
    label: '导出小说…',
    description: '.md / .docx · 优先高亮小说类格式',
    group: 'actions',
    icon: BookOpen,
    keywords: ['export', 'novel', '小说', '导出', 'md', 'docx', 'word', 'markdown'],
    action: () => useExportDrawer.getState().show('novel'),
  },
  {
    id: 'export-screenplay',
    label: '下载剧本…',
    description: '.fdx / .fountain · 优先高亮剧本类格式',
    group: 'actions',
    icon: Film,
    keywords: ['export', 'screenplay', '剧本', 'fdx', 'fountain', 'final draft', '下载'],
    action: () => useExportDrawer.getState().show('screenplay'),
  },
];

/**
 * 简单 substring fuzzy 匹配（小写后匹配 label + description + keywords）
 * MVP 不引入 fuse.js · 命令数 < 20 时 substring 已足够
 */
function filterCommands(query: string): Command[] {
  const q = query.trim().toLowerCase();
  if (!q) return COMMANDS;
  return COMMANDS.filter((c) => {
    const haystack = [c.label, c.description ?? '', ...(c.keywords ?? [])]
      .join(' ')
      .toLowerCase();
    return haystack.includes(q);
  });
}

const GROUP_LABELS: Record<Command['group'], string> = {
  navigate: '跳转',
  tools: '工具',
  actions: '动作',
};

export function CommandPalette() {
  const navigate = useNavigate();
  const { open, query, selectedIndex, closePalette, setQuery, setSelectedIndex } =
    useCommandPalette();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const filtered = useMemo(() => filterCommands(query), [query]);

  // 打开后自动 focus 输入框
  useEffect(() => {
    if (open) {
      // 微延迟 · 等 input 渲染挂载
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  // selectedIndex 越界保护（filtered 缩小后）
  useEffect(() => {
    if (selectedIndex >= filtered.length && filtered.length > 0) {
      setSelectedIndex(0);
    }
  }, [filtered.length, selectedIndex, setSelectedIndex]);

  // 选中项滚到可见区
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const item = list.querySelector<HTMLElement>(`[data-cmd-index="${selectedIndex}"]`);
    if (item) item.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  function executeCommand(cmd: Command) {
    try {
      cmd.action({ navigate });
      closePalette();
    } catch (err) {
      // V3-I-4 · 不静默吞错
      console.error('[command-palette] action failed', cmd.id, err);
      toast.error(`执行命令失败：${cmd.label}`);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (filtered.length > 0) {
        setSelectedIndex((selectedIndex + 1) % filtered.length);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (filtered.length > 0) {
        setSelectedIndex(selectedIndex <= 0 ? filtered.length - 1 : selectedIndex - 1);
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const cmd = filtered[selectedIndex];
      if (cmd) executeCommand(cmd);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closePalette();
    }
  }

  if (!open) return null;

  // 按 group 分组渲染
  const grouped = filtered.reduce<Record<string, Command[]>>((acc, c) => {
    (acc[c.group] ??= []).push(c);
    return acc;
  }, {});

  let runningIndex = 0;

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-start justify-center pt-[15vh] px-4"
      onClick={closePalette}
      role="dialog"
      aria-modal="true"
      aria-label="命令面板"
    >
      <div
        className="bg-canvas border border-border-subtle rounded-lg shadow-2xl w-full max-w-xl flex flex-col max-h-[70vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 搜索框 */}
        <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border-subtle">
          <Search className="size-4 text-fg-muted shrink-0" aria-hidden="true" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入命令或页面名称…"
            className="flex-1 bg-transparent border-0 outline-none text-body-m text-fg-primary placeholder:text-fg-muted focus:ring-0"
          />
          <kbd className="text-tight-xs text-fg-muted px-1.5 py-0.5 rounded border border-border-subtle font-mono shrink-0">
            ESC
          </kbd>
        </div>

        {/* 命令列表 */}
        <ul ref={listRef} className="flex-1 overflow-auto py-1.5">
          {filtered.length === 0 && (
            <li className="px-4 py-6 text-center text-fg-muted text-body-s">
              没有找到匹配的命令
            </li>
          )}
          {(['navigate', 'tools'] as const).map((group) => {
            const items = grouped[group];
            if (!items || items.length === 0) return null;
            return (
              <li key={group}>
                <div className="px-3 py-1 text-tight-xs uppercase tracking-wider text-fg-muted font-medium">
                  {GROUP_LABELS[group]}
                </div>
                <ul>
                  {items.map((cmd) => {
                    const idx = runningIndex++;
                    const isSelected = idx === selectedIndex;
                    const Icon = cmd.icon;
                    return (
                      <li
                        key={cmd.id}
                        data-cmd-index={idx}
                        onMouseEnter={() => setSelectedIndex(idx)}
                        onClick={() => executeCommand(cmd)}
                        className={clsx(
                          'flex items-center gap-3 px-3 py-2 mx-1 rounded cursor-pointer',
                          isSelected
                            ? 'bg-elevated text-fg-primary'
                            : 'text-fg-secondary hover:bg-elevated/40',
                        )}
                        role="option"
                        aria-selected={isSelected}
                      >
                        <Icon
                          className={clsx(
                            'size-4 shrink-0',
                            isSelected ? 'text-primary-400' : 'text-fg-muted',
                          )}
                          aria-hidden="true"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-body-s truncate">{cmd.label}</div>
                          {cmd.description && (
                            <div className="text-tight-xs text-fg-muted truncate">
                              {cmd.description}
                            </div>
                          )}
                        </div>
                        {isSelected && (
                          <kbd className="text-tight-xs text-fg-muted px-1.5 py-0.5 rounded border border-border-subtle font-mono shrink-0">
                            ↵
                          </kbd>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </li>
            );
          })}
        </ul>

        {/* 底部提示 */}
        <div className="flex items-center gap-3 px-3 py-1.5 border-t border-border-subtle text-tight-xs text-fg-muted">
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 rounded border border-border-subtle font-mono">↑</kbd>
            <kbd className="px-1 py-0.5 rounded border border-border-subtle font-mono">↓</kbd>
            导航
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 rounded border border-border-subtle font-mono">↵</kbd>
            选择
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 rounded border border-border-subtle font-mono">ESC</kbd>
            关闭
          </span>
          <span className="ml-auto">{filtered.length} 个命令</span>
        </div>
      </div>
    </div>
  );
}
