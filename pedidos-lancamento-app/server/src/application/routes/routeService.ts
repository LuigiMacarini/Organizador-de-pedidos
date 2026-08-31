import * as routeRepository from "../../infrastructure/db/routeRepository.js";
import * as orderRepository from "../../infrastructure/db/orderRepository.js";
import { optimizeRoute, type RouteStop } from "../../infrastructure/external/routingClient.js";
import { AppError, NotFoundError } from "../../domain/errors.js";
import { toRouteDTO, type CreateRouteInput } from "../../domain/route.js";
import { toPage, type PaginationQuery } from "../../domain/pagination.js";

type Origin = { lat: number; lng: number; label: string };

/**
 * Sem `originLat`/`originLng` no corpo da requisição, usa a origem fixa da
 * empresa (variáveis de ambiente) — decisão do plano (§11): origem padrão =
 * endereço da empresa, editável por rota quando necessário.
 */
function resolveOrigin(input: CreateRouteInput): Origin {
  if (input.originLat !== undefined && input.originLng !== undefined) {
    return {
      lat: input.originLat,
      lng: input.originLng,
      label: input.originLabel?.trim() || "Origem personalizada",
    };
  }

  const lat = Number(process.env.COMPANY_ORIGIN_LAT);
  const lng = Number(process.env.COMPANY_ORIGIN_LNG);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new AppError(
      "Origem da rota não informada e COMPANY_ORIGIN_LAT/COMPANY_ORIGIN_LNG não configuradas no servidor",
      400
    );
  }
  return { lat, lng, label: process.env.COMPANY_ORIGIN_LABEL?.trim() || "Empresa" };
}

export async function list(query: PaginationQuery) {
  const rows = await routeRepository.list(query.cursor, query.limit);
  return toPage(rows, query.limit, toRouteDTO);
}

export async function get(id: string) {
  const route = await routeRepository.findById(id);
  if (!route) throw new NotFoundError("Rota não encontrada");
  return toRouteDTO(route);
}

export async function create(input: CreateRouteInput, delivererId: string) {
  const origin = resolveOrigin(input);

  const orders = await orderRepository.findManyByIds(input.orderIds);
  if (orders.length !== input.orderIds.length) {
    throw new NotFoundError("Um ou mais pedidos não foram encontrados");
  }
  for (const order of orders) {
    if (order.status !== "PENDING") {
      throw new AppError(`Pedido de ${order.customer.name} não está disponível para roteirização`, 400);
    }
    if (order.customer.geocodeStatus !== "OK") {
      throw new AppError(
        `Cliente ${order.customer.name} não tem endereço geocodificado com confiança suficiente`,
        400
      );
    }
  }

  const stops: RouteStop[] = orders.map((order) => ({
    refId: order.id,
    latitude: order.customer.latitude!,
    longitude: order.customer.longitude!,
  }));

  let orderedIds: string[];
  let totalDistanceMeters: number;
  let totalDurationSeconds: number;
  try {
    const optimized = await optimizeRoute({ latitude: origin.lat, longitude: origin.lng }, stops);
    orderedIds = optimized.order;
    totalDistanceMeters = optimized.totalDistanceMeters;
    totalDurationSeconds = optimized.totalDurationSeconds;
  } catch {
    // Modo degradado (plano, §13): o provedor falhou, mas isso não deve
    // travar a criação da rota — segue com a ordem de seleção, sem métricas.
    orderedIds = input.orderIds;
    totalDistanceMeters = 0;
    totalDurationSeconds = 0;
  }

  const byId = new Map(orders.map((o) => [o.id, o]));
  const deliveries = orderedIds.map((orderId, index) => {
    const order = byId.get(orderId)!;
    return {
      orderId: order.id,
      customerId: order.customerId,
      sequence: index + 1,
      destinationLat: order.customer.latitude!,
      destinationLng: order.customer.longitude!,
    };
  });

  const route = await routeRepository.create({
    delivererId,
    originLabel: origin.label,
    originLat: origin.lat,
    originLng: origin.lng,
    totalDistanceMeters,
    totalDurationSeconds,
    deliveries,
  });

  return toRouteDTO(route);
}

export async function start(id: string) {
  const route = await get(id);
  if (route.status !== "DRAFT") {
    throw new AppError("Só é possível iniciar uma rota que ainda não começou", 409);
  }
  const updated = await routeRepository.setStatus(id, "IN_PROGRESS", { startedAt: new Date() });
  return toRouteDTO(updated);
}

export async function cancel(id: string) {
  const route = await get(id);
  if (route.status === "COMPLETED" || route.status === "CANCELED") {
    throw new AppError("Esta rota já foi encerrada", 409);
  }
  await routeRepository.releaseOrdersBackToPending(id);
  const updated = await routeRepository.setStatus(id, "CANCELED");
  return toRouteDTO(updated);
}
