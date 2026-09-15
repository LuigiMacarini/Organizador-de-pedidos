import { prisma } from "./prismaClient.js";
import type { CustomerSummaryRow, MonthlySummary, ProductSummaryRow } from "../../domain/report.js";

/**
 * Consultas agregadas pro fechamento mensal. `groupBy` do Prisma não soma
 * `unitPrice × qty` através da relação Order→OrderLine numa chamada só, por
 * isso `$queryRaw` aqui — sempre parametrizado (datas via tagged template,
 * nunca concatenação de string), sem risco de injection. Pedidos CANCELED
 * nunca contam como faturamento (mesmo não sendo usado hoje no app).
 */

type SummaryRow = {
  revenue: string | null;
  order_count: bigint;
  customer_count: bigint;
  product_units: string | null;
};

export async function getMonthlySummary(start: Date, end: Date): Promise<MonthlySummary> {
  const rows = await prisma.$queryRaw<SummaryRow[]>`
    SELECT
      COALESCE(SUM(ol."unitPrice" * ol.qty), 0)::text AS revenue,
      COUNT(DISTINCT o.id) AS order_count,
      COUNT(DISTINCT o."customerId") AS customer_count,
      COALESCE(SUM(ol.qty), 0)::text AS product_units
    FROM "Order" o
    LEFT JOIN "OrderLine" ol ON ol."orderId" = o.id
    WHERE o."createdAt" >= ${start} AND o."createdAt" < ${end} AND o.status != 'CANCELED'
  `;
  const row = rows[0];
  const revenue = Number(row?.revenue ?? 0);
  const orderCount = Number(row?.order_count ?? 0);
  return {
    revenue,
    orderCount,
    customerCount: Number(row?.customer_count ?? 0),
    productUnits: Number(row?.product_units ?? 0),
    avgTicket: orderCount === 0 ? null : revenue / orderCount,
  };
}

type CustomerRow = { customer_id: string; customer_name: string; order_count: bigint; total: string };

export async function getByCustomer(start: Date, end: Date): Promise<CustomerSummaryRow[]> {
  const rows = await prisma.$queryRaw<CustomerRow[]>`
    SELECT
      o."customerId" AS customer_id,
      c.name AS customer_name,
      COUNT(DISTINCT o.id) AS order_count,
      COALESCE(SUM(ol."unitPrice" * ol.qty), 0)::text AS total
    FROM "Order" o
    JOIN "Customer" c ON c.id = o."customerId"
    LEFT JOIN "OrderLine" ol ON ol."orderId" = o.id
    WHERE o."createdAt" >= ${start} AND o."createdAt" < ${end} AND o.status != 'CANCELED'
    GROUP BY o."customerId", c.name
    ORDER BY total DESC
  `;
  return rows.map((r) => ({
    customerId: r.customer_id,
    customerName: r.customer_name,
    orderCount: Number(r.order_count),
    total: Number(r.total),
  }));
}

type ProductRow = { product_id: string; product_name: string; units_sold: string; revenue: string };

export async function getByProduct(start: Date, end: Date): Promise<ProductSummaryRow[]> {
  const rows = await prisma.$queryRaw<ProductRow[]>`
    SELECT
      ol."productId" AS product_id,
      COALESCE(p.name, ol.name) AS product_name,
      COALESCE(SUM(ol.qty), 0)::text AS units_sold,
      COALESCE(SUM(ol."unitPrice" * ol.qty), 0)::text AS revenue
    FROM "OrderLine" ol
    JOIN "Order" o ON o.id = ol."orderId"
    LEFT JOIN "Product" p ON p.id = ol."productId"
    WHERE o."createdAt" >= ${start} AND o."createdAt" < ${end} AND o.status != 'CANCELED'
    GROUP BY ol."productId", COALESCE(p.name, ol.name)
    ORDER BY units_sold DESC
  `;
  return rows.map((r) => ({
    productId: r.product_id,
    productName: r.product_name,
    unitsSold: Number(r.units_sold),
    revenue: Number(r.revenue),
  }));
}

type MonthRow = { month: string };

/** Meses (AAAA-MM) com pelo menos um pedido não cancelado — nunca inclui mês vazio artificialmente. */
export async function getAvailableMonths(): Promise<string[]> {
  const rows = await prisma.$queryRaw<MonthRow[]>`
    SELECT DISTINCT to_char(date_trunc('month', "createdAt"), 'YYYY-MM') AS month
    FROM "Order"
    WHERE status != 'CANCELED'
    ORDER BY month DESC
  `;
  return rows.map((r) => r.month);
}
