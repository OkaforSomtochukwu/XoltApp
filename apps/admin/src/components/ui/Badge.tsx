import type { ReactNode } from "react";

export type BadgeVariant = "accent" | "accent2" | "neutral" | "outline";

export type BadgeProps = {
  children: ReactNode;
  variant?: BadgeVariant;
};

/** Modernist `.tag` — small tinted labels. */
export function Badge({ children, variant = "neutral" }: BadgeProps) {
  return <span className={`badge badge-${variant}`}>{children}</span>;
}
