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
        organization: "org-sentry",
        project: "org-sentry-performance",
        // O token de upload NÃO vai aqui — o próprio plugin avisa que isso é
        // inseguro (fica exposto na config resolvida). Ele é lido direto de
        // SENTRY_AUTH_TOKEN no ambiente do build (EAS secret), sem passar
        // pelo JS deste arquivo.
        //
        // Sem isso, profiling contínuo nunca funciona no Android via Expo —
        // o plugin não liga o Sentry Android Gradle Plugin sozinho (issue
        // conhecida do próprio getsentry/sentry-react-native). "experimental"
        // é o nome que a própria lib usa pra essa chave, não indica
        // instabilidade além do normal do recurso de profiling em si.
        experimental_android: {
          enableAndroidGradlePlugin: true,
        },
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
