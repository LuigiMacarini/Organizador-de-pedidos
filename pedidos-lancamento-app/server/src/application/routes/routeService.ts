import * as routeRepository from "../../infrastructure/db/routeRepository.js";
import * as orderRepository from "../../infrastructure/db/orderRepository.js";
import {
  computeRouteMetrics,
  optimizeRoute,
  type RouteStop,
} from "../../infrastructure/external/routingClient.js";
import { AppError, NotFoundError } from "../../domain/errors.js";
import { toRouteDTO, type CreateRouteInput, type StartRouteInput } from "../../domain/route.js";
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
  let geometry: string | null;
  try {
    const optimized = await optimizeRoute({ latitude: origin.lat, longitude: origin.lng }, stops);
    orderedIds = optimized.order;
    totalDistanceMeters = optimized.totalDistanceMeters;
    totalDurationSeconds = optimized.totalDurationSeconds;
    geometry = optimized.geometry;
  } catch {
    // Modo degradado (plano, §13): o provedor falhou, mas isso não deve
    // travar a criação da rota — segue com a ordem de seleção, sem métricas
    // nem geometria (o mapa cai de volta em linhas retas entre os pontos).
    orderedIds = input.orderIds;
    totalDistanceMeters = 0;
    totalDurationSeconds = 0;
    geometry = null;
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
    geometry,
    deliveries,
  });

  return toRouteDTO(route);
}

/**
 * "Null Island" (0,0) é o valor que aparece quando uma leitura de GPS falha
 * silenciosamente em algumas plataformas — nunca é uma posição real de
 * entregador. Rejeitar objetivamente isso (e não-finitos) evita usar uma
 * coordenada claramente inválida como origem, sem inventar um limiar de
 * precisão arbitrário (esse não temos como justificar sem dado real).
 */
function isPlausibleCoordinate(lat: number, lng: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lng) && (lat !== 0 || lng !== 0);
}

/**
 * A origem real da rota passa a ser a posição do GPS no momento de iniciar,
 * não mais a origem fixa/depósito usada na criação (essa continua existindo
 * só como destino de retorno). Reotimizar a ORDEM das paradas não é o
 * objetivo aqui — a sequência decidida na criação é preservada; só a
 * distância/duração/geometria são recalculadas a partir da posição real via
 * `computeRouteMetrics` (mesma função já usada no recálculo após cada
 * entrega, nenhuma implementação nova do Google Routes).
 */
export async function start(id: string, input: StartRouteInput) {
  const route = await routeRepository.findById(id);
  if (!route) throw new NotFoundError("Rota não encontrada");
  if (route.status !== "DRAFT") {
    throw new AppError("Só é possível iniciar uma rota que ainda não começou", 409);
  }
  if (!isPlausibleCoordinate(input.currentLat, input.currentLng)) {
    throw new AppError("Localização atual inválida — não foi possível iniciar a rota", 400);
  }

  try {
    const orderedStops = route.deliveries
      .slice()
      .sort((a, b) => a.sequence - b.sequence)
      .map((d) => ({ latitude: d.destinationLat, longitude: d.destinationLng }));

    if (orderedStops.length > 0) {
      const metrics = await computeRouteMetrics(
        { latitude: input.currentLat, longitude: input.currentLng },
        orderedStops,
        { latitude: route.originLat, longitude: route.originLng }
      );
      await routeRepository.updateMetrics(id, metrics);
    }
  } catch {
    // Falha no Google Routes não pode impedir o entregador de começar a
    // trabalhar — segue com as métricas antigas (mesmo modo degradado usado
    // na criação da rota e no recálculo por entrega).
  }

  const updated = await routeRepository.setStatus(id, "IN_PROGRESS", {
    startedAt: new Date(),
    startLat: input.currentLat,
    startLng: input.currentLng,
  });
  return toRouteDTO(updated);
}

/** "Limpar histórico": apaga rotas já encerradas (COMPLETED/CANCELED). Rotas ativas nunca são afetadas. */
export async function clearHistory() {
  const result = await routeRepository.deleteFinished();
  return { deleted: result.count };
}

/** Exclui uma única rota já encerrada — alternativa cirúrgica ao "limpar histórico" (que apaga todas de uma vez). */
export async function remove(id: string) {
  const route = await get(id);
  if (route.status !== "COMPLETED" && route.status !== "CANCELED") {
    throw new AppError("Só é possível excluir rotas já encerradas (concluídas ou canceladas)", 409);
  }
  await routeRepository.remove(id);
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
