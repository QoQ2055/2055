// 项目分类常量：原子题材 / 平台 / 主角性别 / 时长 / 改编原作类型
// 借鉴 ShadowScript影语 的成熟分类体系并裁剪到短剧场景。

// ─────────────────────── 题材（原子化，可 1-3 个组合） ───────────────────────

/**
 * 题材锚点配置（GenreAnchor）— 提供题材级硬约束注入到创作 prompt。
 *
 * 设计要点：
 * - 与现有 ProjectContext 字段互补，不重叠：
 *   · 不含 writingStyle / emotionalTone（由 novelTone 控制）
 *   · 不含 narrativePerspective（由 novelPov 控制）
 *   · 不含 targetWordCount（由 novelPlatform.wordsPerChapter × novelScale 派生）
 * - 多题材组合（最多 3）时由 buildGenreAnchorPreamble() 合并去重
 * - 所有字段都是可选，缺失时降级为通用约束
 *
 * Reference: docs/internal-notes/genre-anchor-system-spec.md
 */
export interface GenreAnchor {
  /**
   * 世界观核心硬规则（80-200 字）。
   * 例：玄幻的"力量提升必须有代价"、科幻的"技术设定内部自洽"。
   * 在 LLM 输出与世界观规则冲突时，优先级高于 user 局部指令。
   */
  worldRules?: string;
  /**
   * 人称运用细则（30-100 字）。
   * 例：恐怖第一人称要求"3 句以上不连续以'我'起句"。
   * fili-web 通过 novelPov 选具体视角，本字段补充"如何在该视角下细粒度切换"。
   */
  pronounUsage?: string;
  /**
   * 题材必备爽点 / 元素清单（5-7 项，每项 4-12 字）。
   * 在创作 prompt 中以"必须包含"形式注入，弱约束（不强制全占齐，但应覆盖主要项）。
   */
  mustInclude?: string[];
  /**
   * 题材污染清单（5-8 项，每项 4-12 字）。
   * 强约束 — LLM 输出包含这些元素时即视为违反题材锚定。
   * 例：仙侠 mustAvoid 含"系统面板"、"现代用语"。
   */
  mustAvoid?: string[];
  /**
   * 默认段落字数（提示 LLM，非硬上限）。
   * 不同题材的"段落呼吸感"差异显著：轻小说 ~120，历史 ~240。
   */
  paragraphLength?: number;
  /**
   * 默认对话比例（百分比，提示 LLM 不强制）。
   * 言情/轻小说 40-45，科幻/历史/仙侠 22-25。
   */
  dialogueRatio?: number;
  /**
   * 节奏配方（开局→中段→高潮→结尾的一句话节奏总结）。
   * 例：玄幻"开局冲突/危机→快速升级/奇遇→强者对决与反转→结尾留悬念"。
   */
  rhythmRequirement?: string;
}

export interface GenreItem {
  value: string;
  label: string;
  hint: string;
  group: GenreGroup;
  /** 题材锚点配置（可选）。未配置时仅作分类标签使用。 */
  anchor?: GenreAnchor;
}
export type GenreGroup =
  | '东方玄幻' | '都市/现实' | '悬疑/惊悚' | '科幻/末世'
  | '历史/架空' | '西幻/奇幻' | '情感/校园' | '特殊';

export const GENRES: GenreItem[] = [
  // 东方玄幻
  { value: 'xianxia',     label: '仙侠/修真',  hint: '宗门、飞升、渡劫、金丹元婴',     group: '东方玄幻' },
  { value: 'xuanhuan',    label: '玄幻',       hint: '大陆争霸、异兽灵根、斗气武魂',   group: '东方玄幻' },
  { value: 'wuxia',       label: '武侠',       hint: '江湖、武林、门派、侠义',         group: '东方玄幻' },
  // 都市/现实
  { value: 'urban',       label: '都市',       hint: '现代都市、职场、商战',           group: '都市/现实' },
  { value: 'urban_super', label: '都市异能',   hint: '现代背景 + 金手指 / 系统',         group: '都市/现实' },
  { value: 'system',      label: '系统流',     hint: '游戏化界面、任务、签到',         group: '都市/现实' },
  { value: 'rebirth',     label: '重生/穿越',  hint: '重生回到过去、灵魂穿越',         group: '都市/现实' },
  { value: 'workplace',   label: '职场',       hint: '都市女性 / 男性职场逆袭',         group: '都市/现实' },
  { value: 'ceo',         label: '霸总',       hint: '总裁 × 灰姑娘 / 契约婚姻',         group: '都市/现实' },
  // 悬疑/惊悚
  { value: 'mystery',     label: '悬疑',       hint: '孤岛、密室、心理惊悚',           group: '悬疑/惊悚' },
  { value: 'reasoning',   label: '推理',       hint: '本格、社会派、密室推理',         group: '悬疑/惊悚' },
  { value: 'thriller',    label: '惊悚/恐怖',  hint: '克苏鲁、灵异、心理恐怖',         group: '悬疑/惊悚' },
  // 科幻/末世
  { value: 'scifi',       label: '科幻',       hint: '近未来、太空歌剧、硬科幻',       group: '科幻/末世' },
  { value: 'cyberpunk',   label: '赛博朋克',   hint: '高科技 + 低生活、数字义体',       group: '科幻/末世' },
  { value: 'apocalypse',  label: '末世/废土',  hint: '末日求生、丧尸、辐射',           group: '科幻/末世' },
  // 历史/架空
  { value: 'history',     label: '历史/正剧',  hint: '真实历史年代为骨',               group: '历史/架空' },
  { value: 'alt_history', label: '架空历史',   hint: '虚构朝代、政权、文明',           group: '历史/架空' },
  { value: 'palace',      label: '宫斗/宅斗',  hint: '宫廷权谋、嫡庶之争',             group: '历史/架空' },
  { value: 'intrigue',    label: '权谋',       hint: '朝堂、枭雄、谋略',               group: '历史/架空' },
  { value: 'era_drama',   label: '年代/民国',  hint: '建国、民国、七八十年代',         group: '历史/架空' },
  // 西幻/奇幻
  { value: 'fantasy',     label: '西幻',       hint: '魔法、龙、精灵矮人',             group: '西幻/奇幻' },
  { value: 'dnd',         label: 'DnD/剑魔',   hint: '职业系统、冒险者公会',           group: '西幻/奇幻' },
  { value: 'dark_fantasy',label: '黑暗奇幻',   hint: '血腥残酷、道德灰暗',             group: '西幻/奇幻' },
  // 情感/校园
  { value: 'romance',     label: '言情',       hint: '现代言情、破镜重圆',             group: '情感/校园' },
  { value: 'sweet',       label: '甜宠',       hint: '轻松甜腻、少虐多撒糖',           group: '情感/校园' },
  { value: 'campus',      label: '校园',       hint: '校园恋爱、校霸校草',             group: '情感/校园' },
  { value: 'youth',       label: '青春',       hint: '成长、疼痛、毕业离别',           group: '情感/校园' },
  // 特殊
  { value: 'infinite',    label: '无限流',     hint: '副本、轮回、世界穿越',           group: '特殊' },
  { value: 'esports',     label: '电竞/游戏',  hint: '电竞战队、虚拟现实',             group: '特殊' },
  { value: 'farming',     label: '种田/基建',  hint: '日常向、基建发展、经营',         group: '特殊' },
  { value: 'fast_wear',   label: '快穿',       hint: '多世界任务、身份流转',           group: '特殊' },
];

export const MAX_GENRES = 3;

export function findGenre(value: string): GenreItem | undefined {
  return GENRES.find((g) => g.value === value);
}

/**
 * 题材锚点数据库（15 个核心题材的硬约束配置）。
 *
 * 设计原则：
 * - 与 GENRES 数组解耦，便于独立维护 / 后续扩展更多题材
 * - 仅覆盖 fili-web 主战场题材（其余题材后续按需补充）
 * - 数据提炼自天命平台 19 题材规范（docs/internal-notes/genre-anchor-system-spec.md）
 *   并改写为 fili-web 体系契合版本（剔除天命已被 fili-web novelPov / novelTone /
 *   novelPlatform / novelScale 覆盖的字段）
 *
 * 多题材组合时由 compose.ts/buildGenreAnchorPreamble() 合并去重。
 */
export const GENRE_ANCHORS: Record<string, GenreAnchor> = {
  // ───── 东方玄幻 ─────
  xuanhuan: {
    worldRules:
      '力量提升必须有代价与条件（资源/机缘/苦修/生死磨砺）；战斗遵循境界差距与克制关系（越级战斗需有合理依仗）；势力冲突有现实利益链（资源/地盘/传承/名望）；主角的优势来自奇遇+努力+智慧，非单纯血统碾压。',
    pronounUsage:
      '战斗动作、境界突破可用姓名开头强化节奏感；内心感悟、力量感知用代词跟进；多人对决场景优先用姓名避免代词歧义。',
    mustInclude: ['境界突破', '强者对决', '功法修炼', '天材地宝', '势力争锋', '爽点反击'],
    mustAvoid: ['现代科技', '仙侠道韵风格', '现代网络梗', '无逻辑碾压', '突然开挂无代价', '过度说教', '系统面板'],
    paragraphLength: 190,
    dialogueRatio: 28,
    rhythmRequirement: '开局冲突/危机 → 快速升级/奇遇 → 强者对决与反转 → 结尾留悬念推动下一章',
  },
  xianxia: {
    worldRules:
      '修为提升需机缘+苦修+代价；斗法遵循法宝/阵法/符箓/神通的克制与消耗；天劫渡劫有征兆、有准备、有后果。讲"道心"与"取舍"，仙途漫长。',
    pronounUsage:
      '动作序列可用姓名开头，内心活动、道心波动用代词跟进；多角色场景优先用姓名避免代词歧义。',
    mustInclude: ['仙法斗法', '道心磨砺', '天劫渡劫', '洞天福地', '师徒传承', '因果代价'],
    mustAvoid: ['现代用语', '科技元素', '系统面板', '过度白话', '网络梗', '无代价的无敌挂', '玄幻爽文口吻'],
    paragraphLength: 175,
    dialogueRatio: 22,
    rhythmRequirement: '开局立"道"与冲突 → 中段机缘/磨砺 → 斗法或渡劫高潮 → 结尾留下更高境界/更大因果',
  },
  wuxia: {
    worldRules:
      '武功以内力为根基，招式为外显；习武需师承或奇遇；实战讲究招式克制、内力深浅、临场应变与心境；高手对决重在意境与气势，而非数值碾压。武功再高也受人体极限约束，不可飞天遁地。',
    pronounUsage:
      '招式对决中可用姓名开头强化节奏感，内心运功、判断、情绪用代词跟进；多人对决优先用姓名避免代词歧义。',
    mustInclude: ['武功招式对决', '江湖门派恩怨', '侠义精神', '师承传承', '行走江湖', '阴谋反转'],
    mustAvoid: ['修仙飞升', '境界突破体系', '系统面板', '现代科技', '玄幻化能量爆发', '超自然鬼怪', '西方奇幻元素'],
    paragraphLength: 170,
    dialogueRatio: 30,
    rhythmRequirement: '开局江湖事件/恩怨 → 中段习武成长/门派纷争 → 高潮对决（招式拆解+心理博弈） → 结尾恩怨了结或更大阴谋',
  },
  // ───── 都市/现实 ─────
  urban: {
    worldRules:
      '关键冲突必须能落到现实规则（合同/流程/舆论/资本/关系链/法律边界）；爽点来自智斗/布局/临场应对，而非无脑碾压。',
    mustInclude: ['商战博弈', '人脉经营', '身份反转', '都市生活细节', '感情纠葛', '现实规则约束'],
    mustAvoid: ['过度超自然', '脱离现实逻辑', '开局无敌不需努力', '无脑装逼打脸', '过度后宫描写', '官话套话长篇说教'],
    paragraphLength: 150,
    dialogueRatio: 42,
    rhythmRequirement: '开局困境/目标 → 中段人脉与资源博弈 → 关键反转与打脸（有逻辑证据） → 结尾抛新坑',
  },
  system: {
    worldRules:
      '系统必须有明确的规则边界 — 能做什么/不能做什么/获取成本/冷却时间/使用限制必须一经确立不可随意更改；系统奖励与付出匹配，不可无限白嫖；系统不是万能的，必须有盲区与限制；主角成功 = 系统辅助 + 个人判断力 + 努力。',
    pronounUsage:
      '系统提示以【】或特殊格式呈现，与正文叙述明确区分；战斗/关键决策用姓名开头，内心与系统对话用代词跟进。',
    mustInclude: ['系统界面简洁展示', '系统规则合理运用', '主角对系统机制的策略', '成长阶段感', '系统限制带来的挑战', '隐藏在系统背后的谜团'],
    mustAvoid: ['系统提示大段刷屏', '纯数据罗列', '系统无限制白给', '主角不动脑纯靠系统', '系统规则前后矛盾', '数值描写占比超过正文'],
    paragraphLength: 150,
    dialogueRatio: 30,
    rhythmRequirement: '开局系统激活/绑定+首次使用 → 中段利用规则稳步发展、发现隐藏功能 → 高潮系统能力关键发挥/规则边界考验 → 结尾系统升级或新功能解锁',
  },
  rebirth: {
    worldRules:
      '先知优势必须有衰减 — 随主角介入历史/剧情偏离原轨道，前世记忆指导价值逐步降低；身份融入是关键挑战；蝴蝶效应有因果逻辑；前世记忆/现代知识运用必须考虑技术条件、材料限制、社会接受度。',
    mustInclude: ['先知优势的合理运用与衰减', '身份适应与融入过程', '今昔对比的情感冲击', '蝴蝶效应连锁反应', '前世与新生活的取舍', '改变命运的代价'],
    mustAvoid: ['先知优势永不衰减全程碾压', '穿越后完美适应', '现代知识无视条件直接使用', '前世关系对新生活毫无影响', '改变命运毫无代价'],
    paragraphLength: 155,
    dialogueRatio: 35,
    rhythmRequirement: '开局穿越/重生+确认身份 → 中段利用先知布局、改变关键事件 → 高潮蝴蝶效应带来意外/先知优势失效 → 结尾命运改写后的新局面',
  },
  // ───── 悬疑/惊悚 ─────
  mystery: {
    worldRules:
      '严格遵循现实世界规则，无超自然现象；证据链必须完整可回溯；凶手动机有心理/社会基础；诡计设计需巧妙但不违反物理常识；读者获得的信息与侦探同步（公平推理）。',
    pronounUsage:
      '外部动作、现场勘查可用姓名开头，内心推演、逻辑链条用代词跟进；多角色对话/证据交锋优先用姓名避免歧义。',
    mustInclude: ['核心谜题与逻辑解答', '证据链与线索布局', '嫌疑人与动机分析', '误导与反转', '人性探讨', '推理过程展示'],
    mustAvoid: ['超自然/灵异元素', '鬼怪邪祟', '科幻设定', '修仙玄幻元素', '无逻辑巧合破案', '证据凭空出现', '直觉破案'],
    paragraphLength: 180,
    dialogueRatio: 30,
    rhythmRequirement: '开局案件发生 → 中段调查取证、嫌疑人交叉（真线索与误导线索并行） → 高潮真相揭露与逻辑链闭合 → 结尾反思或留下余韵',
  },
  thriller: {
    worldRules:
      '中式灵异恐怖（民俗灵异/都市怪谈/规则怪谈/诡异复苏）；超自然现象必须遵循因果、代价、禁忌三要素；鬼/邪祟有自身行为规律（可被洞察和利用）；线索与反转必须可回溯。',
    pronounUsage:
      '采用贴近主角的限知写法，恐惧感知、心理波动写出贴脸的亲历质感；一旦出现多人同场或可能指代混淆，立刻改用角色姓名/称谓并补充动作锚点。',
    mustInclude: ['鬼怪/邪祟实体', '诡异事件与杀人规律', '环境渲染（日常被侵蚀）', '线索暗示与规则解谜', '民俗禁忌与因果报应', '禁忌代价'],
    mustAvoid: ['科幻概念混入（模因/认知污染/信息论）', '克苏鲁外神/触手意象', '赛博朋克/高科技风', '西方宗教驱魔套路', '修仙体系混入', '系统面板', '破坏氛围的搞笑段子'],
    paragraphLength: 140,
    dialogueRatio: 25,
    rhythmRequirement: '开局抛出怪异 → 逐步加码 → 中段信息对齐与误导 → 末段反转揭秘并留下余味',
  },
  // ───── 科幻/末世 ─────
  scifi: {
    worldRules:
      '关键技术设定必须内部自洽（能量/通信/推进/材料/AI 边界 — 可虚构但不可自相矛盾）；冲突来自资源、伦理、治理、文明差异、技术失控；战斗/对抗遵循设定内的技术逻辑。',
    mustInclude: ['科技设定自洽', '技术驱动的核心冲突', '未来社会形态或文明结构', '科学逻辑链条', '人与技术的关系探讨', '危机升级'],
    mustAvoid: ['魔法/修仙元素混入', '无科学依据的超能力', '用玄幻方式解释科技', '随意时间旅行不讲代价', '灵异鬼怪元素', '过度感性抒情替代逻辑推演'],
    paragraphLength: 220,
    dialogueRatio: 22,
    rhythmRequirement: '开局抛出技术/危机 → 中段验证与升级 → 文明/组织冲突升级 → 结尾给出更大尺度的未知',
  },
  apocalypse: {
    worldRules:
      '资源极度稀缺是底层逻辑 — 食物/水源/药品/弹药/燃料/安全区一切行动围绕资源；末日威胁有一致的内部规则；人性是核心矛盾（信任/背叛、利他/自私、秩序/混乱）；势力的行为逻辑基于资源控制；死亡威胁必须真实，重要配角可以死亡。',
    mustInclude: ['资源争夺与管理', '生存环境描写', '人性博弈与信任考验', '末日威胁的压迫感', '势力冲突与合作', '生死抉择'],
    mustAvoid: ['无忧无虑的末日生活', '资源凭空出现', '主角无敌不受威胁', '末日变度假', '过度科幻设定冲淡末日感', '轻松搞笑基调'],
    paragraphLength: 170,
    dialogueRatio: 30,
    rhythmRequirement: '开局灾变降临 → 中段搜索资源/建据点/势力摩擦 → 高潮人性抉择/大规模威胁 → 结尾短暂喘息但危机升级',
  },
  // ───── 西幻/奇幻 ─────
  fantasy: {
    worldRules:
      '魔法体系要有来源、规则与代价；神祇/诅咒/预言必须与历史传说对应；政治与战争有后勤与利益逻辑。',
    mustInclude: ['魔法体系', '种族文明', '史诗战役', '神话传说', '冒险探索', '魔法代价'],
    mustAvoid: ['东方修仙元素混入', '系统面板', '现代科技', '过度日常化', '无逻辑的魔法万能', '破坏世界观一致性', '网络梗'],
    paragraphLength: 200,
    dialogueRatio: 28,
    rhythmRequirement: '开局使命/异变 → 中段组队与地图推进 → 史诗战役或遗迹高潮 → 结尾埋下更古老的黑暗',
  },
  // ───── 情感/校园 ─────
  romance: {
    worldRules:
      '感情发展必须有合理的心理基础和事件推动，不可无缘无故爱上；人物性格一致且有成长弧线；配角不是工具人；情敌/阻碍必须有逻辑合理性；感情线与事业线/成长线交织推进。',
    pronounUsage:
      '第一人称叙事时心理描写、情感涌动、心动感知保留第一人称强化代入感；连续多句以"我"起句需切换为以姓名开头（如"林晚低头，指尖轻轻攥紧了裙角"），禁止 4 句以上连续以"我"起句；双视角交替时以姓名或场景切割明确视角归属。',
    mustInclude: ['情感递进与心理描写', '双方性格碰撞与磨合', '关键情感转折点', '生活细节与氛围营造', '配角关系网', '感情与成长并行'],
    mustAvoid: ['无逻辑的一见钟情', '男/女主无缺点的完美人设', '过度狗血无底线', '工具人配角', '感情线脱离主线独立存在', '过度肉体描写替代情感描写'],
    paragraphLength: 140,
    dialogueRatio: 40,
    rhythmRequirement: '开局命运交汇/初印象 → 中段误解与靠近交替、感情升温 → 高潮矛盾爆发/分离危机 → 结尾和解与情感升华',
  },
  // ───── 历史/架空 ─────
  palace: {
    worldRules:
      '严格遵循古代社会基本规则 — 等级制度/礼教规范/男女大防/嫡庶尊卑/皇权至上（架空可适度放宽但需自洽）；感情发展受身份地位/家族利益/礼法约束的真实阻碍；权谋/宅斗有现实利益基础（财产/继承权/圣宠/家族资源）；服饰、饮食、礼仪、称谓、官制需符合古代背景。',
    pronounUsage:
      '宫廷正式场合使用封号/官称（如"贵妃""世子"），私密场景可用闺名/昵称制造亲密感；多人场景优先用称谓/姓名避免代词歧义。',
    mustInclude: ['古代礼仪与社会规则', '权谋/宅斗策略', '情感含蓄递进', '服饰饮食等生活细节', '身份地位对感情的影响', '人物成长弧线'],
    mustAvoid: ['现代用语和思维方式', '不顾礼法的行为无后果', '所有男性角色围绕女主转', '无智商配角衬托主角', '架空却无规则可言', '过度白话文破坏古风氛围'],
    paragraphLength: 150,
    dialogueRatio: 38,
    rhythmRequirement: '开局身份确立/命运转折 → 中段权谋博弈与感情萌芽交替 → 高潮身份危机/情感抉择/权力洗牌 → 结尾情感升华与格局变化',
  },
  intrigue: {
    worldRules:
      '尽量遵循时代制度（官制、税制、军制、礼法、刑律）；重大历史背景不随意篡改；细节允许文学化但要"像那个时代的人"。',
    pronounUsage:
      '多角色场景优先用姓名或官职而非代词，减少他/他们指代歧义；主要人物以姓名与代词交替叙述；次要人物出场先报姓名再用代词。',
    mustInclude: ['朝堂权谋', '军事战争', '历史典故', '社会风貌', '人物传记', '制度约束'],
    mustAvoid: ['严重违背史实', '现代思维穿越', '过度戏说历史', '现代网络用语', '系统面板', '玄幻修仙元素混入'],
    paragraphLength: 240,
    dialogueRatio: 22,
    rhythmRequirement: '开局给出局势与危机 → 中段布局与人心博弈 → 战事/政变高潮 → 结尾回扣代价并埋新局',
  },
  // ───── 特殊 ─────
  infinite: {
    worldRules:
      '主神/系统是规则的制定者与仲裁者（前中期不可被欺骗或推翻）；每个副本世界有独立且自洽的内部规则；积分/道具/能力是核心货币体系；死亡是真实的（队友可永久死亡）；副本难度递增；队友间存在合作与竞争张力；主角成长来自副本经验+规则理解+能力获取。',
    pronounUsage:
      '副本规则推理、线索分析可用姓名开头强化逻辑感；恐惧感知、危机反应用代词跟进；团队场景优先用姓名/代号；副本 NPC 用外貌/身份特征称呼以区分。',
    mustInclude: ['副本世界规则设定与破解', '积分/道具/能力系统', '生死压力与真实牺牲', '团队协作与信任博弈', '规则推理与智力对决', '恐怖或悬疑氛围营造', '副本间的成长递进', '悬念钩子与伏笔'],
    mustAvoid: ['无脑碾压所有副本', '队友沦为纯工具人', '副本规则前后矛盾', '主角靠运气而非智力通关', '恐怖元素与规则脱节', '积分/能力无限膨胀', '副本之间毫无关联的流水账'],
    paragraphLength: 160,
    dialogueRatio: 30,
    rhythmRequirement: '副本开局快速建立世界观与核心威胁 → 探索阶段：收集线索、试探规则、队友互动 → 中段升级：规则破解、第一波危机、出现伤亡 → 高潮：隐藏规则揭示、终极对决 → 副本结算+伏笔',
  },
};

/** 查询题材锚点（v 是 GenreItem.value，例 'xianxia' / 'urban'） */
export function findGenreAnchor(value: string): GenreAnchor | undefined {
  return GENRE_ANCHORS[value];
}

/** 该题材是否已配置锚点（用于 UI 显示徽标） */
export function hasGenreAnchor(value: string): boolean {
  return value in GENRE_ANCHORS;
}

// ─────────────────────── 平台（决定节奏 / 钩子密度 / 完播阈值） ───────────────────────
export interface PlatformItem {
  value: string;
  label: string;
  hint: string;
  /** 平均单集时长（分钟） */
  durationMinDefault: number;
  aspectRatio: '9:16' | '16:9' | '1:1';
}

export const PLATFORMS: PlatformItem[] = [
  { value: 'douyin',      label: '抖音 · 短剧',     hint: '竖屏 9:16 · 前 3 秒强钩子 · 完播 30%',   durationMinDefault: 1, aspectRatio: '9:16' },
  { value: 'kuaishou',    label: '快手 · 短剧',     hint: '竖屏 9:16 · 生活感 · 下沉市场爽点',     durationMinDefault: 1, aspectRatio: '9:16' },
  { value: 'xiaohongshu', label: '小红书',          hint: '竖屏 9:16 · 氛围感 · 场景美学',         durationMinDefault: 1, aspectRatio: '9:16' },
  { value: 'tiktok',      label: 'TikTok Shorts',   hint: '竖屏 9:16 · 快节奏 · 国际化',           durationMinDefault: 1, aspectRatio: '9:16' },
  { value: 'youtube',     label: 'YouTube Shorts',  hint: '竖屏 9:16 · 完播率重要',                durationMinDefault: 1, aspectRatio: '9:16' },
  { value: 'bilibili',    label: '哔哩哔哩 · 中视频', hint: '横屏 16:9 · 二创友好 · 信息密度高',   durationMinDefault: 5, aspectRatio: '16:9' },
  { value: 'wechat',      label: '微信视频号',      hint: '竖屏 · 中老年向 · 情感驱动',             durationMinDefault: 3, aspectRatio: '9:16' },
  { value: 'other',       label: '自定义/其他',     hint: '不绑定特定平台',                        durationMinDefault: 5, aspectRatio: '9:16' },
];

export function findPlatform(value: string): PlatformItem | undefined {
  return PLATFORMS.find((p) => p.value === value);
}

// ─────────────────────── 主角性别 ───────────────────────
export interface ProtagonistItem { value: string; label: string; hint: string }
export const PROTAGONISTS: ProtagonistItem[] = [
  { value: 'male',     label: '男主',     hint: '单男主，男频向' },
  { value: 'female',   label: '女主',     hint: '单女主，女频向' },
  { value: 'dual',     label: '男女双主', hint: 'CP 双线、互动驱动' },
  { value: 'nonhuman', label: '非人/特殊', hint: 'AI / 神兽 / 群像' },
];
export type ProtagonistGender = 'male' | 'female' | 'dual' | 'nonhuman';

// ─────────────────────── 时长档位 ───────────────────────
export interface DurationItem { value: number; label: string; hint: string; minutes: number }
export const DURATIONS: DurationItem[] = [
  // value 是分钟（与 ProjectContext.durationMin 对齐）
  { value: 0.5, minutes: 0.5, label: '30 秒',  hint: '单镜头钩子片' },
  { value: 1,   minutes: 1,   label: '1 分钟', hint: '抖音/快手主流时长' },
  { value: 3,   minutes: 3,   label: '3 分钟', hint: '多镜头短片' },
  { value: 5,   minutes: 5,   label: '5 分钟', hint: '单集短剧' },
  { value: 15,  minutes: 15,  label: '15 分钟', hint: '长集短剧' },
  { value: 30,  minutes: 30,  label: '30 分钟', hint: '准电视剧' },
];

// ─────────────────────── 视觉风格（用于 storyboard 双区 prompt 基调） ───────────────────────
export interface VisualStyleItem { value: string; label: string; hint: string }
export const VISUAL_STYLES: VisualStyleItem[] = [
  { value: 'wuxia_ink',   label: '水墨武侠',     hint: '泼墨写意 · 留白 · 高对比黑白彩' },
  { value: 'xianxia_glow',label: '仙侠仙气',     hint: '柔光雾气 · 流光特效 · 飘逸服饰' },
  { value: 'cyberpunk',   label: '赛博朋克',     hint: '霓虹蓝粉 · 高反差 · 雨夜街景' },
  { value: 'film_retro',  label: '胶片复古',     hint: '颗粒感 · 暖黄调 · 浅景深' },
  { value: 'anime',       label: '动漫渲染',     hint: 'Cel-shading · 高饱和 · 大眼比例' },
  { value: 'realistic',   label: '电影写实',     hint: '高动态范围 · 自然光 · 真实质感' },
  { value: 'noir',        label: '黑色电影',     hint: '硬光 · 高对比黑白 · 阴影叙事' },
  { value: 'pastel_warm', label: '日系治愈',     hint: '马卡龙色 · 柔焦 · 自然暖光' },
  { value: 'horror_dim',  label: '惊悚低照',     hint: '低照度 · 冷绿/血红 · 高颗粒' },
  { value: 'custom',      label: '自定义',       hint: '在 concept 中自行描述' },
];
export function findVisualStyle(value: string): VisualStyleItem | undefined {
  return VISUAL_STYLES.find((v) => v.value === value);
}

// ─────────────────────── 改编原作类型（扩展自 AdaptationType） ───────────────────────
export interface AdaptSourceTypeItem { value: string; label: string; hint: string }
export const ADAPT_SOURCE_TYPES: AdaptSourceTypeItem[] = [
  { value: 'novel_long',   label: '长篇网文/小说',   hint: '15 万字+ · 需要重度压缩 + 主线裁剪' },
  { value: 'novel_short',  label: '短篇/单篇文章',   hint: '1-3 万字 · 直接改编主体保留' },
  { value: 'remake',       label: '旧剧本/影视翻拍', hint: '本土化 + 调子调整 + 保金句' },
  { value: 'manga',        label: '漫画/动漫',       hint: '画面感强 · 视觉化 dialogue 驱动' },
  { value: 'real_event',   label: '真实事件/新闻',   hint: '事件骨架 + 戏剧化处理 + 合规审查' },
  { value: 'fanfic',       label: '同人/二创',       hint: '原作 IP 衍生 · 注意版权红线' },
];
export type AdaptSourceType = typeof ADAPT_SOURCE_TYPES[number]['value'];

// 旧 AdaptationType 兼容映射 (novel | remake) → 新枚举
export function sourceToLegacyAdaptationType(s: AdaptSourceType): 'novel' | 'remake' {
  return s === 'remake' ? 'remake' : 'novel';
}

// ─────────────────────── 小说创作专用分类 ───────────────────────
// 小说与短剧节奏 / 钩子 / 平台范式截然不同；这里另立一套常量。
// 核心提取自 ShadowScript 的 novel_outliner / chapter_writer / worldbuilder agent。

/** 小说平台范式：决定每章字数 / 钩子密度 / 完读阈值 */
export interface NovelPlatformItem {
  value: string;
  label: string;
  hint: string;
  /** 推荐每章字数中位 (用于 outline 生成) */
  wordsPerChapter: number;
  /** 推荐章数（短/中/长篇范围） */
  chapterRangeHint: string;
}
export const NOVEL_PLATFORMS: NovelPlatformItem[] = [
  { value: 'qidian',    label: '起点中文网',  hint: '男频长篇 · 章长 3000-4500 字 · 单日万字',         wordsPerChapter: 3500, chapterRangeHint: '300-1000+' },
  { value: 'fanqie',    label: '番茄/七猫',   hint: '免费小说 · 章长 2000-3000 字 · 高钩子密度',     wordsPerChapter: 2500, chapterRangeHint: '500-1500+' },
  { value: 'jjwxc',     label: '晋江文学城',  hint: '女频精品 · 章长 2500-3500 字 · 文笔重于爽点',   wordsPerChapter: 3000, chapterRangeHint: '50-300' },
  { value: 'zongheng',  label: '纵横/17K',    hint: '老牌男频 · 章长 3000-4000 字 · 传统写法',         wordsPerChapter: 3500, chapterRangeHint: '200-800' },
  { value: 'kindle',    label: 'Kindle/实体',  hint: '出版向 · 章长 4000-6000 字 · 精装节奏',           wordsPerChapter: 5000, chapterRangeHint: '20-80' },
  { value: 'web_free',  label: '通用网络',    hint: '不绑定平台 · 章长 3000-4000 字 · 自由节奏',       wordsPerChapter: 3500, chapterRangeHint: '50-500' },
];
export function findNovelPlatform(value: string): NovelPlatformItem | undefined {
  return NOVEL_PLATFORMS.find((p) => p.value === value);
}

/** 小说体量档（决定总字数和分卷数） */
export interface NovelScaleItem {
  value: string;
  label: string;
  totalWordsK: number;     // 总字数（万）
  volumesHint: string;
  hint: string;
}
export const NOVEL_SCALES: NovelScaleItem[] = [
  { value: 'short',     label: '短篇', totalWordsK: 5,   volumesHint: '不分卷',     hint: '5 万字以下 · 中短篇' },
  { value: 'medium',    label: '中篇', totalWordsK: 20,  volumesHint: '不分卷或 1-2 卷', hint: '5-30 万字' },
  { value: 'long',      label: '长篇', totalWordsK: 80,  volumesHint: '3-5 卷',     hint: '30-150 万字 · 标准网文' },
  { value: 'mega',      label: '超长', totalWordsK: 200, volumesHint: '5-8 卷',     hint: '150-300 万字 · 大长篇' },
  { value: 'epic',      label: '史诗', totalWordsK: 400, volumesHint: '8+ 卷',      hint: '300 万字+ · 巨著' },
];
export function findNovelScale(value: string): NovelScaleItem | undefined {
  return NOVEL_SCALES.find((s) => s.value === value);
}

/** POV 视角（chapter_writer 硬律：视角锁定，不可乱跳） */
export interface NovelPovItem { value: string; label: string; hint: string }
export const NOVEL_POVS: NovelPovItem[] = [
  { value: 'first',         label: '第一人称',        hint: '"我" · 沉浸感强 · 单视角' },
  { value: 'third_limited', label: '第三人称 · 限制', hint: '紧贴主角心理 · 当代主流' },
  { value: 'third_dual',    label: '第三人称 · 双视角', hint: '男女主交替 · 言情常用' },
  { value: 'third_multi',   label: '第三人称 · 多视角', hint: '群像 / 史诗 · 冰火常用' },
  { value: 'omniscient',    label: '全知视角',         hint: '上帝旁白 · 古典 / 历史向' },
];

/** 读者群（决定题材交集、爽点配方、敏感题材线） */
export interface NovelAudienceItem { value: string; label: string; hint: string }
export const NOVEL_AUDIENCES: NovelAudienceItem[] = [
  { value: 'male',    label: '男频',  hint: '热血 / 升级 / 战斗 · 起点 / 番茄主流' },
  { value: 'female',  label: '女频',  hint: '言情 / 群像 / 慢节奏 · 晋江主流' },
  { value: 'general', label: '通用',  hint: '不限性别 · 文学向 / 出版向' },
];

/** 写作调性（chapter_writer 笔调） */
export interface NovelToneItem { value: string; label: string; hint: string }
export const NOVEL_TONES: NovelToneItem[] = [
  { value: 'fast_pleasure', label: '爽文快节奏', hint: '单章 ≥1 爽点 · 钩子密度高 · 起点番茄向' },
  { value: 'literary',      label: '文艺慢节奏', hint: '注重氛围与心理 · 单章戏点少而精' },
  { value: 'hardcore',      label: '硬核 / 硬科', hint: '设定密集 · 反套路 · 读者门槛高' },
  { value: 'healing',       label: '治愈日常',   hint: '低烈度冲突 · 情感细腻 · 慢热向' },
  { value: 'dark_heavy',    label: '黑暗厚重',   hint: '道德灰暗 · 不规避痛点 · 黑暗奇幻向' },
  { value: 'humor',         label: '幽默吐槽',   hint: '叙事旁白多 · 第二人称感 · 都市常见' },
];

/** 派生：根据体量 + 平台推荐总章节数 */
export function deriveChapterCount(scaleValue?: string, platformValue?: string): number {
  const scale = findNovelScale(scaleValue ?? '');
  const platform = findNovelPlatform(platformValue ?? '');
  if (!scale) return 100;
  const totalWords = scale.totalWordsK * 10000;
  const wpc = platform?.wordsPerChapter ?? 3500;
  return Math.max(20, Math.round(totalWords / wpc));
}

// ─────────────────────── concept 派生器 ───────────────────────
// 用结构化字段合成"一句话概念"字符串，注入到 prompt 的 {concept} 占位符。
export interface ConceptInput {
  genres?: string[];
  protagonistGender?: ProtagonistGender;
  platform?: string;
  coreConflict?: string;
  durationMin?: number;
  visualStyle?: string;
  /** 改编模式下：原作摘要标题或概念，用以替代 coreConflict */
  adaptedFrom?: string;
}

export function buildConcept(inp: ConceptInput): string {
  const genreLabels = (inp.genres ?? []).map((v) => findGenre(v)?.label).filter(Boolean) as string[];
  const platformLabel = inp.platform ? findPlatform(inp.platform)?.label : '';
  const protagonistLabel = inp.protagonistGender
    ? PROTAGONISTS.find((p) => p.value === inp.protagonistGender)?.label
    : '';
  const visualStyleLabel = inp.visualStyle && inp.visualStyle !== 'custom'
    ? findVisualStyle(inp.visualStyle)?.label
    : '';

  const parts: string[] = [];
  // 题材融合（X+Y）+ "短剧" 后缀
  if (genreLabels.length) parts.push(genreLabels.join('+') + '短剧');
  else parts.push('短剧');
  if (protagonistLabel) parts.push(protagonistLabel);
  if (platformLabel) parts.push(platformLabel);
  if (visualStyleLabel) parts.push(`${visualStyleLabel}风格`);
  if (inp.adaptedFrom) parts.push(`改编自《${inp.adaptedFrom}》`);
  if (inp.coreConflict) parts.push(inp.coreConflict);
  return parts.join(' · ');
}
