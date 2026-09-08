const appJson = require("./app.json");

/**
 * app.json continua sendo a fonte estática (comitada, sem segredos). Só a
 * chave do Maps SDK (Android/iOS) precisa vir de variável de ambiente — não
 * pode ir hardcoded aqui porque esse arquivo é versionado no git (já tivemos
 * um vazamento de chave real neste projeto antes).
 */
module.exports = () => ({
  ...appJson.expo,
  plugins: [
    ...appJson.expo.plugins,
    [
      "@sentry/react-native",
      {
        organization: "org-performance-sentry",
        project: "luigi-w1",
        // O token de upload NÃO vai aqui — o próprio plugin avisa que isso é
        // inseguro (fica exposto na config resolvida). Ele é lido direto de
        // SENTRY_AUTH_TOKEN no ambiente do build (EAS secret), sem passar
        // pelo JS deste arquivo.
      },
    ],
  ],
  android: {
    ...appJson.expo.android,
    config: {
      googleMaps: {
        apiKey: process.env.GOOGLE_MAPS_ANDROID_API_KEY,
      },
    },
  },
  ios: {
    ...appJson.expo.ios,
    ...(process.env.GOOGLE_MAPS_IOS_API_KEY
      ? { config: { googleMapsApiKey: process.env.GOOGLE_MAPS_IOS_API_KEY } }
      : {}),
  },
});
