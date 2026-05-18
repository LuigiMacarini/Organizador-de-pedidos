/**
 * Plano de backend — pedidos compartilhados (web / outros funcionários)
 *
 * Implementação: pasta `server/` (Fastify + Prisma + SQLite). Ver `server/.env.example`.
 * App: defina `EXPO_PUBLIC_API_URL` (ex.: http://SEU_IP:3333) para usar a API em vez do AsyncStorage.
 *
 * --- Modelo de dados (alinhado ao app atual) ---
 * Order {
 *   id: string (UUID v4 ou ULID)
 *   customerName: string
 *   items: { productId, name, unitPrice, qty }[]
 *   notes: string
 *   createdAt, updatedAt: ISO-8601 ou epoch ms
 *   version?: number (controle de concorrência otimista, recomendado)
 * }
 *
 * --- API REST (exemplo) ---
 * GET    /orders              → lista (paginação ?cursor=&limit=)
 * GET    /orders/:id          → detalhe
 * POST   /orders              → cria (body = payload sem id; servidor gera id)
 * PATCH  /orders/:id          → atualiza parcial/total (enviar `version` ou `updatedAt` esperado)
 * DELETE /orders/:id          → remove
 *
 * Opcional: GET /catalog → devolve seções ou produtos planos para o app não depender só do bundle.
 *
 * --- Autenticação ---
 * JWT (access + refresh) ou sessão HTTP-only cookie para web.
 * Papéis: employee (CRUD pedidos), admin (opcional).
 *
 * --- Concorrência ---
 * Preferir ETag + If-Match ou campo `version` incrementado no PATCH para evitar sobrescrever
 * edição de outro colega sem aviso (retornar 409 Conflict com corpo do estado atual).
 *
 * --- Stack sugerida (escolha uma) ---
 * 1) Supabase (Postgres + RLS por org/loja + Realtime para lista ao vivo)
 * 2) Firebase / Firestore (rápido de subir; regras de segurança por usuário)
 * 3) Node (Fastify/Nest) + Postgres + Prisma + deploy (Railway, Render, Fly)
 *
 * --- Próximos passos no app ---
 * - Camada `src/api/ordersClient.ts` (fetch) substituindo AsyncStorage gradualmente
 * - Modo offline: fila local + sync quando online (opcional)
 */

/** Prefixo sugerido para rotas versionadas */
export const API_V1 = "/v1";

/** Contrato mínimo espelhando o tipo `Order` do cliente (para implementação futura). */
export type ApiOrderLine = {
  productId: string;
  name: string;
  unitPrice: number;
  qty: number;
};

export type ApiOrder = {
  id: string;
  customerName: string;
  items: ApiOrderLine[];
  notes: string;
  createdAt: string;
  updatedAt: string;
  version?: number;
};

export type ApiCreateOrderBody = Omit<ApiOrder, "id" | "createdAt" | "updatedAt" | "version">;

export type ApiPatchOrderBody = Partial<
  Pick<ApiOrder, "customerName" | "items" | "notes">
> & { version?: number };
