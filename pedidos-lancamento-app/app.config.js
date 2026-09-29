const appJson = require("./app.json");

/**
 * app.json é a fonte estática (comitada, sem segredos). A chave do Maps SDK
 * vem de variável de ambiente porque este arquivo é versionado no git e já
 * vazou uma chave real aqui antes.
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
        // Token de upload não fica aqui: o próprio plugin avisa que isso fica
        // exposto na config resolvida. Vem de SENTRY_AUTH_TOKEN no ambiente
        // do build (EAS secret).
        //
        // enableAndroidGradlePlugin liga o Sentry Android Gradle Plugin, que só
        // envia símbolos e mapeamentos (o plugin do Expo deixa a instrumentação
        // dele desligada). Não influencia o profiling, que está desligado.
        // "experimental" é só o nome da chave na lib.
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
