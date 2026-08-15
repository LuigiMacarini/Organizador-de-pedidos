# Backend — Projeto ORG

> Documenta exclusivamente a implementação interna do servidor: arquitetura em camadas, regras de negócio, processamento e segurança. O contrato HTTP exposto por essa implementação está em `api.md`; a estrutura de dados manipulada, em `banco-de-dados.md`.

---

## 4.1 Tecnologias

| Item | Tecnologia | Origem no código |
|---|---|---|
| Framework HTTP | Fastify `^5.2.1` | `server/package.json`, `server/src/index.ts` |
| Linguagem | TypeScript `~5.6.3` | `server/package.json`, `server/tsconfig.json` |
| Ambiente de execução | Node.js, módulos ESM nativos | `server/package.json` (`"type": "module"`) |
| Execução em desenvolvimento | `tsx watch` | script `dev` em `server/package.json` |
| Build de produção | `tsc` → `dist/`, executado com `node dist/index.js` | scripts `build`/`start` |
| ORM | Prisma `^6.19.0` | ver `banco-de-dados.md` |
| Validação de entrada | Zod `^3.24.1` | `server/src/domain/*.ts` |
| Autenticação | `jsonwebtoken ^9.0.2` (JWT) | `server/src/infrastructure/auth/jwt.ts` |
| Hash de senha | `bcryptjs ^2.4.3` | `server/src/infrastructure/auth/hash.ts` |
| CORS | `@fastify/cors ^10.0.1` | `server/src/index.ts` |
| Encapsulamento de plugin | `fastify-plugin ^5.0.1` | `server/src/interface/http/plugins/authGuard.ts` |

Não foi identificado nenhum framework de *dependency injection* (NestJS, InversifyJS, etc.), nenhuma biblioteca de log estruturado além do logger nativo do Fastify (`Fastify({ logger: true })`), e nenhuma integração com serviços externos (fila, cache distribuído, e-mail). **Não identificado no código atual.**

---

## 4.2 Arquitetura

O backend é organizado em quatro camadas, por convenção de pastas (não há um framework como NestJS impondo essa separação — é uma organização manual):

```text
server/src/
  domain/            tipos, DTOs e schemas de validação (Zod) — sem dependência de Fastify/Prisma
  application/        services: casos de uso que orquestram repositórios + regras de domínio
  infrastructure/      acesso a dados (Prisma) e serviços técnicos (hash de senha, JWT)
  interface/http/       rotas Fastify, plugins de autenticação e tratamento de erro
```

### "Controllers" (rotas HTTP)

Local: `server/src/interface/http/routes/`. Um arquivo por recurso, cada um registrado como plugin do Fastify: `auth.ts`, `customers.ts`, `products.ts`, `orders.ts`. Responsabilidade: receber a requisição, validar o corpo/query com o schema Zod correspondente (`.parse(...)`), chamar o *service* apropriado e devolver a resposta HTTP. Não contêm regra de negócio.

### Services (camada de aplicação)

Local: `server/src/application/{auth,customers,orders,products}/`. Funções (não classes) que implementam os casos de uso, chamando um ou mais repositórios e aplicando regras — por exemplo, `orderService.archive(id)` primeiro confirma que o pedido existe (`get`) e depois troca o status para `ARCHIVED` via repositório.

### Repositories (infraestrutura)

Local: `server/src/infrastructure/db/`. Um módulo por entidade: `customerRepository.ts`, `orderRepository.ts`, `productRepository.ts`, `userRepository.ts`. Responsabilidade exclusiva: chamadas ao Prisma Client. Nenhuma regra de negócio aqui além da montagem das consultas.

### DTOs

Local: `server/src/domain/*.ts`. Tipos de saída (`CustomerDTO`, `ProductDTO`, `OrderDTO`, `OrderLineDTO`, `AuthenticatedUser`) e funções `toXDTO` que convertem o resultado do Prisma para o formato exposto na API (por exemplo, convertendo `DateTime` para epoch em milissegundos).

### Guards / Middlewares

Local: `server/src/interface/http/plugins/authGuard.ts`.

- Um plugin global (registrado com `fastify-plugin`, para não ficar isolado no escopo de encapsulamento do Fastify) decodifica o cabeçalho `Authorization: Bearer <token>` em todas as requisições, populando `request.authUser` quando o token é válido.
- `requireAuth` — `preHandler` que rejeita (`401`) requisições sem `request.authUser`.
- `requireRole(...roles)` — `preHandler` que exige autenticação e, além disso, verifica se o papel do usuário está entre os permitidos, rejeitando com `403` caso contrário. Único uso hoje: rotas de administração de produtos, restritas a `OWNER`.

### Interceptors

**Não identificado no código atual** (não há uso do conceito de *interceptor* do Fastify além dos hooks já descritos como *preHandler*).

---

## 4.3 Regras de negócio

| Regra | Onde está implementada | Descrição |
|---|---|---|
| Deduplicação de cliente por nome | `server/src/infrastructure/db/customerRepository.ts` (`create`, `update`) | Nome normalizado (`nameKey`) precisa ser único; violação retorna erro `409` |
| Bloqueio de exclusão de cliente com pedidos | `customerRepository.ts` (`remove`) | Intercepta a violação de FK do banco (`P2003`) e converte em `409` |
| Preço/nome do item de pedido vêm sempre do catálogo | `server/src/infrastructure/db/orderRepository.ts` (`resolveLines`) | O `productId` e a `qty` são o único dado aceito do cliente; nome e preço são resolvidos a partir do `Product` atual no banco |
| Produto indisponível não pode ser pedido | `orderRepository.ts` (`resolveLines`) | Produto inexistente ou com `active = false` gera erro `400` ao tentar criar/editar pedido |
| Produto não é excluído fisicamente | `server/src/application/products/productService.ts` (`deactivate`) | "Excluir" um produto marca `active = false` |
| Pedido não é excluído fisicamente pelo fluxo principal | `server/src/application/orders/orderService.ts` (`archive`/`unarchive`) | Alternam `status` entre `PENDING` e `ARCHIVED`, preservando o registro |
| Cálculo de totais do pedido | Não realizado no backend | O total do pedido é calculado no frontend a partir dos itens retornados; o backend não persiste nem retorna um valor agregado (ver `frontend.md`) |

**Diferenciação regra de negócio × implementação técnica:** por exemplo, "um pedido nunca deve perder o histórico ao ser encerrado" é a *regra de negócio*; "trocar `Order.status` para `ARCHIVED` em vez de rodar um `DELETE`" é a *implementação técnica* que a satisfaz.

---

## 4.4 Processamento

Fluxo interno típico de uma escrita (exemplo: criação de pedido):

```text
Rota (orders.ts)
    ↓
Validação do corpo da requisição (createOrderInputSchema.parse — Zod)
    ↓
Service (orderService.create)
    ↓
Repository (orderRepository.create)
    ↓  confirma existência do cliente; resolve nome/preço de cada item (resolveLines)
Prisma Client → INSERT em Order + OrderLine
    ↓
DTO de resposta (toOrderDTO)
    ↓
Resposta HTTP 201
```

Tratamento de erros centralizado em `server/src/interface/http/plugins/errorHandler.ts` (`app.setErrorHandler`):

- Erros da classe `AppError` (e subclasses `NotFoundError`, `UnauthorizedError`, `ForbiddenError`, em `server/src/domain/errors.ts`) → resposta com o `statusCode` da própria classe.
- `ZodError` → `400`, com as mensagens de todos os problemas de validação concatenadas.
- Qualquer outro erro → log via `app.log.error` + resposta genérica `500` (`{ "error": "Erro interno" }`), sem vazar detalhes internos ao cliente.

Logs: apenas o logger padrão do Fastify (`Fastify({ logger: true })`), sem biblioteca externa de log estruturado.

---

## 4.5 Autenticação e segurança

- **Login**: `POST /v1/auth/login`, e-mail + senha (`server/src/application/auth/authService.ts`).
- **Senha**: armazenada como hash `bcrypt` (`bcryptjs`, 10 *salt rounds* — `server/src/infrastructure/auth/hash.ts`); nunca em texto puro.
- **Tokens**: dois JWT emitidos no login — token de acesso (`expiresIn: "2h"`) e token de renovação (`expiresIn: "30d"`), assinados com o mesmo segredo (`JWT_SECRET`), diferenciados por um campo `type` no payload (`server/src/infrastructure/auth/jwt.ts`).
- **Renovação de sessão**: `POST /v1/auth/refresh`, sem exigir novo login enquanto o token de renovação for válido.
- **Autorização por papel**: `enum Role` (`OWNER`, `EMPLOYEE`, `CUSTOMER`, `DELIVERER`). Só `OWNER` e `EMPLOYEE` têm uso efetivo hoje; `CUSTOMER`/`DELIVERER` estão reservados no schema, sem rota associada. Único uso de `requireRole` hoje: `OWNER` nas rotas de administração de produtos.
- **Proteção de rotas**: `requireAuth` aplicado a todas as rotas, exceto `/health`, `/v1/auth/login` e `/v1/auth/refresh`.
- **Validação de entrada**: todo endpoint de escrita valida o corpo com Zod antes de qualquer processamento.
- **Segredos fora do controle de versão**: `server/.env` está no `.gitignore`; apenas `server/.env.example`, com valores de exemplo, é versionado.

Esta seção documenta apenas os mecanismos efetivamente implementados — não é uma auditoria de segurança.

---

## Estado real do projeto (backend)

### Implementado

Tudo o que está descrito nas seções 4.2 a 4.5.

### Parcialmente implementado

- Autorização por papel: o modelo (`Role`) já contempla quatro papéis, mas a lógica de autorização (`requireRole`) só é usada para um caso (administração de produtos, restrita a `OWNER`). Os demais recursos (clientes, pedidos) exigem apenas autenticação, sem distinção de papel entre `OWNER` e `EMPLOYEE`.

### Planejado / melhorias futuras

- Entidade de Remessa e regras de negócio associadas (fechamento de remessa, geração de resumo para o fabricante).
- Regras de negócio para os papéis `CUSTOMER` e `DELIVERER`.
- Regra de cancelamento de pedido (hoje só existe arquivar/reabrir).
- Testes automatizados do backend — **não identificados no projeto atual**.

---

## Pontos que precisam de confirmação

- Não há diferenciação de permissões entre `OWNER` e `EMPLOYEE` em nenhuma rota de cliente/pedido hoje — os dois papéis têm exatamente o mesmo acesso, exceto na administração de produtos. Vale confirmar se essa é a intenção final ou uma lacuna a preencher.
