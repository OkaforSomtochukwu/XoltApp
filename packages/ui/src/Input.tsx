import { forwardRef, useState } from "react";
import { StyleSheet, Text, TextInput, type TextInputProps, View } from "react-native";
import { tokens } from "@xolt/ui-tokens";

const { colors, radius } = tokens;

export type InputProps = TextInputProps & {
  label?: string;
};

/** Modernist `.field` + `.input` — label above, accent focus border, no fills change on hover (mobile has no hover). */
export const Input = forwardRef<TextInput, InputProps>(function Input(
  { label, style, multiline, onFocus, onBlur, editable, ...rest },
  ref,
) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.field}>
      {label && <Text style={styles.label}>{label}</Text>}
      <TextInput
        ref={ref}
        multiline={multiline}
        editable={editable}
        cursorColor={colors.accent.base}
        selectionColor={colors.accent.base}
        placeholderTextColor={`rgba(32, 30, 29, 0.55)`}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        style={[
          styles.input,
          multiline && styles.multiline,
          focused && styles.focused,
          editable === false && styles.disabled,
          style,
        ]}
        {...rest}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  field: {
    gap: 5,
  },
  label: {
    fontSize: 12,
    color: colors.text,
    opacity: 0.7,
  },
  input: {
    minHeight: 36,
    paddingVertical: 6,
    paddingHorizontal: 10,
    fontSize: 14,
    color: colors.text,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: radius.md,
  },
  multiline: {
    minHeight: 90,
    textAlignVertical: "top",
  },
  focused: {
    borderColor: colors.accent.base,
  },
  disabled: {
    opacity: 0.45,
  },
});
