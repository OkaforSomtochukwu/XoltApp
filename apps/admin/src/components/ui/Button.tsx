"use client";

import type { ButtonHTMLAttributes } from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  /** 36x36 icon-only button — pass `aria-label` instead of visible text. */
  icon?: boolean;
  /** Full width, label flush left (matches .btn-block — never centered). */
  block?: boolean;
};

/** Modernist `.btn` — labels sit flush left, never centered, even in `.btn-block`. */
export function Button({
  variant = "primary",
  icon = false,
  block = false,
  className,
  type = "button",
  children,
  ...rest
}: ButtonProps) {
  const classes = ["btn", `btn-${variant}`, icon && "btn-icon", block && "btn-block", className]
    .filter(Boolean)
    .join(" ");
  return (
    <button type={type} className={classes} {...rest}>
      {children}
    </button>
  );
}
