/**
 * v8 epic · MM5 PR-6 · extractContinuityFromChapter 单元测试
 *
 * 覆盖矩阵（13 cases）：
 *   守门检查（4）         ─ apiKey 缺失 / 章节空 / LLM 抛错 / 非 JSON 文本
 *   schema 校验（2）       ─ JSON 数组（非对象）/ 完整 4 类入库
 *   字段默认值（2）        ─ foreshadow status/weight 默认 / rule severity 默认
 *   防御性过滤（2）        ─ 缺必填字段跳过 / rhythm sceneIdx 非数字跳过
 *   值域钳制（1）          ─ rhythm tension/emotion 越界 clampInt
 *   add-only 语义（1）     ─ 同章节连续两次 extract 行数翻倍（模块声明"调用方负责去重"）
 *   API 守门未触发 LLM（1） ─ apiKey 缺失时不应调用 chatStream
 *
 * 不变量（CK）：
 *   - chatStream 全 mock · 不发任何网络请求
 *   - dexie 用真实生产 db + fake-indexeddb · beforeEach 清 4 张表 · 测试间不污染
 *   - parseLooseJson / persistors / clampInt 都走真实路径 · 不 mock
 */
import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';

// chatStream 必须先 mock · vitest hoist 保证它在 extractor import 之前生效
vi.mock('../../llm/deepseek', () => ({
  chatStream: vi.fn(),
}));

import { chatStream } from '../../llm/deepseek';
import { extractContinuityFromChapter } from '../continuity/extractor';
import { db } from '../../store/db';
import type { SettingsState } from '../../store/settings';

const chatStreamMock = chatStream as unknown as Mock;

// 测试用最小 settings · 仅包含 extractor 使用的字段
const baseSettings: SettingsState = {
  baseUrl: 'https://example.test',
  apiKey: 'test-key',
  model: 'deepseek-chat',
  modelLite: 'deepseek-chat-lite',
} as SettingsState;

const PROJECT_ID = 42;

beforeEach(async () => {
  await db.foreshadowTable.clear();
  await db.characterArcTable.clear();
  await db.worldContinuityTable.clear();
  await db.rhythmDiagnosticTable.clear();
  chatStreamMock.mockReset();
});

/** 默认 mock 返回值生成器 · payload 序列化为 JSON 字符串 · 模拟 LLM JSON 输出 */
function mockLlmReturn(payload: unknown, usage = { total_tokens: 123 }) {
  chatStreamMock.mockResolvedValueOnce({
    content: typeof payload === 'string' ? payload : JSON.stringify(payload),
    usage,
  });
}

// ─── 守门检查 ────────────────────────────────────────────────────────

describe('extractContinuityFromChapter · 守门检查', () => {
  it('apiKey 缺失时返回 ok:false 且不调 LLM', async () => {
    const res = await extractContinuityFromChapter({
      projectId: PROJECT_ID,
      chapterIndex: 1,
      chapterContent: 'lorem ipsum',
      settings: { ...baseSettings, apiKey: '' } as SettingsState,
    });
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/API Key/);
    expect(chatStreamMock).not.toHaveBeenCalled();
    expect(res.counts).toEqual({ foreshadows: 0, characterArcs: 0, worldRules: 0, rhythmDiagnostics: 0 });
  });

  it('章节内容为空时返回 ok:false 且不调 LLM', async () => {
    const res = await extractContinuityFromChapter({
      projectId: PROJECT_ID,
      chapterIndex: 1,
      chapterContent: '   \n  ',
      settings: baseSettings,
    });
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/章节内容为空/);
    expect(chatStreamMock).not.toHaveBeenCalled();
  });

  it('LLM 抛异常时包装为 ok:false 错误信息', async () => {
    chatStreamMock.mockRejectedValueOnce(new Error('boom'));
    const res = await extractContinuityFromChapter({
      projectId: PROJECT_ID,
      chapterIndex: 1,
      chapterContent: 'some chapter content',
      settings: baseSettings,
    });
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/LLM 调用失败.*boom/);
    expect(chatStreamMock).toHaveBeenCalledTimes(1);
  });

  it('LLM 返回非 JSON 文本时返回 JSON 解析失败', async () => {
    mockLlmReturn('this is not json at all');
    const res = await extractContinuityFromChapter({
      projectId: PROJECT_ID,
      chapterIndex: 1,
      chapterContent: 'chapter',
      settings: baseSettings,
    });
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/JSON 解析失败/);
    expect(res.meta.rawTextHead).toContain('this is not json');
  });
});

// ─── schema 校验 ─────────────────────────────────────────────────────

describe('extractContinuityFromChapter · schema 校验', () => {
  it('LLM 返回 JSON 数组（非对象）时报"输出不是对象"', async () => {
    mockLlmReturn([{ foo: 'bar' }]);
    const res = await extractContinuityFromChapter({
      projectId: PROJECT_ID,
      chapterIndex: 1,
      chapterContent: 'chapter',
      settings: baseSettings,
    });
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/输出不是对象/);
  });

  it('完整 4 类合法数据全部落入对应 dexie 表', async () => {
    mockLlmReturn({
      foreshadows: [
        { title: '神秘信物', content: '主角在阁楼发现一枚刻着祖父名字的怀表 · 后续将引出家族秘密', status: 'planted', weight: 'major', setupChapter: 3 },
      ],
      characterArcs: [
        { characterName: '李墨', epoch: 'opening', state: '少年丧父 · 心怀复仇执念', driver: '父亲被人毒杀', evidence: '怀表上有暗号' },
      ],
      worldRules: [
        { domain: 'magic-system', rule: '术士施法需以血为媒 · 每次损 7 日寿元', severity: 'hard' },
        { domain: 'social', rule: '武林大会三年一届', severity: 'soft' },
      ],
      rhythmDiagnostics: [
        { sceneIdx: 0, tension: 3, emotion: -2, sceneLabel: '回忆童年' },
        { sceneIdx: 1, tension: 8, emotion: -4, warnings: ['冲突过密'] },
      ],
    });
    const res = await extractContinuityFromChapter({
      projectId: PROJECT_ID,
      chapterIndex: 3,
      chapterContent: 'chapter body',
      settings: baseSettings,
    });
    expect(res.ok).toBe(true);
    expect(res.counts).toEqual({ foreshadows: 1, characterArcs: 1, worldRules: 2, rhythmDiagnostics: 2 });
    expect(res.meta.tokens).toBe(123);

    // 真实 dexie 验证：4 表行数与字段
    expect(await db.foreshadowTable.where('projectId').equals(PROJECT_ID).count()).toBe(1);
    const fs = (await db.foreshadowTable.where('projectId').equals(PROJECT_ID).toArray())[0];
    expect(fs.title).toBe('神秘信物');
    expect(fs.status).toBe('planted');
    expect(fs.weight).toBe('major');
    expect(fs.setupChapter).toBe(3);

    expect(await db.characterArcTable.where('projectId').equals(PROJECT_ID).count()).toBe(1);
    expect(await db.worldContinuityTable.where('projectId').equals(PROJECT_ID).count()).toBe(2);
    expect(await db.rhythmDiagnosticTable.where('projectId').equals(PROJECT_ID).count()).toBe(2);
  });
});

// ─── 字段默认值 ──────────────────────────────────────────────────────

describe('extractContinuityFromChapter · 字段默认值', () => {
  it('foreshadow 缺 status/weight 时填默认 planted/minor + setupChapter 默认本章号', async () => {
    mockLlmReturn({
      foreshadows: [{ title: 't1', content: 'content body long enough to look real' }],
    });
    const res = await extractContinuityFromChapter({
      projectId: PROJECT_ID,
      chapterIndex: 7,
      chapterContent: 'chapter',
      settings: baseSettings,
    });
    expect(res.ok).toBe(true);
    expect(res.counts.foreshadows).toBe(1);
    const rows = await db.foreshadowTable.where('projectId').equals(PROJECT_ID).toArray();
    expect(rows[0].status).toBe('planted');
    expect(rows[0].weight).toBe('minor');
    expect(rows[0].setupChapter).toBe(7);
  });

  it('worldRule 缺 severity 时填默认 soft + chapter 取本章号', async () => {
    mockLlmReturn({
      worldRules: [{ domain: 'd1', rule: 'a rule' }],
    });
    const res = await extractContinuityFromChapter({
      projectId: PROJECT_ID,
      chapterIndex: 5,
      chapterContent: 'chapter',
      settings: baseSettings,
    });
    expect(res.ok).toBe(true);
    const rows = await db.worldContinuityTable.where('projectId').equals(PROJECT_ID).toArray();
    expect(rows[0].severity).toBe('soft');
    expect(rows[0].chapter).toBe(5);
  });
});

// ─── 防御性过滤 ──────────────────────────────────────────────────────

describe('extractContinuityFromChapter · 防御性过滤', () => {
  it('缺必填字段的 row 被跳过 · 不污染 counts', async () => {
    mockLlmReturn({
      foreshadows: [
        { title: '有效', content: '完整内容' },
        { title: '', content: '缺标题' },              // 跳过
        { title: '缺内容', content: '' },               // 跳过
      ],
      characterArcs: [
        { characterName: '甲', epoch: 'opening', state: 'ok' },
        { characterName: '', epoch: 'mid', state: 'no name' },        // 跳过
        { characterName: '乙', epoch: '', state: 'no epoch' },        // 跳过
        { characterName: '丙', epoch: 'opening', state: '' },         // 跳过
      ],
      worldRules: [
        { domain: 'magic', rule: 'r1' },
        { domain: '', rule: 'no domain' },              // 跳过
        { domain: 'tech', rule: '' },                   // 跳过
      ],
    });
    const res = await extractContinuityFromChapter({
      projectId: PROJECT_ID,
      chapterIndex: 1,
      chapterContent: 'chapter',
      settings: baseSettings,
    });
    expect(res.ok).toBe(true);
    expect(res.counts).toEqual({ foreshadows: 1, characterArcs: 1, worldRules: 1, rhythmDiagnostics: 0 });
  });

  it('rhythm sceneIdx 非数字时跳过', async () => {
    mockLlmReturn({
      rhythmDiagnostics: [
        { sceneIdx: 0, tension: 5, emotion: 0 },
        { sceneIdx: 'one' as unknown as number, tension: 5, emotion: 0 },  // 跳过
        { tension: 5, emotion: 0 } as unknown,                              // 跳过
      ],
    });
    const res = await extractContinuityFromChapter({
      projectId: PROJECT_ID,
      chapterIndex: 1,
      chapterContent: 'chapter',
      settings: baseSettings,
    });
    expect(res.ok).toBe(true);
    expect(res.counts.rhythmDiagnostics).toBe(1);
  });
});

// ─── 值域钳制 ────────────────────────────────────────────────────────

describe('extractContinuityFromChapter · 值域钳制', () => {
  it('rhythm tension/emotion 越界时 clampInt 钳到合法区间', async () => {
    mockLlmReturn({
      rhythmDiagnostics: [
        { sceneIdx: 0, tension: 99,  emotion: 99 },   // 钳到 10 / 5
        { sceneIdx: 1, tension: -7,  emotion: -99 },  // 钳到 0 / -5
        { sceneIdx: 2, tension: 4.7, emotion: -1.4 }, // round → 5 / -1
      ],
    });
    const res = await extractContinuityFromChapter({
      projectId: PROJECT_ID,
      chapterIndex: 1,
      chapterContent: 'chapter',
      settings: baseSettings,
    });
    expect(res.ok).toBe(true);
    expect(res.counts.rhythmDiagnostics).toBe(3);
    const rows = (await db.rhythmDiagnosticTable.where('projectId').equals(PROJECT_ID).toArray())
      .sort((a, b) => a.sceneIdx - b.sceneIdx);
    expect(rows[0].tension).toBe(10);
    expect(rows[0].emotion).toBe(5);
    expect(rows[1].tension).toBe(0);
    expect(rows[1].emotion).toBe(-5);
    expect(rows[2].tension).toBe(5);
    expect(rows[2].emotion).toBe(-1);
  });
});

// ─── add-only 语义（rhythm 例外为 upsert） ─────────────────────────────

describe('extractContinuityFromChapter · add-only 语义', () => {
  it('同章节连续两次 extract · foreshadows/arcs/rules 翻倍 · rhythm 因 upsert 不翻倍', async () => {
    const payload = {
      foreshadows: [{ title: 't', content: 'c' }],
      characterArcs: [{ characterName: '甲', epoch: 'opening', state: 's' }],
      worldRules: [{ domain: 'd', rule: 'r' }],
      rhythmDiagnostics: [{ sceneIdx: 0, tension: 5, emotion: 0 }],
    };
    mockLlmReturn(payload);
    await extractContinuityFromChapter({
      projectId: PROJECT_ID,
      chapterIndex: 1,
      chapterContent: 'chapter',
      settings: baseSettings,
    });
    mockLlmReturn(payload);
    await extractContinuityFromChapter({
      projectId: PROJECT_ID,
      chapterIndex: 1,
      chapterContent: 'chapter',
      settings: baseSettings,
    });
    // foreshadow/arc/rule 都是 add-only · 重复调用产生重复行
    expect(await db.foreshadowTable.where('projectId').equals(PROJECT_ID).count()).toBe(2);
    expect(await db.characterArcTable.where('projectId').equals(PROJECT_ID).count()).toBe(2);
    expect(await db.worldContinuityTable.where('projectId').equals(PROJECT_ID).count()).toBe(2);
    // rhythm 是 upsert 语义（同 projectId+chapter+sceneIdx 替换）· 不翻倍
    expect(await db.rhythmDiagnosticTable.where('projectId').equals(PROJECT_ID).count()).toBe(1);
  });
});
