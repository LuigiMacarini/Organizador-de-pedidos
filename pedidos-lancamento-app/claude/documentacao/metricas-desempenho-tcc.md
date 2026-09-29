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
- **Plano estudantil** (página oficial): 50K erros, 5M spans, 500 replays. Profiling de celular é **só pago à parte** (PAYG), a US$ 0,25 por *UI profile hour*. A cota de métricas customizadas não aparece na página oficial.

### 2.4 Por que não usar ferramentas externas como fonte principal

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
| 8 | Amostragem de 1 s para CPU/FPS e de 5 s para memória, com a duração da leitura de memória registrada | Ler o PSS custa CPU do próprio app. O intervalo maior reduz a interferência, e registrar a duração torna esse custo mensurável |
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
- Kotlin e Swift **não puderam ser compilados localmente** (não há Android SDK nem Mac). Por isso foram escritos espelhando código já compilado no projeto: `expo-speech`, `expo-location` e o Swift do próprio sentry-cocoa.

### 4.2 Métricas enviadas ao Sentry

| Métrica | Unidade | Plataforma | Definição | Frequência |
|---|---|---|---|---|
| `perf.cpu` | percent | ambas | Δ tempo de CPU do processo ÷ Δ tempo real × 100 (100% = um núcleo inteiro) | 1 s |
| `perf.fps.ui` | — | ambas | Callbacks de quadro da thread principal ÷ segundos decorridos | 1 s |
| `perf.frame.max_interval` | millisecond | ambas | Maior intervalo entre dois quadros no período (pico de travada) | 1 s |
| `perf.memory.rss` | byte | ambas | Resident set size | 5 s |
| `perf.memory.pss` | byte | Android | PSS total (`Debug.MemoryInfo.getTotalPss`) | 5 s |
| `perf.memory.java_heap`, `native_heap`, `graphics` | byte | Android | Divisão do PSS (as mesmas categorias do Memory Profiler) | 5 s |
| `perf.memory.footprint` | byte | iOS | `phys_footprint` (valor do medidor de memória do Xcode) | 5 s |
| `perf.memory.footprint_peak` | byte | iOS | Pico de `phys_footprint` desde o início do processo (kernel) | 5 s |
| `perf.sampler.memory_read` | millisecond | ambas | Custo da própria leitura de memória | 5 s |

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

---

## 5. Definições para o texto do TCC

- **CPU (%):** `(tempo de CPU do processo no fim − no início) ÷ (tempo real decorrido) × 100`, medido a cada 1 s com `CLOCK_PROCESS_CPUTIME_ID`, o mesmo relógio nas duas plataformas.
  - 100% equivale a um núcleo inteiro e o valor pode passar de 100% com várias threads.
  - Para a porcentagem da capacidade total, divida por `cpu_cores`. Os núcleos dos dois aparelhos têm potências diferentes.
- **FPS da thread principal:** número de pulsos de vsync atendidos pela thread principal por segundo (`Choreographer` / `CADisplayLink`). Cai quando a thread principal trava. Com a tela parada, fica perto da taxa de atualização.
- **Pico de travada:** maior intervalo entre dois quadros em cada segundo.
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

1. **Estado inicial**
   - Bateria acima de um limite fixo e carregador desconectado.
   - Economia de energia/Pouca Energia desligada (conferir `power_save`).
   - **A54 em 60 Hz:** Tela → Suavidade de movimentos → Padrão (o nome pode variar; conferir `refresh_rate_hz = 60`).
   - Apps em segundo plano fechados.
   - Temperatura normal (conferir `thermal_state`).
   - Rede definida.
2. **Aquecer o backend.** O servidor está no plano gratuito do Render e hiberna após inatividade, então faça uma requisição antes de começar.
3. **Cada repetição é um lançamento novo:** feche o app antes e anote o **horário de início**. O `run_id` de cada repetição é encontrado pelo horário da primeira amostra.
4. **Repouso:** app aberto sem interação por um tempo fixo. O app faz polling a cada 12 s (clientes e pedidos); isso faz parte do comportamento real e deve ser citado.
5. **Operações:** roteiro fixo e idêntico nas duas plataformas.
6. **Fim:** volte para a tela inicial do celular, **aguarde ~5 s** para as métricas serem enviadas e só então feche o app. Anote o horário.
7. **Bateria:** anote a % no início e no fim de cada sessão. 1% não é a mesma energia nos dois aparelhos (o A54 tem 5.000 mAh).
8. **Repetições e duração:** definir no piloto e com o orientador.

---

## 7. Próximos passos

1. **Validar com o orientador** o uso de instrumentação própria e a definição de FPS.
2. **01/10 — piloto Android:**
   - `npx eas-cli build --platform android --profile preview` a partir deste branch e instalar no A54.
   - No Sentry, confirmar que chegam `perf.*` com os atributos esperados. O caminho no menu (provavelmente Explore → Metrics) será confirmado no piloto.
   - Conferir a release `com.example.pedidoslancamento@1.0.0+15` com SDK 8.26.0.
3. **Validar o instrumento uma vez, em casa:** comparar `perf.cpu` e `perf.memory.pss` com `adb shell top` e `adb shell dumpsys meminfo com.example.pedidoslancamento`.
4. **Plano B:** se o plano estudantil não aceitar métricas customizadas, enviar os valores como atributos de spans, que já chegam ao Sentry.
5. **iOS:**
   - Com o piloto aprovado, fazer merge no `main` e push. A pessoa do iOS gera a nova build do mesmo commit, seguindo `BUILD_IOS.md`.
   - Opcional, para reduzir risco: uma build de simulador iOS no EAS da sua conta (`"ios": { "simulator": true }`), só para confirmar que o Swift compila antes de pedir a build do TestFlight.
6. **Exportar os dados após cada sessão**, porque a retenção é de 30 dias. A API é `GET /api/0/organizations/org-sentry/events/` com `dataset=spans` (transactions) ou `dataset=tracemetrics` (métricas; o dataset certo será confirmado no piloto), com um token `org:read`.

---

## 8. Commits desta sessão (branch `feat/metricas-desempenho`)

| Commit | Conteúdo |
|---|---|
| `deec03b` | `feat: adicionar modulo nativo de metricas de desempenho` |
| `5c002a9` | `chore: desativar profiling do Sentry` |
| `5245415` | `feat: enviar cpu, memoria e fps para o Sentry` |

---

## 9. Fontes

- Código-fonte instalado: `@sentry/react-native` 8.26.0 (`node_modules/@sentry/react-native`); 6.10.0 baixado via `npm pack`; `react-native` 0.76.9 (`FpsDebugFrameCallback.kt`, `RCTPerfMonitor.mm`, `RCTFPSGraph.mm`).
- [Sentry — retenção de dados](https://docs.sentry.io/security-legal-pii/security/data-retention-periods/) · [preços](https://docs.sentry.io/pricing/) · [plano educacional](https://sentry.io/for/education/) · [métricas no React Native](https://docs.sentry.io/platforms/react-native/metrics/) · [API de consulta](https://docs.sentry.io/api/explore/query-explore-events-in-table-format/)
- [sentry-cocoa PR #8323 (escala da CPU)](https://github.com/getsentry/sentry-cocoa/pull/8323) · [sentry-java `AndroidProfiler`](https://github.com/getsentry/sentry-java/blob/8.56.0/sentry-android-core/src/main/java/io/sentry/android/core/AndroidProfiler.java)
- [AOSP `getElapsedCpuTime`](https://github.com/aosp-mirror/platform_frameworks_base/blob/main/core/jni/android_util_Process.cpp) · [AOSP `Choreographer`](https://github.com/aosp-mirror/platform_frameworks_base/blob/main/core/java/android/view/Choreographer.java) · [AOSP `Debug`](https://github.com/aosp-mirror/platform_frameworks_base/blob/main/core/java/android/os/Debug.java) · [Google: `/proc/stat` bloqueado no Android 8](https://issuetracker.google.com/issues/37140047)
- [Apple `CADisplayLink`](https://developer.apple.com/documentation/quartzcore/cadisplaylink) · [`clock_gettime` (Libc)](https://github.com/apple-oss-distributions/Libc/blob/main/gen/clock_gettime.3) · [`task_info.h` (XNU)](https://github.com/apple-oss-distributions/xnu/blob/main/osfmk/mach/task_info.h) · [WWDC18 iOS Memory Deep Dive](https://developer.apple.com/videos/play/wwdc2018/416/) · [fórum Apple: footprint × Xcode](https://developer.apple.com/forums/thread/105088)
- [Expo — módulos locais](https://docs.expo.dev/modules/get-started/) · [Flashlight](https://github.com/bamlab/flashlight)
