/**
 * Paleta neutra + um único acento — sem sombras, sem gradientes, raios pequenos.
 * Objetivo: parecer uma ferramenta de trabalho (tipo sistema de balcão/PDV),
 * não um template de dashboard. Acento "aço" (#5980A6) e raios pequenos vêm da
 * refatoração de design v1 (Claude Design) aplicada a partir de 2026-09.
 */
export const colors = {
  bg: "#F6F6F7",
  surface: "#FFFFFF",
  text: "#161719",
  muted: "#6B6E76",
  border: "#DEDFE3",
  borderStrong: "#B9BBC2",
  primary: "#5980A6",
  primaryPressed: "#46677D",
  danger: "#B3261E",
  dangerSoft: "#F7E9E8",
};

/** Raios pequenos e consistentes — nada de cartão "pílula". */
export const radii = {
  sm: 4,
  md: 6,
  lg: 8,
};

export const space = {
  xs: 6,
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
};

/**
 * Barlow Condensed pros títulos/números de destaque (a "voz" do app, densa e
 * direta — bate com o tom de ferramenta de trabalho), Barlow pro corpo de
 * texto normal. Cada peso é uma família de fonte separada (Google Fonts via
 * `@expo-google-fonts`) — não dá pra combinar `fontFamily` fixo com
 * `fontWeight` variável como no sistema; por isso os nomes já dizem o peso.
 * Carregadas em `app/_layout.tsx` antes do primeiro render (ver `useFonts`).
 */
export const fonts = {
  body: "Barlow_400Regular",
  bodyMedium: "Barlow_500Medium",
  bodySemiBold: "Barlow_600SemiBold",
  bodyBold: "Barlow_700Bold",
  display: "BarlowCondensed_700Bold",
  displayBlack: "BarlowCondensed_800ExtraBold",
};
