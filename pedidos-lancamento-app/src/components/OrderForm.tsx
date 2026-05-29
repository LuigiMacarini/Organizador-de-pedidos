import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import type { LineItem, Order, Product } from "../types";
import { searchCatalogSections } from "../catalog";
import { colors, radii, space } from "../theme";
import { Accordion } from "./Accordion";
import { CustomerSelect } from "./CustomerSelect";
import { FieldLabel } from "./FieldLabel";
import { PrimaryButton } from "./PrimaryButton";

function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

type Props = {
  initial?: Partial<Pick<Order, "customerId" | "customerName" | "items" | "notes">> & {
    id?: string;
  };
  submitLabel: string;
  onSubmit: (payload: {
    customerId?: string;
    customerName: string;
    items: LineItem[];
    notes: string;
  }) => Promise<void> | void;
  onDelete?: () => Promise<void> | void;
  busy?: boolean;
};

const MAX_QTY = 1_000_000;

function catalogAccordionKey(category: string) {
  return `cat:${category}`;
}

export function OrderForm({
  initial,
  submitLabel,
  onSubmit,
  onDelete,
  busy,
}: Props) {
  const [customerId, setCustomerId] = useState<string | undefined>(initial?.customerId);
  const [customerName, setCustomerName] = useState(initial?.customerName ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<LineItem[]>(initial?.items ?? []);
  /** Accordion: categorias fechadas por padrão (`true` = expandido). Resumo aberto por padrão. */
  const [accOpen, setAccOpen] = useState<Record<string, boolean>>({});

  const sections = useMemo(() => searchCatalogSections(query), [query]);

  useEffect(() => {
    if (sections.length !== 1) return;
    const k = catalogAccordionKey(sections[0].category);
    setAccOpen((prev) => ({ ...prev, [k]: true }));
  }, [sections]);

  const adjustProductQty = useCallback((p: Product, delta: number) => {
    if (delta === 0) return;
    setItems((prev) => {
      const idx = prev.findIndex((l) => l.productId === p.id);
      if (idx < 0) {
        if (delta < 0) return prev;
        return [
          ...prev,
          {
            productId: p.id,
            name: p.name,
            unitPrice: p.unitPrice,
            qty: delta,
          },
        ];
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
        return [
          ...prev,
          {
            productId: p.id,
            name: p.name,
            unitPrice: p.unitPrice,
            qty: q,
          },
        ];
      }
      const copy = [...prev];
      copy[idx] = { ...copy[idx], qty: q };
      return copy;
    });
  }, []);

  const removeLine = useCallback((productId: string) => {
    setItems((prev) => prev.filter((l) => l.productId !== productId));
  }, []);

  const totals = useMemo(() => {
    const lines = items.length;
    const units = items.reduce((acc, l) => acc + l.qty, 0);
    const amount = items.reduce((acc, l) => acc + l.unitPrice * l.qty, 0);
    return { lines, units, amount };
  }, [items]);

  const handleSubmit = useCallback(async () => {
    const name = customerName.trim();
    if (!name) {
      Alert.alert("Cliente", "Selecione um cliente para o pedido.");
      return;
    }
    if (items.length === 0) {
      Alert.alert("Produtos", "Adicione ao menos um produto ao pedido.");
      return;
    }
    await onSubmit({ customerId, customerName: name, items, notes: notes.trim() });
  }, [customerId, customerName, items, notes, onSubmit]);

  const handleDelete = useCallback(() => {
    if (!onDelete) return;
    const run = async () => {
      await onDelete();
    };
    if (Platform.OS === "web") {
      const ok = typeof window !== "undefined" && window.confirm("Excluir este pedido?");
      if (ok) void run();
      return;
    }
    Alert.alert("Excluir pedido", "Esta ação não pode ser desfeita.", [
      { text: "Cancelar", style: "cancel" },
      { text: "Excluir", style: "destructive", onPress: () => void run() },
    ]);
  }, [onDelete]);

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
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

      <View style={styles.card}>
        <FieldLabel>Buscar produtos</FieldLabel>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Nome do produto ou código (ex: p12)"
          placeholderTextColor={colors.muted}
          style={styles.input}
          autoCorrect={false}
          autoCapitalize="none"
        />

        <Text style={styles.hint}>
          Catálogo por categorias (toque no título para abrir/fechar). No card: −, campo numérico e
          +. O resumo também pode ser recolhido.
        </Text>
        {sections.length === 0 ? (
          <Text style={styles.noResults}>Nenhum produto encontrado para esta busca.</Text>
        ) : (
          sections.map((sec) => {
            const catKey = catalogAccordionKey(sec.category);
            const expanded = accOpen[catKey] === true;
            return (
              <Accordion
                key={sec.category}
                title={sec.category}
                subtitle={`${sec.products.length} produto${sec.products.length === 1 ? "" : "s"}`}
                expanded={expanded}
                onToggle={() =>
                  setAccOpen((s) => ({
                    ...s,
                    [catKey]: !(s[catKey] === true),
                  }))
                }
              >
                <View style={styles.chipsWrap}>
                  {sec.products.map((p) => {
                    const line = items.find((l) => l.productId === p.id);
                    const qty = line?.qty ?? 0;
                    return (
                      <View
                        key={p.id}
                        style={[styles.chip, qty > 0 ? styles.chipActive : null]}
                      >
                        <Text style={styles.chipTitle} numberOfLines={3}>
                          {p.name}
                        </Text>
                        <Text style={styles.chipMeta}>
                          {p.sku ? `${p.sku} · ` : ""}
                          {formatBRL(p.unitPrice)}
                          {!p.sku ? ` · ref. ${p.id}` : ""}
                        </Text>

                        <View style={styles.chipQtyRow}>
                          <Pressable
                            onPress={() => adjustProductQty(p, -1)}
                            disabled={qty === 0}
                            style={({ pressed }) => [
                              styles.chipQtyBtn,
                              qty === 0 && styles.chipQtyBtnDisabled,
                              pressed && qty > 0 && styles.chipQtyBtnPressed,
                            ]}
                            accessibilityLabel="Diminuir quantidade"
                          >
                            <Text
                              style={[
                                styles.chipQtyBtnText,
                                qty === 0 && styles.chipQtyBtnTextDisabled,
                              ]}
                            >
                              −
                            </Text>
                          </Pressable>
                          <TextInput
                            value={qty === 0 ? "" : String(qty)}
                            onChangeText={(t) => {
                              const digits = t.replace(/\D/g, "");
                              if (digits === "") {
                                setProductQtyAbsolute(p, 0);
                                return;
                              }
                              const n = parseInt(digits, 10);
                              if (!Number.isFinite(n)) return;
                              setProductQtyAbsolute(p, Math.min(n, MAX_QTY));
                            }}
                            placeholder="0"
                            placeholderTextColor={colors.muted}
                            keyboardType="number-pad"
                            inputMode="numeric"
                            selectTextOnFocus
                            maxLength={8}
                            style={styles.chipQtyInput}
                            accessibilityLabel="Quantidade"
                          />
                          <Pressable
                            onPress={() => adjustProductQty(p, 1)}
                            style={({ pressed }) => [
                              styles.chipQtyBtn,
                              pressed && styles.chipQtyBtnPressed,
                            ]}
                            accessibilityLabel="Aumentar quantidade"
                          >
                            <Text style={styles.chipQtyBtnText}>+</Text>
                          </Pressable>
                        </View>

                        {qty > 0 ? (
                          <Pressable
                            onPress={() => removeLine(p.id)}
                            style={styles.chipRemove}
                            accessibilityLabel="Remover produto do pedido"
                          >
                            <Text style={styles.chipRemoveText}>remover do pedido</Text>
                          </Pressable>
                        ) : null}
                      </View>
                    );
                  })}
                </View>
              </Accordion>
            );
          })
        )}
      </View>

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

      <View style={[styles.card, styles.summary]}>
        <Accordion
          variant="embed"
          title="Resumo do pedido"
          subtitle={`${totals.lines} tipos · ${totals.units} un. · ${formatBRL(totals.amount)}`}
          expanded={accOpen.__summary !== false}
          onToggle={() =>
            setAccOpen((s) => ({
              ...s,
              __summary: !(s.__summary !== false),
            }))
          }
        >
          <View style={styles.summaryBody}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Cliente</Text>
              <Text style={styles.summaryValue} numberOfLines={1}>
                {customerName.trim() || "—"}
              </Text>
            </View>
            <Text style={styles.summarySection}>Produtos pedidos</Text>
            {items.length === 0 ? (
              <Text style={styles.summaryEmpty}>Nenhum produto selecionado ainda.</Text>
            ) : (
              <View style={styles.summaryList}>
                {items.map((l) => (
                  <View key={l.productId} style={styles.summaryProduct}>
                    <View style={{ flex: 1, paddingRight: space.sm }}>
                      <Text style={styles.summaryProductName} numberOfLines={2}>
                        {l.name}
                      </Text>
                      <Text style={styles.summaryProductMeta}>
                        {formatBRL(l.unitPrice)} · {l.qty}{" "}
                        {l.qty === 1 ? "unidade" : "unidades"}
                      </Text>
                    </View>
                    <Text style={styles.summaryProductSub}>
                      {formatBRL(l.unitPrice * l.qty)}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Tipos de produto</Text>
              <Text style={styles.summaryValue}>{totals.lines}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Unidades no total</Text>
              <Text style={styles.summaryValue}>{totals.units}</Text>
            </View>
            <View style={[styles.summaryRow, styles.summaryTotal]}>
              <Text style={styles.summaryTotalLabel}>Total estimado</Text>
              <Text style={styles.summaryTotalValue}>{formatBRL(totals.amount)}</Text>
            </View>
          </View>
        </Accordion>
      </View>

      <PrimaryButton
        title={submitLabel}
        onPress={() => void handleSubmit()}
        loading={busy}
        disabled={busy}
      />

      {onDelete ? (
        <PrimaryButton
          title="Excluir pedido"
          variant="danger"
          onPress={handleDelete}
          disabled={busy}
          style={{ marginTop: space.sm }}
        />
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.bg },
  content: {
    padding: space.lg,
    paddingBottom: space.xl * 2,
    gap: space.md,
    maxWidth: 720,
    width: "100%",
    alignSelf: "center",
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: space.lg,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.shadow,
    shadowOpacity: 1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    fontSize: 16,
    color: colors.text,
    backgroundColor: "#FAFBFF",
  },
  textarea: {
    minHeight: 96,
    textAlignVertical: "top",
  },
  hint: {
    marginTop: space.sm,
    fontSize: 12,
    color: colors.muted,
    marginBottom: space.sm,
  },
  noResults: {
    fontSize: 14,
    color: colors.muted,
    paddingVertical: space.md,
    textAlign: "center",
  },
  chipsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: space.sm,
  },
  chip: {
    flexGrow: 1,
    flexBasis: "47%",
    minWidth: 148,
    backgroundColor: colors.chipBg,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.chipBorder,
    padding: space.sm,
  },
  chipActive: {
    borderColor: colors.primary,
    backgroundColor: "#E8EEFE",
  },
  chipTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text,
  },
  chipMeta: {
    marginTop: 4,
    fontSize: 12,
    color: colors.muted,
  },
  chipQtyRow: {
    marginTop: space.sm,
    paddingTop: space.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.chipBorder,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space.sm,
  },
  chipQtyBtn: {
    flex: 1,
    minHeight: 40,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  chipQtyBtnPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.98 }],
  },
  chipQtyBtnDisabled: {
    opacity: 0.45,
  },
  chipQtyInput: {
    minWidth: 52,
    maxWidth: 96,
    flexGrow: 1,
    textAlign: "center",
    fontSize: 16,
    fontWeight: "800",
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    paddingVertical: 8,
    paddingHorizontal: 6,
    backgroundColor: colors.surface,
  },
  chipQtyBtnText: {
    fontSize: 20,
    fontWeight: "800",
    color: colors.text,
  },
  chipQtyBtnTextDisabled: {
    color: colors.muted,
  },
  chipRemove: {
    marginTop: space.xs,
    alignSelf: "center",
    paddingVertical: 4,
    paddingHorizontal: space.xs,
  },
  chipRemoveText: {
    fontSize: 11,
    color: colors.danger,
    fontWeight: "700",
  },
  summarySection: {
    marginTop: space.md,
    marginBottom: space.xs,
    fontSize: 13,
    fontWeight: "800",
    color: colors.text,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  summaryEmpty: {
    color: colors.muted,
    fontSize: 14,
    marginBottom: space.md,
  },
  summaryList: {
    marginBottom: space.sm,
  },
  summaryProduct: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: space.md,
    paddingVertical: space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#BBF7D0",
  },
  summaryProductName: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.text,
  },
  summaryProductMeta: {
    marginTop: 4,
    fontSize: 12,
    color: colors.muted,
  },
  summaryProductSub: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.text,
  },
  summary: {
    backgroundColor: colors.successSoft,
    borderColor: "#D1FAE5",
  },
  summaryBody: {
    paddingTop: space.xs,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: space.md,
    paddingVertical: 6,
  },
  summaryLabel: { color: colors.muted, fontSize: 14 },
  summaryValue: { color: colors.text, fontSize: 14, fontWeight: "600", flexShrink: 1 },
  summaryTotal: {
    marginTop: space.sm,
    paddingTop: space.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#BBF7D0",
  },
  summaryTotalLabel: { color: colors.text, fontSize: 15, fontWeight: "700" },
  summaryTotalValue: { color: colors.text, fontSize: 16, fontWeight: "800" },
});
