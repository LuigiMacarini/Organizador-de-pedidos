import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { remoteAutocompleteAddress, remotePlaceDetails, type PlaceSuggestion } from "../api/placesRemote";
import { colors, radii, space } from "../theme";
import type { Customer } from "../types";
import { FieldLabel } from "./FieldLabel";
import { PrimaryButton } from "./PrimaryButton";

type AddressFields = "street" | "number" | "neighborhood" | "city" | "state" | "zipCode";

type ResolvedAddress = {
  street: string;
  number: string;
  neighborhood: string;
  city: string;
  state: string;
  zipCode: string;
  /** Só presentes quando o endereço veio de uma seleção do Places Autocomplete. */
  latitude?: number;
  longitude?: number;
  formattedAddress?: string;
};

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
    latitude?: number;
    longitude?: number;
  }) => Promise<void> | void;
  onDelete?: () => Promise<void> | void;
  busy?: boolean;
};

/** Autocomplete só dispara depois de uma pausa na digitação — evita 1 chamada por tecla. */
const SEARCH_DEBOUNCE_MS = 400;
const MIN_QUERY_LENGTH = 4;

function emptyAddress(): ResolvedAddress {
  return { street: "", number: "", neighborhood: "", city: "", state: "", zipCode: "" };
}

function formatAddressSummary(a: ResolvedAddress): string {
  if (a.formattedAddress) return a.formattedAddress;
  const line1 = [a.street, a.number].filter(Boolean).join(", ");
  const cityState = a.city && a.state ? `${a.city} - ${a.state}` : a.city || a.state || "";
  const line2 = [a.neighborhood, cityState].filter(Boolean).join(", ");
  return [line1, line2, a.zipCode].filter(Boolean).join(" · ") || "Endereço incompleto";
}

export function CustomerForm({ initial, submitLabel, onSubmit, onDelete, busy }: Props) {
  const [name, setName] = useState(initial?.name ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [note, setNote] = useState(initial?.note ?? "");

  const [address, setAddress] = useState<ResolvedAddress>(() => ({
    street: initial?.street ?? "",
    number: initial?.number ?? "",
    neighborhood: initial?.neighborhood ?? "",
    city: initial?.city ?? "",
    state: initial?.state ?? "",
    zipCode: initial?.zipCode ?? "",
  }));
  const hasAddress = Boolean(
    address.street || address.number || address.neighborhood || address.city || address.state || address.zipCode
  );

  const [manualMode, setManualMode] = useState(false);
  const [searchOpen, setSearchOpen] = useState(!hasAddress);
  const [addressQuery, setAddressQuery] = useState("");
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [searchingPlaces, setSearchingPlaces] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Busca só depois de uma pausa de digitação (debounce) e com no mínimo
  // MIN_QUERY_LENGTH caracteres — mantém as chamadas ao Places Autocomplete
  // sob controle em vez de disparar uma a cada tecla.
  useEffect(() => {
    if (manualMode || !searchOpen) return;
    const trimmed = addressQuery.trim();
    if (trimmed.length < MIN_QUERY_LENGTH) {
      setSuggestions([]);
      return;
    }
    let active = true;
    const handle = setTimeout(() => {
      setSearchingPlaces(true);
      remoteAutocompleteAddress(trimmed)
        .then((results) => {
          if (active) setSuggestions(results);
        })
        .catch(() => {
          if (active) setSuggestions([]);
        })
        .finally(() => {
          if (active) setSearchingPlaces(false);
        });
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      active = false;
      clearTimeout(handle);
    };
  }, [addressQuery, manualMode, searchOpen]);

  const handleSelectSuggestion = useCallback(async (suggestion: PlaceSuggestion) => {
    setLoadingDetails(true);
    try {
      const details = await remotePlaceDetails(suggestion.placeId);
      setAddress({
        street: details.street ?? "",
        number: details.number ?? "",
        neighborhood: details.neighborhood ?? "",
        city: details.city ?? "",
        state: details.state ?? "",
        zipCode: details.zipCode ?? "",
        latitude: details.latitude,
        longitude: details.longitude,
        formattedAddress: details.formattedAddress,
      });
      setSearchOpen(false);
      setAddressQuery("");
      setSuggestions([]);
    } catch {
      Alert.alert("Endereço", "Não foi possível carregar os detalhes desse endereço. Tente novamente.");
    } finally {
      setLoadingDetails(false);
    }
  }, []);

  const openSearch = useCallback(() => {
    setManualMode(false);
    setSearchOpen(true);
    setAddressQuery("");
    setSuggestions([]);
  }, []);

  const cancelSearch = useCallback(() => {
    setSearchOpen(false);
    setAddressQuery("");
    setSuggestions([]);
  }, []);

  const switchToManual = useCallback(() => {
    // Edição manual invalida a coordenada precisa vinda do Places — o
    // backend volta a geocodificar sozinho se os campos mudarem de fato.
    setAddress((prev) => ({ ...prev, latitude: undefined, longitude: undefined, formattedAddress: undefined }));
    setManualMode(true);
    setSearchOpen(false);
  }, []);

  const updateManualField = useCallback((field: AddressFields, value: string) => {
    setAddress((prev) => ({ ...prev, [field]: value }));
  }, []);

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
      street: address.street.trim(),
      number: address.number.trim(),
      neighborhood: address.neighborhood.trim(),
      city: address.city.trim(),
      state: address.state.trim(),
      zipCode: address.zipCode.trim(),
      latitude: address.latitude,
      longitude: address.longitude,
    });
  }, [name, phone, note, address, onSubmit]);

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
          Usado para calcular rotas de entrega. Busque o endereço na lista para uma localização precisa.
        </Text>

        {manualMode ? (
          <>
            <View style={styles.row}>
              <TextInput
                value={address.street}
                onChangeText={(v) => updateManualField("street", v)}
                placeholder="Rua"
                placeholderTextColor={colors.muted}
                style={[styles.input, styles.rowInputWide]}
              />
              <TextInput
                value={address.number}
                onChangeText={(v) => updateManualField("number", v)}
                placeholder="Número"
                placeholderTextColor={colors.muted}
                style={[styles.input, styles.rowInputNarrow]}
                keyboardType="numbers-and-punctuation"
              />
            </View>

            <TextInput
              value={address.neighborhood}
              onChangeText={(v) => updateManualField("neighborhood", v)}
              placeholder="Bairro"
              placeholderTextColor={colors.muted}
              style={[styles.input, styles.addressSpacing]}
            />

            <View style={[styles.row, styles.addressSpacing]}>
              <TextInput
                value={address.city}
                onChangeText={(v) => updateManualField("city", v)}
                placeholder="Cidade"
                placeholderTextColor={colors.muted}
                style={[styles.input, styles.rowInputWide]}
                autoCapitalize="words"
              />
              <TextInput
                value={address.state}
                onChangeText={(v) => updateManualField("state", v.toUpperCase())}
                placeholder="UF"
                placeholderTextColor={colors.muted}
                style={[styles.input, styles.rowInputNarrow]}
                autoCapitalize="characters"
                maxLength={2}
              />
            </View>

            <TextInput
              value={address.zipCode}
              onChangeText={(v) => updateManualField("zipCode", v)}
              placeholder="CEP"
              placeholderTextColor={colors.muted}
              style={[styles.input, styles.addressSpacing]}
              keyboardType="numbers-and-punctuation"
            />

            <Pressable onPress={openSearch} style={styles.linkRow}>
              <Text style={styles.linkText}>Usar busca de endereço</Text>
            </Pressable>
          </>
        ) : hasAddress && !searchOpen ? (
          <>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryText}>{formatAddressSummary(address)}</Text>
            </View>
            <View style={styles.linkRowGroup}>
              <Pressable onPress={openSearch} style={styles.linkRow}>
                <Text style={styles.linkText}>Alterar endereço</Text>
              </Pressable>
              <Pressable onPress={switchToManual} style={styles.linkRow}>
                <Text style={styles.linkTextMuted}>Editar manualmente</Text>
              </Pressable>
            </View>
          </>
        ) : (
          <>
            <TextInput
              value={addressQuery}
              onChangeText={setAddressQuery}
              placeholder="Digite rua, bairro ou cidade..."
              placeholderTextColor={colors.muted}
              style={styles.input}
              autoCapitalize="words"
              autoFocus={hasAddress}
            />
            {searchingPlaces || loadingDetails ? (
              <View style={styles.searchStatus}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={styles.searchStatusText}>
                  {loadingDetails ? "Carregando endereço..." : "Buscando..."}
                </Text>
              </View>
            ) : null}
            {!searchingPlaces && !loadingDetails && suggestions.length > 0 ? (
              <View style={styles.suggestionsBox}>
                {suggestions.map((s) => (
                  <Pressable
                    key={s.placeId}
                    onPress={() => void handleSelectSuggestion(s)}
                    style={styles.suggestionItem}
                  >
                    <Text style={styles.suggestionText}>{s.description}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
            {!searchingPlaces &&
            !loadingDetails &&
            addressQuery.trim().length >= MIN_QUERY_LENGTH &&
            suggestions.length === 0 ? (
              <Text style={styles.searchEmptyText}>Nenhum endereço encontrado.</Text>
            ) : null}
            <View style={styles.linkRowGroup}>
              {hasAddress ? (
                <Pressable onPress={cancelSearch} style={styles.linkRow}>
                  <Text style={styles.linkTextMuted}>Cancelar</Text>
                </Pressable>
              ) : null}
              <Pressable onPress={switchToManual} style={styles.linkRow}>
                <Text style={styles.linkTextMuted}>Preencher manualmente</Text>
              </Pressable>
            </View>
          </>
        )}
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
        disabled={busy || loadingDetails}
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
  summaryCard: {
    backgroundColor: colors.bg,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.md,
  },
  summaryText: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
  },
  linkRowGroup: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: space.md,
    marginTop: space.sm,
  },
  linkRow: {
    paddingVertical: space.xs,
  },
  linkText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: "700",
  },
  linkTextMuted: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: "600",
  },
  searchStatus: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    marginTop: space.sm,
  },
  searchStatusText: {
    color: colors.muted,
    fontSize: 13,
  },
  suggestionsBox: {
    marginTop: space.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    overflow: "hidden",
  },
  suggestionItem: {
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  suggestionText: {
    color: colors.text,
    fontSize: 14,
  },
  searchEmptyText: {
    color: colors.muted,
    fontSize: 13,
    marginTop: space.sm,
  },
});
