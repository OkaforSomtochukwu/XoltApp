import type { ReactNode } from "react";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { tokens } from "@xolt/ui-tokens";

const { colors, spacing, radius, fontFamily, headingWeight, shadows } = tokens;

export type CardProps = {
  children: ReactNode;
  /** Elevation step — omit for a flat surface-filled card. */
  elevation?: "sm" | "md" | "lg";
  style?: StyleProp<ViewStyle>;
};

/** Modernist `.card` — a flush-left, zero-radius, surface-filled container. */
export function Card({ children, elevation, style }: CardProps) {
  return (
    <View style={[styles.card, elevation && shadowStyles[elevation], style]}>{children}</View>
  );
}

Card.Kicker = function CardKicker({ children }: { children: string }) {
  return <Text style={styles.kicker}>{children}</Text>;
};

Card.Title = function CardTitle({ children }: { children: string }) {
  return <Text style={styles.title}>{children}</Text>;
};

Card.Body = function CardBody({ children }: { children: string }) {
  return <Text style={styles.body}>{children}</Text>;
};

Card.Meta = function CardMeta({ icon, children }: { icon?: ReactNode; children: string }) {
  return (
    <View style={styles.meta}>
      {icon}
      <Text style={styles.metaLabel}>{children}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: "column",
    gap: spacing[2],
    padding: spacing[3],
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  kicker: {
    fontSize: 10,
    letterSpacing: 0.1 * 10,
    textTransform: "uppercase",
    color: colors.accent.base,
  },
  title: {
    fontFamily: fontFamily.heading,
    fontWeight: headingWeight,
    fontSize: 17,
    lineHeight: 17 * 1.2,
    color: colors.text,
  },
  body: {
    fontSize: 13,
    opacity: 0.8,
    color: colors.text,
  },
  meta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  metaLabel: {
    fontSize: 11,
    color: colors.text,
    opacity: 0.5,
  },
});

const shadowStyles = {
  sm: shadows.sm.rn,
  md: shadows.md.rn,
  lg: shadows.lg.rn,
};
