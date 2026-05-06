import * as React from 'react';

/**
 * Design system Card · DESIGN.md components.card
 *
 * 封装 src/index.css 的 `.card / .card-interactive / .card-flat` 三种变体。
 * 默认 padding=insetLg (16px)；如需不同 padding，传 className 覆盖。
 *
 * **使用边界**:
 * - 自包含信息单元（项目卡 / 节点卡 / 章节卡 / 文档卡）
 * - 不要把整个页面套 Card（页面 ≠ 卡片）
 * - 列表行用 .card-flat 或裸 div，不要每行套 Card
 *
 * **变体**:
 * - `default` 静态卡片，raised 阴影
 * - `interactive` 整卡可点击：hover 升 floating 阴影 + cursor-pointer
 * - `flat` 嵌入容器内、不抬起
 */

type Variant = 'default' | 'interactive' | 'flat';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: Variant;
  /** 默认 true：套 .card 内边距 (insetLg = 16px)。如需自定义传 false + className */
  padded?: boolean;
}

const VARIANT_CLASS: Record<Variant, string> = {
  default:     'card',
  interactive: 'card-interactive',
  flat:        'card-flat',
};

export const Card = React.forwardRef<HTMLDivElement, CardProps>(function Card(
  { variant = 'default', padded = true, className = '', children, ...rest },
  ref,
) {
  const cls = [VARIANT_CLASS[variant], padded && 'p-4', className].filter(Boolean).join(' ');
  return (
    <div ref={ref} className={cls} {...rest}>
      {children}
    </div>
  );
});

/** Card 内部头部块 (gap = stackMd 12px to body) */
export function CardHeader({ className = '', ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={`mb-3 ${className}`.trim()} {...rest} />;
}

/** Card 标题 typography (heading-m = 18px / 600) */
export function CardTitle({ className = '', ...rest }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={`text-heading-m text-fg-primary ${className}`.trim()} {...rest} />;
}

/** Card 描述 (body-s = 13px muted) */
export function CardDescription({ className = '', ...rest }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={`text-body-s text-fg-muted ${className}`.trim()} {...rest} />;
}

/** Card 主体（与 Header 之间 stackMd） */
export function CardBody({ className = '', ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={`text-body-m text-fg-secondary ${className}`.trim()} {...rest} />;
}

/** Card 底部按钮组 (gap = stackSm 8px) */
export function CardFooter({ className = '', ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={`mt-4 flex items-center gap-2 ${className}`.trim()} {...rest} />;
}
