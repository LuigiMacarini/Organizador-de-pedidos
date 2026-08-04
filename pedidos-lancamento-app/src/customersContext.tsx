import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  remoteCreateCustomer,
  remoteDeleteCustomer,
  remoteListCustomers,
  remoteUpdateCustomer,
} from "./api/customersRemote";
import type { Customer } from "./types";

export function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

export type CustomerInput = {
  name: string;
  phone?: string;
  address?: string;
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
  updateCustomer: (id: string, input: CustomerInput) => Promise<void>;
  deleteCustomer: (id: string) => Promise<void>;
  /** Importação CSV: tenta criar cada linha; duplicados/erros contam como "skipped". */
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
      setCustomers(await remoteListCustomers());
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
    const created = await remoteCreateCustomer(input);
    setCustomers((prev) => [created, ...prev]);
    return created;
  }, []);

  const updateCustomer = useCallback(async (id: string, input: CustomerInput) => {
    const updated = await remoteUpdateCustomer(id, input);
    setCustomers((prev) => prev.map((c) => (c.id === id ? updated : c)));
  }, []);

  const deleteCustomer = useCallback(async (id: string) => {
    await remoteDeleteCustomer(id);
    setCustomers((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const importCustomers = useCallback(async (rows: CustomerInput[]) => {
    let imported = 0;
    let skipped = 0;
    const created: Customer[] = [];
    for (const row of rows) {
      const name = row.name?.trim();
      if (!name) {
        skipped += 1;
        continue;
      }
      try {
        created.push(await remoteCreateCustomer({ ...row, name }));
        imported += 1;
      } catch {
        // Nome duplicado (409) ou outro erro pontual: conta como ignorado e segue a importação.
        skipped += 1;
      }
    }
    if (created.length > 0) {
      setCustomers((prev) => [...created, ...prev]);
    }
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
