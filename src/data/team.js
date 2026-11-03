import { collection, deleteDoc, doc, getDoc, getDocs, setDoc, writeBatch } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { keyOf, cleanSingleName, splitAndCleanNames } from '../lib/format';

export const DEFAULT_MEMBERS = [
  { name: 'Camilo', canDirect: true, instruments: ['Voz', 'Guitarra acústica'] },
  { name: 'Kathe', canDirect: true, instruments: ['Voz'] },
  { name: 'Dani', canDirect: true, instruments: ['Voz', 'Piano'] },
  { name: 'Hanny', canDirect: true, instruments: ['Voz'] },
  { name: 'Laura Torres', canDirect: true, instruments: ['Voz'] },
  { name: 'Sofía Vargas', canDirect: false, instruments: ['Piano'] },
  { name: 'David Morales', canDirect: false, instruments: ['Guitarra acústica'] },
  { name: 'Mateo Ríos', canDirect: false, instruments: ['Guitarra eléctrica'] },
  { name: 'Andrés Gómez', canDirect: false, instruments: ['Bajo'] },
  { name: 'Juan Pérez', canDirect: false, instruments: ['Batería'] },
  { name: 'Samuel Ortiz', canDirect: false, instruments: ['Batería'] },
  { name: 'Lucas Peña', canDirect: false, instruments: ['Guitarra eléctrica'] },
  { name: 'Elena Ramos', canDirect: false, instruments: ['Voz'] },
  { name: 'Carlos Ruiz', canDirect: false, instruments: ['Bajo'] },
  { name: 'Tomás Silva', canDirect: false, instruments: ['Piano'] },
  { name: 'Mariana Castro', canDirect: false, instruments: ['Voz'] },
];

let teamCache = null;
let teamCachePromise = null;
let teamCacheTimestamp = 0;
const TEAM_TTL_MS = 5 * 60 * 1000;

export function invalidateTeamCache() {
  teamCache = null;
  teamCachePromise = null;
  teamCacheTimestamp = 0;
}

/**
 * Obtiene la lista oficial de miembros del equipo con caché en memoria.
 * Evita múltiples lecturas a Firestore cada vez que se abre un selector o página.
 */
export async function listTeamMembers(force = false) {
  const now = Date.now();
  if (!force && teamCache && now - teamCacheTimestamp < TEAM_TTL_MS) {
    return teamCache;
  }
  if (!force && teamCachePromise) {
    return teamCachePromise;
  }

  teamCachePromise = (async () => {
    try {
      const snap = await getDocs(collection(db, 'integrantes'));
      if (snap.empty) {
        // Auto-inicializar miembros por defecto en lote
        await seedTeamMembers();
        teamCache = DEFAULT_MEMBERS.map((m) => ({
          id: keyOf(m.name),
          name: m.name,
          canDirect: m.canDirect ?? true,
          instruments: m.instruments || ['Voz'],
          active: true,
        })).sort((a, b) => a.name.localeCompare(b.name));
        teamCacheTimestamp = Date.now();
        return teamCache;
      }

      teamCache = snap.docs
        .map((d) => d.data())
        .filter((m) => m.active !== false)
        .sort((a, b) => a.name.localeCompare(b.name));
      teamCacheTimestamp = Date.now();
      return teamCache;
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'integrantes');
      return DEFAULT_MEMBERS.map((m) => ({
        id: keyOf(m.name),
        name: m.name,
        canDirect: m.canDirect ?? true,
        instruments: m.instruments || ['Voz'],
        active: true,
      })).sort((a, b) => a.name.localeCompare(b.name));
    } finally {
      teamCachePromise = null;
    }
  })();

  return teamCachePromise;
}

/**
 * Guarda o actualiza un integrante en el directorio.
 * Descompone automáticamente entradas compuestas y normaliza nombres erróneos (ej. Luchó -> Lucho).
 */
export async function saveTeamMember({ id, name, canDirect = true, instruments = ['Voz'], active = true }) {
  const memberName = (name || '').trim();
  if (!memberName) {
    throw new Error('Escribe el nombre del integrante.');
  }

  const individualNames = splitAndCleanNames(memberName);
  if (individualNames.length > 1) {
    // Si el usuario intentó guardar un nombre compuesto ("Camilo / Kathe"), guardamos cada individuo
    const saved = [];
    for (const singleName of individualNames) {
      const singleId = keyOf(singleName);
      const payload = {
        id: singleId,
        name: singleName,
        canDirect: Boolean(canDirect),
        instruments: Array.isArray(instruments) && instruments.length ? instruments : ['Voz'],
        active: Boolean(active),
        updatedAt: Date.now(),
      };
      await setDoc(doc(db, 'integrantes', singleId), payload, { merge: true });
      saved.push(payload);
    }
    // Si existía un id anterior compuesto (ej. "camilo-kathe"), eliminar el doc obsoleto
    if (id && !individualNames.some((n) => keyOf(n) === id)) {
      try {
        await deleteDoc(doc(db, 'integrantes', id));
      } catch {}
    }
    invalidateTeamCache();
    return saved[0];
  }

  const cleanName = individualNames[0] || cleanSingleName(memberName);
  const memberId = id && id !== keyOf(memberName) ? id : keyOf(cleanName);
  const payload = {
    id: memberId,
    name: cleanName,
    canDirect: Boolean(canDirect),
    instruments: Array.isArray(instruments) && instruments.length ? instruments : ['Voz'],
    active: Boolean(active),
    updatedAt: Date.now(),
  };

  try {
    await setDoc(doc(db, 'integrantes', memberId), payload);
    // Si el ID cambió (ej. de un ID obsoleto a uno limpio), eliminar el documento viejo
    if (id && id !== memberId) {
      try {
        await deleteDoc(doc(db, 'integrantes', id));
      } catch {}
    }
    invalidateTeamCache();
    return payload;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `integrantes/${memberId}`);
  }
}

/**
 * Elimina un integrante del directorio oficial.
 */
export async function deleteTeamMember(id) {
  try {
    await deleteDoc(doc(db, 'integrantes', id));
    invalidateTeamCache();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `integrantes/${id}`);
  }
}

/**
 * Guarda múltiples integrantes en Firestore en una operación por lote.
 */
export async function batchSaveTeamMembers(members) {
  if (!Array.isArray(members) || members.length === 0) return [];
  const BATCH_SIZE = 450;
  const saved = [];

  for (let i = 0; i < members.length; i += BATCH_SIZE) {
    const chunk = members.slice(i, i + BATCH_SIZE);
    const batch = writeBatch(db);
    for (const m of chunk) {
      const memberName = (m.name || '').trim();
      if (!memberName) continue;

      const individualNames = splitAndCleanNames(memberName);
      const namesToSave = individualNames.length ? individualNames : [cleanSingleName(memberName)];

      for (const singleName of namesToSave) {
        const memberId = keyOf(singleName);
        const payload = {
          id: memberId,
          name: singleName,
          canDirect: Boolean(m.canDirect),
          instruments: Array.isArray(m.instruments) && m.instruments.length ? m.instruments : ['Voz'],
          active: m.active !== false,
          updatedAt: Date.now(),
        };
        batch.set(doc(db, 'integrantes', memberId), payload, { merge: true });
        saved.push(payload);
      }
    }
    await batch.commit();
  }

  invalidateTeamCache();
  return saved;
}

/**
 * Inicializa los integrantes por defecto en una sola operación atómica si no existen.
 */
export async function seedTeamMembers() {
  const SEED_KEY = 'alabanzapp:team_seeded_v1';
  try {
    if (localStorage.getItem(SEED_KEY)) return;
  } catch {}

  try {
    const batch = writeBatch(db);
    for (const m of DEFAULT_MEMBERS) {
      const memberId = keyOf(m.name);
      const docRef = doc(db, 'integrantes', memberId);
      batch.set(docRef, {
        id: memberId,
        name: m.name,
        canDirect: m.canDirect ?? true,
        instruments: m.instruments || ['Voz'],
        active: true,
        updatedAt: Date.now(),
      });
    }
    await batch.commit();
    invalidateTeamCache();
    try {
      localStorage.setItem(SEED_KEY, 'true');
    } catch {}
  } catch (err) {
    console.warn('Nota en semilla de integrantes:', err);
  }
}
