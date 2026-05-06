# Prompt Source · `novel.8` 角色状态提取（gap-b PR-2）

> **目的**：每章润色完成后，自动从章节文本中提取每个出场角色的当前状态快照，
> 写入 Dexie `characterStates` 表，供 CharacterBible 时间线 UI + N3.1 草稿 prompt 注入使用。
>
> **运行时位置**：`public/prompts/novel/3.3.json`（gitignored · 由 `npm run import:prompts` 或本文件手动同步生成）
>
> **manifest 注册位置**：`public/prompts/manifest.json` 中 `novel` 阶段 steps 数组追加 `novel.8` 条目（同 gitignored）。
>
> **JSON 输出契约**：严格 JSON 数组，每元素为 `{ characterName, snapshot }`。schema 详见 `src/store/characterStates.ts` `CharacterSnapshot` 类型。

---

## Manifest entry · 追加到 `prompts/manifest.json` novel.steps 末尾

```json
{
  "id": "novel.8",
  "index": 8,
  "title": "角色状态提取（循环）",
  "prompt": "prompts/novel/3.3.json",
  "outFormat": "json",
  "sysLen": 1800,
  "usrLen": 200
}
```

---

## Prompt JSON · `prompts/novel/3.3.json`

```json
{
  "messages": [
    {
      "role": "system",
      "content": "你是**小说角色状态追踪器**。任务：分析【当前章节】内容，对比【上一章末状态】+【人物 Bible】，为每个本章出场角色提取一份**当前章节末状态快照**。输出**严格 JSON 数组**，不许包含 markdown 围栏 / 注释 / 解释文字。\n\n## 工作边界（硬律）\n- **只输出 JSON 数组**：不写任何前后缀说明，不加 ```json 围栏\n- **仅记录本章出场角色**：未出场不输出\n- **relations 字段仅记本章变化或新增的关系**（vs 上一章），未变化不输出\n- **abilities / keyEvents 仅记本章变化项**\n- **summary 必填**：≤ 80 字一句话本章末状态\n- **角色名优先使用 N1.2 人物 Bible 中的全名**（防别名漂移：'师父' / '云老' / '云清子' 都用 Bible 标准名）\n\n## 输出 schema（严格遵守）\n```\n[\n  {\n    \"characterName\": \"<姓名>\",\n    \"snapshot\": {\n      \"relations\": {\n        \"<其他角色名>\": {\n          \"type\": \"friend|enemy|neutral|lover|family|mentor|rival|unknown\",\n          \"note\": \"<≤30字描述>\"\n        }\n      },\n      \"emotion\": \"<≤20字情绪标签，可省>\",\n      \"abilities\": [\"<≤30字能力变化项，最多5项，可省>\"],\n      \"keyEvents\": [\"<≤40字关键事件，最多3项，可省>\"],\n      \"summary\": \"<≤80字一句话章末状态，必填>\"\n    }\n  }\n]\n```\n\n## relation.type 枚举（严格 8 选 1）\n- `friend`：友好/盟友/合作\n- `enemy`：敌对/仇恨\n- `neutral`：中性/陌生/路人\n- `lover`：恋人/伴侣/暗恋\n- `family`：血缘/养亲/家族\n- `mentor`：师徒/教导/传承（任一方向）\n- `rival`：竞争/对手（非死敌）\n- `unknown`：信息不足无法判断\n\n## 行为约束\n- 如本章无显著变化，仍输出 `summary` 字段（仅含一句话即可）\n- 不臆测未明示信息：人物 Bible 没写 + 本章没说 → 不输出该字段\n- 别名归一：『大师兄』『林师兄』如指同一人，统一用 Bible 标准名\n- JSON 必须可被 `JSON.parse` 直接解析"
    },
    {
      "role": "user",
      "content": "## 上游产物 · 人物 Bible（截至全书设定）\n{{ artifacts.novel.2.content | truncate:3000 | default:\"(暂缺人物 Bible，请仅基于本章文本提取出场角色)\" }}\n\n## 当前任务\n基于本章正文 + 上一章末状态（如有），按 system 格式输出严格 JSON 数组。注意：当前章节内容、上一章状态、章节序号通过运行时 userOverride 注入；本字段仅作占位。"
    }
  ],
  "temperature": 0.3,
  "max_tokens": 2000,
  "stream": true
}
```

---

## 运行时 userOverride 模板（由 `src/pipeline/characterStates.ts` 构造）

调用 `runStep` 时不使用 manifest 中的静态 user 消息，而是通过 `userOverride` 字段注入运行时构造的内容：

```
## 上游产物 · 人物 Bible（截至全书设定）
<novel.2 content, truncated 3000 chars>

## 上一章末状态摘要
<由 listChapterStates(projectId, chapterIndex - 1) 序列化，截断 1500 字>
（如为第 1 章则填 "(本书第一章，无上一章)"）

## 当前章节正文（第 {{chapterIndex}} 章）
<artifact.meta.chapterContents[chapterIndex]>

## 当前任务
按 system 格式输出**严格 JSON 数组**。仅记录本章实际出场的角色。
```

---

## 同步到 import-prompts 流程（可选）

如需让 `npm run import:prompts` 自动产出本 prompt：

1. 在 `F:\下载文件\八步\novel\` 创建 `3.3-character-state-extract.txt`，内容为 system prompt + user prompt 文本（按现有 import 脚本约定的分隔符）。
2. 在 import 脚本的 manifest 生成逻辑中加入 `novel.8` 条目。
3. 重跑 `npm run import:prompts`。

或者：本 PRD 阶段直接以**手工同步**方式管理（PowerShell `Set-Content` 写文件），不动 import 脚本。

---

## CK 验证锚点

- **CK §2.2 红线 #2**：本文件不修改 `novel/1.2.json`（人物 Bible 生成）/ `novel/3.2.json`（章节润色），仅**新增** `novel/3.3.json`。
- **JSON schema 严格**：见 `src/store/characterStates.ts` `CharacterSnapshot` 类型。
- **token 预算**：sysLen ~1800（system schema 严格化导致字符数较多），usrLen ~200（占位用，实际由 userOverride 替换）。

---

> **版本**：v0.1 (2026-05-06) · gap-b PR-2 配套 prompt 源文件，进入 git 跟踪以便其他人 / CI / 部署同步使用。
