# Build iOS — TestFlight

```bash
git clone https://github.com/LuigiMacarini/Organizador-de-pedidos.git
cd Organizador-de-pedidos/pedidos-lancamento-app
npm install
npx eas-cli login
```

No `app.json`, remove `"owner": "luigimn"` e o `extra.eas.projectId` (é o meu
projeto, você precisa do seu) e roda `npx eas-cli init` pra criar o seu.
Bundle ID do iOS já está setado: `com.luigimacarini.pedidoslancamento`.

Variáveis: usa os valores do `.env` que te passei
(`EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_SENTRY_DSN`, `GOOGLE_MAPS_IOS_API_KEY`,
`SENTRY_AUTH_TOKEN`) e registra no ambiente `production` do seu projeto EAS —
o `.env` local não vai pro build na nuvem:

```bash
npx eas-cli env:set --environment production --name EXPO_PUBLIC_API_URL --value "<valor>" --visibility plaintext --non-interactive
npx eas-cli env:set --environment production --name EXPO_PUBLIC_SENTRY_DSN --value "<valor>" --visibility plaintext --non-interactive
npx eas-cli env:set --environment production --name GOOGLE_MAPS_IOS_API_KEY --value "<valor>" --visibility sensitive --non-interactive
npx eas-cli env:set --environment production --name SENTRY_AUTH_TOKEN --value "<valor>" --visibility sensitive --non-interactive
```

Build e submit:

```bash
npx eas-cli build --platform ios --profile production
npx eas-cli submit --platform ios --profile production
```

Depois, App Store Connect → TestFlight → cria um grupo de **External Testing**
e gera o link público (passa por uma revisão leve da Apple, geralmente libera
em algumas horas). Me manda esse link — não tenho iPhone, vou abrir no da
minha namorada, então internal testing (que exige e-mail cadastrado no seu
time) não serve aqui.

Essa build alimenta um estudo de performance (Sentry com tracing + profiling
em 100%) e não pode ser refeita — não mexe em nada depois de gerada.
