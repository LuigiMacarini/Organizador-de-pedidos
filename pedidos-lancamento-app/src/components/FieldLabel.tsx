import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, space } from "../theme";

export function FieldLabel({
  children,
  optional,
}: {
  children: string;
  optional?: boolean;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{children}</Text>
      {optional ? <Text style={styles.optional}>opcional</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: space.xs,
    marginBottom: space.xs,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text,
  },
  optional: {
    fontSize: 12,
    color: colors.muted,
  },
});
