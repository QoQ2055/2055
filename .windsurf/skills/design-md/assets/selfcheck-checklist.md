# DESIGN.md 人工检查清单 (30+ 项)

> ⚠ **来源**: 本清单是 **design-md SKILL 的自创层**, **不是** Google 官方 checklist.
> Google spec 只说 "lint 校验 schema + WCAG 对比度", 未提供人工审查清单.
> 本清单 30+ 项是本 SKILL 作者按工程实践整理, 供 §4.4 Audit 工作流用. 不具权威性, 可自增删.

> Lint 能校验 schema + WCAG 对比度. 本清单覆盖 lint 查不到但重要的**质量项**. 每次大改 DESIGN.md 后或 §4.4 Audit 工作流过一遍.

---

## 🔴 P0 · 必过 (任一失败 = DESIGN.md 不可用)

### 结构完整性
- [ ] 有 YAML frontmatter (第一行 `---`)
- [ ] 有 markdown body (YAML 后 `---` 之后)
- [ ] 包含必需分节: Overview / Colors / Typography / Do's and Don'ts
- [ ] 无重复分节 (每个 `## Xxx` 只出现一次)
- [ ] YAML 可以被 parse (没有语法错)
- [ ] `name` 字段非空

### Token 最小覆盖
- [ ] `colors` 至少有: primary / secondary / accent / 4 档 neutral / error
- [ ] `typography` 至少有: headingM / bodyM / captionM
- [ ] `rounded` 至少有: sm / md
- [ ] `spacing` 如果定义了, 至少覆盖 xs/sm/md/lg

### WCAG AA (基础)
- [ ] 主文本色 on 主背景色 ≥ 4.5:1
- [ ] button 前景 on 背景 ≥ 4.5:1
- [ ] error 色 on 主背景 ≥ 3:1

---

## 🟡 P1 · 强烈建议 (失败会显著降低 AI 使用质量)

### Token 命名一致性
- [ ] 颜色命名无冲突 (`brandBlue` vs `primary` 同时存在 = 乱)
- [ ] spacing 全部用同一风格 (Tailwind 数字 `"1"`, `"2"` 或 Material `xs`, `sm`, 不混用)
- [ ] 所有 `hover*` / `focus*` / `disabled*` 前缀统一 (不要 `hover_bg` + `hoverBackground` 混用)

### 语义化覆盖
- [ ] Colors 节里每个 token 配 1 句"用在哪"说明
- [ ] Typography 节里每级字号配"用途"说明
- [ ] Components 每个组件有变体 + 状态 + 语境描述

### Components 细节
- [ ] `components.button` 至少有: backgroundColor / color / paddingX / paddingY / borderRadius
- [ ] `components.input` 至少有: backgroundColor / borderColor / borderRadius / focusBorderColor
- [ ] Modal 有 maxWidth + 动画时长
- [ ] Nav 区分了 itemHoverColor 和 activeColor
- [ ] 所有组件样式值用 `{token.ref}` 而非 hex

### Do's and Don'ts
- [ ] 至少 3 条 Do
- [ ] 至少 3 条 Don't
- [ ] 至少 1 组 ✅ Right vs ❌ Wrong 代码对比

### 可访问性
- [ ] 语义色 (success/error/warning) 不单靠颜色区分 (markdown 里说明要配图标/文字)
- [ ] 暗色主题 markdown 里明示"不用 box-shadow 模拟阴影"

---

## 🟢 P2 · 锦上添花

### 完整度
- [ ] 有 Layout 分节 (间距哲学 + 网格 + 安全区)
- [ ] 有 Elevation & Depth 分节
- [ ] 有 Shapes 分节
- [ ] Neutral scale 至少 5 档 (50/100/300/500/900 或更细)
- [ ] 语义色全 4 个 (success/warning/error/info)

### 组件覆盖 (V1 6 个核心)
- [ ] Button
- [ ] Input / Textarea
- [ ] Card
- [ ] Modal / Dialog
- [ ] Nav / Sidebar
- [ ] Tab / Pill

### Typography 完整
- [ ] 标题 4 级 (headingXl → headingS)
- [ ] 正文 3 级 (bodyL / bodyM / bodyS)
- [ ] 辅助 (captionM / labelM)
- [ ] 等宽 (codeM) — 如有代码 / 剧本场景

### AI 消费友好
- [ ] 项目根有 `CLAUDE.md` 或 `.cursorrules` 嵌入"读 DESIGN.md"指令
- [ ] `package.json` 有 `design:sync` script
- [ ] `tailwind.config.ts` (或等价) 从 DESIGN.md 导出

### 文档质量
- [ ] 每个 `## ` 标题下第一段 100 字内总览该节
- [ ] markdown 里引用 token 用 `{path.to.token}` 而非裸 hex / px
- [ ] 有"颜色禁忌"子段 (明示什么颜色不用)

---

## 🔵 P3 · 未来加分项 (V2+ 考虑)

- [ ] 双主题支持 (暗 + 亮)
- [ ] `themes` 顶层字段准备 (等上游规范)
- [ ] Animation tokens (时长 / 缓动曲线)
- [ ] Breakpoint tokens (响应式)
- [ ] zIndex scale
- [ ] AAA 对比度 (7:1) 尝试

---

## 🔴 反模式 · 立即修 (出现任一 = 错了)

- [ ] ❌ 同一个 hex 色在 YAML 不同 key 里重复 (应该引用)
- [ ] ❌ 组件样式里裸写 `color: "#1A73E8"` 没走 token
- [ ] ❌ 标题和正文同字重 (没有层级)
- [ ] ❌ 两种 rounded scale 混用 (e.g. 同时存在 `md: 8px` 和 `medium: 6px`)
- [ ] ❌ 用颜色关键字 `color: "red"` (必须 hex)
- [ ] ❌ 单个颜色在 markdown 里描述 "很高级 / 很专业" (没具体信息)
- [ ] ❌ Do's 和 Don'ts 相互矛盾
- [ ] ❌ Typography lineHeight 有的有单位 (`"24px"`) 有的没单位 (`1.5`) 且无规则
- [ ] ❌ components 字段数超过 20 个 (V1 过度设计, V2 也过度)
- [ ] ❌ 引用不存在的 token (`{colors.nonExistent}`)

---

## 🎯 按严重度打分

| 等级 | 含义 | 容忍度 |
|:-:|---|:-:|
| 🔴 P0 | 必过, 不过不能用 | 0 个失败 |
| 🟡 P1 | 强烈建议, 失败显著降质 | ≤ 2 个 warning |
| 🟢 P2 | 加分项, 覆盖越多越好 | 无硬要求 |
| 🔵 P3 | 未来项, 暂时忽略 | 无 |
| ⚫ 反模式 | 出现任一立即修 | 0 个 |

---

## 📋 Audit 流程建议

```
1. 跑 `npx @google/design.md lint DESIGN.md`
   → 查 schema error 和 WCAG 对比度
   → 修到 0 error

2. 过本清单 P0 段
   → 每条对照 DESIGN.md
   → 任一失败回去改

3. 过 P1 段
   → 累计 warning 计数
   → > 2 个回去改到 ≤ 2

4. 过反模式段
   → 任一出现立即修

5. 过 P2 / P3 段
   → 记录可提升点到 todo list
   → 下轮迭代处理

6. 输出 audit 报告:
   - Critical issues: N 个
   - Warnings: M 个
   - Coverage score: X/Y (P2 项数)
   - 改进建议: [...]
```

---

## 📌 对 影语 FLIL-Web 的快速 audit 预览

(本 SKILL 首次应用到 影语 FLIL-Web 时应跑一遍)

预期 P0 全绿:
- 结构完整 ✅ (因为用模板)
- WCAG AA (暗色主题需验证 accent 色对文字的对比度)

预期 P1 需关注:
- components 覆盖 6 个核心 (按 V1 MoSCoW scope)
- Do's and Don'ts 至少 3+3 条

预期 P2 部分通过:
- Layout / Elevation / Shapes 分节可能先简写

预期 P3 延后到 V2.
