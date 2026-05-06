# 归档 · 表情-情绪-动作对照表（视觉生成 prompt 素材）

> **归档日期**：2026-05-06
> **原始来源**：`F:\下载文件\AI技术分享\skill分享\表情-情绪-动作对照表.txt`（87 行 / 7.7 KB）
> **归档原因**：本资料是**AI 图像/视频生成专用的 prompt 素材**（Midjourney / Stable Diffusion / DALL·E / Sora），含中英双语关键词。直接注入小说流程会让 LLM 输出剧本化 / 英文污染，故不做方法论模块。
> **运行时状态**：❌ 不被加载，不影响任何现有流程。
> **相关归档**：与 `@docs/prompt-archives/storyboard-cinematic-15s.md`（15 秒电影级分镜 prompt）配套，未来 `storyboard.ai-video.*` 流程上线时一并集成。

---

## 未来集成路径

当 fili-web 开启 `storyboard.ai-video.*` 流程（或任何需要生成人物状态描述的视觉节点）时：

1. 本档作为 prompt 素材库加载，按情绪名索引
2. 生成 prompt 时注入"情绪词 + 表情词 + 动作词"的三元组
3. 加程度修饰（`slightly` / `subtle` / `intense` / `extreme`）控制强度
4. 视频流程使用"动作序列"描述（例：`starts with surprise, then transitions to fear, steps back and raises hands`）

---

## 小说写作可参考的中文精简表（无英文污染）

下方是**剥离英文 prompt keywords + AI 生图示例**后的纯中文描写词库，小说作者可手动挑选条目复制到项目 KB 的 `styleGuide` 文档作为描写词库。

### 基本情绪（6 种）

| 情绪 | 面部表情 | 身体动作与手势 |
|---|---|---|
| **快乐** | 嘴角上扬、眼睛眯起、鱼尾纹、露齿笑 | 挺胸、张开双臂、跳跃、鼓掌、手舞足蹈 |
| **悲伤** | 眉毛内角上抬、嘴角下拉、下唇颤抖、眼泪 | 低头、驼背、双手抱臂、用手掩面、缓慢移动 |
| **愤怒** | 眉毛下压并聚拢、怒视、嘴唇紧闭或咬牙、鼻翼张开 | 握拳、身体前倾、跺脚、拍桌、手臂僵硬 |
| **恐惧** | 眉毛抬高并聚拢、眼睛睁大、嘴巴微张、嘴唇向后拉 | 身体后仰、缩成一团、双手举起护头、后退、发抖 |
| **惊讶** | 眉毛大幅上挑、眼睛圆睁、嘴巴张开呈 O 型 | 身体后跳、手捂嘴、手臂张开、僵住不动 |
| **厌恶** | 皱鼻、上唇抬起、嘴角下拉、眯眼 | 身体后仰、转头避开、摆手推拒、捂住鼻子 |

### 进阶情绪（8 种）

| 情绪 | 面部表情 | 身体动作与手势 |
|---|---|---|
| **轻蔑** | 单侧嘴角上挑、微眯眼、轻微歪头 | 抱臂、仰头、转身背对、轻微耸肩 |
| **羞涩** | 脸颊泛红、视线向下、抿嘴、低头 | 绞手指、双手背在身后、身体轻微扭动、躲在他人身后 |
| **尴尬** | 苦笑（嘴唇拉平后提）、眼神回避、额头出汗 | 摸后脑勺、挠头、用手扇风、试图离开 |
| **自豪** | 微笑、下巴微微抬起、挺鼻、眼睛明亮 | 挺胸抬头、双手叉腰、展示某物、昂首阔步 |
| **嫉妒** | 微咬下唇、眯眼、假笑（嘴角上扬但眼睛无笑意） | 抱臂、脚尖朝向别处、手指轻敲、耸肩 |
| **爱意** | 温柔微笑、瞳孔放大、眼神柔和、轻微歪头 | 轻轻触摸对方手臂、拥抱、抚摸头发、靠近 |
| **无聊** | 眼神空洞、打哈欠、眼皮下垂、嘴角轻微下拉 | 托腮、身体瘫坐、玩头发、看手表、伸懒腰 |
| **惊恐** | 极度睁眼、眉毛不对称、嘴巴张开但无法出声 | 双手捂住脸、后退跌倒、身体僵硬、手指张开 |

### 动作反查表（15 个常见动作 → 情绪）

| 动作 | 常见关联情绪 |
|---|---|
| 抱臂 | 防御、愤怒、轻蔑、紧张 |
| 低头 | 悲伤、羞愧、害羞 |
| 仰头 | 自豪、大笑、挑衅 |
| 歪头 | 好奇、爱意、轻蔑 |
| 握拳 | 愤怒、决心、紧张 |
| 摊手 | 无奈、坦诚、请求 |
| 耸肩 | 无奈、不知道、轻蔑 |
| 用手掩面 | 尴尬、挫败、失望 |
| 跺脚 | 愤怒、不耐烦 |
| 跳起 | 快乐、兴奋、惊讶 |
| 后退 | 恐惧、惊讶、厌恶 |
| 前倾 | 感兴趣、愤怒、挑衅 |
| 发抖 | 恐惧、寒冷、愤怒（强压抑） |
| 绞手 | 焦虑、紧张、担忧 |
| 摸脖子 | 不安、紧张、欺骗 |

---

## 英文版（原文 prompt 素材，供视觉节点使用）

### Basic Emotions

| Emotion | Facial Expression | Body Action & Gesture | Prompt Keywords |
|---|---|---|---|
| Happy | 嘴角上扬、眼睛眯起、鱼尾纹、露齿笑 | 挺胸、张开双臂、跳跃、鼓掌、手舞足蹈 | `happy, smiling, laughing, joyful, eyes crinkled, open arms, jumping, cheering` |
| Sad | 眉毛内角上抬、嘴角下拉、下唇颤抖、眼泪 | 低头、驼背、双手抱臂、用手掩面、缓慢移动 | `sad, crying, tears, downturned mouth, furrowed brow, head down, slouched posture, hugging self` |
| Angry | 眉毛下压并聚拢、怒视、嘴唇紧闭或咬牙、鼻翼张开 | 握拳、身体前倾、跺脚、拍桌、手臂僵硬 | `angry, frowning, glaring, clenched jaw, fists clenched, leaning forward, stomping foot, tense shoulders` |
| Fear | 眉毛抬高并聚拢、眼睛睁大、嘴巴微张或张开、嘴唇向后拉 | 身体后仰、缩成一团、双手举起护头、后退、发抖 | `fearful, wide eyes, raised eyebrows, open mouth, cowering, stepping back, trembling, hands up in defense` |
| Surprise | 眉毛大幅上挑、眼睛圆睁、嘴巴张开呈 O 型 | 身体后跳、手捂嘴、手臂张开、僵住不动 | `surprised, wide eyes, raised eyebrows, open mouth (oval), jumping back, hand over mouth, frozen posture` |
| Disgust | 皱鼻、上唇抬起、嘴角下拉、眯眼 | 身体后仰、转头避开、摆手推拒、捂住鼻子 | `disgusted, wrinkled nose, raised upper lip, squinting, leaning away, turning head, waving hand away, covering nose` |

### Advanced Emotions

| Emotion | Prompt Keywords |
|---|---|
| Contempt | `contempt, one-sided smirk, half smile, arms crossed, tilted head, turning away, slight shrug` |
| Shy / Embarrassed（羞涩） | `shy, blushing, looking down, biting lip, fidgeting hands, hiding behind, hunched shoulders` |
| Embarrassed（尴尬） | `embarrassed, awkward smile, avoiding eye contact, sweating forehead, rubbing back of neck, scratching head` |
| Pride | `proud, raised chin, smiling, puffed chest, hands on hips, standing tall, displaying something` |
| Envy | `envious, fake smile, tight-lipped smile, narrowed eyes, arms crossed, tapping fingers, side glance` |
| Affection / Love | `affectionate, warm smile, soft eyes, gentle touch, hugging, holding hands, leaning in, caressing` |
| Boredom | `bored, blank stare, yawning, slouching, propping head on hand, checking watch, slumping in chair` |
| Horror / Shock | `horrified, wide eyes with furrowed brow, mouth agape, hands covering face, staggering back, frozen in shock` |

### Action Quick Lookup

| Action | Prompt Keyword |
|---|---|
| Crossed arms | `crossed arms, defensive posture` |
| Head down | `head bowed, looking at floor` |
| Head tilted back | `head tilted back, laughing` |
| Head tilt | `head tilt, curious, affectionate` |
| Clenched fist | `clenched fist, tense hand` |
| Open palms | `open palms, shrugging, pleading` |
| Shrug | `shrugging shoulders, I don't know` |
| Facepalm | `facepalm, embarrassed` |
| Stomp foot | `stomping foot, impatient` |
| Jumping | `jumping, joyful leap` |
| Step back | `stepping back, recoiling` |
| Lean forward | `leaning forward, engaged` |
| Trembling | `trembling, shaking with fear` |
| Wringing hands | `wringing hands, nervous gesture` |
| Touching neck | `touching neck, uncomfortable` |

### Prompt Examples

**Example 1 — Extreme Anger**
```
A person showing extreme anger, frowning deeply, glaring eyes, clenched jaw,
fists clenched tightly, leaning forward aggressively, stomping foot.
Masterpiece, ultra HD, cinematic lighting.
```

**Example 2 — Shy Teenage Girl**
```
A shy teenage girl, blushing cheeks, looking down at the floor, biting her
lower lip, fidgeting with her fingers, slightly hunched shoulders, standing
behind a door. Soft natural lighting, realistic style.
```

**Example 3 — Proud Public Speaker**
```
A proud public speaker, chin raised high, broad confident smile, chest puffed
out, hands on hips, standing tall on stage, bright eyes. Professional
photography, sharp focus, warm stage lighting.
```

**Example 4 — Horror + Surprise Moment (Video)**
```
A person suddenly horrified, eyes wide with raised inner brows, mouth agape
but silent, hands flying up to cover face, staggering backward, body frozen
in shock. Slow motion, dramatic lighting.
```

---

## 使用建议（复制自原文）

1. **三元组同时给**：不要只说 `happy`，要说 `happy, smiling with crinkled eyes, open arms reaching out`
2. **程度修饰**：`slightly` / `subtle` / `intense` / `extreme`
3. **文化差异注意**：OK 手势、竖大拇指在不同地区含义不同，全球内容生成时避免或注明
4. **负面提示词**：不匹配时加 `--no neutral expression, blank stare, rigid posture`
5. **视频生成**（Sora / Pika / Runway Gen-2）：用"动作序列"描述，例 `starts with surprise, then transitions to fear`

## 可扩展方向

- 结合情绪强度等级（1–10 级）：`mild annoyance → extreme rage`
- 加入眼神方向（直视 / 回避 / 向上看 / 向下看）
- 多人交互关系动作：`looking at each other, touching shoulder, pushing away`
- 按场景细化（面试 / 婚礼 / 战斗 / 约会）

---

**原文位置**：`F:\下载文件\AI技术分享\skill分享\表情-情绪-动作对照表.txt`
