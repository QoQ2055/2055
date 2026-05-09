/**
 * v8 epic · MM5 PR-2 · 4 张连续性表 helpers 行为测试
 *
 * 范围（src/store/continuity/* 模块的 22 helpers）：
 *   - foreshadows: 6 helpers (add/list ×3/update/clear)
 *   - characterArcs: 6 helpers (add/list ×3/find/update/clear)
 *   - worldRules: 6 helpers (add/list ×2/append-violation/update/clear)
 *   - rhythmDiagnostics: 4 helpers (upsert/list ×2/clear)
 *
 * 测试隔离：用生产 db 实例 · 每 it 前清空 4 张表 · 测试间不污染。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../db';
import {
  addForeshadow,
  listForeshadows,
  listForeshadowsByStatus,
  listForeshadowsBySetupChapter,
  updateForeshadow,
  clearProjectForeshadows,
  addCharacterArc,
  listCharacterArc,
  findCharacterArcEpoch,
  listAllCharacterArcs,
  updateCharacterArc,
  clearProjectCharacterArcs,
  addWorldRule,
  listWorldRules,
  listWorldRulesByDomain,
  appendWorldRuleViolation,
  updateWorldRule,
  clearProjectWorldRules,
  upsertRhythmDiagnostic,
  listChapterRhythm,
  listAllRhythm,
  clearProjectRhythm,
} from '../continuity';

beforeEach(async () => {
  await db.foreshadowTable.clear();
  await db.characterArcTable.clear();
  await db.worldContinuityTable.clear();
  await db.rhythmDiagnosticTable.clear();
});

// ─── foreshadows ─────────────────────────────────────────────────────

describe('foreshadows · helpers', () => {
  it('addForeshadow assigns id + createdAt + updatedAt', async () => {
    const id = await addForeshadow({
      projectId: 1,
      title: '神秘信物',
      content: '主角捡到吊坠',
      status: 'planted',
      weight: 'major',
      setupChapter: 1,
    });
    expect(id).toBeGreaterThan(0);
    const row = await db.foreshadowTable.get(id);
    expect(row).toBeDefined();
    expect(row?.createdAt).toBeGreaterThan(0);
    expect(row?.updatedAt).toBe(row?.createdAt);
  });

  it('listForeshadows returns rows sorted by setupChapter ascending', async () => {
    await addForeshadow({
      projectId: 1,
      title: 'A',
      content: 'a',
      status: 'planted',
      weight: 'minor',
      setupChapter: 5,
    });
    await addForeshadow({
      projectId: 1,
      title: 'B',
      content: 'b',
      status: 'planted',
      weight: 'major',
      setupChapter: 2,
    });
    await addForeshadow({
      projectId: 1,
      title: 'C',
      content: 'c',
      status: 'planted',
      weight: 'minor',
      setupChapter: 8,
    });
    const rows = await listForeshadows(1);
    expect(rows.map((r) => r.title)).toEqual(['B', 'A', 'C']);
  });

  it('listForeshadowsByStatus filters by status correctly', async () => {
    await addForeshadow({
      projectId: 1,
      title: '已回收',
      content: '...',
      status: 'resolved',
      weight: 'major',
      setupChapter: 1,
      payoffChapter: 5,
    });
    await addForeshadow({
      projectId: 1,
      title: '断头线',
      content: '...',
      status: 'broken',
      weight: 'critical',
      setupChapter: 2,
    });
    await addForeshadow({
      projectId: 1,
      title: '未回收',
      content: '...',
      status: 'planted',
      weight: 'minor',
      setupChapter: 3,
    });
    const broken = await listForeshadowsByStatus(1, 'broken');
    expect(broken).toHaveLength(1);
    expect(broken[0].title).toBe('断头线');
  });

  it('listForeshadowsBySetupChapter scopes to one chapter', async () => {
    await addForeshadow({
      projectId: 1,
      title: 'X',
      content: 'x',
      status: 'planted',
      weight: 'minor',
      setupChapter: 3,
    });
    await addForeshadow({
      projectId: 1,
      title: 'Y',
      content: 'y',
      status: 'planted',
      weight: 'minor',
      setupChapter: 3,
    });
    await addForeshadow({
      projectId: 1,
      title: 'Z',
      content: 'z',
      status: 'planted',
      weight: 'minor',
      setupChapter: 4,
    });
    const ch3 = await listForeshadowsBySetupChapter(1, 3);
    expect(ch3).toHaveLength(2);
  });

  it('updateForeshadow refreshes updatedAt and applies patch', async () => {
    const id = await addForeshadow({
      projectId: 1,
      title: 't',
      content: 'c',
      status: 'planted',
      weight: 'minor',
      setupChapter: 1,
    });
    const before = await db.foreshadowTable.get(id);
    await new Promise((r) => setTimeout(r, 5));
    await updateForeshadow(id, { status: 'resolved', payoffChapter: 7, payoffNote: '主角识破真相' });
    const after = await db.foreshadowTable.get(id);
    expect(after?.status).toBe('resolved');
    expect(after?.payoffChapter).toBe(7);
    expect(after?.payoffNote).toBe('主角识破真相');
    expect(after?.updatedAt).toBeGreaterThan(before!.updatedAt);
    expect(after?.createdAt).toBe(before?.createdAt); // createdAt 不变
  });

  it('clearProjectForeshadows scopes deletion to projectId', async () => {
    await addForeshadow({
      projectId: 1,
      title: 'p1',
      content: '',
      status: 'planted',
      weight: 'minor',
      setupChapter: 1,
    });
    await addForeshadow({
      projectId: 2,
      title: 'p2',
      content: '',
      status: 'planted',
      weight: 'minor',
      setupChapter: 1,
    });
    await clearProjectForeshadows(1);
    expect(await db.foreshadowTable.count()).toBe(1);
    const remain = await db.foreshadowTable.toArray();
    expect(remain[0].projectId).toBe(2);
  });
});

// ─── characterArcs ───────────────────────────────────────────────────

describe('characterArcs · helpers', () => {
  it('addCharacterArc + listCharacterArc returns chapter-sorted timeline', async () => {
    await addCharacterArc({
      projectId: 1,
      characterName: '林夏',
      epoch: 'climax',
      chapter: 18,
      state: '觉醒',
    });
    await addCharacterArc({
      projectId: 1,
      characterName: '林夏',
      epoch: 'opening',
      chapter: 1,
      state: '懵懂少女',
    });
    await addCharacterArc({
      projectId: 1,
      characterName: '林夏',
      epoch: 'midpoint',
      chapter: 10,
      state: '心生疑虑',
    });
    const timeline = await listCharacterArc(1, '林夏');
    expect(timeline.map((r) => r.epoch)).toEqual(['opening', 'midpoint', 'climax']);
  });

  it('findCharacterArcEpoch returns latest when duplicates exist', async () => {
    await addCharacterArc({
      projectId: 1,
      characterName: '陈墨',
      epoch: 'opening',
      chapter: 1,
      state: '旧版',
    });
    await new Promise((r) => setTimeout(r, 5));
    await addCharacterArc({
      projectId: 1,
      characterName: '陈墨',
      epoch: 'opening',
      chapter: 1,
      state: '修订版',
    });
    const found = await findCharacterArcEpoch(1, '陈墨', 'opening');
    expect(found?.state).toBe('修订版');
  });

  it('findCharacterArcEpoch returns undefined when missing', async () => {
    const found = await findCharacterArcEpoch(99, 'nobody', 'climax');
    expect(found).toBeUndefined();
  });

  it('listAllCharacterArcs sorts by characterName then chapter', async () => {
    await addCharacterArc({
      projectId: 1,
      characterName: '陈墨',
      epoch: 'climax',
      chapter: 18,
      state: '...',
    });
    await addCharacterArc({
      projectId: 1,
      characterName: '林夏',
      epoch: 'opening',
      chapter: 1,
      state: '...',
    });
    await addCharacterArc({
      projectId: 1,
      characterName: '陈墨',
      epoch: 'opening',
      chapter: 1,
      state: '...',
    });
    const all = await listAllCharacterArcs(1);
    // localeCompare 默认按 zh 拼音排序：'陈'(chen) < '林'(lin) · 非 Unicode codepoint。
    expect(all.map((r) => `${r.characterName}/${r.chapter}`)).toEqual([
      '陈墨/1',
      '陈墨/18',
      '林夏/1',
    ]);
  });

  it('updateCharacterArc refreshes updatedAt', async () => {
    const id = await addCharacterArc({
      projectId: 1,
      characterName: '甲',
      epoch: 'opening',
      chapter: 1,
      state: '初版',
    });
    const before = await db.characterArcTable.get(id);
    await new Promise((r) => setTimeout(r, 5));
    await updateCharacterArc(id, { state: '改版', driver: '新事件' });
    const after = await db.characterArcTable.get(id);
    expect(after?.state).toBe('改版');
    expect(after?.driver).toBe('新事件');
    expect(after?.updatedAt).toBeGreaterThan(before!.updatedAt);
  });

  it('clearProjectCharacterArcs scopes by projectId', async () => {
    await addCharacterArc({
      projectId: 1,
      characterName: 'a',
      epoch: 'o',
      chapter: 1,
      state: 's',
    });
    await addCharacterArc({
      projectId: 2,
      characterName: 'b',
      epoch: 'o',
      chapter: 1,
      state: 's',
    });
    await clearProjectCharacterArcs(1);
    expect(await db.characterArcTable.count()).toBe(1);
  });
});

// ─── worldRules ──────────────────────────────────────────────────────

describe('worldRules · helpers', () => {
  it('addWorldRule defaults violations to empty array', async () => {
    const id = await addWorldRule({
      projectId: 1,
      domain: 'magic-system',
      rule: '咒语必须以梵语吟诵',
      severity: 'hard',
      chapter: 2,
    });
    const row = await db.worldContinuityTable.get(id);
    expect(row?.violations).toEqual([]);
  });

  it('listWorldRulesByDomain filters by domain', async () => {
    await addWorldRule({
      projectId: 1,
      domain: 'magic-system',
      rule: 'r1',
      severity: 'hard',
      chapter: 1,
    });
    await addWorldRule({
      projectId: 1,
      domain: 'magic-system',
      rule: 'r2',
      severity: 'soft',
      chapter: 5,
    });
    await addWorldRule({
      projectId: 1,
      domain: 'tech-level',
      rule: 'r3',
      severity: 'hard',
      chapter: 1,
    });
    const magic = await listWorldRulesByDomain(1, 'magic-system');
    expect(magic).toHaveLength(2);
    expect(magic[0].chapter).toBe(1);
    expect(magic[1].chapter).toBe(5);
  });

  it('appendWorldRuleViolation accumulates violations (add-only · order preserved)', async () => {
    const id = await addWorldRule({
      projectId: 1,
      domain: 'd',
      rule: 'r',
      severity: 'hard',
      chapter: 1,
    });
    await appendWorldRuleViolation(id, '第 5 章违规：用英语咒语');
    await appendWorldRuleViolation(id, '第 12 章违规：施法没消耗 mana');
    const row = await db.worldContinuityTable.get(id);
    expect(row?.violations).toEqual([
      '第 5 章违规：用英语咒语',
      '第 12 章违规：施法没消耗 mana',
    ]);
  });

  it('appendWorldRuleViolation no-op on missing id (graceful)', async () => {
    await appendWorldRuleViolation(9999, 'x');
    // 不抛 · 不改任何记录
    expect(await db.worldContinuityTable.count()).toBe(0);
  });

  it('updateWorldRule applies patch + bumps updatedAt', async () => {
    const id = await addWorldRule({
      projectId: 1,
      domain: 'd',
      rule: 'old',
      severity: 'soft',
      chapter: 1,
    });
    const before = await db.worldContinuityTable.get(id);
    await new Promise((r) => setTimeout(r, 5));
    await updateWorldRule(id, { rule: 'new', severity: 'hard' });
    const after = await db.worldContinuityTable.get(id);
    expect(after?.rule).toBe('new');
    expect(after?.severity).toBe('hard');
    expect(after?.updatedAt).toBeGreaterThan(before!.updatedAt);
  });

  it('listWorldRules sorts by domain then chapter', async () => {
    await addWorldRule({
      projectId: 1,
      domain: 'tech',
      rule: 'a',
      severity: 'hard',
      chapter: 5,
    });
    await addWorldRule({
      projectId: 1,
      domain: 'magic',
      rule: 'b',
      severity: 'hard',
      chapter: 1,
    });
    await addWorldRule({
      projectId: 1,
      domain: 'magic',
      rule: 'c',
      severity: 'hard',
      chapter: 3,
    });
    const all = await listWorldRules(1);
    expect(all.map((r) => `${r.domain}/${r.chapter}`)).toEqual([
      'magic/1',
      'magic/3',
      'tech/5',
    ]);
  });
});

// ─── rhythmDiagnostics ───────────────────────────────────────────────

describe('rhythmDiagnostics · helpers', () => {
  it('upsertRhythmDiagnostic inserts new + updates existing on (chapter, sceneIdx)', async () => {
    const id1 = await upsertRhythmDiagnostic({
      projectId: 1,
      chapter: 1,
      sceneIdx: 0,
      tension: 5,
      emotion: 0,
    });
    expect(id1).toBeGreaterThan(0);

    // 同 (projectId, chapter, sceneIdx) 再 upsert · 应更新 · 不新增
    const id2 = await upsertRhythmDiagnostic({
      projectId: 1,
      chapter: 1,
      sceneIdx: 0,
      tension: 8,
      emotion: -2,
      warnings: ['张力骤升'],
    });
    expect(id2).toBe(id1);
    expect(await db.rhythmDiagnosticTable.count()).toBe(1);
    const row = await db.rhythmDiagnosticTable.get(id1);
    expect(row?.tension).toBe(8);
    expect(row?.emotion).toBe(-2);
    expect(row?.warnings).toEqual(['张力骤升']);
  });

  it('listChapterRhythm sorts by sceneIdx', async () => {
    await upsertRhythmDiagnostic({
      projectId: 1,
      chapter: 3,
      sceneIdx: 2,
      tension: 5,
      emotion: 0,
    });
    await upsertRhythmDiagnostic({
      projectId: 1,
      chapter: 3,
      sceneIdx: 0,
      tension: 3,
      emotion: 1,
    });
    await upsertRhythmDiagnostic({
      projectId: 1,
      chapter: 3,
      sceneIdx: 1,
      tension: 6,
      emotion: -1,
    });
    const ch3 = await listChapterRhythm(1, 3);
    expect(ch3.map((r) => r.sceneIdx)).toEqual([0, 1, 2]);
  });

  it('listAllRhythm sorts by chapter then sceneIdx', async () => {
    await upsertRhythmDiagnostic({
      projectId: 1,
      chapter: 2,
      sceneIdx: 1,
      tension: 5,
      emotion: 0,
    });
    await upsertRhythmDiagnostic({
      projectId: 1,
      chapter: 1,
      sceneIdx: 0,
      tension: 3,
      emotion: 0,
    });
    await upsertRhythmDiagnostic({
      projectId: 1,
      chapter: 2,
      sceneIdx: 0,
      tension: 4,
      emotion: 0,
    });
    const all = await listAllRhythm(1);
    expect(all.map((r) => `${r.chapter}/${r.sceneIdx}`)).toEqual([
      '1/0',
      '2/0',
      '2/1',
    ]);
  });

  it('clearProjectRhythm scopes by projectId', async () => {
    await upsertRhythmDiagnostic({
      projectId: 1,
      chapter: 1,
      sceneIdx: 0,
      tension: 5,
      emotion: 0,
    });
    await upsertRhythmDiagnostic({
      projectId: 2,
      chapter: 1,
      sceneIdx: 0,
      tension: 5,
      emotion: 0,
    });
    await clearProjectRhythm(1);
    expect(await db.rhythmDiagnosticTable.count()).toBe(1);
  });
});
