import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { loadCustomers, saveCustomers } from "./customersStorage";
import { makeId } from "./storage";
import type { Customer } from "./types";

export function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

export type CustomerInput = {
  name: string;
  contact?: string;
  note?: string;
};

export type ImportResult = {
  imported: number;
  skipped: number;
};

type CustomersContextValue = {
  customers: Customer[];
  loading: boolean;
  refresh: () => Promise<void>;
  createCustomer: (input: CustomerInput) => Promise<Customer>;
  updateCustomer: (customer: Customer) => Promise<void>;
  deleteCustomer: (id: string) => Promise<void>;
  importCustomers: (rows: CustomerInput[]) => Promise<ImportResult>;
  findByName: (name: string) => Customer | undefined;
};

const CustomersContext = createContext<CustomersContextValue | null>(null);

export function CustomersProvider({ children }: { children: React.ReactNode }) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setCustomers(await loadCustomers());
    } catch (e) {
      console.error(e);
      setCustomers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const createCustomer = useCallback(async (input: CustomerInput) => {
    const now = Date.now();
    const customer: Customer = {
      id: makeId(),
      name: input.name.trim(),
      contact: input.contact?.trim() || undefined,
      note: input.note?.trim() || undefined,
      createdAt: now,
      updatedAt: now,
    };
    setCustomers((prev) => {
      const next = [...prev, customer];
      void saveCustomers(next);
      return next;
    });
    return customer;
  }, []);

  const updateCustomer = useCallback(async (customer: Customer) => {
    const updated: Customer = {
      ...customer,
      name: customer.name.trim(),
      contact: customer.contact?.trim() || undefined,
      note: customer.note?.trim() || undefined,
      updatedAt: Date.now(),
    };
    setCustomers((prev) => {
      const next = prev.map((c) => (c.id === updated.id ? updated : c));
      void saveCustomers(next);
      return next;
    });
  }, []);

  const deleteCustomer = useCallback(async (id: string) => {
    setCustomers((prev) => {
      const next = prev.filter((c) => c.id !== id);
      void saveCustomers(next);
      return next;
    });
  }, []);

  const importCustomers = useCallback(async (rows: CustomerInput[]) => {
    let imported = 0;
    let skipped = 0;
    setCustomers((prev) => {
      const seen = new Set(prev.map((c) => normalizeName(c.name)));
      const now = Date.now();
      const additions: Customer[] = [];
      for (const row of rows) {
        const name = row.name?.trim();
        if (!name) {
          skipped += 1;
          continue;
        }
        const key = normalizeName(name);
        if (seen.has(key)) {
          skipped += 1;
          continue;
        }
        seen.add(key);
        additions.push({
          id: makeId(),
          name,
          contact: row.contact?.trim() || undefined,
          note: row.note?.trim() || undefined,
          createdAt: now,
          updatedAt: now,
        });
        imported += 1;
      }
      if (additions.length === 0) return prev;
      const next = [...prev, ...additions];
      void saveCustomers(next);
      return next;
    });
    return { imported, skipped };
  }, []);

  const findByName = useCallback(
    (name: string) => {
      const key = normalizeName(name);
      return customers.find((c) => normalizeName(c.name) === key);
    },
    [customers]
  );

  const value = useMemo(
    () => ({
      customers,
      loading,
      refresh,
      createCustomer,
      updateCustomer,
      deleteCustomer,
      importCustomers,
      findByName,
    }),
    [
      customers,
      loading,
      refresh,
      createCustomer,
      updateCustomer,
      deleteCustomer,
      importCustomers,
      findByName,
    ]
  );

  return (
    <CustomersContext.Provider value={value}>{children}</CustomersContext.Provider>
  );
}

export function useCustomers() {
  const ctx = useContext(CustomersContext);
  if (!ctx) throw new Error("useCustomers must be used within CustomersProvider");
  return ctx;
}
