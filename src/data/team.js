import { collection, deleteDoc, doc, getDoc, getDocs, setDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { keyOf } from '../lib/format';

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

/**
 * Obtiene la lista oficial de miembros del equipo.
 */
export async function listTeamMembers() {
  try {
    const snap = await getDocs(collection(db, 'integrantes'));
    if (snap.empty) {
      // Auto-inicializar miembros por defecto
      await seedTeamMembers();
      return DEFAULT_MEMBERS.map((m) => ({
        id: keyOf(m.name),
        name: m.name,
        canDirect: m.canDirect ?? true,
        instruments: m.instruments || ['Voz'],
        active: true,
      })).sort((a, b) => a.name.localeCompare(b.name));
    }

    return snap.docs
      .map((d) => d.data())
      .filter((m) => m.active !== false)
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'integrantes');
    return DEFAULT_MEMBERS.map((m) => ({
      id: keyOf(m.name),
      name: m.name,
      canDirect: m.canDirect ?? true,
      instruments: m.instruments || ['Voz'],
      active: true,
    })).sort((a, b) => a.name.localeCompare(b.name));
  }
}

/**
 * Guarda o actualiza un integrante en el directorio.
 */
export async function saveTeamMember({ id, name, canDirect = true, instruments = ['Voz'], active = true }) {
  const memberName = name.trim();
  if (!memberName) {
    throw new Error('Escribe el nombre del integrante.');
  }

  const memberId = id || keyOf(memberName);
  const payload = {
    id: memberId,
    name: memberName,
    canDirect: Boolean(canDirect),
    instruments: Array.isArray(instruments) && instruments.length ? instruments : ['Voz'],
    active: Boolean(active),
    updatedAt: Date.now(),
  };

  try {
    await setDoc(doc(db, 'integrantes', memberId), payload);
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
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `integrantes/${id}`);
  }
}

/**
 * Inicializa los integrantes por defecto si no existen.
 */
export async function seedTeamMembers() {
  try {
    for (const m of DEFAULT_MEMBERS) {
      const memberId = keyOf(m.name);
      const docRef = doc(db, 'integrantes', memberId);
      const snap = await getDoc(docRef);
      if (!snap.exists()) {
        await setDoc(docRef, {
          id: memberId,
          name: m.name,
          canDirect: m.canDirect ?? true,
          instruments: m.instruments || ['Voz'],
          active: true,
          updatedAt: Date.now(),
        });
      }
    }
  } catch (err) {
    console.warn('Nota en semilla de integrantes:', err);
  }
}
