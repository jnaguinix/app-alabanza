import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import * as store from './data/store';
import { DIRECTOR_ROLE } from './data/store';

const AppContext = createContext(null);
export const useApp = () => useContext(AppContext);

const THEME_KEY = 'alabanzapp:theme';
const EMPTY_INDEX = { songs: [], people: [], instruments: [], serviceCount: 0 };

function applyTheme(theme) {
  const dark = theme === 'dark' || (theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dark);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0B1226' : '#F3F5FA');
}

export function AppProvider({ children }) {
  const [index, setIndex] = useState(EMPTY_INDEX);
  const [version, setVersion] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState('inicio');
  const [editDate, setEditDate] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [theme, setThemeState] = useState(() => {
    try {
      return localStorage.getItem(THEME_KEY) || 'system';
    } catch {
      return 'system';
    }
  });

  // Tras escribir solo se vuelve a leer el índice; cada pantalla vuelve a pedir lo suyo al cambiar `version`.
  const refresh = useCallback(async () => {
    setIndex(await store.getIndex());
    setVersion((v) => v + 1);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    applyTheme(theme);
    if (theme !== 'system') return;
    const mq = matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => applyTheme('system');
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [theme]);

  const setTheme = useCallback((t) => {
    setThemeState(t);
    try {
      localStorage.setItem(THEME_KEY, t);
    } catch {
      // sin almacenamiento: el tema solo vale para esta visita
    }
  }, []);

  const dismissToast = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  /** `action` opcional: { label, onClick }. Con acción el aviso dura más para dar tiempo a usarla. */
  const toast = useCallback(
    (message, type = 'ok', action = null) => {
      const id = crypto.randomUUID();
      setToasts((t) => [...t, { id, message, type, action }]);
      setTimeout(() => dismissToast(id), action ? 6000 : 3500);
    },
    [dismissToast],
  );

  // El registro marca cambios sin guardar; navegar entonces pide confirmación.
  const dirtyRef = useRef(false);
  const [pendingNav, setPendingNav] = useState(null);
  const setDirty = useCallback((dirty) => {
    dirtyRef.current = dirty;
  }, []);

  const navigate = useCallback((next, date = null, { force = false } = {}) => {
    if (dirtyRef.current && !force) {
      setPendingNav({ next, date });
      return;
    }
    dirtyRef.current = false;
    setPendingNav(null);
    setEditDate(date);
    setPage(next);
    window.scrollTo({ top: 0 });
  }, []);

  const confirmLeave = useCallback(() => {
    if (pendingNav) navigate(pendingNav.next, pendingNav.date, { force: true });
  }, [pendingNav, navigate]);
  const cancelLeave = useCallback(() => setPendingNav(null), []);

  // Catálogos para autocompletar y búsquedas por clave, derivados del índice (no de los servicios).
  const catalogs = useMemo(
    () => ({
      people: index.people.map((p) => p.name).sort((a, b) => a.localeCompare(b)),
      directors: index.people.filter((p) => p.roles[DIRECTOR_ROLE]).map((p) => p.name),
      instruments: index.instruments,
      songs: index.songs.map((s) => ({ name: s.name, artist: s.artist })),
      artists: [...new Set(index.songs.map((s) => s.artist))].sort((a, b) => a.localeCompare(b)),
      songByKey: new Map(index.songs.map((s) => [s.key, s])),
    }),
    [index],
  );

  const value = useMemo(
    () => ({
      index,
      version,
      loading,
      page,
      editDate,
      toasts,
      theme,
      setTheme,
      toast,
      dismissToast,
      navigate,
      setDirty,
      pendingNav,
      confirmLeave,
      cancelLeave,
      catalogs,
      save: async (s) => {
        const saved = await store.saveService(s);
        await refresh();
        return saved;
      },
      remove: async (fecha) => {
        await store.deleteService(fecha);
        await refresh();
      },
      importServices: async (list) => {
        const result = await store.importServices(list);
        await refresh();
        return result;
      },
      resetSample: async () => {
        await store.resetToSample();
        await refresh();
      },
      clearAll: async () => {
        await store.clearAll();
        await refresh();
      },
    }),
    [index, version, loading, page, editDate, toasts, theme, setTheme, toast, dismissToast, navigate, setDirty, pendingNav, confirmLeave, cancelLeave, catalogs, refresh],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
