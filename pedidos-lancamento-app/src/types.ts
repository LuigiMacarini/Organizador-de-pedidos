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
  customerName: string;
  items: LineItem[];
  notes: string;
  createdAt: number;
  updatedAt: number;
};
