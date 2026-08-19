import { StyleSheet, Text, View } from "react-native";
import { tokens } from "@xolt/ui-tokens";

const { colors, radius } = tokens;

export type BadgeVariant = "accent" | "accent2" | "neutral" | "outline";

export type BadgeProps = {
  children: string;
  variant?: BadgeVariant;
};

/** Modernist `.tag` — small tinted labels. */
export function Badge({ children, variant = "neutral" }: BadgeProps) {
  return (
    <View style={[styles.base, variantStyles[variant].base]}>
      <Text style={[styles.label, variantStyles[variant].label]} numberOfLines={1}>
        {children}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingVertical: 3,
    paddingHorizontal: 10,
    borderRadius: radius.md * 0.75,
  },
  label: {
    fontSize: 11,
    letterSpacing: 0.02 * 11,
  },
});

const variantStyles: Record<BadgeVariant, { base: object; label: object }> = {
  accent: {
    base: { backgroundColor: colors.accent[100] },
    label: { color: colors.accent[800] },
  },
  accent2: {
    base: { backgroundColor: colors.accent2[100] },
    label: { color: colors.accent2[800] },
  },
  neutral: {
    base: { backgroundColor: colors.neutral[100] },
    label: { color: colors.neutral[800] },
  },
  outline: {
    base: { backgroundColor: "transparent", borderWidth: 1, borderColor: colors.accent.base },
    label: { color: colors.accent.base },
  },
};
