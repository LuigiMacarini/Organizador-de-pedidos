const appJson = require("./app.json");

/**
 * app.json continua sendo a fonte estática (comitada, sem segredos). Só a
 * chave do Maps SDK (Android/iOS) precisa vir de variável de ambiente — não
 * pode ir hardcoded aqui porque esse arquivo é versionado no git (já tivemos
 * um vazamento de chave real neste projeto antes).
 */
module.exports = () => ({
  ...appJson.expo,
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
