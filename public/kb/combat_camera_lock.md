# 🎥 打斗镜头逻辑锁定系统（防跳切 · 防漂浮 · 防瞬移）

> 本文件专治AI视频生成中打斗场景的三大顽疾：**跳切**、**人物漂浮**、**动作瞬移**。
> 当段落类型为「打斗」时，本文件中的所有规则自动激活，与 `combat_three_act_template.md` 联合使用。

---

## 一、跳切防护三原则

### 1.1 动作匹配切镜（Match on Action）

**核心规则**：相邻两个时间轴切片之间，前一切片的**末尾动作矢量**必须与下一切片的**开头动作矢量**方向一致。

| 正确示例 | 错误示例 |
|---------|---------|
| 切片1结尾：`Sword finishes its arc pointing to the right edge of frame` → 切片2开始：`Sword enters from left edge of frame, continuing the slash` | 切片1结尾：`Sword swinging right` → 切片2开始：`Character standing still`（动作断裂） |
| 切片1结尾：`Fist driving upward, body rising` → 切片2开始：`Fist at apex of uppercut, body fully extended upward` | 切片1结尾：`Punching forward` → 切片2开始：`Opponent already fallen`（跳过了接触过程） |
| 切片1结尾：`Character leaping into the air, body horizontal` → 切片2开始：`Character airborne, descending with kick extending` | 切片1结尾：`Character jumping` → 切片2开始：`Character on ground`（跳过了空中过程） |

**实施方法**：在每个时间轴切片末尾，强制描述动作的运动方向和身体朝向。在下一切片开头，以相同方向和朝向作为起始状态。

---

### 1.2 视线匹配切镜（Eyeline Match）

**核心规则**：正反打必须维持180度轴线内的视线方向一致。

```
正打镜头（A机位）：@角色A 面朝画面右侧，注视@角色B
反打镜头（B机位）：@角色B 面朝画面左侧，注视@角色A
```

**禁止**：
- 正反打之间角色突然面朝相反方向
- 越轴拍摄（除非有明确的过渡镜头）
- 视线方向在切片间无理由地改变

---

### 1.3 屏幕方向锁定（Screen Direction Lock）

**核心规则**：同一场战斗中，角色的屏幕位置关系保持稳定。

```
规则：整场战斗内
  @角色A 始终占据 [画面左侧 / 画面右侧]
  @角色B 始终占据 [对面一侧]
  除非有明确的"绕行"或"位置互换"动作描述
```

**换位条件**（仅以下情况可以改变屏幕位置关系）：
- 角色绕到对方身后（需要完整的绕行运动描述）
- 角色被击飞到对面（需要完整的击飞轨迹描述）
- 角色有意的战术走位（需要明确的移动方向描述）

---

## 二、动作矢量缝合技术

### 2.1 基本缝合格式

每个时间轴切片的**末尾**必须包含「末尾矢量声明」，格式：

```
... [动作描述], [运动部位] finishing [动作类型] pointing to [屏幕方向], 
body momentum carrying toward [方向].
```

下一切片的**开头**必须包含「入帧矢量承接」，格式：

```
[运动部位] entering from [屏幕对面方向], continuing the [动作], 
body maintaining forward momentum from previous motion ...
```

### 2.2 典型动作缝合示例

#### 横向攻击缝合
```
切片1末尾：@角色A sword completing horizontal slash from left to right, 
           blade tip reaching right edge of frame, body follow-through twisting right.
切片2开头：Blade continuing arc from previous slash, @角色A completing rotation, 
           weight shifting to right foot, re-centering for next strike.
```

#### 垂直攻击缝合
```
切片1末尾：@角色A weapon raised to highest point, arms fully extended overhead, 
           every muscle tensed for downward strike.
切片2开头：@角色A weapon descending with full body weight, arms driving downward, 
           continuing from peak height, gravity and force combined.
```

#### 被击飞缝合
```
切片1末尾：@角色B launched skyward by impact, body leaving ground, 
           trajectory arcing toward background right.
切片2开头：@角色B airborne at arc midpoint, limbs trailing, 
           gravitational descent beginning toward ground at right of frame.
```

#### 闪避缝合
```
切片1末尾：@角色B beginning lateral dodge to the left, 
           incoming attack passing through space just vacated.
切片2开头：@角色B completing sidestep to the left, 
           balance recovering, counter-attack opportunity window open.
```

---

## 三、打斗专用负面提示词库

### 3.1 强制追加负面词（打斗段自动注入）

以下负面提示词在检测到「打斗」段落标签时，**自动追加到该段的负面提示词末尾**：

```
Jump cut, abrupt camera shift, sudden angle change, teleporting, morphing, 
missing limbs, extra limbs, floating objects, no physics, static pose, 
frozen mid-action, inconsistent lighting between shots, T-pose, 
mannequin-like stiffness, sliding on ground without walking animation, 
ice skating movement, moon walking, limbs passing through body, 
weapons floating without being held, hair and clothing completely still during motion
```

### 3.2 分级负面词（按打斗类型追加）

| 打斗类型 | 额外负面词 |
|---------|----------|
| 近身格斗 | `arms stretching unnaturally, rubber limb effect, punch without body rotation, kick without hip movement` |
| 武器战斗 | `weapon changing size, blade bending, weapon not connected to hand, weapon floating, sword going through body without cutting` |
| 远程攻击 | `projectile appearing from nowhere, energy bolt without source, explosion without debris, magic without visual buildup` |
| 群战 | `opponents waiting their turn, enemies standing still while others fight, identical clone fighters, rubber banding` |
| 秒杀 | `victim showing no reaction, death without cause visible, body disappearing, instant teleportation` |

---

## 四、物理锚点锁定词库

### 4.1 脚部锚定（防漂浮）

| 场景 | 锚定提示词 | 权重建议 |
|------|----------|---------|
| 站立格斗 | `feet firmly planted on ground, weight on [left/right] leg, stable base` | 高 |
| 出拳/出脚 | `rear foot pivoting on ball of foot, front foot bearing weight, grounded stance` | 高 |
| 被击退 | `feet sliding on ground from impact force, heels digging in, friction visible` | 高 |
| 跳跃攻击 | `takeoff from ground visible, feet pushing off surface, landing impact on ground` | 中 |
| 倒地 | `body making contact with ground surface, weight pressing into floor` | 高 |

### 4.2 视线锁定（防空洞眼神）

| 场景 | 锚定提示词 |
|------|----------|
| 对峙 | `maintaining eye contact with opponent, gaze fixed on target, focused stare` |
| 攻击中 | `eyes tracking strike target, gaze leading the attack, predatory focus` |
| 受击 | `eyes widening from impact, gaze momentarily unfocused, pain registering in eyes` |
| 评估 | `scanning opponent for openings, calculating next move, tactical assessment in eyes` |

### 4.3 空间锚定（防瞬移）

| 场景 | 锚定提示词 |
|------|----------|
| 位置固定 | `positioned at [screen left/right/center], maintaining spatial relationship with opponent` |
| 距离变化 | `closing distance by [number] steps, gap between fighters narrowing/widening` |
| 环境锚定 | `back against [wall/pillar/edge], using [object] for leverage, environmental awareness` |

### 4.4 重力锚定（防反物理）

| 场景 | 锚定提示词 |
|------|----------|
| 常规动作 | `gravity-consistent motion, realistic weight distribution, center of mass following physics` |
| 重击 | `weight behind the blow, full body mass driving forward, ground reaction force` |
| 跳跃 | `parabolic arc, natural rise and fall, apex clearly visible` |
| 着地 | `impact absorption through knees and ankles, landing shockwave, dust kicked up` |

---

## 五、运动模糊分级控制

### 5.1 速度→模糊映射表

| 动作速度等级 | 运动模糊策略 | 对应提示词 |
|------------|------------|----------|
| 极慢（蓄势/情绪） | 无模糊，清晰呈现 | `No motion blur, crystal clear trajectory, every muscle detail visible, 60fps clarity` |
| 常速（行走/对话） | 自然微模糊 | `Subtle natural motion blur, slight blur on extremities, sharp body center` |
| 快速（出拳/挥剑） | 四肢强模糊+身体清晰 | `Heavy motion blur on striking limb, speed lines on fast-moving parts, clear torso and face` |
| 极速（必杀/瞬移） | 全身拖影+起止清晰 | `Complete blur streak connecting start and end positions, afterimage trail, only initial and final poses clear` |

### 5.2 慢动作触发条件

以下场景**建议**使用慢动作（Cinematic slow motion）：

| 场景 | 慢镜时长建议 | 提示词模板 |
|------|------------|----------|
| 蓄力峰值 | 1-2秒 | `Cinematic slow motion, 60fps, muscles tensing visibly, power building to critical point` |
| 命中瞬间 | 0.5-1秒 | `Bullet-time slow motion, impact moment captured in extreme detail, every particle visible` |
| 闪避极限 | 0.5-1.5秒 | `Time-freeze dodge, attack passing by inches in slow motion, hair and fabric disturbed by passing force` |
| 转折时刻 | 1-3秒 | `Dramatic slow motion, emotional beat, realization dawning, time seeming to stop` |

### 5.3 速度切换过渡

从慢镜回到正常速度时，禁止瞬间切换，必须有过渡：

```
... slow motion gradually accelerating back to real-time speed, 
motion blur increasing as speed normalizes, 
then full speed action resumes.
```

---

## 六、打斗段视频提示词生成检查表

在生成包含打斗的STEP-C视频提示词后，逐条检查：

| # | 检查项 | 检查方法 | 不通过则 |
|---|-------|---------|---------|
| 1 | 动作矢量缝合 | 检查每个切片末尾是否有末尾矢量声明，下一切片开头是否有入帧矢量承接 | 补写矢量声明 |
| 2 | 视线方向一致 | 检查正反打中视线方向是否符合180度规则 | 修正视线方向 |
| 3 | 屏幕方向稳定 | 检查整场战斗中角色的左右位置关系是否一致 | 修正位置描述 |
| 4 | 物理锚点存在 | 检查是否至少有1个脚部锚定和1个重力锚定描述 | 追加锚定词 |
| 5 | 打斗负面词追加 | 检查是否已追加打斗专用负面提示词 | 追加负面词 |
| 6 | 运动模糊适当 | 检查快速动作是否有模糊描述，慢镜是否有清晰描述 | 追加模糊词 |
| 7 | 无瞬移/漂浮 | 检查所有位移是否有完整的移动过程描述 | 补写移动过程 |
