# ✨ 质量优化与动作增强提示词库

> 本文件是**所有提示词工程师**（NBP图片/Seedance视频）的质量增强圣经。
> 每个生成的提示词**末尾必须追加**对应段落类型的质量+动作增强词组合。
>
> ⚠️ 铁律：质量词不是可选装饰——它是提示词的强制组成部分。

---

## 一、画质增强词库

### 1.1 分辨率与清晰度

| 场景 | 推荐词组 |
|------|---------|
| 通用高质量 | `8K ultra HD, extremely detailed, sharp focus` |
| 真人写实 | `photorealistic, hyperrealistic, lifelike detail` |
| 3D渲染 | `high-quality 3D render, ray tracing, global illumination` |
| 2D动画 | `clean linework, professional animation quality, vibrant colors` |
| 概念艺术 | `professional concept art, highly detailed illustration` |

### 1.2 电影感增强

| 场景 | 推荐词组 |
|------|---------|
| 通用电影感 | `cinematic, film quality, movie-grade production` |
| 景深 | `shallow depth of field, bokeh background, tilt-shift` |
| 胶片质感 | `35mm film grain, anamorphic lens, film texture` |
| IMAX质感 | `IMAX quality, wide dynamic range, pristine clarity` |

---

## 二、光影增强词库

| 光效类型 | 推荐词组 |
|---------|---------|
| 体积光 | `volumetric lighting, god rays, light shafts` |
| 边缘光 | `rim lighting, backlit silhouette, edge glow` |
| 焦散 | `caustic light patterns, dappled sunlight` |
| 全局光照 | `global illumination, radiosity, ambient occlusion` |
| 霓虹/赛博 | `neon glow, cyberpunk lighting, RGB reflections` |
| 烛光/火光 | `warm candlelight, flickering firelight, ember glow` |
| 月光 | `pale moonlight, cool blue illumination, lunar glow` |
| 黄金时刻 | `golden hour warmth, sunset glow, warm orange light` |

---

## 三、材质增强词库

| 材质类型 | 推荐词组 |
|---------|---------|
| 皮肤 | `realistic skin texture, skin pores, subsurface scattering` |
| 金属 | `polished metal surface, metallic reflection, chrome finish` |
| 布料 | `fabric texture, cloth wrinkles, natural draping` |
| 石材 | `weathered stone texture, moss-covered, ancient patina` |
| 水面 | `crystal clear water, underwater caustics, ripple reflections` |
| 木材 | `natural wood grain, aged timber, knots and texture` |
| 毛发 | `individual hair strands, realistic hair flow, natural shine` |
| 玻璃 | `transparent glass, refraction, prismatic light` |

---

## 四、动作增强词库

| 动态类型 | 推荐词组 |
|---------|---------|
| 动态姿势 | `dynamic pose, action pose, mid-motion freeze` |
| 流畅运动 | `fluid motion, smooth movement, natural body mechanics` |
| 重心转移 | `weight shift, center of gravity moving, balanced stance` |
| 速度线 | `motion blur, speed lines, fast movement trail` |
| 力量感 | `powerful stance, muscular tension, exerting force` |
| 优雅动态 | `graceful movement, elegant motion, flowing gesture` |
| 爆发力 | `explosive motion, burst of energy, sudden acceleration` |
| 微动态 | `subtle movement, gentle sway, breathing motion` |

---

## 五、情绪增强词库

| 情绪 | 推荐词组 |
|------|---------|
| 坚定 | `intense gaze, determined expression, resolute eyes` |
| 恐惧 | `wide eyes in terror, trembling body, pale complexion` |
| 悲伤 | `tear-filled eyes, downcast expression, slumped posture` |
| 愤怒 | `furrowed brows, clenched jaw, blazing eyes` |
| 喜悦 | `radiant smile, bright eyes, relaxed joyful expression` |
| 惊讶 | `eyes wide open, mouth slightly agape, raised eyebrows` |
| 冷酷 | `cold calculating eyes, expressionless face, icy demeanor` |
| 温柔 | `soft gentle gaze, warm smile, kind expression` |

---

## 六、段落类型 × 质量词推荐组合

> ⚠️ **强制规则**：每段提示词末尾必须追加对应段落类型的推荐组合。

### 🗡️ 打斗段

```
8K ultra HD, cinematic, dynamic pose, explosive motion, motion blur, 
dramatic rim lighting, weight shift visible, powerful impact, 
film grain, shallow depth of field
```

### 📖 叙事段

```
8K ultra HD, cinematic, photorealistic, natural body language, 
volumetric lighting, detailed environment, atmospheric depth, 
film quality, sharp focus
```

### 💬 对话段

```
8K ultra HD, cinematic, realistic skin texture, subtle facial expressions, 
soft natural lighting, shallow depth of field, intimate framing, 
eye-level camera, film grain
```

### 🎭 情感段

```
8K ultra HD, cinematic, intense emotional expression, dramatic lighting, 
volumetric atmosphere, extreme detail on face, tear glistening, 
shallow depth of field, film quality
```

### ✨ 奇观段

```
8K ultra HD, cinematic, epic scale, breathtaking vista, 
volumetric god rays, high dynamic range, sweeping camera, 
awe-inspiring composition, maximum visual impact
```

### 🌅 转场段

```
8K ultra HD, cinematic, smooth transition, environmental establishing, 
atmospheric perspective, time-of-day lighting, gentle motion, 
wide aspect ratio, scenic beauty
```

### 🌙 静谷段

```
8K ultra HD, cinematic, serene atmosphere, soft diffused lighting, 
gentle ambient sounds implied, breathing space, contemplative, 
delicate detail, peaceful composition
```

---

## 七、质量词追加规则

### 7.1 图片提示词（NBP）

```
[原始提示词内容], [段落类型质量词组合], 9:16 aspect ratio, no text, no watermark
```

### 7.2 视频提示词（Seedance）

```
[时间轴切片正文]

整体[画风风格]，[段落类型质量词组合]，画面色彩[色彩后缀]，时长[X]秒。
```

### 7.3 ⛔ 已废弃 · 原 25 宫格预演提示词

> **2026-04 Q4 整节废弃**：25 宫格预演系统停用，关键帧直出使用 §7.1 / §7.2 对应段落类型的质量词即可。以下模板仅作历史参考，**禁止**按此格式输出新产物。

```
（已废弃）
```

---

## 八、禁止词表（全局过滤）

| 类别 | 禁止词 | 原因 |
|------|--------|------|
| 版权 | `Disney style, Pixar style, Studio Ghibli` | 版权风险 |
| 低质量 | `low quality, blurry, bad anatomy, ugly` | 负面引导 |
| 敏感 | `nude, nsfw, violent gore, dismemberment` | 平台限制 |
| 冗余 | `very very, extremely extremely` | 无效堆叠 |
| 矛盾 | `realistic cartoon, dark bright` | 逻辑矛盾 |
