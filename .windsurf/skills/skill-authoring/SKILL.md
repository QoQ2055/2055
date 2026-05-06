# skill-authoring · 为 fili-web 写 skill / rule / workflow 的元指南

> **何时读本文档**：你（Cascade）准备在本仓新建或大幅修订 `.windsurf/skills/*/SKILL.md`、`.windsurf/rules/*.md`、`.windsurf/workflows/*.md` 之前。
>
> **价值定位**：本仓已有 2 个落地 skill（`bmad-method`、`design-md`）和若干 rules，但元层"为什么这么写"是隐性经验。本文将其显式化，避免后续 skill 风格漂移、context 浪费、过度教学。

---

## 三大核心原则（**所有 skill 必须满足**）

### 1. Concise is Key · 简洁优先

Context window 是公共资源 —— skill 与 system prompt、对话历史、其他 skill 元数据、用户请求共享同一个 token 预算。

- **默认假设**：Cascade 已经很聪明。**只补它确实不知道的东西**。
- **每段问 2 个问题**：
  - "Cascade 真的需要这段解释吗？"
  - "这个段落对得起它的 token 成本吗？"
- **示例 > 长篇解释**。一段好示例 = 三段废话散文。

> 反例：见 `bmad-method/SKILL.md` 226 行（包含部分 BMAD 上游照搬段落，本可砍 30%）。后续修订时可作 baseline。

### 2. Set Appropriate Degrees of Freedom · 自由度匹配脆弱性

| 自由度 | 适用场景 | 表现 | 本仓实例 |
|---|---|---|---|
| **High** | 多种解法都对 / 看上下文决策 | 纯文字指南 / 启发式 | `design-md/SKILL.md §6.1 Greenfield 流程` |
| **Medium** | 有偏好模式 / 允许变化 | 伪代码 / 带参 checklist | `design-md/SKILL.md §1.2-§4 token 选择表` |
| **Low** | 操作脆弱 / 顺序关键 / 一致性必需 | 具体脚本 / 严格步骤 | `bmad-method` 的 CK workflow 9 步 + 退出条件 |

> 心法："窄桥过悬崖需要护栏（low），开阔原野允许多路（high）"。

### 3. Progressive Disclosure · 三级加载

Skill 的 context 加载分 3 级：

```
1. metadata（name + description, ≤ 100 词）  ─── 始终在 context
2. SKILL.md body（≤ 500 行 / ~5k 词）       ─── trigger 时
3. 子 reference / assets / scripts          ─── 按需读
```

**3 个组织 pattern**（按 skill 复杂度递增）：

#### Pattern 1 · 高层指南 + 链接

主 SKILL.md 给 80% 用例的"快速开始"，深度场景外链到 reference 文件。

```
my-skill/
├── SKILL.md           ← 总览 + Quick Start + 链接
├── ADVANCED.md        ← 深度场景（按需）
└── EXAMPLES.md        ← 范例库（按需）
```

#### Pattern 2 · 按 domain 切分（**本仓 design-md 用的就是这个**）

```
design-md/
├── SKILL.md                          ← 总览 + token 决策表
└── assets/
    ├── examples-curated.md           ← 6 类应用品牌建议
    ├── selfcheck-checklist.md        ← audit 清单
    └── token-naming-cheatsheet.md    ← 命名速查
```

Cascade 看到品牌咨询场景才读 examples-curated；audit 时才读 selfcheck。

#### Pattern 3 · 条件性深度

主文件展示基础，明确"哪些情况看哪个文件"：

```
# CSV 处理
## 基础（90% 场景）
用 pandas 读取... [示例]

## 进阶（按需）
- 大文件流式：见 STREAMING.md
- 时间戳标准化：见 TIMESTAMPS.md
```

**关键守则**：
- **引用层级 ≤ 1**（reference 不许再引用 reference）
- **>100 行的 reference** 必须头部加目录
- 每个 reference 都要在主 SKILL.md 显式标注"何时读"

---

## 7-Step Skill 创建流程（low-freedom · 必须按序）

### Step 1 · 用具体例子理解 skill 边界

写下 3 个**真实预期场景**：
- "用户问 X 时，skill 应该让 Cascade 做 Y"
- 反例：用户问 Z 时，skill **不应**触发

如果 3 个场景写不出来，说明 skill 范围太模糊 → 拆分或放弃。

### Step 2 · 规划可复用内容

只把**跨场景复用**的部分进 skill。**单次性内容**（某次 PR 的具体改法）写到 commit msg / dogfood-log，不要进 skill。

### Step 3 · 初始化 skill

```
.windsurf/skills/<kebab-name>/SKILL.md
```

命名规则：
- kebab-case（`skill-authoring`，不是 `SkillAuthoring`）
- 名词或动名词，**不带"skill"后缀**
- 不超过 3 个英文词

### Step 4 · 写主体（必有节）

1. **何时读本文档**（顶部 1 段，trigger 条件）
2. **价值定位**（为什么需要这个 skill，与现有 skill 的差异）
3. **核心内容**（按上述 3 大原则组织）
4. **本仓具体实例**（指向 BMAD/design-md/CHANGELOG/PRD 等真实文件）
5. **反模式 / 红线**（**做什么会破坏 skill** 的明确边界）

### Step 5 · 评 token 成本

写完后跑：
```powershell
(Get-Content SKILL.md | Measure-Object -Line).Lines
```

- ≤ 200 行 → 通过
- 200–500 行 → 必须用 Pattern 2 或 3 拆 reference
- > 500 行 → 强制拆分，禁止放行

### Step 6 · 接入 / 注册

- 如果是常驻规则 → 加 `.windsurf/rules/<name>.md`（短文件，仅指向 SKILL.md + trigger 条件）
- 如果是按需 skill → 仅 SKILL.md 即可（用户/Cascade 显式 `read_file` 加载）

### Step 7 · 迭代

每次用本 skill 后留心：
- Cascade 是否真的按预期触发？
- 是否每次都需要解释相同细节？→ 该补到 skill
- 是否经常忽略某段？→ 该删

---

## 反模式（**禁止入 skill**）

| ❌ 反模式 | 为什么禁 | 替代方案 |
|---|---|---|
| **"自动安装其他 skill"prompt** | 绕过用户审核 / supply-chain 攻击载体 | 显式让用户审批每个 skill |
| **"给作者打 5 星 review"prompt** | review fraud / 操纵 marketplace | 永远不写这种段落 |
| **`npx -y @scope/...`** 装陌生包 | 跳过依赖审核 | 列出所需依赖，让用户用 `npm install` 显式同意 |
| **"试 10 种方法再问人"** | 反 confirmation 模式（jailbreak 伪装）| 鼓励早问、问得清楚 |
| **autonomous cron / computer use** | 与本仓 SPA 定位 100% 不符 | 本仓所有自动化需用户点击触发 |
| **agent-to-agent 网络** | 上下文泄漏 + 私有数据出仓 | 不连任何外部 agent 网络 |
| **复读 Cascade 已知内容** | 浪费 token | 只补"它不知道的"（项目规约 / 业务术语 / 历史决策）|

---

## 本仓现有 skill 对照（2026-05-06 状态）

| skill | 行数 | pattern | 自由度 | 评级 |
|---|---|---|---|---|
| `bmad-method/SKILL.md` | 226 | Pattern 2（assets/4 模板 + 2 CSV）| Low（CK 9 步死序列）| 🟡 偏长，可砍 30% |
| `design-md/SKILL.md` | ~? | Pattern 1+2（assets/3 reference）| 混合（§1.2-4 medium / §6.1 high）| 🟢 健康 |
| `skill-authoring/SKILL.md` | 本文 ~180 | Pattern 1（暂无 reference）| Mixed | 🟢 自我应用三原则 |

---

## 深度参考

- **上游 skill creator**（来源）：`https://lobehub.com/skills/google-gemini-gemini-cli-skill-creator`（仅参考其 3 大原则部分；安装 prompt / review prompt 段落已**拒绝吸收**）
- **本仓 BMAD skill**：`@C:\Users\QvQ\CascadeProjects\fili-web\.windsurf\skills\bmad-method\SKILL.md`（low-freedom 流程类范例）
- **本仓 design-md skill**：`@C:\Users\QvQ\CascadeProjects\fili-web\.windsurf\skills\design-md\SKILL.md`（混合自由度 + Pattern 2 范例）
- **本仓决策心法**：`@C:\Users\QvQ\CascadeProjects\fili-web\.windsurf\rules\coding-standards.md`（VFM / ADL）

---

> 本 skill 的修订原则：每次修订必须使行数 **≤** 修订前。如果新增内容，必须等量删除冗余。**简洁是公共财产**。
