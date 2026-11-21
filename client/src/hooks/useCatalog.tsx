import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api } from '../lib/api';
import type { Catalog } from '../lib/types';

const EMPTY: Catalog = { categories: [], priorities: [], statuses: [], departments: [] };
const CatalogContext = createContext<Catalog>(EMPTY);

/** Loads the category/department catalog once from the API (single source of truth). */
export function CatalogProvider({ children, initial }: { children: ReactNode; initial?: Catalog }) {
  const [catalog, setCatalog] = useState<Catalog>(initial ?? EMPTY);
  useEffect(() => {
    if (initial) return;
    let active = true;
    api
      .catalog()
      .then((c) => active && setCatalog(c))
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [initial]);
  return <CatalogContext.Provider value={catalog}>{children}</CatalogContext.Provider>;
}

export function useCatalog(): Catalog {
  return useContext(CatalogContext);
}
