import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import type { Customer, LineItem, Order, Product } from "../types";
import { useCustomers } from "../customersContext";
import { useProducts } from "../productsContext";
import { colors, fonts, radii, space } from "../theme";
import { CustomerSelect } from "./CustomerSelect";
import { FieldLabel } from "./FieldLabel";
import { PrimaryButton } from "./PrimaryButton";
import { SearchBar } from "./SearchBar";
import { OrderSummary } from "./order-form/OrderSummary";
import { ProductRow } from "./order-form/ProductRow";
import { formatBRL } from "../utils/format";

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
  /** Só faz sentido na criação (sem `initial`) — "descartar e voltar" na etapa de resumo. */
  onCancel?: () => void;
  busy?: boolean;
};

const MAX_QTY = 1_000_000;

function formatAddress(customer: Customer): string | null {
  const line1 = [customer.street, customer.number].filter(Boolean).join(", ");
  const line2 = [customer.neighborhood, customer.city, customer.state].filter(Boolean).join(", ");
  const label = [line1, line2].filter(Boolean).join(" — ");
  return label || null;
}

export function OrderForm({ initial, submitLabel, onSubmit, onArchive, onCancel, busy }: Props) {
  const { loading: loadingProducts, searchSections } = useProducts();
  const { customers } = useCustomers();
  const [step, setStep] = useState<1 | 2>(1);
  const [customerId, setCustomerId] = useState<string | undefined>(initial?.customerId);
  const [customerName, setCustomerName] = useState(initial?.customerName ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<LineItem[]>(initial?.items ?? []);
  /** Só uma categoria ativa por vez — vira filtro no topo, não acordeão de seções. */
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const qtyByProduct = useMemo(() => {
    const map = new Map<string, number>();
    for (const l of items) map.set(l.productId, l.qty);
    return map;
  }, [items]);

  const sections = useMemo(() => searchSections(query), [searchSections, query]);

  // A categoria ativa some da busca atual (ex.: usuário digitou um código de
  // outra categoria) — troca sozinho pra primeira categoria que ainda tem
  // resultado, em vez de deixar a tela "travada" numa categoria vazia.
  useEffect(() => {
    if (sections.length === 0) return;
    if (!sections.some((s) => s.category === activeCategory)) {
      setActiveCategory(sections[0].category);
    }
  }, [sections, activeCategory]);

  const activeSection = sections.find((s) => s.category === activeCategory) ?? null;

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

  const totalUnits = items.reduce((acc, l) => acc + l.qty, 0);
  const totalValue = items.reduce((acc, l) => acc + l.unitPrice * l.qty, 0);
  const selectedCustomer = customerId ? customers.find((c) => c.id === customerId) : undefined;

  if (step === 2) {
    return (
      <ScrollView style={styles.list} contentContainerStyle={styles.stepTwoContent} keyboardShouldPersistTaps="handled">
        <View style={styles.stepBadgeRow}>
          <Pressable onPress={() => setStep(1)} hitSlop={8} style={styles.backLink}>
            <Ionicons name="chevron-back" size={16} color={colors.primary} />
            <Text style={styles.backLinkText}>Catálogo</Text>
          </Pressable>
          <Text style={styles.stepBadge}>Etapa 2/2</Text>
        </View>

        <OrderSummary
          customerName={customerName}
          customerAddress={selectedCustomer ? formatAddress(selectedCustomer) : null}
          items={items}
        />

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

        <PrimaryButton
          title={submitLabel}
          onPress={() => void handleSubmit()}
          loading={busy}
          disabled={busy}
          style={styles.submitButton}
        />

        {/* "Salvar rascunho" do design não tem hoje onde persistir (não existe
            conceito de pedido em rascunho no backend) — em vez de fingir que
            salva algo, só volta pra lista sem gravar. Se quiser rascunho de
            verdade (local no aparelho, ou no servidor), é uma decisão à parte. */}
        {!initial && onCancel ? (
          <PrimaryButton
            title="Descartar e voltar"
            variant="ghost"
            onPress={onCancel}
            disabled={busy}
            style={{ marginTop: space.sm }}
          />
        ) : null}

        {onArchive ? (
          <PrimaryButton
            title="Arquivar pedido"
            variant="ghost"
            onPress={handleArchive}
            disabled={busy}
            style={{ marginTop: space.sm }}
          />
        ) : null}
      </ScrollView>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        style={styles.list}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        data={activeSection?.products ?? []}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
        <View style={styles.headerBlock}>
          <View style={styles.stepBadgeRow}>
            <View />
            <Text style={styles.stepBadge}>Etapa 1/2</Text>
          </View>

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

          {sections.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillsRow}>
              {sections.map((s) => {
                const active = s.category === activeCategory;
                return (
                  <Pressable
                    key={s.category}
                    onPress={() => setActiveCategory(s.category)}
                    style={[styles.pill, active && styles.pillActive]}
                  >
                    <Text style={[styles.pillText, active && styles.pillTextActive]} numberOfLines={1}>
                      {s.category} {s.products.length}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          ) : null}

          {activeSection ? (
            <Text style={styles.sectionTitle}>
              {activeSection.category} · {activeSection.products.length}{" "}
              {activeSection.products.length === 1 ? "item" : "itens"}
            </Text>
          ) : null}
        </View>
      }
      ListEmptyComponent={
        <Text style={styles.noResults}>Nenhum produto encontrado para esta busca.</Text>
      }
        renderItem={({ item }) => (
          <ProductRow
            product={item}
            qty={qtyByProduct.get(item.id) ?? 0}
            onAdjust={adjustProductQty}
            onSetQty={setProductQtyAbsolute}
          />
        )}
      />

      {/* Fora da FlatList de propósito — fica fixa embaixo mostrando o total
          corrente, em vez de rolar junto com os produtos. */}
      <View style={styles.footerBar}>
        <View>
          <Text style={styles.footerMeta}>
            {items.length} {items.length === 1 ? "item" : "itens"} · {totalUnits}{" "}
            {totalUnits === 1 ? "unidade" : "unidades"}
          </Text>
          <Text style={styles.footerTotal}>{formatBRL(totalValue)}</Text>
        </View>
        <PrimaryButton
          title="Revisar pedido"
          onPress={() => setStep(2)}
          disabled={items.length === 0}
          style={styles.footerButton}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  list: { flex: 1, backgroundColor: colors.bg },
  content: { paddingBottom: space.lg },
  stepTwoContent: {
    padding: space.lg,
    paddingBottom: space.xl * 2,
    gap: space.md,
    maxWidth: 720,
    width: "100%",
    alignSelf: "center",
  },
  stepBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backLink: { flexDirection: "row", alignItems: "center", gap: 2 },
  backLinkText: { color: colors.primary, fontFamily: fonts.bodySemiBold, fontSize: 14 },
  stepBadge: {
    fontSize: 11,
    fontFamily: fonts.bodySemiBold,
    color: colors.muted,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    paddingHorizontal: space.sm,
    paddingVertical: 3,
  },
  headerBlock: {
    padding: space.lg,
    paddingBottom: space.sm,
    gap: space.md,
    maxWidth: 720,
    width: "100%",
    alignSelf: "center",
  },
  searchBlock: { gap: space.xs },
  loadingRow: { flexDirection: "row", alignItems: "center", gap: space.xs, paddingTop: space.xs },
  loadingText: { color: colors.muted, fontSize: 13, fontFamily: fonts.body },
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
    fontFamily: fonts.body,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  textarea: { minHeight: 96, textAlignVertical: "top" },
  submitButton: { marginTop: space.xs },
  pillsRow: { gap: space.xs, paddingVertical: 2 },
  pill: {
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  pillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  pillText: {
    fontSize: 13,
    fontFamily: fonts.bodySemiBold,
    color: colors.text,
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  pillTextActive: { color: "#fff" },
  sectionTitle: {
    fontSize: 13,
    fontFamily: fonts.bodySemiBold,
    color: colors.muted,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginTop: space.xs,
  },
  noResults: {
    fontSize: 14,
    color: colors.muted,
    paddingVertical: space.lg,
    paddingHorizontal: space.lg,
    textAlign: "center",
    fontFamily: fonts.body,
  },
  footerBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space.md,
    padding: space.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
    maxWidth: 720,
    width: "100%",
    alignSelf: "center",
  },
  footerMeta: { fontSize: 12, color: colors.muted, fontFamily: fonts.body },
  footerTotal: { fontSize: 20, fontFamily: fonts.displayBlack, color: colors.text },
  footerButton: { flexShrink: 0 },
});
