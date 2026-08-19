import { colors } from "./colors";
import { fontFamily, headingWeight } from "./typography";
import { spacing } from "./spacing";
import { radius } from "./radius";
import { shadows } from "./shadows";

/**
 * Renders every token as a CSS custom property, so a web app can inject one
 * `:root { ... }` block and every component stylesheet stays token-driven
 * (`var(--color-accent)`, `var(--space-4)`, ...) instead of duplicating hex
 * values — this is the same approach the Modernist system's own
 * styles.css uses.
 */
export function tokensToCssVariables(): string {
  const lines: string[] = [];

  lines.push(`--color-bg: ${colors.bg};`);
  lines.push(`--color-surface: ${colors.surface};`);
  lines.push(`--color-text: ${colors.text};`);
  lines.push(`--color-divider: ${colors.divider};`);
  lines.push(`--color-accent: ${colors.accent.base};`);
  lines.push(`--color-accent-2: ${colors.accent2.base};`);

  for (const step of [100, 200, 300, 400, 500, 600, 700, 800, 900] as const) {
    lines.push(`--color-neutral-${step}: ${colors.neutral[step]};`);
    lines.push(`--color-accent-${step}: ${colors.accent[step]};`);
    lines.push(`--color-accent-2-${step}: ${colors.accent2[step]};`);
  }

  lines.push(`--font-heading: "${fontFamily.heading}", system-ui, sans-serif;`);
  lines.push(`--font-heading-weight: ${headingWeight};`);
  lines.push(`--font-body: "${fontFamily.body}", system-ui, sans-serif;`);

  for (const [key, value] of Object.entries(spacing)) {
    lines.push(`--space-${key}: ${value}px;`);
  }

  lines.push(`--radius-sm: ${radius.sm}px;`);
  lines.push(`--radius-md: ${radius.md}px;`);
  lines.push(`--radius-lg: ${radius.lg}px;`);

  lines.push(`--shadow-sm: ${shadows.sm.css};`);
  lines.push(`--shadow-md: ${shadows.md.css};`);
  lines.push(`--shadow-lg: ${shadows.lg.css};`);

  return lines.join("\n  ");
}
