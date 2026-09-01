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
import { useAuth } from "./auth/authContext";
import { useAutoRefresh } from "./hooks/useAutoRefresh";
import type { Customer } from "./types";

export function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

export type CustomerInput = {
  name: string;
  phone?: string;
  note?: string;
  street?: string;
  number?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  zipCode?: string;
};

export type ImportResult = {
  imported: number;
  skipped: number;
};

type RefreshOptions = { silent?: boolean };

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
  const { user } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async (opts?: RefreshOptions) => {
    if (!opts?.silent) setLoading(true);
    try {
      setCustomers(await remoteListCustomers());
    } catch (e) {
      console.error(e);
      // Mantém a lista atual em erros pontuais (polling/refresh em segundo
      // plano) — sumir com os dados por causa de uma falha passageira de
      // rede seria pior do que só tentar de novo no próximo ciclo.
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    void refresh();
  }, [user, refresh]);

  // MVP de sincronização entre dispositivos: sem WebSocket/webhook por
  // enquanto, só refetch periódico (pausa em segundo plano, atualiza na
  // hora ao voltar pro app — ver useAutoRefresh).
  useAutoRefresh(() => {
    if (user) void refresh({ silent: true });
  });

  const createCustomer = useCallback(
    async (input: CustomerInput) => {
      const created = await remoteCreateCustomer(input);
      setCustomers((prev) => [created, ...prev]);
      void refresh({ silent: true });
      return created;
    },
    [refresh]
  );

  const updateCustomer = useCallback(
    async (id: string, input: CustomerInput) => {
      const updated = await remoteUpdateCustomer(id, input);
      setCustomers((prev) => prev.map((c) => (c.id === id ? updated : c)));
      void refresh({ silent: true });
    },
    [refresh]
  );

  const deleteCustomer = useCallback(
    async (id: string) => {
      await remoteDeleteCustomer(id);
      setCustomers((prev) => prev.filter((c) => c.id !== id));
      void refresh({ silent: true });
    },
    [refresh]
  );

  const importCustomers = useCallback(
    async (rows: CustomerInput[]) => {
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
        void refresh({ silent: true });
      }
      return { imported, skipped };
    },
    [refresh]
  );

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
      refresh: () => refresh(),
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
