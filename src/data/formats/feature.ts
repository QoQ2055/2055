/**
 * 长片格式 manifest（75-120 分钟 · 8 步工作流）
 *
 * 来源（MIT · @山音 · 字符级摘要）：
 *   docs/methodology/format-feature.md §"长片八步工作流"（行 534-614）
 *
 * 与短片格式的区别：8 步骨架相同 · 每步深度和要求增强（主题论点 / B Story /
 * Subplot / 序列 / 弧光预算 / 伏笔规划等）。
 */
import type { FormatManifest } from './types';

export const FEATURE_FORMAT: FormatManifest = {
  id: 'feature',
  nameZh: '长片',
  nameEn: 'Feature Film',
  routePath: '/feature-film',
  duration: '75-120 分钟',
  description:
    '完整长片创作工作流 · 主角具备完整 Ghost/Lie/Flaw/Want/Need · 多次伪变化后的真正转变 · 可复杂分层世界观 · 弧光分配在整季节奏波浪中。8 步与短片骨架同源 · 每步深度大幅增强。',
  source: 'docs/methodology/format-feature.md',
  upstream: 'shanyin-screenwriting-master · MIT · @山音',
  paths: [
    {
      id: 'main',
      label: '长片八步工作流',
      description: '与短片骨架同源 · 每步要求增强 · 引入主题论点 / B Story / Subplot / 序列 / 弧光预算 / 伏笔规划。',
      steps: [
        {
          index: 1,
          title: '破题与核心动作',
          goal: '确立长片的"核" · 在核心戏剧动作之外建立"主题论点"。',
          highlights: [
            '核心戏剧动作 = 目标 (Goal) + 阻碍 (Conflict)',
            '主题论点（Thematic Argument）= 可被争论的命题',
            'A Plot 与 B Plot 分别承载主题正反两面',
          ],
          outFormat: 'markdown',
        },
        {
          index: 2,
          title: '梗概草稿',
          goal: '产出一页纸 Treatment（300-500 字）· 让读完者立即抓住类型气质。',
          highlights: [
            '主角核心困境 + 催化事件',
            '中点转折方向 + 高潮大致形态',
            '结局情感调性 · 暗示全片类型气质',
            '若有 B Story · Treatment 应能感受到两条线并存',
          ],
          outFormat: 'markdown',
        },
        {
          index: 3,
          title: '人物深度与弧光',
          goal: '建立 Ghost/Lie/Flaw/Want/Need 五维 · 设计 B Story 角色 + 关系网。',
          highlights: [
            '主角五维：Ghost（前史伤痕）/ Lie（错信）/ Flaw（缺陷）/ Want（外在）/ Need（内在）',
            'B Story 角色承载主题论点的对立面',
            '次要角色标注功能：镜像 / 催化 / 主题 / 节奏',
            '群像片需设计角色关系矩阵',
          ],
          outFormat: 'markdown',
        },
        {
          index: 4,
          title: '前史与世界观',
          goal: '"电影是现实生活的横截面" · 在结构大纲之前先建造完整世界。',
          highlights: [
            '时代背景：核心矛盾 / 氛围 / 影响角色的特征',
            '主角前史：从出生到故事开始的关键事件链（特别是 Ghost 事件）',
            '关系既往：角色间在故事开始之前的关系状态',
            '世界观三层模型：表层规则 / 运行逻辑 / 底层真相',
            '横截面选择：为什么从这个时刻切入？',
          ],
          outFormat: 'markdown',
        },
        {
          index: 5,
          title: '结构大纲',
          goal: '选定结构方法论 · 标注 Subplot / 伏笔 / 暗线 / 时长预算 / 双轨节奏。',
          highlights: [
            '4 选 1 结构：Save the Cat / Story Circle / McKee / 内在节拍表 + 风格变体',
            '开场钩子设计（前 1-2 分钟视听内容 · 商业片高密度 / 文艺片高度风格化）',
            'Subplot 交织点 + 世界观各层揭示时机',
            '时长预算（每段落预估）+ 双轨节奏（外部情节 / 内在情感）',
            '伏笔规划（至少 3-5 个伏笔/回扣对）+ 暗线规划',
          ],
          outFormat: 'markdown',
        },
        {
          index: 6,
          title: '场景拆解',
          goal: '引入序列（Sequence）概念 · 90 分钟约 8-12 序列 · 触发记忆检查点。',
          highlights: [
            'Sequence = 2-3 场景组成的小型"建立→冲突→结果"',
            '每个场景标注预估时长 + 双轨节奏状态',
            '场景时长累加检查（与第 5 步段落预算一致）',
            '本步完成后必触发记忆检查点（锁定全局信息）',
          ],
          outFormat: 'markdown',
        },
        {
          index: 7,
          title: '场景写作',
          goal: '伏笔自然植入 · 次要角色台词风格区分 · 每序列触发记忆检查点。',
          highlights: [
            '伏笔不能太刻意 · 次要角色台词风格必须与主角区分',
            '前史信息通过对白和视觉线索自然散落（不集中交代）',
            '每完成一个 Sequence（2-3 场戏）触发一次记忆检查点',
            '回顾角色状态 / 活跃线索 / 伏笔状态 / 节奏方向',
          ],
          outFormat: 'markdown',
        },
        {
          index: 8,
          title: '剧本医生',
          goal: '诊断 ABC Plot 交织 / 弧光真假转变 / 开场质量 / 伏笔回扣 / 次要角色功能。',
          highlights: [
            'A/B/C Plot 是否有效交织 · 世界观揭示是否自然',
            '"伪变化"是否足够（角色不应该太快到达 Need）',
            '开场钩子质量检查（是否全片最精心段落之一？）',
            '节奏诊断 + 伏笔审计 + 次要角色审计',
          ],
          outFormat: 'json',
        },
      ],
    },
  ],
};
