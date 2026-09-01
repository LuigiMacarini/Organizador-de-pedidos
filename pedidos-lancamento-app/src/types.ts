export type Role = "OWNER" | "EMPLOYEE" | "CUSTOMER" | "DELIVERER";

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
};

export type Product = {
  id: string;
  name: string;
  category: string;
  unitPrice: number;
  sku?: string | null;
  active: boolean;
};

export type LineItem = {
  productId: string;
  name: string;
  unitPrice: number;
  qty: number;
};

/** Pedidos ativos usam PENDING/ARCHIVED. Os demais pertencem ao fluxo futuro de Remessa/Entrega. */
export type OrderStatus = "PENDING" | "ARCHIVED" | "RELEASED" | "DELIVERED" | "CANCELED";

export type Order = {
  id: string;
  customerId: string;
  customerName: string;
  items: LineItem[];
  notes: string;
  status: OrderStatus;
  createdAt: number;
  updatedAt: number;
};

/** Ver `geocodingService` no backend — PARTIAL/FAILED entram para revisão manual, nunca bloqueiam o cliente. */
export type GeocodeStatus = "PENDING" | "OK" | "PARTIAL" | "FAILED";

export type DeliveryStatus = "PENDING" | "DELIVERED" | "FAILED";

export type Delivery = {
  id: string;
  routeId: string;
  orderId: string;
  customerId: string;
  customerName: string;
  address: string;
  sequence: number;
  destinationLat: number;
  destinationLng: number;
  status: DeliveryStatus;
  deliveredAt: number | null;
  notes: string;
};

export type RouteStatus = "DRAFT" | "IN_PROGRESS" | "COMPLETED" | "CANCELED";

export type DeliveryRoute = {
  id: string;
  delivererId: string;
  status: RouteStatus;
  originLabel: string;
  originLat: number;
  originLng: number;
  totalDistanceMeters: number | null;
  totalDurationSeconds: number | null;
  createdAt: number;
  updatedAt: number;
  startedAt: number | null;
  completedAt: number | null;
  deliveries: Delivery[];
};

export type Customer = {
  id: string;
  name: string;
  /** Telefone ou WhatsApp. */
  phone: string;
  note: string;
  street?: string | null;
  number?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  geocodeStatus: GeocodeStatus;
  orderCount?: number;
  createdAt: number;
  updatedAt: number;
};
