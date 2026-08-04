import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { remoteListProducts } from "./api/productsRemote";
import type { Product } from "./types";

export type CatalogSection = { category: string; products: Product[] };

type ProductsContextValue = {
  products: Product[];
  loading: boolean;
  refresh: () => Promise<void>;
  /** Seções agrupadas por categoria; sem busca, devolve o catálogo completo. */
  searchSections: (query: string) => CatalogSection[];
};

const ProductsContext = createContext<ProductsContextValue | null>(null);

function groupByCategory(products: Product[]): CatalogSection[] {
  const map = new Map<string, Product[]>();
  for (const p of products) {
    const list = map.get(p.category);
    if (list) list.push(p);
    else map.set(p.category, [p]);
  }
  return [...map.entries()].map(([category, categoryProducts]) => ({
    category,
    products: categoryProducts,
  }));
}

function matchesQuery(p: Product, q: string): boolean {
  const hay = `${p.name} ${p.sku ?? ""} ${p.id}`.toLowerCase();
  return hay.includes(q);
}

export function ProductsProvider({ children }: { children: React.ReactNode }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setProducts(await remoteListProducts());
    } catch (e) {
      console.error(e);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const sections = useMemo(() => groupByCategory(products), [products]);

  const searchSections = useCallback(
    (query: string): CatalogSection[] => {
      const q = query.trim().toLowerCase();
      if (!q) return sections;
      return sections
        .map((sec) => ({
          category: sec.category,
          products: sec.products.filter((p) => matchesQuery(p, q)),
        }))
        .filter((sec) => sec.products.length > 0);
    },
    [sections]
  );

  const value = useMemo(
    () => ({ products, loading, refresh, searchSections }),
    [products, loading, refresh, searchSections]
  );

  return <ProductsContext.Provider value={value}>{children}</ProductsContext.Provider>;
}

export function useProducts() {
  const ctx = useContext(ProductsContext);
  if (!ctx) throw new Error("useProducts must be used within ProductsProvider");
  return ctx;
}
