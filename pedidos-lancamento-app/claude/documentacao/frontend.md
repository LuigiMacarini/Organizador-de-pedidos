# Frontend — Projeto ORG

> Documenta exclusivamente o frontend e a experiência do usuário: tecnologias, estrutura, telas, decisões de UX/UI, performance e sincronização. O contrato de comunicação com o servidor está em `api.md`; a implementação do servidor, em `backend.md`.

---

## 3.1 Tecnologias

| Categoria | Tecnologia | Uso real no projeto |
|---|---|---|
| Framework | Expo SDK 52 (`expo: ~52.0.28`) sobre React Native `0.76.6` | Base do app mobile/web |
| Linguagem | TypeScript `~5.3.3`, modo `strict` | `tsconfig.json` |
| Roteamento / build tool | Expo Router `~4.0.17` | Roteamento por arquivos (`app/`); também resolve *code splitting* por rota |
| Empacotador | Metro, via CLI do Expo | `app.json` (`"bundler": "metro"` para a saída web) |
| Gerenciamento de estado | React Context API (nativa do React) | `AuthProvider`, `CustomersProvider`, `OrdersProvider`, `ProductsProvider` |
| Gerenciamento de requisições | Função própria sobre `fetch` (`apiRequest`, `src/api/httpClient.ts`) | Sem biblioteca de *data fetching* |
| Armazenamento seguro de sessão | `expo-secure-store ~14.0.1` | `src/auth/tokenStorage.ts` |
| Seleção/leitura de arquivo | `expo-document-picker`, `expo-file-system` | Importação de clientes via CSV |
| Ícones | `@expo/vector-icons` (`Ionicons`) | Em diversos componentes |
| Suporte de navegação/gestos | `react-native-gesture-handler`, `react-native-reanimated`, `react-native-screens`, `react-native-safe-area-context` | Exigidos pelo Expo Router |
| Execução em navegador | `react-native-web` | Permite rodar o mesmo código como app web |

Bibliotecas que **não** foram encontradas no projeto, apesar de comuns em apps desse tipo: Redux/Zustand/MobX/Recoil (estado global), React Query/SWR/Apollo (requisições/cache), Axios (HTTP), qualquer biblioteca de CSV. **Não identificado no código atual.**

---

## 3.2 Estrutura

```text
app/                        Rotas (Expo Router, baseado em arquivos)
  _layout.tsx                 Layout raiz: providers globais + guarda de rota
  login.tsx                   Tela de login
  (tabs)/_layout.tsx           Navegação em abas
  (tabs)/index.tsx             Lista de pedidos
  (tabs)/clientes.tsx          Lista de clientes
  novo.tsx                    Criação de pedido
  pedido/[id].tsx               Detalhe/edição/arquivamento de pedido
  cliente/novo.tsx              Criação de cliente
  cliente/[id].tsx                Detalhe/edição/exclusão de cliente
  clientes/importar.tsx          Importação de clientes via CSV
  fechar-mes.tsx                 Arquivamento em lote (fim de mês)

src/
  api/                    authRemote.ts, customersRemote.ts, ordersRemote.ts,
                            productsRemote.ts, httpClient.ts (cliente HTTP genérico)
  auth/                   authContext.tsx (estado de sessão), tokenStorage.ts
  components/             PrimaryButton, FieldLabel, SearchBar, CustomerForm,
                            CustomerSelect, OrderForm
  components/order-form/   ProductRow.tsx, OrderSummary.tsx (subcomponentes do pedido)
  domain/                 order.ts (cálculo de total, mapeamento de itens)
  hooks/                  useAutoRefresh.ts (polling de sincronização)
  utils/                  format.ts (moeda), text.ts (normalização de busca)
  customersContext.tsx / ordersContext.tsx / productsContext.tsx   Contextos de estado
  types.ts                 Tipos compartilhados do domínio no frontend
  theme.ts                 Paleta de cores, espaçamentos, raios
  config.ts                 Resolução da URL base da API
  csv.ts                    Parser de CSV (implementação própria)
```

Não há pasta de *hooks* de negócio além de `useAutoRefresh`; os próprios *contexts* expõem os hooks de acesso (`useCustomers`, `useOrders`, `useProducts`, `useAuth`).

### Padrões encontrados

- Um *context* por recurso, cada um seguindo o mesmo formato: estado (`useState`), função `refresh` (`useCallback`), efeito de carga inicial (`useEffect`), operações de escrita que atualizam o estado local de forma otimista e, em seguida, disparam um `refresh` silencioso.
- Componentes de formulário recebendo `initial`, `submitLabel`, `onSubmit`, `busy` como *props* — mesmo padrão em `CustomerForm.tsx` e `OrderForm.tsx`, reaproveitado tanto na tela de criação quanto na de edição.

---

## 3.3 Interface

| Tela/Componente | Arquivo | Descrição |
|---|---|---|
| Login | `app/login.tsx` | Formulário de e-mail/senha; alerta diferenciado para erro de rede × credencial inválida |
| Lista de pedidos | `app/(tabs)/index.tsx` | Pedidos agrupados por cliente, com busca por nome |
| Lista de clientes | `app/(tabs)/clientes.tsx` | Lista com busca, contagem de pedidos por cliente e atalho para importar CSV |
| Novo pedido | `app/novo.tsx` | Usa `OrderForm.tsx` |
| Detalhe/edição de pedido | `app/pedido/[id].tsx` | Usa `OrderForm.tsx`; inclui ação de arquivar |
| Novo cliente / Edição de cliente | `app/cliente/novo.tsx`, `app/cliente/[id].tsx` | Usam `CustomerForm.tsx` |
| Importação de clientes | `app/clientes/importar.tsx` | Seleciona arquivo CSV, mostra prévia, importa em lote |
| Fechar mês | `app/fechar-mes.tsx` | Seleciona pedidos do mês corrente e arquiva em lote |
| Seleção de cliente | `src/components/CustomerSelect.tsx` | Modal em formato de *bottom sheet*, com busca e opção de cadastrar cliente novo na hora |
| Seleção de produtos / catálogo | `src/components/OrderForm.tsx` + `src/components/order-form/ProductRow.tsx` | Catálogo em acordeão, com busca incremental |
| Resumo do pedido | `src/components/order-form/OrderSummary.tsx` | Lista os itens do pedido, quantidades e total |

**Bottom sheets**: usado apenas no seletor de cliente (`CustomerSelect.tsx`), implementado com o componente `Modal` do React Native (`animationType="slide"`), com fundo do *backdrop* sólido (cor do tema, sem transparência).

**Accordions/grupos retráteis**: catálogo de produtos em `OrderForm.tsx`, com uma única categoria expandida por vez (estado `expandedCategory`).

**Campos de pesquisa**: `SearchBar.tsx` (componente genérico) usado na busca de clientes e na busca do catálogo de produtos.

**Feedback visual**: item de produto com quantidade selecionada recebe borda lateral colorida + fundo diferenciado (`ProductRow.tsx`); alertas de erro diferenciam problema de rede de problema de credencial (`app/login.tsx`, `src/api/httpClient.ts`).

---

## 3.4 UX/UI

- **Mobile first**: adotado explicitamente como diretriz a partir de um ponto do desenvolvimento (registrado em comentário no próprio código, `src/components/OrderForm.tsx`), priorizando áreas de toque maiores e menos rolagem.
- **Responsividade**: contêineres principais usam `maxWidth: 720` + `width: "100%"` + `alignSelf: "center"`, permitindo que o mesmo layout funcione em tela de celular ou tela larga (tablet/web), sem duplicar código de layout.
- **Touch interaction**: alvos de toque com altura mínima definida (ex.: 52px no cabeçalho de categoria do catálogo; 44px nos botões principais).
- **Hierarquia visual**: paleta neutra com um único tom de destaque, tipografia com pesos diferenciados por importância, sem sombras (`src/theme.ts`).
- **Pesquisa incremental**: busca do catálogo aplicada a cada tecla digitada (sem atraso/debounce), normalizando acentuação, caixa e pontuação antes de comparar (`src/utils/text.ts`, função `normalizeForSearch`) — por exemplo, "agua" encontra "Água Sanitária 5L".
- **Grupos retráteis**: catálogo em acordeão de categoria única — abrir uma categoria fecha a anterior; quando a busca restringe o resultado a uma única categoria, ela é aberta automaticamente.
- **Estados de seleção**: descrito em 3.3 (feedback visual do `ProductRow`).
- **Navegação**: pilha de telas (`Stack`, Expo Router) por cima de navegação em abas (`Tabs`) para "Pedidos" e "Clientes"; guarda de rota redireciona para `/login` quando não há sessão válida, e da tela de login para a inicial quando já há sessão (`app/_layout.tsx`, hook `useProtectedRoute`).

---

## 3.5 Performance

Estratégias efetivamente implementadas:

- **Memoização de componente**: `ProductRow.tsx` envolvido em `React.memo`; os callbacks `onAdjust`/`onSetQty` são criados uma única vez no componente pai (`useCallback` sem dependências instáveis), de forma que cada linha de produto só renderiza de novo quando a própria quantidade daquele produto muda.
- **Virtualização de lista**: `SectionList`, nativa do React Native, usada no catálogo de produtos — sem biblioteca adicional de virtualização.
- **Redução de renderizações em atualizações automáticas**: o `refresh` disparado pelo polling e pelas escritas não altera o indicador de carregamento da tela (parâmetro `silent`), evitando que a lista "pisque" a cada ciclo.
- **Requisições controladas**: o polling é pausado quando o app vai para segundo plano (ver seção 3.6).
- **Paginação no consumo de dados**: o catálogo de produtos (`GET /v1/products`) não usa paginação — volume pequeno (dezenas de itens); clientes e pedidos usam paginação por cursor no backend, mas o app hoje busca uma única página grande (até 200 itens) em vez de paginação incremental na interface.

Estratégias **não identificadas no código atual**:

- *Debounce* na busca — a filtragem ocorre a cada tecla, sem atraso artificial; viável pelo tamanho pequeno do catálogo.
- Cache de requisições (React Query, SWR ou equivalente) — os *contexts* mantêm o estado em memória durante a navegação, sem persistência em disco.
- *Lazy loading* de telas além do que o próprio Expo Router já oferece por padrão (uma tela por arquivo de rota).

---

## 3.6 Sincronização

O app **não usa WebSocket nem Webhook**. A atualização de dados entre dispositivos é feita por *polling* (requisições GET repetidas), implementado no hook `src/hooks/useAutoRefresh.ts` e usado dentro de `CustomersProvider` (`src/customersContext.tsx`) e `OrdersProvider` (`src/ordersContext.tsx`). **Não é usado em `ProductsProvider`** — o catálogo não é atualizado periodicamente.

Comportamento:

- Intervalo de repetição: 12 segundos (constante `DEFAULT_INTERVAL_MS`).
- Usa a API `AppState` do React Native: o intervalo é **interrompido** quando o app vai para segundo plano e uma **atualização imediata** é disparada assim que o app volta ao primeiro plano, antes de retomar o ciclo periódico.
- **Após qualquer mutação** (criar/atualizar/excluir cliente; criar/atualizar/arquivar/reabrir pedido), o estado local já é atualizado imediatamente com a resposta da própria operação (atualização otimista), e — em paralelo, sem bloquear a interface — um novo `GET` da lista correspondente é disparado (`void refresh({ silent: true })`).
- O `refresh` disparado pelo polling ou por uma mutação é **silencioso**: não ativa o indicador de carregamento da tela e, em caso de falha pontual (ex.: instabilidade de rede), **mantém os dados já exibidos** em vez de limpar a lista — evita que uma falha passageira do polling apague a tela do usuário.

```text
App em primeiro plano
   ↓
useAutoRefresh dispara refresh silencioso a cada 12s
   ↓
GET /v1/customers e GET /v1/orders
   ↓
Lista local substituída pela resposta do servidor
   ↓
App vai para segundo plano → polling interrompido
   ↓
App volta ao primeiro plano → refresh imediato + polling retomado
```

---

## Estado real do projeto (frontend)

### Implementado

Tudo o que está descrito nas seções 3.1 a 3.6.

### Parcialmente implementado

- Sincronização entre dispositivos: funcional como MVP via polling; não cobre o catálogo de produtos, apenas clientes e pedidos.
- Paginação: existe no backend, mas o app não expõe "carregar mais" — busca uma página única e grande.

### Planejado / melhorias futuras

- Sincronização em tempo real via WebSocket, no lugar do polling atual.
- Tela de administração de catálogo (os endpoints já existem na API — ver `api.md`).
- App do Cliente e app do Entregador (fora do escopo deste frontend).
- Roteirização de entregas.
- Testes automatizados de frontend — **não identificados no projeto atual**.

---

## Problemas encontrados e soluções aplicadas

Registro de problemas reais identificados durante o desenvolvimento desta etapa do projeto, com impacto em frontend/integração com a API:

**Guarda de rota quebrava a tela fora dos Providers**
Alteração: a implementação inicial da guarda de autenticação (redirecionamento para `/login`) declarava as telas do `Stack` do Expo Router condicionalmente (só registrava as telas internas quando havia sessão). No Expo Router v4, isso não impede o roteador de tentar resolver a URL atual para uma tela não declarada, causando erro (`useOrders must be used within OrdersProvider`) por a tela montar fora dos *providers* de contexto.
Solução: todas as telas passaram a ficar sempre declaradas no `Stack`; a guarda de acesso passou a ser feita por redirecionamento (`useProtectedRoute`, baseado em `useSegments`/`useRouter`), sem omitir telas do roteador.
Arquivo: `app/_layout.tsx`.

**Listas não recarregavam após o login**
Alteração: os *providers* de clientes/produtos/pedidos buscavam dados uma única vez, na montagem — momento em que ainda não havia sessão (token). O login acontecia depois, sem que esses *providers* fossem notificados para buscar novamente.
Solução: o efeito de carga inicial de cada *provider* passou a depender do usuário autenticado (`useAuth().user`), refazendo a busca sempre que o login muda.
Arquivos: `src/customersContext.tsx`, `src/ordersContext.tsx`, `src/productsContext.tsx`.

**Indicador de carregamento piscando durante a sincronização automática**
Alteração: ao implementar o *polling* de sincronização, o `refresh` reaproveitado ativava o mesmo indicador de carregamento usado na carga inicial, fazendo a lista "sumir" a cada ciclo de atualização automática.
Solução: `refresh` passou a aceitar um parâmetro `silent`, usado pelo *polling* e pelas atualizações pós-escrita, que não altera o estado de carregamento nem limpa a lista em caso de falha pontual.
Arquivos: `src/customersContext.tsx`, `src/ordersContext.tsx`.

**Endereço da API local (IP de rede) ficando desatualizado**
Alteração: em desenvolvimento, o app apontava para o IP local da máquina que roda a API (`EXPO_PUBLIC_API_URL`). Esse IP muda sempre que a máquina troca de rede, quebrando a conexão do app sem aviso claro (a requisição simplesmente falhava).
Solução, em duas partes: (1) publicação da API em um endereço público fixo (Render), eliminando a dependência do IP local para o uso cotidiano do app; (2) diferenciação explícita, no cliente HTTP, entre falha de rede (`NetworkError`) e falha de credencial/negócio (`ApiError`), com mensagens de alerta diferentes na tela de login.
Arquivos: `src/api/httpClient.ts`, `app/login.tsx`, `src/config.ts`.

**Catálogo de produtos reintroduzido como acordeão**
Alteração: numa etapa anterior do desenvolvimento, o catálogo havia sido reescrito como lista plana com cabeçalhos fixos (`SectionList` sem recolhimento), para priorizar a virtualização da lista. Um pedido de UX posterior exigiu grupos retráteis (uma categoria aberta por vez) para reduzir a quantidade de conteúdo visível ao mesmo tempo.
Solução: em vez de reintroduzir uma lista aninhada (o que quebraria a virtualização), a categoria fechada continua com seus itens presentes na `SectionList`, mas a função `renderItem` retorna `null` para eles — o conteúdo não ocupa espaço na tela, mas a lista continua sendo uma única `SectionList` virtualizada.
Arquivo: `src/components/OrderForm.tsx`.

---

## Pontos que precisam de confirmação

- **Campo `orderCount` da API não é usado pelo frontend**: o backend calcula e retorna `orderCount` em `CustomerDTO` (contagem de **todos** os pedidos do cliente, inclusive arquivados), mas a tela de clientes (`app/(tabs)/clientes.tsx`) calcula sua própria contagem localmente, a partir da lista de pedidos carregada em memória — que contém apenas pedidos com `status = PENDING`. Ou seja, o número hoje exibido ao usuário é "pedidos em aberto", não o total histórico que o campo da API sugere. Vale decidir se isso é uma inconsistência a corrigir antes de citar esse comportamento no TCC.
- **Campo `address` de cliente**: existe no tipo do frontend (`src/types.ts`) e no banco, mas não há campo correspondente no formulário de cadastro/edição de cliente (`CustomerForm.tsx`).
