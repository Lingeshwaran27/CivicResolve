import { useCallback, useEffect, useState } from 'react';

export interface AsyncState<T> {
  data: T | null;
  error: Error | null;
  loading: boolean;
  reload: () => void;
  setData: (value: T) => void;
}

interface Settled<T> {
  key: string | null;
  data: T | null;
  error: Error | null;
}

/**
 * Load data when `deps` change. Loading is derived (the latest settled request key differs
 * from the current one), so no state is set synchronously inside the effect, and stale
 * responses from superseded requests are ignored. Previous data stays visible while reloading.
 */
export function useAsync<T>(load: () => Promise<T>, deps: readonly unknown[]): AsyncState<T> {
  const [nonce, setNonce] = useState(0);
  const [settled, setSettled] = useState<Settled<T>>({ key: null, data: null, error: null });
  const key = JSON.stringify([...deps, nonce]);

  useEffect(() => {
    let active = true;
    load().then(
      (data) => active && setSettled({ key, data, error: null }),
      (err: unknown) =>
        active &&
        setSettled((s) => ({
          key,
          data: s.data,
          error: err instanceof Error ? err : new Error(String(err)),
        })),
    );
    return () => {
      active = false;
    };
    // `load` is intentionally excluded: callers pass an inline closure whose inputs are in `deps` (encoded in `key`).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  const setData = useCallback((data: T) => setSettled((s) => ({ ...s, data })), []);
  const current = settled.key === key;
  return {
    data: settled.data,
    error: current ? settled.error : null,
    loading: !current,
    reload,
    setData,
  };
}
