/**
 * 资料库 v2 P9-C · 方法论模块推荐引擎
 *
 * 输入：ProjectContext（题材 / 平台 / 体量 / 调性 / POV / 受众 / 核心冲突 / 主角性别 等）
 * 输出：每个模块的推荐分数 + 一句话理由（仅用于 UI 高亮 + 引导，不强制启用）
 *
 * 设计原则：
 * - 纯启发式规则，不调 LLM（即时反馈，零成本）
 * - 输出不去重 / 不互斥 —— 互斥由 MethodModulePanel.toggle() 处理
 * - 评分 0-100；> 60 显示「💡 推荐」徽章；> 80 推荐应用
 * - 任何变化都不破坏旧 manifest（未知 module id 直接跳过）
 */

import type { ProjectContext } from './types';
import type { MethodModuleItem, MethodModuleManifest } from './methodModules';
import { chatStream } from '../llm/deepseek';

export interface ModuleRecommendation {
  /** 模块 id */
  id: string;
  /** 0-100 分；> 60 算推荐，> 80 算强烈推荐 */
  score: number;
  /** 一句话推荐理由（中文，≤ 60 字） */
  reason: string;
  /** 推荐来源：启发式 / LLM（可选） */
  source?: 'heuristic' | 'llm';
}

/* ───────────────────────────────────────────────────────────────────
 * 主入口
 * ─────────────────────────────────────────────────────────────────── */

export function recommendMethodModules(ctx: Partial<ProjectContext>): ModuleRecommendation[] {
  const out: ModuleRecommendation[] = [];

  const genres = (ctx.genres ?? []).map((g) => g.toLowerCase());
  const tone = (ctx.novelTone ?? '').toLowerCase();
  const scale = (ctx.novelScale ?? '').toLowerCase();
  const pov = (ctx.novelPov ?? '').toLowerCase();
  const audience = (ctx.novelAudience ?? '').toLowerCase();
  const platform = (ctx.novelPlatform ?? '').toLowerCase();

  // ── 结构层（互斥，最多推一个为强）─────────────────────────────
  // 重生 / 系统 / 修真 / 异世界 → 英雄之旅（角色弧光强）
  if (
    genres.some((g) => g.includes('重生') || g.includes('系统') || g.includes('修真')
      || g.includes('异世界') || g.includes('穿越') || g.includes('武侠'))
  ) {
    out.push({
      id: 'heros-journey-12stages',
      score: 88,
      reason: '主角成长弧光极强，英雄之旅 12 阶段最适合',
    });
  }

  // ATU 301 救援骨架：西幻屠龙 / 神话 / 救援 / 寻回任务 → 高推荐
  const atuHints = ['西幻', '屠龙', '神话', '童话', '民间', '奇幻', '救援', '寻回', '救公主', '救师门'];
  const coreText = `${ctx.coreConflict ?? ''} ${ctx.novelLogline ?? ''} ${ctx.novelHook ?? ''}`.toLowerCase();
  const atuCoreMatch = /(救出|拯救|救回|寻找|寻回|营救|找回|夺回).{0,10}(公主|师|族人|爱人|姐姐|妹妹|挚友|神器|灵魂|记忆)/.test(coreText);
  if (genres.some((g) => atuHints.some((h) => g.includes(h))) || atuCoreMatch) {
    out.push({
      id: 'atu-301-rescue-quest',
      score: atuCoreMatch ? 85 : 76,
      reason: atuCoreMatch
        ? '核心冲突是"寻回/救援"类型，ATU 301 七功能簇骨架天生契合'
        : '西幻 / 神话 / 救援题材，ATU 301 民俗骨架天然适用',
    });
  }

  // 日常系 / 治愈 / 校园 / 美食 / 慢调性 → 起承转合
  const calmHints = ['日常', '治愈', '校园', '美食', '田园', '种田', '生活', '慢热'];
  if (
    tone.includes('calm') || tone.includes('literary') || tone.includes('warm')
    || genres.some((g) => calmHints.some((h) => g.includes(h)))
  ) {
    out.push({
      id: 'kishotenketsu',
      score: 85,
      reason: '调性偏慢 / 治愈 / 日常，东亚四段结构不依赖冲突',
    });
  }

  // 言情 / 情感向 → 林赛·多兰七要点（情感弧线专用）
  const romanceHints = ['言情', '现言', '古言', '甜宠', '宠文', '虐文', '双男主', '双女主', 'bg', 'bl', 'gl', '耽美', '百合', '恋爱', '爱情'];
  if (genres.some((g) => romanceHints.some((h) => g.includes(h)))) {
    out.push({
      id: 'seven-points-romance',
      score: 88,
      reason: '言情主线：七要点情感弧线 = 情感缺陷 → 假圆满 → 由缺陷引爆的真挫折 → 自我转变 → 重建',
    });
  }

  // 悬疑 / 推理 / 灵异 / 恐怖 → 三宅隆太 12 步（悬疑专用）
  const mysteryHints = ['悬疑', '推理', '侦探', '本格', '灵异', '恐怖', '惊悚', '怪谈', '克苏鲁', '规则怪谈', '异常', '诡异'];
  if (genres.some((g) => mysteryHints.some((h) => g.includes(h)))) {
    out.push({
      id: 'twelve-step-mystery',
      score: 88,
      reason: '悬疑主线：12 步 = 规则建立 → 规则反转 → 关键线索公平前置 → 真相揭露 → 最终反转',
    });
  }

  // 深度人物驱动 / 权谋 / 复仇 / 严肃文学 → 特鲁比 22 步（仅限长篇）
  const trubyHints = ['权谋', '宫斗', '政治', '复仇', '救赎', '间谍', '卧底', '严肃文学', '成长小说'];
  const trubyTone = tone.includes('literary') || tone.includes('serious') || tone.includes('deep')
    || tone.includes('character-driven') || tone.includes('psychological');
  const isLongEnough = scale === 'long' || scale === 'super_long';
  if (isLongEnough && (trubyTone || genres.some((g) => trubyHints.some((h) => g.includes(h))))) {
    out.push({
      id: 'truby-22-steps',
      score: 82,
      reason: '深度人物驱动长篇：22 步把需求 ≠ 欲望的矛盾拉满，两次自我揭露撑起内在弧线',
    });
  }

  // 单元剧 / 连载网文 / 日更 → 哈蒙故事圈（闭环结构）
  const harmonHints = ['单元剧', '单元', '日更', '网文', '连载', '每章独立', '番剧', '短篇集', '案件', '任务', '世界奇闻'];
  const isDailyUpdate = platform.includes('qidian') || platform.includes('17k')
    || platform.includes('zongheng') || platform.includes('jjwxc');
  if (genres.some((g) => harmonHints.some((h) => g.includes(h))) || (isDailyUpdate && scale !== 'short')) {
    out.push({
      id: 'harmon-story-circle',
      score: 80,
      reason: '单元剧 / 连载网文：故事圈 8 步闭环让每单元自洽，上下半圈镜像对称',
    });
  }

  // 短中篇 → 三幕式（颗粒度粗，自由度高）
  if (scale === 'short' || scale === 'medium') {
    out.push({
      id: 'three-act-structure',
      score: 75,
      reason: `${scale === 'short' ? '短篇' : '中篇'}体量适合颗粒度粗的三幕式`,
    });
  }

  // 长篇商业网文（默认 fallback） → Save the Cat（所有结构骨架都没命中时兜底）
  if (
    !out.some((r) =>
      r.id === 'heros-journey-12stages' || r.id === 'kishotenketsu'
      || r.id === 'three-act-structure' || r.id === 'atu-301-rescue-quest'
      || r.id === 'seven-points-romance' || r.id === 'twelve-step-mystery'
      || r.id === 'truby-22-steps' || r.id === 'harmon-story-circle')
    && (scale === 'long' || scale === 'super_long' || !scale)
  ) {
    out.push({
      id: 'save-the-cat-15beats',
      score: 78,
      reason: '长篇商业网文的默认骨架，15 节拍容易对齐分卷',
    });
  }

  // ── 角色层（MBTI 两个版本二选一）───────────────────────────────
  // 严肃文学 / 深度群像 / 成长弧线明显 → 推荐深度版（认知功能派）
  const literaryTone = tone.includes('literary') || tone.includes('serious')
    || tone.includes('deep') || tone.includes('psychological');
  const deepGroupHints = genres.some((g) => g.includes('群像') || g.includes('多主角')
    || g.includes('文学') || g.includes('严肃'));
  const isShortOrFast = scale === 'short' || tone.includes('fast')
    || tone.includes('cool') || tone.includes('hype') || tone.includes('pleasure');

  if ((literaryTone || deepGroupHints) && !isShortOrFast) {
    out.push({
      id: 'mbti-cognitive-functions',
      score: literaryTone && deepGroupHints ? 85 : 78,
      reason: '文学性 / 深度群像项目，Beebe 八功能模型能撑起角色内在张力',
    });
  }

  // POV=第一 or 群像 / 多视角 → MBTI 五步法（简化版，与深度版互斥；去重阶段按分数择优）
  if (
    pov.includes('first') || pov.includes('一人称') || pov === '1' || pov === 'i'
    || genres.some((g) => g.includes('群像') || g.includes('多主角'))
  ) {
    out.push({
      id: 'mbti-5step',
      score: 75,
      reason: '强角色驱动（第一人称 / 群像），需要立得住的角色卡',
    });
  } else {
    // 兜底：任何项目都建议来一份角色卡（弱推荐）
    out.push({
      id: 'mbti-5step',
      score: 55,
      reason: '为核心角色建立弱点 / 动力 / 剧情功能定位',
    });
  }

  // MBTI 16 型档案速查卡：群像 / 多配角项目的档案增强（与任一方法论正交叠加）
  const hasGroupCast = genres.some((g) => g.includes('群像') || g.includes('多主角'))
    || deepGroupHints;
  if (hasGroupCast && !isShortOrFast) {
    out.push({
      id: 'mbti-16-archetype-cards',
      score: 62,
      reason: '群像项目建议叠加 16 型档案速查，LLM 可直接抄团队配置配方',
    });
  }

  // 立体人物三要素法：古风 / 武侠 / 权谋 强推荐；其他非治愈项目弱推
  const classicalHints = ['古风', '武侠', '仙侠', '玄幻', '权谋', '宫斗', '古言', '江湖', '民国', '架空历史', '修仙'];
  const softForThreeElements = tone.includes('calm') || tone.includes('warm')
    || genres.some((g) => g.includes('治愈') || g.includes('日常') || g.includes('甜宠'));
  if (genres.some((g) => classicalHints.some((h) => g.includes(h)))) {
    out.push({
      id: 'character-three-elements-method',
      score: 80,
      reason: '古风 / 武侠 / 权谋：三要素法(外表+欲望+弱点) + 四级压力递进 + 5 个古风可抄 demo',
    });
  } else if (!softForThreeElements && scale !== 'short') {
    out.push({
      id: 'character-three-elements-method',
      score: 55,
      reason: '三要素法是 Truby 的轻量入门版，写角色 bible 时可参考四级压力递进 + 激活句公式',
    });
  }

  // ── 节奏层 ─────────────────────────────────────────────────────
  // 爽点驱动 / 男频商业 → 七情节奏点
  if (
    tone.includes('fast') || tone.includes('cool') || tone.includes('hype')
    || tone.includes('pleasure') || audience === 'male'
    || platform.includes('qidian') || platform.includes('17k') || platform.includes('zongheng')
  ) {
    out.push({
      id: 'seven-emotion-peaks',
      score: 82,
      reason: '爽文 / 商业节奏：每章 2 个情绪锚点，挤掉 AI 套话',
    });
  }

  // ── 工艺层（通用，正交无冲突）─────────────────────────────────
  // Pixar 22 法则适合所有有"角色 + 情节"的作品（也就是所有项目）
  out.push({
    id: 'pixar-22-rules',
    score: 65,
    reason: '反 AI 套路的角色 + 情节铁律，与任何结构兼容',
  });

  // 超自然网文综合包：超自然题材强推荐（修仙 / 玄幻 / 魔法 / 都市异能等）
  const supernaturalHints = [
    '修仙', '玄幻', '仙侠', '神魔', '奇幻', '魔法', '巫师', '异世界',
    '超能力', '异能', '灵异', '克苏鲁', '无限流', '规则怪谈', '异常',
  ];
  if (genres.some((g) => supernaturalHints.some((h) => g.includes(h)))) {
    out.push({
      id: 'supernatural-webfiction-pack',
      score: 85,
      reason: '超自然题材：ATU 编码 + 子题材本土化映射 + 魔法/契约/变形/生死四元素三元结构',
    });
  }

  // 世界观九柱法：按题材复杂度分档推荐（注入 novel.1.1）
  // 玄幻/仙侠/异能/科幻 85；悬疑/权谋 78；言情/都市 70；短篇/治愈不推
  const worldComplexGenres = ['修仙', '玄幻', '仙侠', '神魔', '奇幻', '魔法', '异世界', '穿越',
    '超能力', '异能', '灵异', '克苏鲁', '无限流', '科幻', '硬科幻', '末世', '赛博'];
  const worldMidGenres = ['悬疑', '推理', '侦探', '本格', '权谋', '宫斗', '政治', '架空历史', '规则怪谈'];
  const worldLightGenres = ['言情', '现言', '古言', '古风', '武侠', '江湖', '都市', '现实'];
  const worldSoftGenre = genres.some((g) => g.includes('治愈') || g.includes('日常')
    || g.includes('校园日常') || g.includes('散文'));
  if (scale !== 'short' && !worldSoftGenre) {
    if (genres.some((g) => worldComplexGenres.some((h) => g.includes(h)))) {
      out.push({
        id: 'world-building-9-pillars',
        score: 85,
        reason: '世界观复杂度高的题材：9 柱骨架 + 渐进揭示节奏 + 世界级悬念表 + 7 条禁忌',
      });
    } else if (genres.some((g) => worldMidGenres.some((h) => g.includes(h)))) {
      out.push({
        id: 'world-building-9-pillars',
        score: 78,
        reason: '悬疑 / 权谋 / 架空：规则与势力清晰化是刚需，9 柱法防临时加设定',
      });
    } else if (genres.some((g) => worldLightGenres.some((h) => g.includes(h)))) {
      out.push({
        id: 'world-building-9-pillars',
        score: 70,
        reason: '按"题材简化映射"填 1–3/6/9 几柱即可，防开篇说明书和悬念时机混乱',
      });
    }
  }

  // 系统分析六子系统：权谋/商战/科幻/末世/架空历史 82 强推；玄幻仙侠 72；其他弱推或不推
  const systemsHeavyGenres = ['权谋', '宫斗', '政治', '商战', '金融', '科幻', '硬科幻',
    '末世', '赛博', '架空历史', '历史架空'];
  const systemsMidGenres = ['玄幻', '仙侠', '修真', '修仙', '神魔', '异世界'];
  const systemsLightGenres = ['悬疑', '推理', '都市', '现实', '言情'];
  const systemsAnti = scale === 'short' || genres.some((g) => g.includes('治愈')
    || g.includes('日常') || g.includes('校园日常') || g.includes('散文')
    || g.includes('密室') || g.includes('孤岛') || g.includes('封闭空间'));
  if (!systemsAnti) {
    if (genres.some((g) => systemsHeavyGenres.some((h) => g.includes(h)))) {
      out.push({
        id: 'systems-analysis-six',
        score: 82,
        reason: '系统复杂度高的题材：政治/军事/经济/商业/金融/魔法或科技六子系统微观运转规则',
      });
    } else if (genres.some((g) => systemsMidGenres.some((h) => g.includes(h)))) {
      out.push({
        id: 'systems-analysis-six',
        score: 72,
        reason: '玄幻/仙侠：门派 + 资源 + 战争三子系统强相关，与 world-building-9-pillars 正交',
      });
    } else if (scale !== 'medium' && scale !== 'long' && scale !== 'super_long') {
      // 跳过
    } else if (genres.some((g) => systemsLightGenres.some((h) => g.includes(h)))) {
      out.push({
        id: 'systems-analysis-six',
        score: 55,
        reason: '可只填政治 + 经济 2 个子系统，弱化使用',
      });
    }
  }

  // 雪花写作法：长篇/超长篇 65 通用推；中篇 55 弱推；短篇/散文不推
  if (scale === 'super_long' || scale === 'long') {
    out.push({
      id: 'snowflake-method-7steps',
      score: 65,
      reason: `${scale === 'super_long' ? '超长篇' : '长篇'}立项稳固刚需：一句话≤25字硬律 + 五句话灾难三作用 + 人物5问法`,
    });
  } else if (scale === 'medium') {
    out.push({
      id: 'snowflake-method-7steps',
      score: 55,
      reason: '中篇可选：用一句话+五句话先收紧主线，避免越写越散',
    });
  }

  // 爽文/网文节奏全家桶：爽文/系统流/重生/穿越/修仙/都市异能 85 强推；都市言情/古言/灵异/武侠 78 推；严肃/短篇/治愈不推
  const webfictionStrong = ['爽文', '网文', '系统', '重生', '穿越', '快穿',
    '修仙', '修真', '战神', '神豪', '龙王', '兵王', '神医', '玄学', '都市异能', '异能'];
  const webfictionMid = ['都市', '言情', '古言', '现言', '灵异', '玄幻', '仙侠', '武侠', '甜宠'];
  const webfictionAnti = scale === 'short' || genres.some((g) => g.includes('治愈')
    || g.includes('日常') || g.includes('校园日常') || g.includes('散文')
    || g.includes('严肃') || g.includes('纯爱') || g.includes('文学'));
  if (!webfictionAnti) {
    if (genres.some((g) => webfictionStrong.some((h) => g.includes(h)))) {
      out.push({
        id: 'webfiction-pacing-pack',
        score: 85,
        reason: '爽文/网文核心题材：单章5段式 + 长篇5阶段 + 爽点4步公式 + 11条专属禁区',
      });
    } else if (genres.some((g) => webfictionMid.some((h) => g.includes(h)))) {
      out.push({
        id: 'webfiction-pacing-pack',
        score: 78,
        reason: '商业向中长篇：节奏 + 钩子 + 对话密度规范，与 anti-ai/plot-coherence 双开互补',
      });
    } else if (genres.some((g) => g.includes('悬疑') || g.includes('推理'))) {
      out.push({
        id: 'webfiction-pacing-pack',
        score: 65,
        reason: '钩子设计与单章5段式可借鉴；与 three-density-review 互补使用',
      });
    }
  }

  // 三密度审查法：孤岛/密室/封闭空间/规则怪谈 强推；悬疑/推理通用 中推；爽文/言情不推
  const closedSpaceHints = ['孤岛', '密室', '封闭空间', '暴风雪山庄', '规则怪谈',
    '异常', '克苏鲁', '灵异', '本格', 'SCP'];
  const mysteryGeneral = ['悬疑', '推理', '侦探', '惊悚', '恐怖', '怪谈'];
  const antiDensity = tone.includes('fast') || tone.includes('cool') || tone.includes('hype')
    || tone.includes('pleasure') || tone.includes('calm') || tone.includes('warm')
    || genres.some((g) => g.includes('言情') || g.includes('甜宠') || g.includes('治愈')
      || g.includes('日常') || g.includes('系统') || g.includes('爽文'));
  if (!antiDensity) {
    if (genres.some((g) => closedSpaceHints.some((h) => g.includes(h)))) {
      out.push({
        id: 'three-density-review',
        score: 85,
        reason: '孤岛/密室/规则怪谈专用：三密度硬律 + 恐惧四层递进 + 答案前置 + 孤岛每 2 章打破规则',
      });
    } else if (genres.some((g) => mysteryGeneral.some((h) => g.includes(h)))) {
      out.push({
        id: 'three-density-review',
        score: 75,
        reason: '悬疑/推理项目：三密度单章审查（剧情+信息+情绪缺一重写），与 12 步骨架强互补',
      });
    }
  }

  // 情节连贯性脚手架：长篇强推荐（反散架），中篇中推荐，短篇不推
  if (scale === 'super_long' || scale === 'long') {
    out.push({
      id: 'plot-coherence-scaffold',
      score: scale === 'super_long' ? 85 : 80,
      reason: `${scale === 'super_long' ? '超长篇' : '长篇'}最容易散架，因果链 + 伏笔追踪 + 人设一致是刚需`,
    });
  } else if (scale === 'medium') {
    out.push({
      id: 'plot-coherence-scaffold',
      score: 68,
      reason: '中篇有多条支线时，因果链 + 伏笔追踪能显著提升完结率',
    });
  }

  // 祛 AI 味（反 AI 文风）：几乎所有小说项目都推荐
  // 基础分 70；文学/严肃项目 82；爽文/商业 78；治愈/日常 75；剧本格式 / 纯科普说明不推
  const isScriptFormat = genres.some((g) => g.includes('剧本') || g.includes('台本'));
  const isExpository = genres.some((g) => g.includes('科普') || g.includes('说明') || g.includes('技术文'));
  if (!isScriptFormat && !isExpository) {
    let antiAiScore = 70;
    let antiAiReason = 'AI 味是所有 AI 小说的通用问题，加毛刺、打碎完整句式、模糊不确定是刚需';
    if (literaryTone || trubyTone) {
      antiAiScore = 82;
      antiAiReason = '严肃文学 / 文学调性：文笔要求最高，祛 AI 味技法 8 条 + 自检清单 7 条直接喂给润色';
    } else if (tone.includes('fast') || tone.includes('cool') || tone.includes('hype') || tone.includes('pleasure')) {
      antiAiScore = 78;
      antiAiReason = '爽文 / 商业网文：更需要"人味口语感"来区别于 AI 统一腔';
    } else if (tone.includes('calm') || tone.includes('warm')
      || genres.some((g) => g.includes('治愈') || g.includes('日常') || g.includes('种田'))) {
      antiAiScore = 75;
      antiAiReason = '治愈 / 日常：生活气息和毛刺细节是人味来源，祛 AI 味技法必备';
    }
    out.push({
      id: 'anti-ai-flavor',
      score: antiAiScore,
      reason: antiAiReason,
    });
  }

  // 视听语言脱水法（镜头化写作）—— 仅对冷峻 / 影视改编向项目推荐，且要避开心流 / 治愈类
  const cinematicHints = ['悬疑', '推理', '科幻', '硬科幻', '都市', '现实', '犯罪', '黑色', '末世', '惊悚'];
  const cinematicTone = tone.includes('cold') || tone.includes('dark') || tone.includes('hard')
    || tone.includes('cinematic') || tone.includes('noir');
  const softGenre = genres.some((g) =>
    calmHints.some((h) => g.includes(h))
    || g.includes('后宫') || g.includes('甜宠') || g.includes('宠文')
    || g.includes('系统') || g.includes('种田') || g.includes('治愈'));
  if (!softGenre && (cinematicTone || genres.some((g) => cinematicHints.some((h) => g.includes(h))))) {
    out.push({
      id: 'visual-dehydration',
      score: cinematicTone ? 78 : 70,
      reason: '冷峻 / 影视感题材，镜头化笔法（情绪→肢体 / 对话推剧情）能强化质感',
    });
  }

  // ── 章节焊接 / 角色一致性 / 密度切分（gap-f micro-PR · 通用工艺增强）─────
  // 章节衔接 7 过门：所有连载（long/super_long/medium）均推荐
  if (scale === 'long' || scale === 'super_long' || scale === 'medium') {
    out.push({
      id: 'chapter-transition-7methods',
      score: scale === 'super_long' ? 80 : scale === 'long' ? 75 : 65,
      reason: `${scale === 'super_long' ? '超长篇' : scale === 'long' ? '长篇' : '中篇'}章节衔接刚需：7 种过门方式 + 接力物机制让读者零跳读`,
    });
  }

  // 角色视觉 ID 卡：长篇 + 多角色题材强推；其他长篇弱推
  const multiCharGenres = ['群像', '多主角', '宫斗', '权谋', '武侠', '玄幻', '仙侠', '修真', '异世界', '架空', '奇幻'];
  const isLongScale = scale === 'long' || scale === 'super_long';
  if (isLongScale && genres.some((g) => multiCharGenres.some((h) => g.includes(h)))) {
    out.push({
      id: 'character-visual-id-card',
      score: 80,
      reason: '多角色长篇刚需：5 维 ID 卡（体型/面部锚点/发型/服装/视觉签名）防角色描述漂移',
    });
  } else if (isLongScale) {
    out.push({
      id: 'character-visual-id-card',
      score: 65,
      reason: '长篇推荐：视觉 ID 卡锁定外观，跨章节防漂移',
    });
  }

  // 内容密度装填：通用（除短篇外都推）
  if (scale && scale !== 'short') {
    out.push({
      id: 'content-density-filling',
      score: 65,
      reason: '场景切分工业化决策树：4 级密度判断 + 4 切点选择 + 对话密度处理',
    });
  }

  // IP 改编 SOP：createMode === 'adaptation' 强推
  if ((ctx as { createMode?: string }).createMode === 'adaptation') {
    out.push({
      id: 'ip-adaptation-sop',
      score: 90,
      reason: '改编项目核心 SOP：清洗（去水去油）+ 对标（三大方向）+ 重构（加钩子加节奏）',
    });
  }

  // 商业付费点：商业平台（起点/番茄/晋江等）+ 长篇 → 强推；任何长篇 → 弱推
  const isCommercialPlatform = platform.includes('qidian') || platform.includes('17k')
    || platform.includes('zongheng') || platform.includes('jjwxc') || platform.includes('fanqie');
  if (isCommercialPlatform && isLongScale) {
    out.push({
      id: 'serialization-paid-hooks',
      score: 82,
      reason: '商业连载付费点设计：3 段位（10-12 集/20-25 集/结局）让付费转化率最大化',
    });
  } else if (isLongScale) {
    out.push({
      id: 'serialization-paid-hooks',
      score: 60,
      reason: '长篇连载可参考 3 段位付费点布局，做宏观钩子节奏管理',
    });
  }

  // ── 去重（同 id 取最高分）+ 排序 ───────────────────────────────
  const map = new Map<string, ModuleRecommendation>();
  for (const r of out) {
    const cur = map.get(r.id);
    if (!cur || r.score > cur.score) map.set(r.id, r);
  }
  return [...map.values()].sort((a, b) => b.score - a.score);
}

/** 推荐强度文本 */
export function recommendationStrength(score: number): 'strong' | 'mild' | 'weak' | 'none' {
  if (score >= 80) return 'strong';
  if (score >= 65) return 'mild';
  if (score >= 50) return 'weak';
  return 'none';
}

/* ── P9-F · LLM 兑底推荐 ─────────────────────────── */

const LLM_RECO_SYSTEM = `你是网络小说创作方法论顾问。
用户会提供：
  · 项目特征（题材 / 平台 / 体量 / 调性 / 受众 / POV / 核心冲突等）
  · 可用方法论模块列表（id + 标题 + 一句话简介）

你的任务：仅输出严格 JSON 数组（最多 5 项，按推荐度降序）：
\`\`\`json
[
  { "id": "<模块 id>", "score": 0–100整数, "reason": "≤ 40 字中文理由" }
]
\`\`\`
铁律：
· score 表示推荐度；只输出你认为该项目值得启用的模块
· 不要输出 JSON 以外的文字（用于机器解析）
· 同一项目同一结构层 只选一个（互斥遵从 manifest）
· reason 要具体，面向本项目的状况，不要玩抽象形容词
`.trim();

export interface LlmRecoSettings {
  baseUrl: string;
  apiKey: string;
  model: string;
}

/**
 * P9-F 调用 LLM 补充推荐。
 * 使用场景：启发式推荐全都 < 65 分，或项目有「核心冲突 / logline」等启发式读不懂的自由文本。
 * 调用一次，预计 ≤ 800 token 。
 */
export async function recommendMethodModulesLLM(opts: {
  ctx: Partial<ProjectContext>;
  modules: MethodModuleItem[];
  settings: LlmRecoSettings;
  signal?: AbortSignal;
}): Promise<ModuleRecommendation[]> {
  const { ctx, modules, settings, signal } = opts;
  if (modules.length === 0) return [];

  const projectFacts: string[] = [];
  const push = (label: string, val: unknown) => {
    if (val === undefined || val === null) return;
    if (Array.isArray(val) && val.length === 0) return;
    if (typeof val === 'string' && val.trim().length === 0) return;
    projectFacts.push(`- **${label}**：${Array.isArray(val) ? val.join(', ') : String(val)}`);
  };
  push('题材', ctx.genres);
  push('平台', ctx.novelPlatform);
  push('体量', ctx.novelScale);
  push('调性', ctx.novelTone);
  push('受众', ctx.novelAudience);
  push('POV', ctx.novelPov);
  push('主角性别', ctx.protagonistGender);
  push('核心冲突', ctx.coreConflict);
  push('logline', ctx.novelLogline);
  push('一句话钩子', ctx.novelHook);

  const moduleList = modules
    .map((m) => `- \`${m.id}\` · ${m.title} · ${m.summary}`)
    .join('\n');

  const userMsg = [
    '## 项目特征',
    projectFacts.length > 0 ? projectFacts.join('\n') : '（暂无明确信息）',
    '',
    '## 可用方法论模块',
    moduleList,
    '',
    '请按 system 要求输出 JSON 。',
  ].join('\n');

  const res = await chatStream({
    baseUrl: settings.baseUrl,
    apiKey: settings.apiKey,
    model: settings.model,
    temperature: 0.2,
    max_tokens: 800,
    messages: [
      { role: 'system', content: LLM_RECO_SYSTEM },
      { role: 'user', content: userMsg },
    ],
    signal,
  });

  return parseLlmReco(res.content, new Set(modules.map((m) => m.id)));
}

function parseLlmReco(raw: string, knownIds: Set<string>): ModuleRecommendation[] {
  // 接受 ```json fence 或裸 JSON
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const jsonText = fenced ? fenced[1] : raw;
  let parsed: unknown;
  try { parsed = JSON.parse(jsonText.trim()); }
  catch {
    // 兑底：粗提取从 [ 到 ] 的第一段
    const arr = jsonText.match(/\[[\s\S]*\]/);
    if (!arr) return [];
    try { parsed = JSON.parse(arr[0]); } catch { return []; }
  }
  if (!Array.isArray(parsed)) return [];
  const out: ModuleRecommendation[] = [];
  for (const item of parsed) {
    if (!item || typeof item !== 'object') continue;
    const obj = item as Record<string, unknown>;
    const id = typeof obj.id === 'string' ? obj.id : null;
    const score = typeof obj.score === 'number' ? Math.max(0, Math.min(100, Math.round(obj.score))) : null;
    const reason = typeof obj.reason === 'string' ? obj.reason.slice(0, 120) : '';
    if (!id || score == null || !knownIds.has(id)) continue;
    out.push({ id, score, reason, source: 'llm' });
  }
  return out.sort((a, b) => b.score - a.score);
}

/**
 * 合并启发式 + LLM 推荐列表：同 id 取较高分；source 优先保留 LLM（表示 “有 LLM 背书”）。
 */
export function mergeRecommendations(
  heuristic: ModuleRecommendation[],
  llm: ModuleRecommendation[],
): ModuleRecommendation[] {
  const map = new Map<string, ModuleRecommendation>();
  for (const r of heuristic) map.set(r.id, { ...r, source: r.source ?? 'heuristic' });
  for (const r of llm) {
    const cur = map.get(r.id);
    if (!cur) {
      map.set(r.id, { ...r, source: 'llm' });
    } else {
      map.set(r.id, {
        id: r.id,
        score: Math.max(cur.score, r.score),
        reason: r.reason || cur.reason,
        source: 'llm', // LLM 背书优先显示
      });
    }
  }
  return [...map.values()].sort((a, b) => b.score - a.score);
}

/* ───────────────────────────────────────────────────────────────────
 * v2 阶段 2.3 · 题材兼容性矩阵 post-process
 * ─────────────────────────────────────────────────────────────────── */

/**
 * 根据 manifest 的 `genreCompat` 字段，对推荐结果做分数调整。
 *
 * 规则（与 validateMethodModuleGenres 语义一致）：
 *  - `incompatible` 命中：score = min(score, 25)，reason 前缀 `⛔ 与题材[X]冲突：`
 *  - `warnOnEnable` 命中：score 减 15，reason 前缀 `⚠️ 题材[X]兼容弱：`
 *  - `recommended` 命中（且未触发上述）：score = min(95, +5)，reason 后缀 ` ✓题材契合`
 *
 * 该函数只调整 score 与 reason，不增删条目，不破坏 [0, 100] 范围。
 * 调用方：MethodModulePanel 在 manifest 加载完成后调用一次即可。
 */
export function applyGenreCompatToRecommendations(
  recs: ModuleRecommendation[],
  ctx: Partial<ProjectContext>,
  manifest: MethodModuleManifest,
): ModuleRecommendation[] {
  const userGenres = ctx.genres ?? [];
  if (userGenres.length === 0) return recs;

  const modIndex = new Map<string, MethodModuleItem>();
  for (const m of manifest.modules) modIndex.set(m.id, m);

  return recs.map((r) => {
    const compat = modIndex.get(r.id)?.genreCompat;
    if (!compat) return r;

    const incompat = (compat.incompatible ?? []).filter((g) => userGenres.includes(g));
    if (incompat.length > 0) {
      return {
        ...r,
        score: Math.min(r.score, 25),
        reason: `⛔ 与题材[${incompat.join('/')}]冲突：${r.reason}`,
      };
    }

    const warn = (compat.warnOnEnable ?? []).filter((g) => userGenres.includes(g));
    if (warn.length > 0) {
      return {
        ...r,
        score: Math.max(0, r.score - 15),
        reason: `⚠️ 题材[${warn.join('/')}]兼容弱：${r.reason}`,
      };
    }

    const rec = (compat.recommended ?? []).filter((g) => userGenres.includes(g));
    if (rec.length > 0) {
      return {
        ...r,
        score: Math.min(95, r.score + 5),
        reason: `${r.reason} ✓题材契合`,
      };
    }
    return r;
  }).sort((a, b) => b.score - a.score);
}
