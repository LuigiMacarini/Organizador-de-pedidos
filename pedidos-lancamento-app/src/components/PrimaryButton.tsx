import React from "react";
import {
  ActivityIndicator,
  GestureResponderEvent,
  Pressable,
  StyleSheet,
  Text,
  ViewStyle,
} from "react-native";
import { colors, fonts, radii, space } from "../theme";

type Props = {
  title: string;
  onPress: (e: GestureResponderEvent) => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: "primary" | "ghost" | "danger";
  style?: ViewStyle;
};

export function PrimaryButton({
  title,
  onPress,
  disabled,
  loading,
  variant = "primary",
  style,
}: Props) {
  const isPrimary = variant === "primary";
  const isDanger = variant === "danger";

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
        isPrimary && styles.primary,
        variant === "ghost" && styles.ghost,
        isDanger && styles.danger,
        (disabled || loading) && styles.disabled,
        pressed && !disabled && !loading && styles.pressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={isPrimary || isDanger ? "#fff" : colors.primary} />
      ) : (
        <Text
          style={[
            styles.label,
            isPrimary && styles.labelOnPrimary,
            variant === "ghost" && styles.labelGhost,
            isDanger && styles.labelOnPrimary,
          ]}
        >
          {title}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 48,
    paddingHorizontal: space.lg,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
  },
  primary: {
    backgroundColor: colors.primary,
  },
  ghost: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  danger: {
    backgroundColor: colors.danger,
  },
  disabled: {
    opacity: 0.55,
  },
  pressed: {
    transform: [{ scale: 0.98 }],
  },
  label: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 15,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  labelOnPrimary: {
    color: "#FFFFFF",
  },
  labelGhost: {
    color: colors.text,
  },
});
