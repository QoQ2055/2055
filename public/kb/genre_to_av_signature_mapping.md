# 原子题材 → 视听签名 映射表

> 解决两套题材分类体系的对接：
> - **原子题材（genre）**：用户在「新建项目」时选择的标签，**多选 1-3 个**。30 个枚举值，权威源 `src/data/projectTaxonomy.ts` 中的 `GENRES`。
> - **视听签名（audiovisualSignature）**：用于决定 `落幅末状态 5 维度 / AUDIO_REFS / 题材专属禁忌` 等下游分镜参数的**单选**分类。10 个枚举值，定义在 `genre_taxonomy_and_taboos.md`。
>
> 用户选 N 个原子题材后，下游需要把 N→1 折叠成单一视听签名，本文给出标准折叠规则。

---

## 1. 30 原子题材 → 10 视听签名 默认映射

| 原子题材 `value` | label | group | 默认视听签名 |
|---|---|---|---|
| `xianxia` | 仙侠/修真 | 东方玄幻 | **武侠仙侠** |
| `xuanhuan` | 玄幻 | 东方玄幻 | **武侠仙侠** |
| `wuxia` | 武侠 | 东方玄幻 | **武侠仙侠** |
| `urban` | 都市 | 都市/现实 | **都市职场** |
| `urban_super` | 都市异能 | 都市/现实 | **都市职场** |
| `system` | 系统流 | 都市/现实 | **都市职场** |
| `rebirth` | 重生/穿越 | 都市/现实 | **真人短剧**（按表面叙事载体） |
| `workplace` | 职场 | 都市/现实 | **都市职场** |
| `ceo` | 霸总 | 都市/现实 | **都市职场** |
| `mystery` | 悬疑 | 悬疑/惊悚 | **悬疑刑侦** |
| `reasoning` | 推理 | 悬疑/惊悚 | **悬疑刑侦** |
| `thriller` | 惊悚/恐怖 | 悬疑/惊悚 | **恐怖惊悚** |
| `scifi` | 科幻 | 科幻/末世 | **机甲科幻** |
| `cyberpunk` | 赛博朋克 | 科幻/末世 | **赛博朋克** |
| `apocalypse` | 末世/废土 | 科幻/末世 | **战争**（末世武装） |
| `history` | 历史/正剧 | 历史/架空 | **古装宫斗** |
| `alt_history` | 架空历史 | 历史/架空 | **古装宫斗** |
| `palace` | 宫斗/宅斗 | 历史/架空 | **古装宫斗** |
| `intrigue` | 权谋 | 历史/架空 | **古装宫斗** |
| `era_drama` | 年代/民国 | 历史/架空 | **真人短剧**（民国年代戏，非古装也非现代） |
| `fantasy` | 西幻 | 西幻/奇幻 | **武侠仙侠**（魔法 = 法术能量层规则一致） |
| `dnd` | DnD/剑魔 | 西幻/奇幻 | **武侠仙侠** |
| `dark_fantasy` | 黑暗奇幻 | 西幻/奇幻 | **恐怖惊悚** |
| `romance` | 言情 | 情感/校园 | **真人短剧** |
| `sweet` | 甜宠 | 情感/校园 | **真人短剧** |
| `campus` | 校园 | 情感/校园 | **校园青春** |
| `youth` | 青春 | 情感/校园 | **校园青春** |
| `infinite` | 无限流 | 特殊 | **机甲科幻**（如含 mecha） / **恐怖惊悚**（如含 cthulhu） / **真人短剧**（按主载体） |
| `esports` | 电竞/游戏 | 特殊 | **真人短剧** |
| `farming` | 种田/基建 | 特殊 | **真人短剧** |
| `fast_wear` | 快穿 | 特殊 | **真人短剧** |

---

## 2. N→1 折叠规则（用户多选时）

用户最多选 3 个原子题材。折叠到单一视听签名按以下优先级：

### 2.1 优先级链（高 → 低）

```
战争  >  机甲科幻  >  赛博朋克  >  武侠仙侠  >  古装宫斗
     >  恐怖惊悚  >  悬疑刑侦  >  都市职场  >  校园青春
     >  真人短剧（兜底）
```

> 直觉：**高视觉冲击 / 强题材签名** > **低视觉冲击 / 通用签名**。
> 例：`scifi + romance` → `机甲科幻`（因为科幻视觉签名比言情强）。

### 2.2 子风格（genreSubtags）反向触发

某些原子题材组合应触发 **genreSubtag 叠加**而非改变主签名：

| 原子题材组合 | 主签名 | 触发的 genreSubtag |
|---|---|---|
| `rebirth + 任意` | 维持非 rebirth 项的签名 | `闪回 / 平行蒙太奇`（重生 = 双时空叙事） |
| `infinite + 任意` | 维持非 infinite 项的签名 | `平行蒙太奇`（无限流 = 多副本） |
| `system + 任意` | 维持非 system 项的签名 | `蒙太奇剪辑`（系统流 = 高密度信息切换） |
| `fast_wear + 任意` | 维持非 fast_wear 项的签名 | `平行蒙太奇`（快穿 = 多身份） |
| `dark_fantasy + 任意` | `恐怖惊悚` | `梦境 / 闪回` |
| `apocalypse + 任意` | `战争` | `手持纪实` |
| `任意 + 含"仪式"关键词` | 维持原签名 | `仪式蒙太奇` |

### 2.3 模糊冲突的兜底

若优先级链与触发器都判不清（如 `era_drama + xianxia`），**取首项**（用户在 NewProjectDialog 第一个选的）。

---

## 3. 用户字段示例（pro 模式 user message 顶部）

```yaml
mode: pro
genres: [scifi, cyberpunk, romance]              # 30 原子题材，多选 1-3 (用户输入)
audiovisualSignature: 机甲科幻                    # 10 类，由本表自动派生 (LLM/系统计算)
genreSubtags: [仪式蒙太奇, 海报帧]                # 子风格，叠加修饰
```

> **重要**：`genres` 与 `audiovisualSignature` 是**两个不同字段**：
> - `genres` 是用户的原子选择，**直接来自 ProjectContext.genres**
> - `audiovisualSignature` 是从 `genres` 派生的下游单选签名，由本文映射规则计算

---

## 4. 在 prompt 中的引用方式

下游 prompt（如 `unit_copy_template.md` / `audio_db_reference.md` §2.2 / `genre_taxonomy_and_taboos.md` §2-3）的所有「按题材」表，**都按 audiovisualSignature 的 10 类组织**，与原子题材无关。

LLM 在收到 user message 后：
1. 读 `genres`（原子）+ 读本表 → 计算 `audiovisualSignature`
2. 后续所有题材相关查询（5 维度落幅 / 强制声明 / AUDIO_REFS / 微表情变体）都以 `audiovisualSignature` 为 key
3. **绝不混用** `genres[0]` 和 `audiovisualSignature`

---

## 5. 自检清单

| # | 检查 | 失败动作 |
|---|---|---|
| AVS-1 | `audiovisualSignature` ∈ 10 类 (`真人短剧 / 机甲科幻 / 武侠仙侠 / 古装宫斗 / 战争 / 悬疑刑侦 / 赛博朋克 / 恐怖惊悚 / 校园青春 / 都市职场`) | 修正到合规值 |
| AVS-2 | `audiovisualSignature` 与 `genres` 通过本表映射一致 | 重新派生 |
| AVS-3 | `genres` 中所有值 ∈ `projectTaxonomy.ts` 的 30 类 | 删除非法值 |
| AVS-4 | 多选 `genres` 时，按 §2.1 优先级链折叠 | 重新折叠 |

---

**核心定位**：把"用户输入维度（genre）"与"分镜参数维度（audiovisualSignature）"明确解耦，避免下游 KB 混用两套不同语义的"题材"。

**权威源**：
- `genres`：`src/data/projectTaxonomy.ts` 中 `GENRES` 数组（30 项）
- `audiovisualSignature`：`genre_taxonomy_and_taboos.md` §1.1（10 项）
