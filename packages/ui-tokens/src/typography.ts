// Modernist design system — type tokens. Archivo throughout; headings are
// weight 800, body text is weight 400. Sizes are px (React Native and web
// both take unitless numbers = px for fontSize).

export const fontFamily = {
  heading: "Archivo",
  body: "Archivo",
} as const;

export const fontWeight = {
  regular: "400",
  semibold: "600",
  bold: "800",
} as const;

export const headingWeight = fontWeight.bold;

/** h1 → h6 plus the body/caption sizes, matching styles.css exactly. */
export const type = {
  h1: { fontSize: 42, lineHeight: 1.12, letterSpacing: -0.015 * 42 },
  h2: { fontSize: 32, lineHeight: 1.12, letterSpacing: -0.015 * 32 },
  h3: { fontSize: 25, lineHeight: 1.12, letterSpacing: -0.015 * 25 },
  h4: { fontSize: 20, lineHeight: 1.12, letterSpacing: -0.015 * 20 },
  h5: { fontSize: 16, lineHeight: 1.12, letterSpacing: -0.015 * 16 },
  /** Uppercase + wide tracking, unlike h1-h5. */
  h6: { fontSize: 13, lineHeight: 1.12, letterSpacing: 0.08 * 13, uppercase: true },
  body: { fontSize: 15, lineHeight: 1.55 },
  caption: { fontSize: 11, lineHeight: 1.4 },
} as const;
