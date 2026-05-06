# 🎨 视觉风格库（30 种预设）

> 源自 ShadowScript影语引擎的 Xi/El 对象。每种风格含中文描述和英文 Prompt 后缀。
> 视觉风格总监在推荐方案时使用本库，提示词包预制师在组装提示词时追加英文后缀。

---

## 一、写实系列

| 风格ID | 中文描述 | 英文 Prompt 后缀 |
|--------|---------|-----------------|
| `cinematic` | 电影写实，追求极致的真实感和电影质感 | cinematic film still, photorealistic, anamorphic lens, dramatic lighting |
| `vintage` | 复古胶片，颗粒感强，色调怀旧 | vintage film, analog grain, nostalgic color grading, retro aesthetic |
| `documentary` | 纪录片写实，手持晃动，自然光跟拍，粗糙颗粒感 | documentary photography, handheld camera, natural light, film grain, vérité style |
| `noir` | 黑色电影，黑白高对比，阴影深邃 | film noir, black and white, deep shadows, high contrast chiaroscuro |
| `kdrama` | 韩式偶像剧，柔光人像，粉紫暖调，大光圈虚化 | Korean drama aesthetic, soft bokeh portrait, warm pink-purple tones, shallow depth of field |

## 二、动画/CG 系列

| 风格ID | 中文 | 英文 |
|--------|------|------|
| `anime` | 日式动漫，线条清晰，色彩明快 | anime style, vibrant colors, cel shading, clean linework |
| `pixar_3d` | 皮克斯3D动画，圆润角色造型，高饱和暖色 | Pixar animation style, subsurface scattering skin, expressive character design |
| `disney_3d` | 迪士尼3D童话动画，大眼可爱角色 | Disney 3D animation, big expressive eyes, candy bright colors, magical sparkle |
| `ghibli` | 吉卜力手绘动画，手绘线条与水彩背景 | Studio Ghibli style, 2D hand-drawn animation, hand-painted watercolor background |
| `donghua_xianxia` | 中国3D修仙国漫，灵气流光粒子特效 | Chinese 3D xianxia animation, flowing immortal robes, qi energy particles |
| `gothic_anime` | 哥特暗黑动画，深色调与高反差阴影 | dark gothic anime, deep shadows, sharp angular linework, moonlit candlelight |
| `ai_mandrama` | AI漫剧/条漫动态，清晰墨线勾勒 | AI comic drama style, limited animation frames, clear ink outlines |
| `3d_render` | 3D渲染效果，虚幻引擎质感 | 3D render, Unreal Engine, hyperrealistic model, subsurface scattering |

## 三、艺术系列

| 风格ID | 中文 | 英文 |
|--------|------|------|
| `oil_painting` | 油画质感，笔触明显，色彩浓郁 | oil painting style, visible brushstrokes, rich impasto texture |
| `watercolor` | 水彩手绘，边缘晕染，清透唯美 | watercolor illustration, soft wash, bleeding edges, delicate transparency |
| `ink_wash` | 中国传统水墨画，笔墨晕染，留白意境 | Chinese ink wash painting, sumi-e brushwork, misty mountain landscape |
| `gongbi` | 中国工笔画，白描铁线勾勒，矿物质颜料 | gongbi painting style, ultra-fine iron-wire ink outlines, mineral pigment washes |
| `ukiyoe` | 浮世绘风格，传统日本艺术感 | ukiyo-e woodblock print, traditional japanese art, flat bold colors |
| `french_illus` | 法式插画，Moebius线条风格 | French graphic novel style, Moebius line art, flat geometric color blocks |
| `concept_art` | 科幻概念艺术，Greg Rutkowski风格 | sci-fi concept art, digital matte painting, intricate mechanical detail |

## 四、特殊风格系列

| 风格ID | 中文 | 英文 |
|--------|------|------|
| `cyberpunk` | 赛博朋克，霓虹灯光，高对比度 | cyberpunk aesthetic, neon lights, rain reflections, high contrast |
| `steampunk` | 蒸汽朋克，齿轮机械，黄铜色调 | steampunk, brass gears, Victorian aesthetic, mechanical details |
| `fantasy` | 奇幻魔幻，色彩绚丽，充满魔法感 | fantasy art, magical atmosphere, ethereal glow, vivid colors |
| `surreal` | 超现实主义，梦幻且怪诞 | surrealist, dreamlike, impossible architecture, Salvador Dali influence |
| `minimalist` | 极简主义，画面干净，大量留白 | minimalist, negative space, simple forms, clean composition |
| `pixel_art` | 像素艺术，复古游戏感 | pixel art, retro game aesthetic, 8-bit, crisp pixels |
| `comic` | 美式漫画，粗犷线条 | comic book style, bold outlines, pop art, dynamic composition |
| `claymation` | 黏土定格动画 | claymation, stop motion, handmade clay texture |
| `paper_cut` | 中国皮影剪纸，镂空剪影造型 | Chinese paper cut art, silhouette cutout design, red black gold palette |
| `none` | 无风格限定（自由发挥） | (空) |

---

## 二、3D 国漫专项规范

当选择 `donghua_xianxia` 或其他国漫导演风格时，追加以下规范：

```
【3D国漫专项规范（必须遵守）】：
- 角色建模描述：${charStyle}
- 世界观场景：${worldStyle}
- 特效描述规范：${vfxStyle}
- 每条提示词后固定追加：${promptSuffix}
- 角色不得描述为真实演员或已知IP角色，使用原创虚拟角色描述
```

---

## 三、风格植入规范

非 `none` 风格时，每段完美分镜提示词末尾必须追加风格标识：

```
【视觉风格植入规范（必须遵守）】：
每段完美分镜提示词末尾必须追加以下风格标识（中文，融入段落收尾自然句末）：${中文描述}。
不得省略，不得改写。
```
