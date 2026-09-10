import * as routeRepository from "../../infrastructure/db/routeRepository.js";
import * as orderRepository from "../../infrastructure/db/orderRepository.js";
import { optimizeRoute, type RouteStop } from "../../infrastructure/external/routingClient.js";
import { AppError, NotFoundError } from "../../domain/errors.js";
import { toRouteDTO, type CreateRouteInput, type StartRouteInput } from "../../domain/route.js";
import { toPage, type PaginationQuery } from "../../domain/pagination.js";

export async function list(query: PaginationQuery) {
  const rows = await routeRepository.list(query.cursor, query.limit);
  return toPage(rows, query.limit, toRouteDTO);
}

export async function get(id: string) {
  const route = await routeRepository.findById(id);
  if (!route) throw new NotFoundError("Rota não encontrada");
  return toRouteDTO(route);
}

/**
 * Só agrupa os pedidos escolhidos numa rota em rascunho, na ordem em que
 * foram selecionados — sem origem (não existe depósito fixo) e sem chamar a
 * Routes API: a ordem de visita e a distância/tempo só fazem sentido a partir
 * de onde o entregador realmente está, então só são calculadas em `start`.
 */
export async function create(input: CreateRouteInput, delivererId: string) {
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

  const byId = new Map(orders.map((o) => [o.id, o]));
  const deliveries = input.orderIds.map((orderId, index) => {
    const order = byId.get(orderId)!;
    return {
      orderId: order.id,
      customerId: order.customerId,
      sequence: index + 1,
      destinationLat: order.customer.latitude!,
      destinationLng: order.customer.longitude!,
    };
  });

  const route = await routeRepository.create({ delivererId, deliveries });
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
 * A origem real da rota é a posição do GPS no momento de iniciar — não existe
 * mais depósito/local fixo. É aqui, e só aqui, que a Routes API é chamada
 * pela primeira vez: calcula a ordem eficiente de visita às paradas (partindo
 * do GPS, sem voltar — `optimizeRoute`) e grava sequência + distância/tempo/
 * geometria numa única chamada.
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
  if (route.deliveries.length === 0) {
    throw new AppError("Rota sem nenhuma entrega", 400);
  }

  const stops: RouteStop[] = route.deliveries
    .slice()
    .sort((a, b) => a.sequence - b.sequence)
    .map((d) => ({ refId: d.id, latitude: d.destinationLat, longitude: d.destinationLng }));

  let deliveryOrder: string[];
  let metrics: { totalDistanceMeters: number; totalDurationSeconds: number; geometry: string | null } | null;
  try {
    const optimized = await optimizeRoute(
      { latitude: input.currentLat, longitude: input.currentLng },
      stops
    );
    deliveryOrder = optimized.order;
    metrics = {
      totalDistanceMeters: optimized.totalDistanceMeters,
      totalDurationSeconds: optimized.totalDurationSeconds,
      geometry: optimized.geometry,
    };
  } catch {
    // Modo degradado (mesmo já usado no recálculo por entrega): o provedor
    // falhou, mas isso não pode impedir o entregador de começar a trabalhar —
    // segue com a ordem já existente (da criação) e sem métricas/geometria.
    deliveryOrder = stops.map((s) => s.refId);
    metrics = null;
  }

  const updated = await routeRepository.start(id, {
    startLat: input.currentLat,
    startLng: input.currentLng,
    deliveryOrder,
    metrics,
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
