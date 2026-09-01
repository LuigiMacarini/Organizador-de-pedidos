import React, { useCallback, useState } from "react";
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { colors, radii, space } from "../theme";
import type { Customer } from "../types";
import { FieldLabel } from "./FieldLabel";
import { PrimaryButton } from "./PrimaryButton";

type AddressFields = "street" | "number" | "neighborhood" | "city" | "state" | "zipCode";

type Props = {
  initial?: Partial<Pick<Customer, "name" | "phone" | "note" | AddressFields>>;
  submitLabel: string;
  onSubmit: (payload: {
    name: string;
    phone: string;
    note: string;
    street: string;
    number: string;
    neighborhood: string;
    city: string;
    state: string;
    zipCode: string;
  }) => Promise<void> | void;
  onDelete?: () => Promise<void> | void;
  busy?: boolean;
};

export function CustomerForm({ initial, submitLabel, onSubmit, onDelete, busy }: Props) {
  const [name, setName] = useState(initial?.name ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [note, setNote] = useState(initial?.note ?? "");
  const [street, setStreet] = useState(initial?.street ?? "");
  const [number, setNumber] = useState(initial?.number ?? "");
  const [neighborhood, setNeighborhood] = useState(initial?.neighborhood ?? "");
  const [city, setCity] = useState(initial?.city ?? "");
  const [state, setState] = useState(initial?.state ?? "");
  const [zipCode, setZipCode] = useState(initial?.zipCode ?? "");

  const handleSubmit = useCallback(async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      Alert.alert("Cliente", "Informe o nome do cliente.");
      return;
    }
    await onSubmit({
      name: trimmed,
      phone: phone.trim(),
      note: note.trim(),
      street: street.trim(),
      number: number.trim(),
      neighborhood: neighborhood.trim(),
      city: city.trim(),
      state: state.trim(),
      zipCode: zipCode.trim(),
    });
  }, [name, phone, note, street, number, neighborhood, city, state, zipCode, onSubmit]);

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
        <FieldLabel optional>Telefone</FieldLabel>
        <TextInput
          value={phone}
          onChangeText={setPhone}
          placeholder="Telefone ou WhatsApp"
          placeholderTextColor={colors.muted}
          style={styles.input}
          keyboardType="phone-pad"
        />
      </View>

      <View style={styles.card}>
        <FieldLabel optional>Endereço</FieldLabel>
        <Text style={styles.addressHint}>
          Usado para calcular rotas de entrega. Preencha ao menos cidade e estado.
        </Text>

        <View style={styles.row}>
          <TextInput
            value={street}
            onChangeText={setStreet}
            placeholder="Rua"
            placeholderTextColor={colors.muted}
            style={[styles.input, styles.rowInputWide]}
          />
          <TextInput
            value={number}
            onChangeText={setNumber}
            placeholder="Número"
            placeholderTextColor={colors.muted}
            style={[styles.input, styles.rowInputNarrow]}
            keyboardType="numbers-and-punctuation"
          />
        </View>

        <TextInput
          value={neighborhood}
          onChangeText={setNeighborhood}
          placeholder="Bairro"
          placeholderTextColor={colors.muted}
          style={[styles.input, styles.addressSpacing]}
        />

        <View style={[styles.row, styles.addressSpacing]}>
          <TextInput
            value={city}
            onChangeText={setCity}
            placeholder="Cidade"
            placeholderTextColor={colors.muted}
            style={[styles.input, styles.rowInputWide]}
            autoCapitalize="words"
          />
          <TextInput
            value={state}
            onChangeText={setState}
            placeholder="UF"
            placeholderTextColor={colors.muted}
            style={[styles.input, styles.rowInputNarrow]}
            autoCapitalize="characters"
            maxLength={2}
          />
        </View>

        <TextInput
          value={zipCode}
          onChangeText={setZipCode}
          placeholder="CEP"
          placeholderTextColor={colors.muted}
          style={[styles.input, styles.addressSpacing]}
          keyboardType="numbers-and-punctuation"
        />
      </View>

      <View style={styles.card}>
        <FieldLabel optional>Observação</FieldLabel>
        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder="Referência, ponto de entrega, etc."
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
  textarea: {
    minHeight: 96,
    textAlignVertical: "top",
  },
  addressHint: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: space.sm,
  },
  row: {
    flexDirection: "row",
    gap: space.sm,
  },
  rowInputWide: {
    flex: 3,
  },
  rowInputNarrow: {
    flex: 1,
  },
  addressSpacing: {
    marginTop: space.sm,
  },
});
