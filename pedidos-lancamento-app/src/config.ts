/** URL base da API (sem barra final). Ex.: http://192.168.0.10:3333 */
export function getApiBaseUrl(): string | undefined {
  const raw = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (!raw) return undefined;
  return raw.replace(/\/+$/, "");
}
