// Web component set implementing the Modernist design system (@xolt/ui-tokens)
// for apps/admin. Mirrors the @xolt/ui (React Native) API shape where it makes
// sense, but these are plain DOM components — not shared code, since RN
// components can't render on the web.

export { Button } from "./Button";
export type { ButtonProps, ButtonVariant } from "./Button";

export { Card } from "./Card";
export type { CardProps } from "./Card";

export { Input, Textarea } from "./Input";
export type { InputProps, TextareaProps } from "./Input";

export { Badge } from "./Badge";
export type { BadgeProps, BadgeVariant } from "./Badge";
