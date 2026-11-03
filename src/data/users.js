import { collection, deleteDoc, doc, getDoc, getDocs, setDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';

export const ROLES = {
  admin: {
    id: 'admin',
    label: 'Admin',
    badgeClass: 'bg-[#B80E0A]/10 text-[#B80E0A] dark:bg-[#B80E0A]/20 dark:text-[#ff7a72]',
    description: 'Acceso total: gestión de usuarios, importación/exportación de JSON y administración de servicios.',
  },
  editor: {
    id: 'editor',
    label: 'Gestor de canciones',
    badgeClass: 'bg-[#213E91]/10 text-[#213E91] dark:bg-[#213E91]/30 dark:text-[#8AA4EE]',
    description: 'Puede crear y editar servicios, orden de alabanza, canciones y músicos.',
  },
  viewer: {
    id: 'viewer',
    label: 'Visualizador',
    badgeClass: 'bg-muted/15 text-muted dark:bg-muted/30 dark:text-ink',
    description: 'Acceso en modo solo lectura para consultar servicios, canciones y reportes.',
  },
};

export const INITIAL_USERS = [
  { email: 'jnaguinix@gmail.com', role: 'admin' },
  { email: 'jamesdpuertam@gmail.com', role: 'admin' },
  { email: 'katherua@gmail.com', role: 'editor' },
  { email: 'camilohurtado120@gmail.com', role: 'editor' },
  { email: 'manuela201022@gmail.com', role: 'viewer' },
];

export const normalizeEmail = (email) => (email || '').trim().toLowerCase();

const roleCache = new Map();

/**
 * Obtiene el rol asignado a un correo.
 * Utiliza caché en memoria para no repetir lecturas innecesarias en cada render.
 */
export async function getUserRole(rawEmail, force = false) {
  const email = normalizeEmail(rawEmail);
  if (!email) return null;

  if (!force && roleCache.has(email)) {
    return roleCache.get(email);
  }

  try {
    const userDoc = await getDoc(doc(db, 'usuarios', email));
    if (userDoc.exists()) {
      const r = userDoc.data().role || 'viewer';
      roleCache.set(email, r);
      return r;
    }
  } catch (err) {
    console.warn('Error leyendo rol de Firestore, verificando semilla:', err);
  }

  const fallback = INITIAL_USERS.find((u) => u.email === email);
  const finalRole = fallback ? fallback.role : null;
  if (finalRole) roleCache.set(email, finalRole);
  return finalRole;
}

/**
 * Lista todos los usuarios con rol.
 */
export async function listUsers() {
  try {
    const snapshot = await getDocs(collection(db, 'usuarios'));
    const firestoreUsers = new Map(snapshot.docs.map((d) => [d.id, d.data()]));

    // Asegurarse de que los iniciales existan en la lista mostrada
    INITIAL_USERS.forEach((init) => {
      if (!firestoreUsers.has(init.email)) {
        firestoreUsers.set(init.email, {
          email: init.email,
          role: init.role,
          updatedAt: Date.now(),
          updatedBy: 'sistema',
        });
      }
    });

    return Array.from(firestoreUsers.values()).sort((a, b) => {
      const order = { admin: 0, editor: 1, viewer: 2 };
      return (order[a.role] ?? 3) - (order[b.role] ?? 3) || a.email.localeCompare(b.email);
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'usuarios');
    return INITIAL_USERS.map((u) => ({ ...u, updatedAt: Date.now() }));
  }
}

/**
 * Crea o actualiza el rol de un usuario.
 */
export async function setUserRole(rawEmail, role, updatedBy = 'admin') {
  const email = normalizeEmail(rawEmail);
  if (!email || !email.includes('@')) {
    throw new Error('Por favor ingresa un correo electrónico válido.');
  }
  if (!ROLES[role]) {
    throw new Error('El rol especificado no es válido.');
  }

  try {
    const payload = {
      email,
      role,
      updatedAt: Date.now(),
      updatedBy: normalizeEmail(updatedBy),
    };
    await setDoc(doc(db, 'usuarios', email), payload);
    roleCache.set(email, role);
    return payload;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `usuarios/${email}`);
  }
}

/**
 * Elimina el acceso de un usuario.
 */
export async function removeUser(rawEmail) {
  const email = normalizeEmail(rawEmail);
  if (email === 'jnaguinix@gmail.com') {
    throw new Error('No es posible eliminar al administrador principal.');
  }

  try {
    await deleteDoc(doc(db, 'usuarios', email));
    roleCache.delete(email);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `usuarios/${email}`);
  }
}

/**
 * Inicializa en Firestore los usuarios iniciales solo si no se ha realizado antes.
 * Evita múltiples lecturas en cada inicio de sesión.
 */
export async function seedInitialUsers() {
  const SEED_KEY = 'alabanzapp:users_seeded_v1';
  try {
    if (localStorage.getItem(SEED_KEY)) return;
  } catch {
    // ignorar error de localStorage
  }

  try {
    for (const user of INITIAL_USERS) {
      const snap = await getDoc(doc(db, 'usuarios', user.email));
      if (!snap.exists()) {
        await setDoc(doc(db, 'usuarios', user.email), {
          email: user.email,
          role: user.role,
          updatedAt: Date.now(),
          updatedBy: 'sistema',
        });
      }
    }
    try {
      localStorage.setItem(SEED_KEY, 'true');
    } catch {}
  } catch (err) {
    console.warn('Nota: Semilla de usuarios ya activa o restringida:', err);
  }
}
