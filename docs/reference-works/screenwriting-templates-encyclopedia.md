# 参考资料 · 著名编剧模板大全（速查手册）

> **归档日期**：2026-05-06
> **原始来源**：`F:\下载文件\AI技术分享\skill分享\著名编剧模板大全.md`（24 KB / 784 行 / 15 章）
> **原文位置**：`@docs/reference-works/screenwriting-templates-encyclopedia-original.md`（已复制全文）
> **归档原因**：本档是**编剧结构速查手册**（通览目录型），70%+ 内容已被 cineforge 现有方法模块覆盖。原文保留作为：
>   - 用户在 `MethodModulePanel` 选择模块前的**教育材料**
>   - 未来开发"模板浏览器 / 结构对比工具"的目录
>   - 不在 cineforge 中实现的边缘模板（电视剧 TEAM / 极限节拍器等）的参考
> **运行时状态**：❌ 不被加载 / ❌ 不影响 LLM 调用。

---

## 一、与 cineforge-web 现有模块的映射表

| 文档章节 | 模板名称 | cineforge 模块 ID | 状态 |
|---|---|---|---|
| 第 1 章 | 三幕结构 | `three-act-structure` | ✅ 已实现 |
| 第 2 章 | Save the Cat 15 拍 | `save-the-cat-15beats` | ✅ 已实现 |
| 第 3 章 | 英雄之旅 12 阶段 | `heros-journey-12stages` | ✅ 已实现 |
| 第 4 章 | Freytag 金字塔 | — | ❌ 未实现（古典悲剧用） |
| 第 5 章 | 八序列结构 | — | ❌ 未实现（长片/剧集用） |
| 第 6 章 | 七点结构（Dan Wells 通用版） | `seven-points-romance`（Lindsay Doran 爱情专用版） | ⚠ 部分覆盖 |
| 第 7 章 | 故事圆圈 | `harmon-story-circle` | ✅ 已实现 |
| 第 8 章 | 雪花法 10 步 | `snowflake-method-7steps`（精炼为 7 步） | ✅ 已实现 |
| 第 9 章 | 起承转结 Kishōtenketsu | `kishotenketsu` | ✅ 已实现 |
| 第 10 章 | 米兰达法 / Truby 22 步 | `truby-22-steps` | ✅ 已实现 |
| 第 11 章 | 极限节拍器 40 拍 | — | ❌ 未实现（与 Save the Cat 重合） |
| 第 12 章 | 电视剧 TEAM 五幕 | — | ❌ 未实现（剧集场景，非小说） |
| 第 13 章 | 类型片骨架（爱情/悬疑/超英/恐怖） | — | ❌ 未实现（骨架公式） |
| 第 14 章 | 独立电影 / 章节式 | — | ❌ 未实现（艺术片） |
| 第 15 章 | 皮克斯公式（7 步 + 25 法则） | `pixar-22-rules`（Emma Coats 22 法则） | ⚠ 互补 |

**已实现率：约 70%**

---

## 二、未实现项的判断

| 未实现章节 | 价值评估 | 是否值得未来补建 |
|---|---|---|
| **Freytag 金字塔** | 古典悲剧/戏剧理论始祖；适用文艺小说 / 莎士比亚式悲剧 | ⭐⭐ 若用户需求出现可补 |
| 八序列结构 | 与 Save the Cat 部分重合，但更适合长篇 | ⭐ 优先级低 |
| Dan Wells 七点 | 与 `twelve-step-mystery` 高度重合 | ✗ 不补 |
| 极限节拍器 40 拍 | Save the Cat 强化版，颗粒度过细 | ✗ 不补 |
| 电视剧 TEAM 五幕 | 剧集编剧专用，与小说创作错位 | ✗ 不补 |
| 类型片骨架 | 骨架公式，不及现有专项模块（如七点爱情/12 步推理） | ✗ 不补 |
| 独立电影章节式 | 艺术片专用，受众窄 | ✗ 不补 |
| 皮克斯 7 步公式 | 与 22 法则互补，可作为 `pixar-22-rules` 的补丁 | ⭐ 可作扩展 |

---

## 三、速查对比表（精华提炼）

| 模板 | 最适合类型 | 复杂度 | 适合时长 | 核心特点 | cineforge 模块 |
|---|---|---|---|---|---|
| 三幕结构 | 通用商业片 | ⭐ | 90-120min | 简洁经典 | `three-act-structure` |
| Save the Cat | 类型商业片 | ⭐⭐ | 90-120min | 15 节拍精细 | `save-the-cat-15beats` |
| 英雄之旅 | 奇幻/史诗/冒险 | ⭐⭐ | 120min+ | 神话原型 | `heros-journey-12stages` |
| Freytag 金字塔 | 古典/悲剧/剧情 | ⭐ | 90-120min | 戏剧冲突 | — |
| 八序列 | 长篇/剧集 | ⭐⭐⭐ | 120min+ | 多线程 | — |
| 七点结构 | 悬疑/惊悚/恐怖 | ⭐⭐ | 90-120min | 悬疑驱动 | `seven-points-romance` / `twelve-step-mystery` |
| 故事圆圈 | 角色驱动/剧集 | ⭐⭐ | 90-120min | 环形叙事 | `harmon-story-circle` |
| 雪花法 | 复杂长篇 | ⭐⭐⭐ | 长篇/剧集 | 迭代扩展 | `snowflake-method-7steps` |
| 起承转结 | 文艺/心理/东亚 | ⭐ | 90-120min | 无冲突惊喜 | `kishotenketsu` |
| Truby 22 步 | 复杂角色/剧情 | ⭐⭐⭐ | 120min+ | 角色驱动 | `truby-22-steps` |
| 皮克斯公式 | 动画/家庭 | ⭐ | 90min | 情感纯度 | `pixar-22-rules` |

---

## 四、Pixar 7 步公式（互补于 `pixar-22-rules`）

> 这是本档第 15 章的独家公式，可作为 `pixar-22-rules` 模块的未来补丁素材：

1. 从前从前...（Once upon a time...） → 日常世界
2. 每天都是...（Every day was...） → 平凡幸福
3. 直到有一天...（Until one day...） → 催化事件
4. 因为...（Because of that...） → 主角被迫行动
5. 因为...（Because of that...） → 进入冒险世界
6. 直到最后...（Until finally...） → 终局
7. 从此以后...（And ever since then...） → 世界永久改变

---

## 五、用户教育用途

本档可作为 cineforge **`MethodModulePanel` 选择前的教育材料**：

- **新用户**：先读速查表了解 11 大主流结构差异 → 再去模块面板按 `category=structure` 选用
- **进阶用户**：参考"使用此模板的经典电影"作为风格学习样本
- **对比用户**：通过对比表选择最匹配自身项目类型的模板

未来可在前端 `MethodModulePanel` 增加 "结构教学手册" 按钮，链接打开本档。

---

## 六、原文保留

完整 15 章 / 784 行原文保留于：

`@docs/reference-works/screenwriting-templates-encyclopedia-original.md`

包含：
- 各模板完整框架图（ASCII 流程图）
- 经典案例片单（《阿甘正传》/《教父》/《盗梦空间》/《东京物语》等）
- Save the Cat 完整《阿甘正传》节拍对照表
- 英雄之旅"英雄 vs 反派双线对照表"
- 韩剧周末剧 / 月火剧 / 水木剧 / 金土剧格式对照
- 编剧工具推荐（Final Draft / WriterDuet / Celtx / Highland 等）

---

## 七、未来集成路径

### 路径 A · `MethodModulePanel` 内嵌教学手册
在前端方法模块选择面板增加"结构教学"按钮，渲染本档速查对比表 + 原文索引。

### 路径 B · 按需补建模块（用户驱动）
若未来用户上传"古典悲剧创作"或"长篇剧集开发"相关需求资料，再分别补建 `freytag-pyramid` / `eight-sequence-approach` 模块。

### 路径 C · `pixar-22-rules` 扩展
将第 15 章 7 步公式作为补丁加入 `pixar-22-rules.md`（约 80 token），形成"22 法则 + 7 步公式"双视角。

---

**归档完成。无任何运行时变更。**
