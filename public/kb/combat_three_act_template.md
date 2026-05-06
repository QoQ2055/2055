# 🥊 打斗动作三幕式结构化模板（Setup → Action → Reaction）

> 本文件是打斗场景的**最高优先级结构规范**。所有打斗段的视频提示词必须遵守本模板。
> 当段落类型被标注为「打斗」「战斗」「对决」「追逐」时，自动激活本模板。

---

## 一、核心原则

每一个打斗动作**必须**拆解为3个逻辑阶段，禁止省略任何阶段：

| 阶段 | 英文标识 | 功能 | 时长占比 | 速度 |
|------|---------|------|---------|------|
| 蓄势 | Setup | 预备动作、肌肉紧张、重心转移、意图暗示 | 20-30% | 慢镜/常速 |
| 接触/爆发 | Action | 命中瞬间、冲击帧、碎裂效果、最大力量输出 | 10-20% | 极速/冲击帧冻结 |
| 受击/缓冲 | Reaction | 被击反应、布娃娃物理、缓冲恢复、姿态重置 | 30-40% | 中速/慢镜 |

> ⚠️ **铁律**：三段时长禁止等分。蓄势必须比爆发长，缓冲必须比爆发长。
> ⚠️ **铁律**：打斗段内不允许出现无三幕式结构的孤立动作描述。

---

## 二、三幕式镜头流模板

### 模板A：近身格斗（拳脚/肘膝/头槌）

**镜头A — 蓄势（Setup）** `1-3秒`
```
Medium shot, @角色A winding up [攻击部位], twisting [发力部位] for maximum torque, 
weight transfer to [支撑腿], kinetic tension building in [肌肉群], 
eyes locked on target, anticipation of strike.
```
AI衔接词自动注入：`anticipation of strike, muscles coiling, breath held`

**镜头B — 接触/爆发（Action）** `0.5-2秒`
```
Close-up, [攻击部位] connecting with [目标部位], 
[冲击效果: skin ripple impact / bone-crushing contact / shockwave burst], 
[粒子效果: sweat particles frozen in air / blood spatter / debris], 
motion blur on the striking limb, impact freeze frame 0.3s.
```
AI衔接词自动注入：`follow through action, momentum transfer, force propagation`

**镜头C — 受击/缓冲（Reaction）** `1-3秒`
```
Wide shot, @角色B [受击反应: head snapping sideways / staggering backward / launched through air], 
[物理反应: spittle flying / knees buckling / ragdoll physics], 
losing balance, [恢复: struggling to regain footing / crumpling to ground], 
physics-based motion throughout.
```

---

### 模板B：武器战斗（剑/刀/棍/枪）

**镜头A — 蓄势（Setup）** `1-3秒`
```
Medium-wide shot, @角色A raising @道具_[武器] overhead with both arms tensed, 
blade [catching light / trailing energy], stance widening, 
back foot pivoting for power generation, weapon arc telegraphed.
```
AI衔接词自动注入：`weapon raised high, gathering force, killing intent radiating`

**镜头B — 接触/爆发（Action）** `0.5-2秒`
```
Close-up tracking shot, @道具_[武器] cutting through air in [arc direction], 
[冲击: blade meeting resistance / metal clashing / slicing through target], 
[特效: sparks showering / energy discharge / air pressure wave], 
speed lines along blade trajectory, impact moment freeze.
```
AI衔接词自动注入：`blade completing arc, force delivered, cutting trajectory`

**镜头C — 受击/缓冲（Reaction）** `1-3秒`
```
Wide shot, @角色B [武器被击: weapon knocked aside / blade caught in block / guard shattered], 
[身体反应: sliding backward from force / spinning from impact / armor denting], 
[环境反应: ground cracking / wall damaged / debris settling],
recovery attempted, new defensive stance forming.
```

---

### 模板C：远程攻击（弓箭/法术/能量弹/投掷）

**镜头A — 蓄势（Setup）** `2-4秒`
```
Medium shot, @角色A [蓄力: channeling energy / drawing bowstring / raising palm], 
[能量可视化: swirling particles around hand / bowstring vibrating with stored power / magic circle forming], 
concentrated gaze on target, environment reacting to energy buildup [wind / light distortion / ground trembling].
```
AI衔接词自动注入：`energy peaking, release imminent, air crackling with power`

**镜头B — 接触/爆发（Action）** `1-2秒`
```
Dynamic tracking shot following projectile, [投射物: energy bolt / arrow / fireball] 
hurtling toward @角色B at [速度], trailing [尾迹: luminous trail / smoke / energy particles], 
impact explosion on contact, [冲击范围: localized burst / area of effect / piercing through].
```
AI衔接词自动注入：`projectile impact, energy dispersal, shockwave expanding`

**镜头C — 受击/缓冲（Reaction）** `1-3秒`
```
Wide shot, @角色B [承受: blasted backward / shielding from explosion / absorbing blast], 
[环境反应: crater forming / flames spreading / smoke billowing], 
[人物状态: armor scorched / skin singed / stance broken],
dust settling, damage assessment moment.
```

---

### 模板D：群战（多对一/多对多）

**镜头A — 蓄势（Setup）** `1-2秒`
```
Wide establishing shot, multiple opponents closing in on @角色A from [方向s], 
@角色A scanning threats, choosing primary target, 
weight shifting to combat-ready stance, environment awareness.
```

**镜头B — 接触/爆发（Action）** `2-4秒`（多次快速打击连续）
```
Dynamic handheld tracking, @角色A engaging [opponent1] with [攻击1], immediately pivoting to 
[opponent2] with [攻击2], fluid transition between targets, 
each strike landing with [冲击效果], continuous motion never stopping, 
combat dance choreography with rhythmic hitting sounds.
```

**镜头C — 受击/缓冲（Reaction）** `1-2秒`
```
Slow motion wide shot, multiple opponents staggering/falling simultaneously, 
@角色A standing in center of aftermath, breathing heavily, 
[环境状态: bodies scattered / weapons fallen / dust settling],
brief stillness before next engagement.
```

---

### 模板E：处决/秒杀（压倒性实力差距）

**镜头A — 蓄势（Setup）** `2-4秒`（极度缓慢渲染压迫感）
```
Slow push-in shot, @角色A [approaching / raising weapon / extending hand] 
with absolute calm, no urgency, overwhelming presence, 
@角色B [frozen in fear / backing away / desperately defending],
power differential palpable, silence building tension.
```

**镜头B — 接触/爆发（Action）** `0.3-1秒`（极短极快）
```
Whip-cut close-up, [single decisive motion: one clean slash / finger flick / casual gesture], 
[极简冲击: clean severance / instant destruction / effortless obliteration],
no wasted motion, surgical precision, almost too fast to see.
```

**镜头C — 受击/缓冲（Reaction）** `3-5秒`（长时间留白渲染余韵）
```
Wide shot, absolute silence 1.5s, then @角色B [delayed reaction: slowly collapsing / 
wound line appearing / realization dawning], 
@角色A [calm aftermath: lowering weapon / turning away / not even looking],
environment settling, weight of what happened sinking in.
```

---

## 三、衔接词自动注入规则

当段落类型标签为「打斗/战斗/对决」时，系统自动执行以下操作：

### 3.1 段内衔接词注入

| 位置 | 自动注入词 | 作用 |
|------|----------|------|
| Setup → Action 之间 | `anticipation of strike, muscles coiling, breath held, kinetic energy peaking` | 蓄力到爆发的过渡 |
| Action → Reaction 之间 | `follow through action, momentum transfer, force propagation, impact reverberating` | 爆发到缓冲的过渡 |
| Reaction → 下一回合Setup 之间 | `recovery stance, re-centering balance, reassessing opponent, catching breath` | 缓冲到下一轮蓄力 |

### 3.2 连续打击链衔接

当一个15秒容器内有多轮攻防时，轮与轮之间强制插入：
```
Brief recovery moment, both fighters resetting stance, 
circling each other for [0.5-1s], tension rebuilding.
```

### 3.3 打斗→非打斗过渡衔接

当打斗段结束、进入对话或情绪段时：
```
Adrenaline fading, [角色] [恢复动作: catching breath / lowering weapon / unclenching fists],
environment sounds returning, time resuming normal flow.
```

---

## 四、打斗段时间轴切分铁律

### 4.1 禁止等分规则

| 容器总时长 | 错误示例（禁止） | 正确示例（动态切分） |
|----------|----------------|-------------------|
| 6秒 | {0-3s} + {3-6s} | {0-2s蓄势} + {2-3s爆发} + {3-6s缓冲} |
| 10秒 | {0-5s} + {5-10s} | {0-3s蓄势} + {3-4.5s爆发} + {4.5-8s缓冲} + {8-10s恢复} |
| 15秒 | {0-7.5s} + {7.5-15s} | {0-4s蓄势} + {4-6s爆发} + {6-10s缓冲} + {10-13s第二轮蓄势} + {13-15s第二轮爆发} |

### 4.2 速度对比强制

每个打斗容器内**至少**包含：
- 1段慢镜（蓄势或缓冲阶段，标注 `slow motion` 或 `cinematic slow motion`）
- 1段快切/正常速度（爆发阶段，标注 `real-time speed` 或 `rapid action`）

### 4.3 冲击帧冻结规则

命中瞬间允许使用冲击帧冻结（impact freeze frame），时长 0.2-0.5秒：
```
{X秒} impact freeze frame 0.3s, [冲击画面定格描述], 
then real-time speed resumes.
```

---

## 五、打斗提示词质量检查清单

生成打斗段视频提示词后，必须通过以下检查：

| # | 检查项 | 通过条件 |
|---|-------|---------|
| 1 | 三幕式完整性 | 每个打斗动作都有 Setup + Action + Reaction |
| 2 | 时间轴非等分 | 没有连续2个以上等时长切片 |
| 3 | 速度对比存在 | 至少有1个慢镜 + 1个快切 |
| 4 | 衔接词存在 | Setup→Action 和 Action→Reaction 之间有衔接词 |
| 5 | 物理锚点存在 | 至少有1个脚部锚定或重心描述 |
| 6 | 动作矢量连续 | 前一切片末尾动作方向与下一切片开头一致 |
| 7 | 禁止孤立动作 | 没有无前因后果的孤立爆发镜头 |
| 8 | 负面词追加 | 包含打斗专用负面提示词 |
