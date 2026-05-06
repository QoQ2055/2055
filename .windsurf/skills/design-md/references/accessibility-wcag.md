# Accessibility · WCAG 与 Lint 规则

> `npx @google/design.md lint` 会跑 WCAG 对比度检查. 本文档详解它检查什么, 以及 lint 覆盖不到但重要的可访问性规则.

---

## 1. WCAG 2.1 核心对比度门槛

| 元素类型 | AA 最低 | AAA 增强 |
|---|:-:|:-:|
| 正常正文 (< 18pt 或 14pt bold) | **4.5:1** | 7:1 |
| 大字体 (≥ 18pt 或 14pt bold) | **3:1** | 4.5:1 |
| 非文本 UI 元素 (图标 / 边框 / focus ring) | **3:1** | — |
| 装饰性图形 | 无要求 | — |

**CineForge 级别**: V1 至少 AA, 主要场景争取 AAA.

---

## 2. Lint 会检查的 DESIGN.md 组合

### 2.1 `colors.primary` on `colors.neutral50` 或 neutral900

lint 会自动计算 foreground/background 对比度, 要求 ≥ 4.5:1.

失败示例:
```yaml
colors:
  primary: "#888888"     # 灰
  neutral50: "#f0f0f0"   # 浅灰
  # 对比度 2.3:1 ❌ 太低
```

通过示例:
```yaml
colors:
  primary: "#120b19"     # 深紫近黑
  neutral50: "#f4edf8"   # 浅紫白
  # 对比度 ~16:1 ✅
```

### 2.2 Button 组件对比度

lint 读 `components.button.backgroundColor` + `components.button.color`, 要求 ≥ 4.5:1 (button 文字一般正常字号).

```yaml
# ❌ 会 fail
components:
  button:
    backgroundColor: "#c084fc"   # 霓虹紫
    color: "#ffffff"             # 白
    # 对比度 2.8:1
```

```yaml
# ✅ 通过
components:
  button:
    backgroundColor: "#c084fc"
    color: "#120b19"             # 改用深色文字
    # 对比度 ~7:1
```

### 2.3 Input focus state

`components.input.focusBorderColor` vs `components.input.backgroundColor` 对比度 ≥ 3:1 (非文本元素).

### 2.4 Error state

`colors.error` on main background ≥ 3:1 (通常要求更高, 错误要显眼).

---

## 3. Lint 输出格式

```
$ npx @google/design.md lint DESIGN.md

🔴 ERROR (2):
  [WCAG-AA] components.button contrast: 2.8:1 (need 4.5:1 for bodyM text)
    foreground: {components.button.color} = #ffffff
    background: {components.button.backgroundColor} = #c084fc
    fix: darken text or lighten background

  [SCHEMA] colors.primary: invalid hex "#12b" (must be 6 or 8 digit)

🟡 WARNING (3):
  [STYLE] typography.bodyM.fontSize is "1rem" (prefer "px" for consistency)
  [UNUSED] colors.neutral700 not referenced anywhere in components
  [COVERAGE] components.input missing focus state tokens

✓ PASS (18 checks)
```

---

## 4. Lint 覆盖**不到**的可访问性规则

以下要靠人工检查 (`selfcheck-checklist.md` 覆盖):

### 4.1 语义化 HTML
- `<button>` 不是 `<div onClick>`
- `<nav>` / `<main>` / `<aside>` 用对
- Form label 和 input 关联 (`<label htmlFor>` 或 aria-labelledby)

### 4.2 键盘可操作
- 所有交互元素 Tab 可达
- Focus 可见 (focus-visible 或 focus ring)
- ESC 关 modal
- Enter 提交 form

### 4.3 屏幕阅读器
- 图像 alt 文本
- 图标按钮 aria-label
- Live region 用于动态内容 (如 agent 流式输出)
- 隐藏装饰元素用 aria-hidden

### 4.4 动画减弱
- 尊重 `prefers-reduced-motion`
- 不用纯动画传达信息 (也要有静态替代)

---

## 5. 色盲友好性

WCAG 不要求色盲测试, 但推荐:

### 5.1 不单用颜色区分
```
❌ 错: success 用绿色, error 用红色, 无图标差异
✅ 对: 颜色 + 图标 (✓ vs ✗) + 文字 ("成功" / "失败")
```

### 5.2 语义色对色盲测试
- 最常见色盲: 红绿色盲 (deuteranomaly/protanomaly) ~8% 男性
- 工具: https://www.color-blindness.com/coblis-color-blindness-simulator/
- CineForge success (#22c55e) + error (#ef4444) 在红绿色盲下会**看起来几乎一样**. 必须配图标/文字.

---

## 6. 暗色主题的特殊可访问性

### 6.1 避免纯黑底纯白字
- 纯黑 (#000) + 纯白 (#fff) 对比度 21:1, 理论最大
- **但**: 散光用户在暗色大背景下看强白字会 "halation" (光晕)
- 推荐: 底 `#0a0a0a` ~ `#15151c`, 字 `#f0f0f0` ~ `#f4edf8`
- CineForge primary `#120b19` + neutral50 `#f4edf8` 对比度 ~15.8:1, 符合

### 6.2 饱和色慎用
- 暗底上饱和红/橙/霓虹绿会 "闪眼", 长时间阅读疲劳
- 用柔和色 (降低饱和度 10-20%)
- CineForge accent `#c084fc` 是中等饱和的霓虹紫, 可接受

### 6.3 不用纯白 shadow
- `0 4px 8px rgba(255,255,255,0.1)` 在暗底 looks 奇怪
- 暗色体系用 "色调差" + "边框" 代替 shadow

---

## 7. 关键对比度速查表 (手动计算)

前景色 on 后景色 → 对比度 (WebAIM 算法):

| 前 | 后 | 对比度 |
|---|---|:-:|
| #000 | #fff | 21:1 |
| #120b19 | #f4edf8 | 15.8:1 |
| #c084fc | #120b19 | 7.2:1 |
| #c084fc | #ffffff | 2.8:1 ❌ |
| #c084fc | #1f1529 | 5.4:1 |
| #f4edf8 | #1f1529 | 13.5:1 |
| #9b84ad | #120b19 | 4.8:1 |
| #6e5a80 | #120b19 | 2.6:1 ❌ 仅装饰 |
| #ef4444 | #120b19 | 5.1:1 |
| #22c55e | #120b19 | 8.2:1 |

工具:
- https://webaim.org/resources/contrastchecker/
- https://contrast-ratio.com/

---

## 8. AAA 增强清单 (可选, CineForge 可逐步追求)

- 正文对比度提到 7:1+
- Focus 状态 2px 以上可见线
- 重要状态不单靠颜色 (必配图标)
- 动画可关闭 (prefers-reduced-motion 尊重)
- Live captions 支持 (V2+)

---

## 9. 本 SKILL 工作流里何时查可访问性

| 工作流阶段 | 检查 |
|---|---|
| §4.1 Greenfield 步骤 2 (色调锻造) | 每定一个 color pair 就手动估一下对比度 |
| §4.1 步骤 5 (组件样式) | button/input 的 fg/bg 配对必 ≥ 4.5:1 |
| §4.1 步骤 7 (lint) | 自动校验所有组合 |
| §4.4 Audit | 跑 lint + 人工过 selfcheck §可访问性 段 |

---

## 10. CLI lint 命令选项

```bash
# 默认严格 (AA)
npx @google/design.md lint DESIGN.md

# 松一档 (大字体免对比度检查)
npx @google/design.md lint --skip-contrast-for=headingXl,headingL,displayL

# 严格 (AAA)
npx @google/design.md lint --wcag=AAA

# 只要 error 不要 warning
npx @google/design.md lint --strict
```

---

## 11. 自定 accessibility policy

项目可在 repo 根放 `.design-md-policy.yml`:

```yaml
wcag: AA               # AA | AAA
contrast:
  body: 4.5
  large: 3.0
  nonText: 3.0
ignore:
  - "colors.neutral700 unused"   # 允许的 warning
```

(目前 v alpha 版规范是否读取此文件待确认, 保守先写好)
