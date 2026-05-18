import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radii, space } from "../theme";

export type AccordionProps = {
  title: string;
  subtitle?: string;
  expanded: boolean;
  onToggle: () => void;
  children?: React.ReactNode;
  /** “embed”: cabeçalho mais leve, para dentro do card de resumo verde */
  variant?: "default" | "embed";
};

export function Accordion({
  title,
  subtitle,
  expanded,
  onToggle,
  children,
  variant = "default",
}: AccordionProps) {
  return (
    <View style={[styles.wrap, variant === "embed" && styles.wrapEmbed]}>
      <Pressable
        onPress={onToggle}
        style={({ pressed }) => [
          styles.header,
          variant === "embed" && styles.headerEmbed,
          pressed && styles.headerPressed,
        ]}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
      >
        <View style={styles.headerTexts}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? (
            <Text style={styles.subtitle} numberOfLines={2}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        <Ionicons
          name={expanded ? "chevron-up" : "chevron-down"}
          size={22}
          color={colors.muted}
        />
      </Pressable>
      {expanded ? <View style={styles.body}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    overflow: "hidden",
    marginBottom: space.sm,
  },
  wrapEmbed: {
    borderWidth: 0,
    marginBottom: 0,
    borderRadius: radii.sm,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    backgroundColor: "#F3F4F6",
    gap: space.md,
  },
  headerEmbed: {
    backgroundColor: "rgba(255, 255, 255, 0.55)",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#BBF7D0",
  },
  headerPressed: { opacity: 0.92 },
  headerTexts: { flex: 1, minWidth: 0 },
  title: {
    fontSize: 15,
    fontWeight: "800",
    color: colors.text,
  },
  subtitle: {
    marginTop: 2,
    fontSize: 12,
    color: colors.muted,
    lineHeight: 16,
  },
  body: {
    paddingHorizontal: space.sm,
    paddingTop: space.xs,
    paddingBottom: space.sm,
  },
});
