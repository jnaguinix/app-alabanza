import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import * as store from './data/store';
import { DIRECTOR_ROLE } from './data/store';
import { auth, loginWithGoogle, logoutUser } from './lib/firebase';
import { getUserRole, seedInitialUsers } from './data/users';
import { listTeamMembers } from './data/team';
import { runDataCleanup } from './data/cleanup';
import { splitAndCleanNames, cleanSingleName } from './lib/format';
import { onAuthStateChanged } from 'firebase/auth';

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
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [teamMembers, setTeamMembers] = useState([]);
  const [authLoading, setAuthLoading] = useState(true);

  const [theme, setThemeState] = useState(() => {
    try {
      return localStorage.getItem(THEME_KEY) || 'light';
    } catch {
      return 'light';
    }
  });

  const dismissToast = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const toast = useCallback(
    (message, type = 'ok', action = null) => {
      const id = crypto.randomUUID();
      setToasts((t) => [...t, { id, message, type, action }]);
      setTimeout(() => dismissToast(id), action ? 6000 : 3500);
    },
    [dismissToast],
  );

  const refreshUserRole = useCallback(async (email) => {
    if (!email) {
      setRole(null);
      return null;
    }
    const r = await getUserRole(email);
    setRole(r);
    return r;
  }, []);

  // Escuchar estado de autenticación de Firebase
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser?.email) {
        const assignedRole = await refreshUserRole(currentUser.email);
        // Si es admin, asegurar inicialización de usuarios
        if (assignedRole === 'admin') {
          seedInitialUsers();
        }
      } else {
        setRole(null);
      }
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, [refreshUserRole]);

  const isAdmin = role === 'admin';
  const isEditor = role === 'editor';
  const isViewer = role === 'viewer';
  const canEdit = isAdmin || isEditor;
  const canManageUsers = isAdmin;
  const canBackup = isAdmin;
  const isAuthorized = !!role;

  const refreshTeamMembers = useCallback(async () => {
    try {
      const list = await listTeamMembers();
      setTeamMembers(list);
    } catch (err) {
      console.warn('Error refrescando integrantes:', err);
    }
  }, []);

  // Tras escribir solo se vuelve a leer el índice; cada pantalla vuelve a pedir lo suyo al cambiar `version`.
  const refresh = useCallback(async () => {
    try {
      const idx = await store.getIndex();
      setIndex(idx);
      setVersion((v) => v + 1);
    } catch (err) {
      console.warn('Error refrescando índice:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user && isAuthorized) {
      refresh();
      refreshTeamMembers();
    } else {
      setLoading(false);
    }
  }, [user, isAuthorized, refresh, refreshTeamMembers]);

  // Ejecución automática única de normalización de datos heredados e instrumentos
  useEffect(() => {
    if (user && canEdit) {
      const CLEANUP_KEY = 'alabanzapp:cleanup_legacy_names_and_instruments_v2';
      try {
        if (!localStorage.getItem(CLEANUP_KEY)) {
          runDataCleanup()
            .then((res) => {
              try {
                localStorage.setItem(CLEANUP_KEY, 'true');
              } catch {}
              if (res.membersSplitOrCleaned > 0 || res.servicesUpdated > 0 || res.membersCreatedOrUpdated > 0) {
                toast(
                  `Normalización completada: integrantes y servicios unificados con los instrumentos oficiales.`
                );
                refresh();
                refreshTeamMembers();
              }
            })
            .catch((err) => {
              console.warn('Nota en normalización inicial de integrantes e instrumentos:', err);
            });
        }
      } catch {}
    }
  }, [user, canEdit, refresh, refreshTeamMembers, toast]);

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
      // sin almacenamiento
    }
  }, []);

  const login = useCallback(async () => {
    try {
      const loggedUser = await loginWithGoogle();
      if (loggedUser?.email) {
        const r = await refreshUserRole(loggedUser.email);
        if (!r) {
          toast(`Bienvenido. Tu cuenta ${loggedUser.email} está pendiente de autorización por un administrador.`);
        } else {
          toast(`Sesión iniciada como ${loggedUser.displayName || loggedUser.email}`);
        }
      }
      return loggedUser;
    } catch (err) {
      toast('No se pudo iniciar sesión con Google.', 'error');
      throw err;
    }
  }, [toast, refreshUserRole]);

  const logout = useCallback(async () => {
    try {
      await logoutUser();
      setRole(null);
      toast('Sesión cerrada');
    } catch (err) {
      toast('Error al cerrar sesión.', 'error');
    }
  }, [toast]);

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

  // Catálogos para autocompletar y selección oficial
  const catalogs = useMemo(() => {
    const teamPeople = teamMembers.map((m) => cleanSingleName(m.name));
    const indexPeopleRaw = (index.people || []).map((p) => p.name);
    const allPeople = [...new Set([...teamPeople, ...indexPeopleRaw.flatMap(splitAndCleanNames)])].sort((a, b) =>
      a.localeCompare(b)
    );

    const teamDirectors = teamMembers.filter((m) => m.canDirect).map((m) => cleanSingleName(m.name));
    const indexDirectorsRaw = (index.people || []).filter((p) => p.roles?.[DIRECTOR_ROLE]).map((p) => p.name);
    // Unir directores oficiales y personas individuales que han dirigido en el historial (limpias y desglosadas)
    const historicalDirectors = [...new Set(indexDirectorsRaw.flatMap(splitAndCleanNames))];
    const allDirectors = [...new Set([...teamDirectors, ...historicalDirectors])].sort((a, b) => a.localeCompare(b));

    return {
      people: allPeople,
      directors: allDirectors,
      officialDirectors: teamDirectors,
      historicalDirectors,
      teamMembers,
      instruments: index.instruments?.length
        ? index.instruments
        : ['Corista', 'Piano', 'Guitarra', 'Bajo', 'Batería'],
      songs: (index.songs || []).map((s) => ({ name: s.name, artist: s.artist })),
      artists: [...new Set((index.songs || []).map((s) => s.artist))].sort((a, b) => a.localeCompare(b)),
      songByKey: new Map((index.songs || []).map((s) => [s.key, s])),
    };
  }, [index, teamMembers]);

  const value = useMemo(
    () => ({
      index,
      version,
      loading,
      page,
      editDate,
      toasts,
      theme,
      user,
      role,
      isAdmin,
      isEditor,
      isViewer,
      canEdit,
      canManageUsers,
      canBackup,
      isAuthorized,
      authLoading,
      teamMembers,
      refreshTeamMembers,
      login,
      logout,
      refreshUserRole,
      refresh,
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
        if (!canEdit) {
          toast('Tu rol no tiene permisos para crear o modificar servicios.', 'error');
          throw new Error('Permiso denegado: se requiere rol de Admin o Gestor de canciones.');
        }
        const saved = await store.saveService(s);
        await refresh();
        return saved;
      },
      remove: async (fecha) => {
        if (!isAdmin) {
          toast('Solo los administradores pueden eliminar servicios.', 'error');
          throw new Error('Permiso denegado: se requiere rol de Admin.');
        }
        await store.deleteService(fecha);
        await refresh();
      },
      importServices: async (list) => {
        if (!isAdmin) {
          toast('Solo los administradores pueden importar servicios.', 'error');
          throw new Error('Permiso denegado: se requiere rol de Admin.');
        }
        const result = await store.importServices(list);
        await refresh();
        return result;
      },
      resetSample: async () => {
        if (!isAdmin) {
          toast('Solo los administradores pueden modificar los datos de ejemplo.', 'error');
          throw new Error('Permiso denegado: se requiere rol de Admin.');
        }
        await store.resetToSample();
        await refresh();
      },
      clearAll: async () => {
        if (!isAdmin) {
          toast('Solo los administradores pueden vaciar la base de datos.', 'error');
          throw new Error('Permiso denegado: se requiere rol de Admin.');
        }
        await store.clearAll();
        await refresh();
      },
      runCleanup: async () => {
        const res = await runDataCleanup();
        await refresh();
        await refreshTeamMembers();
        return res;
      },
    }),
    [
      index,
      version,
      loading,
      page,
      editDate,
      toasts,
      theme,
      user,
      role,
      isAdmin,
      isEditor,
      isViewer,
      canEdit,
      canManageUsers,
      canBackup,
      isAuthorized,
      authLoading,
      teamMembers,
      refreshTeamMembers,
      login,
      logout,
      refreshUserRole,
      refresh,
      setTheme,
      toast,
      dismissToast,
      navigate,
      setDirty,
      pendingNav,
      confirmLeave,
      cancelLeave,
      catalogs,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
