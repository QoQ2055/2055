# 🎬 关键分镜图生成引擎 v10.0（Key Storyboard Engine）

> 本文件定义**视频辅助分镜图**系统的完整规范，包含**关键帧+过渡帧**双体系。
> 与25宫格索引图是**两个独立系统**，在不同阶段输出。
>
> ⚠️ 阶段4B、阶段5、阶段6的Agent**必须读取**本文件。
>
> 🆕 v10.0核心升级：
> 1. **过渡帧系统**：关键帧之间插入过渡帧，确保视频覆盖100%时间
> 2. **三帧结构**：入帧→关键帧→出帧
> 3. **质量词强制**：每张分镜图提示词必须追加质量增强词
> 4. **风格继承**：提示词必须携带画风+色彩后缀

---

## 一、系统定位 — 双系统架构（v10.0明确分离）

```
┌─────────────────────────────────────────┐
│  阶段4A · 25宫格索引图（叙事验证）         │
│  ──────────────────────────              │
│  定位：叙事验证索引                       │
│  风格：铅笔草图，mannequin无脸人像         │
│  输出给：用户确认叙事流程                  │
│  分幕：每幕独立1套25宫格                   │
└─────────┬─────────────────────────────┘
          │ 验证通过后
          ↓
┌─────────────────────────────────────────┐
│  阶段4B · 视频辅助分镜图（本系统）          │
│  ──────────────────────────              │
│  定位：视频生成参考                       │
│  内容：关键帧 + 过渡帧                    │
│  风格：完整画风+色彩+质量词                │
│  输出给：阶段5图片提示词 + 阶段6视频提示词  │
│  🆕 100%时间覆盖：无断点                  │
└─────────┬─────────────────────────────┘
          │ 关键帧+过渡帧下传
          ↓
┌─────────────────────────────────────────┐
│  阶段5/6 · 图片/视频提示词                 │
│  基于关键帧+过渡帧 + @资产引用生成         │
└─────────────────────────────────────────┘
```

---

## 二、🆕 三帧结构体系

### 2.1 概念定义

```
每个视频片段（≤15秒）的分镜图由三个层次构成：

入帧 (Entry Frame)     关键帧 (Key Frame)     出帧 (Exit Frame)
──────────────        ──────────────        ──────────────
承接上一镜末尾状态      本镜核心叙事画面       过渡到下一镜的准备状态
时间：前1-3秒          时间：核心3-10秒       时间：后1-3秒
构图：继承上一镜出帧    构图：本镜核心画面     构图：为下一镜铺垫
```

### 2.2 三帧结构规则

| 帧类型 | 职责 | 时间占比 | 必要性 |
|--------|------|---------|--------|
| **入帧** | 承接上一镜的【动作末尾状态】，确保视觉不跳 | 10-20% | ✅ 必须（首镜可省略） |
| **关键帧** | 本镜核心叙事内容，最重要的画面 | 60-80% | ✅ 必须 |
| **出帧** | 为下一镜做铺垫，定义本镜末尾的角色/道具/光影状态 | 10-20% | ✅ 必须（末镜可省略） |

### 2.3 三帧与时间轴的关系

```
视频片段1（12秒）     视频片段2（10秒）     视频片段3（15秒）
[入帧][关键帧][出帧]   [入帧][关键帧][出帧]   [入帧][关键帧][出帧]
 0-2s   2-10s 10-12s    0-2s   2-8s  8-10s    0-3s  3-12s  12-15s
           ↓                ↓
     出帧状态 === 下一镜入帧状态（连贯保证）
```

---

## 三、关键分镜图数量计算

### 3.1 基于用户目标时长

```
用户目标时长 → 按段落类型分配 → 计算关键分镜图数
关键分镜图数 = Σ(各段落时长 / 该段落类型平均单镜时长)
```

### 3.2 各段落类型平均单镜时长

| 段落类型 | 平均单镜时长 | 时长范围 | 节奏描述 |
|---------|------------|---------|---------| 
| 🗡️ 打斗段 | 6-8s | 4-10s | 快剪辑 |
| 📖 叙事段 | 10-13s | 8-15s | 均衡推进 |
| 💬 对话段 | 10-15s | 8-15s | 完整容器 |
| 🌅 转场段 | 4-6s | 3-8s | 简洁过渡 |
| 🎭 情感段 | 10-15s | 8-15s | 留白呼吸 |
| ✨ 奇观段 | 8-12s | 6-15s | 视觉冲击 |
| 🌙 静谷段 | 10-15s | 8-15s | 呼吸节奏 |

### 3.3 参考表

| 用户目标时长 | 预估关键分镜图数 |
|------------|----------------|
| 30秒 | 2-4 |
| 1分钟 | 4-8 |
| 2分钟 | 8-15 |
| 3分钟 | 12-22 |
| 5分钟 | 20-35 |

---

## 四、🆕 完整分镜图输出规范（含三帧结构）

### 4.1 单张分镜图数据结构

```json
{
  "keyFrameIndex": 1,
  "timeRange": "00:00-00:12",
  "duration": 12,
  "segmentType": "📖叙事",
  "shotCategory": "建立镜头 → 主镜头",
  
  "sceneRef": "@场景_山谷_角度A",
  "characters": [
    {
      "ref": "@角色A_日常",
      "position": "画面左侧前景",
      "action": "缓步走入山谷",
      "emotion": "警惕而好奇"
    }
  ],
  "props": ["@道具_玉佩"],
  
  "entryFrame": {
    "timeSlice": "0-2秒",
    "description": "承接上一镜：远景山谷入口，@角色A_日常背影从画面右侧走入",
    "cameraState": "远景，静止",
    "characterState": "@角色A 正在迈步，右脚在前",
    "lightingState": "继承上一镜的暖色晨光",
    "imagePrompt": "Wide shot, mannequin figure entering misty valley from right, warm morning light, cinematic, 8K ultra HD, 9:16"
  },
  
  "keyFrame": {
    "timeSlice": "2-10秒",
    "composition": {
      "shotScale": "Medium Shot → Close-up 推进",
      "cameraAngle": "平视，微仰5度",
      "cameraMovement": "缓慢跟拍，从全景推至近景",
      "depthLayers": {
        "foreground": "飘落的树叶",
        "midground": "@角色A_日常 行走",
        "background": "山谷远景，雾气缭绕"
      }
    },
    "lighting": "侧光，暖调，晨雾散射",
    "imagePrompt": "Medium Shot to Close-up, @角色A walks cautiously into misty mountain valley, golden morning light filtering through ancient trees, leaves drifting in foreground, jade pendant glowing at waist, cinematic realism, 8K ultra HD, sharp focus, shallow depth of field, 9:16 aspect ratio",
    "chineseDescription": "中景推至近景：角色A缓步走入雾气弥漫的山谷，晨光从古树间洒落"
  },
  
  "exitFrame": {
    "timeSlice": "10-12秒",
    "description": "角色A在山谷入口处停步，目光望向远方，画面定格于近景侧面轮廓",
    "characterEndState": "@角色A 停步，右手微微抬起遮光，面朝画面左方",
    "emotionEndState": "从好奇转为凝重",
    "cameraEndState": "近景，角色A侧面轮廓",
    "lightingEndState": "侧光稍强，暖色调保持",
    "propEndState": "@道具_玉佩 微微发光",
    "imagePrompt": "Close-up side profile, @角色A stops at valley entrance, hand raised slightly to shield eyes, pensive expression, warm rim lighting on face, cinematic, 8K ultra HD, 9:16"
  },
  
  "bridgeToNext": {
    "exitAction": "角色A在山谷入口处停步，目光望向远方",
    "exitEmotion": "从好奇转为凝重",
    "exitCameraState": "近景，角色A侧面轮廓",
    "visualMomentum": "角色A正在抬手遮住阳光"
  },
  
  "bridgeFromPrev": {
    "entryAction": "承接上一镜：角色A从村庄出发的背影",
    "continuityNotes": "服饰一致、光线过渡自然"
  },
  
  "qualitySuffix": "cinematic, 8K ultra HD, photorealistic, film grain, shallow depth of field",
  "styleSuffix": "[从阶段3A继承的画风后缀]",
  "colorSuffix": "[从调色师继承的色彩后缀]"
}
```

### 4.2 必填字段说明

| 字段 | 必填 | 说明 |
|------|------|------|
| keyFrameIndex | ✅ | 分镜序号 |
| timeRange | ✅ | 时间区间 |
| duration | ✅ | 时长（≤15s） |
| segmentType | ✅ | 段落类型 |
| shotCategory | ✅ | 镜头类型组合 |
| sceneRef | ✅ | @场景标签 |
| characters | ✅ | @角色标签+状态 |
| 🆕 entryFrame | ✅ | 入帧（首镜可为null） |
| 🆕 keyFrame | ✅ | 关键帧（核心画面） |
| 🆕 exitFrame | ✅ | 出帧（末镜可为null） |
| bridgeToNext | ✅ | 衔接下一镜 |
| bridgeFromPrev | ✅ | 承接上一镜 |
| 🆕 qualitySuffix | ✅ | 段落类型质量词 |
| 🆕 styleSuffix | ✅ | 画风后缀继承 |
| 🆕 colorSuffix | ✅ | 色彩后缀继承 |

---

## 五、🆕 100%时间覆盖验证规则

### 5.1 覆盖检查公式

```
覆盖率 = Σ(所有分镜图duration) / 用户目标时长 × 100%

要求：覆盖率 ≥ 100%（允许微小重叠≤1秒）
断点检查：相邻分镜图的timeRange必须首尾相接，不允许出现>0.5秒的空隙
```

### 5.2 连续性检查

```
分镜N的exitFrame.characterEndState === 分镜N+1的entryFrame.characterState
分镜N的exitFrame.lightingEndState === 分镜N+1的entryFrame.lightingState
分镜N的exitFrame.cameraEndState ≈ 分镜N+1的entryFrame.cameraState
```

---

## 六、质量检查清单（v10.0增强）

| # | 检查项 | 标准 |
|---|--------|------|
| K1 | 时长限制 | duration ≤ 15s |
| K2 | 打斗加速 | 🗡️打斗段 ≤ 10s |
| K3 | @引用完整 | 所有角色/道具/场景均有@标签 |
| K4 | 角色状态正确 | @标签使用正确状态后缀 |
| K5 | 衔接完整 | bridgeToNext和bridgeFromPrev均已填写 |
| K6 | 景别连续 | 与前后镜头景别跳跃≤2级 |
| K7 | 构图三层 | foreground/midground/background均有描述 |
| K8 | 光影连续 | 与同场景其他镜头光影一致 |
| K9 | 镜头类型合理 | shotCategory符合段落类型推荐 |
| K10 | 提示词可用 | imagePrompt可直接发送至AI平台 |
| 🆕 K11 | **三帧完整** | entryFrame/keyFrame/exitFrame均已填写 |
| 🆕 K12 | **出入帧匹配** | 上一镜exitFrame状态=本镜entryFrame状态 |
| 🆕 K13 | **质量词追加** | qualitySuffix已填写且与段落类型匹配 |
| 🆕 K14 | **风格词追加** | styleSuffix+colorSuffix已从阶段3A继承 |
| 🆕 K15 | **100%覆盖** | 所有分镜图timeRange首尾相接，无断点 |

---

## 七、打斗段加速规则

```
普通叙事段：10-15s/镜
打斗段强制：4-10s/镜（推荐6-8s）

打斗段镜头组合规则：
1. 开场：建立镜头（3-4s）交代双方位置
2. 冲突：碰撞镜头+跟拍（4-6s）×2-4组
3. 高潮：慢动作(2-3s)+碰撞(1-2s)
4. 结果：反应镜头(2-3s)

打斗段禁止：
- 禁止单镜超过10s
- 禁止连续3镜以上同景别
- 禁止无速度变化词的匀速动作
```

---

## 八、与25宫格的数据流关系

```
25宫格索引图（阶段4A·每幕1套）
  ↓ 用户确认叙事流后
提取验证结果 + 幕间衔接标注
  ↓
视频辅助分镜图（阶段4B·关键帧+过渡帧）
  ↓
图片提示词（阶段5）+ 视频提示词（阶段6）
```
