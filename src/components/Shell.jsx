import { useRef, useState } from 'react';
import { BarChart3, Download, History, Home, Monitor, Moon, PenLine, Settings, Sun, Upload } from 'lucide-react';
import { useApp } from '../app-context';
import { exportServices, previewImport } from '../data/store';
import { parseServices } from '../data/importer';
import { plural, todayISO } from '../lib/format';
import { Button, ConfirmDialog, IconButton, Sheet, cx } from './ui';

const TABS = [
  { id: 'inicio', label: 'Inicio', icon: Home },
  { id: 'historial', label: 'Historial', icon: History },
  { id: 'registro', label: 'Registro', icon: PenLine },
  { id: 'reportes', label: 'Reportes', icon: BarChart3 },
];

function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="grid size-8 grid-cols-2 gap-0.5" aria-hidden>
        <span className="rounded-[5px] bg-[#B80E0A]" />
        <span className="rounded-[5px] bg-[#213E91]" />
        <span className="rounded-[5px] bg-[#FAC20E]" />
        <span className="rounded-[5px] bg-[#16295F] dark:bg-[#8AA4EE]" />
      </div>
      <span className="font-display text-xl font-extrabold tracking-tight">AlabanzApp</span>
    </div>
  );
}

function SettingsSheet({ open, onClose }) {
  const { theme, setTheme, resetSample, clearAll, importServices, toast } = useApp();
  const [confirm, setConfirm] = useState(null);
  const [pendingImport, setPendingImport] = useState(null); // { services, skipped, replacing }
  const fileRef = useRef(null);

  const handleExport = async () => {
    const services = await exportServices();
    if (!services.length) return toast('No hay servicios para exportar.', 'error');
    const blob = new Blob([JSON.stringify({ servicios: services }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `alabanzapp-${todayISO()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast(`${plural(services.length, 'servicio exportado', 'servicios exportados')}`);
  };

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // permite elegir el mismo archivo otra vez
    if (!file) return;
    try {
      const { services, skipped } = parseServices(JSON.parse(await file.text()));
      if (!services.length) return toast('El archivo no tiene servicios válidos.', 'error');
      const { replacing } = await previewImport(services);
      setPendingImport({ services, skipped, replacing });
    } catch (err) {
      toast(err instanceof SyntaxError ? 'El archivo no es un JSON válido.' : err.message, 'error');
    }
  };

  const confirmImport = async () => {
    const { services } = pendingImport;
    setPendingImport(null);
    try {
      await importServices(services);
      toast(`${plural(services.length, 'servicio importado', 'servicios importados')}`);
      onClose();
    } catch (err) {
      toast(err.message || 'No se pudo importar el archivo.', 'error');
    }
  };

  const importMessage = pendingImport && (
    <>
      Se importarán <strong>{plural(pendingImport.services.length, 'servicio', 'servicios')}</strong>.
      {pendingImport.replacing > 0 && ` ${plural(pendingImport.replacing, 'reemplazará', 'reemplazarán')} a un servicio guardado con la misma fecha.`}
      {pendingImport.skipped.length > 0 && ` Se omitieron ${plural(pendingImport.skipped.length, 'entrada no válida', 'entradas no válidas')}.`}
      {' '}Los demás servicios guardados se conservan.
    </>
  );
  const themes = [
    { id: 'system', label: 'Sistema', icon: Monitor },
    { id: 'light', label: 'Claro', icon: Sun },
    { id: 'dark', label: 'Oscuro', icon: Moon },
  ];
  return (
    <>
      <Sheet open={open && !confirm && !pendingImport} onClose={onClose} title="Ajustes">
        <h3 className="mt-2 mb-2 text-sm font-semibold">Apariencia</h3>
        <div className="grid grid-cols-3 gap-2">
          {themes.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              aria-pressed={theme === id}
              onClick={() => setTheme(id)}
              className={cx(
                'flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl border text-sm font-medium',
                theme === id ? 'border-accent bg-accent-soft' : 'border-line hover:bg-sunken',
              )}
            >
              <Icon size={20} aria-hidden />
              {label}
            </button>
          ))}
        </div>
        <h3 className="mt-6 mb-1 text-sm font-semibold">Copia de seguridad</h3>
        <p className="mb-3 text-sm text-muted">
          Por ahora los servicios se guardan solo en este navegador. Exporta un archivo para tener una copia, o importa uno para traer servicios.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button variant="secondary" icon={Download} onClick={handleExport}>Exportar JSON</Button>
          <Button variant="secondary" icon={Upload} onClick={() => fileRef.current?.click()}>Importar JSON</Button>
          <input ref={fileRef} type="file" accept=".json,application/json" className="hidden" onChange={handleFile} />
        </div>
        <h3 className="mt-6 mb-2 text-sm font-semibold">Datos de prueba</h3>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button variant="secondary" onClick={() => setConfirm('sample')}>Cargar datos de ejemplo</Button>
          <Button variant="danger" onClick={() => setConfirm('clear')}>Borrar todos los servicios</Button>
        </div>
      </Sheet>
      <ConfirmDialog
        open={!!confirm}
        title={confirm === 'clear' ? '¿Borrar todos los servicios?' : '¿Cargar datos de ejemplo?'}
        message={
          confirm === 'clear'
            ? 'Se eliminarán todos los servicios guardados en este navegador. No se puede deshacer.'
            : 'Reemplazará los servicios actuales por 14 servicios de ejemplo.'
        }
        confirmLabel={confirm === 'clear' ? 'Sí, borrar todo' : 'Sí, reemplazar'}
        onCancel={() => setConfirm(null)}
        onConfirm={async () => {
          if (confirm === 'clear') await clearAll();
          else await resetSample();
          toast(confirm === 'clear' ? 'Servicios eliminados' : 'Datos de ejemplo cargados');
          setConfirm(null);
          onClose();
        }}
      />
      <ConfirmDialog
        open={!!pendingImport}
        title="¿Importar servicios?"
        message={importMessage}
        confirmLabel="Importar"
        tone="primary"
        onCancel={() => setPendingImport(null)}
        onConfirm={confirmImport}
      />
    </>
  );
}

export function Shell({ children }) {
  const { page, navigate, toasts, dismissToast, pendingNav, confirmLeave, cancelLeave } = useApp();
  const [settings, setSettings] = useState(false);

  return (
    <div className="min-h-dvh md:grid md:grid-cols-[15rem_1fr]">
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-line px-4 py-6 md:flex">
        <div className="px-2"><Logo /></div>
        <nav className="mt-8 flex flex-col gap-1" aria-label="Principal">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              aria-current={page === id ? 'page' : undefined}
              onClick={() => navigate(id)}
              className={cx(
                'flex min-h-11 items-center gap-3 rounded-xl px-3 text-[15px] font-semibold transition',
                page === id ? 'bg-accent text-accent-ink' : 'text-muted hover:bg-sunken hover:text-ink',
              )}
            >
              <Icon size={20} aria-hidden />
              {label}
            </button>
          ))}
        </nav>
        <Button variant="ghost" icon={Settings} className="mt-auto justify-start" onClick={() => setSettings(true)}>
          Ajustes
        </Button>
      </aside>

      <div className="min-w-0 pb-20 md:pb-12">
        <div className="flex items-center justify-between px-4 pt-2.5 md:hidden">
          <Logo />
          <IconButton icon={Settings} label="Ajustes" onClick={() => setSettings(true)} />
        </div>
        <main className="mx-auto w-full max-w-3xl px-4 pt-3 md:px-8 md:pt-10">{children}</main>
      </div>

      <nav
        aria-label="Principal"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      >
        <ul className="mx-auto grid max-w-md grid-cols-4">
          {TABS.map(({ id, label, icon: Icon }) => (
            <li key={id}>
              <button
                type="button"
                aria-current={page === id ? 'page' : undefined}
                onClick={() => navigate(id)}
                className={cx(
                  'flex min-h-14 w-full flex-col items-center justify-center gap-0.5 text-[11px] font-semibold',
                  page === id ? 'text-ink' : 'text-muted',
                )}
              >
                <span
                  className={cx(
                    'flex h-6 w-12 items-center justify-center rounded-full transition',
                    page === id && 'bg-accent text-accent-ink',
                  )}
                >
                  <Icon size={20} aria-hidden />
                </span>
                {label}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <div className="pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex flex-col items-center gap-2 px-4 md:bottom-8" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cx(
              'pointer-events-auto flex items-center gap-4 rounded-xl py-3 pr-2 pl-4 text-[15px] font-medium shadow-lg [animation:toast-in_.2s_ease-out]',
              t.type === 'error' ? 'bg-danger text-white' : 'bg-ink text-bg',
              !t.action && 'pr-4',
            )}
          >
            {t.message}
            {t.action && (
              <button
                type="button"
                onClick={() => {
                  dismissToast(t.id);
                  t.action.onClick();
                }}
                className="min-h-9 rounded-lg px-3 font-bold text-accent hover:bg-white/10 dark:text-[#213E91] dark:hover:bg-black/5"
              >
                {t.action.label}
              </button>
            )}
          </div>
        ))}
      </div>

      <SettingsSheet open={settings} onClose={() => setSettings(false)} />
      <ConfirmDialog
        open={!!pendingNav}
        title="¿Salir sin guardar?"
        message="Tienes cambios en el registro que aún no has guardado. Si sales, se perderán."
        confirmLabel="Salir sin guardar"
        onCancel={cancelLeave}
        onConfirm={confirmLeave}
      />
    </div>
  );
}
