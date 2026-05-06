# Prompt 蓝本归档 · `prompt-archives/`

本目录用于存放**尚未集成到运行时**的 prompt 蓝本。

## 与其他层的区别

| 层 | 位置 | 运行时可见？ | 定位 |
|---|---|---|---|
| 节点原生 prompt | `public/prompts/` | ✅ manifest 按 nodeId 加载 | 每个流程节点的主 prompt |
| 方法论模块 | `public/methods/` | ✅ `ProjectContext.methodModuleIds` 启用 | 项目级可叠加的方法论 |
| 用户 KB doc | Dexie (`userKbDocs` 表) | ✅ `ProjectContext.userKbDocIds` 绑定 | 用户上传的趋势 / 范文 / 反例 / 偏好等素材 |
| **prompt 蓝本归档（本目录）** | `docs/prompt-archives/` | ❌ 不走任何运行时通道 | 待集成的完整 prompt 模板，等将来主流程升级时挪进 `public/prompts/` |

## 判别规则：什么样的资料归这里？

符合**任一**条件即不入 v2 KB，放本目录：

1. **完整工作流型 prompt**：含多阶段交互 / 对齐表 / 完整输出模板，长度 ≥ 800 token，硬塞方法论模块会挤爆其他层。
2. **目标产物与现有流程节点错位**：例如 AI 视频分镜提示词 vs 当前 `storyboard.*` 的文字分镜；需要新增分支节点才能承接。
3. **与现有节点原生 prompt 有格式冲突风险**：如输出模板会覆盖 / 打架。
4. **用户 KB 6 种类型都不匹配**（trend / sample / antiPattern / styleGuide / worldHardSchema / voiceCard）。

## 文件命名约定

`<建议集成节点族>-<语义>.md`，如：
- `storyboard-cinematic-15s.md` → 建议未来集成到 `storyboard.ai-video.*`
- `screenplay-v2-film-grade.md` → 建议未来集成到 `screenplay.*` 新分支
