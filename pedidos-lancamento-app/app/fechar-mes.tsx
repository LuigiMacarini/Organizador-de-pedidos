import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ApiError } from "../src/api/httpClient";
import { remoteGetMonthlyClosing } from "../src/api/reportsRemote";
import { PrimaryButton } from "../src/components/PrimaryButton";
import { getOrderTotal } from "../src/domain/order";
import { useOrders } from "../src/ordersContext";
import { colors, fonts, radii, space } from "../src/theme";
import { formatBRL } from "../src/utils/format";
import type { CustomerSummaryRow, MonthlyClosing } from "../src/types";

const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

/** "2026-09" — mesma convenção do backend (`domain/report.ts`), calculada aqui só pra navegação entre meses. */
function monthKeyOf(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function currentMonthKey(): string {
  return monthKeyOf(new Date());
}

function shiftMonthKey(key: string, delta: number): string {
  const [year, month] = key.split("-").map(Number);
  const d = new Date(year, month - 1 + delta, 1);
  return monthKeyOf(d);
}

function monthLabelOf(key: string): string {
  const [year, month] = key.split("-").map(Number);
  return `${MONTH_NAMES[month - 1]} ${year}`;
}

/** "2026-09" -> pertence esse pedido a esse mês? (mesma noção de "mês do pedido" já usada antes: `createdAt`). */
function orderBelongsToMonth(createdAt: number, monthKey: string): boolean {
  return monthKeyOf(new Date(createdAt)) === monthKey;
}

function formatVariation(pct: number | null): string {
  if (pct === null) return "—";
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(1)}%`;
}

type CustomerSort = "value" | "orders" | "name";

export default function FecharMesScreen() {
  const { orders: pendingOrders, archiveOrder } = useOrders();

  const [selectedMonth, setSelectedMonth] = useState(currentMonthKey);
  const [data, setData] = useState<MonthlyClosing | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (month: string) => {
    setLoading(true);
    setError(null);
    try {
      setData(await remoteGetMonthlyClosing(month));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Não foi possível carregar o fechamento.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(selectedMonth);
  }, [selectedMonth, load]);

  // --- Seleção de CLIENTES pro "Total a receber" — puramente local, nunca
  // chama nenhuma API de escrita. Trocar de mês (ou recarregar) reseta pra
  // "todos selecionados", que é o ponto de partida mais útil.
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<Set<string>>(new Set());
  const [customerSort, setCustomerSort] = useState<CustomerSort>("value");

  useEffect(() => {
    if (data) setSelectedCustomerIds(new Set(data.byCustomer.map((c) => c.customerId)));
  }, [data]);

  const toggleCustomer = (id: string) => {
    setSelectedCustomerIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const sortedCustomers = useMemo(() => {
    if (!data) return [];
    const rows = [...data.byCustomer];
    if (customerSort === "orders") return rows.sort((a, b) => b.orderCount - a.orderCount);
    if (customerSort === "name") return rows.sort((a, b) => a.customerName.localeCompare(b.customerName, "pt-BR"));
    return rows; // já vem ordenado por valor (desc) do backend
  }, [data, customerSort]);

  const totalToReceive = useMemo(() => {
    if (!data) return 0;
    return data.byCustomer
      .filter((c) => selectedCustomerIds.has(c.customerId))
      .reduce((sum, c) => sum + c.total, 0);
  }, [data, selectedCustomerIds]);

  // --- Arquivar pedidos PENDING do mês selecionado — mesma ação que já
  // existia, só que agora respeita o mês navegado em vez de fixar em "hoje".
  // Seleção aqui é 100% separada da seleção de clientes acima.
  const monthPendingOrders = useMemo(
    () => pendingOrders.filter((o) => orderBelongsToMonth(o.createdAt, selectedMonth)),
    [pendingOrders, selectedMonth]
  );
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [archiving, setArchiving] = useState(false);

  useEffect(() => {
    setSelectedOrderIds(new Set(monthPendingOrders.map((o) => o.id)));
  }, [monthPendingOrders]);

  const toggleOrder = (id: string) => {
    setSelectedOrderIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const archiveTotal = useMemo(
    () =>
      monthPendingOrders
        .filter((o) => selectedOrderIds.has(o.id))
        .reduce((sum, o) => sum + getOrderTotal(o.items), 0),
    [monthPendingOrders, selectedOrderIds]
  );

  const handleConfirmArchive = async () => {
    setArchiving(true);
    try {
      for (const id of selectedOrderIds) {
        await archiveOrder(id);
      }
      setConfirmOpen(false);
      // Fechamento consultado de novo — pedidos recém-arquivados continuam
      // contando no faturamento do mês (histórico não é apagado, ver §16).
      void load(selectedMonth);
    } finally {
      setArchiving(false);
    }
  };

  const canGoNext = selectedMonth < currentMonthKey();
  const isEmpty = !loading && !error && data !== null && data.summary.orderCount === 0;

  return (
    <SafeAreaView style={styles.safe} edges={["bottom", "left", "right"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.title}>Fechamento mensal</Text>
          <Text style={styles.subtitle}>
            Faturamento, clientes e produtos do mês — nada aqui altera pedido nenhum.
          </Text>
        </View>

        <View style={styles.monthNav}>
          <Pressable
            onPress={() => setSelectedMonth((m) => shiftMonthKey(m, -1))}
            style={styles.monthNavBtn}
            hitSlop={8}
          >
            <Ionicons name="chevron-back" size={18} color={colors.primary} />
            <Text style={styles.monthNavText} numberOfLines={1}>
              {monthLabelOf(shiftMonthKey(selectedMonth, -1))}
            </Text>
          </Pressable>
          <Text style={styles.monthCurrent} numberOfLines={1}>
            {monthLabelOf(selectedMonth).toUpperCase()}
          </Text>
          <Pressable
            onPress={() => canGoNext && setSelectedMonth((m) => shiftMonthKey(m, 1))}
            style={[styles.monthNavBtn, !canGoNext && styles.monthNavBtnDisabled]}
            hitSlop={8}
            disabled={!canGoNext}
          >
            <Text style={styles.monthNavText} numberOfLines={1}>
              {canGoNext ? monthLabelOf(shiftMonthKey(selectedMonth, 1)) : ""}
            </Text>
            {canGoNext ? <Ionicons name="chevron-forward" size={18} color={colors.primary} /> : null}
          </Pressable>
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator />
          </View>
        ) : error ? (
          <View style={styles.card}>
            <Text style={styles.empty}>{error}</Text>
            <PrimaryButton title="Tentar de novo" variant="ghost" onPress={() => void load(selectedMonth)} />
          </View>
        ) : isEmpty ? (
          <View style={styles.card}>
            <Text style={styles.empty}>Nenhum pedido registrado neste mês.</Text>
          </View>
        ) : data ? (
          <>
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Resumo do mês</Text>
              <View style={styles.statsGrid}>
                <View style={styles.statTile}>
                  <Text style={styles.statLabel}>Faturamento</Text>
                  <Text style={styles.statValue}>{formatBRL(data.summary.revenue)}</Text>
                </View>
                <View style={styles.statTile}>
                  <Text style={styles.statLabel}>Pedidos</Text>
                  <Text style={styles.statValue}>{data.summary.orderCount}</Text>
                </View>
                <View style={styles.statTile}>
                  <Text style={styles.statLabel}>Clientes</Text>
                  <Text style={styles.statValue}>{data.summary.customerCount}</Text>
                </View>
                <View style={styles.statTile}>
                  <Text style={styles.statLabel}>Produtos vendidos</Text>
                  <Text style={styles.statValue}>{data.summary.productUnits}</Text>
                </View>
                <View style={styles.statTile}>
                  <Text style={styles.statLabel}>Ticket médio</Text>
                  <Text style={styles.statValue}>
                    {data.summary.avgTicket === null ? "—" : formatBRL(data.summary.avgTicket)}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Comparação com o mês anterior</Text>
              {!data.comparison.previousSummary ? (
                <Text style={styles.empty}>Sem dados do mês anterior para comparar.</Text>
              ) : (
                <View style={styles.compareTable}>
                  <View style={styles.compareHeaderRow}>
                    <Text style={[styles.compareCell, styles.compareLabelCell]} />
                    <Text style={[styles.compareCell, styles.compareHeaderText]}>
                      {data.comparison.previousLabel}
                    </Text>
                    <Text style={[styles.compareCell, styles.compareHeaderText]}>{data.monthLabel}</Text>
                    <Text style={[styles.compareCell, styles.compareHeaderText]}>Variação</Text>
                  </View>
                  {(
                    [
                      { label: "Faturamento", prev: data.comparison.previousSummary.revenue, cur: data.summary.revenue, pct: data.comparison.variation.revenue, money: true },
                      { label: "Pedidos", prev: data.comparison.previousSummary.orderCount, cur: data.summary.orderCount, pct: data.comparison.variation.orderCount, money: false },
                      { label: "Clientes", prev: data.comparison.previousSummary.customerCount, cur: data.summary.customerCount, pct: data.comparison.variation.customerCount, money: false },
                      { label: "Produtos", prev: data.comparison.previousSummary.productUnits, cur: data.summary.productUnits, pct: data.comparison.variation.productUnits, money: false },
                    ] as const
                  ).map((row) => (
                    <View key={row.label} style={styles.compareRow}>
                      <Text style={[styles.compareCell, styles.compareLabelCell, styles.compareLabelText]}>
                        {row.label}
                      </Text>
                      <Text style={styles.compareCell}>{row.money ? formatBRL(row.prev) : row.prev}</Text>
                      <Text style={styles.compareCell}>{row.money ? formatBRL(row.cur) : row.cur}</Text>
                      <Text
                        style={[
                          styles.compareCell,
                          styles.compareVariation,
                          row.pct !== null && row.pct >= 0 ? styles.compareUp : styles.compareDown,
                        ]}
                      >
                        {formatVariation(row.pct)}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </View>

            <View style={styles.card}>
              <View style={styles.summaryHeaderRow}>
                <Text style={styles.sectionTitle}>Resumo por cliente</Text>
              </View>
              <View style={styles.sortRow}>
                {(
                  [
                    { key: "value", label: "Valor" },
                    { key: "orders", label: "Pedidos" },
                    { key: "name", label: "Nome" },
                  ] as { key: CustomerSort; label: string }[]
                ).map((opt) => {
                  const active = customerSort === opt.key;
                  return (
                    <Pressable
                      key={opt.key}
                      onPress={() => setCustomerSort(opt.key)}
                      style={[styles.sortPill, active && styles.sortPillActive]}
                    >
                      <Text style={[styles.sortPillText, active && styles.sortPillTextActive]}>{opt.label}</Text>
                    </Pressable>
                  );
                })}
              </View>

              {sortedCustomers.length === 0 ? (
                <Text style={styles.empty}>Nenhum cliente neste mês.</Text>
              ) : (
                sortedCustomers.map((c: CustomerSummaryRow) => {
                  const checked = selectedCustomerIds.has(c.customerId);
                  return (
                    <Pressable
                      key={c.customerId}
                      onPress={() => toggleCustomer(c.customerId)}
                      style={({ pressed }) => [styles.customerRow, pressed && { opacity: 0.85 }]}
                    >
                      <Ionicons
                        name={checked ? "checkbox" : "square-outline"}
                        size={22}
                        color={checked ? colors.primary : colors.muted}
                      />
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={styles.customerName} numberOfLines={1}>
                          {c.customerName}
                        </Text>
                        <Text style={styles.customerMeta}>
                          {c.orderCount} {c.orderCount === 1 ? "pedido" : "pedidos"}
                        </Text>
                      </View>
                      <Text style={styles.customerTotal}>{formatBRL(c.total)}</Text>
                    </Pressable>
                  );
                })
              )}

              <View style={styles.receiveBox}>
                <View>
                  <Text style={styles.receiveLabel}>Total a receber</Text>
                  <Text style={styles.receiveMeta}>
                    {selectedCustomerIds.size} de {data.byCustomer.length} clientes selecionados
                  </Text>
                </View>
                <Text style={styles.receiveValue}>{formatBRL(totalToReceive)}</Text>
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Produtos mais vendidos</Text>
              {data.byProduct.length === 0 ? (
                <Text style={styles.empty}>Nenhum produto vendido neste mês.</Text>
              ) : (
                data.byProduct.map((p, i) => (
                  <View key={p.productId} style={styles.productRow}>
                    <Text style={styles.productRank}>{i + 1}.</Text>
                    <Text style={styles.productName} numberOfLines={1}>
                      {p.productName}
                    </Text>
                    <View style={{ alignItems: "flex-end" }}>
                      <Text style={styles.productUnits}>{p.unitsSold} un.</Text>
                      <Text style={styles.productRevenue}>{formatBRL(p.revenue)}</Text>
                    </View>
                  </View>
                ))
              )}
            </View>
          </>
        ) : null}

        {!loading && !error && data && data.availableMonths.length > 0 ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Histórico de meses</Text>
            {data.availableMonths.map((m) => (
              <Pressable
                key={m}
                onPress={() => setSelectedMonth(m)}
                style={[styles.historyRow, m === selectedMonth && styles.historyRowActive]}
              >
                <Text style={[styles.historyText, m === selectedMonth && styles.historyTextActive]}>
                  {monthLabelOf(m)}
                </Text>
                {m === selectedMonth ? <Ionicons name="checkmark" size={18} color={colors.primary} /> : null}
              </Pressable>
            ))}
          </View>
        ) : null}

        {!loading && !error && monthPendingOrders.length > 0 ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Arquivar pedidos pendentes deste mês</Text>
            <Text style={styles.archiveHint}>
              Eles saem da lista ativa mas continuam no histórico do fechamento — nada é apagado.
            </Text>
            {monthPendingOrders.map((o) => {
              const checked = selectedOrderIds.has(o.id);
              return (
                <Pressable
                  key={o.id}
                  onPress={() => toggleOrder(o.id)}
                  style={({ pressed }) => [styles.orderRow, pressed && { opacity: 0.85 }]}
                >
                  <Ionicons
                    name={checked ? "checkbox" : "square-outline"}
                    size={22}
                    color={checked ? colors.primary : colors.muted}
                  />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.orderName} numberOfLines={1}>
                      {o.customerName}
                    </Text>
                    <Text style={styles.orderMeta}>
                      {new Date(o.createdAt).toLocaleDateString("pt-BR")} · {formatBRL(getOrderTotal(o.items))}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
            <PrimaryButton
              title={`Arquivar ${selectedOrderIds.size} ${selectedOrderIds.size === 1 ? "pedido" : "pedidos"}`}
              variant="danger"
              onPress={() => setConfirmOpen(true)}
              disabled={selectedOrderIds.size === 0 || archiving}
              style={{ marginTop: space.sm }}
            />
          </View>
        ) : null}
      </ScrollView>

      <Modal visible={confirmOpen} transparent animationType="fade" onRequestClose={() => setConfirmOpen(false)}>
        <View style={styles.backdrop}>
          <View style={styles.dialog}>
            <Text style={styles.dialogTitle}>Confirmar arquivamento</Text>
            <Text style={styles.dialogText}>
              {selectedOrderIds.size} {selectedOrderIds.size === 1 ? "pedido sai" : "pedidos saem"} da lista
              ativa ({formatBRL(archiveTotal)}). Continuam no histórico do fechamento.
            </Text>
            <View style={styles.dialogActions}>
              <PrimaryButton
                title="Cancelar"
                variant="ghost"
                onPress={() => setConfirmOpen(false)}
                disabled={archiving}
                style={styles.dialogBtn}
              />
              <PrimaryButton
                title="Arquivar"
                variant="danger"
                onPress={() => void handleConfirmArchive()}
                loading={archiving}
                disabled={archiving}
                style={styles.dialogBtn}
              />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: {
    padding: space.lg,
    paddingBottom: space.xl * 2,
    gap: space.md,
    maxWidth: 720,
    width: "100%",
    alignSelf: "center",
  },
  center: { paddingVertical: space.xl * 2, alignItems: "center" },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: space.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: space.sm,
  },
  title: { fontFamily: fonts.display, fontSize: 22, color: colors.text },
  subtitle: { color: colors.muted, fontSize: 14, lineHeight: 20, fontFamily: fonts.body },
  empty: { color: colors.muted, fontSize: 14, paddingVertical: space.sm, fontFamily: fonts.body },
  sectionTitle: {
    fontSize: 13,
    fontFamily: fonts.bodyBold,
    color: colors.text,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },

  monthNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: space.sm,
    paddingVertical: space.sm,
  },
  monthNavBtn: { flexDirection: "row", alignItems: "center", gap: 4, flexShrink: 1, minWidth: 0 },
  monthNavBtnDisabled: { opacity: 0.3 },
  monthNavText: { color: colors.primary, fontFamily: fonts.bodySemiBold, fontSize: 13 },
  monthCurrent: {
    fontFamily: fonts.displayBlack,
    fontSize: 18,
    color: colors.text,
    letterSpacing: 0.3,
    marginHorizontal: space.xs,
  },

  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: space.md },
  statTile: { minWidth: "28%", gap: 2 },
  statLabel: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 11,
    color: colors.muted,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  statValue: { fontFamily: fonts.display, fontSize: 18, color: colors.text },

  compareTable: { gap: 2 },
  compareHeaderRow: { flexDirection: "row", paddingBottom: space.xs, borderBottomWidth: 1, borderBottomColor: colors.border },
  compareRow: { flexDirection: "row", paddingVertical: space.xs, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  compareCell: { flex: 1, fontSize: 13, color: colors.text, fontFamily: fonts.body, textAlign: "right" },
  compareLabelCell: { flex: 1.3, textAlign: "left" },
  compareLabelText: { fontFamily: fonts.bodySemiBold },
  compareHeaderText: { fontFamily: fonts.bodySemiBold, color: colors.muted, fontSize: 11, textTransform: "uppercase" },
  compareVariation: { fontFamily: fonts.bodyBold },
  compareUp: { color: colors.primary },
  compareDown: { color: colors.danger },

  summaryHeaderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sortRow: { flexDirection: "row", flexWrap: "wrap", gap: space.xs },
  sortPill: {
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
  },
  sortPillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  sortPillText: { fontSize: 12, fontFamily: fonts.bodySemiBold, color: colors.text, textTransform: "uppercase" },
  sortPillTextActive: { color: "#fff" },

  customerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingVertical: space.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  customerName: { fontSize: 15, fontFamily: fonts.bodySemiBold, color: colors.text },
  customerMeta: { marginTop: 2, fontSize: 12, color: colors.muted, fontFamily: fonts.body },
  customerTotal: { fontSize: 14, fontFamily: fonts.bodyBold, color: colors.text },

  receiveBox: {
    marginTop: space.sm,
    paddingTop: space.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  receiveLabel: { fontSize: 15, fontFamily: fonts.bodyBold, color: colors.text },
  receiveMeta: { fontSize: 12, color: colors.muted, marginTop: 2, fontFamily: fonts.body },
  receiveValue: { fontSize: 20, fontFamily: fonts.displayBlack, color: colors.primary },

  productRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    paddingVertical: space.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  productRank: { fontFamily: fonts.bodyBold, color: colors.muted, fontSize: 13, width: 20 },
  productName: { flex: 1, fontSize: 14, fontFamily: fonts.bodySemiBold, color: colors.text },
  productUnits: { fontSize: 13, fontFamily: fonts.bodyBold, color: colors.text },
  productRevenue: { fontSize: 12, color: colors.muted, fontFamily: fonts.body, marginTop: 1 },

  historyRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: space.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  historyRowActive: {},
  historyText: { fontSize: 14, fontFamily: fonts.body, color: colors.text },
  historyTextActive: { fontFamily: fonts.bodyBold, color: colors.primary },

  archiveHint: { color: colors.muted, fontSize: 13, lineHeight: 18, fontFamily: fonts.body },
  orderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingVertical: space.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  orderName: { fontSize: 15, fontFamily: fonts.bodySemiBold, color: colors.text },
  orderMeta: { marginTop: 2, fontSize: 13, color: colors.muted, fontFamily: fonts.body },

  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.45)",
    alignItems: "center",
    justifyContent: "center",
    padding: space.lg,
  },
  dialog: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: space.lg,
    width: "100%",
    maxWidth: 420,
    gap: space.sm,
  },
  dialogTitle: { fontSize: 18, fontFamily: fonts.display, color: colors.text },
  dialogText: { color: colors.muted, fontSize: 14, lineHeight: 20, fontFamily: fonts.body },
  dialogActions: { flexDirection: "row", gap: space.sm, marginTop: space.md },
  dialogBtn: { flex: 1 },
});
