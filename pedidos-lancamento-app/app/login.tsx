import React, { useCallback, useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { PrimaryButton } from "../src/components/PrimaryButton";
import { FieldLabel } from "../src/components/FieldLabel";
import { useAuth } from "../src/auth/authContext";
import { ApiError } from "../src/api/httpClient";
import { colors, radii, space } from "../src/theme";

export default function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const handleSubmit = useCallback(async () => {
    if (!email.trim() || !password) {
      Alert.alert("Login", "Informe e-mail e senha.");
      return;
    }
    setBusy(true);
    try {
      await login(email.trim(), password);
    } catch (e) {
      const message = e instanceof ApiError ? e.message : "Não foi possível entrar.";
      Alert.alert("Login", message);
    } finally {
      setBusy(false);
    }
  }, [email, password, login]);

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.wrap}>
          <Text style={styles.title}>Pedidos</Text>
          <Text style={styles.subtitle}>Entre com sua conta para continuar</Text>

          <View style={styles.field}>
            <FieldLabel>E-mail</FieldLabel>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="seu@email.com"
              placeholderTextColor={colors.muted}
              style={styles.input}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              returnKeyType="next"
            />
          </View>

          <View style={styles.field}>
            <FieldLabel>Senha</FieldLabel>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor={colors.muted}
              style={styles.input}
              secureTextEntry
              returnKeyType="go"
              onSubmitEditing={() => void handleSubmit()}
            />
          </View>

          <PrimaryButton
            title="Entrar"
            onPress={() => void handleSubmit()}
            loading={busy}
            disabled={busy}
            style={styles.button}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  wrap: {
    flex: 1,
    justifyContent: "center",
    padding: space.xl,
    maxWidth: 400,
    width: "100%",
    alignSelf: "center",
  },
  title: { fontSize: 26, fontWeight: "800", color: colors.text },
  subtitle: { marginTop: space.xs, marginBottom: space.xl, color: colors.muted, fontSize: 14 },
  field: { marginBottom: space.md },
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
  button: { marginTop: space.sm },
});
