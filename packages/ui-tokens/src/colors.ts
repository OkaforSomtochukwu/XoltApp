// Modernist design system — color tokens.
// Source: Claude Design project "Modernist" (theme.json / styles.css).
// A near-mono red-on-white palette: one light ground, one accent, and three
// 100-900 tonal ramps generated in OKLCH on a shared perceptual lightness
// scale (accent2 is a mono-scheme stand-in — treat it as reading the same
// as accent).

export const base = {
  bg: "#f3f2f2",
  surface: "#eae9e9",
  text: "#201e1d",
  accent: "#ec3013",
  accent2: "#e15b47",
  /** color-mix(in srgb, #201e1d 40%, transparent) flattened to solid + alpha channel */
  divider: "rgba(32, 30, 29, 0.4)",
} as const;

export type Ramp = {
  100: string;
  200: string;
  300: string;
  400: string;
  500: string;
  600: string;
  700: string;
  800: string;
  900: string;
};

export const neutral: Ramp = {
  100: "#f8f4f4",
  200: "#eae7e7",
  300: "#d7d3d3",
  400: "#bab6b6",
  500: "#9b9797",
  600: "#7d7979",
  700: "#605d5d",
  800: "#444141",
  900: "#2d2b2b",
};

export const accent: Ramp = {
  100: "#fff2ef",
  200: "#ffe0d9",
  300: "#ffc4b8",
  400: "#ff9783",
  500: "#ff563c",
  600: "#dd2b0f",
  700: "#ae1800",
  800: "#7c1405",
  900: "#4d170e",
};

export const accent2: Ramp = {
  100: "#fff2ef",
  200: "#ffe0da",
  300: "#ffc4b9",
  400: "#ff9784",
  500: "#ef6853",
  600: "#c94b39",
  700: "#9e3526",
  800: "#71261b",
  900: "#471d16",
};

export const colors = {
  ...base,
  neutral,
  accent: { base: base.accent, ...accent },
  accent2: { base: base.accent2, ...accent2 },
} as const;
