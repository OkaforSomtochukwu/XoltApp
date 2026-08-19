import { forwardRef } from "react";
import {
  Pressable,
  type PressableProps,
  StyleSheet,
  Text,
  type StyleProp,
  type ViewStyle,
  View,
} from "react-native";
import { tokens } from "@xolt/ui-tokens";

export type ButtonVariant = "primary" | "secondary" | "ghost";

export type ButtonProps = Omit<PressableProps, "children" | "style"> & {
  children: string;
  variant?: ButtonVariant;
  /** 36x36 icon-only button — pass `accessibilityLabel` instead of visible text. */
  icon?: boolean;
  /** Full width, label flush left (matches .btn-block — never centered). */
  block?: boolean;
  leadingIcon?: React.ReactNode;
  trailingIcon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

const { colors, spacing, radius, fontFamily, headingWeight } = tokens;

/** Modernist `.btn` — labels sit flush left, never centered, even in `.btn-block`. */
export const Button = forwardRef<View, ButtonProps>(function Button(
  { children, variant = "primary", icon = false, block = false, leadingIcon, trailingIcon, style, disabled, ...rest },
  ref,
) {
  return (
    <Pressable
      ref={ref}
      disabled={disabled}
      style={(state) => [
        styles.base,
        variantStyles[variant].base,
        icon && styles.icon,
        block && styles.block,
        state.pressed && !disabled && variantStyles[variant].pressed,
        disabled && styles.disabled,
        style,
      ]}
      {...rest}
    >
      {leadingIcon}
      <Text style={[styles.label, variantStyles[variant].label]} numberOfLines={1}>
        {children}
      </Text>
      {trailingIcon}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  base: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: "transparent",
    borderRadius: radius.md,
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[3] * 1.2,
  },
  label: {
    fontFamily: fontFamily.heading,
    fontWeight: headingWeight,
    fontSize: 14,
    lineHeight: 14 * 1.2,
    color: colors.text,
  },
  icon: {
    width: 36,
    height: 36,
    padding: 0,
  },
  block: {
    width: "100%",
    marginTop: spacing[2],
    justifyContent: "flex-start",
  },
  disabled: {
    opacity: 0.45,
  },
});

const variantStyles: Record<
  ButtonVariant,
  { base: object; pressed: object; label: object }
> = {
  primary: {
    base: { backgroundColor: colors.accent.base },
    pressed: { backgroundColor: colors.accent[700] },
    label: { color: colors.bg },
  },
  secondary: {
    base: { borderColor: colors.divider },
    pressed: { backgroundColor: `rgba(32, 30, 29, 0.14)` },
    label: {},
  },
  ghost: {
    base: { paddingHorizontal: spacing[1] },
    pressed: { backgroundColor: `rgba(236, 48, 19, 0.18)` },
    label: { color: colors.accent.base },
  },
};
