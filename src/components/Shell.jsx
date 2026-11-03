import { useEffect, useRef, useState } from 'react';
import {
  BarChart3,
  Download,
  History,
  Home,
  LogOut,
  Monitor,
  Moon,
  Music,
  PenLine,
  Plus,
  Settings,
  Shield,
  ShieldCheck,
  Sun,
  Trash2,
  Upload,
  User,
  UserCheck,
  UserPlus,
  Users,
} from 'lucide-react';
import { useApp } from '../app-context';
import { exportServices, previewImport } from '../data/store';
import { parseServices } from '../data/importer';
import { listUsers, removeUser, ROLES, setUserRole } from '../data/users';
import { deleteTeamMember, listTeamMembers, saveTeamMember } from '../data/team';
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

function RoleBadge({ role }) {
  const info = ROLES[role] || ROLES.viewer;
  return (
    <span className={cx('inline-flex items-center rounded-lg px-2 py-0.5 text-xs font-bold', info.badgeClass)}>
      {info.label}
    </span>
  );
}

function UserManagementSheet({ open, onClose }) {
  const { user, toast } = useApp();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState('editor');
  const [submitting, setSubmitting] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const list = await listUsers();
      setUsers(list);
    } catch {
      toast('Error al cargar la lista de usuarios.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) loadData();
  }, [open]);

  const handleAddUser = async (e) => {
    e.preventDefault();
    if (!newEmail.trim() || !newEmail.includes('@')) {
      return toast('Escribe un correo electrónico válido.', 'error');
    }
    setSubmitting(true);
    try {
      await setUserRole(newEmail.trim(), newRole, user.email);
      toast(`Usuario ${newEmail.trim()} asignado como ${ROLES[newRole].label}`);
      setNewEmail('');
      await loadData();
    } catch (err) {
      toast(err.message || 'No se pudo registrar el usuario.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRoleChange = async (targetEmail, targetRole) => {
    try {
      await setUserRole(targetEmail, targetRole, user.email);
      toast(`Rol de ${targetEmail} cambiado a ${ROLES[targetRole].label}`);
      await loadData();
    } catch (err) {
      toast(err.message || 'No se pudo cambiar el rol.', 'error');
    }
  };

  const confirmDelete = async () => {
    if (!userToDelete) return;
    try {
      await removeUser(userToDelete);
      toast(`Acceso revocado a ${userToDelete}`);
      setUserToDelete(null);
      await loadData();
    } catch (err) {
      toast(err.message || 'No se pudo revocar el acceso.', 'error');
    }
  };

  return (
    <>
      <Sheet open={open && !userToDelete} onClose={onClose} title="Gestor de Usuarios">
        <p className="mb-4 text-xs text-muted">
          Controla quién puede acceder y qué acciones puede realizar en AlabanzApp.
        </p>

        {/* Formulario nuevo usuario */}
        <form onSubmit={handleAddUser} className="mb-6 rounded-2xl border border-line bg-sunken/60 p-3.5">
          <h4 className="mb-2.5 text-xs font-bold uppercase tracking-wider text-muted">Añadir o actualizar miembro</h4>
          <div className="space-y-2.5">
            <div>
              <label htmlFor="user-email-input" className="sr-only">
                Correo de Google
              </label>
              <input
                id="user-email-input"
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="correo@gmail.com"
                className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-muted/60 focus:border-brand-blue"
              />
            </div>
            <div className="flex gap-2">
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value)}
                className="flex-1 rounded-xl border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-brand-blue"
              >
                <option value="editor">Gestor de canciones (Crear/Editar)</option>
                <option value="viewer">Visualizador (Solo lectura)</option>
                <option value="admin">Admin (Acceso total)</option>
              </select>
              <Button type="submit" variant="primary" icon={UserPlus} disabled={submitting} className="shrink-0 text-xs">
                Asignar
              </Button>
            </div>
          </div>
        </form>

        {/* Lista de usuarios */}
        <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted">
          Miembros con acceso ({users.length})
        </h4>

        {loading ? (
          <div className="py-8 text-center text-sm text-muted">Cargando usuarios…</div>
        ) : (
          <div className="space-y-2.5">
            {users.map((u) => {
              const isSelf = u.email === user?.email;
              const isMainAdmin = u.email === 'jnaguinix@gmail.com';

              return (
                <div
                  key={u.email}
                  className="flex flex-col gap-2 rounded-2xl border border-line bg-surface p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-semibold text-ink">{u.email}</p>
                      {isSelf && (
                        <span className="rounded bg-accent/20 px-1.5 py-0.5 text-[10px] font-bold text-ink">Tú</span>
                      )}
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <RoleBadge role={u.role} />
                      <p className="text-[11px] text-muted">
                        {u.role === 'admin' && 'Acceso total y backup'}
                        {u.role === 'editor' && 'Puede crear y editar'}
                        {u.role === 'viewer' && 'Solo consulta'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-1 sm:pt-0">
                    <select
                      value={u.role}
                      disabled={isMainAdmin}
                      onChange={(e) => handleRoleChange(u.email, e.target.value)}
                      className="rounded-lg border border-line bg-surface px-2 py-1 text-xs font-medium text-ink disabled:opacity-50"
                      aria-label={`Cambiar rol de ${u.email}`}
                    >
                      <option value="admin">Admin</option>
                      <option value="editor">Gestor de canciones</option>
                      <option value="viewer">Visualizador</option>
                    </select>

                    <IconButton
                      icon={Trash2}
                      label={`Revocar acceso a ${u.email}`}
                      disabled={isMainAdmin || isSelf}
                      onClick={() => setUserToDelete(u.email)}
                      className="disabled:opacity-30"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Sheet>

      <ConfirmDialog
        open={!!userToDelete}
        title="¿Revocar acceso al usuario?"
        message={`Se eliminará a ${userToDelete} del sistema y no podrá acceder a los servicios de AlabanzApp.`}
        confirmLabel="Revocar acceso"
        tone="danger"
        onCancel={() => setUserToDelete(null)}
        onConfirm={confirmDelete}
      />
    </>
  );
}

function TeamDirectorySheet({ open, onClose }) {
  const { toast, refreshTeamMembers } = useApp();
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [canDirect, setCanDirect] = useState(true);
  const [instrument, setInstrument] = useState('Voz');
  const [submitting, setSubmitting] = useState(false);
  const [memberToDelete, setMemberToDelete] = useState(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const list = await listTeamMembers();
      setMembers(list);
    } catch {
      toast('Error al cargar integrantes.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) loadData();
  }, [open]);

  const handleAddMember = async (e) => {
    e.preventDefault();
    if (!name.trim()) return toast('Escribe el nombre del integrante.', 'error');
    setSubmitting(true);
    try {
      await saveTeamMember({
        name: name.trim(),
        canDirect,
        instruments: [instrument],
      });
      toast(`Integrante ${name.trim()} guardado en el directorio`);
      setName('');
      await loadData();
      await refreshTeamMembers();
    } catch (err) {
      toast(err.message || 'No se pudo guardar el integrante.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleCanDirect = async (member) => {
    try {
      await saveTeamMember({
        ...member,
        canDirect: !member.canDirect,
      });
      toast(`Rol de director actualizado para ${member.name}`);
      await loadData();
      await refreshTeamMembers();
    } catch {
      toast('Error al actualizar integrante.', 'error');
    }
  };

  const confirmDelete = async () => {
    if (!memberToDelete) return;
    try {
      await deleteTeamMember(memberToDelete.id);
      toast(`Integrante ${memberToDelete.name} eliminado del directorio`);
      setMemberToDelete(null);
      await loadData();
      await refreshTeamMembers();
    } catch (err) {
      toast(err.message || 'No se pudo eliminar el integrante.', 'error');
    }
  };

  const instrumentOptions = ['Voz', 'Piano', 'Guitarra acústica', 'Guitarra eléctrica', 'Bajo', 'Batería'];

  return (
    <>
      <Sheet open={open && !memberToDelete} onClose={onClose} title="Directorio del Equipo">
        <p className="mb-4 text-xs text-muted">
          Lista oficial de personas disponibles para dirigir o tocar en los servicios.
        </p>

        {/* Formulario nuevo integrante */}
        <form onSubmit={handleAddMember} className="mb-6 rounded-2xl border border-line bg-sunken/60 p-3.5">
          <h4 className="mb-2.5 text-xs font-bold uppercase tracking-wider text-muted">Añadir integrante oficial</h4>
          <div className="space-y-2.5">
            <div>
              <label htmlFor="member-name-input" className="sr-only">Nombre y apellido</label>
              <input
                id="member-name-input"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nombre del integrante (ej. Laura Torres)"
                className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-muted/60 focus:border-brand-blue"
              />
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <select
                value={instrument}
                onChange={(e) => setInstrument(e.target.value)}
                className="flex-1 rounded-xl border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-brand-blue"
              >
                {instrumentOptions.map((ins) => (
                  <option key={ins} value={ins}>{ins}</option>
                ))}
              </select>

              <label className="flex items-center gap-2 px-2 py-1.5 text-xs font-semibold text-ink cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={canDirect}
                  onChange={(e) => setCanDirect(e.target.checked)}
                  className="size-4 rounded border-line text-brand-blue"
                />
                <span>Puede dirigir</span>
              </label>

              <Button type="submit" variant="primary" icon={Plus} disabled={submitting} className="shrink-0 text-xs">
                Guardar
              </Button>
            </div>
          </div>
        </form>

        {/* Lista de integrantes */}
        <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted">
          Integrantes oficiales ({members.length})
        </h4>

        {loading ? (
          <div className="py-8 text-center text-sm text-muted">Cargando integrantes…</div>
        ) : (
          <div className="space-y-2">
            {members.map((m) => (
              <div
                key={m.id}
                className="flex items-center justify-between gap-2 rounded-2xl border border-line bg-surface p-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-semibold text-ink">{m.name}</p>
                    {m.canDirect && (
                      <span className="rounded bg-accent/20 px-1.5 py-0.5 text-[10px] font-bold text-ink">
                        Dirige
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 flex flex-wrap gap-1 text-[11px] text-muted">
                    {(m.instruments || []).map((ins) => (
                      <span key={ins} className="rounded bg-sunken px-1.5 py-0.5">
                        {ins}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleToggleCanDirect(m)}
                    className={cx(
                      'rounded-lg px-2 py-1 text-[11px] font-semibold border transition',
                      m.canDirect
                        ? 'border-accent bg-accent/15 text-ink'
                        : 'border-line text-muted hover:bg-sunken',
                    )}
                    title={m.canDirect ? 'Quitar permiso de director' : 'Habilitar como director'}
                  >
                    {m.canDirect ? 'Es Director' : 'Habilitar director'}
                  </button>
                  <IconButton
                    icon={Trash2}
                    label={`Eliminar a ${m.name}`}
                    onClick={() => setMemberToDelete(m)}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </Sheet>

      <ConfirmDialog
        open={!!memberToDelete}
        title="¿Eliminar integrante del directorio?"
        message={`Se eliminará a ${memberToDelete?.name} del directorio oficial.`}
        confirmLabel="Eliminar integrante"
        tone="danger"
        onCancel={() => setMemberToDelete(null)}
        onConfirm={confirmDelete}
      />
    </>
  );
}

function SettingsSheet({ open, onClose }) {
  const {
    theme,
    setTheme,
    resetSample,
    clearAll,
    importServices,
    toast,
    user,
    role,
    isAdmin,
    canEdit,
    canBackup,
    logout,
  } = useApp();
  const [confirm, setConfirm] = useState(null);
  const [pendingImport, setPendingImport] = useState(null);
  const [usersSheetOpen, setUsersSheetOpen] = useState(false);
  const [teamSheetOpen, setTeamSheetOpen] = useState(false);
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
    e.target.value = '';
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
      {pendingImport.replacing > 0 &&
        ` ${plural(pendingImport.replacing, 'reemplazará', 'reemplazarán')} a un servicio guardado con la misma fecha.`}
      {pendingImport.skipped.length > 0 &&
        ` Se omitieron ${plural(pendingImport.skipped.length, 'entrada no válida', 'entradas no válidas')}.`}
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
      <Sheet open={open && !confirm && !pendingImport && !usersSheetOpen && !teamSheetOpen} onClose={onClose} title="Ajustes">
        {/* Perfil del usuario actual */}
        <h3 className="mt-2 mb-2 text-sm font-semibold">Tu cuenta</h3>
        <div className="rounded-2xl border border-line bg-sunken/60 p-3.5">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              {user?.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName || 'Usuario'}
                  referrerPolicy="no-referrer"
                  className="size-10 rounded-full border border-line"
                />
              ) : (
                <div className="flex size-10 items-center justify-center rounded-full bg-brand-blue text-white">
                  <User size={20} />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-bold text-ink">{user?.displayName || 'Miembro del equipo'}</p>
                  <RoleBadge role={role} />
                </div>
                <p className="truncate text-xs text-muted">{user?.email}</p>
              </div>
            </div>
            <Button variant="secondary" icon={LogOut} onClick={logout} className="w-full justify-center text-xs">
              Cerrar sesión
            </Button>
          </div>
        </div>

        {/* Directorio de Integrantes y Directores (Admins y Gestores de canciones) */}
        {canEdit && (
          <>
            <h3 className="mt-6 mb-2 text-sm font-semibold">Integrantes y Directores</h3>
            <div className="rounded-2xl border border-line bg-surface p-3.5">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-0.5">
                  <p className="text-sm font-semibold text-ink">Directorio del Equipo</p>
                  <p className="text-xs text-muted">
                    Lista oficial de directores, vocalistas e instrumentistas para armar los servicios.
                  </p>
                </div>
                <Button
                  variant="primary"
                  icon={Users}
                  onClick={() => setTeamSheetOpen(true)}
                  className="shrink-0 text-xs"
                >
                  Directorio
                </Button>
              </div>
            </div>
          </>
        )}

        {/* Gestor de Usuarios (Solo Admin) */}
        {isAdmin && (
          <>
            <h3 className="mt-6 mb-2 text-sm font-semibold">Administración</h3>
            <div className="rounded-2xl border border-line bg-surface p-3.5">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-0.5">
                  <p className="text-sm font-semibold text-ink">Gestor de Usuarios y Roles</p>
                  <p className="text-xs text-muted">
                    Gestiona los roles de acceso (Admin, Gestor de canciones, Visualizador).
                  </p>
                </div>
                <Button
                  variant="primary"
                  icon={Users}
                  onClick={() => setUsersSheetOpen(true)}
                  className="shrink-0 text-xs"
                >
                  Gestionar
                </Button>
              </div>
            </div>
          </>
        )}

        {/* Apariencia */}
        <h3 className="mt-6 mb-2 text-sm font-semibold">Apariencia</h3>
        <div className="grid grid-cols-3 gap-2">
          {themes.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              aria-pressed={theme === id}
              onClick={() => setTheme(id)}
              className={cx(
                'flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl border text-sm font-medium',
                theme === id ? 'border-accent bg-accent-soft text-ink' : 'border-line hover:bg-sunken text-muted',
              )}
            >
              <Icon size={20} aria-hidden />
              {label}
            </button>
          ))}
        </div>

        {/* Copia de seguridad e importación (EXCLUSIVO ADMIN) */}
        {canBackup && (
          <>
            <h3 className="mt-6 mb-1 text-sm font-semibold">Copia de seguridad e importación</h3>
            <p className="mb-3 text-xs text-muted">
              Exclusivo para administradores. Exporta un respaldo en formato JSON o importa servicios en lote.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button variant="secondary" icon={Download} onClick={handleExport}>
                Exportar JSON
              </Button>
              <Button variant="secondary" icon={Upload} onClick={() => fileRef.current?.click()}>
                Importar JSON
              </Button>
              <input ref={fileRef} type="file" accept=".json,application/json" className="hidden" onChange={handleFile} />
            </div>
          </>
        )}

        {/* Datos de prueba (EXCLUSIVO ADMIN) */}
        {isAdmin && (
          <>
            <h3 className="mt-6 mb-2 text-sm font-semibold">Gestión de datos</h3>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button variant="secondary" onClick={() => setConfirm('sample')}>
                Cargar datos de ejemplo
              </Button>
              <Button variant="danger" onClick={() => setConfirm('clear')}>
                Borrar todos los servicios
              </Button>
            </div>
          </>
        )}
      </Sheet>

      <TeamDirectorySheet open={teamSheetOpen} onClose={() => setTeamSheetOpen(false)} />
      <UserManagementSheet open={usersSheetOpen} onClose={() => setUsersSheetOpen(false)} />

      <ConfirmDialog
        open={!!confirm}
        title={confirm === 'clear' ? '¿Borrar todos los servicios?' : '¿Cargar datos de ejemplo?'}
        message={
          confirm === 'clear'
            ? 'Se eliminarán todos los servicios guardados en Firestore. No se puede deshacer.'
            : 'Reemplazará los servicios actuales por 14 servicios de ejemplo en Firestore.'
        }
        confirmLabel={confirm === 'clear' ? 'Sí, borrar todo' : 'Sí, reemplazar'}
        onCancel={() => setConfirm(null)}
        onConfirm={async () => {
          try {
            if (confirm === 'clear') await clearAll();
            else await resetSample();
            toast(confirm === 'clear' ? 'Servicios eliminados' : 'Datos de ejemplo cargados');
            setConfirm(null);
            onClose();
          } catch (err) {
            toast(err.message || 'Error en la operación', 'error');
          }
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
  const { page, navigate, toasts, dismissToast, pendingNav, confirmLeave, cancelLeave, user, role, canEdit } = useApp();
  const [settings, setSettings] = useState(false);

  // Músicos visualizadores no tienen la pestaña "Registro"
  const visibleTabs = canEdit ? TABS : TABS.filter((t) => t.id !== 'registro');

  return (
    <div className="min-h-dvh md:grid md:grid-cols-[15rem_1fr]">
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-line px-4 py-6 md:flex">
        <div className="px-2">
          <Logo />
        </div>

        {/* Estado del usuario conectado */}
        <div className="mt-4 px-2">
          <button
            type="button"
            onClick={() => setSettings(true)}
            className="flex w-full items-center gap-2.5 rounded-2xl bg-sunken/80 px-3 py-2.5 text-left transition hover:bg-sunken"
          >
            <div className="flex size-7 items-center justify-center rounded-full bg-brand-blue text-white text-xs font-bold shrink-0">
              {user?.displayName ? user.displayName.charAt(0).toUpperCase() : <Shield size={14} />}
            </div>
            <div className="min-w-0 flex-1 truncate">
              <p className="truncate text-xs font-bold text-ink">{user?.displayName || user?.email}</p>
              <div className="mt-0.5">
                <RoleBadge role={role} />
              </div>
            </div>
          </button>
        </div>

        <nav className="mt-6 flex flex-col gap-1" aria-label="Principal">
          {visibleTabs.map(({ id, label, icon: Icon }) => (
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

      <div className="min-w-0 pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))] md:pb-12">
        <div className="flex items-center justify-between px-4 pt-2.5 md:hidden">
          <Logo />
          <div className="flex items-center gap-2">
            <RoleBadge role={role} />
            <IconButton icon={Settings} label="Ajustes" onClick={() => setSettings(true)} />
          </div>
        </div>
        <main className="mx-auto w-full max-w-3xl px-4 pt-3 md:px-8 md:pt-10">{children}</main>
      </div>

      <nav
        aria-label="Principal"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      >
        <ul className={cx('mx-auto grid max-w-md', visibleTabs.length === 3 ? 'grid-cols-3' : 'grid-cols-4')}>
          {visibleTabs.map(({ id, label, icon: Icon }) => (
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

      <div
        className="pointer-events-none fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))] z-[60] flex flex-col items-center gap-2 px-4 md:bottom-8"
        aria-live="polite"
      >
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
