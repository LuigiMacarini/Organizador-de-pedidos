const DIACRITICS_REGEX = new RegExp("[\\u0300-\\u036f]", "g");

/**
 * Minúsculas, sem acentos e sem pontuação — para busca tolerante a
 * "agua" encontrar "Água", "auto-motiva" encontrar "Automotiva", etc.
 */
export function normalizeForSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(DIACRITICS_REGEX, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "");
}
