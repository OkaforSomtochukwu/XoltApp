import type { ReactNode } from "react";
import { ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";
import { tokens } from "@xolt/ui-tokens";

const { colors, spacing } = tokens;

export type ScreenProps = {
  children: ReactNode;
  /** Wraps content in a ScrollView — off by default for screens that manage their own scrolling. */
  scroll?: boolean;
  edges?: Edge[];
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
};

/** The Modernist ground (`--color-bg`) behind every screen, with the standard horizontal gutter. */
export function Screen({
  children,
  scroll = false,
  edges = ["top", "bottom", "left", "right"],
  style,
  contentContainerStyle,
}: ScreenProps) {
  return (
    <SafeAreaView edges={edges} style={[styles.root, style]}>
      {scroll ? (
        <ScrollView contentContainerStyle={[styles.content, contentContainerStyle]}>
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.content, contentContainerStyle]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing[4],
  },
});
