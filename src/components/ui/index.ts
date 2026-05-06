// Design system primitives · DESIGN.md v0.1.1-alpha
// Phase 3 引入。新代码一律从这里导入，不要直接读 src/index.css 的 .btn-primary 等类。
export { Button, type ButtonProps } from './Button';
export { Input, type InputProps } from './Input';
export { Textarea, type TextareaProps } from './Textarea';
export {
  Card, CardHeader, CardTitle, CardDescription, CardBody, CardFooter,
  type CardProps,
} from './Card';
export {
  Modal, ModalHeader, ModalTitle, ModalDescription, ModalBody, ModalFooter,
  type ModalProps, type ModalHeaderProps,
} from './Modal';
export { NavItem, NavSectionLabel, type NavItemProps } from './NavItem';
export { Tabs, type TabsProps, type TabItem } from './Tabs';
