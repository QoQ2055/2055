# 分镜进阶（高精度）模式参考

> 本文是「事实清单 + 单元生成」两阶段流水线的进阶模式约束摘要。
> 哲学：**翻译器**——所有进阶字段必须能在「user message / 剧本 / 设定集」找到出处，
> **严禁凭空捏造**；找不到就留空，不要硬填。
>
> 配套阅读：
> - `audio_db_reference.md` — dB 数值与 AUDIO_REFS 模板
> - `cinematography_terms.md` — 景别 / 焦段 / 慢动作 / 轴线
> - `genre_taxonomy_and_taboos.md` — 题材标签 / 5 维度变体 / 题材禁忌
> - `numerical_anchors.md` — 数值上下界 / 拍数升级阈值 / 数据源优先级
> - `storyboard_workflow_norms.md` — TODO 占位 / 字数压缩

---

## 1. 模式开关

`user message` 顶部声明：

| 值 | 行为 |
|---|---|
| `mode: standard` 或缺省 | 按基础 schema 输出，**忽略本文所有进阶字段** |
| `mode: pro` | 启用进阶字段 + 数值化精度硬约束 |

**严禁**：standard 模式下输出进阶字段；pro 模式下漏掉进阶字段。

---

## 2. 数值化精度硬约束（pro 模式）

凡是可量化的字段，**禁止**用「缓慢」「微微」「远处」「轻轻」等模糊词。
必须给出具体数值。

| 维度 | 必须标注的单位 | 示例 |
|---|---|---|
| 空间距离 | 米（m） | 「100 米外」「水面一米高处」 |
| 相机平移 / 推拉速度 | m/s | 「横移 1.0m/s 同步主体」 |
| 慢动作倍率 | x | 「1.5x 慢动作」「0.5x 升格」 |
| 焦距 | mm | 「LS 24mm / MS 35mm / MCU 85mm」 |
| 镜头切换时刻 | 秒 + 拍序号 | 「9 秒切第 4 拍」 |
| 音量层次 | dB | 「-18dB」「递增 -20→-12dB」 |
| 光比 / 亮度比 | 比值 | 「主体:背景 = 1:12」 |
| 角色 / 设备状态 | 百分比 | 「反应堆 100%」「装甲完整度 85%」 |
| 物理量 | 公制单位 | 「水花高度 ≈ 15 米」 |
| 持续时间 | 秒 / 毫秒 | 「持续 0.3 秒」「闪烁 200ms」 |

**校验源**：所有数值必须能在 `analysisContext.unitMetrics`（或事实清单中的 metrics 字段）找到出处。
**找不到 = 不写**，绝不编造。详见 `numerical_anchors.md` 第 3 节「数据源优先级」。

---

## 3. 上游事实清单的进阶 Schema

事实清单（短剧 8 步剧本输出）需要为下游单元生成器提供数值锚 + 题材锚。

### 3.1 META 块

```yaml
structureType: linear|parallel|frame    # 标准 3 类，权威源 src/pipeline/compose.ts:53
                                        # 注：flashback / montage / block 等叙事手法属于 genreSubtag，不在此字段
totalSec: 总秒数
totalUnits: 总单元数
genres: [xianxia, wuxia]                                       # 30 原子题材多选 1-3，权威源 src/data/projectTaxonomy.ts
audiovisualSignature: 武侠仙侠                                # 10 视听签名单选，由 genres 映射而来（见 genre_to_av_signature_mapping.md）
# 可选名单：真人短剧 / 机甲科幻 / 武侠仙侠 / 古装宫斗 / 战争 / 悬疑刑侦 / 赛博朋克 / 恐怖惊悚 / 校园青春 / 都市职场
genreSubtags: 仪式蒙太奇, 海报帧, 长镜头, 蒙太奇剪辑           # 0-N 个, 逗号分隔
audioPolicy: themeAsLowBed|noBgm|silentFloor                  # 单选
visualPolicy: allowSilhouette, allowSlowMo:[4], allowSplitScreen
```

- `genres` 是用户输入维度（原子题材多选）；`audiovisualSignature` 是下游分镜维度（视听签名单选），两者不可混用
- `audiovisualSignature` 决定**落幅末状态 5 维度变体**（参考 `genre_taxonomy_and_taboos.md` 第 2 节）
- `genreSubtags` 决定 **sub-shot 升级触发**
- `audioPolicy: themeAsLowBed` 表示允许主题旋律作为音效层底部（≤-12dB），不作为独立 BGM
- `visualPolicy` 列**允许的技法白名单**，未列出的默认禁止
- 数值范围（如 `allowSlowMo:[4]` 表示仅第 4 拍允许）写在中括号里

### 3.2 AUDIO_REFS 块（pro 必出 1 块）

放在 META 之后、第一个 PARA 之前。给下游提供**全局音量参考**，避免 dB 随机捏造。

```yaml
silenceFloor: -32dB
ambientBase:  -18dB
dialogueBase: -6dB
sfxLight:     -14dB
sfxHeavy:     -3dB
combatHit:    -6dB
themeBed:     -12dB    # 仅 themeAsLowBed 模式输出
```

下游单元生成器**只能引用这些键名 + 上下浮动 ±3dB**。
完整题材模板见 `audio_db_reference.md` 第 2.2 节。

### 3.3 SCENE_HEADER 块（每场 1 块）

放在该场第一个 PARA 之前。给下游提供**场级氛围锚**。

```yaml
sceneId: 2
title: 港口涉水入海
location: 港口防波堤外海湾
timeOfDay: 破晓|清晨|正午|黄昏|入夜|深夜|时间不明
lighting: 朝阳从海面边缘撕开一道缝, 主光从画右上方
weather: 微风海浪, 能见度高
genreSubtags: 仪式蒙太奇, 海报帧                # META.genreSubtags 的子集覆盖
```

`lighting` 必填，必须能在剧本 / 美术稿找到出处。

### 3.4 PARA 块字段放宽 + 新增 metrics

| 字段 | standard 上限 | pro 上限 |
|---|---|---|
| 动作 | ≤15 字 | ≤40 字（含关键物理参数） |
| 场景 | ≤10 字 | ≤25 字（含具体方位 / 距离） |
| 情绪 | ≤6 字 | ≤15 字（允许复合情绪） |

新增 `metrics` 子字段（**全部可选**）：

```yaml
metrics:
  spaceDistance: 距防波堤 40 米; 角色2 在水下 100 米外 / 深 15 米
  speedVector: 步速 1.0m/s, 画左→画右
  scaleSize: 角色1 高 22 米
  energyState: 反应堆 100% / 装甲 100% / 声呐锁定 100%
  audioVolume: 水花 -3dB; 装甲渗水 -14dB
  lightRatio: 主体:朝阳 = 1:12
  duration: 13 秒
```

留空时下游单元生成器**禁止**填入数值。

### 3.5 UNIT 块新增字段

```yaml
sceneId: 2
sectionRefs: §3
durationSec: 13
sceneType: 文戏|快文戏|武戏|动作非武|环境          # 标准 5 类，权威源 src/pipeline/storyboardPlan.ts
subShotCount: 4
subShotPattern: 2+4+3+4              # 各段秒数总和 = durationSec
climaxBeat: 4                         # 高潮拍序号 (1-indexed)
slowMoBeats: [4]                      # 哪些拍升格
cameraHint: LS定→MS横移→MCU长焦→ELS低角度1.5x慢动作   # 拍数 = subShotCount
axisHint: 入海方向轴 (画左→画右)
mustShowHint: 第一脚水花爆开 / 膝腰胸三阶段 / 朝阳一道缝
mustNotHint: PILOT 脸 / 损毁装甲 / 整片日出
summary: ≤60 字
plannedEntryState: ≤120 字
plannedExitState: ≤120 字
```

---

## 4. 下游单元生成器进阶约束

### 4.1 新增 `## Must-not` 字段（pro 必填）

每个进阶单元**必填**。列出本单元画面**绝对不能出现**的元素：

- 角色身份泄漏（如「PILOT 的脸不出现」）
- 损伤状态错配（如「本单元装甲仍完好，禁止任何已损毁装甲」）
- 题材禁忌（参考 `genre_taxonomy_and_taboos.md` 第 3 节）
- 字幕 / 水印（与强制声明重复，但 Must-not 里再写一遍以加强）

### 4.2 `## 相机` 新增 `焦段` 行（独立于 `焦距`）

```
机位: ...
运动: ...
焦距: 混合（或 标准/广角/长焦 单一选项）       # 描述性
焦段: LS 24mm / MS 35mm / 地平线 MCU 85mm    # 数值，必填
轴线: ...
```

### 4.3 `## 微表情` 题材变体

| 题材 | 写法 |
|---|---|
| 真人情绪戏（默认） | 身体部位 + 动词，必须在原文找到出处 |
| 机甲 / 装甲单元 | **改写为光学描述**：亮度比 + 轮廓光方向 + 反光质感 |
| 逆光 / 剪影戏 | 同机甲：写光比 + 光向，**不写情绪** |
| 武侠 / 仙侠 | 真人版 + 法术能量层（光纹强度百分比、流光速度 m/s） |

详见 `cinematography_terms.md` 第 3 节。

### 4.4 `## 强制声明` 拆分为两段

**`## 强制声明（视觉）`**：字幕水印 + 物理真实 + 题材视觉追加
**`## 强制音频声明`**：BGM 政策 + 音效同步性 + 题材音频追加

题材追加格式统一为 `（XX 题材追加）禁止 YY`。完整模板见 `audio_db_reference.md` 第 6 节。

### 4.5 `## 落幅` 5 维度变体

末秒画面 + 角色定格状态写在同一段。**5 维度名称随题材切换**：
参考 `genre_taxonomy_and_taboos.md` 第 2 节完整表。

**只列适用维度**，不适用的整段删除（不写"不适用"占位）。

---

## 5. sub-shot 切分升级表

戏份类型与子风格是**两个正交维度**。两表合并决定最终拍数：

### 5.1 sceneType 维度（5 类，标准枚举）

> 权威源：`src/pipeline/storyboardPlan.ts` 中 `SCENE_TYPES` 数组。
> 任何 KB / prompt / 解析器都必须用以下 5 个标准名，不得自创变体。

| sceneType | 默认拍数 | 升级触发 | 升级后拍数 |
|---|---|---|---|
| **文戏** | 3 | 话轮 ≥3 / 信息揭示密集 / 情绪转折 ≥2 | 4 |
| **快文戏** | 4 | 多线信息 / 高密度对话 / 反转节点 | 4-5 |
| **武戏** | 4-6 | 终结需特写定格 / 多回合 | +1 拍特写 |
| **动作非武** | 3-5 | 追逐 / 奔跑 / 高强度体力戏 | +1 拍以分阶段 |
| **环境** | 1-2 | 一般不升级 | — |

### 5.2 genreSubtag 维度（叠加修饰）

子风格在 sceneType 之上**追加**升级触发，可同时与多个 sceneType 叠加。

| genreSubtag | 适用 sceneType | 升级动作 |
|---|---|---|
| 仪式蒙太奇 / 入场 / 名场面 | 文戏 / 武戏 / 动作非武 | 默认 +1 拍至 4-5（含 1.5x 慢动作拍）；关键帧需海报感 |
| 战争场面 | 武戏 / 动作非武 | 拍数顶到 5-7（容器顶到 15 秒）；多角色多事件并行 |
| 海报帧 | 任意 | 至少 1 拍可定格（中央 / 三分构图 + 极强逆光） |
| 长镜头 | 任意 | 强制 1 拍（不切 sub-shot） |
| 蒙太奇剪辑 | 任意 | 拍数 ≥6，每拍 1.5-3 秒 |

完整子风格表见 `genre_taxonomy_and_taboos.md` §1.2 / §4。

### 5.3 通用约束

**每拍必须明确标景别代号**（LS/MS/MCU/CU/ECU/ELS/POV）。
景别代号 + 焦段数值是进阶版双标注硬要求。

**慢动作（升格）使用规则**：详见 `cinematography_terms.md` 第 2 节。
- **仪式蒙太奇** 子风格：允许 1 拍 1.5x，仅用于剪影 / 朝阳 / 海报帧
- **武戏** sceneType：允许 1 拍 0.5x-1.5x，仅用于命中 / 受创 / 终结
- **文戏 / 快文戏** sceneType：**禁止升格**
- **动作非武** sceneType：允许 0.5-2x，仅用于关键体力节点
- **环境** sceneType：默认禁止；若叠加仪式蒙太奇 / 海报帧子风格则参照子风格规则

---

## 6. 进阶模式自检清单（追加）

事实清单输出后跑：

| # | 检查项 | 失败动作 |
|---|---|---|
| DP-1 | META.genre ∈ 题材白名单 | 改为合规值 |
| DP-2 | AUDIO_REFS 至少含 ambientBase + dialogueBase | 补全 |
| DP-3 | 每场有且仅有 1 个 SCENE_HEADER | 补全或去重 |
| DP-4 | 每个 UNIT 的 subShotPattern 各段总和 = durationSec | 重算切分 |
| DP-5 | cameraHint 拍数 = subShotCount | 补全 |
| DP-6 | slowMoBeats ⊆ visualPolicy.allowSlowMo | 删除越权拍号 |
| DP-7 | mustNotHint 至少 1 项 | 补「字幕水印」兜底 |
| DP-8 | metrics 数值能在 user message / 剧本找到出处 | 删除无源数值 |
| DP-9 | UNIT N 的 plannedEntryState ≈ UNIT N-1 的 plannedExitState | 调整对齐 |
| DP-10 | totalUnits = sum(scenes[].unitCount) | 重新打包 |

单元生成输出后跑（在原硬触发重写器基础上追加）：

| # | 触发条件 | 触发后动作 |
|---|---|---|
| T21 | 出现「缓慢」「微微」「远处」「轻轻」等模糊词替代了可量化数值 | 改写为数值或回退到默认描述性 |
| T22 | 焦段未标 mm | 补 mm 数值 |
| T23 | 音效未标 dB | 补 dB 数值 |
| T24 | 缺 `## Must-not` 字段 | 补该字段 |
| T25 | `## 强制声明` 未拆分为视觉 / 音频两段 | 拆分 |
| T26 | 落幅末状态用了与题材不匹配的 5 维度 | 按题材表替换维度名 |
| T27 | 升格用在了被禁止的场景（文戏 / 走位 / 铺垫） | 删除升格 |
| T28 | 数值无来源（既不在 user message 也不在剧本） | 删除该数值，回退到描述性 |

---

> **字段排版规范**：完整的单元 COPY 区 11 字段排版模板（含 `@Audio1/@Audio2` 双通道、`## 相机` 五行硬模板、强制声明 10 题材模板等）见 `unit_copy_template.md`。

## 7. 字数区间

进阶模式 COPY 区字数区间 **1100-1500 字**（标准默认 1000-1400）。
新增 Must-not / 焦段 / 题材声明 / 数值标注 平均增加 100-200 字。
**硬上限仍为 2000 字**（视频生成 API 截断阈值）。

字数压缩策略详见 `storyboard_workflow_norms.md` 第 2 节。

---

## 8. user message 顶部建议字段

调用进阶模式时，user message 顶部建议提供：

```yaml
mode: pro
genres: [scifi, cyberpunk]
audiovisualSignature: 机甲科幻                       # 由 genres 映射出（见 genre_to_av_signature_mapping.md §2.1）
genreSubtags: [仪式蒙太奇, 海报帧]
audioPolicy: themeAsLowBed
visualPolicy:
  allowSilhouette: true
  allowSlowMo: [4]
audioRefs:                  # 可选, 提供则 LLM 直接照填 AUDIO_REFS 块
  ambientBase: -18dB
  sfxHeavy: -3dB
unitMetricsHints:           # 可选, 给 LLM 数值锚, 让它能填 PARA.metrics
  - paraId: §3
    spaceDistance: 距防波堤 40 米
    scaleSize: 角色1 高 22 米
mustNotGlobal:              # 可选, 全剧通用的禁忌, 自动注入每个 UNIT.mustNotHint
  - PILOT 脸不出现
  - 损毁装甲在第 9 单元前不出现
scenes:
  - sceneId: 2
    secs: 13
    unitCount: 1
    sectionRefs: [§3]
    timeOfDay: 破晓
    lighting: 朝阳从海面边缘撕开一道缝
todos:
  - "@TODO_Audio_Theme_main"
```

**LLM 处理优先级**：
1. user message 显式提供的数值 → 直接照填
2. 剧本原文 / 设定集隐含的数值 → 提取后填入
3. 都没有 → 留空，**禁止编造**

---

## 9. 两阶段流水线字段映射

| 上游事实清单字段 | 下游单元生成器使用 |
|---|---|
| `META.audiovisualSignature` | 决定落幅末状态 5 维度变体 |
| `META.genres` | 不直接驱动分镜，但是 `audiovisualSignature` 的上游输入 |
| `META.genreSubtags` | 决定 sub-shot 升级触发 |
| `META.audioPolicy` | 决定主题旋律是否允许作为音效层底部 |
| `META.visualPolicy` | 决定慢动作是否允许、哪几拍允许 |
| `AUDIO_REFS` | 决定 dB 数值的引用范围（±3dB 内浮动） |
| `SCENE_HEADER.lighting` | 直接进入单元 `## 视觉描述` 字段 |
| `PARA.metrics` | 直接进入单元数值化字段（米 / m/s / 百分比 / 光比） |
| `UNIT.subShotPattern` | 直接进入单元 `## 时序` 的秒数切分 |
| `UNIT.cameraHint` | 直接进入单元 `## 相机` 的机位链 + 焦段链 |
| `UNIT.axisHint` | 直接进入单元 `## 相机.轴线` |
| `UNIT.mustShowHint` | 直接进入单元 `## Must-Show` |
| `UNIT.mustNotHint` | 直接进入单元 `## Must-not` |
| `UNIT.slowMoBeats` | 进入单元升格拍标注 |
| `UNIT.climaxBeat` | 进入单元 `## 时序` 的拍号高亮 |

**关键**：进阶模式下，单元生成阶段**只做翻译**——把上游事实清单的字段细化为完整描述，
**不补全上游没给的数值**。这是「翻译器哲学」在两阶段流水线中的延续。

---

## 10. LLM-only 概念 vs 代码 Schema 对照表

> 本文与配套 KB 提到许多看起来像 schema 字段的概念。**它们并非全部都已落到代码 schema**。
> 区分两类：
> - **代码 schema**（已落地）：fili-web 代码端有 TypeScript 类型 / 解析器 / 校验器。LLM 输出的对应字段会被解析存盘。
> - **LLM-only 概念**（仅 prompt 黑话）：只活在 prompt 与 LLM 输出文本里，代码不会主动解析。LLM 应当遵守，但代码不会校验。
>
> 此分类对开发者很重要：要把某 LLM-only 概念升级为 schema，需要新加 TS 类型 + 解析逻辑。

### 10.1 代码 schema 字段（已落地，会被解析）

| 字段 | 取值 / 类型 | 权威源 |
|---|---|---|
| `sceneType` | 5 类：`文戏 / 快文戏 / 武戏 / 动作非武 / 环境` | `src/pipeline/storyboardPlan.ts:54` `SCENE_TYPES` |
| `structureType` | 3 类：`linear / parallel / frame` | `src/pipeline/compose.ts:53` |
| `genres` | 30 原子题材 `value`（`xianxia / urban / scifi / ...`），数组多选 1-3 | `src/data/projectTaxonomy.ts:15-55` `GENRES` |
| `visualStyle` | 10 类：`wuxia_ink / xianxia_glow / cyberpunk / ...` | `src/data/projectTaxonomy.ts:112` `VISUAL_STYLES` |
| `platform` | 8 类：`douyin / kuaishou / ...` | `src/data/projectTaxonomy.ts:73` `PLATFORMS` |
| `protagonistGender` | 4 类：`male / female / dual / nonhuman` | `src/data/projectTaxonomy.ts:90` `PROTAGONISTS` |
| `durationMin` | 数值（分钟） | `src/data/projectTaxonomy.ts:100` `DURATIONS` |
| `unitIndex / durationSec / subShotCount / summary / sectionRefs / plannedEntryState / plannedExitState` | UNIT 块字段 | `src/pipeline/storyboardPlan.ts` Unit interface |
| `totalSec / totalUnits` | META 块字段 | 同上 |

### 10.2 LLM-only 概念（仅 prompt 用，代码不解析）

| 字段 | 取值（KB 定义） | 状态 | 若要 schema 化落到 |
|---|---|---|---|
| `audiovisualSignature` | 10 类视听签名 | 派生字段，由 `genres` 映射 | 可加到 `storyboardPlan.ts` 的 META interface |
| `genreSubtags` | 9 子风格（仪式蒙太奇 / 海报帧 / 长镜头 / 蒙太奇剪辑 / 手持纪实 / 静止冥想 / 快剪鼓点 / 平行蒙太奇 / 梦境闪回） | 纯 prompt | 同上，可加 `genreSubtags?: string[]` |
| `audioPolicy` | 3 类：`themeAsLowBed / noBgm / silentFloor` | 纯 prompt | 同上 |
| `visualPolicy` | 字典：`allowSilhouette / allowSlowMo:[N] / allowSplitScreen` | 纯 prompt | 同上，需自定义 schema |
| `timeOfDay` | 7 类：`破晓 / 清晨 / 正午 / 黄昏 / 入夜 / 深夜 / 时间不明` | 纯 prompt | `storyboardPlan.ts` Scene interface 加字段 |
| 景别代号 | 17 类（LS/MS/MCU/CU/ECU/ELS/VLS/MLS/BCU/POV/OTS/2S/3S/GS/HA/LA/DA/BEV/WEV） | 纯 prompt | `cinematography_terms.md` §1.1 |
| `metrics` 子字段 | `spaceDistance / speedVector / scaleSize / energyState / audioVolume / lightRatio / duration` | 纯 prompt | PARA interface 可扩展 `metrics?: {...}` |
| `unitMetricsHints` | user message 顶部传入的 metrics 锚 | 纯 prompt | 上游调用约定，无需 schema |
| `mustNotGlobal` | 全剧通用禁忌列表 | 纯 prompt | 上游调用约定 |
| `cameraHint / axisHint / mustShowHint / mustNotHint / slowMoBeats / climaxBeat / subShotPattern` | UNIT 块进阶字段 | 纯 prompt | 已在 KB 文档，未在 `storyboardPlan.ts` Unit interface |
| `AUDIO_REFS` 块 | dB 字典 | 纯 prompt | 可加 `analysisContext.audioRefs?: Record<string, string>` |
| `SCENE_HEADER` 块 | 场级氛围锚 | 纯 prompt | 可加 Scene interface |
| `PARA.metrics` | 段级数值锚 | 纯 prompt | PARA interface 可扩展 |
| `@Audio1 / @Audio2` 通道符号 | 排版字面量 | 纯 prompt 黑话 | 不需要 schema 化（这是文本格式） |
| `@TODO_*` 占位符 | 13 类前缀 | 纯 prompt 黑话 | 同上 |
| `mode: pro / standard` | user message 顶部开关 | 纯 prompt | 可加 settings + 注入控制 |

### 10.3 视觉风格双轨说明

| 体系 | 来源 | 数量 | 用途 |
|---|---|---|---|
| `visualStyle`（代码） | `projectTaxonomy.ts:112` | 10 | 项目设置 / concept 派生 |
| `style_library.md`（KB） | `public/kb/style_library.md` | 30 | prompt 风格后缀注入 |

两套并存是现有设计——前者是用户选择维度，后者是 prompt 工艺词库。无须强行合并。

### 10.4 升级路径建议

要把某个 LLM-only 概念升级为 schema 字段：

1. 在 `src/pipeline/storyboardPlan.ts` 的对应 interface（META / Scene / Unit / PARA）加可选字段
2. 在 `parseStoryboardPlan` 增加解析逻辑（JSON 优先，markdown 兜底）
3. 在自检 (`storyboardPlan.ts:225+` warnings) 增加校验规则
4. 在 KB 对应章节标注「已 schema 化，权威源 storyboardPlan.ts:XXX」

---

**核心定位**：把可量化字段全部数值化 + 按题材做 5 维度变体扩展 +
为下游提供 AUDIO_REFS / metrics / mustShowHint / mustNotHint / slowMoBeats /
cameraHint / axisHint 等数值锚，让单元生成阶段无需自己捏造数值。
