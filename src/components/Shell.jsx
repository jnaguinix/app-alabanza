import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BarChart3,
  Check,
  Download,
  History,
  Home,
  LogOut,
  Monitor,
  Moon,
  Music,
  PenLine,
  Plus,
  Search,
  Settings,
  Shield,
  ShieldCheck,
  Sparkles,
  Sun,
  Trash2,
  Upload,
  User,
  UserCheck,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { useApp } from '../app-context';
import { exportServices, previewImport } from '../data/store';
import { parseServices } from '../data/importer';
import { listUsers, removeUser, ROLES, setUserRole } from '../data/users';
import { batchSaveTeamMembers, deleteTeamMember, listTeamMembers, saveTeamMember } from '../data/team';
import { keyOf, plural, todayISO } from '../lib/format';
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

const PRESET_INSTRUMENTS = [
  'Voz',
  'Coros',
  'Piano',
  'Teclado',
  'Sintetizador',
  'Guitarra acústica',
  'Guitarra eléctrica',
  'Bajo',
  'Batería',
  'Percusión',
  'Saxofón',
  'Violín',
];

function TeamDirectorySheet({ open, onClose }) {
  const { toast, refreshTeamMembers, index } = useApp();
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('todos'); // 'todos' | 'directores' | 'musicos'
  const [searchQuery, setSearchQuery] = useState('');

  // Formulario nuevo integrante
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCanDirect, setNewCanDirect] = useState(false);
  const [newInstruments, setNewInstruments] = useState(['Voz']);
  const [newCustomInstrument, setNewCustomInstrument] = useState('');
  const [submittingAdd, setSubmittingAdd] = useState(false);

  // Edición de integrante existente
  const [editingMember, setEditingMember] = useState(null);
  const [editName, setEditName] = useState('');
  const [editCanDirect, setEditCanDirect] = useState(false);
  const [editInstruments, setEditInstruments] = useState([]);
  const [editCustomInstrument, setEditCustomInstrument] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  // Sincronización y borrado
  const [syncingAll, setSyncingAll] = useState(false);
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
    if (open) {
      loadData();
      setEditingMember(null);
      setShowAddForm(false);
      setSearchQuery('');
    }
  }, [open]);

  // Detección de integrantes del historial de servicios que no están en el directorio
  const missingFromHistory = useMemo(() => {
    if (!index?.people || !index.people.length) return [];
    const existingKeys = new Set(members.map((m) => keyOf(m.name)));
    return index.people
      .filter((p) => p.name && !existingKeys.has(keyOf(p.name)))
      .map((p) => {
        const roles = Object.keys(p.roles || {});
        const canDirect = Boolean(p.roles?.['Dirige'] > 0);
        const instruments = roles.filter((r) => r !== 'Dirige');
        return {
          name: p.name,
          canDirect,
          instruments: instruments.length ? instruments : ['Voz'],
          servicesCount: p.services || 0,
        };
      });
  }, [index?.people, members]);

  // Guardar nuevo integrante
  const handleAddMember = async (e) => {
    e.preventDefault();
    const cleanName = newName.trim();
    if (!cleanName) return toast('Escribe el nombre del integrante.', 'error');
    setSubmittingAdd(true);
    try {
      await saveTeamMember({
        name: cleanName,
        canDirect: newCanDirect,
        instruments: newInstruments.length ? newInstruments : ['Voz'],
      });
      toast(`Integrante ${cleanName} añadido al directorio`);
      setNewName('');
      setNewCanDirect(false);
      setNewInstruments(['Voz']);
      setShowAddForm(false);
      await loadData();
      await refreshTeamMembers();
    } catch (err) {
      toast(err.message || 'No se pudo guardar el integrante.', 'error');
    } finally {
      setSubmittingAdd(false);
    }
  };

  // Abrir editor de integrante
  const startEditing = (member) => {
    setEditingMember(member);
    setEditName(member.name);
    setEditCanDirect(Boolean(member.canDirect));
    setEditInstruments(Array.isArray(member.instruments) && member.instruments.length ? [...member.instruments] : ['Voz']);
    setEditCustomInstrument('');
  };

  // Guardar edición de integrante
  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editingMember) return;
    const cleanName = editName.trim();
    if (!cleanName) return toast('Escribe el nombre del integrante.', 'error');
    setSavingEdit(true);
    try {
      await saveTeamMember({
        id: editingMember.id,
        name: cleanName,
        canDirect: editCanDirect,
        instruments: editInstruments.length ? editInstruments : ['Voz'],
      });
      toast(`Integrante ${cleanName} actualizado`);
      setEditingMember(null);
      await loadData();
      await refreshTeamMembers();
    } catch (err) {
      toast(err.message || 'No se pudieron guardar los cambios.', 'error');
    } finally {
      setSavingEdit(false);
    }
  };

  // Toggle rápido de director
  const handleToggleCanDirect = async (member) => {
    try {
      await saveTeamMember({
        ...member,
        canDirect: !member.canDirect,
      });
      toast(
        member.canDirect
          ? `${member.name} ya no tiene rol principal de director`
          : `${member.name} habilitado como director`
      );
      await loadData();
      await refreshTeamMembers();
    } catch {
      toast('Error al actualizar integrante.', 'error');
    }
  };

  // Sincronizar todos los integrantes faltantes del historial
  const handleSyncAllFromHistory = async () => {
    if (!missingFromHistory.length) return;
    setSyncingAll(true);
    try {
      await batchSaveTeamMembers(missingFromHistory);
      toast(`${plural(missingFromHistory.length, 'integrante importado', 'integrantes importados')} del historial`);
      await loadData();
      await refreshTeamMembers();
    } catch (err) {
      toast(err.message || 'Error al importar integrantes del historial.', 'error');
    } finally {
      setSyncingAll(false);
    }
  };

  // Importar un integrante específico del historial
  const handleSyncOneFromHistory = async (person) => {
    try {
      await saveTeamMember({
        name: person.name,
        canDirect: person.canDirect,
        instruments: person.instruments,
      });
      toast(`${person.name} añadido al directorio`);
      await loadData();
      await refreshTeamMembers();
    } catch (err) {
      toast(err.message || 'Error al importar integrante.', 'error');
    }
  };

  // Confirmar eliminación
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

  // Toggles de instrumentos
  const toggleInstrumentInList = (list, setList, item) => {
    if (list.includes(item)) {
      if (list.length === 1) {
        toast('El integrante debe tener al menos un instrumento o rol (ej. Voz).', 'error');
        return;
      }
      setList(list.filter((x) => x !== item));
    } else {
      setList([...list, item]);
    }
  };

  const addCustomInstrumentToList = (list, setList, customValue, setCustomValue) => {
    const val = customValue.trim();
    if (!val) return;
    if (!list.includes(val)) {
      setList([...list, val]);
    }
    setCustomValue('');
  };

  // Clasificación para filtros
  const isDirector = (m) => Boolean(m.canDirect);
  const isMusician = (m) => {
    const ins = (m.instruments || []).map((i) => i.toLowerCase());
    return ins.some((i) => !['voz', 'coros'].includes(i)) || !m.canDirect;
  };

  const directorsCount = useMemo(() => members.filter(isDirector).length, [members]);
  const musiciansCount = useMemo(() => members.filter(isMusician).length, [members]);

  // Lista filtrada
  const filteredMembers = useMemo(() => {
    return members.filter((m) => {
      if (activeTab === 'directores' && !isDirector(m)) return false;
      if (activeTab === 'musicos' && !isMusician(m)) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = m.name.toLowerCase().includes(q);
        const matchIns = (m.instruments || []).some((i) => i.toLowerCase().includes(q));
        return matchName || matchIns;
      }
      return true;
    });
  }, [members, activeTab, searchQuery]);

  return (
    <>
      <Sheet open={open && !memberToDelete} onClose={onClose} title="Directorio del Equipo">
        <p className="mb-3 text-xs text-muted">
          Directorio oficial de músicos, coristas y directores para el servicio de alabanza.
        </p>

        {/* Banner de Sincronización con el Historial */}
        {missingFromHistory.length > 0 && (
          <div className="mb-4 rounded-2xl border border-brand-yellow/40 bg-accent-soft/80 p-3.5 text-xs text-ink">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <Sparkles size={18} className="mt-0.5 shrink-0 text-brand-yellow" aria-hidden />
                <div>
                  <h4 className="font-bold text-ink">
                    {missingFromHistory.length} {missingFromHistory.length === 1 ? 'persona detectada' : 'personas detectadas'} en el historial
                  </h4>
                  <p className="mt-0.5 text-muted">
                    Hay músicos, coristas o directores registrados en servicios pasados que aún no están en el directorio oficial.
                  </p>
                </div>
              </div>
              <Button
                variant="primary"
                onClick={handleSyncAllFromHistory}
                disabled={syncingAll}
                className="shrink-0 text-xs px-2.5 py-1.5"
              >
                {syncingAll ? 'Importando…' : `Importar todos (${missingFromHistory.length})`}
              </Button>
            </div>

            <div className="mt-3 flex flex-wrap gap-1.5 pt-2 border-t border-line/60">
              {missingFromHistory.slice(0, 8).map((p) => (
                <button
                  key={p.name}
                  type="button"
                  onClick={() => handleSyncOneFromHistory(p)}
                  className="inline-flex items-center gap-1 rounded-lg border border-line bg-surface px-2 py-1 text-[11px] font-semibold text-ink hover:border-brand-blue hover:bg-brand-blue/10 transition"
                  title="Haz clic para agregar al directorio oficial"
                >
                  <Plus size={12} />
                  <span>{p.name}</span>
                  <span className="text-[10px] text-muted">({p.instruments.slice(0, 2).join(', ')})</span>
                </button>
              ))}
              {missingFromHistory.length > 8 && (
                <span className="self-center px-1 text-[11px] text-muted">
                  +{missingFromHistory.length - 8} más
                </span>
              )}
            </div>
          </div>
        )}

        {/* Panel de Edición de Integrante (Modal/Drawer integrado) */}
        {editingMember && (
          <form onSubmit={handleSaveEdit} className="mb-5 rounded-2xl border-2 border-brand-blue bg-surface p-4 shadow-sm">
            <div className="flex items-center justify-between gap-2 border-b border-line pb-2 mb-3">
              <div className="flex items-center gap-2">
                <PenLine size={16} className="text-brand-blue" />
                <h4 className="text-sm font-bold text-ink">Editar integrante: {editingMember.name}</h4>
              </div>
              <IconButton icon={X} label="Cerrar edición" onClick={() => setEditingMember(null)} />
            </div>

            <div className="space-y-3.5">
              <div>
                <label className="mb-1 block text-xs font-semibold text-ink">Nombre completo</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-brand-blue"
                  placeholder="Nombre y apellido"
                  required
                />
              </div>

              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <label className="text-xs font-semibold text-ink">Instrumentos y roles que desempeña</label>
                  <span className="text-[10px] text-muted">Selecciona todos los que apliquen</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {PRESET_INSTRUMENTS.map((ins) => {
                    const active = editInstruments.includes(ins);
                    return (
                      <button
                        key={ins}
                        type="button"
                        onClick={() => toggleInstrumentInList(editInstruments, setEditInstruments, ins)}
                        className={cx(
                          'rounded-lg px-2.5 py-1 text-xs font-medium border transition',
                          active
                            ? 'border-brand-blue bg-brand-blue text-white shadow-xs'
                            : 'border-line bg-sunken text-muted hover:border-ink/30 hover:text-ink'
                        )}
                      >
                        {active && <Check size={12} className="inline mr-1 -mt-0.5" />}
                        {ins}
                      </button>
                    );
                  })}
                  {/* Instrumentos personalizados que no están en la lista fija */}
                  {editInstruments
                    .filter((ins) => !PRESET_INSTRUMENTS.includes(ins))
                    .map((custom) => (
                      <button
                        key={custom}
                        type="button"
                        onClick={() => toggleInstrumentInList(editInstruments, setEditInstruments, custom)}
                        className="rounded-lg px-2.5 py-1 text-xs font-medium border border-brand-blue bg-brand-blue text-white"
                      >
                        <Check size={12} className="inline mr-1 -mt-0.5" />
                        {custom} <span className="ml-1 opacity-70">×</span>
                      </button>
                    ))}
                </div>

                {/* Input para instrumento personalizado */}
                <div className="mt-2 flex gap-1.5">
                  <input
                    type="text"
                    value={editCustomInstrument}
                    onChange={(e) => setEditCustomInstrument(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addCustomInstrumentToList(
                          editInstruments,
                          setEditInstruments,
                          editCustomInstrument,
                          setEditCustomInstrument
                        );
                      }
                    }}
                    placeholder="+ Otro instrumento (ej. Violonchelo, Congas)…"
                    className="flex-1 rounded-lg border border-line bg-sunken px-2.5 py-1 text-xs text-ink placeholder:text-muted/60"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() =>
                      addCustomInstrumentToList(
                        editInstruments,
                        setEditInstruments,
                        editCustomInstrument,
                        setEditCustomInstrument
                      )
                    }
                    className="shrink-0 text-xs px-2.5 py-1"
                  >
                    Añadir
                  </Button>
                </div>
              </div>

              {/* Rol de Director */}
              <div className="rounded-xl border border-line bg-sunken/60 p-3">
                <label className="flex items-start gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={editCanDirect}
                    onChange={(e) => setEditCanDirect(e.target.checked)}
                    className="mt-0.5 size-4 rounded border-line text-brand-blue"
                  />
                  <div>
                    <span className="text-xs font-bold text-ink">Puede dirigir alabanza (Director oficial)</span>
                    <p className="mt-0.5 text-[11px] text-muted">
                      Aparecerá en el grupo principal de directores al crear o editar servicios.
                      (Nota: Cualquier músico o corista también puede ser seleccionado para dirigir en servicios individuales).
                    </p>
                  </div>
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <Button type="button" variant="ghost" onClick={() => setEditingMember(null)} className="text-xs">
                  Cancelar
                </Button>
                <Button type="submit" variant="primary" disabled={savingEdit} className="text-xs">
                  {savingEdit ? 'Guardando…' : 'Guardar cambios'}
                </Button>
              </div>
            </div>
          </form>
        )}

        {/* Formulario nuevo integrante (Colapsable) */}
        {!editingMember && (
          <div className="mb-4">
            {!showAddForm ? (
              <div className="flex justify-between items-center gap-2">
                <Button
                  variant="secondary"
                  icon={Plus}
                  onClick={() => setShowAddForm(true)}
                  className="w-full text-xs py-2"
                >
                  Añadir nuevo integrante
                </Button>
              </div>
            ) : (
              <form onSubmit={handleAddMember} className="rounded-2xl border border-line bg-sunken/60 p-3.5">
                <div className="flex items-center justify-between mb-2.5">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted">Nuevo integrante</h4>
                  <IconButton icon={X} label="Cerrar formulario" onClick={() => setShowAddForm(false)} />
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="sr-only">Nombre del integrante</label>
                    <input
                      type="text"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="Nombre y apellido (ej. Laura Torres)"
                      className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-muted/60 focus:border-brand-blue"
                      required
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold text-ink">Instrumentos / Voces</label>
                    <div className="flex flex-wrap gap-1.5">
                      {PRESET_INSTRUMENTS.map((ins) => {
                        const active = newInstruments.includes(ins);
                        return (
                          <button
                            key={ins}
                            type="button"
                            onClick={() => toggleInstrumentInList(newInstruments, setNewInstruments, ins)}
                            className={cx(
                              'rounded-lg px-2.5 py-1 text-xs font-medium border transition',
                              active
                                ? 'border-brand-blue bg-brand-blue text-white shadow-xs'
                                : 'border-line bg-surface text-muted hover:text-ink'
                            )}
                          >
                            {active && <Check size={12} className="inline mr-1 -mt-0.5" />}
                            {ins}
                          </button>
                        );
                      })}
                      {newInstruments
                        .filter((ins) => !PRESET_INSTRUMENTS.includes(ins))
                        .map((custom) => (
                          <button
                            key={custom}
                            type="button"
                            onClick={() => toggleInstrumentInList(newInstruments, setNewInstruments, custom)}
                            className="rounded-lg px-2.5 py-1 text-xs font-medium border border-brand-blue bg-brand-blue text-white"
                          >
                            <Check size={12} className="inline mr-1 -mt-0.5" />
                            {custom}
                          </button>
                        ))}
                    </div>

                    <div className="mt-2 flex gap-1.5">
                      <input
                        type="text"
                        value={newCustomInstrument}
                        onChange={(e) => setNewCustomInstrument(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            addCustomInstrumentToList(
                              newInstruments,
                              setNewInstruments,
                              newCustomInstrument,
                              setNewCustomInstrument
                            );
                          }
                        }}
                        placeholder="+ Otro instrumento…"
                        className="flex-1 rounded-lg border border-line bg-surface px-2.5 py-1 text-xs text-ink placeholder:text-muted/60"
                      />
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() =>
                          addCustomInstrumentToList(
                            newInstruments,
                            setNewInstruments,
                            newCustomInstrument,
                            setNewCustomInstrument
                          )
                        }
                        className="shrink-0 text-xs px-2.5 py-1"
                      >
                        Añadir
                      </Button>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pt-1">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={newCanDirect}
                        onChange={(e) => setNewCanDirect(e.target.checked)}
                        className="size-4 rounded border-line text-brand-blue"
                      />
                      <span className="text-xs font-semibold text-ink">Puede dirigir alabanza</span>
                    </label>

                    <div className="flex items-center gap-2">
                      <Button type="button" variant="ghost" onClick={() => setShowAddForm(false)} className="text-xs">
                        Cancelar
                      </Button>
                      <Button type="submit" variant="primary" disabled={submittingAdd} className="text-xs">
                        {submittingAdd ? 'Guardando…' : 'Guardar integrante'}
                      </Button>
                    </div>
                  </div>
                </div>
              </form>
            )}
          </div>
        )}

        {/* Barra de Búsqueda y Pestañas */}
        <div className="mb-3 space-y-2">
          {/* Barra de Búsqueda */}
          <div className="relative">
            <Search size={15} aria-hidden className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por nombre o instrumento…"
              className="w-full rounded-xl border border-line bg-surface py-1.5 pl-8 pr-8 text-xs text-ink placeholder:text-muted/60 focus:border-brand-blue"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute top-1/2 right-2.5 -translate-y-1/2 text-muted hover:text-ink"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Pestañas de Filtro */}
          <div className="flex gap-1 rounded-xl border border-line bg-sunken/60 p-1">
            <button
              type="button"
              onClick={() => setActiveTab('todos')}
              className={cx(
                'flex-1 rounded-lg py-1.5 text-xs font-semibold transition',
                activeTab === 'todos'
                  ? 'bg-surface text-ink shadow-xs'
                  : 'text-muted hover:text-ink'
              )}
            >
              Todos ({members.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('directores')}
              className={cx(
                'flex-1 rounded-lg py-1.5 text-xs font-semibold transition',
                activeTab === 'directores'
                  ? 'bg-surface text-ink shadow-xs'
                  : 'text-muted hover:text-ink'
              )}
            >
              Directores ({directorsCount})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('musicos')}
              className={cx(
                'flex-1 rounded-lg py-1.5 text-xs font-semibold transition',
                activeTab === 'musicos'
                  ? 'bg-surface text-ink shadow-xs'
                  : 'text-muted hover:text-ink'
              )}
            >
              Músicos ({musiciansCount})
            </button>
          </div>
        </div>

        {/* Lista de Integrantes */}
        {loading ? (
          <div className="py-8 text-center text-sm text-muted">Cargando directorio…</div>
        ) : filteredMembers.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-sm font-medium text-ink">No se encontraron integrantes</p>
            <p className="mt-1 text-xs text-muted">
              {searchQuery ? 'Prueba con otro término de búsqueda.' : 'No hay integrantes en esta pestaña.'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredMembers.map((m) => (
              <div
                key={m.id}
                className="flex items-center justify-between gap-2.5 rounded-2xl border border-line bg-surface p-3 transition hover:border-brand-blue/30"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-bold text-ink">{m.name}</p>
                    {m.canDirect && (
                      <span className="rounded-md bg-accent/25 px-1.5 py-0.5 text-[10px] font-extrabold text-ink">
                        Director(a)
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1 text-[11px] text-muted">
                    {(m.instruments || []).map((ins) => (
                      <span key={ins} className="rounded-md bg-sunken px-2 py-0.5 font-medium text-ink/80 border border-line/40">
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
                        ? 'border-accent bg-accent/20 text-ink'
                        : 'border-line text-muted hover:bg-sunken'
                    )}
                    title={m.canDirect ? 'Quitar rol principal de director' : 'Habilitar como director oficial'}
                  >
                    {m.canDirect ? 'Es Director' : 'Habilitar director'}
                  </button>
                  <IconButton
                    icon={PenLine}
                    label={`Editar a ${m.name}`}
                    onClick={() => startEditing(m)}
                  />
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
