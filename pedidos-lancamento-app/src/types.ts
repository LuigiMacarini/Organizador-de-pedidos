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

export type Customer = {
  id: string;
  name: string;
  /** Telefone ou WhatsApp. */
  phone: string;
  address?: string | null;
  note: string;
  orderCount?: number;
  createdAt: number;
  updatedAt: number;
};
