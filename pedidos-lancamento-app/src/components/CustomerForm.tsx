import React, { useCallback, useState } from "react";
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { colors, radii, space } from "../theme";
import type { Customer } from "../types";
import { FieldLabel } from "./FieldLabel";
import { PrimaryButton } from "./PrimaryButton";

type Props = {
  initial?: Partial<Pick<Customer, "name" | "contact" | "note">>;
  submitLabel: string;
  onSubmit: (payload: { name: string; contact: string; note: string }) => Promise<void> | void;
  onDelete?: () => Promise<void> | void;
  busy?: boolean;
};

export function CustomerForm({ initial, submitLabel, onSubmit, onDelete, busy }: Props) {
  const [name, setName] = useState(initial?.name ?? "");
  const [contact, setContact] = useState(initial?.contact ?? "");
  const [note, setNote] = useState(initial?.note ?? "");

  const handleSubmit = useCallback(async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      Alert.alert("Cliente", "Informe o nome do cliente.");
      return;
    }
    await onSubmit({ name: trimmed, contact: contact.trim(), note: note.trim() });
  }, [name, contact, note, onSubmit]);

  const handleDelete = useCallback(() => {
    if (!onDelete) return;
    const run = async () => {
      await onDelete();
    };
    if (Platform.OS === "web") {
      const ok = typeof window !== "undefined" && window.confirm("Excluir este cliente?");
      if (ok) void run();
      return;
    }
    Alert.alert("Excluir cliente", "Esta ação não pode ser desfeita.", [
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
        <FieldLabel>Nome</FieldLabel>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Nome do cliente"
          placeholderTextColor={colors.muted}
          style={styles.input}
          autoCapitalize="words"
          returnKeyType="next"
        />
      </View>

      <View style={styles.card}>
        <FieldLabel optional>Contato</FieldLabel>
        <TextInput
          value={contact}
          onChangeText={setContact}
          placeholder="Telefone ou WhatsApp"
          placeholderTextColor={colors.muted}
          style={styles.input}
          keyboardType="phone-pad"
        />
      </View>

      <View style={styles.card}>
        <FieldLabel optional>Observação</FieldLabel>
        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder="Referência, endereço, etc."
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
      />

      {onDelete ? (
        <PrimaryButton
          title="Excluir cliente"
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
});
