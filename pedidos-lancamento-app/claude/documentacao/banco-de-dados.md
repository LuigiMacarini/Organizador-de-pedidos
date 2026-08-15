# Banco de Dados — Projeto ORG

> Documenta exclusivamente persistência: SGBD, ORM, estrutura de entidades, relacionamentos, migrations/seeds. Para os endpoints que expõem esses dados, ver `api.md`. Para as regras de negócio que os manipulam, ver `backend.md`.

---

## 6.1 Tecnologias

| Item | Tecnologia | Origem no código |
|---|---|---|
| SGBD | PostgreSQL | `server/prisma/schema.prisma` (`provider = "postgresql"`); hospedado no Render (serviço `pedidos-db`, PostgreSQL 18, região Oregon — visto no painel do Render) |
| ORM | Prisma `^6.19.0` | `server/package.json` (`@prisma/client`, `prisma`) |
| Ferramenta de migration | **Não identificado no código atual** — ver seção 6.5 |
| Ferramenta de seed | Script próprio em TypeScript, executado com `tsx` | `server/prisma/seed.ts`, script `db:seed` em `server/package.json` |
| Cliente de administração | Prisma Studio (`npx prisma studio`) | script `db:studio` em `server/package.json` |

---

## 6.2 Estrutura

Definida em `server/prisma/schema.prisma`. Cinco modelos e dois enums.

### `User`

Finalidade: usuários com acesso ao sistema (login).

| Campo | Tipo | Observação |
|---|---|---|
| `id` | `String` (`@id @default(cuid())`) | Chave primária |
| `email` | `String` | `@unique` |
| `passwordHash` | `String` | Hash bcrypt, nunca a senha em texto puro |
| `name` | `String` | |
| `role` | `Role` | Padrão `EMPLOYEE` |
| `createdAt` / `updatedAt` | `DateTime` | Automáticos |

### `Customer`

Finalidade: clientes cadastrados pelo painel do Dono.

| Campo | Tipo | Observação |
|---|---|---|
| `id` | `String` (cuid) | Chave primária |
| `name` | `String` | |
| `nameKey` | `String` | `@unique` — nome normalizado (minúsculas/trim), usado para impedir cadastro duplicado |
| `phone` | `String` | Padrão `""` |
| `address` | `String?` | Opcional; existe no schema mas não há campo correspondente no formulário atual do frontend (`CustomerForm.tsx`) — ver "Pontos que precisam de confirmação" |
| `note` | `String` | Padrão `""` |
| `createdAt` / `updatedAt` | `DateTime` | Automáticos |
| `orders` | `Order[]` | Relação 1:N |

Índice: `@@index([updatedAt])`.

### `Product`

Finalidade: catálogo administrável (substituiu uma lista fixa que antes vivia no código do app).

| Campo | Tipo | Observação |
|---|---|---|
| `id` | `String` (cuid) | Chave primária |
| `name` | `String` | |
| `category` | `String` | Usado para agrupar o catálogo em categorias no frontend |
| `unitPrice` | `Float` | |
| `sku` | `String?` | Opcional |
| `active` | `Boolean` | Padrão `true` — controla *soft delete* (ver 6.4) |
| `createdAt` / `updatedAt` | `DateTime` | Automáticos |
| `lines` | `OrderLine[]` | Relação 1:N |

Índices: `@@index([category])`, `@@index([active])`.

### `Order`

Finalidade: pedidos lançados.

| Campo | Tipo | Observação |
|---|---|---|
| `id` | `String` (cuid) | Chave primária |
| `customerId` | `String` | Chave estrangeira para `Customer` |
| `notes` | `String` | Padrão `""` |
| `status` | `OrderStatus` | Padrão `PENDING` |
| `shipmentId` | `String?` | Opcional, **sem relação/FK configurada** — coluna reservada para uma futura entidade de Remessa, que não existe no schema hoje |
| `createdAt` / `updatedAt` | `DateTime` | Automáticos |
| `lines` | `OrderLine[]` | Relação 1:N |

Índices: `@@index([customerId])`, `@@index([updatedAt])`, `@@index([status])`, `@@index([shipmentId])`.

### `OrderLine`

Finalidade: itens de um pedido.

| Campo | Tipo | Observação |
|---|---|---|
| `id` | `String` (cuid) | Chave primária |
| `orderId` | `String` | Chave estrangeira para `Order` |
| `productId` | `String` | Chave estrangeira para `Product` |
| `name` | `String` | Cópia do nome do produto no momento do pedido |
| `unitPrice` | `Float` | Cópia do preço do produto no momento do pedido |
| `qty` | `Int` | Quantidade |

Índices: `@@index([orderId])`, `@@index([productId])`.

`name` e `unitPrice` são um retrato (*snapshot*) do produto na hora do pedido — alterações futuras de preço/nome no `Product` não afetam pedidos já registrados. Decisão de modelagem confirmada no código, não uma suposição.

### Enums

```prisma
enum Role {
  OWNER
  EMPLOYEE
  CUSTOMER   // reservado — sem app/rota associados
  DELIVERER  // reservado — sem app/rota associados
}

enum OrderStatus {
  PENDING     // em uso
  ARCHIVED    // em uso
  RELEASED    // reservado — fluxo futuro de Remessa/Entrega
  DELIVERED   // reservado — fluxo futuro de Remessa/Entrega
  CANCELED    // reservado — nenhuma rota/tela usa este valor hoje
}
```

---

## 6.3 Relacionamentos

```text
Customer
   │
   └── 1:N ──> Order
                  │
                  └── 1:N ──> OrderLine ──> N:1 ──> Product
```

- **`Customer 1:N Order`** — `onDelete: Restrict` (`schema.prisma`, relação em `Order.customer`). O banco recusa a exclusão de um cliente que já tenha pedidos associados. A API traduz essa violação em uma resposta HTTP `409` (ver `server/src/infrastructure/db/customerRepository.ts`, função `remove`, que intercepta o erro `P2003` do Prisma).
- **`Order 1:N OrderLine`** — `onDelete: Cascade`. Excluir um pedido remove seus itens automaticamente. Na prática, pedidos não são excluídos pelo fluxo principal da aplicação (ver 6.4).
- **`Product 1:N OrderLine`** — sem cláusula `onDelete` explícita no schema (comportamento padrão do banco, que impede excluir um produto referenciado por algum item de pedido). Por isso a "exclusão" de produto na API é implementada como desativação (`active = false`), nunca remoção física.

Não há relacionamento N:N no schema atual.

---

## 6.4 Persistência

```text
Frontend (Context API)
    ↓
Cliente HTTP (src/api/*Remote.ts)
    ↓  HTTP + JSON + Bearer JWT
Rota Fastify (server/src/interface/http/routes/*.ts)
    ↓
Service (server/src/application/**/*.ts)
    ↓
Repository (server/src/infrastructure/db/*.ts)
    ↓
Prisma Client
    ↓
PostgreSQL (pedidos-db, Render)
```

O frontend nunca acessa o banco diretamente — toda leitura/escrita passa pela API. Não há mais armazenamento local persistente no app (um armazenamento via `AsyncStorage` existiu em uma versão anterior do projeto e foi removido; ver histórico em `frontend.md`).

Estratégias de persistência confirmadas no código:

- **Soft delete de produto** — `Product.active`; a rota `DELETE /v1/products/:id` chama `productService.deactivate`, que apenas atualiza esse campo (`server/src/application/products/productService.ts`).
- **Arquivamento de pedido em vez de exclusão** — `Order.status = ARCHIVED`, usado tanto na tela de detalhe do pedido quanto no fluxo de "fechar mês" (arquivamento em lote). Substituiu um fluxo anterior que apagava pedidos definitivamente.
- **Snapshot de preço/nome em `OrderLine`** — já descrito na seção 6.2.
- **Deduplicação de cliente por nome** — `Customer.nameKey` (`@unique`), normalizado em `server/src/domain/customer.ts` (`normalizeNameKey`).

---

## 6.5 Migrations e Seeds

### Migrations

**Não identificado no código atual.** Não existe a pasta `server/prisma/migrations`. O schema é aplicado ao banco com `prisma db push` (script `db:push`), que sincroniza o banco diretamente com o `schema.prisma`, sem gerar um histórico de migrations versionado. Essa é uma diferença relevante em relação ao uso do `prisma migrate`, e deve ser citada como tal caso o TCC discuta versionamento de schema.

### Seeds

Script `server/prisma/seed.ts` (executado via `npm run db:seed`), com duas responsabilidades:

1. **Popular o catálogo** — uma lista fixa de produtos (originada de um catálogo que antes vivia embutido no app) é gravada via `prisma.product.upsert`, uma linha por produto, usando `id` fixo (ex.: `p1`, `p2`, ...) para tornar a execução idempotente.
2. **Criar o primeiro usuário `OWNER`** — a partir das variáveis de ambiente `SEED_OWNER_EMAIL`, `SEED_OWNER_PASSWORD`, `SEED_OWNER_NAME`, com a senha convertida para hash bcrypt antes da gravação (`prisma.user.upsert`).

O script não é executado automaticamente no deploy (`render.yaml` não inclui esse passo no `buildCommand`/`startCommand`) — é um passo manual, documentado para ser rodado uma vez após o `db push` inicial.

---

## Pontos que precisam de confirmação

- **Campo `Customer.address`**: existe no schema (opcional) e no tipo do frontend, mas não há campo correspondente no formulário atual de cadastro/edição de cliente. Parece reservado para um futuro app do Cliente, mas vale confirmar se é intencional.
- **Coluna `Order.shipmentId`**: existe no schema, sem relação/tabela associada. Só faz sentido quando (e se) uma entidade `Shipment` for criada; até lá, é uma coluna sem uso funcional.
- **Ausência de migrations versionadas**: pode ser relevante mencionar essa decisão (uso de `db push` em vez de `prisma migrate`) na metodologia do TCC, já que afeta a rastreabilidade de mudanças no schema ao longo do desenvolvimento.
