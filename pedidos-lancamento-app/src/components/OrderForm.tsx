import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import type { LineItem, Order, Product } from "../types";
import { useProducts } from "../productsContext";
import { colors, radii, space } from "../theme";
import { CustomerSelect } from "./CustomerSelect";
import { FieldLabel } from "./FieldLabel";
import { PrimaryButton } from "./PrimaryButton";
import { SearchBar } from "./SearchBar";
import { OrderSummary } from "./order-form/OrderSummary";
import { ProductRow } from "./order-form/ProductRow";

type Props = {
  initial?: Partial<Pick<Order, "customerId" | "customerName" | "items" | "notes">>;
  submitLabel: string;
  onSubmit: (payload: {
    customerId: string;
    customerName: string;
    items: LineItem[];
    notes: string;
  }) => Promise<void> | void;
  /** Arquiva (não apaga) — mantém o pedido no histórico. */
  onArchive?: () => Promise<void> | void;
  busy?: boolean;
};

const MAX_QTY = 1_000_000;

export function OrderForm({ initial, submitLabel, onSubmit, onArchive, busy }: Props) {
  const { loading: loadingProducts, searchSections } = useProducts();
  const [customerId, setCustomerId] = useState<string | undefined>(initial?.customerId);
  const [customerName, setCustomerName] = useState(initial?.customerName ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<LineItem[]>(initial?.items ?? []);

  const qtyByProduct = useMemo(() => {
    const map = new Map<string, number>();
    for (const l of items) map.set(l.productId, l.qty);
    return map;
  }, [items]);

  const sections = useMemo(
    () =>
      searchSections(query).map((sec) => ({ title: sec.category, data: sec.products })),
    [searchSections, query]
  );

  const adjustProductQty = useCallback((p: Product, delta: number) => {
    if (delta === 0) return;
    setItems((prev) => {
      const idx = prev.findIndex((l) => l.productId === p.id);
      if (idx < 0) {
        if (delta < 0) return prev;
        return [...prev, { productId: p.id, name: p.name, unitPrice: p.unitPrice, qty: delta }];
      }
      const nextQty = prev[idx].qty + delta;
      if (nextQty <= 0) return prev.filter((l) => l.productId !== p.id);
      const copy = [...prev];
      copy[idx] = { ...copy[idx], qty: nextQty };
      return copy;
    });
  }, []);

  const setProductQtyAbsolute = useCallback((p: Product, raw: number) => {
    const q = Math.max(0, Math.min(MAX_QTY, Math.floor(Math.abs(raw)) || 0));
    setItems((prev) => {
      if (q === 0) return prev.filter((l) => l.productId !== p.id);
      const idx = prev.findIndex((l) => l.productId === p.id);
      if (idx < 0) {
        return [...prev, { productId: p.id, name: p.name, unitPrice: p.unitPrice, qty: q }];
      }
      const copy = [...prev];
      copy[idx] = { ...copy[idx], qty: q };
      return copy;
    });
  }, []);

  const handleSubmit = useCallback(async () => {
    const name = customerName.trim();
    if (!customerId || !name) {
      Alert.alert("Cliente", "Selecione um cliente para o pedido.");
      return;
    }
    if (items.length === 0) {
      Alert.alert("Produtos", "Adicione ao menos um produto ao pedido.");
      return;
    }
    await onSubmit({ customerId, customerName: name, items, notes: notes.trim() });
  }, [customerId, customerName, items, notes, onSubmit]);

  const handleArchive = useCallback(() => {
    if (!onArchive) return;
    const run = async () => {
      await onArchive();
    };
    if (Platform.OS === "web") {
      const ok = typeof window !== "undefined" && window.confirm("Arquivar este pedido?");
      if (ok) void run();
      return;
    }
    Alert.alert("Arquivar pedido", "O pedido sai da lista ativa, mas fica no histórico.", [
      { text: "Cancelar", style: "cancel" },
      { text: "Arquivar", style: "destructive", onPress: () => void run() },
    ]);
  }, [onArchive]);

  const header = (
    <View style={styles.headerBlock}>
      <View style={styles.card}>
        <FieldLabel>Cliente</FieldLabel>
        <CustomerSelect
          customerId={customerId}
          customerName={customerName}
          onSelect={({ id, name }) => {
            setCustomerId(id);
            setCustomerName(name);
          }}
        />
      </View>

      <View style={styles.searchBlock}>
        <SearchBar
          value={query}
          onChangeText={setQuery}
          placeholder="Nome do produto ou código (ex: p12)"
        />
        {loadingProducts ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" />
            <Text style={styles.loadingText}>Carregando catálogo…</Text>
          </View>
        ) : null}
      </View>
    </View>
  );

  const footer = (
    <View style={styles.footerBlock}>
      <View style={styles.card}>
        <FieldLabel optional>Observações</FieldLabel>
        <TextInput
          value={notes}
          onChangeText={setNotes}
          placeholder="Instruções de entrega, tamanhos, etc."
          placeholderTextColor={colors.muted}
          style={[styles.input, styles.textarea]}
          multiline
        />
      </View>

      <OrderSummary customerName={customerName} items={items} />

      <PrimaryButton
        title={submitLabel}
        onPress={() => void handleSubmit()}
        loading={busy}
        disabled={busy}
        style={styles.submitButton}
      />

      {onArchive ? (
        <PrimaryButton
          title="Arquivar pedido"
          variant="ghost"
          onPress={handleArchive}
          disabled={busy}
          style={{ marginTop: space.sm }}
        />
      ) : null}
    </View>
  );

  return (
    <SectionList
      style={styles.list}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      stickySectionHeadersEnabled
      sections={sections}
      keyExtractor={(item) => item.id}
      ListHeaderComponent={header}
      ListFooterComponent={footer}
      ListEmptyComponent={
        <Text style={styles.noResults}>Nenhum produto encontrado para esta busca.</Text>
      }
      renderSectionHeader={({ section }) => (
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{section.title}</Text>
          <Text style={styles.sectionCount}>{section.data.length}</Text>
        </View>
      )}
      renderItem={({ item }) => (
        <ProductRow
          product={item}
          qty={qtyByProduct.get(item.id) ?? 0}
          onAdjust={adjustProductQty}
          onSetQty={setProductQtyAbsolute}
        />
      )}
    />
  );
}

const styles = StyleSheet.create({
  list: { flex: 1, backgroundColor: colors.bg },
  content: { paddingBottom: space.xl * 2 },
  headerBlock: {
    padding: space.lg,
    paddingBottom: 0,
    gap: space.md,
    maxWidth: 720,
    width: "100%",
    alignSelf: "center",
  },
  footerBlock: {
    padding: space.lg,
    paddingTop: space.md,
    gap: space.md,
    maxWidth: 720,
    width: "100%",
    alignSelf: "center",
  },
  searchBlock: { gap: space.xs },
  loadingRow: { flexDirection: "row", alignItems: "center", gap: space.xs, paddingTop: space.xs },
  loadingText: { color: colors.muted, fontSize: 13 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: space.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  textarea: { minHeight: 96, textAlignVertical: "top" },
  noResults: {
    fontSize: 14,
    color: colors.muted,
    paddingVertical: space.lg,
    textAlign: "center",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    paddingHorizontal: space.lg,
    paddingVertical: space.xs,
    backgroundColor: colors.bg,
    maxWidth: 720,
    width: "100%",
    alignSelf: "center",
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: colors.muted,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  sectionCount: { fontSize: 12, color: colors.muted },
  submitButton: { marginTop: space.xs },
});
