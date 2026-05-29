export type Product = {
  id: string;
  name: string;
  unitPrice: number;
  /** Opcional — usado em busca e exibição quando existir */
  sku?: string;
};

export type LineItem = {
  productId: string;
  name: string;
  unitPrice: number;
  qty: number;
};

export type Order = {
  id: string;
  /** Vínculo opcional ao cliente cadastrado (local). Pode faltar em pedidos antigos/modo remoto. */
  customerId?: string;
  customerName: string;
  items: LineItem[];
  notes: string;
  createdAt: number;
  updatedAt: number;
};

export type Customer = {
  id: string;
  name: string;
  /** Telefone ou WhatsApp */
  contact?: string;
  /** Observação livre para identificação */
  note?: string;
  createdAt: number;
  updatedAt: number;
};
