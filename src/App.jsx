import { useState } from 'react';
import { LogIn, LogOut, RefreshCw, ShieldAlert } from 'lucide-react';
import { AppProvider, useApp } from './app-context';
import { Shell } from './components/Shell';
import { ShareHost } from './components/ShareHost';
import { Button } from './components/ui';
import Editor from './pages/Editor';
import History from './pages/History';
import Home from './pages/Home';
import Reports from './pages/Reports';

function Logo() {
  return (
    <div className="flex items-center gap-3">
      <div className="grid size-9 grid-cols-2 gap-0.5" aria-hidden>
        <span className="rounded-md bg-[#B80E0A]" />
        <span className="rounded-md bg-[#213E91]" />
        <span className="rounded-md bg-[#FAC20E]" />
        <span className="rounded-md bg-[#16295F] dark:bg-[#8AA4EE]" />
      </div>
      <span className="font-display text-2xl font-extrabold tracking-tight">AlabanzApp</span>
    </div>
  );
}

function Router() {
  const { page, editDate, canEdit } = useApp();
  if (page === 'historial') return <History />;
  if (page === 'registro') {
    if (!canEdit) return <Home />;
    return <Editor key={editDate || 'nuevo'} />;
  }
  if (page === 'reportes') return <Reports />;
  return <Home />;
}

function AuthGate({ children }) {
  const { user, authLoading, isAuthorized, login, logout, refreshUserRole } = useApp();
  const [checking, setChecking] = useState(false);

  if (authLoading) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-bg p-6 text-center">
        <Logo />
        <p className="text-sm font-medium text-muted">Cargando AlabanzApp…</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-bg p-4 sm:p-6">
        <div className="w-full max-w-md space-y-6 rounded-3xl border border-line bg-surface p-6 shadow-sm sm:p-8">
          <div className="flex flex-col items-center text-center">
            <Logo />
            <p className="mt-3 text-sm text-muted">
              Registro, historial y repertorio del equipo de alabanza.
            </p>
          </div>

          <div className="space-y-4 rounded-2xl border border-line bg-sunken/60 p-4">
            <div className="space-y-1">
              <h2 className="text-sm font-bold text-ink">Acceso restringido al equipo</h2>
              <p className="text-xs text-muted leading-relaxed">
                Para consultar o registrar servicios, inicia sesión con tu cuenta de Google autorizada.
              </p>
            </div>
            <Button
              variant="primary"
              icon={LogIn}
              className="w-full justify-center py-2.5 text-sm"
              onClick={login}
            >
              Iniciar sesión con Google
            </Button>
          </div>

          <div className="border-t border-line pt-4 text-center text-xs text-muted">
            <p className="mb-1 font-semibold text-ink">Roles en el sistema:</p>
            <p>Admin · Gestor de canciones · Visualizador</p>
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthorized) {
    const handleRecheck = async () => {
      setChecking(true);
      await refreshUserRole(user.email);
      setChecking(false);
    };

    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-bg p-4 sm:p-6">
        <div className="w-full max-w-md space-y-5 rounded-3xl border border-line bg-surface p-6 shadow-sm sm:p-8">
          <div className="flex flex-col items-center text-center">
            <div className="mb-2 flex size-12 items-center justify-center rounded-2xl bg-[#FAC20E]/20 text-[#B80E0A]">
              <ShieldAlert size={28} />
            </div>
            <h1 className="font-display text-xl font-bold text-ink">Cuenta pendiente de asignación</h1>
            <p className="mt-1 max-w-xs truncate text-xs font-medium text-muted">{user.email}</p>
          </div>

          <p className="text-center text-sm leading-relaxed text-muted">
            Tu cuenta aún no tiene un rol asignado por los administradores. Contacta a un administrador para que active tu acceso como <strong>Admin</strong>, <strong>Gestor de canciones</strong> o <strong>Visualizador</strong>.
          </p>

          <div className="space-y-2 pt-2">
            <Button
              variant="secondary"
              icon={RefreshCw}
              className="w-full justify-center"
              onClick={handleRecheck}
              disabled={checking}
            >
              {checking ? 'Verificando…' : 'Volver a comprobar acceso'}
            </Button>
            <Button
              variant="ghost"
              icon={LogOut}
              className="w-full justify-center text-xs text-muted"
              onClick={logout}
            >
              Cerrar sesión
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return children;
}

export default function App() {
  return (
    <AppProvider>
      <AuthGate>
        <ShareHost>
          <Shell>
            <Router />
          </Shell>
        </ShareHost>
      </AuthGate>
    </AppProvider>
  );
}
