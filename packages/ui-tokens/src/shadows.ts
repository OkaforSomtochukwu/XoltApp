// Elevation, derived from the ground: soft ink-tinted shadows
// (color-mix(in srgb, #2d2b2b <alpha>%, transparent) flattened to rgba).
// Web: use `shadow.css` directly as a CSS `box-shadow` value.
// React Native: use `shadow.rn`, and also set elevation on Android.

export type ShadowToken = {
  css: string;
  rn: {
    shadowColor: string;
    shadowOffset: { width: number; height: number };
    shadowOpacity: number;
    shadowRadius: number;
    elevation: number;
  };
};

export const shadows: { sm: ShadowToken; md: ShadowToken; lg: ShadowToken } = {
  sm: {
    css: "0 1px 2px rgba(45, 43, 43, 0.14)",
    rn: {
      shadowColor: "#2d2b2b",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.14,
      shadowRadius: 2,
      elevation: 1,
    },
  },
  md: {
    css: "0 3px 10px rgba(45, 43, 43, 0.16)",
    rn: {
      shadowColor: "#2d2b2b",
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.16,
      shadowRadius: 10,
      elevation: 4,
    },
  },
  lg: {
    css: "0 12px 32px rgba(45, 43, 43, 0.22)",
    rn: {
      shadowColor: "#2d2b2b",
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.22,
      shadowRadius: 32,
      elevation: 12,
    },
  },
};
