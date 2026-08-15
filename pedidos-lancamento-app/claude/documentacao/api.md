# API — Projeto ORG

> Documenta exclusivamente o contrato de comunicação entre frontend e backend: padrão, endpoints, formatos de requisição/resposta, autenticação e estratégia de sincronização. A implementação interna (services, regras de negócio) está em `backend.md`; a estrutura de dados persistida, em `banco-de-dados.md`; o consumo pelo app, em `frontend.md`.

---

## 5.1 Visão geral

| Item | Valor |
|---|---|
| Padrão | REST sobre HTTP, payloads em JSON |
| Framework do lado servidor | Fastify `^5.2.1` (`server/src/index.ts`) |
| Prefixo de versionamento | `/v1` em todas as rotas de recurso (`/health` é a única exceção, sem prefixo) |
| Autenticação | Bearer JWT no cabeçalho `Authorization: Bearer <token>` |
| CORS | Liberado para qualquer origem (`@fastify/cors`, `origin: true`) — `server/src/index.ts` |
| Formato de erro | `{ "error": "<mensagem>" }`, com o `statusCode` HTTP correspondente |
| Base URL (desenvolvimento local) | Definida em `EXPO_PUBLIC_API_URL` (arquivo `.env` do app), ex.: `http://IP_LOCAL:3333` |
| Base URL (produção) | Serviço `pedidos-api` publicado no Render (endereço público HTTPS fixo) |

Não há documentação gerada automaticamente (Swagger/OpenAPI) no projeto. **Não identificado no código atual.**

---

## 5.2 Endpoints

### Autenticação

```text
POST /v1/auth/login
Objetivo: autenticar um usuário por e-mail e senha.
Autenticação: não exige token.
Request body: { "email": string, "password": string }
Response (200): { "user": { id, email, name, role }, "accessToken": string, "refreshToken": string }
Códigos HTTP: 200 (sucesso) · 400 (corpo inválido) · 401 (credenciais inválidas)
Implementação: server/src/interface/http/routes/auth.ts + server/src/application/auth/authService.ts
```

```text
POST /v1/auth/refresh
Objetivo: emitir um novo token de acesso a partir de um refresh token válido.
Autenticação: não exige token de acesso (usa o refreshToken enviado no corpo).
Request body: { "refreshToken": string }
Response (200): { "accessToken": string }
Códigos HTTP: 200 · 400 · 401 (refresh token inválido/expirado)
```

```text
GET /v1/auth/me
Objetivo: retornar os dados do usuário autenticado (usado para restaurar sessão ao abrir o app).
Autenticação: obrigatória.
Response (200): { "id", "email", "name", "role" }
Códigos HTTP: 200 · 401
```

### Clientes

```text
GET /v1/customers
Objetivo: listar clientes.
Autenticação: obrigatória.
Query parameters: cursor? (string), limit? (número, padrão 50, máx. 200)
Response (200): { "items": Customer[], "nextCursor": string | null }
```

```text
POST /v1/customers
Objetivo: cadastrar cliente.
Autenticação: obrigatória.
Request body: { "name": string, "phone"?: string, "address"?: string, "note"?: string }
Response (201): Customer
Códigos HTTP: 201 · 400 (validação) · 409 (nome já cadastrado)
```

```text
GET /v1/customers/:id        → detalhe do cliente (200 · 404)
PATCH /v1/customers/:id      → atualiza cliente (mesmo corpo do POST; 200 · 400 · 404 · 409)
DELETE /v1/customers/:id     → exclui cliente (204 · 404 · 409 se houver pedidos associados)
```

### Produtos

```text
GET /v1/products
Objetivo: catálogo ativo, para montagem de pedidos.
Autenticação: obrigatória (qualquer papel — OWNER ou EMPLOYEE).
Response (200): Product[]  (sem paginação — lista completa dos produtos com active = true)
```

```text
GET /v1/products/manage
Objetivo: catálogo administrativo, incluindo produtos inativos.
Autenticação: obrigatória, restrita ao papel OWNER.
Query parameters: cursor?, limit? (igual à paginação de clientes)
Response (200): { "items": Product[], "nextCursor": string | null }
Códigos HTTP: 200 · 403 (usuário sem papel OWNER)
```

```text
POST /v1/products         → cria produto (OWNER) · 201 · 400 · 403
PATCH /v1/products/:id    → atualiza produto (OWNER) · 200 · 400 · 403 · 404
DELETE /v1/products/:id   → desativa produto — soft delete (OWNER) · 200 · 403 · 404
```

Corpo de `POST`/`PATCH`: `{ "name": string, "category": string, "unitPrice": number, "sku"?: string, "active"?: boolean }`.

### Pedidos

```text
GET /v1/orders
Objetivo: listar pedidos.
Autenticação: obrigatória.
Query parameters:
  status? = "pending" (padrão) | "archived" | "all"
  cursor?, limit? (paginação por cursor, igual às demais listas)
Response (200): { "items": Order[], "nextCursor": string | null }
```

```text
POST /v1/orders
Objetivo: criar pedido.
Autenticação: obrigatória.
Request body:
{
  "customerId": string,
  "items": [ { "productId": string, "qty": number } ],
  "notes"?: string
}
Response (201): Order (com "items" já contendo name/unitPrice resolvidos pelo servidor)
Códigos HTTP: 201 · 400 (validação, produto indisponível) · 404 (cliente não encontrado)
```

> O corpo de criação/edição de pedido **não aceita** `name` nem `unitPrice` por item — apenas `productId` e `qty`. O servidor busca o produto correspondente e usa seu nome/preço atuais (`server/src/infrastructure/db/orderRepository.ts`, função `resolveLines`). Um `productId` inexistente ou de produto inativo resulta em erro `400`.

```text
GET /v1/orders/:id           → detalhe do pedido (200 · 404)
PATCH /v1/orders/:id         → atualiza pedido — customerId/items/notes, todos opcionais (200 · 400 · 404)
POST /v1/orders/:id/archive  → arquiva pedido, status → ARCHIVED (200 · 404)
POST /v1/orders/:id/unarchive → reabre pedido, status → PENDING (200 · 404)
```

Não existe endpoint de cancelamento de pedido (`DELETE /v1/orders/:id` também não existe). **Não identificado no código atual.**

### Health check

```text
GET /health
Objetivo: verificação de disponibilidade do serviço.
Autenticação: não exige.
Response (200): { "ok": true }
```

---

## 5.3 Fluxos de comunicação

### Autenticação (restaurar sessão + login)

```text
App inicia
   ↓
Existe token salvo no dispositivo?
   ├─ Sim → GET /v1/auth/me → 200: sessão restaurada / 401: token inválido, tokens descartados
   └─ Não → aguarda o usuário logar
                ↓
          POST /v1/auth/login → 200: accessToken + refreshToken salvos
```

Renovação automática: qualquer chamada autenticada que receba `401` aciona, uma única vez, `POST /v1/auth/refresh`; se a renovação funcionar, a chamada original é refeita com o novo token; se falhar, a sessão é encerrada no app (`src/api/httpClient.ts`, função `apiRequest`).

### Clientes

`GET /v1/customers` (carga inicial e sincronização periódica) · `POST /v1/customers` (cadastro, inclusive durante a seleção de cliente no formulário de pedido) · `PATCH /v1/customers/:id` · `DELETE /v1/customers/:id`. Ver `frontend.md`, seção de sincronização, para a estratégia de atualização automática.

### Produtos

Somente `GET /v1/products`, consumido uma vez após o login (o catálogo não é atualizado periodicamente pelo app hoje). Os endpoints de administração (`/v1/products/manage`, `POST`/`PATCH`/`DELETE`) existem na API, mas **não há nenhuma tela no frontend atual que os consuma** — o CRUD de produtos, hoje, só é exercitável diretamente pela API. Ver "Pontos que precisam de confirmação".

### Pedidos

`GET /v1/orders` (com `status=pending` por padrão) · `POST /v1/orders` · `PATCH /v1/orders/:id` · `POST /v1/orders/:id/archive` e `/unarchive`.

---

## 5.4 Sincronização

O sistema **não utiliza WebSocket nem Webhooks** para manter dispositivos atualizados. A estratégia implementada é *refetch* periódico (polling):

- Hook `src/hooks/useAutoRefresh.ts` no frontend, aplicado às listas de **clientes** e **pedidos** (não ao catálogo de produtos).
- Repetição a cada 12 segundos, usando a API `AppState` do React Native: o intervalo é pausado quando o app vai para segundo plano e uma atualização imediata é disparada ao voltar para o primeiro plano.
- Após qualquer escrita (`POST`/`PATCH`/`DELETE`/`archive`/`unarchive`), o frontend dispara imediatamente um novo `GET` da lista correspondente, em paralelo, sem bloquear a resposta da operação para o usuário.
- Não há parâmetro de API dedicado a essa sincronização (ex.: `If-Modified-Since`, ETag) — cada ciclo repete a mesma chamada `GET` completa, com paginação normal.

Detalhamento completo da implementação no frontend: ver `frontend.md`.

### Melhorias futuras

- Substituição do polling por **WebSocket**, permitindo que o backend envie eventos imediatamente após cada alteração — cogitada como evolução caso o número de usuários simultâneos cresça, mas **não implementada**.
- Endpoint dedicado de catálogo com sincronização periódica (hoje o catálogo só é buscado uma vez por sessão).

---

## Pontos que precisam de confirmação

- **Endpoints de administração de produtos sem tela correspondente**: `POST/PATCH/DELETE /v1/products` e `GET /v1/products/manage` existem e funcionam na API (protegidos por papel `OWNER`), mas o frontend atual não tem nenhuma tela que os utilize. Se o TCC descrever "cadastro de produtos" como funcionalidade do sistema, é importante deixar claro que hoje isso só existe no nível da API, não da interface do app.
- **Ausência de endpoint de cancelamento de pedido**: o modelo de dados reserva o status `CANCELED`, mas não há rota que o utilize — só existe arquivar/reabrir.
