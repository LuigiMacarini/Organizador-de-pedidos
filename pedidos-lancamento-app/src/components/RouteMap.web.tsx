import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { colors, radii, space } from "../theme";
import type { MapStop, RouteMapProps } from "./RouteMap.types";

export type { MapStop };

const STATUS_LABEL: Record<MapStop["status"], string> = {
  PENDING: "Aguardando",
  DELIVERED: "Entregue",
  FAILED: "Não entregue",
};

/**
 * react-native-maps é nativo-only (quebra o bundle web ao ser importado).
 * Como essa tela é essencialmente uma atividade de campo — GPS, marcar
 * entrega/falha — não faz sentido reimplementar um mapa completo (Google
 * Maps JavaScript API, outra chave, outro produto) só para a versão web.
 * Aqui mostramos a mesma informação em lista, sem quebrar a build web.
 */
export function RouteMap({ origin, stops, nextStopId, height = 320 }: RouteMapProps) {
  return (
    <View style={[styles.wrap, { height }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.hint}>Mapa disponível no app mobile. Aqui vai a lista da rota:</Text>
        <Text style={styles.originText}>{"\u{1F3E0}"} {origin.label}</Text>
        {stops.map((s) => (
          <View key={s.id} style={[styles.stopRow, s.id === nextStopId && styles.stopRowNext]}>
            <Text style={styles.stopSequence}>{s.sequence}.</Text>
            <Text style={styles.stopName}>{s.customerName}</Text>
            <Text style={styles.stopStatus}>{STATUS_LABEL[s.status]}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: radii.md,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  content: { padding: space.md, gap: space.sm },
  hint: { fontSize: 12, color: colors.muted, marginBottom: space.xs },
  originText: { fontSize: 14, fontWeight: "700", color: colors.text, marginBottom: space.xs },
  stopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    paddingVertical: space.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  stopRowNext: { backgroundColor: colors.bg },
  stopSequence: { fontWeight: "800", color: colors.text, width: 20 },
  stopName: { flex: 1, color: colors.text, fontSize: 14 },
  stopStatus: { color: colors.muted, fontSize: 12, fontWeight: "600" },
});
