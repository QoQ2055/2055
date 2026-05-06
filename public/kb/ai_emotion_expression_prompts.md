# 😊 AI表情-情绪-动作提示词库 v12.0

> 情绪(Emotion) × 面部动作单元(FACS) × 身体动作(Action) × 强度控制(Intensity) 四维对照速查。
> 用于角色视觉提示词生成时，确保情绪-表情-动作三者自然匹配，并防止AI表情崩坏。
>
> ⚠️ 铁律：提示词中必须同时包含「情绪词 + FACS面部动作单元 + 动作词 + 强度修饰」，禁止只写情绪不写表情动作。
> ⚠️ 用法：`anger (intensity: 7/10), eyebrows lowered and drawn together, eyes widened with tension, lips pressed thin, clenched fists leaning forward`
> ⚠️ v12.0新增：表情层次化描述、强度防崩坏控制、表情-动作强绑定、负面自动防御

---

## 一、FACS 面部动作单元分解表（核心升级）

> 🆕 v12.0：所有表情从模糊情绪词升级为"情绪基调 + 面部动作单元 + 强度数值"三层结构。
> 任何 Agent 在生成提示词时，必须使用本表将情绪词展开为 FACS 动作单元组合。

### 1.1 基础情绪 → FACS 动作单元映射

| 情绪 | 眉毛 Brows | 眼睛 Eyes | 嘴巴 Mouth | 辅助特征 Aux | 英文FACS提示词组合 |
|------|-----------|----------|-----------|------------|-------------------|
| 喜悦 Joy | 放松，轻微上扬 | 眼角有笑纹（crow's feet），微眯 | 嘴角向斜上方拉伸，露出牙齿 | 脸颊上抬 | `relaxed raised brows, eyes with crow's feet wrinkles and slight squint, corners of mouth pulled up and back showing teeth, raised cheeks` |
| 悲伤 Sadness | 眉头上扬并聚拢（内角抬起） | 下眼睑上推，眼神失焦 | 嘴角下垂，下唇轻微前突 | 下巴颤抖 | `inner brow corners raised and drawn together, lower eyelids pushed up with unfocused gaze, downturned mouth corners, lower lip slightly protruding, chin trembling` |
| 愤怒 Anger | 下压并聚拢，产生竖纹 | 睁大但带有张力、怒视 | 嘴唇紧压成一条线或咬牙龇牙 | 鼻翼张开 | `eyebrows lowered and drawn together with vertical crease, eyes widened with tension and glaring, lips pressed into a thin line, nostrils slightly flared` |
| 恐惧 Fear | 上扬并聚拢，呈倒V形 | 上眼睑抬起，眼白大面积露出（上三白眼） | 嘴角水平拉伸紧张，或微张 | 颈部青筋可见 | `eyebrows raised and drawn together in inverted V, upper eyelids raised with visible sclera above iris, mouth corners stretched horizontally with tension, visible neck tendons` |
| 惊讶 Surprise | 拱起，几乎呈弧形 | 眼睛完全睁大，瞳孔缩小 | 嘴巴张开，下颌自然下沉 | 额头横向皱纹 | `eyebrows arched high in curved shape, eyes fully widened with contracted pupils, mouth open with jaw dropped, horizontal forehead wrinkles` |
| 厌恶 Disgust | 下压，鼻梁起皱 | 眯眼，下眼睑上推 | 上唇上扬露出牙龈，嘴角下拉 | 鼻子皱起 | `eyebrows lowered with wrinkled nose bridge, squinting eyes with lower eyelids pushed up, upper lip raised showing gum line, mouth corners pulled down, nose wrinkled` |

### 1.2 复合情绪 → FACS 动作单元映射

| 情绪 | 眉毛 | 眼睛 | 嘴巴 | 辅助 | 英文FACS提示词组合 |
|------|------|------|------|------|-------------------|
| 轻蔑 Contempt | 一侧微抬 | 半眯，斜视 | 单侧嘴角上扬（不对称） | 下巴微抬 | `one brow slightly raised, half-lidded sideways glance, asymmetric one-sided smirk, chin slightly raised` |
| 羞涩 Shy | 轻微聚拢 | 目光游移向下 | 抿嘴或咬下唇 | 脸颊泛红 | `brows slightly drawn, gaze averted downward, lips pressed or biting lower lip, blushing cheeks with pink tint` |
| 痛苦 Pain | 紧锁下压 | 紧闭或半闭 | 龇牙紧咬，或张嘴呻吟 | 面部肌肉紧绷 | `brows tightly furrowed and lowered, eyes tightly shut or half-closed, teeth clenched grimacing or mouth open groaning, taut facial muscles` |
| 得意 Smug | 微微上挑 | 半眯带光 | 嘴角微翘但不露齿 | 鼻孔微张 | `brows slightly raised with confidence, half-lidded eyes with gleam, subtle closed-lip smirk, slightly flared nostrils` |
| 疲惫 Exhaustion | 松弛无力 | 眼皮下垂沉重 | 微张，嘴唇干裂 | 眼下青黑 | `relaxed drooping brows, heavy drooping eyelids, slightly parted dry lips, dark circles under eyes` |
| 狂喜 Ecstasy | 高高扬起 | 紧闭或极度眯起 | 大张嘴大笑，露出全部牙齿 | 泪水（喜极而泣） | `brows raised high, eyes squeezed shut or extremely squinted, wide open mouth laughing with all teeth showing, tears of joy` |
| 期待 Anticipation | 轻微上扬 | 睁大专注，瞳孔微放大 | 微微张开，嘴角微上扬 | 身体微前倾 | `brows slightly raised, widened focused eyes with slightly dilated pupils, lips slightly parted with hint of smile, leaning forward` |
| 坚定 Determination | 平直微压 | 聚焦目标不移开 | 紧闭嘴唇，下颌收紧 | 太阳穴肌肉紧张 | `brows level and slightly lowered, eyes focused and unwavering, lips firmly sealed with tightened jaw, tense temples` |

---

## 二、表情强度控制系统（防AI崩坏）

> 🆕 v12.0：引入强度锚点系统，解决AI生成时面部呆滞（强度太低）或鬼畜扭曲（强度太高）的问题。

### 2.1 强度等级 × 表情效果词

| 强度 | 数值 | 英文强度修饰词 | 面部描述策略 | 使用场景 |
|------|------|--------------|-------------|---------|
| 极微 | 1-2/10 | `barely perceptible, faint, hint of` | `subtle micro-expressions, relaxed face muscles, minimal facial movement` | 伪装/掩饰情绪、玄学冷面角色 |
| 轻微 | 3-4/10 | `slightly, subtly, gently` | `subtle expression, mild tension in facial muscles, understated emotion` | 日常对话、含蓄东方角色 |
| 中等 | 5-6/10 | `clearly, visibly, noticeably` | `readable emotion on face, natural tension, clear facial expression` | 正常情感戏、标准叙事 |
| 强烈 | 7-8/10 | `intensely, strongly, deeply, pronounced` | `strong expression with deep facial creases, visible emotional strain` | 冲突高潮、情感爆发 |
| 极端 | 9-10/10 | `extremely, overwhelmingly, violently` | `exaggerated expression, deep facial creases, flushed skin, tears streaming, veins visible` | 崩溃、暴怒、极限恐惧 |

### 2.2 强度防崩坏负面提示词（自动注入）

> ⚠️ 无论选择何种强度，以下负面提示词必须包含在 negative prompt 中：

```
通用防崩坏: blank stare, frozen expression, mismatched emotion, face distortion, 
unrealistic wrinkle pattern, asymmetric face deformation, uncanny valley expression,
puppet-like face, mannequin expression, wax figure face
```

### 2.3 各强度专用防护词

| 强度 | 额外负面提示词 |
|------|--------------|
| 低强度 1-4 | `over-expressive, exaggerated face, dramatic expression, theatrical emotion` |
| 高强度 7-10 | `calm face, neutral expression, blank stare, frozen smile, dead eyes, emotionless` |

---

## 三、表情-动作强绑定表（跨模态一致性）

> 🆕 v12.0：解决"哭着脸却在跳舞"的问题。选择情绪时，自动推荐匹配的身体语言和手部动作。

### 3.1 情绪 → 推荐身体语言 + 手部动作

| 情绪 | 推荐身体语言 EN | 推荐手部动作 EN | 禁止搭配（负面提示词） |
|------|---------------|---------------|---------------------|
| 愤怒 | `tense shoulders, clenched fists, leaning forward aggressively, rigid posture` | `pointing finger accusingly, slamming fist, gripping object tightly` | `relaxed posture, gentle gestures, dancing` |
| 害羞 | `hunched shoulders, turned head slightly away, fidgeting, weight shifted to one leg` | `fingers intertwined nervously, tucking hair behind ear, covering face partially` | `confident pose, hands on hips, direct eye contact` |
| 得意 | `chest puffed out, chin raised, relaxed arms on hips, wide stance` | `hands on hips, one hand in pocket, casual wave, finger snap` | `slouched, head down, cowering` |
| 恐惧 | `cowering, arms crossed defensively, stepping backward, body curled inward` | `palms forward in stop gesture, covering mouth, gripping nearby object for support` | `confident pose, relaxed arms, stepping forward` |
| 悲伤 | `head bowed, shoulders slumped, body curled inward, slow movement` | `hand covering eyes, hugging self, clutching chest, wiping tears` | `jumping, dancing, assertive stance, raised fists` |
| 惊讶 | `body jerked backward, straightened spine, frozen posture` | `hand flying to mouth, arms raised with palms open, dropping held items` | `slouching, relaxed casual pose, closed body language` |
| 痛苦 | `body doubled over, rigid with tension, fetal position if seated` | `gripping injured area, pressing fist to forehead, white-knuckled grip` | `relaxed posture, dancing, calm movements` |
| 坚定 | `squared shoulders, feet planted firmly, weight forward, chin level` | `clenched fist at side, gripping weapon tightly, steady pointed gesture` | `fidgeting, shifting weight, nervous gestures` |

### 3.2 组装规则

```
[FACS面部动作单元] + [身体语言] + [手部动作]
三者必须来自同一情绪行，禁止跨行混搭（除非是复合情绪过渡）。
```

**正确**：
```
✅ anger (intensity: 7/10), eyebrows lowered and drawn together, eyes glaring with tension, 
   lips pressed thin, nostrils flared. Tense shoulders, leaning forward aggressively. 
   Clenched fists, pointing finger accusingly.
```

**错误**：
```
❌ sadness (intensity: 5/10), tears streaming... dancing joyfully with hands raised
   （悲伤的脸 + 快乐的身体 = 跨行混搭，严禁）
```

---

## 四、嘴部与眼部精细管理（视频专用）

> 🆕 v12.0：嘴部和眼睛在AI视频生成中最容易出错，需要精确控制。

### 4.1 嘴型模式库

| 模式 | 中文 | 英文精确提示词 | 适用场景 |
|------|------|---------------|---------|
| 静音闭嘴 | 闭嘴，无表情 | `lips sealed, no gap between lips, relaxed jaw, closed mouth` | 冷酷角色、沉默 |
| 闭嘴微笑 | 嘴角上扬但不张嘴 | `closed-lip smile, corners of mouth gently lifted, no teeth showing` | 含蓄微笑 |
| 露齿笑 | 嘴角上扬露出上排牙 | `open smile showing upper teeth, lips pulled back and up, relaxed lower jaw` | 开心、自信 |
| 说话（元音A） | 嘴巴圆形张开 | `mouth open with precise oval shape for vowel 'A', relaxed jaw dropped` | 大喊、呐喊 |
| 说话（元音O） | 嘴唇圆形前突 | `lips rounded and pushed forward in O shape, jaw slightly lowered` | 惊讶发声 |
| 说话（辅音M） | 双唇紧闭后弹开 | `lips pressed together then parting, bilabial closure` | 正常对话 |
| 咬牙 | 上下牙紧咬，嘴唇微分 | `teeth clenched tightly, lips slightly parted revealing clenched teeth, jaw muscles bulging` | 忍痛、压制愤怒 |
| 噘嘴 | 嘴唇向前突出 | `lips pursed and pushed forward, slight pout, lower lip protruding` | 不满、可爱、撒娇 |
| 张嘴惊恐 | 嘴巴大张下颌脱力 | `mouth wide open, jaw fully dropped, lips stretched with tension` | 尖叫、极度恐惧 |
| 嘲讽冷笑 | 单侧嘴角上扬 | `one corner of mouth raised in sneer, asymmetric lip curl, slight nostril flare` | 轻蔑、嘲讽 |

### 4.2 眼部控制库

| 控制维度 | 选项 | 英文精确提示词 |
|---------|------|---------------|
| **视线方向** | 直视镜头 | `gazing directly at viewer, eyes locked on camera` |
| | 左上方看 | `looking to the upper left, eyes directed upward-left` |
| | 右下方看 | `looking to the lower right, gaze cast downward-right` |
| | 回避视线 | `avoiding eye contact, gaze averted, looking away` |
| | 死盯某物 | `staring intently at [object], unwavering focused gaze on [target]` |
| **眨眼** | 自然眨眼 | `natural blink every 3-5 seconds` (视频专用) |
| | 快速眨眼 | `rapid blinking, fluttering eyelids` (紧张/受刺激) |
| | 不眨眼 | `unblinking stare, fixed gaze without blinking` (威压/恐惧) |
| **瞳孔** | 正常 | `normal pupil size, natural iris` |
| | 放大 | `dilated pupils, widened dark pupils` (恐惧/黑暗/药物) |
| | 缩小 | `constricted pupils, pinpoint pupils` (强光/震惊) |
| **湿度** | 干 | `dry clear eyes` (正常状态) |
| | 水润 | `glistening eyes, eyes brimming with unshed tears` (感动/忍泪) |
| | 流泪 | `tears streaming down cheeks, wet eyelashes, tear tracks on face` |
| **眼白** | 正常 | `natural sclera visibility` |
| | 上三白 | `wide upper sclera visible above iris` (恐惧/震惊) |
| | 充血 | `bloodshot eyes, reddened sclera, visible blood vessels in eyes` (疲惫/愤怒) |

---

## 五、情绪过渡序列（视频STEP-C专用）

> 用于STEP-C视频提示词中描述角色情绪变化的动态过程。

| 过渡类型 | 情绪序列 | 视频提示词模板 |
|---------|---------|-------------|
| 惊喜 | 平静→惊讶→快乐 | `starts with calm neutral expression, eyes suddenly widen in surprise, then breaks into joyful smile with open arms` |
| 愤怒爆发 | 不悦→愤怒→暴怒 | `begins with tight-lipped annoyance, brow furrows deeper, eyes narrow to glare, then erupts with clenched fists slamming down` |
| 恐惧升级 | 不安→恐惧→惊恐 | `starts with nervous darting eyes, pupils dilate with growing fear, then staggers back in absolute terror with hands raised` |
| 心碎 | 希望→失望→悲伤 | `begins with hopeful bright eyes, expression slowly falls, lips tremble, then tears stream down as body slumps` |
| 鼓起勇气 | 恐惧→犹豫→决心 | `starts trembling with wide fearful eyes, takes deep breath, jaw sets with determination, stands tall with clenched fists` |
| 背叛反应 | 信任→震惊→愤怒 | `warm trusting smile freezes, eyes widen in disbelief, then narrow with fury as fists clench` |
| 释然 | 紧张→如释重负→平静 | `tense shoulders and clenched jaw, slowly exhales, shoulders drop, gentle relieved smile spreads` |
| 醒悟 | 困惑→思考→顿悟 | `puzzled furrowed brow, head tilts in thought, then eyes light up with sudden understanding, pointing up gesture` |
| 🆕 死亡接受 | 恐惧→挣扎→平静 | `wide terrified eyes with tense body, thrashing weakens gradually, face relaxes into serene calm, eyes slowly close` |
| 🆕 觉醒降临 | 平静→异变→超然 | `neutral expression with closed eyes, sudden snap open with glowing iris change, facial muscles relax into emotionless deity-like calm` |

---

## 六、动作-情绪快速查用表

> 当你知道角色应该做某个动作，但不确定搭配什么情绪/表情时，查此表。

| 动作 | 常见关联情绪 | 完整提示词 |
|------|------------|-----------| 
| 抱臂 crossed arms | 防御/愤怒/轻蔑/紧张 | `crossed arms, defensive posture, tense shoulders` |
| 低头 head down | 悲伤/羞愧/害羞/服从 | `head bowed, looking at floor, shoulders slumped` |
| 仰头 head back | 自豪/大笑/挑衅/思考 | `head tilted back, laughing, chin up` |
| 歪头 head tilt | 好奇/爱意/轻蔑/疑惑 | `head tilt, curious expression, inquisitive gaze` |
| 握拳 clenched fist | 愤怒/决心/紧张/胜利 | `clenched fist, tense hand, white knuckles` |
| 摊手 palms up | 无奈/坦诚/请求/投降 | `open palms up, shrugging, pleading gesture` |
| 耸肩 shrug | 无奈/不知道/轻蔑/漠然 | `shrugging shoulders, palms up, I don't know` |
| 掩面 facepalm | 尴尬/挫败/失望/难以置信 | `facepalm, hand covering face, embarrassed` |
| 跺脚 stomp | 愤怒/不耐烦/撒娇/焦急 | `stomping foot, impatient, frustrated` |
| 跳起 jump | 快乐/兴奋/惊讶/恐惧 | `jumping, leaping with joy, startled jump` |
| 后退 step back | 恐惧/惊讶/厌恶/回避 | `stepping back, recoiling, retreating` |
| 前倾 lean forward | 兴趣/愤怒/挑衅/关心 | `leaning forward, engaged, confrontational` |
| 发抖 tremble | 恐惧/寒冷/愤怒压抑/激动 | `trembling, shaking, quivering` |
| 绞手 wring hands | 焦虑/紧张/担忧/期待 | `wringing hands, nervous gesture, anxious fidgeting` |
| 摸脖子 touch neck | 不安/紧张/欺骗/困惑 | `touching neck, uncomfortable, self-soothing gesture` |
| 捂嘴 cover mouth | 惊讶/害怕/忍笑/秘密 | `hand over mouth, gasping, stifling laugh` |
| 指向 pointing | 指控/怒斥/指示/惊奇 | `pointing finger, accusatory gesture, indicating direction` |
| 拥抱 embrace | 爱意/安慰/重逢/保护 | `hugging, embracing tightly, arms wrapped around` |
| 托腮 chin rest | 无聊/思考/倾听/白日梦 | `chin resting on hand, pensive, daydreaming` |
| 叉腰 hands on hips | 自信/不满/等待/挑战 | `hands on hips, power pose, assertive stance` |

---

## 七、负面表情自动防御系统

> 🆕 v12.0：根据用户选择的表情，自动生成反向负面提示词，防止AI生成不一致的表情。

### 7.1 自动防御映射表

| 目标情绪 | 自动注入负面提示词 |
|---------|------------------|
| 愤怒 | `smiling, laughing, relaxed face, gentle expression, happy eyes, soft brows` |
| 悲伤 | `smiling, laughing, cheerful expression, bright eyes, upright confident posture` |
| 恐惧 | `calm expression, confident smile, relaxed body, assertive stance, steady gaze` |
| 快乐 | `frowning, crying, tears, slumped posture, sad eyes, furrowed angry brows` |
| 严肃 | `smiling, laughing, playful expression, animated gestures, bright cheerful mood` |
| 痛苦 | `smiling, comfortable posture, relaxed muscles, peaceful expression, gentle face` |
| 冷漠 | `expressive face, exaggerated emotion, warm smile, animated features, tears` |
| 疯狂 | `calm composure, rational expression, measured gaze, controlled demeanor` |

### 7.2 防御词注入规则

```
当 Agent 输出包含情绪标签时：
1. 查找本表对应的目标情绪行
2. 将该行负面提示词追加到 negative prompt 中
3. 不覆盖通用防崩坏词（第二节2.2），而是叠加
```

---

## 八、使用规范

### 8.1 完整提示词组装公式

```
[情绪词(intensity: X/10)] + [FACS面部动作单元 2-4个] + [身体语言 1-2个] + [手部动作 1个] + [视线方向] + [嘴型模式（如需要）]
```

### 8.2 实战对比

**用户简单输入**：一个悲伤的女人

**❌旧版输出（效果差）**：
```
A sad woman
```

**✅新版输出（效果好）**：
```
A woman with sadness (intensity 6/10), inner brow corners raised and drawn together, 
lower eyelids pushed up with unfocused gaze, downturned mouth corners with lower lip 
trembling slightly. Head tilted down, shoulders slumped, arms hanging loosely. 
Gazing at the ground with unfocused eyes. Subtle micro-expression of grief, 
with a single tear rolling down the left cheek. 
Negative prompt: blank stare, neutral face, smile, relaxed brow, unrealistic tear shape, 
smiling, laughing, cheerful expression, bright eyes, upright confident posture.
```

### 8.3 强度修饰词速查

| 强度等级 | 英文修饰词 | 适用场景 |
|---------|----------|---------|
| 1-2 极轻 | `barely, faintly, hint of` | 微表情、克制场景 |
| 3-4 轻微 | `slightly, subtly, gently` | 日常对话、含蓄情感 |
| 5-6 中等 | `clearly, visibly, noticeably` | 正常表达场景 |
| 7-8 强烈 | `intensely, strongly, deeply` | 高潮、冲突场景 |
| 9-10 极端 | `extremely, overwhelmingly, violently` | 爆发、崩溃场景 |

### 8.4 视频序列描述规范

用于Seedance/Sora等视频模型时：
```
starts with [初始FACS+身体语言] (intensity X/10),
then transitions to [过渡FACS变化] (intensity Y/10),
finally [结束FACS+身体语言] (intensity Z/10)
```

---

## 九、与其他提示词库联动

| 联动库 | 联动方式 |
|--------|---------|
| `ai_character_prompts.md` | 角色基础外貌 + 本库FACS表情 = 完整角色提示词 |
| `ai_combat_prompts.md` | 战斗动作 + 本库愤怒/恐惧/痛苦表情 = 战斗角色提示词 |
| `ai_visual_prompts.md` | 画面风格 + 本库情绪动作 = 氛围画面提示词 |
| `ai_storyboard_prompts.md` | 景别/构图 + 本库表情特写 = 分镜提示词 |
| `expression_consistency_engine.md` | 🆕 跨镜头表情一致性锁定 |
| `per_act_pipeline_protocol.md` | STEP-B/C中角色情绪注入 |
