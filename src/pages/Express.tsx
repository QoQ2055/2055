// 特殊项目 · 快速分镜（Express Pipeline）
// 跳过原创/改编剧本阶段，直接「导入剧本 → 抽取资产 → 生成分镜」单页向导。
// 复用 Pipeline 的 runStep / runStoryboardPhase2Loop 内核，仅做 UX 重组。

import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Play, Square, Loader2, CheckCircle2, Circle, AlertTriangle,
  FileText, Sparkles, Upload, Download, Box, Film, Wand2, ChevronRight,
  RotateCcw, Trash2,
} from 'lucide-react';
import clsx from 'clsx';
import { Input, Textarea } from '../components/ui';
import { confirm as confirmDialog } from '../store/confirm';
import { loadManifest } from '../pipeline/manifest';
import { runStep, runStoryboardPhase2Loop } from '../pipeline/runner';
import type {
  Manifest, ManifestStep, NodeArtifact, NodeStatus,
} from '../pipeline/types';
import { useSettings } from '../store/settings';
import { useProject } from '../store/project';
import {
  GENRES, PLATFORMS, PROTAGONISTS, DURATIONS, VISUAL_STYLES,
  buildConcept,
} from '../data/projectTaxonomy';
import { normalizeContent } from '../components/normalizer';
import { SCREENPLAY_FINAL_NORMALIZE } from '../components/normalizePresets';
import { ScreenplayDoctorPanel } from '../components/ScreenplayDoctorPanel';
import { ArtifactStructuredView } from '../components/ArtifactStructuredView';
import { StoryboardPlanDiagnostics } from '../components/StoryboardPlanDiagnostics';
import { SelfCheckPanel } from '../components/SelfCheckPanel';
import { ConsistencyPanel } from '../components/ConsistencyPanel';
import { ProgressBanner, type ProgressSegment } from '../components/ProgressBanner';
import type { SelfCheckReport } from '../pipeline/selfCheck';
import { parseStoryboardPlan } from '../pipeline/storyboardPlan';

interface RunState { status: NodeStatus; streamed: string; error?: string }

export function Express() {
  const project = useProject();
  const settings = useSettings();
  const ctx = project.ctx;

  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [runStates, setRunStates] = useState<Record<string, RunState>>({});
  const [chainBusy, setChainBusy] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // 剧本导入区状态
  const sb7 = project.artifacts['screenplay.7'];
  const [draft, setDraft] = useState<string>(sb7?.content ?? '');
  const [draftErr, setDraftErr] = useState<string>('');
  const [normalizing, setNormalizing] = useState(false);
  const [normalizePreview, setNormalizePreview] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    loadManifest()
      .then((m) => { if (!cancelled) setManifest(m); })
      .catch((e) => { if (!cancelled) setLoadErr(String(e?.message ?? e)); });
    return () => { cancelled = true; };
  }, []);

  // 第一次进入此页时，自动把项目类型标记为 express
  useEffect(() => {
    if (ctx.projectType !== 'express') {
      project.setCtx({ projectType: 'express' });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 同步 ctx 字段变更后自动派生 concept（不覆盖用户手填的 concept 字段）
  useEffect(() => {
    const derived = buildConcept({
      genres: ctx.genres,
      protagonistGender: ctx.protagonistGender,
      platform: ctx.platform,
      coreConflict: ctx.coreConflict,
      durationMin: ctx.durationMin,
      visualStyle: ctx.visualStyle,
    });
    if (derived && derived !== ctx.concept) {
      project.setCtx({ concept: derived });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    JSON.stringify(ctx.genres ?? []),
    ctx.protagonistGender, ctx.platform, ctx.coreConflict, ctx.durationMin, ctx.visualStyle,
  ]);

  const assetsStage = useMemo(
    () => manifest?.stages.find((s) => s.id === 'assets') ?? null,
    [manifest],
  );
  const sbStage = useMemo(
    () => manifest?.stages.find((s) => s.id === 'storyboard') ?? null,
    [manifest],
  );
  const storyboardPlanUnitCount = useMemo(() => {
    const art = project.artifacts['storyboard.1'];
    if (!art) return 0;
    try { return parseStoryboardPlan(art.content).units.length; }
    catch { return 0; }
  }, [project.artifacts['storyboard.1']?.content]);

  /* ── helpers ─────────────────────────────────────────────────── */

  function setNodeState(id: string, patch: Partial<RunState>) {
    setRunStates((s) => ({ ...s, [id]: { ...(s[id] ?? { status: 'idle', streamed: '' }), ...patch } }));
  }

  function stop() { abortRef.current?.abort(); }

  async function runOne(
    stageId: 'assets' | 'storyboard',
    step: ManifestStep,
    ctrlExt?: AbortController,
    phase2Opts?: { onlyUnits?: number[]; resume?: boolean },
  ) {
    const ctrl = ctrlExt ?? new AbortController();
    if (!ctrlExt) abortRef.current = ctrl;
    setNodeState(step.id, { status: 'running', streamed: '', error: undefined });
    try {
      // 实时读取 store 快照，避免闭包中的 project 变量是上次渲染的旧状态。
      // 这里是修复「连跑 storyboard.1 → storyboard.2 报错」的关键点：
      // upsertArtifact 会为下一渲染设新的 artifacts，但 await 期间闭包变量不会更新。
      const liveArtifacts = useProject.getState().artifacts;
      const liveCtx = useProject.getState().ctx;
      let artifact: NodeArtifact;
      if (stageId === 'storyboard' && step.index === 2) {
        // 续跑模式：用循环器自带的增量持久化 + 失败隔离
        const acc: string[] = [];
        // 续跑时把已完成的 unit 内容预填到 acc 里（视觉上 resume 不会从 0 开始）
        const existing = liveArtifacts['storyboard.2'];
        const existingMeta = (existing?.meta ?? {}) as { unitContents?: Record<number, string> };
        if (phase2Opts?.resume !== false && existingMeta.unitContents) {
          const indices = Object.keys(existingMeta.unitContents)
            .map((k) => parseInt(k, 10))
            .filter((n) => !isNaN(n))
            .sort((a, b) => a - b);
          for (const i of indices) {
            const c = existingMeta.unitContents[i];
            if (c) acc.push(`## UNIT ${i}\n\n${c.trim()}`);
          }
          if (acc.length) setNodeState(step.id, { streamed: acc.join('\n\n---\n\n') });
        }

        artifact = await runStoryboardPhase2Loop({
          step,
          project: liveCtx,
          artifacts: liveArtifacts,
          settings,
          signal: ctrl.signal,
          resume: phase2Opts?.resume,
          onlyUnits: phase2Opts?.onlyUnits,
          onUnitStart: (u, total) => setNodeState(step.id, {
            streamed: acc.join('\n\n---\n\n') + (acc.length ? '\n\n---\n\n' : '') +
              `## UNIT ${u.unitIndex} / ${total} （生成中）\n${u.summary}\n`,
          }),
          onUnitDelta: (idx, full) => setNodeState(step.id, {
            streamed: acc.join('\n\n---\n\n') + (acc.length ? '\n\n---\n\n' : '') +
              `## UNIT ${idx} （生成中）\n\n${full}`,
          }),
          onUnitDone: (u, content) => {
            // 替换或追加（重试场景下原 acc 里可能已有占位）
            const block = `## UNIT ${u.unitIndex}\n\n${content.trim()}`;
            const idx = acc.findIndex((s) => s.startsWith(`## UNIT ${u.unitIndex}\n`) || s.startsWith(`## UNIT ${u.unitIndex} `));
            if (idx >= 0) acc[idx] = block; else acc.push(block);
            setNodeState(step.id, { streamed: acc.join('\n\n---\n\n') });
          },
          onUnitFailed: (u, err, retries) => {
            const block = `## UNIT ${u.unitIndex} ⚠ 失败 (#${retries})\n\n> ${err.slice(0, 200)}`;
            const idx = acc.findIndex((s) => s.startsWith(`## UNIT ${u.unitIndex}\n`) || s.startsWith(`## UNIT ${u.unitIndex} `));
            if (idx >= 0) acc[idx] = block; else acc.push(block);
            setNodeState(step.id, { streamed: acc.join('\n\n---\n\n') });
          },
          // 关键：每个 unit 完成立即写回 store，刷新页面也不会丢
          onProgress: (intermediate) => project.upsertArtifact(intermediate),
        });
      } else {
        artifact = await runStep({
          stageId, step,
          project: liveCtx,
          artifacts: liveArtifacts,
          settings,
          signal: ctrl.signal,
          onDelta: (_, full) => setNodeState(step.id, { streamed: full }),
        });
      }
      project.upsertArtifact(artifact);
      setNodeState(step.id, { status: 'done' });
      return artifact;
    } catch (e: any) {
      if (ctrl.signal.aborted) setNodeState(step.id, { status: 'aborted', error: '已中止' });
      else setNodeState(step.id, { status: 'error', error: e?.message ?? String(e) });
      throw e;
    }
  }

  /** 仅重跑失败单元 */
  async function retryFailedUnits() {
    if (!sbStage || chainBusy) return;
    const sb2art = project.artifacts['storyboard.2'];
    const meta = (sb2art?.meta ?? {}) as { failedUnits?: Array<{ unitIndex: number }> };
    const failed = (meta.failedUnits ?? []).map((f) => f.unitIndex);
    if (failed.length === 0) return;
    const step = sbStage.steps.find((s) => s.index === 2)!;
    setChainBusy(true);
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      await runOne('storyboard', step, ctrl, { onlyUnits: failed, resume: true });
    } catch { /* surfaced */ }
    finally { setChainBusy(false); }
  }

  /** 全量重跑（清空进度） */
  async function rerunAllStoryboard2() {
    if (!sbStage || chainBusy) return;
    const step = sbStage.steps.find((s) => s.index === 2)!;
    setChainBusy(true);
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      await runOne('storyboard', step, ctrl, { resume: false });
    } catch { /* surfaced */ }
    finally { setChainBusy(false); }
  }

  async function runStoryboardFirstFive() {
    if (!sbStage || chainBusy) return;
    const liveSb1 = useProject.getState().artifacts['storyboard.1'];
    if (!liveSb1) return;
    const step = sbStage.steps.find((s) => s.index === 2)!;
    const units = parseStoryboardPlan(liveSb1.content).units.slice(0, 5).map((u) => u.unitIndex);
    if (!units.length) return;
    setChainBusy(true);
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      await runOne('storyboard', step, ctrl, { onlyUnits: units, resume: true });
    } catch { /* surfaced */ }
    finally { setChainBusy(false); }
  }

  async function runStoryboardRemaining() {
    if (!sbStage || chainBusy) return;
    const liveSb1 = useProject.getState().artifacts['storyboard.1'];
    if (!liveSb1) return;
    const step = sbStage.steps.find((s) => s.index === 2)!;
    const units = parseStoryboardPlan(liveSb1.content).units.slice(5).map((u) => u.unitIndex);
    if (!units.length) return;
    setChainBusy(true);
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      await runOne('storyboard', step, ctrl, { onlyUnits: units, resume: true });
    } catch { /* surfaced */ }
    finally { setChainBusy(false); }
  }

  async function runAssetsAll() {
    if (!assetsStage || chainBusy || !sb7) return;
    setChainBusy(true);
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      const stepBy = (i: number) => assetsStage.steps.find((s) => s.index === i)!;
      await runOne('assets', stepBy(1), ctrl);
      await Promise.all([
        runOne('assets', stepBy(2), ctrl).catch(() => {}),
        runOne('assets', stepBy(3), ctrl).catch(() => {}),
        runOne('assets', stepBy(4), ctrl).catch(() => {}),
      ]);
    } finally { setChainBusy(false); }
  }

  async function runStoryboardAll() {
    if (!sbStage || chainBusy) return;
    setChainBusy(true);
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      const stepBy = (i: number) => sbStage.steps.find((s) => s.index === i)!;
      await runOne('storyboard', stepBy(1), ctrl);
      await runOne('storyboard', stepBy(2), ctrl);
    } catch { /* surfaced on the failing node */ }
    finally { setChainBusy(false); }
  }

  /* ── 剧本导入 ────────────────────────────────────────────────── */

  function importScreenplay() {
    const text = (normalizePreview || draft).trim();
    if (text.length < 100) { setDraftErr('剧本过短（< 100 字）'); return; }
    setDraftErr('');
    project.upsertArtifact({
      nodeId: 'screenplay.7',
      stageId: 'screenplay',
      index: 7,
      title: '最终剧本（特殊项目 · 手动导入）',
      content: text,
      format: 'markdown',
      ts: Date.now(),
      tokens: 0,
      cost: 0,
      durationMs: 0,
      meta: {
        manual: true,
        source: normalizePreview ? '快速分镜导入 + AI 修复格式' : '快速分镜导入',
        ...(normalizePreview ? { normalized: true, normalizedFrom: draft } : {}),
        projectType: 'express',
      },
    });
    if (normalizePreview) {
      setDraft(normalizePreview);
      setNormalizePreview('');
    }
  }

  function clearScreenplay() {
    project.clearArtifact('screenplay.7');
    setDraft('');
    setNormalizePreview('');
    setDraftErr('');
  }

  async function handleNormalize() {
    if (!draft.trim()) { setDraftErr('请先粘贴或上传剧本内容'); return; }
    if (!settings.apiKey) { setDraftErr('未配置 API Key（请到「设置」填入）'); return; }
    setDraftErr('');
    setNormalizing(true);
    setNormalizePreview('');
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      const res = await normalizeContent({
        raw: draft,
        config: SCREENPLAY_FINAL_NORMALIZE,
        settings: { baseUrl: settings.baseUrl, apiKey: settings.apiKey, model: settings.model },
        signal: ctrl.signal,
        onDelta: (_, full) => setNormalizePreview(full),
      });
      if (res.rejected) setDraftErr(`AI 拒绝转换：${res.rejectReason ?? '内容不符合预期'}`);
    } catch (e: any) {
      if (!ctrl.signal.aborted) setDraftErr(`修复失败：${e?.message ?? e}`);
    } finally { setNormalizing(false); }
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => setDraft(String(reader.result ?? ''));
    reader.readAsText(f, 'utf-8');
    e.target.value = '';
  }

  /* ── render ──────────────────────────────────────────────────── */

  if (loadErr) {
    return (
      <div className="m-6 card border-warning/40 bg-warning/5 p-4 text-sm">
        <strong className="text-warning flex items-center gap-1.5">
          <AlertTriangle className="size-4" /> 加载 manifest 失败
        </strong>
        <p className="text-fg-secondary mt-1">{loadErr}</p>
      </div>
    );
  }
  if (!manifest) return <div className="p-8 text-fg-muted">加载 manifest…</div>;

  const sb1 = project.artifacts['storyboard.1'];
  const sb2 = project.artifacts['storyboard.2'];
  const assets1 = project.artifacts['assets.1'];

  const setupReady = !!ctx.name && !!ctx.platform && (ctx.genres?.length ?? 0) > 0;
  const importReady = !!sb7;

  /** 清空指定 stage 下所有 step 的产物（带 confirm）。 */
  async function clearStage(stageId: 'screenplay' | 'assets' | 'storyboard', label: string) {
    if (!manifest || chainBusy) return;
    const stage = manifest.stages.find((s) => s.id === stageId);
    if (!stage) return;
    const has = stage.steps.some((st) => !!project.artifacts[st.id]);
    if (!has) return;
    const ok = await confirmDialog({
      title: `清空「${label}」阶段的全部产物？`,
      message: '此操作不可撤销。',
      confirmLabel: '清空',
      danger: true,
    });
    if (!ok) return;
    for (const st of stage.steps) project.clearArtifact(st.id);
  }

  /** 清空整个项目的所有产物 + 重置进度（带二次 confirm）。 */
  async function clearAll() {
    if (chainBusy) return;
    const count = Object.keys(project.artifacts).length;
    if (count === 0) return;
    const ok = await confirmDialog({
      title: `清空全部 ${count} 个产物？`,
      message: '项目设定（题材 / 时长等）保留 · 但所有 LLM 生成内容会被删除。此操作不可撤销。',
      confirmLabel: '清空全部',
      danger: true,
    });
    if (!ok) return;
    project.resetAll();
  }

  return (
    <div className="h-full flex flex-col">
      {/*
       * Mode-shared progress banner. Express has 5 logical milestones:
       *   ① 项目设定  ② 剧本导入  ③ 资产  ④ 分镜规划  ⑤ 分镜单元
       * Each is binary (1/1 or 0/1) except 资产, where we count any
       * `assets.*` artifact (typically roles/scenes/props → up to 3).
       */}
      <ProgressBanner
        segments={(() => {
          const assetsKeys = Object.keys(project.artifacts).filter((k) => k.startsWith('assets.') && k !== 'assets.intake');
          const segs: ProgressSegment[] = [
            { key: 'setup',   label: '项目设定', total: 1, done: setupReady ? 1 : 0 },
            { key: 'import',  label: '剧本导入', total: 1, done: importReady ? 1 : 0 },
            { key: 'assets',  label: '资产',     total: 3, done: Math.min(3, assetsKeys.length) },
            { key: 'sb1',     label: '分镜规划', total: 1, done: sb1 ? 1 : 0 },
            { key: 'sb2',     label: '分镜单元', total: 1, done: sb2 ? 1 : 0 },
          ];
          return segs;
        })()}
        title="快速分镜"
        subtitle="带剧本进 · 选时长 + 风格 · 一键出资产 + 分镜双区 prompt"
        actions={
          <>
            {chainBusy && (
              <button className="btn-outline" onClick={stop}><Square className="size-4" /> 停止</button>
            )}
            <button
              className="btn-ghost text-xs text-danger/80 hover:text-danger"
              onClick={clearAll}
              disabled={chainBusy || Object.keys(project.artifacts).length === 0}
              title="清空所有 LLM 产物（项目设定保留）"
            >
              <Trash2 className="size-3.5" /> 清空全部
            </button>
            <Link to="/pipeline" className="btn-ghost text-xs">流水线总览 →</Link>
          </>
        }
      />

      <main className="flex-1 overflow-auto p-6 space-y-5 max-w-5xl mx-auto w-full">
        {/* ① 项目设定 */}
        <Section
          step={1}
          title="项目设定"
          subtitle="名称 / 时长 / 风格 / 平台"
          ready={setupReady}
        >
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">项目名</label>
              <Input
                value={ctx.name}
                onChange={(e) => project.setCtx({ name: e.target.value })}
                placeholder="如：山门杀机·特别篇"
              />
            </div>
            <div>
              <label className="label">主角性别</label>
              <ChoiceRow
                value={ctx.protagonistGender}
                options={PROTAGONISTS.map((p) => ({ value: p.value, label: p.label, hint: p.hint }))}
                onChange={(v) => project.setCtx({ protagonistGender: v as any })}
              />
            </div>
          </div>
          <div>
            <label className="label">目标时长</label>
            <div className="flex flex-wrap items-center gap-2">
              <ChoiceRow
                value={String(ctx.durationMin ?? '')}
                options={DURATIONS.map((d) => ({ value: String(d.value), label: d.label, hint: d.hint }))}
                onChange={(v) => project.setCtx({ durationMin: parseFloat(v) })}
              />
              <div className="inline-flex items-center gap-1">
                <input
                  type="number"
                  min={6}
                  max={14400}
                  step={1}
                  value={ctx.durationMin ? Math.round(ctx.durationMin * 60) : ''}
                  onChange={(e) => {
                    const sec = parseFloat(e.target.value);
                    if (Number.isFinite(sec) && sec >= 6 && sec <= 14400) {
                      project.setCtx({ durationMin: sec / 60 });
                    }
                  }}
                  className="w-20 bg-surface border border-border-subtle rounded-md px-2 py-1 text-xs focus:outline-none focus:border-primary-300 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  placeholder="自定义"
                  aria-label="自定义时长 (秒)"
                  title="任意秒数 · 6 - 14400 (= 0.1 分钟至 4 小时)"
                />
                <span className="text-tight-xs text-fg-muted">秒</span>
              </div>
            </div>
          </div>
          <div>
            <label className="label">目标平台</label>
            <ChoiceRow
              value={ctx.platform}
              options={PLATFORMS.map((p) => ({ value: p.value, label: p.label, hint: p.hint }))}
              onChange={(v) => project.setCtx({ platform: v })}
            />
          </div>
          <div>
            <label className="label">题材（多选 1-3）</label>
            <div className="flex flex-wrap gap-1.5">
              {GENRES.map((g) => {
                const active = (ctx.genres ?? []).includes(g.value);
                return (
                  <button
                    key={g.value}
                    type="button"
                    className={clsx(
                      'text-tight-sm px-2 py-1 rounded border transition',
                      active
                        ? 'border-brand-500 bg-primary-500/15 text-primary-300'
                        : 'border-border-subtle text-fg-secondary hover:border-neutral-600',
                    )}
                    onClick={() => {
                      const cur = ctx.genres ?? [];
                      if (active) project.setCtx({ genres: cur.filter((x) => x !== g.value) });
                      else if (cur.length < 3) project.setCtx({ genres: [...cur, g.value] });
                    }}
                    title={g.hint}
                  >
                    {g.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <label className="label flex items-center gap-1.5">
              <Wand2 className="size-3.5 text-violet-400" /> 视觉风格
            </label>
            <ChoiceRow
              value={ctx.visualStyle}
              options={VISUAL_STYLES.map((v) => ({ value: v.value, label: v.label, hint: v.hint }))}
              onChange={(v) => project.setCtx({ visualStyle: v })}
            />
          </div>
          <div>
            <label className="label">核心冲突 / 一句话设定（可选）</label>
            <Input
              value={ctx.coreConflict ?? ''}
              onChange={(e) => project.setCtx({ coreConflict: e.target.value })}
              placeholder="如：女修真者被宗门构陷，绝地反杀揭穿背叛"
            />
          </div>
          <div className="text-tight-sm text-fg-muted mt-2 p-2 bg-surface/50 rounded border border-border-subtle">
            <span className="text-fg-secondary">派生概念（注入到 prompt {'{concept}'}）：</span>
            <div className="font-mono mt-0.5 text-fg-secondary break-all">{ctx.concept || '(未生成)'}</div>
          </div>
        </Section>

        {/* ② 导入剧本 */}
        <Section
          step={2}
          title="导入剧本"
          subtitle="粘贴 / 上传 markdown 剧本，可选 AI 修复格式"
          ready={importReady}
          locked={!setupReady}
          headerActions={importReady && (
            <button
              className="btn-ghost text-tight-sm text-fg-muted hover:text-danger"
              onClick={async () => {
                const ok = await confirmDialog({
                  title: '清空已导入剧本？',
                  confirmLabel: '清空',
                  danger: true,
                });
                if (ok) clearScreenplay();
              }}
              disabled={chainBusy}
              title="清空已导入剧本"
            >
              <Trash2 className="size-3" /> 清空
            </button>
          )}
        >
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              <button
                className="btn-outline text-xs"
                onClick={() => fileInputRef.current?.click()}
                disabled={normalizing}
              >
                <Upload className="size-3.5" /> 上传 .md / .txt
              </button>
              <input
                type="file"
                accept=".md,.txt,text/markdown,text/plain"
                ref={fileInputRef}
                onChange={onFileChange}
                className="hidden"
              />
              <button
                className="text-tight-sm px-2 py-1 rounded border border-violet-500/40 text-violet-300 hover:bg-violet-500/10 inline-flex items-center gap-1 disabled:opacity-40"
                onClick={handleNormalize}
                disabled={!draft.trim() || normalizing}
                title="把粘贴内容转换为剧本格式"
              >
                {normalizing ? <Loader2 className="size-3 animate-spin" /> : <Sparkles className="size-3" />}
                AI 修复格式
              </button>
            </div>
            <span className="text-tight-xs text-fg-muted">{draft.length.toLocaleString()} 字</span>
          </div>
          <Textarea
            rows={10}
            className="text-xs font-mono"
            error={!!draftErr}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="粘贴 markdown 剧本（含场次、对白、动作）；非剧本文本可点 ✨ 转换…"
            disabled={normalizing}
          />
          {draftErr && (
            <div className="text-tight-sm text-danger mt-1 flex items-center gap-1">
              <AlertTriangle className="size-3" /> {draftErr}
            </div>
          )}

          {(normalizing || normalizePreview) && (
            <div className="mt-2 border border-violet-500/30 bg-violet-500/5 rounded-md overflow-hidden">
              <div className="px-3 py-2 border-b border-violet-500/20 flex items-center justify-between">
                <div className="text-tight-sm text-violet-300 inline-flex items-center gap-1.5">
                  {normalizing
                    ? (<><Loader2 className="size-3 animate-spin" /> AI 正在修复格式…</>)
                    : (<><Sparkles className="size-3" /> 修复完成预览 · {normalizePreview.length.toLocaleString()} 字</>)}
                </div>
                {!normalizing && (
                  <button
                    className="text-tight-xs px-2 py-0.5 rounded border border-border-default text-fg-secondary hover:bg-elevated"
                    onClick={() => setNormalizePreview('')}
                  >
                    丢弃修复结果
                  </button>
                )}
              </div>
              <pre className="px-3 py-2 text-tight-sm font-mono text-fg-primary whitespace-pre-wrap break-words max-h-72 overflow-auto">
                {normalizePreview || '…'}
              </pre>
            </div>
          )}

          {/* 剧本医生质检面板（可选；与 AI 修复格式并列，独立调用 LLM） */}
          {(normalizePreview || draft).trim().length >= 100 && (
            <ScreenplayDoctorPanel
              script={(normalizePreview || draft).trim()}
              disabled={normalizing}
              onAcceptRewrite={(rewritten) => {
                // 医生改写产物覆盖到 draft；如有 normalizePreview 则同步清掉以避免冲突
                setDraft(rewritten);
                setNormalizePreview('');
                setDraftErr('');
              }}
            />
          )}

          <div className="mt-3 flex items-center gap-2">
            <button
              className="btn-primary"
              onClick={importScreenplay}
              disabled={normalizing || (!draft.trim() && !normalizePreview)}
            >
              <FileText className="size-4" />
              {sb7 ? '覆盖写入 screenplay.7' : '确认导入剧本'}
            </button>
            {sb7 && (
              <button className="btn-ghost text-xs" onClick={clearScreenplay} disabled={chainBusy}>
                清除已导入剧本
              </button>
            )}
            {sb7 && (
              <span className="text-tight-sm text-success inline-flex items-center gap-1">
                <CheckCircle2 className="size-3.5" /> 已写入 screenplay.7（{sb7.content.length.toLocaleString()} 字）
              </span>
            )}
          </div>
        </Section>

        {/* ③ 抽取资产 */}
        <Section
          step={3}
          title="抽取资产"
          subtitle="角色 / 场景 / 道具 一致性卡片"
          ready={!!project.artifacts['assets.4']}
          locked={!importReady}
          headerActions={(
            <button
              className="btn-ghost text-tight-sm text-fg-muted hover:text-danger"
              onClick={() => clearStage('assets', '资产')}
              disabled={chainBusy || !assetsStage?.steps.some((st) => !!project.artifacts[st.id])}
              title="清空本阶段所有产物"
            >
              <Trash2 className="size-3" /> 清阶段
            </button>
          )}
        >
          <div className="flex items-center justify-between mb-2">
            <p className="text-tight-sm text-fg-muted">先扫描清单，再并行展开角色/场景/道具卡片。</p>
            <button
              className="btn-primary text-xs"
              onClick={runAssetsAll}
              disabled={chainBusy || !importReady}
            >
              <Play className="size-3.5" /> 一键运行 4 步
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {assetsStage?.steps.map((step) => {
              const art = project.artifacts[step.id];
              const rs = runStates[step.id] ?? { status: 'idle', streamed: '' };
              return (
                <NodeCard
                  key={step.id}
                  step={step}
                  artifact={art}
                  runState={rs}
                  busy={chainBusy}
                  onRun={() => runOne('assets', step).catch(() => {})}
                  onClear={() => project.clearArtifact(step.id)}
                  disabled={!importReady}
                />
              );
            })}
          </div>
          {assets1 && (
            <div className="text-tight-sm text-fg-muted mt-2">
              扫描出 <code className="text-fg-secondary">{(assets1.content.match(/[\n,]/g)?.length ?? 0)}</code> 条候选项
            </div>
          )}
        </Section>

        {/* ④ 生成分镜 */}
        <Section
          step={4}
          title="生成分镜"
          subtitle="B 表 12-15s 重切 → 四步法单元规划 → COPY/NOTE 双区 Seedance prompt"
          ready={!!sb2}
          locked={!importReady}
          headerActions={(
            <button
              className="btn-ghost text-tight-sm text-fg-muted hover:text-danger"
              onClick={() => clearStage('storyboard', '分镜')}
              disabled={chainBusy || (!sb1 && !sb2)}
              title="清空本阶段所有产物"
            >
              <Trash2 className="size-3" /> 清阶段
            </button>
          )}
        >
          <div className="flex items-center justify-between mb-2">
            <p className="text-tight-sm text-fg-muted">
              storyboard.2 会读取 storyboard.1 的 <code>&lt;plan-json&gt;</code> 块逐单元生成；卡片可单独复制 <code>COPY 区</code>
            </p>
            <div className="flex items-center gap-1.5">
              {storyboardPlanUnitCount > 5 && (
                <>
                  <button
                    className="btn-outline text-xs"
                    onClick={runStoryboardFirstFive}
                    disabled={chainBusy || !importReady || !sb1}
                    title="按当前 storyboard.1 计划，只生成 UNIT 1-5"
                  >
                    <Play className="size-3.5" /> 前 5 单元
                  </button>
                  <button
                    className="btn-outline text-xs"
                    onClick={runStoryboardRemaining}
                    disabled={chainBusy || !importReady || !sb1}
                    title="按当前 storyboard.1 计划，生成 UNIT 6 及之后"
                  >
                    <ChevronRight className="size-3.5" /> 继续剩余
                  </button>
                </>
              )}
              <button
                className="btn-primary text-xs"
                onClick={runStoryboardAll}
                disabled={chainBusy || !importReady}
              >
                <Play className="size-3.5" /> 一键运行 2 步
              </button>
            </div>
          </div>
          {sb1 && (
            <StoryboardPlanDiagnostics
              artifact={sb1}
              targetDurationSec={ctx.durationMin ? Math.round(ctx.durationMin * 60) : undefined}
            />
          )}
          {sb1 && settings.enableSelfCheck && (
            <SelfCheckPanel
              artifact={sb1}
              settings={settings}
              report={(sb1.meta as any)?.selfCheck as SelfCheckReport | undefined}
              onReportUpdate={(report) => {
                const next = { ...sb1, meta: { ...(sb1.meta ?? {}), selfCheck: report ?? undefined } };
                project.upsertArtifact(next);
              }}
              onArtifactPatch={(content) => {
                project.upsertArtifact({ ...sb1, content });
              }}
            />
          )}
          {sb2 && (
            <Phase2ProgressPanel
              artifact={sb2}
              busy={chainBusy}
              onRetryFailed={retryFailedUnits}
              onRerunAll={rerunAllStoryboard2}
            />
          )}
          {sb2 && settings.enableSelfCheck && (
            <SelfCheckPanel
              artifact={sb2}
              settings={settings}
              contextArtifacts={project.artifacts}
              report={(sb2.meta as any)?.selfCheck as SelfCheckReport | undefined}
              onReportUpdate={(report) => {
                const next = { ...sb2, meta: { ...(sb2.meta ?? {}), selfCheck: report ?? undefined } };
                project.upsertArtifact(next);
              }}
              onArtifactPatch={(content) => {
                project.upsertArtifact({ ...sb2, content });
              }}
            />
          )}
          {sb2 && (
            <ConsistencyPanel artifacts={project.artifacts} />
          )}
          <div className="space-y-2">
            {sbStage?.steps.map((step) => {
              const art = project.artifacts[step.id];
              const rs = runStates[step.id] ?? { status: 'idle', streamed: '' };
              return (
                <NodeCard
                  key={step.id}
                  step={step}
                  artifact={art}
                  runState={rs}
                  busy={chainBusy}
                  onRun={() => runOne('storyboard', step).catch(() => {})}
                  onClear={() => project.clearArtifact(step.id)}
                  disabled={!importReady || (step.index === 2 && !sb1)}
                  wide
                />
              );
            })}
          </div>
        </Section>

        {/* 导出 */}
        {sb2 && (
          <div className="card p-4 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold flex items-center gap-1.5">
                <CheckCircle2 className="size-4 text-success" /> 全流程已完成
              </h3>
              <p className="text-tight-sm text-fg-muted mt-0.5">
                可在「资产工作台」/「常规流水线」中进一步编辑与导出。
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Link to="/assets" className="btn-outline text-xs">
                <Box className="size-3.5" /> 资产工作台
              </Link>
              <Link to="/pipeline" className="btn-outline text-xs">
                <Film className="size-3.5" /> 常规流水线
              </Link>
              <button
                className="btn-primary text-xs"
                onClick={() => downloadText(`${ctx.name || 'storyboard'}.md`, sb2.content)}
              >
                <Download className="size-3.5" /> 导出分镜 .md
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

/* ── 子组件 ───────────────────────────────────────────────────── */

function Section(p: {
  step: number;
  title: string;
  subtitle?: string;
  ready?: boolean;
  locked?: boolean;
  headerActions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section
      className={clsx(
        'card p-4 transition',
        p.locked && 'opacity-50 pointer-events-none',
      )}
    >
      <header className="flex items-center justify-between mb-3 gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <span
            className={clsx(
              'inline-flex items-center justify-center size-6 rounded-full text-tight-sm font-semibold border shrink-0',
              p.ready
                ? 'bg-success/20 text-success border-success/40'
                : 'bg-elevated text-fg-secondary border-border-default',
            )}
          >
            {p.ready ? <CheckCircle2 className="size-3.5" /> : p.step}
          </span>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold truncate">{p.title}</h2>
            {p.subtitle && <p className="text-tight-sm text-fg-muted truncate">{p.subtitle}</p>}
          </div>
        </div>
        {p.headerActions && <div className="flex items-center gap-1.5 shrink-0">{p.headerActions}</div>}
      </header>
      <div className="space-y-3">{p.children}</div>
    </section>
  );
}

function ChoiceRow(p: {
  value?: string;
  options: { value: string; label: string; hint?: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {p.options.map((opt) => {
        const active = p.value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            title={opt.hint}
            className={clsx(
              'text-tight-sm px-2.5 py-1 rounded border transition',
              active
                ? 'border-brand-500 bg-primary-500/15 text-primary-300'
                : 'border-border-subtle text-fg-secondary hover:border-neutral-600',
            )}
            onClick={() => p.onChange(opt.value)}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function NodeCard(p: {
  step: ManifestStep;
  artifact?: NodeArtifact;
  runState: RunState;
  busy: boolean;
  disabled?: boolean;
  wide?: boolean;
  onRun: () => void;
  onClear?: () => void;
}) {
  const status: NodeStatus = p.runState.status === 'idle' && p.artifact ? 'done' : p.runState.status;
  const showStream = p.runState.status === 'running' && p.runState.streamed;
  return (
    <div
      className={clsx(
        'border rounded-md p-3 bg-surface/40 flex flex-col gap-2',
        p.wide ? '' : '',
        status === 'error' ? 'border-danger/40'
        : status === 'done' ? 'border-success/30'
        : status === 'running' ? 'border-violet-500/40'
        : 'border-border-subtle',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <StatusIcon status={status} />
          <div className="min-w-0">
            <div className="text-xs font-medium truncate">{p.step.title}</div>
            <div className="text-tight-xs font-mono text-fg-muted">{p.step.id}</div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {p.artifact && p.onClear && (
            <button
              className="btn-ghost text-tight-sm px-1.5 py-0.5 text-fg-muted hover:text-danger"
              onClick={async () => {
                const ok = await confirmDialog({
                  title: `清空「${p.step.title}」的产物？`,
                  message: `节点 ID: ${p.step.id}`,
                  confirmLabel: '清空',
                  danger: true,
                });
                if (ok) p.onClear?.();
              }}
              disabled={p.busy}
              title="清空本步产物"
            >
              <Trash2 className="size-3" />
            </button>
          )}
          <button
            className="btn-ghost text-tight-sm px-2 py-0.5"
            onClick={p.onRun}
            disabled={p.busy || p.disabled}
          >
            {p.artifact ? <ChevronRight className="size-3" /> : <Play className="size-3" />}
            {p.artifact ? '重跑' : '运行'}
          </button>
        </div>
      </div>
      {p.runState.error && (
        <div className="text-tight-xs text-danger flex items-center gap-1">
          <AlertTriangle className="size-3" /> {p.runState.error}
        </div>
      )}
      {/* 流式中：保持原 <pre> 实时增长视图 */}
      {showStream && (
        <pre className="text-tight-xs font-mono text-fg-secondary whitespace-pre-wrap break-words max-h-40 overflow-auto bg-canvas/60 rounded px-2 py-1.5 border border-border-subtle">
          {p.runState.streamed}
        </pre>
      )}
      {/* 完成：用结构化视图（自动按 ## 标题或 --- 拆分为卡片，每卡片独立复制） */}
      {!showStream && p.artifact && status === 'done' && (
        <ArtifactStructuredView
          content={p.artifact.content}
          nodeId={p.step.id}
          maxBodyHeight={280}
        />
      )}
    </div>
  );
}

/** Phase 2 进度面板：显示已完成 / 失败 / 待生成单元 + 重跑按钮 */
function Phase2ProgressPanel(p: {
  artifact: NodeArtifact;
  busy: boolean;
  onRetryFailed: () => void;
  onRerunAll: () => void;
}) {
  const meta = (p.artifact.meta ?? {}) as {
    phase2Loop?: boolean;
    unitCount?: number;
    completedUnits?: number[];
    failedUnits?: Array<{ unitIndex: number; error: string; retries: number }>;
    cumulativeTokens?: number;
    cumulativeCost?: number;
  };
  if (!meta.phase2Loop) return null;

  const total = meta.unitCount ?? 0;
  const completed = meta.completedUnits ?? [];
  const failed = meta.failedUnits ?? [];
  const completedSet = new Set(completed);
  const failedSet = new Set(failed.map((f) => f.unitIndex));
  const pending = total - completedSet.size - failedSet.size;
  const pct = total > 0 ? Math.round((completedSet.size / total) * 100) : 0;

  return (
    <div className="card p-3 border-border-subtle bg-surface/30 space-y-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="text-xs font-medium flex items-center gap-2">
          <span>逐单元进度</span>
          <span className="font-mono text-fg-muted">{completedSet.size}/{total}</span>
          <span className="text-tight-xs text-fg-muted">{pct}%</span>
        </div>
        <div className="flex items-center gap-1.5">
          {failed.length > 0 && (
            <button
              className="text-tight-sm px-2 py-0.5 rounded border border-danger/40 text-danger hover:bg-danger/10 inline-flex items-center gap-1 disabled:opacity-40"
              onClick={p.onRetryFailed}
              disabled={p.busy}
              title="只跑 failedUnits 中的单元；其他已完成单元保持不变"
            >
              <Play className="size-3" /> 重跑 {failed.length} 个失败单元
            </button>
          )}
          <button
            className="text-tight-sm px-2 py-0.5 rounded border border-border-default text-fg-secondary hover:bg-elevated inline-flex items-center gap-1 disabled:opacity-40"
            onClick={p.onRerunAll}
            disabled={p.busy}
            title="清空 storyboard.2 进度，从 UNIT 1 开始全量重跑"
          >
            <RotateCcw className="size-3" /> 全量重跑
          </button>
        </div>
      </div>
      {/* 进度条：每格一个 unit */}
      <div className="flex gap-0.5 h-2 rounded overflow-hidden bg-elevated">
        {Array.from({ length: total }, (_, i) => {
          const idx = i + 1;
          const isCompleted = completedSet.has(idx);
          const isFailed = failedSet.has(idx);
          return (
            <div
              key={idx}
              className={clsx(
                'flex-1',
                isCompleted ? 'bg-emerald-500'
                : isFailed ? 'bg-rose-500'
                : 'bg-neutral-700',
              )}
              title={`UNIT ${idx} · ${isCompleted ? '✓ 已完成' : isFailed ? '⚠ 失败' : '待生成'}`}
            />
          );
        })}
      </div>
      <div className="flex items-center gap-3 text-tight-xs text-fg-muted">
        <span className="inline-flex items-center gap-1"><span className="inline-block size-2 rounded-sm bg-emerald-500" /> 已完成 {completedSet.size}</span>
        {failed.length > 0 && <span className="inline-flex items-center gap-1 text-danger"><span className="inline-block size-2 rounded-sm bg-rose-500" /> 失败 {failed.length}</span>}
        {pending > 0 && <span className="inline-flex items-center gap-1"><span className="inline-block size-2 rounded-sm bg-neutral-700" /> 待生成 {pending}</span>}
        {meta.cumulativeTokens !== undefined && (
          <span className="ml-auto font-mono">累计 {(meta.cumulativeTokens).toLocaleString()} tok · ${meta.cumulativeCost?.toFixed(4) ?? '0'}</span>
        )}
      </div>
      {failed.length > 0 && (
        <details className="text-tight-sm">
          <summary className="cursor-pointer text-danger">失败详情 · {failed.length}</summary>
          <ul className="mt-1 space-y-0.5 ml-4 text-fg-secondary list-disc">
            {failed.map((f) => (
              <li key={f.unitIndex}>
                <span className="font-mono text-danger">UNIT {f.unitIndex}</span>
                <span className="text-fg-muted ml-1">×{f.retries}</span>
                <span className="text-fg-muted ml-2">{f.error.slice(0, 200)}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function StatusIcon({ status }: { status: NodeStatus }) {
  if (status === 'running') return <Loader2 className="size-3.5 text-violet-400 animate-spin" />;
  if (status === 'done')    return <CheckCircle2 className="size-3.5 text-success" />;
  if (status === 'error')   return <AlertTriangle className="size-3.5 text-danger" />;
  if (status === 'aborted') return <Square className="size-3.5 text-warning" />;
  return <Circle className="size-3.5 text-fg-muted" />;
}

function downloadText(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
