import { z } from "zod";

/** Paginação simples por cursor (id da última linha vista) + limite. */
export const paginationQuerySchema = z.object({
  cursor: z.string().trim().min(1).optional(),
  limit: z.coerce.number().int().positive().max(200).optional().default(50),
});

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

export type Page<T> = {
  items: T[];
  nextCursor: string | null;
};

/** Busca `limit + 1` no repositório e usa o item extra só para saber se há próxima página. */
export function toPage<Row extends { id: string }, T>(
  rows: Row[],
  limit: number,
  map: (row: Row) => T
): Page<T> {
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  return {
    items: page.map(map),
    nextCursor: hasMore ? page[page.length - 1].id : null,
  };
}
