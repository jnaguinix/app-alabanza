import { useEffect, useState } from 'react';

/**
 * Ejecuta una consulta asíncrona y devuelve { data, loading, error }.
 * Conserva el dato anterior mientras carga el siguiente para evitar parpadeos.
 */
export function useAsync(fn, deps) {
  const [state, setState] = useState({ data: null, loading: true, error: null });

  useEffect(() => {
    let cancelled = false;
    setState((s) => ({ ...s, loading: true }));
    fn()
      .then((data) => !cancelled && setState({ data, loading: false, error: null }))
      .catch((error) => !cancelled && setState({ data: null, loading: false, error }));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return state;
}
