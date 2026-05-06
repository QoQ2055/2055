---
description: 为新加入这个仓库的 AI agent 生成 / 刷新 AGENTS.md 项目导航文档
---

`/init` 的目标是让任何 AI 协作者（Cascade / Claude / Copilot / Cursor）在 ≤ 3 分钟内
搞清楚仓库结构、构建命令、关键约定。

约定使用 `AGENTS.md`（vendor-neutral，多个工具都识别）作为唯一真理源。
README.md 面向用户/部署者，AGENTS.md 面向写代码的 AI/人类。

---

## Step 1 · 收集事实

需要查证的内容（**不要凭印象填**）：

- [ ] `package.json` 的 `scripts` 字段 → 列出所有可执行命令
- [ ] `package.json` 的 `dependencies` / `devDependencies` → 主要框架
- [ ] `tsconfig.json` 的 `compilerOptions` → strict/moduleResolution 等
- [ ] 顶层目录列表 + 每个目录一句话角色说明
- [ ] `src/router.tsx` → 路由 → 页面映射
- [ ] `src/store/db.ts` 的 Dexie version → 当前 DB schema 版本
- [ ] `public/prompts/manifest.json` 与 `public/methods/manifest.json` → 流水线节点列表
- [ ] CHANGELOG 的 Unreleased 章节 → 最近的架构变更

// turbo
```powershell
@(
  '=== package.json scripts ==='
  (Get-Content package.json -Raw | ConvertFrom-Json).scripts | ConvertTo-Json
  '=== top-level dirs ==='
  Get-ChildItem -Directory | Select-Object -ExpandProperty Name
  '=== src/ subdirs ==='
  Get-ChildItem src -Directory | Select-Object -ExpandProperty Name
  '=== Dexie version ==='
  Select-String -Path src/store/db.ts -Pattern 'this.version\(\d+\)' | ForEach-Object { $_.Line.Trim() }
) | Out-String
```

## Step 2 · 写 AGENTS.md

文件结构（按重要性从高到低排）：

1. **一句话项目定位**（≤ 50 字）
2. **快速开始**（dev / build / 首次拉仓需要的额外步骤）
3. **目录速查**（顶层 + `src/` 子目录的一句话说明，每行一条）
4. **架构骨架**：
   - 数据流（用户输入 → state → Dexie → 渲染）
   - 流水线模型（节点 / 阶段 / manifest）
   - 三种知识层叠加（静态 KB / 用户 KB / 方法论模块）
5. **常见任务 → 看哪里**（可工作流式查找表）
6. **重要约定**（coding style / Dexie schema 升级规则 / prompt 注入分层）
7. **当前阶段 / 路线图**：直接引用 `CHANGELOG.md` Unreleased 章节
8. **不要做什么**（避坑清单）

## Step 3 · 验证

- [ ] 文档里所有命令都能直接 `npx` / `npm` 执行
- [ ] 文档里引用的所有路径都存在
- [ ] CHANGELOG 的最新条目在 AGENTS.md 里有提及
- [ ] 不重复 README 已有的安装 / 部署细节

## Step 4 · 何时刷新

加入 AGENTS.md 头部的 `Last refreshed` 字段。当下面任一发生时重跑 `/init`：

- Dexie schema 升级（version + 1）
- 新增页面 / 路由
- 新增一类知识注入层
- README 大改
- 删除了 ≥ 5 个 export
