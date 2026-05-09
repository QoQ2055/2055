/**
 * 叙事短片格式 manifest（5-10 分钟 · 8 步工作流）
 *
 * 来源（MIT · @山音 · 字符级摘要）：
 *   docs/methodology/format-short.md §"完整八步工作流"（行 32-251）
 *
 * 与现有 /screenplay 路由的区分：
 *   - /screenplay = 通用短剧 8 步工作流 · 沉淀的 fili-web 内部 prompt 体系
 *   - /short-film = 山音 SKILL "叙事短片"格式 · MIT 原生 LAYER 1 引用
 *   - 两者并存 · MM1 后续 PR 评估是否合并对齐
 */
import type { FormatManifest } from './types';

export const SHORT_FORMAT: FormatManifest = {
  id: 'short',
  nameZh: '叙事短片',
  nameEn: 'Short Film',
  routePath: '/short-film',
  duration: '5-10 分钟',
  description:
    '叙事短片完整工作流 · 1-2 主角的完整 Want/Need/Arc · 四段式结构 · 单一核心事件高密度推进 · 一次完整 A→B 弧光变化。前 15 秒视觉钩子是结构核心。',
  source: 'docs/methodology/format-short.md',
  upstream: 'shanyin-screenwriting-master · MIT · @山音',
  paths: [
    {
      id: 'main',
      label: '叙事短片八步工作流',
      description: '从破题到剧本医生 · 单一核心事件 · 四段式结构 · 高信息密度推进。',
      steps: [
        {
          index: 1,
          title: '破题与核心动作',
          goal: '确立短片的"核" · 构思 3-5 个核心戏剧动作方案。',
          highlights: [
            '戏剧动作 = 目标 (Want) + 阻碍 (Conflict)',
            '事件聚焦 · 适合短片体量',
            '输出：A/B/C 方案各含主角 / 目标 / 阻碍 / Logline',
            '自检：戏剧动作有效性 / 目标合理性 / 冲突构建',
          ],
          outFormat: 'markdown',
        },
        {
          index: 2,
          title: '梗概草稿',
          goal: '一段话故事提要（100-200 字）· 让用户对气质有基本判断。',
          highlights: [
            '主角是谁 · 处于什么处境',
            '因为什么事件被逼入什么困境',
            '最终走向什么结局（可模糊）',
            '提要语气暗示全片气质（沉重 / 轻快 / 温暖 / 冷冽）',
          ],
          outFormat: 'markdown',
        },
        {
          index: 3,
          title: '人物深度与弧光',
          goal: '拒绝纸片人 · 建立 Want/Need/小传/矛盾性的内在张力。',
          highlights: [
            'Want（外在需求）vs Need（内在欲望）必须对立',
            '人物小传：前史作为冲突根源',
            '矛盾特征：外在表现 vs 内在真实',
            '弧光：从 A 状态 → B 状态的不可逆变化',
          ],
          outFormat: 'markdown',
        },
        {
          index: 4,
          title: '前史与世界观（精简版）',
          goal: '编剧自己必须知道 · 不一定全部展示给观众。',
          highlights: [
            '时代/环境背景 · 角色前史关键事件',
            '关系既往（重要关系在故事开始前的状态）',
            '横截面选择：为什么从这个时刻切入？',
            '前史信息通过对白和视觉线索自然散落 · 如非必要不用闪回',
          ],
          outFormat: 'markdown',
        },
        {
          index: 5,
          title: '结构大纲',
          goal: '四段式骨架 · 单一核心事件 · 前 15 秒视觉钩子。',
          highlights: [
            '第一幕（起因）：开场钩子 + 建置 + 激励事件',
            '第二幕（发展）：障碍 1 + 障碍 2（不可省略 · 不同质）+ 中点伪胜利/失败',
            '第三幕（高潮）：最终对决 + 关键选择 + 故事反转',
            '第四幕（结局）：新常态（弧光完成）',
            '时长预算：建置 15% / 发展 40% / 高潮 25% / 结局 20%',
          ],
          outFormat: 'markdown',
        },
        {
          index: 6,
          title: '场景列表',
          goal: '将大纲转化为具体视听单元 · 每场标注时长 + 双轨节奏。',
          highlights: [
            '每个情节点拆解为 1-N 个核心戏剧动作（目标 → 障碍 → 结果）',
            '每场戏标注预估时长 + 双轨节奏（情节 松/中/紧 · 情感 轻/中/重）',
            '场景时长累加 vs 目标总时长',
            '避免连续 3 场以上同节奏 · 鼓励情节/情感至少一处错位',
          ],
          outFormat: 'markdown',
        },
        {
          index: 7,
          title: '场景写作',
          goal: '视觉写作 + 潜台词 · 严禁心理描写。',
          highlights: [
            '视觉写作：只写能被看见的动作和能被听见的声音',
            '潜台词：对话像冰山 · 利用动作 / 停顿 / 回避表达真意',
            '台词口语化 · 不直白',
            '标准剧本格式输出',
          ],
          outFormat: 'markdown',
        },
        {
          index: 8,
          title: '剧本医生与抛光',
          goal: '诊断节奏 / 时长 / 逻辑 / 对话 · 提供 What-if 优化建议。',
          highlights: [
            '诊断报告：节奏问题（含双轨诊断）/ 时长问题 / 逻辑漏洞 / 对话问题',
            '优化建议：场景潜台词重写 / 反套路结局构思',
            '综合自检：核心概念 / 人物 / 结构 / 视听 四板块',
            '检查场景时长是否偏离预算 · 高潮段时长是否足够',
          ],
          outFormat: 'json',
        },
      ],
    },
  ],
};
