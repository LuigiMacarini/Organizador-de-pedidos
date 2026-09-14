import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, fonts, space } from "../theme";

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
    fontSize: 12,
    fontFamily: fonts.bodySemiBold,
    color: colors.muted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  optional: {
    fontSize: 12,
    color: colors.muted,
    fontFamily: fonts.body,
  },
});
