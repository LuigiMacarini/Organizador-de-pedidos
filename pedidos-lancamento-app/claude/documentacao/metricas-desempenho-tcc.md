# Métricas de desempenho do TCC — Projeto ORG

> Registro da auditoria do Sentry, das decisões tomadas e da instrumentação criada para medir CPU, memória RAM e FPS do app no Android e no iOS. Sessão de 28–29/09/2026. Serve de base para a seção de metodologia do TCC ("Os dados de desempenho foram coletados utilizando...").

---

## 1. Contexto

| Item | Situação |
|---|---|
| Tema do TCC | Análise comparativa de desempenho do React Native para logística local entre Android e iOS |
| Métricas prometidas | CPU, memória RAM, FPS e bateria (bateria coletada manualmente) |
| Aparelhos | Samsung Galaxy A54 5G (Android) e iPhone 16 (iOS, aparelho emprestado) |
| Stack | Expo SDK 52, React Native 0.76.9, Hermes, arquitetura antiga (`newArchEnabled` não definido ⇒ `false`), Expo Router 4.0.22 |
| Build iOS | Gerada por outra pessoa, em outra conta EAS/Apple, perfil `production`, distribuída pelo TestFlight (ver `BUILD_IOS.md`) |
| Restrições | Sem Mac; builds só pelo EAS; cota gratuita do EAS esgotada até 01/10/2026; rotas e GPS precisam ser testados em campo (fora de casa) |

---

## 2. O que a auditoria encontrou

A auditoria leu o código do projeto, o histórico do git, o histórico de builds do EAS (`eas build:list`, só leitura) e o **código-fonte das versões exatas** do SDK do Sentry em cada build (JS, Java e Swift). Não se partiu da documentação de marketing.

### 2.1 As duas builds não eram comparáveis

| | Android (Galaxy A54) | iOS (iPhone 16) |
|---|---|---|
| Build | EAS #14, perfil `preview`, 14/09/2026 21:56 | Conta EAS de terceiro, perfil `production`, TestFlight |
| Commit | `c9a65ae` (hoje só existe no branch `backup/main-pre-reorg-2026-09-16`) | A partir de `29d98a3`; o código de runtime é idêntico ao `main` |
| `@sentry/react-native` | **6.10.0** (sentry-android 7.22.5) | **8.26.0** (sentry-cocoa 9.28.0) |
| Transactions de performance | **Nenhuma** | Uma por tela |
| Release no Sentry | `com.example.pedidoslancamento@1.0.0+14` | `com.luigimacarini.pedidoslancamento@1.0.0+8` (aparece como "1.0.0 (8)") |

- **Por que o Android não coletava performance:** a 6.10.0 não cria transaction sem uma integração de navegação registrada, e o app nunca registrou uma. Sem transaction não existem app start, frames, stalls, spans HTTP nem profiling. O que aparecia em *Releases* eram só **sessões** (Release Health).
- **Por que o iOS coletava:** a 8.26.0 traz `expoRouterIntegration`, que conecta o Expo Router sozinho e cria uma transaction por tela.
- **Por que o código do iOS é o do `main`:** o bundle ID `com.luigimacarini.pedidoslancamento` só existe a partir do commit `29d98a3`, que é posterior ao upgrade do SDK (`56d0783`). Entre `56d0783` e `0397d3c`, a única mudança de runtime é esse bundle ID; o resto é comentário e documentação.
- **O Explore do Sentry confirmou (28/09):** havia spans só das releases iOS "1.0.0 (1)" e "1.0.0 (8)", mais alguns spans sem release por volta de 15/09 (provavelmente Expo Web/dev). Nenhum do Android.
- **O comentário antigo estava errado:** ele dizia que o *Sentry Android Gradle Plugin* era obrigatório para o profiling. O plugin do Expo o configura com `tracingInstrumentation` e `autoInstallation` desligados, então ele só envia símbolos e mapeamentos. A falta de profiles no Android vinha da falta de transactions.

### 2.2 O que o Sentry mede e o que não mede

| Métrica | O Sentry fornece? | Observação |
|---|---|---|
| Inicialização (`app_start_cold`/`warm`) | Sim, nas duas | Anexada à primeira transaction de tela |
| Duração de cada tela (transaction) | Sim, nas duas | Termina 1 s após a última atividade filha, normalmente HTTP; mede rede e servidor, não renderização |
| Frames lentos/congelados (`frames_slow`/`frozen`/`total`, `frames.delay`) | Sim, mas com **definições diferentes** | iOS conta todo tick de tela (CADisplayLink), inclusive com a tela parada, e usa limiar lento de 1/(fps−1). Android conta só quadros desenhados e usa limiar fixo de 16 ms. Congelado é > 700 ms nos dois |
| Stalls da thread JS (`stall_count`, `stall_total_time`, `stall_longest_time`) | Sim, nas duas | Mesmo código JS: timer de 50 ms, stall quando a iteração leva ≥ 100 ms. É a métrica mais comparável do Sentry |
| Requisições HTTP (`http.client`) | Sim, nas duas | Só dentro de uma transaction |
| **FPS** | **Não** | O Sentry conta frames, mas não mede FPS |
| **CPU** | **Não, de forma adequada** | Android: o SDK RN chama `endAndCollect(false, null)`, então o profile não tem CPU. iOS: `cpu_usage` só dentro de profiles (máx. 30 s) e com escala errada na versão 9.x do sentry-cocoa ([PR #8323](https://github.com/getsentry/sentry-cocoa/pull/8323), corrigido só na v10) |
| **Memória do app** | **Não, de forma comparável** | Android: só memória **do sistema** no contexto do evento. iOS: `memory_footprint` só em profiles e `app.app_memory` como instantâneo por evento, com definições diferentes entre si |
| Tráfego da bridge | Não | — |
| App em repouso | Não | Sem transaction ativa, nada de performance é coletado |

### 2.3 Como a coleta do Sentry funciona

- **Transaction de tela:** idle de 1 s (`idleTimeout: 1000`) e limite de 10 min (`finalTimeout: 600000`). É cancelada quando o app vai para segundo plano (no iOS, após 5 s em `inactive`). Ações dentro da mesma tela não geram transaction, porque o rastreamento de toques está desligado.
- **Sessão:** termina após 30 s em segundo plano (`sessionTrackingIntervalMillis = 30000` nos SDKs nativos).
- **Profiling (quando estava ligado):** um profile por transaction, com no máximo 30 s, só com Hermes.
- **Envio:** cada transaction é enviada quando termina, pelo transporte nativo, com cache em disco se estiver offline.
- **Retenção:** spans e profiles ficam **30 dias**, por isso é preciso exportar após cada sessão de testes.
- **Plano estudantil** (página oficial): 50K erros, 5M spans, 500 replays. Profiling de celular é **só pago à parte** (PAYG), a US$ 0,25 por *UI profile hour*. A cota de métricas customizadas não aparece na página oficial, mas o plano **aceitou** as métricas `perf.*` no piloto de 29/09.

### 2.4 Três defeitos do SDK 8.26 no Android (29/09 e 06/10)

O upgrade para o SDK 8.26.0 nunca tinha sido compilado para Android, porque a cota do EAS estava esgotada. A build local mostrou os dois primeiros problemas, que também quebrariam a build do EAS. O terceiro só apareceu no EAS, porque a build local roda com `SENTRY_DISABLE_AUTO_UPLOAD=true`:

| Problema | Causa | Correção |
|---|---|---|
| Build falhava em `:sentry_react-native:extractDeepLinksRelease` | O Sentry 8.26 também é um módulo Expo e declara `android.name`/`android.path` no `expo-module.config.json`. O autolinking do Expo SDK 52 (2.0.8) ignora esses campos e incluía a pasta `android/` do Sentry uma segunda vez (`:sentry-react-native`), além da inclusão feita pelo autolinking do React Native (`:sentry_react-native`) | `package.json` → `expo.autolinking.android.exclude: ["@sentry/react-native"]`. O autolinking do React Native continua incluindo o Sentry uma vez. O que sai é o `expo-handler`, que só atua no Expo SDK 53+ com a nova arquitetura (commit `cab3de9`) |
| App fechava ao abrir: `Requiring unknown module "undefined"` em `getExpoUpdatesExports` | A integração `ExpoUpdatesListener` do Sentry tenta carregar `expo-updates` (não instalado) no evento `afterInit`, que é assíncrono. Fora do carregamento de módulos, o `guardedLoadModule` do Metro trata a falha como erro fatal antes do `try/catch` do Sentry | `Sentry.init` → `integrations` filtra `ExpoUpdatesListener` (commit `624f8aa`). A mudança é só de JS e vale para as duas plataformas. Não se sabe por que a build iOS 8 atual não cai |
| Build `preview` do EAS falhou (06/10) com `Could not create task ':app:uploadSentryNativeSymbolsForRelease'` / `SentryCliExecTask.setIgnoreExitValue(boolean)` | O plugin Expo do Sentry 8.26 fixa o Sentry Android Gradle Plugin em **6.21.0**, incompatível com o **Gradle 8.10.2** do Expo SDK 52. O plugin só quebra quando o envio automático de símbolos está ligado (`shouldSentryAutoUpload()`), o que acontece no EAS e não na build local. A falha foi reproduzida com `gradlew app:assembleRelease --dry-run` em `C:\dev\org`: quebra sem a variável e passa com ela | `eas.json` → perfil `preview` com `env.SENTRY_DISABLE_AUTO_UPLOAD = "true"` (commit `1a0b450`). O EAS só deixa de enviar source maps e símbolos ao Sentry. O app e as métricas não mudam, e a configuração fica igual à da build local B validada (4.6 e 4.7) |

### 2.5 Por que não usar ferramentas externas como fonte principal

`adb` (Android), `pymobiledevice3` (iOS sem Mac) e o **Flashlight** exigem o celular **ligado a um computador**. O Flashlight roda `adb shell ...` no computador e só suporta Android. Como as rotas precisam ser testadas em campo, essas ferramentas só servem em bancada. Por isso a troca do Flashlight pelo Sentry foi correta. O preço é que o Sentry mede outra família de métricas (o desempenho percebido), e CPU, RAM e FPS precisaram de instrumentação própria.

---

## 3. Decisões e porquês

| # | Decisão | Por quê |
|---|---|---|
| 1 | Manter o Sentry como canal e como fonte das métricas que ele mede bem | Funciona em campo, sem cabo, envia por dados móveis e guarda offline. Já está integrado nas duas plataformas |
| 2 | Criar instrumentação própria para CPU, RAM e FPS (módulo nativo local do Expo) | Tirar CPU e RAM do escopo deixaria objetivos do TCC sem resultado, e isso é mais grave que uma limitação |
| 3 | Medir **o processo do app**, não o aparelho | O que se compara é o consumo do app React Native. Desde o Android 8, apps não conseguem ler a CPU do sistema (`/proc/stat` bloqueado) |
| 4 | CPU pelo **mesmo relógio POSIX** nas duas plataformas | `Process.getElapsedCpuTime()` do Android é implementado no AOSP com `clock_gettime(CLOCK_PROCESS_CPUTIME_ID)`, e o iOS chama esse mesmo relógio. A definição é idêntica |
| 5 | FPS = callbacks de quadro da thread principal por segundo | É o método do monitor de desempenho do próprio React Native: `Choreographer` no Android e `CADisplayLink` no iOS |
| 6 | Memória = métrica oficial de cada sistema, mais RSS nas duas | PSS é a métrica oficial do Android; `phys_footprint` é a que o Xcode mostra. As duas não são a mesma definição, então o RSS, que é o mesmo conceito nos dois kernels, fica como base comum |
| 7 | Fórmulas só no JS (`src/utils/perfSampler.ts`) | O código nativo só lê contadores. A conta fica em um único lugar e é idêntica nas duas plataformas |
| 8 | Coleta **a cada 15 s**, com todas as métricas juntas, e a duração da leitura de memória registrada | É o protocolo do artigo (Käld e Svensson, 2021). CPU e FPS vêm de contadores acumulados, então cada valor é a média exata dos 15 s, e o maior intervalo entre quadros preserva o pico. A leitura de memória custa ~0,24% de um núcleo (36 ms a cada 15 s). Até 29/09 a coleta era de 1 s (CPU/FPS) e 5 s (memória) |
| 9 | Coletar só em primeiro plano e enviar (`flush`) ao sair do app | Em segundo plano não há quadros. O flush evita perder o fim de cada repetição |
| 10 | **Profiling do Sentry desligado** | O profiler consome CPU do app e contaminaria justamente a métrica de CPU (efeito do observador) |
| 11 | Enviar como `distribution` | O SDK não agrega no cliente: cada chamada é uma amostra com timestamp, o que permite mediana e percentis |
| 12 | `run_id` por lançamento do app e rota como atributo | Separa as repetições e as telas sem precisar de nenhuma tela extra no app |
| 13 | Sem bibliotecas novas | Módulo local em `modules/`, descoberto pelo autolinking do Expo |
| 14 | Novas builds Android e iOS **do mesmo commit** | Garante o mesmo SDK e o mesmo código nas duas plataformas, e corrige de quebra a build Android com SDK 6.10 |
| 15 | Manter o Sentry Android Gradle Plugin | Não tem efeito em runtime. Removê-lo mudaria a build sem ganho; se ele quebrar a build, pode ser removido |
| 16 | Bateria continua manual | Decisão do protocolo original |

---

## 4. O que foi implementado

### 4.1 Arquivos

| Arquivo | Papel |
|---|---|
| `modules/perf-sampler/android/.../PerfSamplerModule.kt` | Sensor do Android: `getElapsedCpuTime`, `Debug.MemoryInfo`, `/proc/self/statm`, `Choreographer`, taxa de atualização, estado térmico, economia de energia |
| `modules/perf-sampler/ios/PerfSamplerModule.swift` | Sensor do iOS: `clock_gettime_nsec_np(CLOCK_PROCESS_CPUTIME_ID)`, `task_info(TASK_VM_INFO)`, `CADisplayLink`, estado térmico, Pouca Energia |
| `modules/perf-sampler/index.ts` | Interface TypeScript; devolve `null` na web ou em binário sem o módulo |
| `src/utils/perfSampler.ts` | Coletor: calcula as taxas e envia ao Sentry |
| `app/_layout.tsx` | Liga o coletor após o `Sentry.init` (só se houver DSN), mantém a rota atual e tem o profiling removido |

**Verificações feitas:**
- O autolinking do Expo encontrou o módulo nas duas plataformas.
- `tsc` passou sem erros.
- O `expo export` gerou os bundles Android e iOS, com o coletor presente nos dois.
- **Kotlin compilado e app rodando no A54 (29/09):** build local release com `:perf-sampler:compileReleaseKotlin` sem erro, app instalado e aberto sem crash, marcadores `[startup]` no logcat. Ver 4.5.
- **Métricas validadas no Sentry (29/09):**
  - Onde aparecem: as `perf.*` chegam como `distribution` e ficam **ligadas ao trace da tela ativa** (Explore → Traces → abrir um trace → aba **Application Metrics**).
  - Primeira tela, a 120 Hz: CPU de 21,6 a 46,9% de um núcleo, RSS ≈ 248 MB, `graphics` ≈ 20 MB, `perf.fps.ui` de 106 a 119.
  - **A54 em 60 Hz confirmado:** depois de trocar Suavidade de movimentos para Padrão, `perf.fps.ui` ≈ 60.
  - Custo do próprio instrumento: `perf.sampler.memory_read` ≈ 36 ms a cada 5 s, ≈ 0,7% de um núcleo em média.
- O **Swift** foi escrito sem Mac, espelhando código já compilado no projeto (`expo-location` e o Swift do próprio sentry-cocoa). A primeira compilação foi em 13/10, na build de simulador do EAS, sem avisos nem erros (ver 4.8).
- **Scripts de coleta e análise** (exportação do Sentry, planilhas, roteiro pelo adb e bancada): [scripts/README.md](scripts/README.md). Eles rodam no PC e não entram na build.

### 4.2 Métricas enviadas ao Sentry

| Métrica | Unidade | Plataforma | Definição | Frequência |
|---|---|---|---|---|
| `perf.cpu` | percent | ambas | Δ tempo de CPU do processo ÷ Δ tempo real × 100 (100% = um núcleo inteiro); média exata da janela | 15 s |
| `perf.fps.ui` | — | ambas | Callbacks de quadro da thread principal ÷ segundos decorridos; média da janela | 15 s |
| `perf.frame.max_interval` | millisecond | ambas | Maior intervalo entre dois quadros na janela (pico de travada) | 15 s |
| `perf.memory.rss` | byte | ambas | Resident set size | 15 s |
| `perf.memory.pss` | byte | Android | PSS total (`Debug.MemoryInfo.getTotalPss`) | 15 s |
| `perf.memory.java_heap`, `native_heap`, `graphics` | byte | Android | Divisão do PSS (as mesmas categorias do Memory Profiler) | 15 s |
| `perf.memory.footprint` | byte | iOS | `phys_footprint` (valor do medidor de memória do Xcode) | 15 s |
| `perf.memory.footprint_peak` | byte | iOS | Pico de `phys_footprint` desde o início do processo (kernel) | 15 s |
| `perf.sampler.memory_read` | millisecond | ambas | Custo da própria leitura de memória | 15 s |

Ao abrir ou voltar ao app, uma leitura imediata serve de ponto de partida. Numa sessão de 10 min isso dá 40 amostras por métrica.

### 4.3 Atributos de cada amostra

| Atributo | Conteúdo |
|---|---|
| `run_id` | Id gerado a cada lançamento do app (uma repetição) |
| `route` | Tela atual no formato do Sentry, ex.: `/`, `/novo`, `/rota/[id]`; `startup` antes da primeira tela |
| `platform` | `android` / `ios` |
| `device_model` | Ex.: `SM-A546…` no A54, `iPhone17,3` no iPhone 16 |
| `cpu_cores` | Núcleos informados pelo sistema, para normalizar a CPU se desejado |
| `refresh_rate_hz` | Taxa de atualização da tela no momento; serve para conferir que o A54 está em 60 Hz |
| `thermal_state` | Android: `none`…`shutdown`; iOS: `nominal`/`fair`/`serious`/`critical` (escalas diferentes) |
| `power_save` | Economia de energia / Pouca Energia ligada |

### 4.4 Como desligar depois do TCC

Remova a linha `startPerfSampler()` de `app/_layout.tsx` (sem DSN ele também não liga) e reduza o `tracesSampleRate`. O módulo nativo pode continuar no projeto sem efeito.

### 4.5 Build local do Android (Windows)

É usada para validar rápido, sem gastar a cota do EAS. A build oficial do experimento continua sendo a do EAS, pelo mesmo pipeline do iOS.

1. **Cópia fora do OneDrive, em caminho curto e sem acento.** O OneDrive trava arquivos e o CMake tem limite de 260 caracteres.
   ```powershell
   git clone "C:\Users\Luigi\OneDrive\Área de Trabalho\Projeto Org Produtos" C:\dev\org
   cd C:\dev\org; git checkout feat/metricas-desempenho
   copy "C:\Users\Luigi\OneDrive\Área de Trabalho\Projeto Org Produtos\pedidos-lancamento-app\.env" pedidos-lancamento-app\.env
   cd pedidos-lancamento-app; npm ci
   ```
   Para atualizar depois, basta `git pull` em `C:\dev\org`.
2. **Android SDK** em `%LOCALAPPDATA%\Android\Sdk`, com `ANDROID_HOME` e `PATH` configurados. O Google trocou o `sdkmanager` pela nova *Android CLI* (`cmdline-tools\latest\bin\android.exe`). Os IDs usam barra e é um comando por pacote:
   ```powershell
   android --no-metrics sdk install platforms/android-35
   android --no-metrics sdk install build-tools/35.0.0
   android --no-metrics sdk install cmake/3.22.1
   android --no-metrics sdk install ndk/26.1.10909125
   ```
   O JDK 17 exigido pelo plugin Gradle do React Native é baixado sozinho pelo Gradle (foojay). O JDK 21 instalado serve para rodar o Gradle.
3. **Build + instalação:**
   ```powershell
   $env:SENTRY_DISABLE_AUTO_UPLOAD = "true"            # não envia source maps/símbolos
   $env:GRADLE_OPTS = "-Dorg.gradle.daemon=false"      # o daemon segura o terminal/log aberto
   npx expo prebuild -p android                        # só na primeira vez (gera android/)
   cd android; .\gradlew.bat app:assembleRelease -x lint -x test --build-cache
   adb install --user 0 -r app\build\outputs\apk\release\app-release.apk
   ```
   - `--user 0` evita um erro de permissão com a Pasta Segura da Samsung (usuário 150).
   - Antes da primeira instalação é preciso desinstalar o ORG do EAS, porque a assinatura é diferente.
   - A primeira build levou ~18 min; depois de mudança só em JS, ~4,5 min.
4. **Release no Sentry:** a build local não usa a numeração remota do EAS e aparece como `com.example.pedidoslancamento@1.0.0+1` ("1.0.0 (1)"), o mesmo rótulo da build 1 do iOS. Filtre por `os.name` ou `platform`.

### 4.6 Validação do instrumento contra as ferramentas do Android (29/09)

**Método (bancada):**
- A54 no cabo, a 60 Hz, com o app na lista de Pedidos (`route = /`, `run_id = mumvvi9j-e7chk2`).
- **CPU, 60 s** (~30 s parado + ~30 s rolando a lista): a cada 1 s, leitura de `/proc/<pid>/stat` (`utime + stime`, `CLK_TCK = 100`), a mesma fonte do `top`, com o relógio do aparelho. A leitura é feita pelo shell do adb, fora do app, então não o perturba.
- **Memória:** 6 leituras de `dumpsys meminfo <pid>` a cada 10 s, numa fase separada, porque o `dumpsys` faz o próprio app trabalhar e contaminaria a CPU.
- **Instrumento:** amostras `perf.*` lidas pela API do Sentry (`dataset=tracemetrics`, campo `timestamp_precise` com milissegundos), filtradas pelo `run_id`. O relógio do aparelho e o do PC diferiam só 0,4 s.
- **Pareamento:** CPU em janelas de 5 s. Memória pela amostra do instrumento mais próxima (≤ 6 s).

**Resultados:**

| Métrica | Referência Android | Instrumento | Diferença |
|---|---|---|---|
| CPU média (64 s) | 8,7% | 8,8% | 0,1 p.p. |
| CPU mediana / máxima | 6,4% / 28,3% | 5,8% / 30,0% | — |
| CPU, janelas de 5 s | — | — | diferença absoluta média **0,77 p.p.**; correlação **0,86** |
| PSS | 200,6 MB | 197,1 MB | **1,8%** |
| Native heap | 25,2 MB | 25,1 MB | **0,3%** |
| Graphics | 42,8 MB | 42,8 MB | **0,0%** |
| RSS | 271,2 MB (`TOTAL RSS` do dumpsys) | 230,7 MB | 14,9%, mas **~0,7%** descontando a memória de GPU (ver abaixo) |
| Java heap | 27,1 MB | 25,3 MB | 14,9% (dentro da oscilação do GC, ver abaixo) |

**Interpretação:**
- **RSS:** o `TOTAL RSS` do `dumpsys` **soma a memória de GPU** (`EGL mtrack` 32,6 + `GL mtrack` 8,3 = Graphics 40,9 MiB), que o RSS do kernel (`/proc/self/statm`, lido pelo instrumento) não contém. Subtraindo Graphics, a referência fica em ~229 MB contra 230,7 MB do instrumento. É diferença de definição, não erro.
- **Java heap:** oscila com o coletor de lixo. O próprio `dumpsys` variou de 20,3 a 31,9 MiB dentro de um minuto, e a diferença média (~2 MB) está dentro dessa oscilação.
- **Padrão em repouso:** a CPU tem picos a cada ~10–12 s, provavelmente o *polling* de 12 s do app (clientes e pedidos). Isso é relevante para a fase de repouso do protocolo.
- **FPS** não tem referência externa com a mesma definição: o `gfxinfo` conta quadros desenhados, que é outro conceito. Ele foi validado pelo método, que é o mesmo do monitor de desempenho do React Native, e pela coerência com a taxa da tela (≈119 a 120 Hz e ≈60 a 60 Hz).
- **Conclusão:** CPU e PSS (as métricas principais do Android) reproduzem as ferramentas do sistema, com diferença média de 0,1 p.p. na CPU e 1,8% no PSS.
- **Validade para 15 s:** a validação foi feita com coleta de 1 s. A coleta de 15 s usa o mesmo método (contadores acumulados), apenas com janelas maiores, então a CPU de 15 s é a média exata dos segundos validados.

### 4.7 Teste de sobrecarga do instrumento, A/B (06/10)

**Motivação:** o orientador observou que medir dentro do próprio app pode comprometer o desempenho, o efeito do observador. O teste mede esse custo **de fora do app**.

**Builds:**
- **A:** app sem medição. É a build local **sem o DSN**, e sem DSN o Sentry fica inerte: não monta integrações nem inicializa o SDK nativo, e o coletor não liga. Para gerar a build A foi preciso limpar o cache do Metro (`%TEMP%\metro-cache`), porque ele guarda o código transformado já com as variáveis `EXPO_PUBLIC_*` embutidas e reaproveitaria a versão com DSN. Isso foi conferido no APK: o DSN estava ausente na A e presente na B.
- **B:** a build do experimento (Sentry com tracing a 100% + coletor de 15 s).

**Método:**
- A54 no cabo, a 60 Hz.
- Ordem contrabalançada **A B A B B A**.
- Em cada rodada: instalação, app fechado, 30 s de pausa, abertura a frio, 60 s de estabilização na lista de Pedidos e **180 amostras de CPU sem toque (~195 s)**:
  - CPU por `/proc/<pid>/stat` a cada ~1,1 s (pausa de 1 s mais o tempo da leitura pelo adb). A média da rodada divide os ticks pelo tempo real decorrido, então o intervalo não precisa ser exato;
  - RSS por `/proc/<pid>/status` a cada 10 amostras (~11 s), ambos lidos pelo shell do adb, fora do app;
  - PSS por `dumpsys meminfo` no fim.
- Validade de cada rodada: ≥ 175 amostras de CPU, mesmo PID do início ao fim e app em primeiro plano. Na série final, só a rodada 3 foi repetida (a 1ª tentativa parou em 49 amostras). Duas séries anteriores, interrompidas pela perda do aparelho no adb, foram descartadas inteiras.
- Condições: estado térmico 0 em todas as rodadas; bateria de 66 a 69% (carregando pelo USB, igual para as duas builds).

**Resultados (3 rodadas por build, média ± desvio padrão):**

| Métrica | A (sem medição) | B (experimento) | B − A | t de Welch | p |
|---|---|---|---|---|---|
| CPU média | 11,49 ± 0,73% | 12,09 ± 0,58% | +0,60 p.p. (+5,2%) | 1,12 | 0,33 |
| RSS médio | 242,1 ± 2,1 MB | 246,4 ± 4,7 MB | +4,2 MB (+1,7%) | 1,43 | 0,25 |
| PSS final | 148,9 ± 9,5 MB | 147,5 ± 11,2 MB | −1,4 MB (−1,0%) | −0,17 | 0,87 |

**Planilha com os dados e o cálculo:** [dados/teste-sobrecarga-ab.xlsx](dados/teste-sobrecarga-ab.xlsx). Ela tem cinco abas:
- **Resumo:** a tabela acima, com fórmulas.
- **Rodadas:** os resultados de cada rodada.
- **CPU por amostra** e **RSS:** os dados brutos lidos pelo adb.
- **Método:** o procedimento.

Os resultados são fórmulas sobre os dados brutos, não valores colados, e por isso dá para refazer a conta no Excel ou no Google Planilhas. O p usa os graus de liberdade fracionários de Welch: `BETA.DIST(gl/(gl+t²); gl/2; 0,5; VERDADEIRO)`. A `DIST.T.BC` truncaria os graus de liberdade. O p foi conferido por integração numérica da distribuição t e bateu até a 6ª casa decimal.

**Correção (06/10):** a primeira versão desta tabela trazia t = 1,42 e p = 0,26 para o RSS, porque o t foi calculado com a diferença arredondada (4,2 MB). Com o valor exato (4,23 MB) ficam t = 1,43 e p = 0,25. A conclusão não muda.

**Interpretação:**
- A medição dentro do app acrescentou cerca de **0,6 ponto percentual de CPU** e **4 MB de memória residente**. São diferenças do mesmo tamanho da variação natural entre rodadas e **não significativas** (p > 0,05).
- Com 3 rodadas por build o poder estatístico é baixo. Por isso a conclusão correta é "a sobrecarga é pequena e indistinguível da variação natural", e não "a sobrecarga é zero".
- O instrumento está presente nas builds do experimento **das duas plataformas**, então seu custo não favorece Android nem iOS na comparação.
- A medição externa só foi possível no Android. No iOS ela exigiria macOS, e o custo é estimado pelo próprio instrumento (`perf.sampler.memory_read`).

**Sugestão de texto para o TCC:** *"Para avaliar o efeito do observador, o aplicativo foi medido externamente (via adb) com e sem a instrumentação, em seis rodadas contrabalançadas (ABABBA). A instrumentação acrescentou 0,60 ponto percentual de CPU (11,49 ± 0,73% contra 12,09 ± 0,58%; t de Welch = 1,12; p = 0,33) e 4,2 MB de memória residente (p = 0,25), diferenças não significativas e da mesma ordem da variação entre rodadas."*

**Lição operacional:** em três tentativas o servidor do `adb` no Windows "perdeu" o aparelho depois de ~10 min, mesmo com o USB ativo. O Windows continuava vendo a interface ADB, e reiniciar o servidor (`adb kill-server` / `start-server`) resolvia. Os scripts de bancada passaram a esperar o aparelho, repetir rodadas inválidas e reiniciar o servidor automaticamente.

### 4.8 Builds no EAS (06/10 e 13/10)

| Perfil | Para quê | Configuração |
|---|---|---|
| `preview` | APK do Android para os testes físicos | `env.SENTRY_DISABLE_AUTO_UPLOAD = "true"`, que contorna o 3º defeito da seção 2.4. É a mesma configuração da build local B |
| `ios-simulator` | Compilar o Swift do coletor nos Macs do EAS, sem conta Apple, antes de pedir a build do TestFlight. **Não instala no iPhone**: o app gerado só roda no Simulador do Xcode | Herda o `preview`, usa o ambiente `preview` do EAS (DSN, URL da API, chaves do Maps) e `ios.simulator = true` |

**Build de simulador (13/10, build `553c764f`, commit `1a0b450`, ~8 min): concluída.**
- **Antes de disparar:** o autolinking do Expo foi conferido no Windows com `npx expo-modules-autolinking resolve --platform ios`. Ele inclui o pod `PerfSampler` e registra o `PerfSamplerModule`. Isso exclui o risco de a build passar sem compilar o coletor, já que o `expo-module.config.json` usa a chave antiga `ios` em vez de `apple`.
- **No log:** o pod `PerfSampler` foi instalado e o `PerfSamplerModule.swift` foi compilado para arm64 e x86_64, sem avisos nem erros no arquivo. As APIs usadas (`task_info`, `clock_gettime_nsec_np`, `CADisplayLink`, `ProcessInfo`) são as mesmas no SDK do aparelho.
- **O que ela não valida:** o funcionamento no iPhone. Isso será conferido no Sentry depois da build do TestFlight, com as métricas `perf.*` chegando com `platform = ios`.
- **Numeração:** foi a primeira build iOS deste projeto no EAS, e o número de build remoto começou em 1. A build do TestFlight é feita na conta da outra pessoa, com numeração própria.

### 4.9 Conferência manual e automática no Android (13/10)

**Objetivo:** usar o app como no dia a dia (cadastro, pedido e rota) e conferir o que o coletor registra em cada tela. **Não é dado do TCC**, porque a bateria estava em 12 a 16% e carregando no cabo.

| | Manual | Automática (adb) |
|---|---|---|
| Execução (`run_id`) | `mv7by2b5-kd6k9d` | `mv7d5c56-apbu5r` |
| Horário | 20:46:45–20:54:47 | 21:20:24–21:28:45 |
| Leituras de CPU | 32 | 34 |
| Planilha | [dados/conferencia-manual-android-2026-10-13.xlsx](dados/conferencia-manual-android-2026-10-13.xlsx) | [dados/conferencia-automatica-android-2026-10-13.xlsx](dados/conferencia-automatica-android-2026-10-13.xlsx) |

**Roteiro:**
1. Lista de Pedidos parada (45 s) e rolando (30 s).
2. Clientes rolando (30 s).
3. Novo cliente.
4. Novo pedido.
5. Nova rota.
6. Iniciar a rota: 30 s mexendo no mapa e ~2,5 min parado.
7. Limpeza.

Diferenças da execução automática:
- O cliente novo foi preenchido e descartado, porque um cliente com pedidos não pode ser excluído. O pedido usou o cliente "Teste Tcc", que já existia.
- A navegação achou os botões por leituras de tela (`uiautomator dump`). Elas custam um pouco de CPU ao app nos momentos de navegação, mas não nas fases paradas.

Cada planilha tem três abas:
- **Resumo por tela:** média, máximo e mínimo de cada métrica, com fórmulas.
- **Leituras:** uma linha a cada 15 s.
- **Dados brutos:** o que veio da API do Sentry.

**Resultados:**

| Tela da rota parada, com GPS | Manual | Automática |
|---|---|---|
| CPU | 5,4–8,4% (≈ 7,3%) | 7,1–9,7% (≈ 8,1%) |
| FPS | 60,0 | 60,0 |
| Pior intervalo entre quadros | 17–24 ms | 17–30 ms |
| PSS | 258–292 MB | 262–292 MB |

- **Abertura do app:** pior intervalo de ~500 ms nas duas execuções (500 e 516 ms). A tela da rota usa ~100 MB a mais que a lista, por causa do mapa.
- **Interação:** mexer no mapa custou ~45–50% de CPU, e rolar listas, ~35–45%.
- **Telas com interação variam com o ritmo de quem usa.** Por exemplo, a tela de Clientes deu 46% na manual e 34% na automática. Por isso a comparação entre plataformas usa a tela da rota em regime (seção 6), que se repetiu nas duas execuções.

**Achados para o protocolo:**
- **Duas pausas curtas ao iniciar a rota (só no Android):**
  - O app chama `Location.requestForegroundPermissionsAsync()` duas vezes: em `getCurrentDeliveryPosition` (posição de partida) e em `useDeliveryLocation` (rastreamento contínuo).
  - No Android, cada chamada abre a tela de permissão do sistema (`GrantPermissionsActivity`) mesmo com a permissão já concedida. Ela fecha em 0,1 a 0,2 s, invisível, mas tira o app do primeiro plano. O log do Android confirmou: 21:24:41 e 21:24:44. O padrão se repetiu nas duas execuções.
  - O coletor pausa e descarta a janela em andamento, como previsto.
  - O código do experimento não muda. Nas sessões, os 10 minutos contam a partir de alguns segundos depois de "Iniciar rota".
  - Melhoria possível para depois do TCC: consultar a permissão (`getForegroundPermissionsAsync`) antes de pedir.
- **O `run_id` marca o processo do app, não a sessão.** Se o app volta do segundo plano sem reiniciar, o coletor continua no mesmo `run_id`. Isso aconteceu na conferência manual: o mapeamento de telas da execução automática entrou nela até 21:11. O protocolo já reinicia o aparelho entre as sessões, e a análise recorta cada sessão também pelo horário.
- **Exportação:** na API do Sentry, atributos numéricos e booleanos exigem a sintaxe tipada (`tags[refresh_rate_hz,number]`, `tags[cpu_cores,number]`, `tags[power_save,boolean]`). Sem ela, vêm vazios. Os valores estavam corretos: 60 Hz, 8 núcleos, economia de energia desligada e estado térmico `none` (normal no Android). As amostras levam de 1 a 2 min para aparecer na API.

**Incidentes da execução automática:**
- **A primeira tentativa (21:12) parou no passo 5.** O script montava o caminho da pasta no formato do Git Bash (`/tmp/...`), que o Node do Windows não abre quando a conversão de caminhos está desligada, e nenhum botão era achado. Ela foi interrompida antes de salvar qualquer coisa.
- **A segunda parou com segurança no arquivamento.** O primeiro toque numa lista filtrada só fecha o teclado, que é o comportamento padrão de listas do React Native. O pedido de teste foi arquivado em seguida, conferindo tela a tela.
- **O que ficou nos dados reais:** as rotas de teste aparecem canceladas no histórico, e o cliente "Teste Tcc" não pode ser excluído porque tem pedidos.

---

## 5. Definições para o texto do TCC

- **CPU (%):** `(tempo de CPU do processo no fim − no início) ÷ (tempo real decorrido) × 100`, medido a cada 15 s (média exata da janela) com `CLOCK_PROCESS_CPUTIME_ID`, o mesmo relógio nas duas plataformas.
  - 100% equivale a um núcleo inteiro e o valor pode passar de 100% com várias threads.
  - Para a porcentagem da capacidade total, divida por `cpu_cores`. Os núcleos dos dois aparelhos têm potências diferentes.
- **FPS da thread principal:** número de pulsos de vsync atendidos pela thread principal por segundo (`Choreographer` / `CADisplayLink`). Cai quando a thread principal trava. Com a tela parada, fica perto da taxa de atualização.
- **Pico de travada:** maior intervalo entre dois quadros em cada janela de 15 s.
- **Memória:**
  - RSS nas duas plataformas (mesmo conceito);
  - PSS no Android (métrica oficial, via smaps);
  - `phys_footprint` no iOS (memória suja + comprimida, o que o Xcode mostra; a Apple avisa que nenhuma API garante o mesmo valor exato do medidor).
- **Limitações a declarar:**
  - É CPU do app, não do aparelho.
  - As métricas oficiais de memória têm definições diferentes.
  - O FPS é da thread principal, não "quadros desenhados".
  - A amostragem usa um timer da thread JS. Os valores continuam corretos porque usam carimbos de tempo nativos, mas, se o JS travar, uma amostra cobre um período maior.
  - A leitura de memória custa CPU e está registrada em `perf.sampler.memory_read`.
  - Os frames do Sentry têm definições diferentes por plataforma (seção 2.2).
  - A duração de tela inclui rede e servidor.

---

## 6. Protocolo de coleta (checklist)

**Desenho do artigo:**
- 5 execuções por plataforma, 10 sessões no total.
- Cada sessão dura **10 minutos com o GPS ativo** (tela de rota, `route = /rota/[id]`).
- Coleta a cada **15 s** (Käld e Svensson, 2021), o que dá **40 amostras por métrica por sessão** e 200 por plataforma.
- O aparelho é **reiniciado entre as execuções**, então cada sessão é um lançamento novo, com `run_id` próprio.

1. **Estado inicial**
   - Bateria acima de um limite fixo e carregador desconectado.
   - Economia de energia/Pouca Energia desligada (conferir `power_save`).
   - **A54 em 60 Hz:** Tela → Suavidade de movimentos → Padrão (o nome pode variar; conferir `refresh_rate_hz = 60`).
   - Apps em segundo plano fechados.
   - Temperatura normal (conferir `thermal_state`).
   - Rede definida.
2. **Depois de reiniciar, aguardar ~3 min antes de abrir o app.** Logo após o boot o sistema fica ocupado (serviços, sincronizações), o que infla CPU e temperatura.
3. **Aquecer o backend.** O servidor está no plano gratuito do Render e hiberna após inatividade, então faça uma requisição antes de começar.
4. **Sessão:** abrir o app e iniciar a rota.
   - Anotar o **horário de início** alguns segundos depois de "Iniciar rota", porque no Android o início da rota causa duas pausas curtas do coletor (ver 4.9).
   - Manter 10 min na tela de rota com o GPS ativo.
   - O `run_id` da sessão é encontrado pelo horário da primeira amostra. A análise recorta a sessão pelos horários de início e fim.
5. **Comportamento de fundo do app:** o app faz polling a cada 12 s (clientes e pedidos) e, na rota, o GPS atualiza a cada 5 s ou 15 m. Isso faz parte do comportamento real e deve ser citado.
6. **Fim:** voltar para a tela inicial do celular e **aguardar ~10 s** antes de reiniciar. As métricas ficam em buffer e são enviadas nesse momento; reiniciar direto perde o fim da sessão. Anotar o horário.
7. **Bateria:** anotar a % no início e no fim de cada sessão. 1% não é a mesma energia nos dois aparelhos (o A54 tem 5.000 mAh).

---

## 7. Próximos passos

1. **Devolutiva do orientador (06/10):**
   - Aceita usar outra ferramenta além do Sentry. É a instrumentação própria, com o Sentry como canal de telemetria.
   - Alertou para o efeito do observador. Respondido com o teste A/B (ver 4.7).
   - Rotas: execuções **físicas** e depois **simuladas, com as mesmas rotas** (GPX gravado na rota física), para comparar o desvio padrão.
2. **Piloto Android local (concluído em 29/09, ver 4.1 e 4.5):** o app roda no A54, as métricas `perf.*` chegam ao Sentry e o FPS foi validado em 60 Hz.
3. **Build `preview` do Android no EAS:**
   - A de 06/10 (build `f7e2965d`, commit `dd231f2`) falhou pelo 3º defeito da seção 2.4.
   - A correção está no commit `1a0b450`, e a nova build ainda não foi disparada. A alternativa é usar a build local B nos testes físicos.
   - Para instalar no A54, desinstale antes a build que estiver lá, porque a assinatura é diferente.
   - Em 13/10 o hash do APK instalado no A54 confirmou que ele está com a build B. As builds A e B do teste A/B ficam guardadas em `C:\dev\apks`, com o commit no nome, porque a pasta temporária do Claude não é durável.
4. **Validar o instrumento contra as ferramentas do Android:** concluído em 29/09 (ver 4.6). No iOS, a referência equivalente exigiria um Mac (Instruments), então a validação iOS fica pelo método, que usa as mesmas APIs do kernel, e pela coerência com a taxa da tela.
5. **Plano B:** se o plano estudantil não aceitar métricas customizadas, enviar os valores como atributos de spans, que já chegam ao Sentry.
6. **iOS:**
   - **Precisa de uma build nova.** A build atual do iPhone (TestFlight, feita do `main` 0397d3c) não tem o coletor e roda com profiling a 100% (`profilesSampleRate: 1.0`), um custo que só o iPhone pagaria.
   - A build de simulador foi concluída em 13/10 e o Swift compila (ver 4.8).
   - **Próximo passo:** deixar o código acessível à pessoa do iOS, com merge no `main` e push ou com a build feita direto do branch. Ela gera a build do TestFlight seguindo `BUILD_IOS.md`. Qualquer commit a partir de `14733be` tem o mesmo código de app da build B do Android.
   - Depois, conferir no Sentry as métricas `perf.*` com `platform = ios`, e desligar o Modo de Pouca Energia nas sessões. A tela do iPhone 16 é de 60 Hz, como o A54 configurado.
7. **Exportar os dados no dia de cada sessão**, porque a retenção é de 30 dias.
   - Use `scripts/sentry/exportar-execucao.js`, com recorte pelos horários da sessão, e `scripts/planilhas/gerar-planilha-sessao.js`. O passo a passo está em [scripts/README.md](scripts/README.md).
   - A API é `GET /api/0/organizations/org-sentry/events/` com `dataset=tracemetrics`, confirmado nas conferências de 13/10, e um token só de leitura.
   - Atributos numéricos e booleanos exigem a sintaxe tipada (ver 4.9).

---

## 8. Commits desta sessão (branch `feat/metricas-desempenho`)

| Commit | Conteúdo |
|---|---|
| `deec03b` | `feat: adicionar modulo nativo de metricas de desempenho` |
| `5c002a9` | `chore: desativar profiling do Sentry` |
| `5245415` | `feat: enviar cpu, memoria e fps para o Sentry` |
| `5ed301c` | `docs: documentar auditoria do Sentry e metricas de desempenho do TCC` |
| `cab3de9` | `fix: corrigir inclusao duplicada do Sentry no build Android` |
| `624f8aa` | `fix: remover integracao do Sentry que fecha o app sem expo-updates` |
| `daefacc` | `docs: registrar build local do Android e correcoes do Sentry 8.26` |
| `65750e8` | `docs: registrar validacao das metricas no Android` |
| `fc2afce` | `docs: registrar validacao do instrumento contra o adb` |
| `14733be` | `feat: coletar metricas de desempenho a cada 15 segundos` |
| `dd231f2` | `docs: atualizar coleta para 15 segundos e protocolo do artigo` |
| `689c49e` | `docs: registrar teste de sobrecarga do instrumento` |
| `61d44b2` | `docs: exportar planilha do teste de sobrecarga` |
| `1a0b450` | `fix: corrigir build preview do EAS e adicionar perfil de simulador iOS` |
| `1498805` | `docs: registrar falha do EAS no Android e build de simulador iOS` |
| `331ddb7` | `docs: corrigir build instalada no A54` |
| `9bbbbe3` | `docs: registrar conferencia manual e automatica no Android` |

---

## 9. Fontes

- Código-fonte instalado: `@sentry/react-native` 8.26.0 (`node_modules/@sentry/react-native`); 6.10.0 baixado via `npm pack`; `react-native` 0.76.9 (`FpsDebugFrameCallback.kt`, `RCTPerfMonitor.mm`, `RCTFPSGraph.mm`).
- [Sentry — retenção de dados](https://docs.sentry.io/security-legal-pii/security/data-retention-periods/) · [preços](https://docs.sentry.io/pricing/) · [plano educacional](https://sentry.io/for/education/) · [métricas no React Native](https://docs.sentry.io/platforms/react-native/metrics/) · [API de consulta](https://docs.sentry.io/api/explore/query-explore-events-in-table-format/)
- [sentry-cocoa PR #8323 (escala da CPU)](https://github.com/getsentry/sentry-cocoa/pull/8323) · [sentry-java `AndroidProfiler`](https://github.com/getsentry/sentry-java/blob/8.56.0/sentry-android-core/src/main/java/io/sentry/android/core/AndroidProfiler.java)
- [AOSP `getElapsedCpuTime`](https://github.com/aosp-mirror/platform_frameworks_base/blob/main/core/jni/android_util_Process.cpp) · [AOSP `Choreographer`](https://github.com/aosp-mirror/platform_frameworks_base/blob/main/core/java/android/view/Choreographer.java) · [AOSP `Debug`](https://github.com/aosp-mirror/platform_frameworks_base/blob/main/core/java/android/os/Debug.java) · [Google: `/proc/stat` bloqueado no Android 8](https://issuetracker.google.com/issues/37140047)
- [Apple `CADisplayLink`](https://developer.apple.com/documentation/quartzcore/cadisplaylink) · [`clock_gettime` (Libc)](https://github.com/apple-oss-distributions/Libc/blob/main/gen/clock_gettime.3) · [`task_info.h` (XNU)](https://github.com/apple-oss-distributions/xnu/blob/main/osfmk/mach/task_info.h) · [WWDC18 iOS Memory Deep Dive](https://developer.apple.com/videos/play/wwdc2018/416/) · [fórum Apple: footprint × Xcode](https://developer.apple.com/forums/thread/105088)
- [Expo — módulos locais](https://docs.expo.dev/modules/get-started/) · [Flashlight](https://github.com/bamlab/flashlight)
