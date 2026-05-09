# fili-web · 知识产权三档分类政策（IP Tier Policy）

> 本文档是 fili-web 所有创作资料 / 方法论 / 算法借鉴的**治理基准**。
>
> 生效日期：2026-05-09
>
> 约束对象：fili-web 代码库的所有未来 commit · multimodal epic（MM1-MM5）的所有 PR · 所有引入外部参考资料的 PR 必须按本文档分级。
>
> 参考来源：`C:\Users\QvQ\CascadeProjects\cineforge-corpus\` 逆向重建档案（含山音 SKILL MIT 开源层 + CineForge 商业反推层）。

---

## §1 · 三档分类

### 🟢 第 1 档 · 自由商用 · 0 法律风险

**判定标准**：
- 原作者明示开源 license（MIT / Apache / BSD / CC-BY / CC-BY-SA）
- 公共知识（已广泛在学术/行业中流通的理论、术语、方法）

**典型资料**：

| 类目 | 资料 | 要求 |
| --- | --- | --- |
| 山音 SKILL 方法论 | `format-feature.md` / `format-short.md` / `format-ultrashort.md` / `format-series.md` / `core-methodology.md §零-§十` | MIT · 保留 `@山音` + 协议文本 attribution |
| 大师风格库 | 13 位大师（Nolan/Fincher/Kubrick/Lynch/Malick/Tarkovsky/Wong Kar-wai/Lee/Akerman/Varda/Kieslowski/Denis/Cuaron）关键词 | 公共风格知识 · 无需 attribution |
| 调色术语 | 13 种调色（Cinescope/Bleach Bypass/Teal-Orange/Day-for-Night 等） | 公共调色术语 · 无需 attribution |
| 工业术语 | 64 个镜头术语（ECU/CU/MS/MLS/WS/POV/OTS/Dutch 等） | 公共电影术语 · 无需 attribution |
| AI 伪影负向词 | 25 项公开 prompt engineering 词表（artifacts/plastic skin/extra fingers 等） | 公共 prompt eng 知识 · 无需 attribution |
| 8 类型片视觉签名 | 西部/恐怖/黑色/科幻/歌舞/战争/公路/传记 视觉语法 | 公共类型片研究 · 无需 attribution |
| 经典编剧理论 | McKee《Story》/ Save the Cat / Story Circle / Pixar Pitch | 公共编剧理论 · 按学术引用格式署作者名 |

**使用姿势**：
- 直接吃进 fili-web 数据库（method-modules / references-library 表）
- 代码内 `// from @山音/format-feature.md MIT` 行内注释式 attribution
- `README.md` / `LICENSE.md` 顶层留 `third-party-attributions` 段落

---

### 🟡 第 2 档 · 思路可借鉴 · 表达必须重写 · 中等风险

**判定标准**：
- 具体表达（命名 / 字段 / UI 文案）属原产品独创，受著作权保护
- 底层思路 / 算法 / 架构模式属公共 idea space，不受著作权保护（仅受专利保护，本 corpus 无专利披露）
- 借鉴时**必须完成语义重构**：重命名 + 重写描述文本 + 避免一对一映射感

**典型资料**：

| 类目 | 原资料 | 借鉴方式 | 禁用 |
| --- | --- | --- | --- |
| 5 工具协议 | `01-tools-schema.md` transition_to_step / save_step_output / run_selfcheck / save_checkpoint / update_continuity_table | **架构思路用**：state machine + lazy loading + 5 工具元组 | 禁用原工具签名（`transition_to_step` 等） |
| AI 避雷工程 | `03-ai-pitfalls-cheatsheet.md` 5 项机械测试（具体性/僵尸/气味/惊喜/替换）+ 90 词典 + 剥标签 5 步 | **算法思路用**：正则扫描 + 词典匹配 + 替换建议 | 禁用原测试命名 · 禁用 90 词典逐条直引 · 必须自建/扩展词典 |
| 双轨节奏算法 | `04-rhythm-algorithm.md` 情绪 + 张力双轨量化 · ±2 阈值 · 不连续 3 场警报 | **算法思路用**：多维度数值扫描 + 阈值告警 | 禁用"双轨节奏"命名 · 禁用 ±2 / 3 场等具体阈值 · 必须自己跑数据定 |
| 5 维 dimensions 自检 | `02-core-methodology.md §四` logic / character / pacing / theme / aiTaste | **多维自检思路用** | 禁用五维原命名（含 `aiTaste` 反向维度） |
| 8 步工作流 | CineForge 炼丹命名：取火/铸坯/淬魂/织境/塑骨/剖镜/锻字/磨锋 | **8 步流程思路用** | 禁用炼丹系全部命名 · 用中性工程命名（`concept/premise/character/world/structure/scene/draft/polish` 类） |
| shotlist 7 步 | `05-shotlist.md` 消化/锁定/重组/拆解/分级/附录 | **7 步流程思路用** | 禁用 shotlist 工程命名原词 |
| seedance 7 步 | `seedance/SKILL-RECONSTRUCTED.md` 消化/对齐/锁定/拆解/适配/审计/打包 | **7 步流程思路用** | 同上 |
| 三层架构 | Chat 层 / Web 层 / Server 层 | **分层思路用**（架构模式不受著作权保护） | 无禁用 · 但**避免同时复制 UI 形态**（双栏 + 故事星图） |

**使用姿势**：
- PR 描述中必须写："基于 @cineforge-corpus/XXX.md §Y 的架构思路 · 重命名 + 重写表达"
- 代码 / 文档中**不出现**原产品独创命名
- 数据库字段名、路由路径、atom key 均按 fili-web 自己体系命名

**Commit message 中强制两句话之一**：
1. `refs: @cineforge-corpus/XXX.md §Y（idea only · re-named + re-worded）`
2. `refs: public knowledge（McKee / Pixar / etc.）`

---

### 🔴 第 3 档 · 禁用 · 高风险 · 直接回避

**判定标准**：
- 原产品品牌标识 / 商标
- 原产品独创 UI 形态 / 独创命名的标志性集合（即使分开拆看每一项都像"思路"，但整体 look-and-feel 构成 trade dress）
- 通过抓包 / 截获 / 破解获得的**完整** system prompt 原文
- 拒绝被输出的产品内部演示语料

**典型资料**：

| 禁用项 | 原因 |
| --- | --- |
| 品牌词：山音 / CineForge / 创剧 / screenwriting-master | 商标风险（即使未注册，长期商用建立 trade dress） |
| 8 步炼丹命名（取火/铸坯/.../磨锋）集合 | CineForge 独创系列命名 · 即使单个"取火"像通用词，8 字一组仍是**可识别的产品特征** |
| 5 维度原命名集合（含 `aiTaste` 反向维度） | 同上逻辑 · `aiTaste` 尤其独创，必须改 |
| `00-preamble.md` IDENTITY / AGENTS / USER 三节**原文** | 是产品 system prompt 具体文案 · 著作权明确 |
| `01-tools-schema.md` 5 工具原 description 文本 | 同上 · 是产品 schema 原文 |
| `bubu_summary.txt` 列出的 14 份 prompt payload 原文 | 来源标注 `F:\下载文件\八步\` · 是抓包获取的 CineForge 商业产品完整 prompt · **任何一字节都不得复制进 fili-web 代码库** |
| `11-demo-corpus.md` 《暗账》8 步演示 | CineForge 产品演示语料 · 不得作为 fili-web 内置示例 |
| `shotlist-references/09-intercept-example` | corpus 自标注"产品拒绝输出原文 · 前 7 份 references 拼接 ~70%" · 无原作者授权的**半重组文本** |
| 双栏 chat + 故事星图 UI 形态 | trade dress |

**使用姿势**：
- fili-web **不引用**、**不镜像**、**不在 repo 内附带**这些资料
- 需参考时读完即关 · 代码 / 文档 / PR 中不留任何原文片段
- 必要时在 commit message 中说："inspired by general corpus · no verbatim copy"

---

## §2 · PR 合入检查项（所有 MM 系列 PR 必过）

```markdown
## IP Tier 合规检查（作者自检 + reviewer 核对）

- [ ] 本 PR 引入的外部参考资料已全部分档（🟢/🟡/🔴）
- [ ] 🟢 档：已在 commit message / 代码注释 / README 写 attribution
- [ ] 🟡 档：已完成"重命名 + 重写表达" · 无原产品独创命名残留
- [ ] 🟢/🟡 档：数据库字段名、路由路径、atom key、函数名均按 fili-web 体系命名
- [ ] 🔴 档：本 PR 不涉及任何第 3 档资料（无论是 import / 镜像 / 引用原文 / 抄写片段）
- [ ] 品牌词扫描（硬约束 · CI 强制 0 hits）：

  **硬模式**（无误报 · 出现即违规）：
  ```
  grep -iE 'cineforge|screenwriting-master|aiTaste|transition_to_step|save_step_output|run_selfcheck|save_checkpoint|update_continuity_table' src/ docs/ → 0 hits
  ```

  **软模式**（人审 · 可能误报）：
  - 单字短词：`创剧` / `山音` / `炼丹` / `取火` / `铸坯` / `淬魂` / `织境` / `塑骨` / `剖镜` / `锻字` / `磨锋` 单独出现可能是合法 Chinese phrase（如 "原创剧本" 含 "创剧"）· 需 reviewer 看上下文
  - n-gram 短语（一旦出现即违规）：`创剧 CineForge` / `山音 SKILL` / `8 步炼丹` / `炼丹命名` / `炼丹工作流` / `双轨节奏算法`

  **白名单**：`docs/ip-tier-policy.md` / `docs/multimodal-epic-stage0.md` 这两份治理文档**必须**讨论这些词，扫描时跳过。
```

**建议做法**：把硬模式做成 `npm run ip-guard` 脚本，在 pre-commit / CI 中运行，0 hit 才放行。软模式由 reviewer 在 PR 审查时人工抽查。

---

## §3 · 为什么必须这样（问答）

**Q: 这些资料我自己挖的，我想怎么用就怎么用，对吗？**

A: 不对。
- 山音 SKILL 原作者是 `@山音` · MIT 允许你商用但要求 attribution
- CineForge 商业产品的 prompt / UI / 命名 · **原作者不是你** · 你的挖掘行为是信息获取，不产生著作权
- 逆向重建 ≠ 重新创作。重命名 + 重写是把 idea 空间的东西抽象出来，跳出 expression 空间。

**Q: 那我把资料文件留在 `C:\Users\QvQ\CascadeProjects\cineforge-corpus\` 总行吧？**

A: 行。但**不能**：
- 不能提交进 fili-web repo（不能 `git add cineforge-corpus/`）
- 不能作为 fili-web 网站公开下载链接
- 不能作为 fili-web 任何发布物的附录

**Q: MIT 的山音 SKILL，我能不能直接把 4 份 format 文件 copy 到 fili-web 的 `docs/methodology/`？**

A: 能。条件：
- `docs/methodology/` 每个文件顶部留 "Source: `shanyin-screenwriting-master` (MIT) by @山音"
- `LICENSE.md` 或 `THIRD-PARTY-NOTICES.md` 加山音 SKILL 的 MIT 协议完整文本
- 仓库根目录 `README.md` 致谢段提到 @山音

**Q: `seedance/` 目录是反推重构，到底能不能用？**

A: 分开看：
- 13 大师 / 13 调色 / 64 术语 / AI 伪影库 → 🟢 第 1 档（公共知识）· 能用
- 7 步流程思路（消化/对齐/锁定/拆解/适配/审计/打包）→ 🟡 第 2 档 · 重命名后能用
- 5 模型适配器（即梦/Sora/Veo/Kling/可灵）具体 prompt 文本 → 🔴 第 3 档 · 回避 · 自己跑测试重新写

**Q: 如果我就是想把 `bubu_summary.txt` 里的 14 份 prompt 塞进 fili-web 的 LLM 调用 system prompt，快速出效果，有什么法律后果？**

A: 潜在的：
- **著作权侵权**：14 份 prompt 是完整的作品
- **商业秘密侵权**：如果这些 prompt 是抓包获取，来源合法性存疑
- **不正当竞争**：如果 fili-web 对 CineForge 形成直接市场替代
- **实际风险**：CineForge 若起诉，调查举证、发律师函、下架、赔偿。中国著作权法下软件作品侵权赔偿通常 3-50 万元；若可查营业损失可更高。
- **推论**：风险远大于 1-2 session 的开发量收益。严格回避是唯一理性选择。

---

## §4 · 违规发现时的处置

如果将来发现 fili-web 代码 / 文档中无意引入了第 3 档资料：
1. **立即 revert**：创建 hotfix PR · 替换为合规实现
2. **扫描 history**：git log -p -S 品牌词 · 如 history 中有原文，考虑 BFG Repo-Cleaner 清理（慎用 · 会重写 history）
3. **文档披露**：在 dogfood-log.md 或 CHANGELOG.md 诚实记录该 erratum 决议
4. **审查流程**：复盘本政策的 PR 检查项是否需要加强

---

## §5 · 本政策的修订

本政策由 fili-web 维护者（QvQ）单方裁定。修订时需：
- 在本文件末尾追加 `### 修订记录` 子节，标注日期 / 修订点 / 理由
- 修订不得**放松**合规约束（只能更严）
- 修订后通知所有在途 MM 系列 PR 重新自检

---

## 附录 A · 本政策引用的核心法律框架（非正式）

- 《中华人民共和国著作权法》（2020 修正）· 第 3 条 作品范围 / 第 10 条 著作权人权利 / 第 53 条 侵权赔偿
- 《中华人民共和国反不正当竞争法》（2019 修正）· 第 9 条 商业秘密 / 第 2 条 诚实信用原则
- 《计算机软件保护条例》· 第 24 条 侵权行为
- MIT License · https://opensource.org/license/mit
- Berne Convention · 作品表达 vs 思想两分法（expression / idea dichotomy）

**免责**：本文档是 fili-web 作者 QvQ 的个人合规自律规约 · 不构成法律意见。若进入商业化阶段（SaaS 上线 / 融资 / 公开发行），必须请专业知识产权律师审阅实际代码与方案。

---

## 修订记录

- **v1.0（2026-05-09）**：初稿 · 基于 `C:\Users\QvQ\CascadeProjects\cineforge-corpus` 挖矿档案分档 · 对应 multimodal epic（MM1-MM5）启动前的 IP 治理基准。
