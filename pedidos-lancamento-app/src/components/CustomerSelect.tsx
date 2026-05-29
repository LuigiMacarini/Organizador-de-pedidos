import { Ionicons } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { normalizeName, useCustomers } from "../customersContext";
import { colors, radii, space } from "../theme";
import { SearchBar } from "./SearchBar";

type Props = {
  customerId?: string;
  customerName?: string;
  onSelect: (customer: { id: string; name: string }) => void;
};

export function CustomerSelect({ customerId, customerName, onSelect }: Props) {
  const { customers, createCustomer } = useCustomers();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);

  const selectedLabel = useMemo(() => {
    if (customerId) {
      const found = customers.find((c) => c.id === customerId);
      if (found) return found.name;
    }
    return customerName?.trim() || "";
  }, [customerId, customerName, customers]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter((c) => c.name.toLowerCase().includes(q));
  }, [customers, query]);

  const exactMatch = useMemo(() => {
    const q = normalizeName(query);
    if (!q) return true;
    return customers.some((c) => normalizeName(c.name) === q);
  }, [customers, query]);

  const close = () => {
    setOpen(false);
    setQuery("");
  };

  const handleCreate = async () => {
    const name = query.trim();
    if (!name || creating) return;
    setCreating(true);
    try {
      const created = await createCustomer({ name });
      onSelect({ id: created.id, name: created.name });
      close();
    } finally {
      setCreating(false);
    }
  };

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        style={({ pressed }) => [styles.field, pressed && { opacity: 0.9 }]}
        accessibilityRole="button"
      >
        <Text style={[styles.fieldText, !selectedLabel && styles.placeholder]} numberOfLines={1}>
          {selectedLabel || "Selecionar cliente"}
        </Text>
        <Ionicons name="chevron-down" size={20} color={colors.muted} />
      </Pressable>

      <Modal visible={open} animationType="slide" transparent onRequestClose={close}>
        <View style={styles.backdrop}>
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Selecionar cliente</Text>
              <Pressable onPress={close} hitSlop={8} accessibilityLabel="Fechar">
                <Ionicons name="close" size={24} color={colors.text} />
              </Pressable>
            </View>

            <SearchBar value={query} onChangeText={setQuery} placeholder="Buscar ou cadastrar" />

            <FlatList
              data={filtered}
              keyExtractor={(c) => c.id}
              style={styles.listWrap}
              keyboardShouldPersistTaps="handled"
              ItemSeparatorComponent={() => <View style={styles.separator} />}
              renderItem={({ item }) => {
                const active = item.id === customerId;
                return (
                  <Pressable
                    onPress={() => {
                      onSelect({ id: item.id, name: item.name });
                      close();
                    }}
                    style={({ pressed }) => [styles.row, pressed && { opacity: 0.85 }]}
                  >
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.rowName} numberOfLines={1}>
                        {item.name}
                      </Text>
                      {item.contact?.trim() ? (
                        <Text style={styles.rowMeta} numberOfLines={1}>
                          {item.contact.trim()}
                        </Text>
                      ) : null}
                    </View>
                    {active ? (
                      <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                    ) : null}
                  </Pressable>
                );
              }}
              ListEmptyComponent={
                <Text style={styles.empty}>
                  {customers.length === 0
                    ? "Nenhum cliente cadastrado ainda."
                    : "Nenhum cliente encontrado."}
                </Text>
              }
            />

            {query.trim() && !exactMatch ? (
              <Pressable
                onPress={() => void handleCreate()}
                disabled={creating}
                style={({ pressed }) => [styles.createBtn, pressed && { opacity: 0.9 }]}
              >
                <Ionicons name="add-circle-outline" size={18} color="#fff" />
                <Text style={styles.createText} numberOfLines={1}>
                  Cadastrar “{query.trim()}”
                </Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    minHeight: 48,
    backgroundColor: "#FAFBFF",
  },
  fieldText: { flex: 1, fontSize: 16, color: colors.text },
  placeholder: { color: colors.muted },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.35)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    padding: space.lg,
    maxHeight: "80%",
    gap: space.md,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sheetTitle: { fontSize: 18, fontWeight: "800", color: colors.text },
  listWrap: { flexGrow: 0 },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingVertical: space.md,
  },
  rowName: { fontSize: 16, fontWeight: "600", color: colors.text },
  rowMeta: { marginTop: 2, fontSize: 13, color: colors.muted },
  empty: { color: colors.muted, fontSize: 14, paddingVertical: space.lg, textAlign: "center" },
  createBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.sm,
    backgroundColor: colors.primary,
    borderRadius: radii.lg,
    paddingVertical: space.md,
  },
  createText: { color: "#fff", fontWeight: "800", fontSize: 15 },
});
