/**
 * 概念超短片格式 manifest（1-3 分钟 · 双路径工作流）
 *
 * 来源（MIT · @山音 · 字符级摘要）：
 *   docs/methodology/format-ultrashort.md
 *     §"What-If 工作流"（行 219-307）
 *     §"How-to-Tell 工作流"（行 407-441）
 *
 * 设计：两条路径在结构上对称（各 3 步）· 但起点完全不同：
 *   - What-If = 假设反常识前提 · 推演高概念后果
 *   - How-to-Tell = 用反常叙事方式重讲已知事
 * 进入流程前必须由用户先选定路径。
 */
import type { FormatManifest } from './types';

export const ULTRASHORT_FORMAT: FormatManifest = {
  id: 'ultrashort',
  nameZh: '概念超短片',
  nameEn: 'Ultra-Short Film',
  routePath: '/ultrashort-film',
  duration: '1-3 分钟',
  description:
    '纯粹的 idea delivery · 用一个高概念或反常叙事形式凿中观众。两条创作路径互斥 · 进入流程前先选定 What-If（高概念）或 How-to-Tell（视听形式）。3 分钟内观众对形式实验容忍度极高 · 是视听语言炫技的合法空间。',
  source: 'docs/methodology/format-ultrashort.md',
  upstream: 'shanyin-screenwriting-master · MIT · @山音',
  paths: [
    {
      id: 'whatif',
      label: 'What-If 高概念路径',
      description: '假设一个反常识前提 · 展示它的后果和推演。核心武器 = 概念的纯度和组合的冲击力。',
      steps: [
        {
          index: 1,
          title: '概念锻造',
          goal: '找到一个足够锐利的高概念 · 或用组合方式碰撞出来。',
          highlights: [
            '5 种组合方式：嫁接 / 时空错置 / 隐喻具象化 / 反转并置 / 规则反转',
            '生成 3-5 个概念方案 · 每个标注组合方式 + 推演潜力',
            '检验：能用一句话说清规则？5 秒内能用画面呈现？',
            '指向真实的社会情绪或人性弱点 · 至少能产生 3 个递进后果切片',
          ],
          outFormat: 'markdown',
        },
        {
          index: 2,
          title: '结构与视听设计',
          goal: '选定结构类型（三段式 / 递进崩塌 / 双线并置 / 循环 / 倒叙揭示）+ 视听语言。',
          highlights: [
            '从视听语言武器库选 1-2 种核心手法',
            '展开为带时长标注的结构大纲',
            '每段落标注：内容 + 视听手法 + 双轨节奏',
            '检验：5 秒内 get 规则？翻转逻辑成立？想回头重看一遍？',
          ],
          outFormat: 'markdown',
        },
        {
          index: 3,
          title: '全片剧本',
          goal: '极致精简 · 零解释 · 翻转落在最后画面/句子上。',
          highlights: [
            '每个字必须存在于画面中 · 台词极少甚至零台词',
            '视听语言描述具体（不是"用长镜头"·而是描写镜头如何运动）',
            '提供 2-3 个替代翻转方案供用户选择',
            '提供视听手法的替代方案（换一种语言效果如何？）',
          ],
          outFormat: 'markdown',
        },
      ],
    },
    {
      id: 'howtotell',
      label: 'How-to-Tell 视听形式路径',
      description: '用一种出人意料的叙事方式重新讲一个已知事情。形式即内容。',
      steps: [
        {
          index: 1,
          title: '形式发现',
          goal: '找到一个与内容深度契合的叙事形式 · 不只是"看起来酷"。',
          highlights: [
            '5 种创意方法：视角置换 / 形式模拟 / 时间手术 / 尺度跳跃 / 规则限制',
            '生成 3-5 个形式方案 · 标注与内容的契合度',
            '检验：观众能在 15 秒内理解形式？形式有递进空间？',
            '关键测试：去掉形式用常规方式讲 · 内容是否丧失冲击力？',
          ],
          outFormat: 'markdown',
        },
        {
          index: 2,
          title: '结构与视听设计',
          goal: '与 What-If 第 2 步流程相同 · 自检清单增加形式与内容的交汇。',
          highlights: [
            '选结构类型 + 视听手法（同 What-If 武器库）',
            '展开带时长标注的结构大纲',
            '增加自检：形式与内容是否在结尾交汇？',
            '增加自检：形式本身是否有递进 / 升级 / 变异？',
          ],
          outFormat: 'markdown',
        },
        {
          index: 3,
          title: '全片剧本',
          goal: '与 What-If 第 3 步流程相同 · 形式贯穿到底。',
          highlights: [
            '极致精简 · 零解释 · 视觉叙事',
            '形式必须从头到尾有变化（不能一个手法用到底）',
            '翻转落在最后画面或最后一句话上',
            '提供形式替代方案 + 翻转替代方案',
          ],
          outFormat: 'markdown',
        },
      ],
    },
  ],
};
