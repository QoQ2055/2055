/**
 * v8 epic · MM5 PR-2 · dexie v7 → v8 升级零丢失测试
 *
 * 目标（stage0 §3 #1 · §4 风险表 #3）：
 *   - 验证 v7 旧用户数据库升级到 v8 后 · v1-v7 全部 stores 数据 100% 可读
 *   - 验证 v8 新增 4 张连续性表存在且为空（不污染旧项目）
 *   - 验证升级后旧表/新表 CRUD 互不干扰
 *
 * 测试隔离策略：
 *   - 用独立 dbName 'FLIL-mig-test' 与生产 db ('FLIL') 隔离
 *   - 显式定义 V7-only Dexie 类 · 不动 src/store/db.ts
 *   - vitest 文件级 isolate=true · fake-indexeddb 每 worker 独立 IDBFactory
 */
import { describe, it, expect, beforeEach } from 'vitest';
import Dexie, { type Table } from 'dexie';

const DB_NAME = 'FLIL-mig-test';

/**
 * v7 schema · 完整复制 src/store/db.ts 的 v1-v7 stores 字符串。
 * 此类仅用于本测试 · 模拟旧用户的数据库状态。
 */
class V7DB extends Dexie {
  projects!: Table<{ id?: number; name: string; concept: string; durationMin: number; mode: string; createdAt: number; updatedAt: number; status: string }, number>;
  reflectorLessons!: Table<{ id?: number; projectId: number; chapterIndex: number; signalType: string; lessonContent: string; suggestedModule: string | null; status: string; committedTo: string | null; reviewNote: string | null; ts: number; signalContext: Record<string, unknown> }, number>;
  characterStates!: Table<{ id?: number; projectId: number; chapterIndex: number; characterName: string; ts: number; stale: number }, number>;

  constructor() {
    super(DB_NAME);
    this.version(1).stores({
      projects: '++id, name, createdAt, status',
      artifacts: '++id, projectId, nodeId, ts, [projectId+nodeId]',
    });
    this.version(2).stores({
      projects: '++id, name, createdAt, status',
      artifacts: '++id, projectId, nodeId, ts, [projectId+nodeId]',
      liveArtifacts: '&nodeId, stageId, ts',
      runHistory: '++id, nodeId, ts, projectId, [projectId+nodeId], [nodeId+ts]',
    });
    this.version(3).stores({
      projects: '++id, name, createdAt, status',
      artifacts: '++id, projectId, nodeId, ts, [projectId+nodeId]',
      liveArtifacts: '&nodeId, stageId, ts',
      runHistory: '++id, nodeId, ts, projectId, [projectId+nodeId], [nodeId+ts]',
      userKbDocs: '++id, type, enabled, createdAt, [type+enabled]',
      userKbFeedback: '++id, projectId, chapterIndex, createdAt, [projectId+chapterIndex]',
    });
    this.version(4).stores({
      projects: '++id, name, createdAt, status',
      artifacts: '++id, projectId, nodeId, ts, [projectId+nodeId]',
      liveArtifacts: '&nodeId, stageId, ts',
      runHistory: '++id, nodeId, ts, projectId, [projectId+nodeId], [nodeId+ts]',
      userKbDocs: '++id, type, enabled, createdAt, [type+enabled]',
      userKbFeedback: '++id, projectId, chapterIndex, createdAt, [projectId+chapterIndex]',
      liveRefinementUndo: '++id, ts, [chapterIndex+source]',
    });
    this.version(5).stores({
      projects: '++id, name, createdAt, status',
      artifacts: '++id, projectId, nodeId, ts, [projectId+nodeId]',
      liveArtifacts: '&nodeId, stageId, ts',
      runHistory: '++id, nodeId, ts, projectId, [projectId+nodeId], [nodeId+ts]',
      userKbDocs: '++id, type, enabled, createdAt, [type+enabled]',
      userKbFeedback: '++id, projectId, chapterIndex, createdAt, [projectId+chapterIndex]',
      liveRefinementUndo: '++id, ts, [chapterIndex+source]',
      characterStates: '++id, projectId, chapterIndex, characterName, ts, stale, [projectId+chapterIndex], [projectId+characterName], [projectId+chapterIndex+characterName]',
    });
    this.version(6).stores({
      projects: '++id, name, createdAt, status',
      artifacts: '++id, projectId, nodeId, ts, [projectId+nodeId]',
      liveArtifacts: '&nodeId, stageId, ts',
      runHistory: '++id, nodeId, ts, projectId, [projectId+nodeId], [nodeId+ts]',
      userKbDocs: '++id, type, enabled, createdAt, [type+enabled]',
      userKbFeedback: '++id, projectId, chapterIndex, createdAt, [projectId+chapterIndex]',
      liveRefinementUndo: '++id, ts, [chapterIndex+source]',
      characterStates: '++id, projectId, chapterIndex, characterName, ts, stale, [projectId+chapterIndex], [projectId+characterName], [projectId+chapterIndex+characterName]',
    });
    this.version(7).stores({
      projects: '++id, name, createdAt, status',
      artifacts: '++id, projectId, nodeId, ts, [projectId+nodeId]',
      liveArtifacts: '&nodeId, stageId, ts',
      runHistory: '++id, nodeId, ts, projectId, [projectId+nodeId], [nodeId+ts]',
      userKbDocs: '++id, type, enabled, createdAt, [type+enabled]',
      userKbFeedback: '++id, projectId, chapterIndex, createdAt, [projectId+chapterIndex]',
      liveRefinementUndo: '++id, ts, [chapterIndex+source]',
      characterStates: '++id, projectId, chapterIndex, characterName, ts, stale, [projectId+chapterIndex], [projectId+characterName], [projectId+chapterIndex+characterName]',
      reflectorLessons: '++id, projectId, chapterIndex, signalType, status, ts, [projectId+status], [projectId+chapterIndex]',
    });
  }
}

/**
 * v8 schema · 在 V7 基础上追加 4 张连续性表（与 src/store/db.ts v8 stores 一致）。
 * 用于测试升级路径。
 */
class V8DB extends Dexie {
  projects!: Table<{ id?: number; name: string; concept: string; durationMin: number; mode: string; createdAt: number; updatedAt: number; status: string }, number>;
  reflectorLessons!: Table<{ id?: number; projectId: number; chapterIndex: number; signalType: string; lessonContent: string; suggestedModule: string | null; status: string; committedTo: string | null; reviewNote: string | null; ts: number; signalContext: Record<string, unknown> }, number>;
  characterStates!: Table<{ id?: number; projectId: number; chapterIndex: number; characterName: string; ts: number; stale: number }, number>;
  foreshadowTable!: Table<{ id?: number; projectId: number; title: string; content: string; status: string; weight: string; setupChapter: number; createdAt: number; updatedAt: number }, number>;
  characterArcTable!: Table<{ id?: number; projectId: number; characterName: string; epoch: string; chapter: number; state: string; createdAt: number; updatedAt: number }, number>;
  worldContinuityTable!: Table<{ id?: number; projectId: number; domain: string; rule: string; severity: string; chapter: number; createdAt: number; updatedAt: number }, number>;
  rhythmDiagnosticTable!: Table<{ id?: number; projectId: number; chapter: number; sceneIdx: number; tension: number; emotion: number; createdAt: number; updatedAt: number }, number>;

  constructor() {
    super(DB_NAME);
    // v1-v7 与 V7DB 完全一致（CK 红线 #1 严守 · 这里仅声明最终 v7 形态供 dexie 回放）
    this.version(7).stores({
      projects: '++id, name, createdAt, status',
      artifacts: '++id, projectId, nodeId, ts, [projectId+nodeId]',
      liveArtifacts: '&nodeId, stageId, ts',
      runHistory: '++id, nodeId, ts, projectId, [projectId+nodeId], [nodeId+ts]',
      userKbDocs: '++id, type, enabled, createdAt, [type+enabled]',
      userKbFeedback: '++id, projectId, chapterIndex, createdAt, [projectId+chapterIndex]',
      liveRefinementUndo: '++id, ts, [chapterIndex+source]',
      characterStates: '++id, projectId, chapterIndex, characterName, ts, stale, [projectId+chapterIndex], [projectId+characterName], [projectId+chapterIndex+characterName]',
      reflectorLessons: '++id, projectId, chapterIndex, signalType, status, ts, [projectId+status], [projectId+chapterIndex]',
    });
    this.version(8).stores({
      projects: '++id, name, createdAt, status',
      artifacts: '++id, projectId, nodeId, ts, [projectId+nodeId]',
      liveArtifacts: '&nodeId, stageId, ts',
      runHistory: '++id, nodeId, ts, projectId, [projectId+nodeId], [nodeId+ts]',
      userKbDocs: '++id, type, enabled, createdAt, [type+enabled]',
      userKbFeedback: '++id, projectId, chapterIndex, createdAt, [projectId+chapterIndex]',
      liveRefinementUndo: '++id, ts, [chapterIndex+source]',
      characterStates: '++id, projectId, chapterIndex, characterName, ts, stale, [projectId+chapterIndex], [projectId+characterName], [projectId+chapterIndex+characterName]',
      reflectorLessons: '++id, projectId, chapterIndex, signalType, status, ts, [projectId+status], [projectId+chapterIndex]',
      foreshadowTable: '++id, projectId, status, setupChapter, payoffChapter, [projectId+status], [projectId+setupChapter]',
      characterArcTable: '++id, projectId, characterName, epoch, chapter, [projectId+characterName], [projectId+characterName+epoch]',
      worldContinuityTable: '++id, projectId, domain, chapter, [projectId+domain]',
      rhythmDiagnosticTable: '++id, projectId, chapter, sceneIdx, [projectId+chapter], [projectId+chapter+sceneIdx]',
    });
  }
}

beforeEach(async () => {
  // 每个 case 前确保数据库不存在 · 形成全新 v7 起点
  await Dexie.delete(DB_NAME);
});

describe('dexie v7 → v8 migration · zero-loss', () => {
  it('preserves v7 projects table data after upgrade', async () => {
    // ── arrange: 用 v7 schema 写入数据 ──────────────────────────────────
    const v7 = new V7DB();
    const projectId = await v7.projects.add({
      name: 'legacy-project',
      concept: '一个 v7 时代留下的项目',
      durationMin: 30,
      mode: '短剧',
      createdAt: 1700000000000,
      updatedAt: 1700000001000,
      status: 'idle',
    });
    expect(projectId).toBeGreaterThan(0);
    v7.close();

    // ── act: 用 v8 schema 重开同名数据库 · 触发升级 ──────────────────────
    const v8 = new V8DB();
    await v8.open();
    expect(v8.verno).toBe(8);

    // ── assert: 旧数据完整 ──────────────────────────────────────────
    const allProjects = await v8.projects.toArray();
    expect(allProjects).toHaveLength(1);
    expect(allProjects[0].name).toBe('legacy-project');
    expect(allProjects[0].concept).toBe('一个 v7 时代留下的项目');
    expect(allProjects[0].createdAt).toBe(1700000000000);
    v8.close();
  });

  it('preserves reflectorLessons (v7 last-added table) after upgrade', async () => {
    const v7 = new V7DB();
    await v7.reflectorLessons.bulkAdd([
      {
        projectId: 1,
        chapterIndex: 5,
        signalType: 'scoreCard',
        lessonContent: '低分场景应避免开篇大段心理独白',
        suggestedModule: 'pacing-rules',
        status: 'pending',
        committedTo: null,
        reviewNote: null,
        ts: 1700000010000,
        signalContext: { scoreCardScores: { pacing: 4 } },
      },
      {
        projectId: 1,
        chapterIndex: 8,
        signalType: 'consistencyCheck',
        lessonContent: '伏笔#3 在第 8 章未回收',
        suggestedModule: null,
        status: 'approved',
        committedTo: null,
        reviewNote: '采纳 · 下版本修复',
        ts: 1700000020000,
        signalContext: { consistencyIssues: ['foreshadow-3-broken'] },
      },
    ]);
    v7.close();

    const v8 = new V8DB();
    await v8.open();
    const lessons = await v8.reflectorLessons.toArray();
    expect(lessons).toHaveLength(2);
    expect(lessons[0].lessonContent).toContain('低分场景');
    expect(lessons[1].status).toBe('approved');
    expect(lessons[1].signalContext).toEqual({ consistencyIssues: ['foreshadow-3-broken'] });
    v8.close();
  });

  it('preserves characterStates (v5 table) after upgrade', async () => {
    const v7 = new V7DB();
    await v7.characterStates.bulkAdd([
      { projectId: 1, chapterIndex: 1, characterName: '林夏', ts: 1700000030000, stale: 0 },
      { projectId: 1, chapterIndex: 5, characterName: '林夏', ts: 1700000040000, stale: 0 },
      { projectId: 1, chapterIndex: 1, characterName: '陈墨', ts: 1700000031000, stale: 0 },
    ]);
    v7.close();

    const v8 = new V8DB();
    await v8.open();
    const states = await v8.characterStates.toArray();
    expect(states).toHaveLength(3);

    // 验证 v5 复合索引 [projectId+characterName] 升级后仍可用
    const linxiaTimeline = await v8.characterStates
      .where('[projectId+characterName]')
      .equals([1, '林夏'])
      .toArray();
    expect(linxiaTimeline).toHaveLength(2);
    v8.close();
  });

  it('creates 4 new continuity tables empty after upgrade', async () => {
    // arrange: v7 数据库存在但 4 张新表理论上不存在
    const v7 = new V7DB();
    await v7.projects.add({
      name: 'p',
      concept: 'c',
      durationMin: 10,
      mode: 'mode',
      createdAt: 1,
      updatedAt: 1,
      status: 'idle',
    });
    v7.close();

    // act: 升级到 v8
    const v8 = new V8DB();
    await v8.open();

    // assert: 4 张新表存在 · 全为空
    expect(await v8.foreshadowTable.count()).toBe(0);
    expect(await v8.characterArcTable.count()).toBe(0);
    expect(await v8.worldContinuityTable.count()).toBe(0);
    expect(await v8.rhythmDiagnosticTable.count()).toBe(0);
    v8.close();
  });

  it('allows write/read on new tables after upgrade without touching old data', async () => {
    const v7 = new V7DB();
    await v7.projects.add({
      name: 'mixed-test',
      concept: 'concept',
      durationMin: 30,
      mode: 'mode',
      createdAt: 100,
      updatedAt: 100,
      status: 'idle',
    });
    v7.close();

    const v8 = new V8DB();
    await v8.open();

    // 写新表
    await v8.foreshadowTable.add({
      projectId: 1,
      title: '神秘信物',
      content: '主角在第 1 章捡到的吊坠',
      status: 'planted',
      weight: 'major',
      setupChapter: 1,
      createdAt: 200,
      updatedAt: 200,
    });

    // 验证：新表有数据 · 旧表数据未受影响
    expect(await v8.foreshadowTable.count()).toBe(1);
    const projects = await v8.projects.toArray();
    expect(projects).toHaveLength(1);
    expect(projects[0].name).toBe('mixed-test');
    v8.close();
  });

  it('survives multiple open/close cycles (idempotent upgrade)', async () => {
    // 写入 v7 数据
    const v7 = new V7DB();
    await v7.projects.add({
      name: 'cycle-test',
      concept: 'c',
      durationMin: 10,
      mode: 'm',
      createdAt: 1,
      updatedAt: 1,
      status: 'idle',
    });
    v7.close();

    // 第一次打开 v8 · 触发升级
    const v8a = new V8DB();
    await v8a.open();
    await v8a.foreshadowTable.add({
      projectId: 1,
      title: 't1',
      content: 'c1',
      status: 'planted',
      weight: 'minor',
      setupChapter: 1,
      createdAt: 1,
      updatedAt: 1,
    });
    v8a.close();

    // 第二次打开 v8 · 不应再触发升级 · 数据仍在
    const v8b = new V8DB();
    await v8b.open();
    expect(v8b.verno).toBe(8);
    expect(await v8b.projects.count()).toBe(1);
    expect(await v8b.foreshadowTable.count()).toBe(1);
    v8b.close();
  });
});
