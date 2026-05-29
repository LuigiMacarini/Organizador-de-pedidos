import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { PrimaryButton } from "../../src/components/PrimaryButton";
import { useCustomers } from "../../src/customersContext";
import { parseCustomersCsv, type CsvCustomerRow } from "../../src/csv";
import { colors, radii, space } from "../../src/theme";

const PREVIEW_LIMIT = 50;

async function readFileContent(uri: string): Promise<string> {
  if (Platform.OS === "web") {
    const res = await fetch(uri);
    return res.text();
  }
  return FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.UTF8,
  });
}

export default function ImportarClientesScreen() {
  const router = useRouter();
  const { importCustomers } = useCustomers();
  const [fileName, setFileName] = useState<string | null>(null);
  const [rows, setRows] = useState<CsvCustomerRow[]>([]);
  const [skipped, setSkipped] = useState(0);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);

  const pickFile = async () => {
    setParsing(true);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["text/csv", "text/comma-separated-values", "application/csv", "text/plain", "*/*"],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled || !result.assets?.length) return;
      const asset = result.assets[0];
      const content = await readFileContent(asset.uri);
      const parsed = parseCustomersCsv(content);
      setFileName(asset.name ?? "arquivo.csv");
      setRows(parsed.rows);
      setSkipped(parsed.skipped);
      if (parsed.rows.length === 0) {
        Alert.alert(
          "Importar clientes",
          "Nenhum registro válido encontrado. Verifique se o arquivo tem o formato: Nome, Contato."
        );
      }
    } catch (e) {
      console.error(e);
      Alert.alert("Importar clientes", "Não foi possível ler o arquivo selecionado.");
    } finally {
      setParsing(false);
    }
  };

  const handleImport = async () => {
    if (rows.length === 0) return;
    setImporting(true);
    try {
      const res = await importCustomers(rows);
      Alert.alert(
        "Importação concluída",
        `${res.imported} ${res.imported === 1 ? "cliente importado" : "clientes importados"}.` +
          (res.skipped > 0
            ? ` ${res.skipped} ${res.skipped === 1 ? "ignorado" : "ignorados"} (duplicado/sem nome).`
            : ""),
        [{ text: "OK", onPress: () => router.back() }]
      );
    } finally {
      setImporting(false);
    }
  };

  const previewRows = rows.slice(0, PREVIEW_LIMIT);

  return (
    <SafeAreaView style={styles.safe} edges={["bottom", "left", "right"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.title}>Importar clientes via CSV</Text>
          <Text style={styles.subtitle}>
            O arquivo deve ter o cabeçalho na primeira linha no formato:{" "}
            <Text style={styles.mono}>Nome, Contato</Text>. Linhas sem nome são ignoradas.
          </Text>

          <Pressable
            onPress={() => void pickFile()}
            disabled={parsing}
            style={({ pressed }) => [styles.pick, pressed && { opacity: 0.9 }]}
          >
            <Ionicons name="document-attach-outline" size={20} color={colors.primary} />
            <Text style={styles.pickText}>
              {parsing ? "Lendo arquivo…" : fileName ? "Selecionar outro arquivo" : "Selecionar arquivo .csv"}
            </Text>
          </Pressable>
          {fileName ? <Text style={styles.fileName} numberOfLines={1}>{fileName}</Text> : null}
        </View>

        {rows.length > 0 ? (
          <>
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>
                Prévia ({rows.length} {rows.length === 1 ? "registro" : "registros"}
                {skipped > 0 ? ` · ${skipped} ignorado(s)` : ""})
              </Text>
              <View style={styles.tableHeader}>
                <Text style={[styles.th, { flex: 1.4 }]}>Nome</Text>
                <Text style={[styles.th, { flex: 1 }]}>Contato</Text>
              </View>
              {previewRows.map((r, i) => (
                <View key={`${r.name}-${i}`} style={styles.tr}>
                  <Text style={[styles.td, { flex: 1.4 }]} numberOfLines={1}>
                    {r.name}
                  </Text>
                  <Text style={[styles.td, { flex: 1 }]} numberOfLines={1}>
                    {r.contact ?? "—"}
                  </Text>
                </View>
              ))}
              {rows.length > PREVIEW_LIMIT ? (
                <Text style={styles.more}>
                  + {rows.length - PREVIEW_LIMIT} registro(s) não exibido(s)
                </Text>
              ) : null}
            </View>

            <PrimaryButton
              title={`Importar ${rows.length} ${rows.length === 1 ? "cliente" : "clientes"}`}
              onPress={() => void handleImport()}
              loading={importing}
              disabled={importing}
            />
          </>
        ) : null}
      </ScrollView>
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
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: space.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: { fontSize: 20, fontWeight: "800", color: colors.text },
  subtitle: { marginTop: 6, color: colors.muted, fontSize: 14, lineHeight: 20 },
  mono: { fontWeight: "800", color: colors.text },
  pick: {
    marginTop: space.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.sm,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radii.md,
    paddingVertical: space.md,
    backgroundColor: colors.chipBg,
  },
  pickText: { color: colors.primary, fontWeight: "800", fontSize: 15 },
  fileName: { marginTop: space.sm, color: colors.muted, fontSize: 13, textAlign: "center" },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.text,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: space.sm,
  },
  tableHeader: {
    flexDirection: "row",
    gap: space.md,
    paddingBottom: space.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  th: { fontSize: 12, fontWeight: "800", color: colors.muted, textTransform: "uppercase" },
  tr: {
    flexDirection: "row",
    gap: space.md,
    paddingVertical: space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  td: { fontSize: 14, color: colors.text },
  more: { marginTop: space.sm, color: colors.muted, fontSize: 13, textAlign: "center" },
});
