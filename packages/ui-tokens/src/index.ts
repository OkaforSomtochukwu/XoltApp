// @xolt/ui-tokens — single source of truth for the Modernist design system
// (Claude Design project "Modernist"). Plain TS objects, no Tailwind config:
// neither mobile app uses NativeWind and the source system is plain CSS
// custom properties, so token consumers (React Native StyleSheets, web
// inline/CSS-variable styles) both read directly from these exports.

export * from "./colors";
export * from "./typography";
export * from "./spacing";
export * from "./radius";
export * from "./shadows";
export * from "./css";

import { colors } from "./colors";
import { fontFamily, fontWeight, headingWeight, type } from "./typography";
import { spacing } from "./spacing";
import { radius } from "./radius";
import { shadows } from "./shadows";

export const tokens = {
  colors,
  fontFamily,
  fontWeight,
  headingWeight,
  type,
  spacing,
  radius,
  shadows,
} as const;

export default tokens;
