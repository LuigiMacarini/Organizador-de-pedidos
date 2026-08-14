# Documentação Técnica do Projeto ORG — Materiais e Métodos

> Documento gerado a partir da análise direta do código-fonte do projeto, na pasta `pedidos-lancamento-app/`, nas subpastas `app/`, `src/` (frontend) e `server/` (backend). Serve como material de apoio para a redação da seção "Materiais e Métodos" do TCC — não é o texto final do capítulo.

---

## 3.1 Visão geral do projeto

**Objetivo do sistema:** centralizar o lançamento e o acompanhamento de pedidos de uma microempresa (revenda de produtos de limpeza, a julgar pelo catálogo cadastrado — ver `server/prisma/seed.ts`), substituindo um controle manual/informal por um sistema com cadastro de clientes, catálogo de produtos administrável e lançamento de pedidos com cálculo automático de valores.

**Problema que o sistema busca resolver:** antes da versão atual, clientes e pedidos eram armazenados localmente no dispositivo (via `AsyncStorage`), sem compartilhamento entre aparelhos e sem autenticação. Isso impedia que mais de uma pessoa trabalhasse com os mesmos dados ao mesmo tempo. A versão atual move toda a persistência para um servidor central com banco de dados compartilhado, acessível por múltiplos dispositivos autenticados.

**Contexto de utilização:** aplicativo mobile-first (mas também executável em navegador via Expo Web), pensado para uso pelo dono da microempresa e por funcionários no lançamento diário de pedidos. Faz parte de um projeto maior planejado em etapas (o próprio TCC), que prevê no futuro aplicativos separados para o Cliente final e para o Entregador — nenhum dos dois está implementado no estado atual do código.

**Principais funcionalidades implementadas atualmente:**
- Autenticação por login (e-mail/senha).
- Cadastro, consulta, atualização e exclusão de clientes.
- Importação de clientes em lote via arquivo CSV.
- Catálogo de produtos (mantido no backend, consumido pelo app).
- Lançamento, edição e arquivamento de pedidos.
- Encerramento de mês ("fechar mês") com arquivamento em lote.
- Sincronização automática de listas entre dispositivos via requisições periódicas (polling).

---

## 3.2 Arquitetura da aplicação

O repositório contém duas aplicações independentes dentro da mesma pasta de projeto:

- **Frontend**: app Expo/React Native, nas pastas `app/` (rotas) e `src/` (lógica, componentes, integração com API).
- **Backend**: API HTTP em `server/`, com o código-fonte em `server/src/`.

As duas se comunicam exclusivamente por **HTTP/REST**, trocando dados em **JSON**, com autenticação via **token JWT** enviado no cabeçalho `Authorization: Bearer <token>`. Não há acesso direto do frontend ao banco de dados em nenhuma circunstância — toda operação passa pela API.

### Separação de camadas no backend

O backend segue uma organização em camadas (não é um framework como NestJS — é uma separação manual por pastas, sem *dependency injection* ou decorators):

```
server/src/
  domain/          tipos, DTOs e regras de validação (Zod) — sem dependência de Fastify/Prisma
  application/      casos de uso (services) que orquestram repositórios + regras de domínio
  infrastructure/    acesso a dados (Prisma) e serviços técnicos (hash de senha, JWT)
  interface/http/    rotas Fastify, plugins de autenticação e tratamento de erro
```

### Fluxo de dados (exemplo genérico)

```
Tela (app/*.tsx)
   ↓
Context (src/customersContext.tsx | ordersContext.tsx | productsContext.tsx)
   ↓
Cliente HTTP (src/api/*Remote.ts → src/api/httpClient.ts)
   ↓  (HTTP + JWT)
Rota Fastify (server/src/interface/http/routes/*.ts)
   ↓
Service (server/src/application/**/*.ts)
   ↓
Repository (server/src/infrastructure/db/*.ts)
   ↓
Prisma Client
   ↓
PostgreSQL
```

### Principais componentes da aplicação

| Componente | Local | Responsabilidade |
|---|---|---|
| Roteamento do app | `app/` | Telas e navegação (Expo Router, baseado em arquivos) |
| Contextos de estado | `src/customersContext.tsx`, `src/ordersContext.tsx`, `src/productsContext.tsx`, `src/auth/authContext.tsx` | Estado global da aplicação (React Context API) |
| Clientes HTTP | `src/api/` | Comunicação com a API |
| Camada de domínio (backend) | `server/src/domain/` | Validação (Zod) e mapeamento de entidades para DTOs |
| Camada de aplicação (backend) | `server/src/application/` | Regras de caso de uso |
| Camada de infraestrutura (backend) | `server/src/infrastructure/` | Prisma, hash de senha, JWT |
| Camada de interface HTTP (backend) | `server/src/interface/http/` | Rotas, autenticação, tratamento de erro |

### Deploy

O deploy é descrito no arquivo `render.yaml` (raiz do repositório), como um *Blueprint* da plataforma Render, contendo dois serviços:
- `pedidos-api`: Web Service Node.js, com `rootDir: pedidos-lancamento-app/server`.
- `pedidos-db`: banco PostgreSQL gerenciado.

A variável `DATABASE_URL` do serviço `pedidos-api` é preenchida automaticamente pelo Render a partir da conexão com `pedidos-db` (`fromDatabase`). O segredo `JWT_SECRET` é gerado automaticamente pela plataforma (`generateValue: true`). As credenciais do primeiro usuário (`SEED_OWNER_EMAIL`, `SEED_OWNER_PASSWORD`, `SEED_OWNER_NAME`) são fornecidas manualmente na criação do Blueprint (`sync: false`).

---

## 3.3 Frontend

| Item | Valor identificado no código |
|---|---|
| Framework | Expo SDK 52 (`expo: ~52.0.28`) sobre React Native `0.76.6` |
| Linguagem | TypeScript (`typescript: ~5.3.3`), modo `strict` habilitado em `tsconfig.json` |
| Roteamento / build de rotas | Expo Router `~4.0.17` (roteamento baseado em arquivos) |
| Empacotador (bundler) | Metro, via CLI do Expo (`app.json` define `"bundler": "metro"` para a saída web) |
| UI base | React `18.3.1` / React DOM `18.3.1` (para a versão web) |

### Bibliotecas principais (`package.json`, raiz)

- `expo-router` — navegação por arquivos.
- `expo-secure-store` — armazenamento criptografado de tokens de sessão.
- `expo-document-picker` e `expo-file-system` — seleção e leitura do arquivo CSV na importação de clientes.
- `react-native-gesture-handler`, `react-native-reanimated`, `react-native-screens`, `react-native-safe-area-context` — dependências de suporte do próprio Expo Router/navegação.
- `@expo/vector-icons` — ícones da interface (`Ionicons`).
- `react-native-web` — permite executar o mesmo código em navegador.

Não foi identificada nenhuma biblioteca de gerenciamento de estado externa (Redux, Zustand, MobX, Recoil) nem biblioteca de *data fetching*/cache (React Query, SWR, Apollo). **Não identificado no código atual.**

### Estrutura de diretórios

```
app/                        Rotas (Expo Router)
  _layout.tsx                Layout raiz: providers globais + guarda de rota
  login.tsx                  Tela de login
  (tabs)/                    Navegação em abas (Pedidos, Clientes)
  novo.tsx                   Novo pedido
  pedido/[id].tsx             Detalhe/edição de pedido
  cliente/novo.tsx            Novo cliente
  cliente/[id].tsx             Detalhe/edição de cliente
  clientes/importar.tsx       Importação de clientes via CSV
  fechar-mes.tsx              Arquivamento em lote (fim de mês)

src/
  api/                       Clientes HTTP (um módulo por recurso + httpClient.ts genérico)
  auth/                      Contexto de autenticação e armazenamento de tokens
  components/                Componentes de UI reutilizáveis
  components/order-form/     Subcomponentes específicos do formulário de pedido
  domain/                    Regras compartilhadas (cálculo de total, mapeamento de itens)
  hooks/                     Hooks reutilizáveis (ex.: polling de atualização automática)
  utils/                     Utilitários (formatação monetária, normalização de texto de busca)
  *Context.tsx                Contextos de estado (clientes, pedidos, produtos)
  types.ts                   Tipos compartilhados do domínio no frontend
  theme.ts                   Paleta de cores, espaçamentos e raios
  config.ts                  Resolução da URL base da API
  csv.ts                     Parser de CSV para importação de clientes
```

### Gerenciamento de estado

Feito via **React Context API**, sem biblioteca externa:
- `AuthProvider` (`src/auth/authContext.tsx`) — usuário autenticado.
- `CustomersProvider` (`src/customersContext.tsx`) — lista de clientes.
- `OrdersProvider` (`src/ordersContext.tsx`) — lista de pedidos.
- `ProductsProvider` (`src/productsContext.tsx`) — catálogo de produtos.

Os três últimos ficam registrados em `app/_layout.tsx` e são montados assim que a verificação inicial de sessão termina (`loading === false`), independentemente de existir um usuário autenticado — a tela de login também fica "por baixo" desses *providers*. Cada *provider*, internamente, evita buscar dados enquanto não há usuário autenticado (checagem de `user` antes de disparar a busca inicial e antes de cada ciclo do *polling* — ver seção 3.6, "Sincronização").

### Gerenciamento de requisições

Não há biblioteca de *data fetching*. As chamadas HTTP passam por uma função central, `apiRequest` (`src/api/httpClient.ts`), que:
- Resolve a URL base a partir de `EXPO_PUBLIC_API_URL` (`src/config.ts`).
- Anexa o token de acesso salvo (quando a rota exige autenticação).
- Em caso de resposta `401`, tenta renovar o token via `POST /v1/auth/refresh` e repete a requisição uma vez.
- Distingue duas classes de erro: `NetworkError` (a requisição não chegou a ter resposta do servidor — problema de rede/servidor fora do ar) e `ApiError` (o servidor respondeu recusando a operação, por exemplo credencial inválida).

Cada recurso tem um módulo próprio que usa `apiRequest`: `src/api/authRemote.ts`, `src/api/customersRemote.ts`, `src/api/ordersRemote.ts`, `src/api/productsRemote.ts`.

### Componentização

Componentes genéricos em `src/components/`: `PrimaryButton.tsx`, `FieldLabel.tsx`, `SearchBar.tsx`, `CustomerForm.tsx`, `CustomerSelect.tsx`. O formulário de pedido é dividido em `OrderForm.tsx` (orquestrador) e dois subcomponentes em `src/components/order-form/`: `ProductRow.tsx` (linha de produto, memoizada com `React.memo`) e `OrderSummary.tsx` (resumo do pedido).

### Rotas (Expo Router, baseadas em arquivos)

| Rota | Arquivo | Descrição |
|---|---|---|
| `/login` | `app/login.tsx` | Autenticação |
| `/` (aba Pedidos) | `app/(tabs)/index.tsx` | Lista de pedidos agrupados por cliente |
| `/clientes` (aba) | `app/(tabs)/clientes.tsx` | Lista de clientes |
| `/novo` | `app/novo.tsx` | Criação de pedido |
| `/pedido/[id]` | `app/pedido/[id].tsx` | Detalhe/edição/arquivamento de pedido |
| `/cliente/novo` | `app/cliente/novo.tsx` | Criação de cliente |
| `/cliente/[id]` | `app/cliente/[id].tsx` | Detalhe/edição/exclusão de cliente |
| `/clientes/importar` | `app/clientes/importar.tsx` | Importação de clientes via CSV |
| `/fechar-mes` | `app/fechar-mes.tsx` | Arquivamento em lote dos pedidos do mês |

### Responsividade

Os contêineres principais usam `maxWidth: 720` combinado com `width: "100%"` e `alignSelf: "center"` (ver, por exemplo, `src/components/OrderForm.tsx`), o que permite que a mesma tela funcione tanto em telas estreitas de celular quanto em telas largas (tablet/web), sem duplicar layout.

### Estratégias de UX/UI relevantes

- Design "mobile first" adotado explicitamente a partir de um determinado ponto do desenvolvimento (documentado nos próprios comentários de código, ex.: `src/components/OrderForm.tsx`), priorizando áreas de toque maiores e menos rolagem.
- Catálogo de produtos em formato de acordeão (uma categoria expandida por vez).
- Seletor de cliente em modal tipo *bottom sheet* com fundo opaco (sem transparência sobre a tela anterior).
- Busca do catálogo incremental (a cada tecla) e tolerante a acentuação/caixa.
- Paleta de cores neutra, sem sombras (`src/theme.ts`), com poucos elementos puramente decorativos.

### Consumo da API pelo frontend

Descrito na seção "Gerenciamento de requisições" acima. Em resumo: toda comunicação passa por `apiRequest` (`src/api/httpClient.ts`), que centraliza anexação de token, tratamento de erro 401 com renovação automática e diferenciação entre falha de rede e falha de negócio.

---

## 3.4 Backend

| Item | Valor identificado no código |
|---|---|
| Framework | Fastify `^5.2.1` |
| Linguagem | TypeScript (`~5.6.3`), compilado para Node.js via `tsc` |
| Módulo | ESM nativo (`"type": "module"` em `server/package.json`) |
| Execução em desenvolvimento | `tsx watch` (`server/package.json`, script `dev`) |

### Estrutura da aplicação

Ver seção 3.2 para o diagrama de camadas. Não há um framework de módulos com *dependency injection* (como o `@Module` do NestJS); a modularização é feita por convenção de pastas e por importação direta entre arquivos.

### "Controllers" (rotas)

Cada recurso tem um arquivo de rotas em `server/src/interface/http/routes/`, registrado como plugin do Fastify:
- `auth.ts` — login, renovação de token, dados do usuário autenticado.
- `customers.ts` — CRUD de clientes.
- `products.ts` — catálogo e administração de produtos.
- `orders.ts` — CRUD de pedidos, arquivamento e reabertura.

Esses arquivos concentram o parsing/validação de entrada (via Zod) e a formatação da resposta HTTP; não contêm regra de negócio.

### Services (camada de aplicação)

Em `server/src/application/`, um módulo por recurso (`customerService.ts`, `orderService.ts`, `productService.ts`, `authService.ts`), cada um exportando funções (não classes) que orquestram os repositórios e aplicam as regras de caso de uso — por exemplo, `orderService.archive()` troca o status do pedido para `ARCHIVED` sem apagar o registro.

### Repositórios (infraestrutura)

Em `server/src/infrastructure/db/`, um módulo por entidade (`customerRepository.ts`, `orderRepository.ts`, `productRepository.ts`, `userRepository.ts`), responsável exclusivamente pelas chamadas ao Prisma Client. Destaque para `orderRepository.ts`: a criação/edição de pedido nunca aceita nome ou preço vindos do cliente — a função `resolveLines` busca o `Product` correspondente no banco e usa o preço e o nome atuais dali.

### DTOs

Definidos em `server/src/domain/*.ts` (por exemplo `CustomerDTO`, `OrderDTO`, `OrderLineDTO`, `ProductDTO`, `AuthenticatedUser`), junto com funções `toXDTO` que convertem o resultado bruto do Prisma para o formato exposto pela API (convertendo datas para epoch em milissegundos, por exemplo).

### Middlewares / guards

Implementados como plugins e *preHandlers* do Fastify em `server/src/interface/http/plugins/authGuard.ts`:
- Um plugin global (registrado com `fastify-plugin` para não ficar isolado em um escopo de encapsulamento) decodifica o token `Bearer` de cada requisição, se presente, e popula `request.authUser`.
- `requireAuth` — *preHandler* que rejeita (401) requisições sem usuário autenticado.
- `requireRole(...roles)` — *preHandler* que, além de exigir autenticação, rejeita (403) usuários cujo papel não esteja na lista permitida. Usado hoje somente nas rotas de administração do catálogo (`POST/PATCH/DELETE /v1/products`, `GET /v1/products/manage`), restritas ao papel `OWNER`.

### Tratamento de erros

Centralizado em `server/src/interface/http/plugins/errorHandler.ts`, via `app.setErrorHandler`:
- Erros da classe `AppError` (e subclasses `NotFoundError`, `UnauthorizedError`, `ForbiddenError`, definidas em `server/src/domain/errors.ts`) são convertidos para a resposta HTTP com o `statusCode` correspondente.
- Erros de validação do Zod (`ZodError`) viram `400`, com as mensagens de todos os problemas encontrados concatenadas.
- Qualquer outro erro é registrado no log do servidor e retorna `500` com uma mensagem genérica (`"Erro interno"`), sem vazar detalhes internos.

### Validação de dados

Feita com a biblioteca **Zod** (`zod: ^3.24.1`). Os *schemas* ficam junto com os tipos de domínio em `server/src/domain/` (ex.: `customerInputSchema`, `createOrderInputSchema`, `loginInputSchema`, `paginationQuerySchema`) e são aplicados diretamente nas rotas com `.parse(request.body)` ou `.parse(request.query)`.

### Autenticação

- Login por e-mail/senha (`POST /v1/auth/login`), implementado em `server/src/application/auth/authService.ts`.
- Senha armazenada como hash **bcrypt** (`bcryptjs`, 10 *salt rounds* — `server/src/infrastructure/auth/hash.ts`); nunca em texto puro.
- Emissão de dois tokens **JWT** (`jsonwebtoken`) — token de acesso (`expiresIn: "2h"`) e token de renovação (`expiresIn: "30d"`), assinados com o mesmo segredo (`JWT_SECRET`), diferenciados por um campo `type` embutido no payload (`server/src/infrastructure/auth/jwt.ts`).
- Renovação de sessão via `POST /v1/auth/refresh`, sem exigir novo login enquanto o *refresh token* for válido.

### Autorização

Baseada em papel (`enum Role` no `schema.prisma`: `OWNER`, `EMPLOYEE`, `CUSTOMER`, `DELIVERER`). Hoje, na prática, apenas `OWNER` e `EMPLOYEE` têm uso efetivo — `CUSTOMER` e `DELIVERER` existem no esquema do banco, mas não há nenhuma rota, tela ou regra de negócio que os utilize (reservados para os futuros apps de Cliente e Entregador). A única restrição de papel implementada hoje é `requireRole("OWNER")` nas rotas de administração de produtos.

### Principais endpoints

| Método | Rota | Autenticação | Descrição |
|---|---|---|---|
| GET | `/health` | Não | *Health check* |
| POST | `/v1/auth/login` | Não | Login (e-mail/senha) |
| POST | `/v1/auth/refresh` | Não (usa refresh token) | Renova o token de acesso |
| GET | `/v1/auth/me` | Sim | Dados do usuário autenticado |
| GET | `/v1/customers` | Sim | Lista clientes (paginada por cursor) |
| POST | `/v1/customers` | Sim | Cria cliente |
| GET | `/v1/customers/:id` | Sim | Detalhe do cliente |
| PATCH | `/v1/customers/:id` | Sim | Atualiza cliente |
| DELETE | `/v1/customers/:id` | Sim | Exclui cliente (bloqueado se houver pedidos) |
| GET | `/v1/products` | Sim | Catálogo ativo (sem paginação) |
| GET | `/v1/products/manage` | Sim (`OWNER`) | Catálogo completo, paginado, incluindo inativos |
| POST | `/v1/products` | Sim (`OWNER`) | Cria produto |
| PATCH | `/v1/products/:id` | Sim (`OWNER`) | Atualiza produto |
| DELETE | `/v1/products/:id` | Sim (`OWNER`) | Desativa produto (*soft delete*) |
| GET | `/v1/orders` | Sim | Lista pedidos (filtro por status + paginação por cursor) |
| POST | `/v1/orders` | Sim | Cria pedido |
| GET | `/v1/orders/:id` | Sim | Detalhe do pedido |
| PATCH | `/v1/orders/:id` | Sim | Atualiza pedido |
| POST | `/v1/orders/:id/archive` | Sim | Arquiva pedido (mantém histórico) |
| POST | `/v1/orders/:id/unarchive` | Sim | Reabre pedido arquivado |

### Comunicação com o frontend

HTTP/JSON, com CORS liberado via `@fastify/cors` (`origin: true`), permitindo que o app (nativo ou web) consuma a API a partir de qualquer origem.

---

## 3.5 Banco de dados

| Item | Valor identificado no código |
|---|---|
| SGBD | PostgreSQL |
| ORM | Prisma (`@prisma/client` / `prisma`, `^6.19.0`) |
| Local de hospedagem | Banco gerenciado pelo Render (serviço `pedidos-db`, ver `render.yaml`) |
| Estratégia de aplicação do schema | `prisma db push` (script `db:push` em `server/package.json`) |

### Migrations

**Não identificado no código atual.** Não existe pasta `server/prisma/migrations`; o projeto usa `prisma db push`, que aplica o `schema.prisma` diretamente ao banco, sem gerar um histórico versionado de migrations.

### Estrutura das entidades (`server/prisma/schema.prisma`)

**`User`** — usuários com acesso ao sistema.
`id`, `email` (único), `passwordHash`, `name`, `role` (`Role`, padrão `EMPLOYEE`), `createdAt`, `updatedAt`.

**`Customer`** — clientes cadastrados.
`id`, `name`, `nameKey` (nome normalizado, único — usado para evitar duplicidade), `phone`, `address` (opcional, ainda não usado pelo painel do Dono), `note`, `createdAt`, `updatedAt`. Relaciona-se com `Order` (um cliente tem vários pedidos).

**`Product`** — catálogo.
`id`, `name`, `category`, `unitPrice`, `sku` (opcional), `active` (*soft delete*), `createdAt`, `updatedAt`. Relaciona-se com `OrderLine`.

**`Order`** — pedidos.
`id`, `customerId`, `notes`, `status` (`OrderStatus`, padrão `PENDING`), `shipmentId` (opcional, sem tabela associada — ver "planejado, não implementado"), `createdAt`, `updatedAt`. Relaciona-se com `Customer` e com `OrderLine`.

**`OrderLine`** — itens de um pedido.
`id`, `orderId`, `productId`, `name`, `unitPrice`, `qty`. `name` e `unitPrice` são um retrato ("*snapshot*") do produto no momento do pedido — não seguem alterações futuras de preço do produto.

**`enum Role`**: `OWNER`, `EMPLOYEE`, `CUSTOMER`, `DELIVERER`.
**`enum OrderStatus`**: `PENDING`, `ARCHIVED`, `RELEASED`, `DELIVERED`, `CANCELED`.

### Principais relacionamentos

- `Customer 1—N Order`, com `onDelete: Restrict` — o banco impede excluir um cliente que já tenha pedidos associados (a API traduz essa violação em uma resposta HTTP `409`).
- `Order 1—N OrderLine`, com `onDelete: Cascade` — excluir um pedido remove seus itens.
- `Product 1—N OrderLine`, sem cláusula `onDelete` explícita (comportamento padrão do banco, que impede excluir um produto referenciado por algum item de pedido — por isso a exclusão de produto na API é implementada como desativação, não remoção).

### Estratégia de persistência

- Todos os dados de clientes, produtos e pedidos são armazenados exclusivamente no PostgreSQL, acessado somente pelo backend. O app não mantém mais cópia local persistente desses dados (o uso de `AsyncStorage` para esse fim foi removido; ver seção 3.12).
- Produtos não são fisicamente excluídos: a exclusão via API desativa o registro (`active = false`), preservando a integridade dos pedidos que já o referenciam.
- Pedidos não são fisicamente excluídos pelo fluxo principal do app: a ação de "fechar mês"/arquivar troca o `status` para `ARCHIVED`, mantendo o registro no banco para fins de histórico.
- Cada item de pedido (`OrderLine`) grava uma cópia do nome e do preço do produto no momento da compra, para que alterações futuras no catálogo não afetem pedidos já registrados.

### Planejado, mas não implementado

- **Entidade `Shipment` (Remessa):** não existe tabela `Shipment` no schema. Existe apenas a coluna `Order.shipmentId` (opcional, sem relação/FK configurada), reservada para uma fase futura do projeto.
- **Estados `RELEASED`, `DELIVERED`, `CANCELED` de `OrderStatus`:** existem no enum, mas nenhuma rota, service ou tela do sistema os utiliza atualmente. Apenas `PENDING` e `ARCHIVED` estão em uso.
- **Papéis `CUSTOMER` e `DELIVERER`:** existem no enum `Role`, sem nenhuma rota, tela ou regra de autorização que os utilize.

---

## 3.6 Funcionalidades implementadas

### Clientes

- **Cadastro** — `POST /v1/customers`; nome obrigatório, telefone/observação opcionais (`address` existe no banco mas não é preenchido pela tela atual do painel do Dono). Tela: `app/cliente/novo.tsx`, formulário: `src/components/CustomerForm.tsx`.
- **Consulta** — `GET /v1/customers`, com paginação por cursor implementada no backend (`server/src/domain/pagination.ts`); o app hoje busca uma única página de até 200 registros (`src/api/customersRemote.ts`), sem interface de "carregar mais".
- **Atualização** — `PATCH /v1/customers/:id`. Tela: `app/cliente/[id].tsx`.
- **Exclusão** — `DELETE /v1/customers/:id`; a API recusa (`409`) a exclusão de um cliente com pedidos associados.
- **Associação com pedidos** — todo `Order` tem um `customerId` obrigatório. A tela `app/(tabs)/clientes.tsx` exibe a quantidade de pedidos de cada cliente, mas calculada no próprio frontend (`orderCountByCustomer`, em `app/(tabs)/clientes.tsx`) a partir da lista de pedidos carregada — que contém somente pedidos com status `PENDING`. O backend também calcula e retorna um campo `orderCount` em `CustomerDTO` (`server/src/domain/customer.ts`, via `_count.orders` do Prisma, contando **todos** os pedidos do cliente, inclusive arquivados), mas esse campo não é consumido em nenhum ponto do frontend atual — ver inconsistência registrada ao final do documento.
- **Importação via CSV** — tela `app/clientes/importar.tsx`, parser próprio em `src/csv.ts` (sem biblioteca externa de CSV), aceitando `,` ou `;` como separador e ignorando linhas sem nome. Cada linha válida é enviada individualmente para `POST /v1/customers`; nomes duplicados (rejeitados pela API com `409`) são contabilizados como "ignorados" na importação.

### Pedidos

- **Criação** — `POST /v1/orders`, recebendo `customerId`, uma lista de itens (`{ productId, qty }`) e uma observação opcional. Nome e preço de cada item são resolvidos no servidor a partir do cadastro atual do produto — nunca aceitos do app (`server/src/infrastructure/db/orderRepository.ts`).
- **Seleção de cliente** — componente `src/components/CustomerSelect.tsx` (modal em formato de *bottom sheet*).
- **Seleção de produtos** — `src/components/OrderForm.tsx` (catálogo em acordeão) e `src/components/order-form/ProductRow.tsx` (linha de produto com controles de quantidade).
- **Quantidades** — incremento/decremento (+/－) ou digitação direta em campo numérico, com limite máximo de 1.000.000 de unidades por item.
- **Valores** — preço unitário definido no momento da criação do pedido (gravado em `OrderLine`); o total do pedido é calculado no frontend (`src/domain/order.ts`, função `getOrderTotal`) somando `unitPrice × qty` de cada item.
- **Resumo do pedido** — componente `src/components/order-form/OrderSummary.tsx`.
- **Persistência** — sempre via API/banco de dados; não há mais fluxo local.
- **Edição** — `PATCH /v1/orders/:id`. Tela: `app/pedido/[id].tsx`.
- **Arquivamento** — `POST /v1/orders/:id/archive` (e `.../unarchive` para reverter), usados tanto na tela de detalhe do pedido quanto na tela `app/fechar-mes.tsx`, que arquiva em lote os pedidos do mês corrente selecionados pelo usuário. Substitui um fluxo anterior que apagava os pedidos definitivamente.
- **Cancelamento** — **Não identificado no código atual.** O `enum OrderStatus` reserva o valor `CANCELED`, mas não existe rota, *service* ou elemento de interface que o utilize.

### Catálogo

- **Pesquisa de itens** — incremental, aplicada a cada tecla digitada, sem *debounce* (`src/productsContext.tsx`, função `searchSections`), comparando nome, SKU e identificador do produto.
- **Filtragem** — texto normalizado (minúsculas, sem acentuação, sem pontuação) antes da comparação, via `normalizeForSearch` (`src/utils/text.ts`), permitindo que buscas como "agua" encontrem "Água Sanitária 5L".
- **Categorias/grupos** — produtos agrupados pelo campo `category` do banco.
- **Scroll** — lista renderizada com o componente `SectionList` do React Native (virtualização nativa da biblioteca, sem código adicional de virtualização).
- **Grupos retráteis** — implementados como acordeão de categoria única (`expandedCategory` em `src/components/OrderForm.tsx`): apenas uma categoria fica expandida por vez, e abrir uma fecha a anterior. Tecnicamente, os itens da categoria fechada continuam presentes na lista de dados, mas a função `renderItem` retorna `null` para eles — preservando a virtualização da `SectionList` (nenhuma categoria fica de fato desmontada da lista de dados, mas nenhuma célula é efetivamente renderizada fora da categoria aberta).
- **Seleção de itens** — botões de incremento/decremento e campo numérico por produto (`ProductRow.tsx`).
- **Feedback visual** — o item com quantidade maior que zero recebe uma borda lateral colorida e uma cor de fundo diferenciada (`ProductRow.tsx`).

### Sincronização

O sistema **não utiliza WebSocket nem Webhooks**. A atualização entre dispositivos é feita por *polling* (requisições GET repetidas):

- Hook `src/hooks/useAutoRefresh.ts`, usado dentro de `CustomersProvider` e `OrdersProvider` (não é usado em `ProductsProvider` — o catálogo não é atualizado periodicamente).
- Intervalo padrão de repetição: **12 segundos** (constante `DEFAULT_INTERVAL_MS`, dentro da faixa recomendada internamente pela equipe).
- Usa a API `AppState` do React Native para **pausar** o intervalo quando o aplicativo vai para segundo plano, e disparar **uma atualização imediata** assim que o app volta ao primeiro plano.
- Após qualquer escrita (criar/atualizar/excluir cliente; criar/atualizar/arquivar/reabrir pedido), o frontend já atualiza a lista local imediatamente com a resposta da própria operação (atualização otimista) e, em paralelo, dispara um novo `GET` da lista correspondente em segundo plano (`void refresh({ silent: true })`), sem bloquear a interface.
- O `refresh` silencioso não ativa o indicador de carregamento nem apaga a lista já exibida em caso de falha pontual de rede — evita que uma falha passageira do *polling* limpe a tela do usuário.

---

## 3.7 Interface e experiência de uso

- **Mobile first** — adotado explicitamente como diretriz de desenvolvimento a partir de um certo ponto do projeto (registrado em comentários do próprio código, ex.: `src/components/OrderForm.tsx`). Alvos de toque com altura mínima definida (ex.: 52px no cabeçalho de categoria do catálogo), pensados para uso com uma mão.
- **Componentes responsivos** — uso consistente de `maxWidth: 720` centralizado, adaptando o mesmo layout para tela de celular ou tela maior (tablet/web).
- **Navegação** — Expo Router, com pilha de telas (`Stack`) e abas (`Tabs`) para "Pedidos" e "Clientes".
- **Seleção de clientes** — modal em formato de *bottom sheet* (`src/components/CustomerSelect.tsx`), com fundo totalmente opaco (sem transparência sobre a tela anterior), priorizando o foco na seleção.
- **Catálogo** — busca sempre visível no topo, categorias em acordeão (uma aberta por vez), como descrito na seção 3.6.
- **Bottom sheets** — usados apenas no seletor de clientes.
- **Accordions/grupos retráteis** — usados no catálogo de produtos do formulário de pedido.
- **Feedback visual** — destaque do item de produto selecionado (borda + fundo); alertas diferenciados para erro de rede (`"Sem conexão com o servidor"`) e erro de credencial (`"Não foi possível entrar"`) na tela de login (`app/login.tsx`).
- **Pesquisa incremental** — descrita na seção 3.6.
- **Estratégias para reduzir poluição visual** — paleta neutra com um único tom de destaque, ausência de sombras (`shadow`) e de cantos muito arredondados no tema visual (`src/theme.ts`), categorias recolhidas por padrão no catálogo.

Essas decisões relacionam-se diretamente com a necessidade de uso rápido e repetitivo do sistema (lançamento de vários pedidos em sequência, muitas vezes em campo, pelo celular), priorizando poucos toques e pouca rolagem de tela.

---

## 3.8 Performance

Estratégias efetivamente encontradas no código:

- **Virtualização de listas** — componente `SectionList`, nativo do React Native, usado no catálogo de produtos (`src/components/OrderForm.tsx`). Não há biblioteca de virtualização adicional.
- **Redução de renderizações** — `ProductRow.tsx` é envolvido em `React.memo`; os callbacks `onAdjust`/`onSetQty` são definidos uma única vez no componente pai (`useCallback`, sem dependências que mudem a cada render), de forma que cada linha de produto só é renderizada de novo quando a própria quantidade daquele produto muda.
- **Refetch controlado** — o *polling* de sincronização (`useAutoRefresh`, seção 3.6) é interrompido em segundo plano e evita chamadas desnecessárias.
- **Requisições silenciosas** — o `refresh` acionado pelo *polling* e pelas escritas não altera o estado de carregamento da tela, evitando nova renderização do indicador de "Carregando…" a cada ciclo.
- **Paginação no backend** — implementada por cursor (`server/src/domain/pagination.ts`) nos endpoints `GET /v1/customers`, `GET /v1/orders` e `GET /v1/products/manage`. O app, atualmente, consome uma única página grande (até 200 itens) em vez de paginação incremental na interface.
- **Catálogo sem paginação no endpoint de consumo** (`GET /v1/products`) — decisão adequada ao volume atual (dezenas de produtos); a paginação foi reservada para a listagem administrativa (`/v1/products/manage`).
- **Lazy loading por rota** — decorrente do próprio Expo Router (*code splitting* por arquivo de rota), não é uma implementação manual adicional do projeto.

Estratégias mencionadas no modelo de documentação, mas **não identificadas no código atual**:
- *Debounce* na busca do catálogo — a filtragem ocorre a cada tecla digitada, sem atraso artificial. Viável porque o catálogo tem poucas dezenas de itens e a comparação de texto é barata.
- Cache de requisições (ex.: React Query, SWR) — não há biblioteca de cache; os *contexts* mantêm o estado em memória durante a navegação, mas nada é persistido em disco no cliente.
- Paginação com "carregar mais" na interface do app.

---

## 3.9 Segurança

Mecanismos efetivamente implementados:

- **Autenticação** — login por e-mail/senha (`POST /v1/auth/login`), com emissão de token de acesso (JWT, validade de 2 horas) e token de renovação (JWT, validade de 30 dias). Ver `server/src/infrastructure/auth/jwt.ts` e `server/src/application/auth/authService.ts`.
- **Armazenamento de tokens no dispositivo** — `expo-secure-store` (keychain/keystore criptografado do sistema operacional) em iOS/Android; no ambiente web (sem equivalente nativo), o próprio código usa `localStorage` como alternativa, com uma observação explícita no comentário de que essa opção é aceitável apenas por se tratar de um ambiente de desenvolvimento/demonstração (`src/auth/tokenStorage.ts`).
- **Validação de entrada** — todos os endpoints de escrita validam o corpo da requisição com Zod antes de qualquer processamento (`server/src/domain/*.ts`).
- **Controle de acesso** — `preHandler` `requireAuth` aplicado a todas as rotas, exceto `/health`, `/v1/auth/login` e `/v1/auth/refresh`; `preHandler` `requireRole("OWNER")` restringindo a administração do catálogo de produtos.
- **Proteção de endpoints** — listada na tabela de endpoints (seção 3.4): a coluna "Autenticação" indica quais rotas exigem token válido.
- **Criptografia de senha** — hash com `bcryptjs` (10 *salt rounds*); a senha em texto puro nunca é armazenada.
- **Variáveis de ambiente** — segredos (`DATABASE_URL`, `JWT_SECRET`, `SEED_OWNER_EMAIL`, `SEED_OWNER_PASSWORD`) mantidos fora do controle de versão: `server/.env` está listado em `server/.gitignore`; apenas `server/.env.example`, com valores de exemplo (não reais), é versionado.
- **Comunicação autenticada** — todas as requisições a rotas protegidas exigem o cabeçalho `Authorization: Bearer <token>`; sem token válido, a API responde `401` antes de qualquer acesso ao banco.

Este projeto não é um sistema de acesso público; portanto, mecanismos como autenticação multifator, *rate limiting* ou registro de auditoria não foram implementados e não foram avaliados aqui como uma auditoria de segurança — apenas os mecanismos efetivamente usados estão descritos acima.

---

## 3.10 Tecnologias e ferramentas

| Categoria | Tecnologia/Ferramenta | Finalidade |
|---|---|---|
| Frontend | Expo SDK 52 / React Native 0.76.6 | Framework para construção do app mobile e web a partir da mesma base de código |
| Frontend | Expo Router ~4.0.17 | Roteamento baseado em arquivos |
| Frontend | TypeScript ~5.3.3 | Linguagem com tipagem estática no app |
| Frontend | React 18.3.1 | Biblioteca de construção de interface |
| Frontend | expo-secure-store | Armazenamento criptografado de tokens de sessão no dispositivo |
| Frontend | expo-document-picker / expo-file-system | Seleção e leitura do arquivo CSV na importação de clientes |
| Frontend | react-native-gesture-handler / react-native-reanimated / react-native-screens | Suporte de navegação e gestos exigido pelo Expo Router |
| Frontend | @expo/vector-icons | Ícones da interface |
| Backend | Fastify ^5.2.1 | Framework HTTP da API REST |
| Backend | Node.js (ESM) | Ambiente de execução do servidor |
| Backend | TypeScript ~5.6.3 | Linguagem com tipagem estática no servidor |
| Backend | Zod ^3.24.1 | Validação de esquemas de entrada (DTOs) |
| Backend | jsonwebtoken ^9.0.2 | Emissão e verificação de tokens JWT |
| Backend | bcryptjs ^2.4.3 | Hash de senhas |
| Backend | fastify-plugin ^5.0.1 | Registro do plugin de autenticação sem encapsulamento de escopo |
| Backend | @fastify/cors ^10.0.1 | Liberação de CORS para o app consumir a API |
| Banco de dados | PostgreSQL | SGBD relacional |
| ORM | Prisma ^6.19.0 | Mapeamento objeto-relacional e cliente de acesso ao banco |
| Build/execução (backend) | tsx ^4.19.2 | Execução/observação do TypeScript em desenvolvimento |
| Build (frontend) | Metro (via Expo CLI) | Empacotador do app |
| Versionamento | Git / GitHub | Controle de versão do código-fonte |
| Deploy | Render (Blueprint `render.yaml`) | Hospedagem do serviço `pedidos-api` (Web Service) e do banco `pedidos-db` (PostgreSQL) |
| Testes | Não identificado no código atual | — |

---

## 3.11 Fluxos principais

### Login

```text
Usuário abre o app
   ↓
AuthProvider verifica token salvo (expo-secure-store / localStorage)
   ↓
Token salvo existe?
   ├─ Sim → GET /v1/auth/me → sessão restaurada → acesso liberado às rotas internas
   └─ Não → redirecionado para /login
                ↓
          Informa e-mail e senha
                ↓
          POST /v1/auth/login
                ↓
          Backend valida credenciais (bcrypt) e responde com accessToken + refreshToken
                ↓
          Tokens salvos no dispositivo
                ↓
          Redirecionado para a tela inicial
```

### Criação de pedido

```text
Usuário autenticado
   ↓
Acessa "Novo pedido"
   ↓
Seleciona cliente (ou cadastra um novo na hora, via POST /v1/customers)
   ↓
Busca e seleciona produtos no catálogo
   ↓
Define quantidades
   ↓
Confirma o pedido
   ↓
Frontend envia POST /v1/orders { customerId, items: [{ productId, qty }], notes }
   ↓
Backend valida a entrada (Zod), confirma existência do cliente e dos produtos,
resolve nome/preço atuais de cada produto
   ↓
Prisma grava Order + OrderLine no PostgreSQL
   ↓
Backend responde com o pedido criado
   ↓
Frontend atualiza a lista local e agenda uma nova busca em segundo plano
```

### Sincronização entre dispositivos

```text
App em primeiro plano
   ↓
useAutoRefresh dispara refresh silencioso a cada 12 segundos
   ↓
GET /v1/customers e GET /v1/orders (com token de acesso)
   ↓
Lista local é substituída pela resposta do servidor
   ↓
App vai para segundo plano (evento do AppState)
   ↓
Repetição automática é interrompida
   ↓
App volta ao primeiro plano
   ↓
Atualização imediata + repetição automática retomada
```

---

## 3.12 Estado atual do projeto

### Implementado

- Autenticação por e-mail/senha, com renovação automática de sessão.
- Cadastro, consulta, atualização e exclusão de clientes (com bloqueio de exclusão quando há pedidos associados).
- Importação de clientes via CSV.
- Catálogo de produtos administrável pelo backend (CRUD restrito ao papel `OWNER`), com desativação (*soft delete*) em vez de exclusão física.
- Lançamento, edição e arquivamento (individual e em lote) de pedidos, com histórico preservado.
- Cálculo automático de totais do pedido, com preço e nome do produto congelados no momento da compra.
- Busca incremental do catálogo, tolerante a acentuação e caixa.
- Catálogo em formato de acordeão, com uma categoria expandida por vez.
- Sincronização automática de clientes e pedidos entre dispositivos via *polling*, com pausa em segundo plano.
- Deploy da API e do banco de dados em produção (Render), com o app apontando para um endereço público fixo.

### Em desenvolvimento / parcialmente implementado

- **Sincronização entre dispositivos**: implementada como MVP via *polling* (10–15 segundos), sem WebSocket/Webhook. A própria especificação interna do recurso já prevê, como evolução futura, a substituição por WebSocket caso o número de usuários simultâneos cresça — essa evolução ainda não foi realizada.
- **Papéis de usuário**: o modelo de dados já reserva os papéis `CUSTOMER` e `DELIVERER` e os estados de pedido `RELEASED`/`DELIVERED`/`CANCELED`, preparando o esquema do banco para as próximas etapas do projeto, mas sem nenhuma rota, tela ou regra de negócio associada a eles ainda.

### Melhorias futuras (não implementadas)

- Entidade de Remessa (`Shipment`) e o fluxo de fechamento de remessa com geração de relatórios (quantidade total por produto, valor da remessa, receita esperada).
- Aplicativo do Cliente (cadastro próprio, visualização de produtos, criação e acompanhamento de pedidos).
- Aplicativo do Entregador (lista de entregas liberadas, marcação de entregue/não entregue).
- Roteirização de entregas.
- Relatórios (produtos mais vendidos, receita por produto, ticket médio, pedidos por período, etc.).
- Cancelamento de pedido como ação distinta do arquivamento.
- Sincronização em tempo real via WebSocket, substituindo o *polling* atual.
- Testes automatizados (unitários, integração ou end-to-end) — não identificados no projeto atual.
- Pipeline de integração contínua (CI/CD) — não identificado no projeto atual.
- Paginação de fato na interface (atualmente o app busca uma página única e grande de clientes/pedidos).

---

## Pontos que precisam de confirmação

- **Nome/identidade da empresa**: o código não contém nenhuma referência ao nome real da microempresa; o único indício de segmento é o catálogo de produtos de limpeza cadastrado em `server/prisma/seed.ts`. Confirmar com o autor se esse é de fato o negócio real por trás do sistema, para uso no texto do TCC.
- **Estágio de uso real**: não é possível confirmar apenas pelo código se o sistema já está em uso operacional pela microempresa ou ainda em fase de testes do desenvolvedor.
- **Preenchimento das variáveis de ambiente em produção**: o `render.yaml` define `SEED_OWNER_EMAIL`/`SEED_OWNER_PASSWORD` como campos preenchidos manualmente na criação do Blueprint (`sync: false`) — não é possível confirmar pelo código se os valores em uso no ambiente de produção coincidem com os usados em desenvolvimento.
- **Intenção de adicionar testes automatizados**: como não foram encontrados testes no projeto, é importante alinhar se isso será adicionado antes da entrega do TCC ou se o trabalho será apresentado sem cobertura de testes automatizados.
- **Campo `address` de `Customer`**: existe no banco de dados e no tipo do frontend, mas não há campo correspondente no formulário atual de cadastro/edição de cliente (`CustomerForm.tsx`) — parece reservado para o futuro app do Cliente, não uma omissão a corrigir agora, mas vale confirmar essa leitura.
- **Inconsistência no campo `orderCount`**: o backend calcula e devolve `orderCount` em `CustomerDTO` (`server/src/domain/customer.ts`) contando *todos* os pedidos do cliente (inclusive arquivados), mas esse valor não é usado em nenhum lugar do frontend. A tela de clientes (`app/(tabs)/clientes.tsx`) exibe, em vez disso, uma contagem calculada localmente a partir da lista de pedidos ativos (`status = PENDING`) carregada em memória — ou seja, o número exibido hoje é "pedidos em aberto", não o total histórico que o nome do campo da API sugere. Vale decidir se isso é uma inconsistência a corrigir (usar o campo do backend, ou renomear/ajustar a exibição) antes de citar esse comportamento no TCC como um dado definitivo.
